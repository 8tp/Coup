/**
 * Headless bot simulation — runs N bot-only Coup games synchronously.
 *
 * Captures every bot decision along with the bot's hand at decision time,
 * saves enriched JSON logs, and prints a deep behavioral analysis.
 *
 * Usage:
 *   npm run simulate -- --games 50 --players 5 --personality optimal
 */

import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../src/engine/GameEngine';
import { BotBrain, BotDecision } from '../src/engine/BotBrain';
import { GameLogger } from '../src/server/GameLogger';
import { JsonFileStorage } from '../src/server/storage/JsonFileStorage';
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

// ─── CLI Args ───

function parseArgs(): { games: number; players: number; personality: PersonalityParams; save: boolean } {
  const args = process.argv.slice(2);
  let games = 20;
  let players = 5;
  let personalityName: string = 'optimal';
  let save = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--games': games = parseInt(args[++i], 10); break;
      case '--players': players = parseInt(args[++i], 10); break;
      case '--personality': personalityName = args[++i]; break;
      case '--no-save': save = false; break;
    }
  }

  const personalityParams = BOT_PERSONALITIES[personalityName as Exclude<BotPersonality, 'random'>];
  if (!personalityParams) {
    const valid = Object.keys(BOT_PERSONALITIES).join(', ');
    console.error(`Unknown personality "${personalityName}". Valid options: ${valid}`);
    process.exit(1);
  }

  return { games, players, personality: personalityParams, save };
}

// ─── Bot State ───

interface SimBot {
  id: string;
  name: string;
  personality: PersonalityParams;
  deckMemory: Map<Character, number>;
  lastProcessedLogLength: number;
}

// ─── Capture a decision record with full context ───

function captureDecision(
  engine: GameEngine,
  bot: SimBot,
  decision: BotDecision,
  bots: SimBot[],
): DecisionRecord {
  const player = engine.game.getPlayer(bot.id)!;
  const hand = [...player.hiddenCharacters];
  const state = engine.getFullState();

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
      // Determine if this is a bluff
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

// ─── Execute a BotBrain decision on the engine ───

function executeDecision(engine: GameEngine, bot: SimBot, decision: BotDecision): void {
  switch (decision.type) {
    case 'action':
      engine.handleAction(bot.id, decision.action, decision.targetId);
      break;
    case 'challenge':
      engine.handleChallenge(bot.id);
      break;
    case 'pass_challenge':
      engine.handlePassChallenge(bot.id);
      break;
    case 'block':
      engine.handleBlock(bot.id, decision.character);
      break;
    case 'pass_block':
      engine.handlePassBlock(bot.id);
      break;
    case 'challenge_block':
      engine.handleChallengeBlock(bot.id);
      break;
    case 'pass_challenge_block':
      engine.handlePassChallengeBlock(bot.id);
      break;
    case 'choose_influence_loss':
      engine.handleChooseInfluenceLoss(bot.id, decision.influenceIndex);
      break;
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

// ─── Invalidate deck memory ───

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
        bot.deckMemory.clear();
        break;
      }
      if (entry.eventType === 'challenge_fail' || entry.eventType === 'block_challenge_fail') {
        bot.deckMemory.clear();
        break;
      }
    }
    bot.lastProcessedLogLength = logLength;
  }
}

// ─── Run a single game ───

function runGame(playerCount: number, personality: PersonalityParams): {
  engine: GameEngine;
  roomPlayers: RoomPlayer[];
  bots: SimBot[];
  decisions: DecisionRecord[];
} {
  const roomCode = 'SIM';
  const engine = new GameEngine(roomCode);
  const decisions: DecisionRecord[] = [];

  const bots: SimBot[] = [];
  const playerInfos: Array<{ id: string; name: string }> = [];
  const roomPlayers: RoomPlayer[] = [];

  for (let i = 0; i < playerCount; i++) {
    const id = uuidv4();
    const name = BOT_NAMES[i % BOT_NAMES.length];
    bots.push({
      id, name, personality,
      deckMemory: new Map(), lastProcessedLogLength: 0,
    });
    playerInfos.push({ id, name });
    roomPlayers.push({
      id, name, socketId: '', connected: false, isBot: true, personality: personality.name,
    });
  }

  engine.startGame(playerInfos);

  const MAX_ITERATIONS = 2000;
  let iterations = 0;

  while (engine.game.status === GameStatus.InProgress && iterations < MAX_ITERATIONS) {
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
        // Capture BEFORE executing (so hand reflects pre-decision state)
        decisions.push(captureDecision(engine, bot, decision, bots));
        executeDecision(engine, bot, decision);
        acted = true;
        break;
      }
    }

    if (!acted) {
      const phase = engine.game.turnPhase;
      if (
        phase === TurnPhase.AwaitingActionChallenge ||
        phase === TurnPhase.AwaitingBlock ||
        phase === TurnPhase.AwaitingBlockChallenge
      ) {
        engine.handleTimerExpiry();
      } else {
        console.error(`Game stuck at phase ${phase}, turn ${engine.game.turnNumber}`);
        break;
      }
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    console.error(`Game hit iteration limit at turn ${engine.game.turnNumber}`);
  }

  return { engine, roomPlayers, bots, decisions };
}

