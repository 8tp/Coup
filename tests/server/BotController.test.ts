import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BotController } from '@/server/BotController';
import { GameEngine } from '@/engine/GameEngine';
import { BotBrain } from '@/engine/BotBrain';
import {
  ActionType,
  Character,
  TurnPhase,
  GameStatus,
  RoomPlayer,
} from '@/shared/types';
import {
  BOT_ACTION_DELAY_MIN,
  BOT_ACTION_DELAY_MAX,
  BOT_REACTION_DELAY_MIN,
  BOT_REACTION_DELAY_MAX,
} from '@/shared/constants';

function createEngineWithBots(): { engine: GameEngine; botPlayers: RoomPlayer[] } {
  const engine = new GameEngine('TEST01');
  const botPlayers: RoomPlayer[] = [
    {
      id: 'bot1',
      name: 'Bot1',
      socketId: '',
      connected: true,
      isBot: true,
      personality: 'optimal' as const,
    },
  ];
  const allPlayers = [
    { id: 'human1', name: 'Alice' },
    { id: 'bot1', name: 'Bot1' },
  ];
  engine.startGame(allPlayers);
  return { engine, botPlayers };
}

function setCards(engine: GameEngine, playerId: string, cards: Character[]): void {
  const player = engine.game.getPlayer(playerId)!;
  player.influences = cards.map(c => ({ character: c, revealed: false }));
}

