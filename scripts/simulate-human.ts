/**
 * Human Bot Simulation Comparison Script
 *
 * Runs batches of games with different personality types and compares
 * behavioral metrics against Treason dataset values.
 *
 * Usage: npx tsx scripts/simulate-human.ts [--games 200] [--players 5]
 */

import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../src/engine/GameEngine';
import { BotBrain, BotDecision } from '../src/engine/BotBrain';
import {
  ActionType,
  Character,
  GameStatus,
  PersonalityParams,
  TurnPhase,
} from '../src/shared/types';
import {
  ACTION_DEFINITIONS,
  BOT_NAMES,
  BOT_PERSONALITIES,
  BOT_PERSONALITY_TYPES,
} from '../src/shared/constants';

// ─── CLI Args ───

function parseArgs(): { games: number; players: number } {
  const args = process.argv.slice(2);
  let games = 200;
  let players = 5;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--games': games = parseInt(args[++i], 10); break;
      case '--players': players = parseInt(args[++i], 10); break;
    }
  }

  return { games, players };
}

// ─── Bot State ───

interface SimBot {
  id: string;
  name: string;
  personality: PersonalityParams;
  deckMemory: Map<Character, number>;
  lastProcessedLogLength: number;
}

// ─── Metrics Collection ───

interface BatchMetrics {
  label: string;
  gamesPlayed: number;
  avgGameLength: number;
  // Action distribution (fraction of total actions)
  actionDist: Record<string, number>;
  // Bluff rates
  taxBluffRate: number;
  stealBluffRate: number;
  assassinateBluffRate: number;
  exchangeBluffRate: number;
  contessaBluffRate: number;
  // Challenge metrics
  challengeRate: number;
  challengeSuccessRate: number;
  // Block bluff rate
  blockBluffRate: number;
  // Winner card holdings
  winnerCards: Record<string, number>;
}

// ─── Game Runner ───

function runGame(playerCount: number, personality: PersonalityParams): {
  turnCount: number;
  winnerId: string;
  decisions: Array<{
    botId: string;
    decision: BotDecision;
    hand: Character[];
    action?: ActionType;
    isBluff?: boolean;
    blockChar?: Character;
    blockBluff?: boolean;
  }>;
  engine: GameEngine;
} {
  const roomCode = 'SIM' + uuidv4().slice(0, 4).toUpperCase();
  const engine = new GameEngine(roomCode);
  const decisions: Array<{
    botId: string;
    decision: BotDecision;
    hand: Character[];
    action?: ActionType;
    isBluff?: boolean;
    blockChar?: Character;
    blockBluff?: boolean;
  }> = [];

  const bots: SimBot[] = [];
  const playerInfos: Array<{ id: string; name: string }> = [];

  for (let i = 0; i < playerCount; i++) {
    const id = uuidv4();
    const name = BOT_NAMES[i % BOT_NAMES.length];
    bots.push({
      id, name,
      personality,
      deckMemory: new Map(),
      lastProcessedLogLength: 0,
    });
    playerInfos.push({ id, name });
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
        // Capture decision context
        const player = engine.game.getPlayer(bot.id)!;
        const hand = [...player.hiddenCharacters];
        const record: typeof decisions[0] = { botId: bot.id, decision, hand };

        if (decision.type === 'action') {
          record.action = decision.action;
          const def = ACTION_DEFINITIONS[decision.action];
          if (def.claimedCharacter) {
            record.isBluff = !hand.includes(def.claimedCharacter);
          }
        }
        if (decision.type === 'block') {
          record.blockChar = decision.character;
          record.blockBluff = !hand.includes(decision.character);
        }

        decisions.push(record);
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
        break;
      }
    }
  }

  return {
    turnCount: engine.game.turnNumber,
    winnerId: engine.game.winnerId || '',
    decisions,
    engine,
  };
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

// ─── Batch Runner ───