// ═══════════════════════════════════════════════════════════
//  ANALYSIS
// ═══════════════════════════════════════════════════════════

interface BluffRecord {
  action: string;
  claimedChar: Character;
  total: number;
  bluffs: number;
  caughtBluffs: number;
  uncaughtBluffs: number;
}

function analyzeAllGames(allDecisions: DecisionRecord[][], allLogs: GameLog[]): void {
  console.log('\n' + '═'.repeat(70));
  console.log('  DEEP BEHAVIORAL ANALYSIS');
  console.log('═'.repeat(70));

  const flatDecisions = allDecisions.flat();

  // ─── 1. Action Claims: Honest vs Bluff ───
  analyzeActionBluffs(flatDecisions, allLogs);

  // ─── 2. Block Claims: Honest vs Bluff ───
  analyzeBlockBluffs(flatDecisions, allLogs);

  // ─── 3. Challenge Behavior ───
  analyzeChallenges(flatDecisions, allLogs);

  // ─── 4. Influence Loss: What Cards Do Bots Sacrifice? ───
  analyzeInfluenceLoss(flatDecisions);

  // ─── 5. Exchange Behavior: What Cards Do Bots Keep/Return? ───
  analyzeExchanges(flatDecisions);

  // ─── 6. Card Holding at Win ───
  analyzeWinnerCards(allLogs);

  // ─── 7. Targeting Patterns ───
  analyzeTargeting(flatDecisions);
}

