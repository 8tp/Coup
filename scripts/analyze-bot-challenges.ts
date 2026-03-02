/**
 * Run bot simulations and analyze challenge behavior — target vs bystander.
 * Compares with treason data to identify discrepancies.
 *
 * Usage: npx tsx scripts/analyze-bot-challenges.ts [numGames]
 */

import { v4 as uuidv4 } from 'uuid';
import { GameEngine } from '../src/engine/GameEngine';
import { BotBrain, BotDecision } from '../src/engine/BotBrain';
import {
  ActionType,
  BotPersonality,
  Character,
  GameStatus,
  PersonalityParams,
  TurnPhase,
} from '../src/shared/types';
import { BOT_NAMES, BOT_PERSONALITIES } from '../src/shared/constants';

const NUM_GAMES = parseInt(process.argv[2] || '200', 10);
const PERSONALITY_NAME: BotPersonality = (process.argv[3] as BotPersonality) || 'optimal';
const PLAYER_COUNT = parseInt(process.argv[4] || '5', 10);
const personalityParams: PersonalityParams = BOT_PERSONALITIES[PERSONALITY_NAME === 'random' ? 'optimal' : PERSONALITY_NAME];

// ─── Types ───

interface SimBot {
  id: string;
  name: string;
  personality: PersonalityParams;
  deckMemory: Map<Character, number>;
  lastProcessedLogLength: number;
}

interface ActionTracker {
  opportunities: number;
  targetChallenges: number;
  bystanderChallenges: number;
}

interface ChallengeRecord {
  action: string;
  isTarget: boolean;
  aliveCount: number;
  turnNumber: number;
}

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
    case 'choose_exchange':
      engine.handleChooseExchange(bot.id, decision.keepIndices);
      break;
  }
}

function invalidateDeckMemory(engine: GameEngine, bots: SimBot[]): void {
  const log = engine.game.actionLog;
  for (const bot of bots) {
    const player = engine.game.getPlayer(bot.id);
    if (!player || !player.isAlive) continue;

    for (let i = bot.lastProcessedLogLength; i < log.length; i++) {
      const entry = log[i];
      if (entry.actorId !== bot.id) {
        if (entry.eventType === 'exchange' || entry.eventType === 'challenge_fail' || entry.eventType === 'block_challenge_fail') {
          bot.deckMemory.clear();
        }
      }
    }
    bot.lastProcessedLogLength = log.length;
  }
}

// ─── Run ───

console.log(`Running ${NUM_GAMES} games with ${PLAYER_COUNT} ${PERSONALITY_NAME} bots...\n`);

const tracking: Record<string, ActionTracker> = {};
const allChallenges: ChallengeRecord[] = [];

function ensureTracker(action: string): ActionTracker {
  if (!tracking[action]) tracking[action] = { opportunities: 0, targetChallenges: 0, bystanderChallenges: 0 };
  return tracking[action];
}

for (let gi = 0; gi < NUM_GAMES; gi++) {
  const engine = new GameEngine();
  const bots: SimBot[] = [];
  const playerInfos: { id: string; name: string }[] = [];

  for (let j = 0; j < PLAYER_COUNT; j++) {
    const id = uuidv4();
    const name = BOT_NAMES[j] || `Bot${j}`;
    bots.push({ id, name, personality: personalityParams, deckMemory: new Map(), lastProcessedLogLength: 0 });
    playerInfos.push({ id, name });
  }

  engine.startGame(playerInfos);

  let safety = 0;
  let lastChallengeableAction: { type: string; targetId?: string } | null = null;
  let opportunityCounted = false;

  while (engine.game.status === GameStatus.InProgress && safety < 2000) {
    safety++;
    invalidateDeckMemory(engine, bots);

    // Track when we enter action challenge phase
    const fullState = engine.getFullState();
    if (engine.game.turnPhase === TurnPhase.AwaitingActionChallenge && fullState.pendingAction) {
      const pa = fullState.pendingAction;
      const actionName = ActionType[pa.type].toLowerCase();
      const challengeable = ['tax', 'steal', 'assassinate', 'exchange'];
      if (challengeable.includes(actionName) && !opportunityCounted) {
        ensureTracker(actionName).opportunities++;
        lastChallengeableAction = { type: actionName, targetId: pa.targetId };
        opportunityCounted = true;
      }
    } else if (engine.game.turnPhase !== TurnPhase.AwaitingActionChallenge) {
      opportunityCounted = false;
      if (engine.game.turnPhase === TurnPhase.AwaitingAction) {
        lastChallengeableAction = null;
      }
    }

    let acted = false;
    for (const bot of bots) {
      const player = engine.game.getPlayer(bot.id);
      if (!player || !player.isAlive) continue;

      const state = engine.getFullState();
      const decision = BotBrain.decide(
        engine.game, bot.id, bot.personality,
        state.pendingAction, state.pendingBlock, state.challengeState,
        state.influenceLossRequest, state.exchangeState, state.blockPassedPlayerIds,
        bot.deckMemory,
      );

      if (!decision) continue;

      // Track challenge decisions on actions
      if (decision.type === 'challenge' && engine.game.turnPhase === TurnPhase.AwaitingActionChallenge && lastChallengeableAction) {
        const isTarget = lastChallengeableAction.targetId === bot.id;
        const tracker = ensureTracker(lastChallengeableAction.type);
        if (isTarget) tracker.targetChallenges++;
        else tracker.bystanderChallenges++;

        allChallenges.push({
          action: lastChallengeableAction.type,
          isTarget,
          aliveCount: engine.game.getAlivePlayers().length,
          turnNumber: engine.game.turnNumber,
        });
      }

      try {
        executeDecision(engine, bot, decision);
        acted = true;
        break;
      } catch {
        continue;
      }
    }

    if (!acted) break;
  }
}

