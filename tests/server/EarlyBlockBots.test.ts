import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BotController } from '@/server/BotController';
import { GameEngine } from '@/engine/GameEngine';
import { serializeForPlayer } from '@/server/StateSerializer';
import { ActionType, BotPersonality, Character, RoomPlayer, TurnPhase } from '@/shared/types';

/**
 * Issue #88 with bots at the table, as in Play vs Bots and Practice: a bot
 * steals from a human holding Captain, the human declares the block during
 * the challenge window, and the bots carry the turn through to the end.
 */

function setup(personality: Exclude<BotPersonality, 'random'>) {
  const engine = new GameEngine('BOTS', 15_000, 0);
  engine.startGame([
    { id: 'human', name: 'Hunter' },
    { id: 'bot1', name: 'Bot1' },
    { id: 'bot2', name: 'Bot2' },
  ]);
  const bots: RoomPlayer[] = ['bot1', 'bot2'].map(id => ({
    id, name: id, socketId: '', connected: true, isBot: true, personality,
  }));
  const controller = new BotController(engine, bots, 0);
  // Phases seen during the bot's turn only (later turns are not under test)
  const phases: TurnPhase[] = [];
  let turnUnderTest: number | null = null;
  engine.setOnStateChange(state => {
    if (state.turnNumber === turnUnderTest) phases.push(state.turnPhase);
    controller.onStateChange();
  });

  engine.game.getPlayer('human')!.influences = [
    { character: Character.Captain, revealed: false },
    { character: Character.Duke, revealed: false },
  ];
  engine.game.getPlayer('bot1')!.influences = [
    { character: Character.Captain, revealed: false },
    { character: Character.Duke, revealed: false },
  ];
  engine.game.currentPlayerIndex = 1;
  engine.game.turnPhase = TurnPhase.AwaitingAction;
  turnUnderTest = engine.game.turnNumber;
  return { engine, controller, phases };
}

describe('Declared block with bots at the table', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  for (const personality of ['conservative', 'optimal', 'aggressive'] as const) {
    it(`a ${personality} table finishes the turn after the human declares Captain`, () => {
      const { engine, controller, phases } = setup(personality);
      const turn = engine.game.turnNumber;
      expect(engine.handleAction('bot1', ActionType.Steal, 'human')).toBeNull();

      // The human answers before any bot has reacted
      expect(engine.handleBlock('human', Character.Captain)).toBeNull();

      // Every player's view carries the declaration
      const bystanderView = serializeForPlayer(engine.getFullState(), 'bot2');
      expect(bystanderView.pendingAction?.declaredBlock).toEqual({ blockerId: 'human', claimedCharacter: Character.Captain });

      vi.advanceTimersByTime(60_000);

      // The human was never put through the separate block step
      expect(phases).toContain(TurnPhase.AwaitingBlockChallenge);
      expect(phases).not.toContain(TurnPhase.AwaitingBlock);
      expect(engine.game.turnNumber).toBeGreaterThan(turn);

      const types = engine.game.actionLog
        .filter(e => e.turnNumber === turn)
        .map(e => e.eventType);
      // The block was made exactly once, and was either left alone or challenged
      expect(types.filter(t => t === 'block')).toHaveLength(1);
      expect(types.some(t => t === 'block_unchallenged' || t === 'block_challenge')).toBe(true);
      // Hunter held Captain, so the steal never landed
      expect(types).not.toContain('action_resolve');

      controller.destroy();
      engine.destroy();
    });
  }
});