function analyzeActionBluffs(decisions: DecisionRecord[], logs: GameLog[]): void {
  console.log('\n  ── Action Claims: Honest vs Bluff ──\n');

  // Group action decisions by action type (only character-claiming actions)
  const actionDecisions = decisions.filter(d => d.decision === 'action' && d.action && d.isBluff !== undefined);

  const byAction = new Map<string, { total: number; bluffs: number; hands: Map<string, number> }>();

  for (const d of actionDecisions) {
    const key = d.action!;
    if (!byAction.has(key)) byAction.set(key, { total: 0, bluffs: 0, hands: new Map() });
    const rec = byAction.get(key)!;
    rec.total++;
    if (d.isBluff) rec.bluffs++;
    // Track what cards the bot actually held when claiming
    const handKey = d.hand.sort().join('+');
    rec.hands.set(handKey, (rec.hands.get(handKey) || 0) + 1);
  }

  const claimActions = [ActionType.Tax, ActionType.Steal, ActionType.Assassinate, ActionType.Exchange];
  const charNames: Record<string, string> = {
    [ActionType.Tax]: 'Duke', [ActionType.Steal]: 'Captain',
    [ActionType.Assassinate]: 'Assassin', [ActionType.Exchange]: 'Ambassador',
  };

  for (const action of claimActions) {
    const rec = byAction.get(action);
    if (!rec) continue;
    const bluffPct = ((rec.bluffs / rec.total) * 100).toFixed(1);
    const honestPct = (((rec.total - rec.bluffs) / rec.total) * 100).toFixed(1);
    console.log(`    ${action.padEnd(14)} claims ${charNames[action]}`);
    console.log(`      Total: ${rec.total}  |  Honest: ${rec.total - rec.bluffs} (${honestPct}%)  |  Bluff: ${rec.bluffs} (${bluffPct}%)`);

    // Show top 3 hands when bluffing this action
    if (rec.bluffs > 0) {
      const bluffHands = new Map<string, number>();
      for (const d of actionDecisions.filter(d => d.action === action && d.isBluff)) {
        const handKey = d.hand.sort().join(' + ');
        bluffHands.set(handKey, (bluffHands.get(handKey) || 0) + 1);
      }
      const topHands = [...bluffHands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
      console.log(`      Top bluff hands: ${topHands.map(([h, c]) => `[${h}] x${c}`).join(', ')}`);
    }
    console.log();
  }

  // Non-claim actions
  const nonClaimActions = decisions.filter(d => d.decision === 'action' && (d.action === ActionType.Income || d.action === ActionType.ForeignAid || d.action === ActionType.Coup));
  const nonClaimByAction = new Map<string, { total: number; topHands: Map<string, number> }>();
  for (const d of nonClaimActions) {
    const key = d.action!;
    if (!nonClaimByAction.has(key)) nonClaimByAction.set(key, { total: 0, topHands: new Map() });
    const rec = nonClaimByAction.get(key)!;
    rec.total++;
    const handKey = d.hand.sort().join(' + ');
    rec.topHands.set(handKey, (rec.topHands.get(handKey) || 0) + 1);
  }

  for (const action of [ActionType.Income, ActionType.ForeignAid, ActionType.Coup]) {
    const rec = nonClaimByAction.get(action);
    if (!rec) continue;
    const topHands = [...rec.topHands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    console.log(`    ${action.padEnd(14)} (no claim needed)`);
    console.log(`      Total: ${rec.total}  |  Top hands: ${topHands.map(([h, c]) => `[${h}] x${c}`).join(', ')}`);
    console.log();
  }
}

function analyzeBlockBluffs(decisions: DecisionRecord[], logs: GameLog[]): void {
  console.log('\n  ── Block Claims: Honest vs Bluff ──\n');

  const blockDecisions = decisions.filter(d => d.decision === 'block' && d.blockCharacter);

  const byChar = new Map<string, { total: number; bluffs: number }>();
  for (const d of blockDecisions) {
    const key = d.blockCharacter!;
    if (!byChar.has(key)) byChar.set(key, { total: 0, bluffs: 0 });
    const rec = byChar.get(key)!;
    rec.total++;
    if (d.isBluff) rec.bluffs++;
  }

  for (const char of Object.values(Character)) {
    const rec = byChar.get(char);
    if (!rec) continue;
    const bluffPct = ((rec.bluffs / rec.total) * 100).toFixed(1);
    console.log(`    Block with ${char.padEnd(12)}  Total: ${String(rec.total).padStart(3)}  |  Honest: ${String(rec.total - rec.bluffs).padStart(3)}  |  Bluff: ${String(rec.bluffs).padStart(3)} (${bluffPct}%)`);
  }

  // Contessa vs Assassination breakdown
  const contessaBlocks = blockDecisions.filter(d => d.blockCharacter === Character.Contessa);
  if (contessaBlocks.length > 0) {
    const honest = contessaBlocks.filter(d => !d.isBluff).length;
    const bluff = contessaBlocks.filter(d => d.isBluff).length;
    console.log(`\n    Contessa vs Assassination detail:`);
    console.log(`      Honest Contessa blocks: ${honest}`);
    console.log(`      Bluff Contessa blocks:  ${bluff}`);
    if (bluff > 0) {
      const bluffHands = new Map<string, number>();
      for (const d of contessaBlocks.filter(d => d.isBluff)) {
        const handKey = d.hand.sort().join(' + ');
        bluffHands.set(handKey, (bluffHands.get(handKey) || 0) + 1);
      }
      const topHands = [...bluffHands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
      console.log(`      Hands when bluffing Contessa: ${topHands.map(([h, c]) => `[${h}] x${c}`).join(', ')}`);
    }
  }
}

function analyzeChallenges(decisions: DecisionRecord[], logs: GameLog[]): void {
  console.log('\n\n  ── Challenge Behavior ──\n');

  const challengeDecisions = decisions.filter(d => d.decision === 'challenge' || d.decision === 'challenge_block');
  const passDecisions = decisions.filter(d => d.decision === 'pass_challenge' || d.decision === 'pass_challenge_block');

  console.log(`    Total challenge opportunities: ${challengeDecisions.length + passDecisions.length}`);
  console.log(`    Challenges issued:  ${challengeDecisions.length}`);
  console.log(`    Challenges passed:  ${passDecisions.length}`);
  const challengeRate = challengeDecisions.length + passDecisions.length > 0
    ? ((challengeDecisions.length / (challengeDecisions.length + passDecisions.length)) * 100).toFixed(1)
    : '0.0';
  console.log(`    Challenge rate: ${challengeRate}%`);

  // Hands when challenging
  console.log(`\n    Cards held when issuing challenges:`);
  const challengeHands = new Map<string, number>();
  for (const d of challengeDecisions) {
    const handKey = d.hand.sort().join(' + ');
    challengeHands.set(handKey, (challengeHands.get(handKey) || 0) + 1);
  }
  const topChallengeHands = [...challengeHands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  for (const [hand, count] of topChallengeHands) {
    console.log(`      [${hand}] x${count}`);
  }

  // Challenge by influence count
  const by1Inf = challengeDecisions.filter(d => d.hand.length === 1).length;
  const by2Inf = challengeDecisions.filter(d => d.hand.length === 2).length;
  console.log(`\n    Challenges with 1 influence: ${by1Inf}  |  with 2 influences: ${by2Inf}`);
}

function analyzeInfluenceLoss(decisions: DecisionRecord[]): void {
  console.log('\n\n  ── Influence Loss Choices ──\n');

  const lossDecisions = decisions.filter(d => d.decision === 'choose_influence_loss' && d.lostCharacter);

  // What cards are sacrificed
  const sacrificed = new Map<string, number>();
  for (const d of lossDecisions) {
    sacrificed.set(d.lostCharacter!, (sacrificed.get(d.lostCharacter!) || 0) + 1);
  }

  console.log('    Cards sacrificed (most to least):');
  const sorted = [...sacrificed.entries()].sort((a, b) => b[1] - a[1]);
  for (const [char, count] of sorted) {
    const pct = ((count / lossDecisions.length) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / lossDecisions.length * 20));
    console.log(`      ${char.padEnd(12)} ${String(count).padStart(3)} (${pct.padStart(5)}%) ${bar}`);
  }

  // What card was KEPT when sacrificing
  console.log('\n    When forced to lose influence, card kept vs sacrificed:');
  const keptVsSacrificed = new Map<string, number>();
  const twoCardLoss = lossDecisions.filter(d => d.hand.length === 2);
  for (const d of twoCardLoss) {
    const kept = d.hand.find(c => c !== d.lostCharacter) || d.hand[0];
    const key = `kept ${kept}, lost ${d.lostCharacter}`;
    keptVsSacrificed.set(key, (keptVsSacrificed.get(key) || 0) + 1);
  }
  const sortedKept = [...keptVsSacrificed.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  for (const [desc, count] of sortedKept) {
    console.log(`      ${desc.padEnd(35)} x${count}`);
  }
}

function analyzeExchanges(decisions: DecisionRecord[]): void {
  console.log('\n\n  ── Exchange Behavior ──\n');

  const exchangeDecisions = decisions.filter(d => d.decision === 'choose_exchange' && d.exchangeKept);
  console.log(`    Total exchanges: ${exchangeDecisions.length}`);

  if (exchangeDecisions.length === 0) return;

  // What cards are kept vs returned
  const keptCounts = new Map<string, number>();
  const returnedCounts = new Map<string, number>();
  let changedHand = 0;

  for (const d of exchangeDecisions) {
    for (const c of d.exchangeKept!) keptCounts.set(c, (keptCounts.get(c) || 0) + 1);
    for (const c of d.exchangeReturned!) returnedCounts.set(c, (returnedCounts.get(c) || 0) + 1);
    // Did the hand change?
    const before = d.hand.sort().join(',');
    const after = d.exchangeKept!.sort().join(',');
    if (before !== after) changedHand++;
  }

  const changePct = ((changedHand / exchangeDecisions.length) * 100).toFixed(1);
  console.log(`    Hand changed after exchange: ${changedHand}/${exchangeDecisions.length} (${changePct}%)`);

  console.log('\n    Cards KEPT (preference):');
  const sortedKept = [...keptCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [char, count] of sortedKept) {
    console.log(`      ${char.padEnd(12)} ${count}`);
  }

  console.log('\n    Cards RETURNED (discarded):');
  const sortedReturned = [...returnedCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [char, count] of sortedReturned) {
    console.log(`      ${char.padEnd(12)} ${count}`);
  }
}

function analyzeWinnerCards(logs: GameLog[]): void {
  console.log('\n\n  ── Winner Card Holdings ──\n');

  const winnerCards = new Map<string, number>();
  for (const log of logs) {
    const winner = log.players.find(p => p.id === log.winnerId);
    if (!winner) continue;
    const allCards = [...winner.hiddenCharacters, ...winner.revealedCharacters];
    for (const c of winner.hiddenCharacters) {
      winnerCards.set(c, (winnerCards.get(c) || 0) + 1);
    }
  }

  console.log('    Cards winners were holding (unrevealed) at game end:');
  const sorted = [...winnerCards.entries()].sort((a, b) => b[1] - a[1]);
  for (const [char, count] of sorted) {
    const bar = '█'.repeat(Math.round(count / logs.length * 20));
    console.log(`      ${char.padEnd(12)} ${String(count).padStart(3)} ${bar}`);
  }

  // Starting cards of winners vs losers (from first decision)
  console.log('\n    Cards dealt to winners (from their first decision):');
  const winnerStartCards = new Map<string, number>();
  const loserStartCards = new Map<string, number>();
  for (const log of logs) {
    if (!log.decisions || log.decisions.length === 0) continue;
    const seen = new Set<string>();
    for (const d of log.decisions) {
      if (seen.has(d.botId)) continue;
      seen.add(d.botId);
      const isWinner = d.botId === log.winnerId;
      const target = isWinner ? winnerStartCards : loserStartCards;
      for (const c of d.hand) {
        target.set(c, (target.get(c) || 0) + 1);
      }
    }
  }

  const sortedWS = [...winnerStartCards.entries()].sort((a, b) => b[1] - a[1]);
  for (const [char, count] of sortedWS) {
    console.log(`      ${char.padEnd(12)} ${count}`);
  }
  console.log('    Cards dealt to losers:');
  const sortedLS = [...loserStartCards.entries()].sort((a, b) => b[1] - a[1]);
  for (const [char, count] of sortedLS) {
    console.log(`      ${char.padEnd(12)} ${count}`);
  }
}

function analyzeTargeting(decisions: DecisionRecord[]): void {
  console.log('\n\n  ── Targeting Patterns ──\n');

  const targetedActions = decisions.filter(d => d.decision === 'action' && d.targetName);

  // Who targets whom
  const targetCounts = new Map<string, Map<string, number>>();
  for (const d of targetedActions) {
    if (!targetCounts.has(d.botName)) targetCounts.set(d.botName, new Map());
    const targets = targetCounts.get(d.botName)!;
    targets.set(d.targetName!, (targets.get(d.targetName!) || 0) + 1);
  }

  // By action type
  const targetByAction = new Map<string, Map<string, number>>();
  for (const d of targetedActions) {
    const key = d.action!;
    if (!targetByAction.has(key)) targetByAction.set(key, new Map());
    const targets = targetByAction.get(key)!;
    targets.set(d.targetName!, (targets.get(d.targetName!) || 0) + 1);
  }

  console.log('    Targeted actions by type:');
  for (const [action, targets] of [...targetByAction.entries()].sort()) {
    const sorted = [...targets.entries()].sort((a, b) => b[1] - a[1]);
    console.log(`      ${action}: ${sorted.map(([name, c]) => `${name} x${c}`).join(', ')}`);
  }

  // Who gets targeted most overall
  const overallTargeted = new Map<string, number>();
  for (const d of targetedActions) {
    overallTargeted.set(d.targetName!, (overallTargeted.get(d.targetName!) || 0) + 1);
  }
  console.log('\n    Most targeted players (across all games):');
  const sortedTargeted = [...overallTargeted.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, count] of sortedTargeted) {
    console.log(`      ${name.padEnd(12)} ${count} times`);
  }
}

// ═══════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════

async function main() {
  const { games, players, personality, save } = parseArgs();
  const storage = save ? new JsonFileStorage() : null;

  console.log(`\nRunning ${games} games with ${players} ${personality.name} bots...\n`);

  const winCounts = new Map<string, number>();
  const gameLengths: number[] = [];
  const allActionCounts: Record<string, number[]> = {};
  let totalChallenges = 0;
  let totalSuccessfulChallenges = 0;
  let totalBlocks = 0;
  let totalEliminations = 0;
  let totalGamesCompleted = 0;

  const allDecisions: DecisionRecord[][] = [];
  const allLogs: GameLog[] = [];

  for (let i = 0; i < games; i++) {
    const { engine, roomPlayers, decisions } = runGame(players, personality);

    if (engine.game.status !== GameStatus.Finished) {
      console.log(`  Game ${i + 1}: DID NOT FINISH (stuck at turn ${engine.game.turnNumber})`);
      continue;
    }

    totalGamesCompleted++;
    const log = GameLogger.buildGameLog(engine, roomPlayers, 'simulation');
    log.decisions = decisions;
    allDecisions.push(decisions);
    allLogs.push(log);

    if (storage) {
      await storage.saveGameLog(log);
    }

    const winnerName = log.winnerName;
    winCounts.set(winnerName, (winCounts.get(winnerName) || 0) + 1);
    gameLengths.push(log.stats.totalTurns);

    for (const [action, count] of Object.entries(log.stats.actionCounts)) {
      if (!allActionCounts[action]) allActionCounts[action] = [];
      allActionCounts[action].push(count);
    }

    totalChallenges += log.stats.totalChallenges;
    totalSuccessfulChallenges += log.stats.successfulChallenges;
    totalBlocks += log.stats.totalBlocks;
    totalEliminations += log.stats.totalEliminations;

    const eliminated = log.players
      .filter(p => !p.isAlive)
      .sort((a, b) => (a.eliminationOrder ?? 99) - (b.eliminationOrder ?? 99))
      .map(p => p.name);
    console.log(
      `  Game ${String(i + 1).padStart(2)}: ` +
      `Winner: ${winnerName.padEnd(12)} ` +
      `Turns: ${String(log.stats.totalTurns).padStart(3)}  ` +
      `Eliminated: ${eliminated.join(' → ')}`
    );
  }

  // ─── Summary ───
  console.log('\n' + '═'.repeat(70));
  console.log('  SIMULATION SUMMARY');
  console.log('═'.repeat(70));

  console.log(`\n  Games completed: ${totalGamesCompleted}/${games}`);

  if (totalGamesCompleted === 0) {
    console.log('  No games completed.');
    return;
  }

  const avgLength = gameLengths.reduce((a, b) => a + b, 0) / gameLengths.length;
  const minLength = Math.min(...gameLengths);
  const maxLength = Math.max(...gameLengths);
  console.log(`  Avg game length: ${avgLength.toFixed(1)} turns (min: ${minLength}, max: ${maxLength})`);

  console.log('\n  Win Rates:');
  const sortedWins = [...winCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [name, wins] of sortedWins) {
    const pct = ((wins / totalGamesCompleted) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(wins / totalGamesCompleted * 20));
    console.log(`    ${name.padEnd(12)} ${String(wins).padStart(3)} wins (${pct.padStart(5)}%) ${bar}`);
  }

  console.log('\n  Avg Actions per Game:');
  const actionOrder = [
    ActionType.Income, ActionType.ForeignAid, ActionType.Tax,
    ActionType.Steal, ActionType.Assassinate, ActionType.Exchange, ActionType.Coup,
  ];
  for (const action of actionOrder) {
    const counts = allActionCounts[action] || [];
    const avg = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / totalGamesCompleted : 0;
    console.log(`    ${action.padEnd(14)} ${avg.toFixed(1)}`);
  }

  const challengeRate = totalChallenges > 0
    ? ((totalSuccessfulChallenges / totalChallenges) * 100).toFixed(1)
    : '0.0';
  console.log(`\n  Challenges: ${totalChallenges} total, ${totalSuccessfulChallenges} successful (${challengeRate}%)`);
  console.log(`  Blocks: ${totalBlocks} total (${(totalBlocks / totalGamesCompleted).toFixed(1)}/game)`);
  console.log(`  Eliminations: ${totalEliminations} total (${(totalEliminations / totalGamesCompleted).toFixed(1)}/game)`);

  // ─── Deep Analysis ───
  analyzeAllGames(allDecisions, allLogs);

  if (storage) {
    console.log(`\n  Game logs saved to: data/game-logs/`);
  }

  console.log('');
}

main().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
