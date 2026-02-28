import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { ActionType, Character, TurnPhase, GameStatus, GameState } from '@/shared/types';

function createEngine(playerCount = 3): GameEngine {
  const engine = new GameEngine('TEST01');
  const players = [];
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `p${i + 1}`, name: names[i] });
  }
  engine.startGame(players);
  // Fix starting player to p1 for predictable tests
  engine.game.currentPlayerIndex = 0;
  engine.game.turnPhase = TurnPhase.AwaitingAction;
  return engine;
}

/** Helper to give a player specific cards */
function setCards(engine: GameEngine, playerId: string, cards: Character[]): void {
  const player = engine.game.getPlayer(playerId)!;
  player.influences = cards.map(c => ({ character: c, revealed: false }));
}

describe('GameEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startGame()', () => {
    it('initializes the game and broadcasts state', () => {
      const states: GameState[] = [];
      const engine = new GameEngine('TEST01');
      engine.setOnStateChange(state => states.push(state));
      engine.startGame([
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ]);

      expect(engine.game.status).toBe(GameStatus.InProgress);
      expect(states.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('handleAction()', () => {
    it('validates it is the right player turn', () => {
      const engine = createEngine();
      const error = engine.handleAction('p2', ActionType.Income);
      expect(error).toContain('Not your turn');
    });

    it('processes Income action correctly', () => {
      const engine = createEngine();
      const coinsBefore = engine.game.getPlayer('p1')!.coins;
      const error = engine.handleAction('p1', ActionType.Income);
      expect(error).toBeNull();
      expect(engine.game.getPlayer('p1')!.coins).toBe(coinsBefore + 1);
      // Turn should have advanced
      expect(engine.game.currentPlayerIndex).not.toBe(0);
    });

    it('processes Tax action (challenge phase)', () => {
      const engine = createEngine();
      const error = engine.handleAction('p1', ActionType.Tax);
      expect(error).toBeNull();
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);
      expect(engine.pendingAction).toBeDefined();
      expect(engine.pendingAction!.type).toBe(ActionType.Tax);
    });
  });

  describe('handleChallenge() / handlePassChallenge()', () => {
    it('handles a challenge on Tax', () => {
      const engine = createEngine();
      setCards(engine, 'p1', [Character.Duke, Character.Captain]);

      engine.handleAction('p1', ActionType.Tax);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // p2 challenges; p1 has Duke, so challenge fails
      const error = engine.handleChallenge('p2');
      expect(error).toBeNull();
      // Challenger (p2) should need to lose influence
    });

    it('returns error when not in challenge phase', () => {
      const engine = createEngine();
      const error = engine.handleChallenge('p2');
      expect(error).not.toBeNull();
    });

    it('handles pass challenge flow', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.Tax);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // All players pass
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');

      // Tax is not blockable, so it should resolve
      expect(engine.game.getPlayer('p1')!.coins).toBe(2 + 3); // starting + tax
    });

    it('rejects pass from player who already passed', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.Tax);
      engine.handlePassChallenge('p2');
      const error = engine.handlePassChallenge('p2');
      expect(error).toContain('Already passed');
    });
  });

  describe('handleBlock() / handlePassBlock()', () => {
    it('handles block on Foreign Aid', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);

      const error = engine.handleBlock('p2', Character.Duke);
      expect(error).toBeNull();
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
    });

    it('returns error when not in block phase', () => {
      const engine = createEngine();
      const error = engine.handleBlock('p2', Character.Duke);
      expect(error).not.toBeNull();
    });

    it('handles pass block flow for Foreign Aid', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);

      // All non-actor players pass block
      engine.handlePassBlock('p2');
      engine.handlePassBlock('p3');

      // Foreign Aid should resolve
      expect(engine.game.getPlayer('p1')!.coins).toBe(2 + 2); // starting + foreign aid
    });

    it('rejects actor from passing block', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      const error = engine.handlePassBlock('p1');
      expect(error).toContain('Actor cannot pass');
    });
  });

  describe('handleChallengeBlock() / handlePassChallengeBlock()', () => {
    it('handles challenge on a block', () => {
      const engine = createEngine();
      setCards(engine, 'p2', [Character.Duke, Character.Captain]); // has Duke

      engine.handleAction('p1', ActionType.ForeignAid);
      engine.handleBlock('p2', Character.Duke);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);

      // p1 challenges the block; p2 has Duke so challenge fails
      const error = engine.handleChallengeBlock('p1');
      expect(error).toBeNull();
      // p1 should need to lose influence (block stands)
    });

    it('returns error when not in block challenge phase', () => {
      const engine = createEngine();
      const error = engine.handleChallengeBlock('p1');
      expect(error).not.toBeNull();
    });

    it('handles pass block challenge flow', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      engine.handleBlock('p2', Character.Duke);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);

      // All players pass on challenging the block
      engine.handlePassChallengeBlock('p1');
      engine.handlePassChallengeBlock('p3');

      // Block succeeds unchallenged, action is blocked, turn advances
      // Foreign Aid coins NOT given
      expect(engine.game.getPlayer('p1')!.coins).toBe(2); // just starting coins
    });
  });

  describe('handleChooseInfluenceLoss()', () => {
    it('handles influence loss for coup', () => {
      const engine = createEngine();
      engine.game.getPlayer('p1')!.coins = 10;
      engine.handleAction('p1', ActionType.Coup, 'p2');
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);

      const error = engine.handleChooseInfluenceLoss('p2', 0);
      expect(error).toBeNull();
      expect(engine.game.getPlayer('p2')!.influences[0].revealed).toBe(true);
    });

    it('returns error when not in influence loss phase', () => {
      const engine = createEngine();
      const error = engine.handleChooseInfluenceLoss('p1', 0);
      expect(error).not.toBeNull();
    });
  });

  describe('handleChooseExchange()', () => {
    it('handles exchange card selection', () => {
      const engine = createEngine();
      setCards(engine, 'p1', [Character.Ambassador, Character.Captain]);

      engine.handleAction('p1', ActionType.Exchange);
      // Pass challenge phase
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingExchange);
      expect(engine.exchangeState).toBeDefined();

      // Keep the first 2 cards
      const error = engine.handleChooseExchange('p1', [0, 1]);
      expect(error).toBeNull();
    });

    it('returns error when not in exchange phase', () => {
      const engine = createEngine();
      const error = engine.handleChooseExchange('p1', [0, 1]);
      expect(error).not.toBeNull();
    });
  });

  describe('State change callback', () => {
    it('fires on every state change', () => {
      const states: GameState[] = [];
      const engine = new GameEngine('TEST01');
      engine.setOnStateChange(state => states.push(state));
      engine.startGame([
        { id: 'p1', name: 'Alice' },
        { id: 'p2', name: 'Bob' },
      ]);
      const countAfterStart = states.length;

      engine.game.currentPlayerIndex = 0;
      engine.game.turnPhase = TurnPhase.AwaitingAction;
      engine.handleAction('p1', ActionType.Income);

      expect(states.length).toBeGreaterThan(countAfterStart);
    });
  });

  describe('Timer handling', () => {
    it('sets timer on challenge phase', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.Tax);
      expect(engine.timerExpiry).not.toBeNull();
    });

    it('timer expiry auto-resolves challenge phase', () => {
      const engine = createEngine();
      setCards(engine, 'p1', [Character.Duke, Character.Captain]);
      engine.handleAction('p1', ActionType.Tax);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // Advance timer
      vi.advanceTimersByTime(15_000);

      // Tax is not blockable, so it should have resolved
      expect(engine.game.getPlayer('p1')!.coins).toBe(2 + 3);
    });

    it('timer expiry auto-resolves block phase', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);

      vi.advanceTimersByTime(15_000);

      // Foreign Aid should have resolved
      expect(engine.game.getPlayer('p1')!.coins).toBe(2 + 2);
    });

    it('timer expiry auto-resolves block challenge phase', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      engine.handleBlock('p2', Character.Duke);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);

      vi.advanceTimersByTime(15_000);

      // Block not challenged, action blocked
      expect(engine.game.getPlayer('p1')!.coins).toBe(2);
    });

    it('clears timer on manual resolution', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      expect(engine.timerExpiry).not.toBeNull();

      // Block triggers new timer
      engine.handleBlock('p2', Character.Duke);
      // Old timer should have been cleared and new one set
      expect(engine.timerExpiry).not.toBeNull();
    });
  });

  describe('Full game flow', () => {
    it('Income -> next turn', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.Income);
      expect(engine.game.getPlayer('p1')!.coins).toBe(3);
      expect(engine.game.currentPlayerIndex).toBe(1); // Bob's turn
    });

    it('Tax -> challenge pass -> resolve -> next turn', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.Tax);
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      expect(engine.game.getPlayer('p1')!.coins).toBe(5); // 2 + 3
      expect(engine.game.currentPlayerIndex).toBe(1);
    });

    it('Foreign Aid -> block -> block challenge pass -> blocked -> next turn', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.ForeignAid);
      engine.handleBlock('p2', Character.Duke);
      // All pass the block challenge
      engine.handlePassChallengeBlock('p1');
      engine.handlePassChallengeBlock('p3');
      expect(engine.game.getPlayer('p1')!.coins).toBe(2); // blocked, no coins
      expect(engine.game.currentPlayerIndex).toBe(1);
    });

    it('Coup -> influence loss -> next turn', () => {
      const engine = createEngine();
      engine.game.getPlayer('p1')!.coins = 10;
      engine.handleAction('p1', ActionType.Coup, 'p2');
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      engine.handleChooseInfluenceLoss('p2', 0);
      expect(engine.game.getPlayer('p2')!.influences[0].revealed).toBe(true);
      expect(engine.game.getPlayer('p1')!.coins).toBe(3); // 10 - 7
    });

    it('Steal -> challenge pass -> block pass -> resolve -> next turn', () => {
      const engine = createEngine();
      engine.game.getPlayer('p2')!.coins = 4;
      engine.handleAction('p1', ActionType.Steal, 'p2');
      // Pass challenge
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      // Target passes block
      engine.handlePassBlock('p2');
      // Steal resolves
      expect(engine.game.getPlayer('p1')!.coins).toBe(4); // 2 + 2
      expect(engine.game.getPlayer('p2')!.coins).toBe(2); // 4 - 2
    });

    it('game ends when only one player remains', () => {
      const engine = createEngine(2);
      // Kill p2's first influence
      engine.game.getPlayer('p2')!.influences[0].revealed = true;
      engine.game.getPlayer('p1')!.coins = 10;
      engine.game.currentPlayerIndex = 0;
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      engine.handleAction('p1', ActionType.Coup, 'p2');
      engine.handleChooseInfluenceLoss('p2', 1);
      expect(engine.game.status).toBe(GameStatus.Finished);
      expect(engine.game.winnerId).toBe('p1');
    });
  });

  describe('getFullState()', () => {
    it('includes all engine state in the returned object', () => {
      const engine = createEngine();
      engine.handleAction('p1', ActionType.Tax);

      const state = engine.getFullState();
      expect(state.pendingAction).toBeDefined();
      expect(state.pendingAction!.type).toBe(ActionType.Tax);
      expect(state.challengeState).toBeDefined();
      expect(state.timerExpiry).not.toBeNull();
    });
  });
});