// ─── Print Results ───

console.log('═══════════════════════════════════════════════════════════════════════════');
console.log('  BOT CHALLENGE BEHAVIOR — Target vs Bystander');
console.log('═══════════════════════════════════════════════════════════════════════════\n');

console.log('  Action       │ Opportunities │ Target Chall │ Bot T%    │ Treason T% │ Bystander Chall │ Bot B%      │ Treason B%');
console.log('  ─────────────┼───────────────┼──────────────┼───────────┼────────────┼─────────────────┼─────────────┼───────────');

const treasonData: Record<string, { target: number; bystander: number }> = {
  steal: { target: 8.2, bystander: 2.5 },
  assassinate: { target: 12.0, bystander: 6.3 },
  tax: { target: 0, bystander: 28.7 },
  exchange: { target: 0, bystander: 13.4 },
};

let totOpp = 0, totT = 0, totB = 0;

for (const action of ['steal', 'assassinate', 'tax', 'exchange']) {
  const t = tracking[action] || { opportunities: 0, targetChallenges: 0, bystanderChallenges: 0 };
  totOpp += t.opportunities;
  totT += t.targetChallenges;
  totB += t.bystanderChallenges;

  const tPct = t.opportunities > 0 ? (t.targetChallenges / t.opportunities * 100).toFixed(1) : '-';
  const bPct = t.opportunities > 0 ? (t.bystanderChallenges / t.opportunities * 100).toFixed(1) : '-';
  const td = treasonData[action];

  const tDelta = t.opportunities > 0 ? ` (${((t.targetChallenges / t.opportunities * 100) - td.target) >= 0 ? '+' : ''}${((t.targetChallenges / t.opportunities * 100) - td.target).toFixed(1)})` : '';
  const bDelta = t.opportunities > 0 ? ` (${((t.bystanderChallenges / t.opportunities * 100) - td.bystander) >= 0 ? '+' : ''}${((t.bystanderChallenges / t.opportunities * 100) - td.bystander).toFixed(1)})` : '';

  console.log(`  ${action.padEnd(13)}│ ${String(t.opportunities).padStart(13)} │ ${String(t.targetChallenges).padStart(12)} │ ${(tPct + '%').padStart(9)} │ ${(td.target.toFixed(1) + '%').padStart(10)} │ ${String(t.bystanderChallenges).padStart(15)} │ ${(bPct + '%').padStart(11)} │ ${(td.bystander.toFixed(1) + '%').padStart(9)}%`);
}

// Summary
const totalTpct = totOpp > 0 ? (totT / totOpp * 100).toFixed(1) : '-';
const totalBpct = totOpp > 0 ? (totB / totOpp * 100).toFixed(1) : '-';
console.log('  ─────────────┼───────────────┼──────────────┼───────────┼────────────┼─────────────────┼─────────────┼───────────');
console.log(`  ${'TOTAL'.padEnd(13)}│ ${String(totOpp).padStart(13)} │ ${String(totT).padStart(12)} │ ${(totalTpct + '%').padStart(9)} │ ${('4.0%').padStart(10)} │ ${String(totB).padStart(15)} │ ${(totalBpct + '%').padStart(11)} │ ${('15.5%').padStart(9)} `);

