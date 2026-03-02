/**
 * Early-game and mid-game strategy analysis.
 *
 * Part 1: Simulate 50 bot games and analyze bluff persistence —
 *   when a bot bluffs a character and gets away with it, do they
 *   keep claiming that same character on subsequent turns?
 *
 * Part 2: Parse treason games.json and extract winner-only strategies
 *   for early game (turns 1-5) and mid game (turns 6-15).
 *
 * Usage: npx tsx scripts/analyze-earlymid.ts [path-to-games.json]
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../src/engine/GameEngine';
import { BotBrain, BotDecision } from '../src/engine/BotBrain';
import { DecisionRecord } from '../src/shared/gameLogTypes';
import {
  ActionType,
  Character,
  GameStatus,
  PersonalityParams,
  RoomPlayer,
  TurnPhase,
} from '../src/shared/types';
import { ACTION_DEFINITIONS, BOT_NAMES, BOT_PERSONALITIES } from '../src/shared/constants';

// ═══════════════════════════════════════════════════════════
//  PART 1: BOT SIMULATION — BLUFF PERSISTENCE ANALYSIS
// ═══════════════════════════════════════════════════════════

interface SimBot {
  id: string;
  name: string;
  personality: PersonalityParams;
  deckMemory: Map<Character, number>;
  lastProcessedLogLength: number;
}

function captureDecision(
  engine: GameEngine, bot: SimBot, decision: BotDecision,
): DecisionRecord {
  const player = engine.game.getPlayer(bot.id)!;
  const hand = [...player.hiddenCharacters];
  const state = engine.getFullState();

  const record: DecisionRecord = {
    turnNumber: engine.game.turnNumber,
    phase: engine.game.turnPhase,
    botName: bot.name, botId: bot.id,
    hand, coins: player.coins,
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
      engine.handleChooseExchange(bot.id, decision.keepIndices);
      break;
    }
  }
}

function invalidateDeckMemory(engine: GameEngine, bots: SimBot[]): void {
  const logLength = engine.game.actionLog.length;
  for (const bot of bots) {
    if (bot.deckMemory.size === 0) {
      bot.lastProcessedLogLength = logLength;
      continue;
    }
    for (let i = bot.lastProcessedLogLength; i < logLength; i++) {
      const entry = engine.game.actionLog[i];
      if (entry.eventType === 'exchange' && entry.actorId !== bot.id) {
        bot.deckMemory.clear(); break;
      }
      if (entry.eventType === 'challenge_fail' || entry.eventType === 'block_challenge_fail') {
        bot.deckMemory.clear(); break;
      }
    }
    bot.lastProcessedLogLength = logLength;
  }
}

function runGame(playerCount: number, personality: PersonalityParams): {
  decisions: DecisionRecord[];
  winnerId: string;
} {
  const engine = new GameEngine('SIM');
  const decisions: DecisionRecord[] = [];
  const bots: SimBot[] = [];
  const playerInfos: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < playerCount; i++) {
    const id = uuidv4();
    const name = BOT_NAMES[i % BOT_NAMES.length];
    bots.push({ id, name, personality, deckMemory: new Map(), lastProcessedLogLength: 0 });
    playerInfos.push({ id, name });
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

  return { decisions, winnerId: engine.game.winnerId || '' };
}

// ─── Character claimed by action ───
const ACTION_TO_CHAR: Record<string, Character> = {
  [ActionType.Tax]: Character.Duke,
  [ActionType.Steal]: Character.Captain,
  [ActionType.Assassinate]: Character.Assassin,
  [ActionType.Exchange]: Character.Ambassador,
};

function analyzeBluffPersistence(allDecisions: DecisionRecord[][]): void {
  console.log('\n' + '═'.repeat(70));
  console.log('  BLUFF PERSISTENCE ANALYSIS');
  console.log('  Do bots stick to a bluffed character after getting away with it?');
  console.log('═'.repeat(70));

  // For each game, track per-bot: when they bluff a character and don't get
  // challenged (or get challenged but somehow survive), do they claim it again?
  let totalUnchallengedBluffs = 0;
  let followedUpSameChar = 0;
  let followedUpDiffChar = 0;
  let playedHonestAfter = 0;
  let noSubsequentClaim = 0;

  // Track by character
  const byChar = new Map<Character, { unchallenged: number; followedUp: number; switched: number; honest: number }>();
  for (const c of Object.values(Character)) {
    byChar.set(c, { unchallenged: 0, followedUp: 0, switched: 0, honest: 0 });
  }

  // Track multi-bluff streaks
  let maxStreak = 0;
  const streakLengths: number[] = [];

  for (const decisions of allDecisions) {
    // Group decisions by bot
    const byBot = new Map<string, DecisionRecord[]>();
    for (const d of decisions) {
      if (!byBot.has(d.botId)) byBot.set(d.botId, []);
      byBot.get(d.botId)!.push(d);
    }

    for (const [botId, botDecisions] of byBot) {
      // Get only action decisions in order
      const actions = botDecisions.filter(d => d.decision === 'action' && d.action);

      let currentStreak = 0;
      let lastBluffChar: Character | null = null;

      for (let i = 0; i < actions.length; i++) {
        const d = actions[i];
        const claimedChar = d.action ? ACTION_TO_CHAR[d.action] : undefined;

        if (d.isBluff && claimedChar) {
          // This is a bluff — check if it's a follow-up to a previous unchallenged bluff
          if (lastBluffChar) {
            if (claimedChar === lastBluffChar) {
              followedUpSameChar++;
              byChar.get(claimedChar)!.followedUp++;
              currentStreak++;
            } else {
              followedUpDiffChar++;
              byChar.get(lastBluffChar)!.switched++;
              currentStreak = 1;
            }
          } else {
            currentStreak = 1;
          }

          // Check if this bluff was caught (look for a challenge in subsequent decisions)
          const wasCaught = isBotCaughtBluffing(botDecisions, d.turnNumber);
          if (wasCaught) {
            // Streak ended
            if (currentStreak > 0) streakLengths.push(currentStreak);
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 0;
            lastBluffChar = null;
          } else {
            totalUnchallengedBluffs++;
            byChar.get(claimedChar)!.unchallenged++;
            lastBluffChar = claimedChar;
          }
        } else if (claimedChar && !d.isBluff) {
          // Honest claim after a bluff
          if (lastBluffChar) {
            playedHonestAfter++;
            byChar.get(lastBluffChar)!.honest++;
            if (currentStreak > 0) streakLengths.push(currentStreak);
            maxStreak = Math.max(maxStreak, currentStreak);
            currentStreak = 0;
            lastBluffChar = null;
          }
        } else {
          // Non-claim action (Income, FA, Coup) — doesn't reset bluff tracking
        }
      }

      // End of game — if bot had unchallenged bluffs but no more claims
      if (lastBluffChar) {
        noSubsequentClaim++;
        if (currentStreak > 0) streakLengths.push(currentStreak);
        maxStreak = Math.max(maxStreak, currentStreak);
      }
    }
  }

  console.log(`\n  Total unchallenged bluffs: ${totalUnchallengedBluffs}`);
  console.log(`\n  After getting away with a bluff, next character-claiming action was:`);
  const total = followedUpSameChar + followedUpDiffChar + playedHonestAfter + noSubsequentClaim;
  if (total > 0) {
    console.log(`    Same character bluff again: ${followedUpSameChar} (${(followedUpSameChar/total*100).toFixed(1)}%)`);
    console.log(`    Different character bluff:  ${followedUpDiffChar} (${(followedUpDiffChar/total*100).toFixed(1)}%)`);
    console.log(`    Played honestly:            ${playedHonestAfter} (${(playedHonestAfter/total*100).toFixed(1)}%)`);
    console.log(`    No subsequent claim (game ended): ${noSubsequentClaim} (${(noSubsequentClaim/total*100).toFixed(1)}%)`);
  }

  console.log(`\n  Bluff streaks (consecutive same-char bluffs):`);
  console.log(`    Longest streak: ${maxStreak}`);
  if (streakLengths.length > 0) {
    const avg = streakLengths.reduce((a, b) => a + b, 0) / streakLengths.length;
    console.log(`    Avg streak:     ${avg.toFixed(1)}`);
    const dist = new Map<number, number>();
    for (const s of streakLengths) dist.set(s, (dist.get(s) || 0) + 1);
    console.log(`    Distribution:   ${[...dist.entries()].sort((a,b) => a[0]-b[0]).map(([len, count]) => `${len}x: ${count}`).join(', ')}`);
  }

  console.log(`\n  Per-character bluff persistence:`);
  console.log(`    ${'Character'.padEnd(14)} ${'Unchallenged'.padStart(12)} ${'Re-bluffed'.padStart(11)} ${'Switched'.padStart(9)} ${'Went honest'.padStart(12)} ${'Persist %'.padStart(10)}`);
  console.log(`    ${'─'.repeat(14)} ${'─'.repeat(12)} ${'─'.repeat(11)} ${'─'.repeat(9)} ${'─'.repeat(12)} ${'─'.repeat(10)}`);
  for (const c of Object.values(Character)) {
    const stats = byChar.get(c)!;
    if (stats.unchallenged === 0) continue;
    const persistPct = stats.followedUp + stats.switched + stats.honest > 0
      ? (stats.followedUp / (stats.followedUp + stats.switched + stats.honest) * 100).toFixed(1)
      : 'N/A';
    console.log(`    ${c.padEnd(14)} ${String(stats.unchallenged).padStart(12)} ${String(stats.followedUp).padStart(11)} ${String(stats.switched).padStart(9)} ${String(stats.honest).padStart(12)} ${(persistPct + '%').padStart(10)}`);
  }
}

function isBotCaughtBluffing(botDecisions: DecisionRecord[], turnNumber: number): boolean {
  // If the bot lost influence on the same turn (from a challenge), the bluff was caught
  for (const d of botDecisions) {
    if (d.turnNumber === turnNumber && d.decision === 'choose_influence_loss') {
      return true;
    }
  }
  return false;
}

function analyzeEarlyMidGame(allDecisions: DecisionRecord[][], allWinnerIds: string[]): void {
  console.log('\n\n' + '═'.repeat(70));
  console.log('  BOT EARLY-GAME (turns 1-5) vs MID-GAME (turns 6-15) STRATEGY');
  console.log('═'.repeat(70));

  const phases = ['early', 'mid'] as const;
  const phaseRanges = { early: [1, 5], mid: [6, 15] };

  for (const phase of phases) {
    const [minTurn, maxTurn] = phaseRanges[phase];
    console.log(`\n  ── ${phase.toUpperCase()} GAME (turns ${minTurn}-${maxTurn}) ──`);

    // Filter decisions by turn number
    const allPhaseDecisions = allDecisions.map((gameDecs, gi) => {
      const winnerId = allWinnerIds[gi];
      return {
        all: gameDecs.filter(d => d.turnNumber >= minTurn && d.turnNumber <= maxTurn),
        winner: gameDecs.filter(d => d.turnNumber >= minTurn && d.turnNumber <= maxTurn && d.botId === winnerId),
      };
    });

    const allDecs = allPhaseDecisions.flatMap(p => p.all);
    const winnerDecs = allPhaseDecisions.flatMap(p => p.winner);

    // Action distribution (all bots)
    const actionDecs = allDecs.filter(d => d.decision === 'action' && d.action);
    const winnerActionDecs = winnerDecs.filter(d => d.decision === 'action' && d.action);

    console.log(`\n    Actions (all bots): ${actionDecs.length}  |  Winner actions: ${winnerActionDecs.length}`);

    const allActionCounts: Record<string, number> = {};
    const winnerActionCounts: Record<string, number> = {};
    for (const d of actionDecs) allActionCounts[d.action!] = (allActionCounts[d.action!] || 0) + 1;
    for (const d of winnerActionDecs) winnerActionCounts[d.action!] = (winnerActionCounts[d.action!] || 0) + 1;

    const order = [ActionType.Tax, ActionType.Steal, ActionType.Income, ActionType.Exchange,
                   ActionType.Assassinate, ActionType.Coup, ActionType.ForeignAid];

    console.log(`\n    ${'Action'.padEnd(16)} ${'All %'.padStart(8)} ${'Winner %'.padStart(10)} ${'Bluff %'.padStart(9)}`);
    console.log(`    ${'─'.repeat(16)} ${'─'.repeat(8)} ${'─'.repeat(10)} ${'─'.repeat(9)}`);
    for (const action of order) {
      const allCount = allActionCounts[action] || 0;
      const winCount = winnerActionCounts[action] || 0;
      const allPct = actionDecs.length > 0 ? (allCount / actionDecs.length * 100).toFixed(1) : '0.0';
      const winPct = winnerActionDecs.length > 0 ? (winCount / winnerActionDecs.length * 100).toFixed(1) : '0.0';

      // Bluff rate for this action in this phase
      const claimDecs = actionDecs.filter(d => d.action === action && d.isBluff !== undefined);
      const bluffs = claimDecs.filter(d => d.isBluff).length;
      const bluffPct = claimDecs.length > 0 ? (bluffs / claimDecs.length * 100).toFixed(1) : '--';

      console.log(`    ${action.padEnd(16)} ${allPct.padStart(8)} ${winPct.padStart(10)} ${bluffPct.padStart(9)}`);
    }

    // Challenge behavior
    const challenges = allDecs.filter(d => d.decision === 'challenge' || d.decision === 'challenge_block');
    const passes = allDecs.filter(d => d.decision === 'pass_challenge' || d.decision === 'pass_challenge_block');
    const challengeRate = challenges.length + passes.length > 0
      ? (challenges.length / (challenges.length + passes.length) * 100).toFixed(1) : '0.0';
    console.log(`\n    Challenge rate: ${challengeRate}% (${challenges.length} challenges out of ${challenges.length + passes.length} opportunities)`);

    // Block behavior
    const blocks = allDecs.filter(d => d.decision === 'block');
    const blockBluffs = blocks.filter(d => d.isBluff);
    const blockBluffPct = blocks.length > 0 ? (blockBluffs.length / blocks.length * 100).toFixed(1) : '0.0';
    console.log(`    Blocks: ${blocks.length} total, ${blockBluffs.length} bluffs (${blockBluffPct}%)`);

    // First action by winners (only for early game)
    if (phase === 'early') {
      console.log(`\n    Winner's FIRST action of the game:`);
      const firstActions: Record<string, number> = {};
      const firstBluffs: Record<string, number> = {};
      for (const pd of allPhaseDecisions) {
        const first = pd.winner.find(d => d.decision === 'action' && d.action);
        if (first) {
          firstActions[first.action!] = (firstActions[first.action!] || 0) + 1;
          if (first.isBluff) firstBluffs[first.action!] = (firstBluffs[first.action!] || 0) + 1;
        }
      }
      const totalFirst = Object.values(firstActions).reduce((a, b) => a + b, 0);
      for (const action of order) {
        const count = firstActions[action] || 0;
        if (count === 0) continue;
        const pct = (count / totalFirst * 100).toFixed(1);
        const bluffCount = firstBluffs[action] || 0;
        const bluffPctStr = count > 0 ? `${(bluffCount / count * 100).toFixed(0)}% bluff` : '';
        console.log(`      ${action.padEnd(14)} ${String(count).padStart(3)} (${pct.padStart(5)}%)  ${bluffPctStr}`);
      }
    }
  }
}


// ═══════════════════════════════════════════════════════════
//  PART 2: TREASON EARLY/MID GAME WINNER ANALYSIS
// ═══════════════════════════════════════════════════════════

const ROLES = ['none', 'duke', 'captain', 'assassin', 'ambassador', 'contessa'];

const TREASON_ACTION_MAP: Record<number, { action: string; targeted: boolean }> = {
  0x1: { action: 'tax', targeted: false },
  0x9: { action: 'foreign-aid', targeted: false },
  0x2: { action: 'steal', targeted: true },
  0x3: { action: 'assassinate', targeted: true },
  0x4: { action: 'exchange', targeted: false },
  0x5: { action: 'coup', targeted: true },
  0xD: { action: 'income', targeted: false },
};

interface TreasonPlayerState { cash: number; influence: string[]; }
interface TreasonStartOfTurn { type: 'start_of_turn'; whoseTurn: number; playerStates: TreasonPlayerState[]; }
interface TreasonAction { type: 'action'; action: string; player: number; target?: number; }
interface TreasonChallenge { type: 'challenge_success' | 'challenge_fail'; challenger: number; challenged: number; }
interface TreasonBlock { type: 'block'; blockingPlayer: number; blockingRole: string; }
interface TreasonGameOver { type: 'game_over'; playerStates: TreasonPlayerState[]; }
interface TreasonPlayerLeft { type: 'player_left'; player: number; }
type TreasonEvent = TreasonStartOfTurn | TreasonAction | TreasonChallenge | TreasonBlock | TreasonGameOver | TreasonPlayerLeft;

function decodeInfluence(nibble: number): string {
  const revealed = (nibble & 0x8) !== 0;
  const roleCode = nibble & 0x7;
  const role = ROLES[roleCode] || 'none';
  if (role === 'none') return '';
  return revealed ? `!${role}` : role;
}

function unpackEvents(base64: string, playerCount: number): TreasonEvent[] {
  const buf = Buffer.from(base64, 'base64');
  const events: TreasonEvent[] = [];
  let i = 0, lastTurnPlayer = 0, expectAction = false;

  while (i < buf.length) {
    if (expectAction) {
      const byte = buf[i++];
      const actionCode = (byte >> 4) & 0xF;
      const target = byte & 0xF;
      const actionDef = TREASON_ACTION_MAP[actionCode];
      if (actionDef) {
        const evt: TreasonAction = { type: 'action', action: actionDef.action, player: lastTurnPlayer };
        if (actionDef.targeted && target > 0) evt.target = target;
        events.push(evt);
      }
      expectAction = false;
      continue;
    }
    const byte = buf[i++];
    const eventType = (byte >> 4) & 0xF;
    const lowNibble = byte & 0xF;

    switch (eventType) {
      case 1: {
        lastTurnPlayer = lowNibble;
        const playerStates: TreasonPlayerState[] = [];
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++]; const infByte = buf[i++];
          const inf0 = decodeInfluence((infByte >> 4) & 0xF);
          const inf1 = decodeInfluence(infByte & 0xF);
          playerStates.push({ cash, influence: [inf0, inf1].filter(x => x !== '') });
        }
        events.push({ type: 'start_of_turn', whoseTurn: lowNibble, playerStates });
        expectAction = true;
        break;
      }
      case 7: {
        const playerStates: TreasonPlayerState[] = [];
        for (let p = 0; p < playerCount && i + 1 < buf.length; p++) {
          const cash = buf[i++]; const infByte = buf[i++];
          const inf0 = decodeInfluence((infByte >> 4) & 0xF);
          const inf1 = decodeInfluence(infByte & 0xF);
          playerStates.push({ cash, influence: [inf0, inf1].filter(x => x !== '') });
        }
        events.push({ type: 'game_over', playerStates });
        break;
      }
      case 3: case 4: {
        const nextByte = buf[i++];
        events.push({
          type: eventType === 3 ? 'challenge_success' : 'challenge_fail',
          challenger: lowNibble, challenged: nextByte & 0xF,
        });
        break;
      }
      case 5: {
        const roleByte = buf[i++];
        events.push({ type: 'block', blockingPlayer: lowNibble, blockingRole: ROLES[roleByte] || 'unknown' });
        break;
      }
      case 6: events.push({ type: 'player_left', player: lowNibble }); break;
    }
  }
  return events;
}

interface TreasonGame {
  players: number; humanPlayers: number;
  playerRank: string[]; playerDisconnect: number[];
  gameType: string; events: string;
}

const T_ACTION_TO_ROLE: Record<string, string> = {
  'tax': 'duke', 'steal': 'captain', 'assassinate': 'assassin', 'exchange': 'ambassador',
};

interface PhaseStats {
  totalGames: number;
  // Action distribution
  actions: Record<string, number>;
  totalActions: number;
  // Bluffs
  bluffActions: Record<string, { total: number; bluffs: number }>;
  // Challenges
  challengesIssued: number;
  challengesSucceeded: number;
  // Blocks
  blocksIssued: number;
  bluffBlocks: Record<string, { total: number; bluffs: number }>;
  // First action (early only)
  firstActions: Record<string, number>;
  firstBluffs: Record<string, number>;
  // Bluff persistence
  unchallengedBluffs: number;
  followedUpSame: number;
  switchedChar: number;
  wentHonest: number;
}

function newPhaseStats(): PhaseStats {
  return {
    totalGames: 0, actions: {}, totalActions: 0,
    bluffActions: {}, challengesIssued: 0, challengesSucceeded: 0,
    blocksIssued: 0, bluffBlocks: {},
    firstActions: {}, firstBluffs: {},
    unchallengedBluffs: 0, followedUpSame: 0, switchedChar: 0, wentHonest: 0,
  };
}

function analyzeTreasonGame(game: TreasonGame, early: PhaseStats, mid: PhaseStats): void {
  const events = unpackEvents(game.events, game.players);
  if (events.length === 0) return;

  // Find winner
  const gameOver = events.find(e => e.type === 'game_over') as TreasonGameOver | undefined;
  if (!gameOver) return;
  let winnerIndex = -1;
  for (let p = 0; p < gameOver.playerStates.length; p++) {
    if (gameOver.playerStates[p].influence.some(inf => !inf.startsWith('!'))) {
      winnerIndex = p; break;
    }
  }
  if (winnerIndex === -1) return;

  early.totalGames++;
  mid.totalGames++;

  let turnCount = 0;
  let lastStartEvent: TreasonStartOfTurn | null = null;
  let lastAction: TreasonAction | null = null;
  let winnerFirstActionDone = false;

  // Bluff persistence tracking for winner
  let lastWinnerBluffRole: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const evt = events[i];

    if (evt.type === 'start_of_turn') {
      turnCount++;
      lastStartEvent = evt;
      lastAction = null;
      continue;
    }

    // Determine phase
    let phase: PhaseStats | null = null;
    if (turnCount >= 1 && turnCount <= 5) phase = early;
    else if (turnCount >= 6 && turnCount <= 15) phase = mid;
    else continue; // skip late game

    if (evt.type === 'action') {
      lastAction = evt;

      // Winner's action?
      if (evt.player === winnerIndex) {
        phase.actions[evt.action] = (phase.actions[evt.action] || 0) + 1;
        phase.totalActions++;

        // First action tracking
        if (!winnerFirstActionDone && turnCount <= 5) {
          early.firstActions[evt.action] = (early.firstActions[evt.action] || 0) + 1;
          winnerFirstActionDone = true;
        }

        // Bluff check
        if (lastStartEvent && evt.player < lastStartEvent.playerStates.length) {
          const ps = lastStartEvent.playerStates[evt.player];
          const requiredRole = T_ACTION_TO_ROLE[evt.action];
          if (requiredRole) {
            if (!phase.bluffActions[evt.action]) phase.bluffActions[evt.action] = { total: 0, bluffs: 0 };
            phase.bluffActions[evt.action].total++;
            const hasRole = ps.influence.some(inf => inf === requiredRole);
            const isBluff = !hasRole;
            if (isBluff) {
              phase.bluffActions[evt.action].bluffs++;

              // First action bluff tracking
              if (winnerFirstActionDone && turnCount <= 5 && Object.values(early.firstActions).reduce((a,b) => a+b, 0) === 1) {
                early.firstBluffs[evt.action] = (early.firstBluffs[evt.action] || 0) + 1;
              }
            }

            // Bluff persistence tracking
            if (isBluff) {
              // Check if caught (look for challenge_success targeting winner in next few events)
              let caught = false;
              for (let j = i + 1; j < events.length && j < i + 5; j++) {
                if (events[j].type === 'challenge_success' && (events[j] as TreasonChallenge).challenged === winnerIndex) {
                  caught = true; break;
                }
                if (events[j].type === 'start_of_turn' || events[j].type === 'game_over') break;
              }
              if (!caught) {
                phase.unchallengedBluffs++;
                if (lastWinnerBluffRole === requiredRole) phase.followedUpSame++;
                else if (lastWinnerBluffRole && lastWinnerBluffRole !== requiredRole) phase.switchedChar++;
                lastWinnerBluffRole = requiredRole;
              } else {
                lastWinnerBluffRole = null;
              }
            } else {
              // Honest claim
              if (lastWinnerBluffRole) {
                phase.wentHonest++;
                lastWinnerBluffRole = null;
              }
            }
          }
        }
      }
    }

    if (evt.type === 'challenge_success' || evt.type === 'challenge_fail') {
      if (evt.challenger === winnerIndex) {
        phase.challengesIssued++;
        if (evt.type === 'challenge_success') phase.challengesSucceeded++;
      }
    }

    if (evt.type === 'block') {
      let blockerIndex: number | null = null;
      if (lastAction && lastAction.target !== undefined) blockerIndex = lastAction.target;
      if (blockerIndex === null && lastAction?.action === 'foreign-aid') {
        for (let j = i + 1; j < events.length && j < i + 4; j++) {
          const next = events[j];
          if (next.type === 'challenge_success' || next.type === 'challenge_fail') {
            blockerIndex = (next as TreasonChallenge).challenged; break;
          }
          if (next.type === 'start_of_turn' || next.type === 'game_over') break;
        }
      }
      if (blockerIndex === winnerIndex) {
        phase.blocksIssued++;
        if (lastStartEvent && blockerIndex < lastStartEvent.playerStates.length) {
          const bs = lastStartEvent.playerStates[blockerIndex];
          const role = evt.blockingRole;
          if (!phase.bluffBlocks[role]) phase.bluffBlocks[role] = { total: 0, bluffs: 0 };
          phase.bluffBlocks[role].total++;
          if (!bs.influence.some(inf => inf === role)) phase.bluffBlocks[role].bluffs++;
        }
      }
    }
  }
}

function printTreasonPhase(label: string, stats: PhaseStats): void {
  console.log(`\n  ── ${label} ── (${stats.totalGames.toLocaleString()} games)\n`);

  const actionOrder = ['tax', 'steal', 'income', 'exchange', 'assassinate', 'coup', 'foreign-aid'];

  console.log(`    Winner actions: ${stats.totalActions.toLocaleString()}`);
  console.log(`\n    ${'Action'.padEnd(16)} ${'Share %'.padStart(9)} ${'Avg/game'.padStart(9)} ${'Bluff %'.padStart(9)}`);
  console.log(`    ${'─'.repeat(16)} ${'─'.repeat(9)} ${'─'.repeat(9)} ${'─'.repeat(9)}`);
  for (const action of actionOrder) {
    const count = stats.actions[action] || 0;
    const share = stats.totalActions > 0 ? (count / stats.totalActions * 100).toFixed(1) : '0.0';
    const avg = (count / stats.totalGames).toFixed(2);
    const br = stats.bluffActions[action];
    const bluffPct = br && br.total > 0 ? (br.bluffs / br.total * 100).toFixed(1) : '--';
    console.log(`    ${action.padEnd(16)} ${share.padStart(9)} ${avg.padStart(9)} ${bluffPct.padStart(9)}`);
  }

  // Challenges
  const challengeSuccessRate = stats.challengesIssued > 0
    ? (stats.challengesSucceeded / stats.challengesIssued * 100).toFixed(1) : 'N/A';
  console.log(`\n    Winner challenges: ${stats.challengesIssued} issued, ${stats.challengesSucceeded} succeeded (${challengeSuccessRate}%)`);

  // Blocks
  console.log(`    Winner blocks: ${stats.blocksIssued}`);
  for (const role of ['duke', 'captain', 'ambassador', 'contessa']) {
    const br = stats.bluffBlocks[role];
    if (!br || br.total === 0) continue;
    const bluffPct = (br.bluffs / br.total * 100).toFixed(1);
    console.log(`      ${role.padEnd(12)} ${br.total} total, ${br.bluffs} bluffs (${bluffPct}%)`);
  }

  // Bluff persistence
  const persistTotal = stats.followedUpSame + stats.switchedChar + stats.wentHonest;
  if (persistTotal > 0) {
    console.log(`\n    Bluff persistence (after unchallenged bluff, ${stats.unchallengedBluffs} total):`);
    console.log(`      Re-bluffed same char: ${stats.followedUpSame} (${(stats.followedUpSame/persistTotal*100).toFixed(1)}%)`);
    console.log(`      Switched character:   ${stats.switchedChar} (${(stats.switchedChar/persistTotal*100).toFixed(1)}%)`);
    console.log(`      Went honest:          ${stats.wentHonest} (${(stats.wentHonest/persistTotal*100).toFixed(1)}%)`);
  }

  // First action (early only)
  if (Object.keys(stats.firstActions).length > 0) {
    console.log(`\n    Winner's FIRST action of the game:`);
    const totalFirst = Object.values(stats.firstActions).reduce((a, b) => a + b, 0);
    for (const action of actionOrder) {
      const count = stats.firstActions[action] || 0;
      if (count === 0) continue;
      const pct = (count / totalFirst * 100).toFixed(1);
      const bluffCount = stats.firstBluffs[action] || 0;
      const bluffPctStr = count > 0 ? `${(bluffCount / count * 100).toFixed(0)}% bluff` : '';
      console.log(`      ${action.padEnd(14)} ${String(count).padStart(6)} (${pct.padStart(5)}%)  ${bluffPctStr}`);
    }
  }
}


// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  const treasonPath = process.argv[2] || path.join(process.env.HOME || '', 'Documents', 'games.json');

  // ─── Part 1: Bot Simulation ───
  console.log('Running 50 bot simulations (5 optimal-personality bots each)...\n');

  const allDecisions: DecisionRecord[][] = [];
  const allWinnerIds: string[] = [];

  for (let i = 0; i < 50; i++) {
    const { decisions, winnerId } = runGame(5, BOT_PERSONALITIES.optimal);
    allDecisions.push(decisions);
    allWinnerIds.push(winnerId);
    process.stdout.write(`  Game ${String(i + 1).padStart(2)}/50\r`);
  }
  console.log('  50/50 games complete.\n');

  analyzeBluffPersistence(allDecisions);
  analyzeEarlyMidGame(allDecisions, allWinnerIds);

  // ─── Part 2: Treason Analysis ───
  if (!fs.existsSync(treasonPath)) {
    console.log(`\n\nSkipping treason analysis — file not found: ${treasonPath}`);
    return;
  }

  console.log(`\n\nLoading treason database: ${treasonPath}`);
  const content = fs.readFileSync(treasonPath, 'utf-8');
  const games: TreasonGame[] = JSON.parse(content);

  // Filter: original, no disconnects, 5 players, all-human
  const filtered = games.filter(g =>
    g != null && g.gameType === 'original' &&
    g.playerDisconnect.length === 0 &&
    g.players === 5 && g.humanPlayers >= 4 &&
    g.events && g.events.length > 0
  );
  console.log(`Filtered to ${filtered.length.toLocaleString()} 5-player original games (4+ humans, no disconnects)\n`);

  const earlyStats = newPhaseStats();
  const midStats = newPhaseStats();

  let processed = 0;
  const reportInterval = Math.max(1, Math.floor(filtered.length / 20));
  for (const game of filtered) {
    try { analyzeTreasonGame(game, earlyStats, midStats); } catch {}
    processed++;
    if (processed % reportInterval === 0) {
      process.stdout.write(`  ${((processed / filtered.length) * 100).toFixed(0)}%\r`);
    }
  }
  console.log('  100%\n');

  console.log('\n' + '═'.repeat(70));
  console.log('  TREASON WINNERS — EARLY & MID GAME STRATEGY');
  console.log('═'.repeat(70));

  printTreasonPhase('EARLY GAME (turns 1-5) — Treason Winners', earlyStats);
  printTreasonPhase('MID GAME (turns 6-15) — Treason Winners', midStats);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