describe('BotController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('filters bot players from the player list', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const humanPlayers: RoomPlayer[] = [
        { id: 'human1', name: 'Alice', socketId: 's1', connected: true },
      ];
      const controller = new BotController(engine, [...humanPlayers, ...botPlayers]);
      // Should not throw — only bots with personalities are tracked
      controller.destroy();
    });

    it('handles empty bot list', () => {
      const { engine } = createEngineWithBots();
      const controller = new BotController(engine, []);
      controller.onStateChange(); // Should be a no-op
      controller.destroy();
    });
  });

  describe('onStateChange()', () => {
    it('schedules a bot decision when bot needs to act', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      // Make it bot's turn
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'bot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      // Spy on the engine to check if action is eventually called
      const handleActionSpy = vi.spyOn(engine, 'handleAction');

      controller.onStateChange();

      // Action shouldn't fire immediately
      expect(handleActionSpy).not.toHaveBeenCalled();

      // Advance past max delay
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      // Bot should have taken an action
      expect(handleActionSpy).toHaveBeenCalled();

      controller.destroy();
    });

    it('does not schedule when game is not in progress', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      engine.game.status = GameStatus.Finished;
      const handleActionSpy = vi.spyOn(engine, 'handleAction');

      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      expect(handleActionSpy).not.toHaveBeenCalled();

      controller.destroy();
    });

    it('does not schedule when bot has no decision to make', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      // Human's turn — bot has nothing to do
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'human1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');

      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      expect(handleActionSpy).not.toHaveBeenCalled();

      controller.destroy();
    });

    it('clears pending timeout on new state change', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'bot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');

      controller.onStateChange();

      // Advance partway, then trigger another state change (re-evaluates)
      vi.advanceTimersByTime(500);
      expect(handleActionSpy).not.toHaveBeenCalled();

      // Now it's human's turn — previous bot timer should be cleared
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'human1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;
      controller.onStateChange();

      // Advance past original timeout — should NOT fire (was cleared)
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);
      expect(handleActionSpy).not.toHaveBeenCalled();

      controller.destroy();
    });
  });

  describe('destroy()', () => {
    it('prevents execution of pending decisions', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'bot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');

      controller.onStateChange();
      controller.destroy();

      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);
      expect(handleActionSpy).not.toHaveBeenCalled();
    });

    it('is safe to call multiple times', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);
      controller.destroy();
      controller.destroy(); // No error
    });

    it('onStateChange is a no-op after destroy', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);
      controller.destroy();

      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'bot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');
      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      expect(handleActionSpy).not.toHaveBeenCalled();
    });
  });

  describe('delay ranges', () => {
    it('uses longer delay for actions', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'bot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');

      controller.onStateChange();

      // Should NOT have fired before the minimum delay
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MIN - 1);
      expect(handleActionSpy).not.toHaveBeenCalled();

      // Should fire within the max delay
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX - BOT_ACTION_DELAY_MIN + 2);
      expect(handleActionSpy).toHaveBeenCalled();

      controller.destroy();
    });

    it('uses shorter delay for reactions (pass challenge)', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      // Set up a challenge phase where bot needs to pass/challenge
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'human1');
      engine.game.turnPhase = TurnPhase.AwaitingActionChallenge;

      // Set up pending action from human
      engine.pendingAction = {
        type: ActionType.Tax,
        actorId: 'human1',
        claimedCharacter: Character.Duke,
      };
      engine.challengeState = {
        challengerId: '',
        challengedPlayerId: 'human1',
        claimedCharacter: Character.Duke,
        passedPlayerIds: ['human1'],
      };

      const handlePassChallengeSpy = vi.spyOn(engine, 'handlePassChallenge');
      const handleChallengeSpy = vi.spyOn(engine, 'handleChallenge');

      controller.onStateChange();

      // Should fire within the reaction delay range
      vi.advanceTimersByTime(BOT_REACTION_DELAY_MAX + 100);
      const called = handlePassChallengeSpy.mock.calls.length + handleChallengeSpy.mock.calls.length;
      expect(called).toBe(1);

      controller.destroy();
    });
  });

  describe('executeDecision()', () => {
    it('calls handleAction for action decisions', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'bot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');
      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      expect(handleActionSpy).toHaveBeenCalledTimes(1);
      expect(handleActionSpy.mock.calls[0][0]).toBe('bot1');

      controller.destroy();
    });

    it('calls handleBlock for block decisions', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      // Human assassinates bot, bot has Contessa
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'human1');
      engine.game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(engine, 'bot1', [Character.Contessa, Character.Captain]);

      engine.pendingAction = {
        type: ActionType.Assassinate,
        actorId: 'human1',
        targetId: 'bot1',
        claimedCharacter: Character.Assassin,
      };

      const handleBlockSpy = vi.spyOn(engine, 'handleBlock');
      const handlePassBlockSpy = vi.spyOn(engine, 'handlePassBlock');

      controller.onStateChange();
      vi.advanceTimersByTime(BOT_REACTION_DELAY_MAX + 100);

      // Bot has Contessa and is targeted — should always block
      expect(handleBlockSpy).toHaveBeenCalledWith('bot1', Character.Contessa);

      controller.destroy();
    });

    it('calls handleChooseInfluenceLoss for influence loss decisions', () => {
      const { engine, botPlayers } = createEngineWithBots();
      const controller = new BotController(engine, botPlayers);

      engine.game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      engine.influenceLossRequest = { playerId: 'bot1', reason: 'coup' };

      const handleInfluenceLossSpy = vi.spyOn(engine, 'handleChooseInfluenceLoss');

      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      expect(handleInfluenceLossSpy).toHaveBeenCalledWith('bot1', expect.any(Number));

      controller.destroy();
    });
  });

  describe('multiple bots', () => {
    it('only schedules one bot at a time', () => {
      const engine = new GameEngine('TEST01');
      const botPlayers: RoomPlayer[] = [
        {
          id: 'bot1', name: 'Bot1', socketId: '', connected: true,
          isBot: true, personality: 'optimal',
        },
        {
          id: 'bot2', name: 'Bot2', socketId: '', connected: true,
          isBot: true, personality: 'optimal',
        },
      ];
      engine.startGame([
        { id: 'human1', name: 'Alice' },
        { id: 'bot1', name: 'Bot1' },
        { id: 'bot2', name: 'Bot2' },
      ]);

      const controller = new BotController(engine, botPlayers);

      // It's bot1's turn
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'bot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');

      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      // Only one bot should have acted
      expect(handleActionSpy).toHaveBeenCalledTimes(1);
      expect(handleActionSpy.mock.calls[0][0]).toBe('bot1');

      controller.destroy();
    });
  });

  // ─── Personality Bot Tests ───

  describe('personality bots', () => {
    function createPersonalityBotEngine(): { engine: GameEngine; botPlayers: RoomPlayer[] } {
      const engine = new GameEngine('HTEST');
      const botPlayers: RoomPlayer[] = [
        {
          id: 'hbot1',
          name: 'PersonalityBot',
          socketId: '',
          connected: true,
          isBot: true,
          personality: 'random' as const,
        },
      ];
      const allPlayers = [
        { id: 'human1', name: 'Alice' },
        { id: 'hbot1', name: 'PersonalityBot' },
      ];
      engine.startGame(allPlayers);
      return { engine, botPlayers };
    }

    it('random personality bot gets a personality assigned', () => {
      const { engine, botPlayers } = createPersonalityBotEngine();
      const controller = new BotController(engine, botPlayers);

      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'hbot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');
      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      expect(handleActionSpy).toHaveBeenCalled();
      controller.destroy();
    });

    it('bot with specific personality type', () => {
      const engine = new GameEngine('HTEST2');
      const botPlayers: RoomPlayer[] = [
        {
          id: 'hbot2',
          name: 'AggressiveBot',
          socketId: '',
          connected: true,
          isBot: true,
          personality: 'aggressive' as const,
        },
      ];
      const allPlayers = [
        { id: 'human1', name: 'Alice' },
        { id: 'hbot2', name: 'AggressiveBot' },
      ];
      engine.startGame(allPlayers);

      const controller = new BotController(engine, botPlayers);
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'hbot2');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      const handleActionSpy = vi.spyOn(engine, 'handleAction');
      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      expect(handleActionSpy).toHaveBeenCalled();
      controller.destroy();
    });

    it('deck memory works for personality bots', () => {
      const { engine, botPlayers } = createPersonalityBotEngine();
      const controller = new BotController(engine, botPlayers);

      // Simulate deck memory invalidation - add an exchange log entry from another player
      engine.game.actionLog.push({
        message: 'Alice exchanges',
        timestamp: Date.now(),
        eventType: 'exchange',
        character: null,
        turnNumber: 1,
        actorId: 'human1',
        actorName: 'Alice',
      });

      // This should not throw
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'hbot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;
      controller.onStateChange();

      controller.destroy();
    });

    it('addBot assigns personality', () => {
      const { engine, botPlayers } = createPersonalityBotEngine();
      const controller = new BotController(engine, botPlayers);

      // Add a new bot mid-game
      controller.addBot('newbot1', 'aggressive', 'NewBot');

      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'hbot1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      controller.onStateChange();
      vi.advanceTimersByTime(BOT_ACTION_DELAY_MAX + 100);

      controller.destroy();
    });
  });
});