// Of all challenges, what % are bystander vs target
const allTarget = allChallenges.filter(c => c.isTarget).length;
const allBystander = allChallenges.filter(c => !c.isTarget).length;
const total = allTarget + allBystander;
console.log(`\n  Challenge source split: ${total > 0 ? (allTarget / total * 100).toFixed(1) : '-'}% target, ${total > 0 ? (allBystander / total * 100).toFixed(1) : '-'}% bystander`);
console.log(`  (Treason: 20.6% target, 79.4% bystander)\n`);

// By game phase
console.log('  ── BY GAME PHASE ──\n');
const phases = [
  { name: 'Early (T1-5)', filter: (c: ChallengeRecord) => c.turnNumber <= 5 },
  { name: 'Mid (T6-15)', filter: (c: ChallengeRecord) => c.turnNumber > 5 && c.turnNumber <= 15 },
  { name: 'Late (T16+)', filter: (c: ChallengeRecord) => c.turnNumber > 15 },
];
for (const action of ['steal', 'assassinate']) {
  console.log(`  ${action}:`);
  for (const phase of phases) {
    const phaseC = allChallenges.filter(c => c.action === action && phase.filter(c));
    const target = phaseC.filter(c => c.isTarget).length;
    const bystander = phaseC.filter(c => !c.isTarget).length;
    const total = target + bystander;
    console.log(`    ${phase.name}: ${total} challenges (${target} target, ${bystander} bystander${total > 0 ? ` = ${(bystander / total * 100).toFixed(0)}% bystander` : ''})`);
  }
}
console.log('');

// By alive count for targeted actions only
console.log('  ── TARGETED ACTION CHALLENGES BY ALIVE COUNT (Steal + Assassinate) ──\n');
const byAlive: Record<number, { target: number; bystander: number }> = {};
for (const c of allChallenges) {
  if (c.action !== 'steal' && c.action !== 'assassinate') continue;
  if (!byAlive[c.aliveCount]) byAlive[c.aliveCount] = { target: 0, bystander: 0 };
  if (c.isTarget) byAlive[c.aliveCount].target++;
  else byAlive[c.aliveCount].bystander++;
}

const treasonAlive: Record<number, { tPct: string; bPct: string; bPerPlayer: string }> = {
  5: { tPct: '2.4', bPct: '16.0', bPerPlayer: '5.34' },
  4: { tPct: '3.6', bPct: '14.3', bPerPlayer: '7.15' },
  3: { tPct: '4.5', bPct: '12.4', bPerPlayer: '12.45' },
  2: { tPct: '12.7', bPct: '21.5', bPerPlayer: '-' },
};

console.log('  Alive │ Target │ Bystander │ T:B Ratio │ Treason T:B');
console.log('  ──────┼────────┼───────────┼───────────┼────────────');
for (const count of [5, 4, 3, 2]) {
  const s = byAlive[count];
  if (!s) continue;
  const total = s.target + s.bystander;
  const ratio = total > 0 ? `${(s.target / total * 100).toFixed(0)}:${(s.bystander / total * 100).toFixed(0)}` : '-';
  const td = treasonAlive[count];
  // Treason ratio for targeted actions only
  const tT = parseFloat(td.tPct);
  const tB = parseFloat(td.bPct);
  const tRatio = `${(tT / (tT + tB) * 100).toFixed(0)}:${(tB / (tT + tB) * 100).toFixed(0)}`;
  console.log(`  ${String(count).padStart(5)} │ ${String(s.target).padStart(6)} │ ${String(s.bystander).padStart(9)} │ ${ratio.padStart(9)} │ ${tRatio.padStart(10)}`);
}

// Early game specifically (turns 1-5)
console.log('\n  ── EARLY GAME (turns 1-5) ──\n');
const earlyChallenges = allChallenges.filter(c => c.turnNumber <= 5);
const earlyByAction: Record<string, { target: number; bystander: number }> = {};
for (const c of earlyChallenges) {
  if (!earlyByAction[c.action]) earlyByAction[c.action] = { target: 0, bystander: 0 };
  if (c.isTarget) earlyByAction[c.action].target++;
  else earlyByAction[c.action].bystander++;
}

for (const action of ['steal', 'assassinate', 'tax', 'exchange']) {
  const s = earlyByAction[action];
  if (!s) { console.log(`  ${action}: no challenges`); continue; }
  const total = s.target + s.bystander;
  console.log(`  ${action}: ${total} challenges (${s.target} target, ${s.bystander} bystander = ${total > 0 ? (s.bystander / total * 100).toFixed(0) : '-'}% bystander)`);
}

console.log(`\n  Total challenges: ${allChallenges.length} across ${NUM_GAMES} games (${(allChallenges.length / NUM_GAMES).toFixed(1)} per game)`);
