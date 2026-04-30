/**
 * Award distribution regression test — runs bot games and verifies that
 * awards are well-distributed (no single award dominates, rare awards
 * still appear). This catches regressions if thresholds or scoring change.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { BotBrain, BotDecision } from '@/engine/BotBrain';
import {
  Character,
  GameStatus,
  PersonalityParams,
  BotPersonality,
  TurnPhase,
} from '@/shared/types';
import { BOT_PERSONALITIES } from '@/shared/constants';
import { computeAwards } from '@/app/utils/gameStats';
import { serializeForPlayer } from '@/server/StateSerializer';

function resolvePersonality(type: BotPersonality): PersonalityParams {
  if (type === 'random') {
    const choices: BotPersonality[] = ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal'];
    return BOT_PERSONALITIES[choices[Math.floor(Math.random() * choices.length)]];
  }
  return BOT_PERSONALITIES[type];
}

function executeDecision(engine: GameEngine, botId: string, decision: BotDecision): string | null {
  switch (decision.type) {
    case 'action': return engine.handleAction(botId, decision.action, decision.targetId);
    case 'challenge': return engine.handleChallenge(botId);
    case 'pass_challenge': return engine.handlePassChallenge(botId);
    case 'block': return engine.handleBlock(botId, decision.character);
    case 'pass_block': return engine.handlePassBlock(botId);
    case 'challenge_block': return engine.handleChallengeBlock(botId);
    case 'pass_challenge_block': return engine.handlePassChallengeBlock(botId);
    case 'choose_influence_loss': return engine.handleChooseInfluenceLoss(botId, decision.influenceIndex);
    case 'choose_exchange': return engine.handleChooseExchange(botId, decision.keepIndices);
    case 'examine_decision': return engine.handleExamineDecision(botId, decision.forceSwap);
    case 'convert': return engine.handleConvert(botId, decision.targetId);
    default: return 'Unknown';
  }
}

function runGame(playerCount: number): GameEngine | null {
  const engine = new GameEngine('SIM01', 0, 0);
  const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `bot${i + 1}`, name: names[i] });
  }
  engine.startGame(players);

  const botPersonalities: Record<string, PersonalityParams> = {};
  const deckMemories: Record<string, Map<Character, number>> = {};
  for (let i = 0; i < playerCount; i++) {
    botPersonalities[`bot${i + 1}`] = resolvePersonality('random');
    deckMemories[`bot${i + 1}`] = new Map();
  }

  let maxTurns = 2000;
  while (engine.game.status === GameStatus.InProgress && maxTurns > 0) {
    maxTurns--;
    let acted = false;
    for (let i = 0; i < playerCount; i++) {
      const botId = `bot${i + 1}`;
      const state = engine.getFullState();
      const decision = BotBrain.decide(
        engine.game, botId, botPersonalities[botId],
        state.pendingAction, state.pendingBlock, state.challengeState,
        state.influenceLossRequest, state.exchangeState,
        state.blockPassedPlayerIds, deckMemories[botId],
        state.examineState ?? undefined,
      );
      if (!decision) continue;
      if (!executeDecision(engine, botId, decision)) { acted = true; break; }
    }
    if (!acted) {
      const tb = engine.game.turnNumber;
      engine.handleTimerExpiry();
      if (engine.game.turnNumber === tb && engine.game.status === GameStatus.InProgress) return null;
    }
  }
  return maxTurns > 0 && engine.game.turnPhase === TurnPhase.GameOver ? engine : null;
}

describe('Award Distribution', () => {
  it('4-player games produce a healthy spread of all 10 award types', () => {
    const GAMES = 300;
    const awardCounts: Record<string, number> = {};
    let completed = 0;

    for (let g = 0; g < GAMES; g++) {
      const engine = runGame(4);
      if (!engine) continue;
      completed++;
      const state = serializeForPlayer(engine.getFullState(), 'bot1');
      for (const award of computeAwards(state)) {
        awardCounts[award.title] = (awardCounts[award.title] || 0) + 1;
      }
    }

    const allAwards = [
      'Pants on Fire', 'Honest Abe', 'The Inquisitor', 'Eagle Eye',
      'The Wall', 'Smooth Operator', 'Coup Machine', 'Silent Assassin',
      'Bold Strategy', 'Quick Exit',
    ];

    // Log distribution for debugging
    console.log(`\n4-player award distribution (${completed} games):`);
    for (const name of allAwards) {
      const count = awardCounts[name] || 0;
      const pct = ((count / completed) * 100).toFixed(1);
      console.log(`  ${name.padEnd(18)} ${pct.padStart(5)}%`);
    }

    // No award should exceed 75% (prevents domination)
    for (const name of allAwards) {
      const rate = (awardCounts[name] || 0) / completed;
      expect(rate, `${name} is too dominant at ${(rate * 100).toFixed(1)}%`).toBeLessThan(0.75);
    }

    // At least 8 of 10 award types should appear (good spread)
    const typesPresent = allAwards.filter(name => (awardCounts[name] || 0) > 0).length;
    expect(typesPresent, `Only ${typesPresent}/10 award types appeared`).toBeGreaterThanOrEqual(8);

    // Previously-rare awards should appear at least occasionally (>2%)
    for (const rare of ['Eagle Eye', 'Silent Assassin', 'Coup Machine']) {
      const rate = (awardCounts[rare] || 0) / completed;
      expect(rate, `${rare} is too rare at ${(rate * 100).toFixed(1)}%`).toBeGreaterThan(0.02);
    }
  });
});