function runBatch(
  label: string,
  gameCount: number,
  playerCount: number,
  personality: PersonalityParams,
): BatchMetrics {
  let totalTurns = 0;
  const actionCounts: Record<string, number> = {};
  let totalActions = 0;

  let taxClaims = 0, taxBluffs = 0;
  let stealClaims = 0, stealBluffs = 0;
  let assassinateClaims = 0, assassinateBluffs = 0;
  let exchangeClaims = 0, exchangeBluffs = 0;
  let contessaBlocks = 0, contessaBluffBlocks = 0;
  let otherBlocks = 0, otherBluffBlocks = 0;

  let challengeOpps = 0, challengesMade = 0, challengeSuccesses = 0;

  const winnerCardCounts: Record<string, number> = {};
  let winnerCardTotal = 0;

  for (let g = 0; g < gameCount; g++) {
    const result = runGame(playerCount, personality);
    totalTurns += result.turnCount;

    for (const d of result.decisions) {
      if (d.decision.type === 'action') {
        const action = d.action!;
        actionCounts[action] = (actionCounts[action] || 0) + 1;
        totalActions++;

        const def = ACTION_DEFINITIONS[action];
        if (def.claimedCharacter) {
          if (action === ActionType.Tax) { taxClaims++; if (d.isBluff) taxBluffs++; }
          if (action === ActionType.Steal) { stealClaims++; if (d.isBluff) stealBluffs++; }
          if (action === ActionType.Assassinate) { assassinateClaims++; if (d.isBluff) assassinateBluffs++; }
          if (action === ActionType.Exchange) { exchangeClaims++; if (d.isBluff) exchangeBluffs++; }
        }
      }

      if (d.decision.type === 'block') {
        if (d.blockChar === Character.Contessa) {
          contessaBlocks++;
          if (d.blockBluff) contessaBluffBlocks++;
        } else {
          otherBlocks++;
          if (d.blockBluff) otherBluffBlocks++;
        }
      }

      if (d.decision.type === 'challenge' || d.decision.type === 'challenge_block') {
        challengesMade++;
      }
      if (d.decision.type === 'pass_challenge' || d.decision.type === 'pass_challenge_block') {
        challengeOpps++;
      }
    }

    // Count challenge successes from action log
    for (const entry of result.engine.game.actionLog) {
      if (entry.eventType === 'challenge_success' || entry.eventType === 'block_challenge_success') {
        challengeSuccesses++;
      }
    }

    // Winner card analysis
    if (result.winnerId) {
      const winner = result.engine.game.getPlayer(result.winnerId);
      if (winner) {
        for (const inf of winner.influences) {
          if (!inf.revealed) {
            winnerCardCounts[inf.character] = (winnerCardCounts[inf.character] || 0) + 1;
            winnerCardTotal++;
          }
        }
      }
    }
  }

  const totalChallengeOpps = challengesMade + challengeOpps;
  const actionDist: Record<string, number> = {};
  for (const [action, count] of Object.entries(actionCounts)) {
    actionDist[action] = totalActions > 0 ? count / totalActions : 0;
  }

  const winnerCards: Record<string, number> = {};
  for (const [char, count] of Object.entries(winnerCardCounts)) {
    winnerCards[char] = winnerCardTotal > 0 ? count / winnerCardTotal : 0;
  }

  return {
    label,
    gamesPlayed: gameCount,
    avgGameLength: totalTurns / gameCount,
    actionDist,
    taxBluffRate: taxClaims > 0 ? taxBluffs / taxClaims : 0,
    stealBluffRate: stealClaims > 0 ? stealBluffs / stealClaims : 0,
    assassinateBluffRate: assassinateClaims > 0 ? assassinateBluffs / assassinateClaims : 0,
    exchangeBluffRate: exchangeClaims > 0 ? exchangeBluffs / exchangeClaims : 0,
    contessaBluffRate: contessaBlocks > 0 ? contessaBluffBlocks / contessaBlocks : 0,
    challengeRate: totalChallengeOpps > 0 ? challengesMade / totalChallengeOpps : 0,
    challengeSuccessRate: challengesMade > 0 ? challengeSuccesses / challengesMade : 0,
    blockBluffRate: (otherBlocks + contessaBlocks) > 0 ? (otherBluffBlocks + contessaBluffBlocks) / (otherBlocks + contessaBlocks) : 0,
    winnerCards,
  };
}

// ─── Treason Reference Values (from findings.md winner analysis) ───

const TREASON_REF = {
  taxBluffRate: 0.153,
  stealBluffRate: 0.088,
  assassinateBluffRate: 0.132,
  exchangeBluffRate: 0.16,
  contessaBluffRate: 0.043,
  challengeRate: 0.05,
  blockBluffRate: 0.07,
};

