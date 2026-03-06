/**
 * Simulated bot-only games to verify bot behavior in Classic and Reformation modes.
 * Runs many games and collects stats on actions, challenges, game length, etc.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { BotBrain, BotDecision } from '@/engine/BotBrain';
import {
  ActionType,
  Character,
  GameMode,
  GameStatus,
  PersonalityParams,
  BotPersonality,
} from '@/shared/types';
import { BOT_PERSONALITIES } from '@/shared/constants';

// ─── Helpers ───

function resolvePersonality(type: BotPersonality): PersonalityParams {
  if (type === 'random') {
    const choices: BotPersonality[] = ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal'];
    return BOT_PERSONALITIES[choices[Math.floor(Math.random() * choices.length)]];
  }
  return BOT_PERSONALITIES[type];
}

interface SimResult {
  turns: number;
  winnerId: string;
  actionCounts: Record<string, number>;
  challengeCount: number;
  blockCount: number;
  gameMode: string;
  stuck: boolean;
}

function simulateGame(
  playerCount: number,
  gameMode: GameMode = GameMode.Classic,
  useInquisitor = false,
  personalities: BotPersonality[] = [],
): SimResult {
  const engine = new GameEngine('SIM01');
  const names = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `bot${i + 1}`, name: names[i] });
  }

  const options = gameMode === GameMode.Reformation
    ? { gameMode, useInquisitor }
    : undefined;
  engine.startGame(players, options);

  const botPersonalities: Record<string, PersonalityParams> = {};
  const deckMemories: Record<string, Map<Character, number>> = {};
  for (let i = 0; i < playerCount; i++) {
    const pType = personalities[i] ?? 'optimal';
    botPersonalities[`bot${i + 1}`] = resolvePersonality(pType);
    deckMemories[`bot${i + 1}`] = new Map();
  }

  const actionCounts: Record<string, number> = {};
  let challengeCount = 0;
  let blockCount = 0;
  let maxTurns = 2000;
  let stuck = false;

  while (engine.game.status === GameStatus.InProgress && maxTurns > 0) {
    maxTurns--;

    // Find a bot that can act
    let acted = false;
    for (let i = 0; i < playerCount; i++) {
      const botId = `bot${i + 1}`;
      const personality = botPersonalities[botId];
      const state = engine.getFullState();

      const decision = BotBrain.decide(
        engine.game,
        botId,
        personality,
        state.pendingAction,
        state.pendingBlock,
        state.challengeState,
        state.influenceLossRequest,
        state.exchangeState,
        state.blockPassedPlayerIds,
        deckMemories[botId],
        state.examineState ?? undefined,
      );

      if (!decision) continue;

      // Track stats
      if (decision.type === 'action') {
        actionCounts[decision.action] = (actionCounts[decision.action] || 0) + 1;
      } else if (decision.type === 'challenge') {
        challengeCount++;
      } else if (decision.type === 'block') {
        blockCount++;
      }

      // Execute
      const error = executeDecision(engine, botId, decision);
      if (!error) {
        acted = true;
        break; // State changed, re-evaluate
      }
      // If error, try next bot
    }

    if (!acted) {
      // No bot could act — try timer expiry to auto-resolve
      const turnBefore = engine.game.turnNumber;
      engine.handleTimerExpiry();
      if (engine.game.turnNumber === turnBefore && engine.game.status === GameStatus.InProgress) {
        // Timer didn't advance the game — truly stuck
        stuck = true;
        break;
      }
      // Timer resolved something (e.g. auto-Income), continue
    }
  }

  if (maxTurns <= 0) stuck = true;

  let stuckPhase = '';
  let stuckInfo = '';
  if (stuck) {
    stuckPhase = engine.game.turnPhase;
    const state = engine.getFullState();
    const alive = engine.game.getAlivePlayers();
    const factions = alive.map(p => `${p.name}(${p.faction ?? 'none'},${p.coins}c,${p.aliveInfluenceCount}inf)`).join(', ');
    const currentPlayer = engine.game.currentPlayer;
    const cpCards = currentPlayer ? currentPlayer.hiddenCharacters.join('/') : 'none';
    stuckInfo = `phase=${stuckPhase}, current=${currentPlayer?.name}(${cpCards}), ` +
      `alive=[${factions}], allSameFaction=${engine.game.allSameFaction()}, turn=${engine.game.turnNumber}`;
  }

  return {
    turns: engine.game.turnNumber,
    winnerId: engine.game.winnerId ?? '',
    actionCounts,
    challengeCount,
    blockCount,
    gameMode: gameMode,
    stuck,
    stuckInfo,
  };
}

function executeDecision(engine: GameEngine, botId: string, decision: BotDecision): string | null {
  switch (decision.type) {
    case 'action':
      return engine.handleAction(botId, decision.action, decision.targetId);
    case 'challenge':
      return engine.handleChallenge(botId);
    case 'pass_challenge':
      return engine.handlePassChallenge(botId);
    case 'block':
      return engine.handleBlock(botId, decision.character);
    case 'pass_block':
      return engine.handlePassBlock(botId);
    case 'challenge_block':
      return engine.handleChallengeBlock(botId);
    case 'pass_challenge_block':
      return engine.handlePassChallengeBlock(botId);
    case 'choose_influence_loss':
      return engine.handleChooseInfluenceLoss(botId, decision.influenceIndex);
    case 'choose_exchange':
      return engine.handleChooseExchange(botId, decision.keepIndices);
    case 'examine_decision':
      return engine.handleExamineDecision(botId, decision.forceSwap);
    case 'convert':
      return engine.handleConvert(botId, decision.targetId);
    default:
      return 'Unknown decision type';
  }
}

// ─── Tests ───

describe('Bot Simulation — Classic Mode', () => {
  const GAMES = 50;

  it('completes games without getting stuck (2 players)', () => {
    let stuckCount = 0;
    const turnCounts: number[] = [];

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(2, GameMode.Classic);
      if (result.stuck) stuckCount++;
      else turnCounts.push(result.turns);
    }

    console.log(`Classic 2p: ${GAMES - stuckCount}/${GAMES} completed, avg turns: ${(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1)}`);
    expect(stuckCount).toBeLessThanOrEqual(2); // Allow rare edge cases
  });

  it('completes games without getting stuck (4 players)', () => {
    let stuckCount = 0;
    const turnCounts: number[] = [];

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(4, GameMode.Classic);
      if (result.stuck) stuckCount++;
      else turnCounts.push(result.turns);
    }

    console.log(`Classic 4p: ${GAMES - stuckCount}/${GAMES} completed, avg turns: ${(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1)}`);
    expect(stuckCount).toBeLessThanOrEqual(2);
  });

  it('completes games without getting stuck (6 players)', () => {
    let stuckCount = 0;
    const turnCounts: number[] = [];

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(6, GameMode.Classic);
      if (result.stuck) stuckCount++;
      else turnCounts.push(result.turns);
    }

    console.log(`Classic 6p: ${GAMES - stuckCount}/${GAMES} completed, avg turns: ${(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1)}`);
    expect(stuckCount).toBeLessThanOrEqual(2);
  });

  it('uses variety of actions across games', () => {
    const totalActions: Record<string, number> = {};

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(4, GameMode.Classic);
      for (const [action, count] of Object.entries(result.actionCounts)) {
        totalActions[action] = (totalActions[action] || 0) + count;
      }
    }

    console.log('Classic 4p action distribution:', totalActions);

    // Should see core actions
    expect(totalActions[ActionType.Income]).toBeGreaterThan(0);
    expect(totalActions[ActionType.Coup]).toBeGreaterThan(0);
    // Should see at least some character actions
    const characterActions = (totalActions[ActionType.Tax] || 0)
      + (totalActions[ActionType.Steal] || 0)
      + (totalActions[ActionType.Assassinate] || 0)
      + (totalActions[ActionType.Exchange] || 0)
      + (totalActions[ActionType.ForeignAid] || 0);
    expect(characterActions).toBeGreaterThan(0);

    // Should NOT see Reformation actions
    expect(totalActions[ActionType.Convert] || 0).toBe(0);
    expect(totalActions[ActionType.Embezzle] || 0).toBe(0);
    expect(totalActions[ActionType.Examine] || 0).toBe(0);
  });

  it('generates challenges and blocks', () => {
    let totalChallenges = 0;
    let totalBlocks = 0;

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(4, GameMode.Classic);
      totalChallenges += result.challengeCount;
      totalBlocks += result.blockCount;
    }

    console.log(`Classic 4p: ${totalChallenges} challenges, ${totalBlocks} blocks across ${GAMES} games`);
    expect(totalChallenges).toBeGreaterThan(0);
    expect(totalBlocks).toBeGreaterThan(0);
  });
});

describe('Bot Simulation — Reformation Mode', () => {
  const GAMES = 50;

  it('completes games without getting stuck (4 players, with Inquisitor)', () => {
    let stuckCount = 0;
    const turnCounts: number[] = [];
    const stuckInfos: string[] = [];

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(4, GameMode.Reformation, true);
      if (result.stuck) { stuckCount++; stuckInfos.push(result.stuckInfo); }
      else turnCounts.push(result.turns);
    }

    console.log(`Reformation 4p: ${GAMES - stuckCount}/${GAMES} completed, avg turns: ${turnCounts.length ? (turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1) : 'N/A'}`);
    for (const info of stuckInfos.slice(0, 5)) console.log('  STUCK:', info);
    expect(stuckCount).toBeLessThanOrEqual(2);
  });

  it('completes games without getting stuck (6 players, with Inquisitor)', () => {
    let stuckCount = 0;
    const turnCounts: number[] = [];

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(6, GameMode.Reformation, true);
      if (result.stuck) stuckCount++;
      else turnCounts.push(result.turns);
    }

    console.log(`Reformation 6p: ${GAMES - stuckCount}/${GAMES} completed, avg turns: ${(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1)}`);
    expect(stuckCount).toBeLessThanOrEqual(2);
  });

  it('completes games without Inquisitor (Ambassador mode)', () => {
    let stuckCount = 0;
    const turnCounts: number[] = [];

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(4, GameMode.Reformation, false);
      if (result.stuck) stuckCount++;
      else turnCounts.push(result.turns);
    }

    console.log(`Reformation 4p (no Inquisitor): ${GAMES - stuckCount}/${GAMES} completed, avg turns: ${(turnCounts.reduce((a, b) => a + b, 0) / turnCounts.length).toFixed(1)}`);
    expect(stuckCount).toBeLessThanOrEqual(2);
  });

  it('uses Reformation-specific actions', () => {
    const totalActions: Record<string, number> = {};

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(4, GameMode.Reformation, true);
      for (const [action, count] of Object.entries(result.actionCounts)) {
        totalActions[action] = (totalActions[action] || 0) + count;
      }
    }

    console.log('Reformation 4p action distribution:', totalActions);

    // Should see Reformation actions
    expect(totalActions[ActionType.Examine] || 0).toBeGreaterThan(0);
    // Convert/Embezzle may be rarer but should appear across many games
    const reformationActions = (totalActions[ActionType.Convert] || 0)
      + (totalActions[ActionType.Embezzle] || 0)
      + (totalActions[ActionType.Examine] || 0);
    expect(reformationActions).toBeGreaterThan(0);

    // Should NOT use Ambassador Exchange in Inquisitor mode... actually bots can still
    // use Exchange (Inquisitor version). Let's just verify core actions exist.
    expect(totalActions[ActionType.Income] || 0).toBeGreaterThan(0);
    expect(totalActions[ActionType.Coup] || 0).toBeGreaterThan(0);
  });

  it('generates faction-related activity (converts happen)', () => {
    let totalConverts = 0;
    let totalEmbezzles = 0;
    let totalExamines = 0;

    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(4, GameMode.Reformation, true);
      totalConverts += result.actionCounts[ActionType.Convert] || 0;
      totalEmbezzles += result.actionCounts[ActionType.Embezzle] || 0;
      totalExamines += result.actionCounts[ActionType.Examine] || 0;
    }

    console.log(`Reformation 4p: ${totalConverts} converts, ${totalEmbezzles} embezzles, ${totalExamines} examines across ${GAMES} games`);
    // At least some Reformation actions should happen
    expect(totalConverts + totalEmbezzles + totalExamines).toBeGreaterThan(0);
  });
});

describe('Bot Simulation — Personality Variety', () => {
  const GAMES = 30;

  it('all personality types complete games in Classic', () => {
    const personalityTypes: BotPersonality[] = ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal'];

    for (const pType of personalityTypes) {
      let stuckCount = 0;
      for (let i = 0; i < GAMES; i++) {
        const result = simulateGame(4, GameMode.Classic, false, [pType, pType, pType, pType]);
        if (result.stuck) stuckCount++;
      }
      console.log(`Classic 4p (all ${pType}): ${GAMES - stuckCount}/${GAMES} completed`);
      expect(stuckCount).toBeLessThanOrEqual(2);
    }
  });

  it('all personality types complete games in Reformation', () => {
    const personalityTypes: BotPersonality[] = ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal'];

    for (const pType of personalityTypes) {
      let stuckCount = 0;
      for (let i = 0; i < GAMES; i++) {
        const result = simulateGame(4, GameMode.Reformation, true, [pType, pType, pType, pType]);
        if (result.stuck) stuckCount++;
      }
      console.log(`Reformation 4p (all ${pType}): ${GAMES - stuckCount}/${GAMES} completed`);
      expect(stuckCount).toBeLessThanOrEqual(2);
    }
  });

  it('mixed personalities complete games', () => {
    let stuckCount = 0;
    for (let i = 0; i < GAMES; i++) {
      const result = simulateGame(6, GameMode.Reformation, true,
        ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal']);
      if (result.stuck) stuckCount++;
    }
    console.log(`Reformation 6p (mixed): ${GAMES - stuckCount}/${GAMES} completed`);
    expect(stuckCount).toBeLessThanOrEqual(2);
  });
});
