/**
 * Endgame-focused analysis: compares our tuned bot endgame behavior
 * against treason database winners' late-game patterns.
 *
 * Runs fresh simulations, then reads treason data for comparison.
 *
 * Usage: npx tsx scripts/analyze-endgame.ts [path-to-games.json]
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../src/engine/GameEngine';
import { BotBrain, BotDecision } from '../src/engine/BotBrain';
import { GameLogger } from '../src/server/GameLogger';
import { DecisionRecord, GameLog } from '../src/shared/gameLogTypes';
import {
  ActionType,
  BotPersonality,
  Character,
  GameStatus,
  PersonalityParams,
  RoomPlayer,
  TurnPhase,
} from '../src/shared/types';
import { ACTION_DEFINITIONS, BOT_NAMES, BOT_PERSONALITIES } from '../src/shared/constants';

// ─── Simulation Runner (copied from simulate.ts) ───

interface SimBot {
  id: string;
  name: string;
  personality: PersonalityParams;
  deckMemory: Map<Character, number>;
  lastProcessedLogLength: number;
}

function captureDecision(engine: GameEngine, bot: SimBot, decision: BotDecision): DecisionRecord {
  const player = engine.game.getPlayer(bot.id)!;
  const hand = [...player.hiddenCharacters];

  const record: DecisionRecord = {
    turnNumber: engine.game.turnNumber,
    phase: engine.game.turnPhase,
    botName: bot.name,
    botId: bot.id,
    hand,
    coins: player.coins,
    aliveCount: engine.game.getAlivePlayers().length,
    decision: decision.type,
  };

  switch (decision.type) {
    case 'action': {
      record.action = decision.action;
      if (decision.targetId) {
        const target = engine.game.getPlayer(decision.targetId);
        record.targetName = target?.name;
      }
      const def = ACTION_DEFINITIONS[decision.action];
      if (def.claimedCharacter) {
        record.isBluff = !hand.includes(def.claimedCharacter);
      }
      break;
    }
    case 'block':
      record.blockCharacter = decision.character;
      record.isBluff = !hand.includes(decision.character);
      break;
    case 'choose_influence_loss': {
      const inf = player.influences[decision.influenceIndex];
      if (inf) record.lostCharacter = inf.character;
      break;
    }
    case 'choose_exchange': {
      const state = engine.getFullState();
      if (state.exchangeState) {
        const allCards = [...hand, ...state.exchangeState.drawnCards];
        const kept = decision.keepIndices.map(i => allCards[i]);
        const returned = allCards.filter((_, i) => !decision.keepIndices.includes(i));
        record.exchangeKept = kept;
        record.exchangeReturned = returned;
      }
      break;
    }
  }

  return record;
}

function executeDecision(engine: GameEngine, bot: SimBot, decision: BotDecision): void {
  switch (decision.type) {
    case 'action': engine.handleAction(bot.id, decision.action, decision.targetId); break;
    case 'challenge': engine.handleChallenge(bot.id); break;
    case 'pass_challenge': engine.handlePassChallenge(bot.id); break;
    case 'block': engine.handleBlock(bot.id, decision.character); break;
    case 'pass_block': engine.handlePassBlock(bot.id); break;
    case 'challenge_block': engine.handleChallengeBlock(bot.id); break;
    case 'pass_challenge_block': engine.handlePassChallengeBlock(bot.id); break;
    case 'choose_influence_loss': engine.handleChooseInfluenceLoss(bot.id, decision.influenceIndex); break;
    case 'choose_exchange': {
      if (bot.deckMemory) {
        const state = engine.getFullState();
        if (state.exchangeState) {
          const player = engine.game.getPlayer(bot.id);
          if (player) {
            const allCards = [...player.hiddenCharacters, ...state.exchangeState.drawnCards];
            const kept = new Set(decision.keepIndices);
            const returned = allCards.filter((_, i) => !kept.has(i));
            bot.deckMemory.clear();
            for (const card of returned) {
              bot.deckMemory.set(card, (bot.deckMemory.get(card) || 0) + 1);
            }
          }
        }
      }
      engine.handleChooseExchange(bot.id, decision.keepIndices);
      break;
    }
  }
}

function invalidateDeckMemory(engine: GameEngine, bots: SimBot[]): void {
  const logLength = engine.game.actionLog.length;
  for (const bot of bots) {
    if (bot.deckMemory.size === 0) { bot.lastProcessedLogLength = logLength; continue; }
    for (let i = bot.lastProcessedLogLength; i < logLength; i++) {
      const entry = engine.game.actionLog[i];
      if ((entry.eventType === 'exchange' && entry.actorId !== bot.id) ||
          entry.eventType === 'challenge_fail' || entry.eventType === 'block_challenge_fail') {
        bot.deckMemory.clear();
        break;
      }
    }
    bot.lastProcessedLogLength = logLength;
  }
}

function runGame(): { engine: GameEngine; roomPlayers: RoomPlayer[]; bots: SimBot[]; decisions: DecisionRecord[] } {
  const engine = new GameEngine('SIM');
  const decisions: DecisionRecord[] = [];
  const bots: SimBot[] = [];
  const playerInfos: Array<{ id: string; name: string }> = [];
  const roomPlayers: RoomPlayer[] = [];

  for (let i = 0; i < 5; i++) {
    const id = uuidv4();
    const name = BOT_NAMES[i];
    bots.push({ id, name, personality: BOT_PERSONALITIES.optimal, deckMemory: new Map(), lastProcessedLogLength: 0 });
    playerInfos.push({ id, name });
    roomPlayers.push({ id, name, socketId: '', connected: false, isBot: true, personality: 'optimal' as BotPersonality });
  }

  engine.startGame(playerInfos);

  let iterations = 0;
  while (engine.game.status === GameStatus.InProgress && iterations < 2000) {
    iterations++;
    invalidateDeckMemory(engine, bots);
    let acted = false;
    for (const bot of bots) {
      const state = engine.getFullState();
      const decision = BotBrain.decide(
        engine.game, bot.id, bot.personality,
        state.pendingAction, state.pendingBlock, state.challengeState,
        state.influenceLossRequest, state.exchangeState, state.blockPassedPlayerIds,
        bot.deckMemory,
      );
      if (decision) {
        decisions.push(captureDecision(engine, bot, decision));
        executeDecision(engine, bot, decision);
        acted = true;
        break;
      }
    }
    if (!acted) {
      const phase = engine.game.turnPhase;
      if (phase === TurnPhase.AwaitingActionChallenge || phase === TurnPhase.AwaitingBlock || phase === TurnPhase.AwaitingBlockChallenge) {
        engine.handleTimerExpiry();
      } else break;
    }
  }

  return { engine, roomPlayers, bots, decisions };
}

// ─── Treason Decoding (from analyze-winners.ts) ───

const ROLES = ['none', 'duke', 'captain', 'assassin', 'ambassador', 'contessa'];
const ACTION_MAP_TREASON: Record<number, { action: string; targeted: boolean }> = {
  0x1: { action: 'tax', targeted: false }, 0x9: { action: 'foreign-aid', targeted: false },
  0x2: { action: 'steal', targeted: true }, 0x3: { action: 'assassinate', targeted: true },
  0x4: { action: 'exchange', targeted: false }, 0x5: { action: 'coup', targeted: true },
  0xD: { action: 'income', targeted: false },
};

interface PlayerState { cash: number; influence: string[] }
interface StartOfTurnEvent { type: 'start_of_turn'; whoseTurn: number; playerStates: PlayerState[] }
interface ActionEvent { type: 'action'; action: string; player: number; target?: number }
interface ChallengeEvent { type: 'challenge_success' | 'challenge_fail'; challenger: number; challenged: number }
interface BlockEvent { type: 'block'; blockingPlayer: number; blockingRole: string }
interface GameOverEvent { type: 'game_over'; playerStates: PlayerState[] }
type GameEvent = StartOfTurnEvent | ActionEvent | ChallengeEvent | BlockEvent | { type: 'player_left'; player: number } | GameOverEvent;

function decodeInfluence(nibble: number): string {
  const revealed = (nibble & 0x8) !== 0;
  const roleCode = nibble & 0x7;
  const role = ROLES[roleCode] || 'none';
  if (role === 'none') return '';
  return revealed ? `!${role}` : role;
}

function unpackEvents(base64: string, playerCount: number): GameEvent[] {
  const buf = Buffer.from(base64, 'base64');
  const events: GameEvent[] = [];
  let i = 0, lastTurnPlayer = 0, expectAction = false;
  while (i < buf.length) {
    if (expectAction) {
      const byte = buf[i++];
      const actionDef = ACTION_MAP_TREASON[(byte >> 4) & 0xF];
      if (actionDef) {
        const evt: ActionEvent = { type: 'action', action: actionDef.action, player: lastTurnPlayer };
        if (actionDef.targeted && (byte & 0xF) > 0) evt.target = byte & 0xF;
        events.push(evt);
      }
      expectAction = false;
      continue;
    }
    const byte = buf[i++];
    const eventType = (byte >> 4) & 0xF;
    const low = byte & 0xF;
    switch (eventType) {
      case 1: {
        lastTurnPlayer = low;
        const ps: PlayerState[] = [];
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++];
          const ib = buf[i++];
          ps.push({ cash, influence: [decodeInfluence((ib >> 4) & 0xF), decodeInfluence(ib & 0xF)].filter(x => x !== '') });
        }
        events.push({ type: 'start_of_turn', whoseTurn: low, playerStates: ps });
        expectAction = true;
        break;
      }
      case 7: {
        const ps: PlayerState[] = [];
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++];
          const ib = buf[i++];
          ps.push({ cash, influence: [decodeInfluence((ib >> 4) & 0xF), decodeInfluence(ib & 0xF)].filter(x => x !== '') });
        }
        events.push({ type: 'game_over', playerStates: ps });
        break;
      }
      case 3: case 4: {
        const nb = buf[i++];
        events.push({ type: eventType === 3 ? 'challenge_success' : 'challenge_fail', challenger: low, challenged: nb & 0xF });
        break;
      }
      case 5: events.push({ type: 'block', blockingPlayer: low, blockingRole: ROLES[buf[i++]] || 'unknown' }); break;
      case 6: events.push({ type: 'player_left', player: low }); break;
    }
  }
  return events;
}

interface TreasonGame {
  _id: string; players: number; humanPlayers: number;
  playerRank: string[]; playerDisconnect: number[];
  gameStarted: number; gameFinished: number;
  gameType: string; events: string;
}

// ─── Endgame Stats ───

interface EndgameStats {
  // 1v1 scenarios
  oneV1Actions: Record<string, number>;
  oneV1Total: number;
  oneV1Bluffs: Record<string, { total: number; bluffs: number }>;
  oneV1Challenges: number;
  oneV1ChallengeSuccess: number;
  oneV1Blocks: Record<string, number>;
  oneV1BlockBluffs: Record<string, { total: number; bluffs: number }>;
  oneV1Coups: number;

  // 3-player scenarios
  threePlayerActions: Record<string, number>;
  threePlayerTotal: number;
  threePlayerBluffs: Record<string, { total: number; bluffs: number }>;
  threePlayerCoups: number;
  threePlayerChallenges: number;
  threePlayerChallengeSuccess: number;

  // 3P1L (3 players, all 1 life) — the critical endgame scenario
  threeP1LActions: Record<string, number>;
  threeP1LTotal: number;
  threeP1LCoups: number;

  // Coup timing (coins when couping)
  coupCoins: number[];

  // Cards held at 2-alive and 3-alive
  cardsAt2Alive: Record<string, number>;
  cardsAt3Alive: Record<string, number>;
  cardsAt2Total: number;
  cardsAt3Total: number;

  // Games counted
  games: number;
}

function newEndgameStats(): EndgameStats {
  return {
    oneV1Actions: {}, oneV1Total: 0,
    oneV1Bluffs: {},
    oneV1Challenges: 0, oneV1ChallengeSuccess: 0,
    oneV1Blocks: {},
    oneV1BlockBluffs: {},
    oneV1Coups: 0,
    threePlayerActions: {}, threePlayerTotal: 0,
    threePlayerBluffs: {},
    threePlayerCoups: 0,
    threePlayerChallenges: 0, threePlayerChallengeSuccess: 0,
    threeP1LActions: {}, threeP1LTotal: 0, threeP1LCoups: 0,
    cardsAt2Alive: {}, cardsAt3Alive: {},
    cardsAt2Total: 0, cardsAt3Total: 0,
    coupCoins: [],
    games: 0,
  };
}

// ─── Analyze Our Simulation Endgame ───

function analyzeOurEndgame(allDecisions: DecisionRecord[][], allLogs: GameLog[]): EndgameStats {
  const stats = newEndgameStats();
  stats.games = allLogs.length;

  for (const decisions of allDecisions) {
    for (const d of decisions) {
      if (d.decision !== 'action' || !d.action || !d.aliveCount) continue;

      const actionToRole: Record<string, string> = {
        [ActionType.Tax]: 'duke', [ActionType.Steal]: 'captain',
        [ActionType.Assassinate]: 'assassin', [ActionType.Exchange]: 'ambassador',
      };

      // 1v1 (2 alive)
      if (d.aliveCount === 2) {
        stats.oneV1Actions[d.action] = (stats.oneV1Actions[d.action] || 0) + 1;
        stats.oneV1Total++;
        if (d.action === ActionType.Coup) {
          stats.oneV1Coups++;
          stats.coupCoins.push(d.coins);
        }
        const role = actionToRole[d.action];
        if (role && d.isBluff !== undefined) {
          if (!stats.oneV1Bluffs[d.action]) stats.oneV1Bluffs[d.action] = { total: 0, bluffs: 0 };
          stats.oneV1Bluffs[d.action].total++;
          if (d.isBluff) stats.oneV1Bluffs[d.action].bluffs++;
        }
        // Track cards held at 2-alive
        for (const c of d.hand) {
          stats.cardsAt2Alive[c] = (stats.cardsAt2Alive[c] || 0) + 1;
          stats.cardsAt2Total++;
        }
      }

      // 3 alive
      if (d.aliveCount === 3) {
        stats.threePlayerActions[d.action] = (stats.threePlayerActions[d.action] || 0) + 1;
        stats.threePlayerTotal++;
        if (d.action === ActionType.Coup) {
          stats.threePlayerCoups++;
          stats.coupCoins.push(d.coins);
        }
        const role = actionToRole[d.action];
        if (role && d.isBluff !== undefined) {
          if (!stats.threePlayerBluffs[d.action]) stats.threePlayerBluffs[d.action] = { total: 0, bluffs: 0 };
          stats.threePlayerBluffs[d.action].total++;
          if (d.isBluff) stats.threePlayerBluffs[d.action].bluffs++;
        }
        // Track cards held at 3-alive
        for (const c of d.hand) {
          stats.cardsAt3Alive[c] = (stats.cardsAt3Alive[c] || 0) + 1;
          stats.cardsAt3Total++;
        }
      }

      // Detect 3P1L: 3 alive and 1 card in hand (all 1 influence)
      if (d.aliveCount === 3 && d.hand.length === 1) {
        stats.threeP1LActions[d.action] = (stats.threeP1LActions[d.action] || 0) + 1;
        stats.threeP1LTotal++;
        if (d.action === ActionType.Coup) stats.threeP1LCoups++;
      }
    }

    // Challenge/block data from non-action decisions in endgame
    for (const d of decisions) {
      if (!d.aliveCount) continue;

      if (d.aliveCount === 2) {
        if (d.decision === 'challenge') { stats.oneV1Challenges++; }
        if (d.decision === 'block' && d.blockCharacter) {
          const role = d.blockCharacter;
          stats.oneV1Blocks[role] = (stats.oneV1Blocks[role] || 0) + 1;
          if (!stats.oneV1BlockBluffs[role]) stats.oneV1BlockBluffs[role] = { total: 0, bluffs: 0 };
          stats.oneV1BlockBluffs[role].total++;
          if (d.isBluff) stats.oneV1BlockBluffs[role].bluffs++;
        }
      }

      if (d.aliveCount === 3) {
        if (d.decision === 'challenge') stats.threePlayerChallenges++;
      }
    }
  }

  return stats;
}

// ─── Analyze Treason Winner Endgame ───

function analyzeTreasonEndgame(games: TreasonGame[]): EndgameStats {
  const stats = newEndgameStats();

  for (const game of games) {
    let events: GameEvent[];
    try { events = unpackEvents(game.events, game.players); } catch { continue; }
    if (events.length === 0) continue;

    // Find winner
    const gameOver = events.find(e => e.type === 'game_over') as GameOverEvent | undefined;
    if (!gameOver) continue;
    let winnerIndex = -1;
    for (let p = 0; p < gameOver.playerStates.length; p++) {
      if (gameOver.playerStates[p].influence.some(inf => !inf.startsWith('!'))) {
        winnerIndex = p;
        break;
      }
    }
    if (winnerIndex === -1) continue;

    stats.games++;
    let lastStart: StartOfTurnEvent | null = null;

    for (let i = 0; i < events.length; i++) {
      const evt = events[i];

      if (evt.type === 'start_of_turn') {
        lastStart = evt;
        continue;
      }

      if (evt.type === 'action' && lastStart) {
        // Count alive players
        const aliveCount = lastStart.playerStates.filter(
          ps => ps.influence.some(inf => !inf.startsWith('!'))
        ).length;

        const isWinner = evt.player === winnerIndex;

        // Only track winner's actions for direct comparison
        if (!isWinner) continue;

        const actionToRole: Record<string, string> = {
          'tax': 'duke', 'steal': 'captain', 'assassinate': 'assassin', 'exchange': 'ambassador',
        };

        if (aliveCount === 2) {
          stats.oneV1Actions[evt.action] = (stats.oneV1Actions[evt.action] || 0) + 1;
          stats.oneV1Total++;
          if (evt.action === 'coup') {
            stats.oneV1Coups++;
            const winnerState = lastStart.playerStates[winnerIndex];
            if (winnerState) stats.coupCoins.push(winnerState.cash);
          }
          const role = actionToRole[evt.action];
          if (role) {
            if (!stats.oneV1Bluffs[evt.action]) stats.oneV1Bluffs[evt.action] = { total: 0, bluffs: 0 };
            stats.oneV1Bluffs[evt.action].total++;
            const ws = lastStart.playerStates[winnerIndex];
            if (ws && !ws.influence.some(inf => inf === role)) {
              stats.oneV1Bluffs[evt.action].bluffs++;
            }
          }
          // Cards at 2-alive
          const ws = lastStart.playerStates[winnerIndex];
          if (ws) {
            for (const inf of ws.influence) {
              if (!inf.startsWith('!')) {
                stats.cardsAt2Alive[inf] = (stats.cardsAt2Alive[inf] || 0) + 1;
                stats.cardsAt2Total++;
              }
            }
          }
        }

        if (aliveCount === 3) {
          stats.threePlayerActions[evt.action] = (stats.threePlayerActions[evt.action] || 0) + 1;
          stats.threePlayerTotal++;
          if (evt.action === 'coup') stats.threePlayerCoups++;
          const role = actionToRole[evt.action];
          if (role) {
            if (!stats.threePlayerBluffs[evt.action]) stats.threePlayerBluffs[evt.action] = { total: 0, bluffs: 0 };
            stats.threePlayerBluffs[evt.action].total++;
            const ws = lastStart.playerStates[winnerIndex];
            if (ws && !ws.influence.some(inf => inf === role)) {
              stats.threePlayerBluffs[evt.action].bluffs++;
            }
          }
          // Cards at 3-alive
          const ws = lastStart.playerStates[winnerIndex];
          if (ws) {
            for (const inf of ws.influence) {
              if (!inf.startsWith('!')) {
                stats.cardsAt3Alive[inf] = (stats.cardsAt3Alive[inf] || 0) + 1;
                stats.cardsAt3Total++;
              }
            }
          }

          // 3P1L detection: 3 alive, all with 1 unrevealed influence
          const allOneLife = lastStart.playerStates.every(ps => {
            const alive = ps.influence.filter(inf => !inf.startsWith('!'));
            const dead = ps.influence.filter(inf => inf.startsWith('!'));
            return alive.length <= 1; // 0 = already eliminated, 1 = one life
          });
          if (allOneLife) {
            stats.threeP1LActions[evt.action] = (stats.threeP1LActions[evt.action] || 0) + 1;
            stats.threeP1LTotal++;
            if (evt.action === 'coup') stats.threeP1LCoups++;
          }
        }
      }

      // Challenges in endgame (winner as challenger)
      if ((evt.type === 'challenge_success' || evt.type === 'challenge_fail') && lastStart) {
        const aliveCount = lastStart.playerStates.filter(
          ps => ps.influence.some(inf => !inf.startsWith('!'))
        ).length;
        if (evt.challenger === winnerIndex) {
          if (aliveCount === 2) {
            stats.oneV1Challenges++;
            if (evt.type === 'challenge_success') stats.oneV1ChallengeSuccess++;
          }
          if (aliveCount === 3) {
            stats.threePlayerChallenges++;
            if (evt.type === 'challenge_success') stats.threePlayerChallengeSuccess++;
          }
        }
      }

      // Blocks in endgame (winner as blocker)
      if (evt.type === 'block' && lastStart) {
        const aliveCount = lastStart.playerStates.filter(
          ps => ps.influence.some(inf => !inf.startsWith('!'))
        ).length;
        // Determine blocker from target of last action
        const lastActionIdx = events.slice(0, i).reverse().findIndex(e => e.type === 'action');
        const lastAction = lastActionIdx >= 0 ? events[i - 1 - lastActionIdx] as ActionEvent : null;
        let blockerIdx: number | null = null;
        if (lastAction && lastAction.target !== undefined) blockerIdx = lastAction.target;

        if (blockerIdx === winnerIndex && aliveCount === 2) {
          const role = evt.blockingRole;
          stats.oneV1Blocks[role] = (stats.oneV1Blocks[role] || 0) + 1;
          if (!stats.oneV1BlockBluffs[role]) stats.oneV1BlockBluffs[role] = { total: 0, bluffs: 0 };
          stats.oneV1BlockBluffs[role].total++;
          const ws = lastStart.playerStates[winnerIndex];
          if (ws && !ws.influence.some(inf => inf === role)) {
            stats.oneV1BlockBluffs[role].bluffs++;
          }
        }
      }
    }
  }

  return stats;
}

// ─── Print Comparison ───

function printEndgameComparison(ours: EndgameStats, treason: EndgameStats): void {
  const actionOrder = ['tax', 'steal', 'income', 'exchange', 'assassinate', 'coup', 'foreign-aid'];
  // Map our ActionType enum values to lowercase for comparison
  const toLower: Record<string, string> = {
    [ActionType.Tax]: 'tax', [ActionType.Steal]: 'steal', [ActionType.Income]: 'income',
    [ActionType.Exchange]: 'exchange', [ActionType.Assassinate]: 'assassinate',
    [ActionType.Coup]: 'coup', [ActionType.ForeignAid]: 'foreign-aid',
  };

  // Normalize our action keys to lowercase
  function getOurAction(stats: Record<string, number>, action: string): number {
    // Try direct match first, then ActionType enum values
    if (stats[action] !== undefined) return stats[action];
    for (const [enumVal, lower] of Object.entries(toLower)) {
      if (lower === action && stats[enumVal] !== undefined) return stats[enumVal];
    }
    return 0;
  }

  function getOurBluff(stats: Record<string, { total: number; bluffs: number }>, action: string): { total: number; bluffs: number } | null {
    if (stats[action]) return stats[action];
    for (const [enumVal, lower] of Object.entries(toLower)) {
      if (lower === action && stats[enumVal]) return stats[enumVal];
    }
    return null;
  }

  function getOurCard(stats: Record<string, number>, role: string): number {
    if (stats[role] !== undefined) return stats[role];
    // Map lowercase role to Character enum
    const roleMap: Record<string, string> = {
      'duke': Character.Duke, 'captain': Character.Captain,
      'assassin': Character.Assassin, 'ambassador': Character.Ambassador,
      'contessa': Character.Contessa,
    };
    const enumVal = roleMap[role];
    return enumVal ? (stats[enumVal] || 0) : 0;
  }

  console.log('\n' + '═'.repeat(80));
  console.log('  ENDGAME ANALYSIS: Our Tuned Bots vs Treason Winners');
  console.log('═'.repeat(80));

  console.log(`\n  Our simulation: ${ours.games} games (5 optimal bots)`);
  console.log(`  Treason winners: ${treason.games.toLocaleString()} games (5-player, all-human lobbies)\n`);

  // ─── 1v1 (2 alive) ───
  console.log('  ══ 1v1 ENDGAME (2 players alive) ══\n');

  console.log(`  Action decisions in 1v1:`);
  console.log(`    Our bots: ${ours.oneV1Total}  |  Treason winners: ${treason.oneV1Total}\n`);

  console.log(`    ${'Action'.padEnd(16)} ${'Our Bots %'.padStart(12)} ${'Treason Win %'.padStart(14)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(14)}  ${'─'.repeat(8)}`);

  for (const action of actionOrder) {
    const oCount = getOurAction(ours.oneV1Actions, action);
    const tCount = treason.oneV1Actions[action] || 0;
    const oPct = ours.oneV1Total > 0 ? (oCount / ours.oneV1Total * 100) : 0;
    const tPct = treason.oneV1Total > 0 ? (tCount / treason.oneV1Total * 100) : 0;
    if (oPct === 0 && tPct === 0) continue;
    const delta = oPct - tPct;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      `    ${action.padEnd(16)} ${(oPct.toFixed(1) + '%').padStart(12)} ${(tPct.toFixed(1) + '%').padStart(14)}  ${(sign + delta.toFixed(1)).padStart(8)}`
    );
  }

  // 1v1 bluff rates
  console.log(`\n  1v1 Bluff Rates:`);
  console.log(`    ${'Action'.padEnd(16)} ${'Our Bots'.padStart(12)} ${'Treason Win'.padStart(14)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(14)}`);
  for (const action of ['tax', 'steal', 'assassinate', 'exchange']) {
    const oRec = getOurBluff(ours.oneV1Bluffs, action);
    const tRec = treason.oneV1Bluffs[action];
    const oRate = oRec && oRec.total > 0 ? (oRec.bluffs / oRec.total * 100).toFixed(1) + '%' : 'n/a';
    const tRate = tRec && tRec.total > 0 ? (tRec.bluffs / tRec.total * 100).toFixed(1) + '%' : 'n/a';
    console.log(`    ${action.padEnd(16)} ${oRate.padStart(12)} ${tRate.padStart(14)}`);
  }

  // 1v1 blocks
  const ourBlockTotal1v1 = Object.values(ours.oneV1Blocks).reduce((a, b) => a + b, 0);
  const tBlockTotal1v1 = Object.values(treason.oneV1Blocks).reduce((a, b) => a + b, 0);
  if (ourBlockTotal1v1 > 0 || tBlockTotal1v1 > 0) {
    console.log(`\n  1v1 Block Behavior:`);
    console.log(`    Our bots: ${ourBlockTotal1v1} blocks  |  Treason winners: ${tBlockTotal1v1} blocks`);
    for (const role of ['duke', 'captain', 'ambassador', 'contessa']) {
      const oCount = getOurCard(ours.oneV1Blocks, role);
      const tCount = treason.oneV1Blocks[role] || 0;
      if (oCount === 0 && tCount === 0) continue;
      const oBluff = ours.oneV1BlockBluffs[role] || ours.oneV1BlockBluffs[Character.Duke] && role === 'duke'
        ? (getOurCard(ours.oneV1BlockBluffs as any, role) as any)
        : null;
      // Simplified: just show counts
      console.log(`      ${role.padEnd(12)} ours: ${oCount}  treason: ${tCount}`);
    }
  }

  // 1v1 challenges
  console.log(`\n  1v1 Challenges:`);
  console.log(`    Our bots: ${ours.oneV1Challenges} challenges`);
  console.log(`    Treason winners: ${treason.oneV1Challenges} challenges (${treason.oneV1ChallengeSuccess} succeeded)`);

  // Coup rate in 1v1
  const ourCoupPct1v1 = ours.oneV1Total > 0 ? (ours.oneV1Coups / ours.oneV1Total * 100).toFixed(1) : '0.0';
  const tCoupPct1v1 = treason.oneV1Total > 0 ? (treason.oneV1Coups / treason.oneV1Total * 100).toFixed(1) : '0.0';
  console.log(`\n  1v1 Coup Rate: Our bots ${ourCoupPct1v1}%  |  Treason winners ${tCoupPct1v1}%`);

  // Cards held in 1v1
  console.log(`\n  Cards Held in 1v1:`);
  console.log(`    ${'Card'.padEnd(16)} ${'Our Bots %'.padStart(12)} ${'Treason Win %'.padStart(14)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(14)}`);
  for (const role of ['duke', 'captain', 'assassin', 'ambassador', 'contessa']) {
    const oCount = getOurCard(ours.cardsAt2Alive, role);
    const tCount = treason.cardsAt2Alive[role] || 0;
    const oPct = ours.cardsAt2Total > 0 ? (oCount / ours.cardsAt2Total * 100) : 0;
    const tPct = treason.cardsAt2Total > 0 ? (tCount / treason.cardsAt2Total * 100) : 0;
    console.log(
      `    ${role.padEnd(16)} ${(oPct.toFixed(1) + '%').padStart(12)} ${(tPct.toFixed(1) + '%').padStart(14)}`
    );
  }

  // ─── 3 Alive ───
  console.log('\n\n  ══ 3-PLAYER ENDGAME (3 players alive) ══\n');

  console.log(`  Action decisions at 3-alive:`);
  console.log(`    Our bots: ${ours.threePlayerTotal}  |  Treason winners: ${treason.threePlayerTotal}\n`);

  console.log(`    ${'Action'.padEnd(16)} ${'Our Bots %'.padStart(12)} ${'Treason Win %'.padStart(14)}  ${'Delta'.padStart(8)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(14)}  ${'─'.repeat(8)}`);

  for (const action of actionOrder) {
    const oCount = getOurAction(ours.threePlayerActions, action);
    const tCount = treason.threePlayerActions[action] || 0;
    const oPct = ours.threePlayerTotal > 0 ? (oCount / ours.threePlayerTotal * 100) : 0;
    const tPct = treason.threePlayerTotal > 0 ? (tCount / treason.threePlayerTotal * 100) : 0;
    if (oPct === 0 && tPct === 0) continue;
    const delta = oPct - tPct;
    const sign = delta >= 0 ? '+' : '';
    console.log(
      `    ${action.padEnd(16)} ${(oPct.toFixed(1) + '%').padStart(12)} ${(tPct.toFixed(1) + '%').padStart(14)}  ${(sign + delta.toFixed(1)).padStart(8)}`
    );
  }

  // 3-player bluff rates
  console.log(`\n  3-Player Bluff Rates:`);
  console.log(`    ${'Action'.padEnd(16)} ${'Our Bots'.padStart(12)} ${'Treason Win'.padStart(14)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(14)}`);
  for (const action of ['tax', 'steal', 'assassinate', 'exchange']) {
    const oRec = getOurBluff(ours.threePlayerBluffs, action);
    const tRec = treason.threePlayerBluffs[action];
    const oRate = oRec && oRec.total > 0 ? (oRec.bluffs / oRec.total * 100).toFixed(1) + '%' : 'n/a';
    const tRate = tRec && tRec.total > 0 ? (tRec.bluffs / tRec.total * 100).toFixed(1) + '%' : 'n/a';
    console.log(`    ${action.padEnd(16)} ${oRate.padStart(12)} ${tRate.padStart(14)}`);
  }

  // Cards held at 3-alive
  console.log(`\n  Cards Held at 3-Alive:`);
  console.log(`    ${'Card'.padEnd(16)} ${'Our Bots %'.padStart(12)} ${'Treason Win %'.padStart(14)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(14)}`);
  for (const role of ['duke', 'captain', 'assassin', 'ambassador', 'contessa']) {
    const oCount = getOurCard(ours.cardsAt3Alive, role);
    const tCount = treason.cardsAt3Alive[role] || 0;
    const oPct = ours.cardsAt3Total > 0 ? (oCount / ours.cardsAt3Total * 100) : 0;
    const tPct = treason.cardsAt3Total > 0 ? (tCount / treason.cardsAt3Total * 100) : 0;
    console.log(
      `    ${role.padEnd(16)} ${(oPct.toFixed(1) + '%').padStart(12)} ${(tPct.toFixed(1) + '%').padStart(14)}`
    );
  }

  // ─── 3P1L ───
  if (ours.threeP1LTotal > 0 || treason.threeP1LTotal > 0) {
    console.log('\n\n  ══ 3P1L ENDGAME (3 players, all 1 life — critical scenario) ══\n');

    console.log(`  Action decisions in 3P1L:`);
    console.log(`    Our bots: ${ours.threeP1LTotal}  |  Treason winners: ${treason.threeP1LTotal}\n`);

    console.log(`    ${'Action'.padEnd(16)} ${'Our Bots %'.padStart(12)} ${'Treason Win %'.padStart(14)}`);
    console.log(`    ${'─'.repeat(16)} ${'─'.repeat(12)} ${'─'.repeat(14)}`);
    for (const action of actionOrder) {
      const oCount = getOurAction(ours.threeP1LActions, action);
      const tCount = treason.threeP1LActions[action] || 0;
      const oPct = ours.threeP1LTotal > 0 ? (oCount / ours.threeP1LTotal * 100) : 0;
      const tPct = treason.threeP1LTotal > 0 ? (tCount / treason.threeP1LTotal * 100) : 0;
      if (oPct === 0 && tPct === 0) continue;
      console.log(
        `    ${action.padEnd(16)} ${(oPct.toFixed(1) + '%').padStart(12)} ${(tPct.toFixed(1) + '%').padStart(14)}`
      );
    }

    const ourCoupPct3P1L = ours.threeP1LTotal > 0 ? (ours.threeP1LCoups / ours.threeP1LTotal * 100).toFixed(1) : '0.0';
    const tCoupPct3P1L = treason.threeP1LTotal > 0 ? (treason.threeP1LCoups / treason.threeP1LTotal * 100).toFixed(1) : '0.0';
    console.log(`\n  3P1L Coup Rate: Our bots ${ourCoupPct3P1L}%  |  Treason winners ${tCoupPct3P1L}%`);
  }

  // ─── Coup Timing ───
  console.log('\n\n  ══ COUP TIMING (coins when couping) ══\n');
  if (ours.coupCoins.length > 0) {
    const avg = ours.coupCoins.reduce((a, b) => a + b, 0) / ours.coupCoins.length;
    const dist = new Map<number, number>();
    for (const c of ours.coupCoins) dist.set(c, (dist.get(c) || 0) + 1);
    console.log(`  Our bots (${ours.coupCoins.length} coups): avg ${avg.toFixed(1)} coins`);
    for (const [coins, count] of [...dist.entries()].sort((a, b) => a[0] - b[0])) {
      const bar = '█'.repeat(Math.round(count / ours.coupCoins.length * 30));
      console.log(`    ${coins} coins: ${String(count).padStart(3)} (${(count / ours.coupCoins.length * 100).toFixed(0)}%) ${bar}`);
    }
  }
  if (treason.coupCoins.length > 0) {
    const avg = treason.coupCoins.reduce((a, b) => a + b, 0) / treason.coupCoins.length;
    const dist = new Map<number, number>();
    for (const c of treason.coupCoins) dist.set(c, (dist.get(c) || 0) + 1);
    console.log(`\n  Treason winners (${treason.coupCoins.length} coups): avg ${avg.toFixed(1)} coins`);
    for (const [coins, count] of [...dist.entries()].sort((a, b) => a[0] - b[0])) {
      const bar = '█'.repeat(Math.round(count / treason.coupCoins.length * 30));
      console.log(`    ${coins} coins: ${String(count).padStart(3)} (${(count / treason.coupCoins.length * 100).toFixed(0)}%) ${bar}`);
    }
  }

  console.log('');
}

// ─── Main ───

async function main() {
  const filePath = process.argv[2] || path.join(process.env.HOME || '', 'Documents', 'games.json');

  // ─── Run fresh simulations ───
  const numGames = parseInt(process.argv[3] || '50', 10);
  console.log(`\nRunning ${numGames} simulations with tuned optimal bots...\n`);
  const allDecisions: DecisionRecord[][] = [];
  const allLogs: GameLog[] = [];

  for (let i = 0; i < numGames; i++) {
    const { engine, roomPlayers, decisions } = runGame();
    if (engine.game.status !== GameStatus.Finished) continue;
    const log = GameLogger.buildGameLog(engine, roomPlayers, 'simulation');
    log.decisions = decisions;
    allDecisions.push(decisions);
    allLogs.push(log);
    const winner = log.winnerName;
    console.log(`  Game ${String(i + 1).padStart(2)}: Winner: ${winner.padEnd(12)} Turns: ${log.stats.totalTurns}`);
  }

  console.log(`\n  ${allLogs.length} games completed.`);
  const avgLen = allLogs.reduce((a, l) => a + l.stats.totalTurns, 0) / allLogs.length;
  console.log(`  Avg game length: ${avgLen.toFixed(1)} turns\n`);

  // ─── Analyze our endgame ───
  const ourEndgame = analyzeOurEndgame(allDecisions, allLogs);

  // ─── Load and analyze treason ───
  console.log(`Reading ${filePath}...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  console.log('Parsing JSON...');
  const games: TreasonGame[] = JSON.parse(content);
  const valid = games.filter(g => g != null && g.gameType === 'original' &&
    g.playerDisconnect.length === 0 && g.events && g.events.length > 0);

  // All-human 5-player lobbies for cleanest signal
  const allHuman5P = valid.filter(g => g.players === 5 && g.humanPlayers === 5);
  console.log(`All-human 5P games: ${allHuman5P.length.toLocaleString()}`);

  console.log('Analyzing treason winner endgame...');
  const treasonEndgame = analyzeTreasonEndgame(allHuman5P);

  // ─── Print comparison ───
  printEndgameComparison(ourEndgame, treasonEndgame);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