// ─── Output ───

function pct(v: number): string { return (v * 100).toFixed(1) + '%'; }

function grade(actual: number, target: number): string {
  const ratio = target > 0 ? actual / target : (actual < 0.01 ? 1 : 10);
  if (ratio >= 0.5 && ratio <= 2.0) return '\x1b[32mPASS\x1b[0m';
  if (ratio >= 0.33 && ratio <= 3.0) return '\x1b[33mWARN\x1b[0m';
  return '\x1b[31mFAIL\x1b[0m';
}

function printComparison(batches: BatchMetrics[]) {
  console.log('\n' + '═'.repeat(100));
  console.log('  HUMAN BOT SIMULATION COMPARISON');
  console.log('═'.repeat(100));

  // Header
  const labels = batches.map(b => b.label);
  const header = '  Metric'.padEnd(26) + 'Treason'.padStart(8) + labels.map(l => l.padStart(10)).join('');
  console.log('\n' + header);
  console.log('  ' + '─'.repeat(header.length - 2));

  // Rows
  const rows: Array<{ label: string; treason: number; values: number[] }> = [
    { label: 'Tax bluff rate', treason: TREASON_REF.taxBluffRate, values: batches.map(b => b.taxBluffRate) },
    { label: 'Steal bluff rate', treason: TREASON_REF.stealBluffRate, values: batches.map(b => b.stealBluffRate) },
    { label: 'Assassin bluff rate', treason: TREASON_REF.assassinateBluffRate, values: batches.map(b => b.assassinateBluffRate) },
    { label: 'Exchange bluff rate', treason: TREASON_REF.exchangeBluffRate, values: batches.map(b => b.exchangeBluffRate) },
    { label: 'Contessa bluff rate', treason: TREASON_REF.contessaBluffRate, values: batches.map(b => b.contessaBluffRate) },
    { label: 'Challenge rate', treason: TREASON_REF.challengeRate, values: batches.map(b => b.challengeRate) },
    { label: 'Block bluff rate', treason: TREASON_REF.blockBluffRate, values: batches.map(b => b.blockBluffRate) },
  ];

  for (const row of rows) {
    let line = `  ${row.label.padEnd(24)} ${pct(row.treason).padStart(8)}`;
    for (const val of row.values) {
      const g = grade(val, row.treason);
      line += `${pct(val).padStart(8)} ${g}`;
    }
    console.log(line);
  }

  // Game length
  console.log('\n  Avg game length:');
  for (const b of batches) {
    console.log(`    ${b.label.padEnd(16)} ${b.avgGameLength.toFixed(1)} turns`);
  }

  // Winner card distribution
  console.log('\n  Winner card holdings:');
  const chars = Object.values(Character);
  const charHeader = '  Card'.padEnd(16) + labels.map(l => l.padStart(10)).join('');
  console.log(charHeader);
  for (const char of chars) {
    let line = `  ${char.padEnd(14)}`;
    for (const b of batches) {
      line += pct(b.winnerCards[char] || 0).padStart(10);
    }
    console.log(line);
  }
}

// ─── Main ───

function main() {
  const { games, players } = parseArgs();
  console.log(`\nRunning Human Bot Simulation Comparison`);
  console.log(`  Games per batch: ${games}`);
  console.log(`  Players per game: ${players}`);

  const batches: BatchMetrics[] = [];

  // Optimal baseline
  console.log('\n  Running Optimal baseline...');
  batches.push(runBatch('Optimal', games, players, BOT_PERSONALITIES.optimal));

  // Each personality
  for (const pName of BOT_PERSONALITY_TYPES) {
    console.log(`  Running ${pName}...`);
    batches.push(runBatch(pName.charAt(0).toUpperCase() + pName.slice(1), games, players, BOT_PERSONALITIES[pName]));
  }

  // Mixed (random personality per bot)
  console.log('  Running mixed...');
  // For mixed, we run games where each bot gets a random personality
  let totalTurns = 0;
  const mixedDecisions: typeof batches[0] = {
    label: 'Mixed',
    gamesPlayed: games,
    avgGameLength: 0,
    actionDist: {},
    taxBluffRate: 0, stealBluffRate: 0, assassinateBluffRate: 0, exchangeBluffRate: 0,
    contessaBluffRate: 0, challengeRate: 0, challengeSuccessRate: 0, blockBluffRate: 0,
    winnerCards: {},
  };

  // Run mixed batch manually (each bot gets random personality)
  let taxC = 0, taxB = 0, stealC = 0, stealB = 0, assC = 0, assB = 0, exC = 0, exB = 0;
  let contB = 0, contT = 0, blockBl = 0, blockT = 0;
  let chMade = 0, chOpps = 0, chSucc = 0;
  const winCards: Record<string, number> = {};
  let winCardTotal = 0;

  for (let g = 0; g < games; g++) {
    const roomCode = 'MIX' + uuidv4().slice(0, 4).toUpperCase();
    const engine = new GameEngine(roomCode);
    const bots: SimBot[] = [];
    const playerInfos: Array<{ id: string; name: string }> = [];

    for (let i = 0; i < players; i++) {
      const id = uuidv4();
      const name = BOT_NAMES[i % BOT_NAMES.length];
      const pType = BOT_PERSONALITY_TYPES[Math.floor(Math.random() * BOT_PERSONALITY_TYPES.length)];
      bots.push({
        id, name,
        personality: BOT_PERSONALITIES[pType],
        deckMemory: new Map(), lastProcessedLogLength: 0,
      });
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
          const player = engine.game.getPlayer(bot.id)!;
          const hand = [...player.hiddenCharacters];

          if (decision.type === 'action') {
            const def = ACTION_DEFINITIONS[decision.action];
            if (def.claimedCharacter) {
              const bluff = !hand.includes(def.claimedCharacter);
              if (decision.action === ActionType.Tax) { taxC++; if (bluff) taxB++; }
              if (decision.action === ActionType.Steal) { stealC++; if (bluff) stealB++; }
              if (decision.action === ActionType.Assassinate) { assC++; if (bluff) assB++; }
              if (decision.action === ActionType.Exchange) { exC++; if (bluff) exB++; }
            }
          }
          if (decision.type === 'block') {
            const bluff = !hand.includes(decision.character);
            if (decision.character === Character.Contessa) { contT++; if (bluff) contB++; }
            else { blockT++; if (bluff) blockBl++; }
          }
          if (decision.type === 'challenge' || decision.type === 'challenge_block') chMade++;
          if (decision.type === 'pass_challenge' || decision.type === 'pass_challenge_block') chOpps++;

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

    totalTurns += engine.game.turnNumber;
    for (const entry of engine.game.actionLog) {
      if (entry.eventType === 'challenge_success' || entry.eventType === 'block_challenge_success') chSucc++;
    }
    if (engine.game.winnerId) {
      const winner = engine.game.getPlayer(engine.game.winnerId);
      if (winner) {
        for (const inf of winner.influences) {
          if (!inf.revealed) { winCards[inf.character] = (winCards[inf.character] || 0) + 1; winCardTotal++; }
        }
      }
    }
  }

  const totalChOpps = chMade + chOpps;
  mixedDecisions.avgGameLength = totalTurns / games;
  mixedDecisions.taxBluffRate = taxC > 0 ? taxB / taxC : 0;
  mixedDecisions.stealBluffRate = stealC > 0 ? stealB / stealC : 0;
  mixedDecisions.assassinateBluffRate = assC > 0 ? assB / assC : 0;
  mixedDecisions.exchangeBluffRate = exC > 0 ? exB / exC : 0;
  mixedDecisions.contessaBluffRate = contT > 0 ? contB / contT : 0;
  mixedDecisions.challengeRate = totalChOpps > 0 ? chMade / totalChOpps : 0;
  mixedDecisions.challengeSuccessRate = chMade > 0 ? chSucc / chMade : 0;
  mixedDecisions.blockBluffRate = (blockT + contT) > 0 ? (blockBl + contB) / (blockT + contT) : 0;
  for (const [char, count] of Object.entries(winCards)) {
    mixedDecisions.winnerCards[char] = winCardTotal > 0 ? count / winCardTotal : 0;
  }
  batches.push(mixedDecisions);

  printComparison(batches);
}

main();
