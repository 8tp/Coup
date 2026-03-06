import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { ActionType, Character, GameMode, GameState, GameStatus, TurnPhase } from '@/shared/types';

function createEngine(playerCount = 3, timerMs?: number, turnTimerMs?: number): GameEngine {
  const engine = new GameEngine('TEST01', timerMs, turnTimerMs);
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `p${i + 1}`, name: names[i] });
  }
  engine.startGame(players);
  engine.game.currentPlayerIndex = 0;
  engine.game.turnPhase = TurnPhase.AwaitingAction;
  return engine;
}

function setCards(engine: GameEngine, playerId: string, cards: Character[]): void {
  const player = engine.game.getPlayer(playerId)!;
  player.influences = cards.map(c => ({ character: c, revealed: false }));
}

describe('GameEngine — E2E Game Flows', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('Complete 2-player game via Coup', () => {
    it('plays a full game: income -> coup -> influence loss -> game over', () => {
      const engine = createEngine(2);

      // Give p1 enough to coup directly
      engine.game.getPlayer('p1')!.coins = 7;
      setCards(engine, 'p2', [Character.Duke, Character.Captain]);

      // p1 coups p2 — first influence
      engine.handleAction('p1', ActionType.Coup, 'p2');
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      engine.handleChooseInfluenceLoss('p2', 0);

      expect(engine.game.getPlayer('p2')!.isAlive).toBe(true);
      expect(engine.game.getPlayer('p2')!.aliveInfluenceCount).toBe(1);

      // p2 takes income turns until they can coup
      // After coup, p1 has 0 coins, p2 has 2. Turn alternates.
      // We need p1 to get 7 coins again. Just set it directly:
      engine.game.getPlayer('p1')!.coins = 7;

      // Ensure it's p1's turn
      engine.game.currentPlayerIndex = engine.game.players.findIndex(p => p.id === 'p1');
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      // p1 coups p2's last influence
      engine.handleAction('p1', ActionType.Coup, 'p2');
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      engine.handleChooseInfluenceLoss('p2', 1);

      // Game should be over
      expect(engine.game.status).toBe(GameStatus.Finished);
      expect(engine.game.turnPhase).toBe(TurnPhase.GameOver);
      expect(engine.game.getPlayer('p2')!.isAlive).toBe(false);
    });
  });

  describe('Complete game via Assassination', () => {
    it('plays assassination flow: declare -> challenge pass -> block pass -> influence loss', () => {
      const engine = createEngine(2);
      setCards(engine, 'p1', [Character.Assassin, Character.Duke]);
      setCards(engine, 'p2', [Character.Captain, Character.Captain]);
      engine.game.getPlayer('p1')!.coins = 5;

      // p1 assassinates p2
      const error = engine.handleAction('p1', ActionType.Assassinate, 'p2');
      expect(error).toBeNull();
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // p2 passes challenge
      engine.handlePassChallenge('p2');

      // p2 can block — passes block instead
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);
      engine.handlePassBlock('p2');

      // p2 must lose an influence
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      engine.handleChooseInfluenceLoss('p2', 0);

      // p2 still alive with 1 influence
      expect(engine.game.getPlayer('p2')!.isAlive).toBe(true);
      expect(engine.game.getPlayer('p2')!.aliveInfluenceCount).toBe(1);
    });
  });

  describe('Tax -> Challenge -> Challenge Fails flow', () => {
    it('handles truthful Tax being challenged (challenger loses)', () => {
      const engine = createEngine(3);
      setCards(engine, 'p1', [Character.Duke, Character.Captain]);
      setCards(engine, 'p2', [Character.Contessa, Character.Assassin]);

      const coinsBefore = engine.game.getPlayer('p1')!.coins;

      engine.handleAction('p1', ActionType.Tax);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // p2 challenges — but p1 has Duke
      engine.handleChallenge('p2');

      // p2 has 2 influences so must choose which to lose
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      engine.handleChooseInfluenceLoss('p2', 0);

      // After influence loss, action resolves — p1 gets Tax coins
      expect(engine.game.getPlayer('p1')!.coins).toBe(coinsBefore + 3);
    });
  });

  describe('Foreign Aid -> Block flow', () => {
    it('handles Foreign Aid blocked by Duke', () => {
      const engine = createEngine(3);
      setCards(engine, 'p2', [Character.Duke, Character.Contessa]);

      const coinsBefore = engine.game.getPlayer('p1')!.coins;

      engine.handleAction('p1', ActionType.ForeignAid);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);

      // p2 blocks with Duke
      engine.handleBlock('p2', Character.Duke);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);

      // p1 passes the block challenge
      engine.handlePassChallengeBlock('p1');

      // Foreign Aid blocked — coins unchanged
      expect(engine.game.getPlayer('p1')!.coins).toBe(coinsBefore);
    });
  });

  describe('Exchange flow', () => {
    it('handles full exchange: declare -> pass challenges -> choose cards', () => {
      const engine = createEngine(3);
      setCards(engine, 'p1', [Character.Ambassador, Character.Contessa]);

      engine.handleAction('p1', ActionType.Exchange);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingExchange);
      expect(engine.exchangeState).toBeDefined();
      expect(engine.exchangeState!.drawnCards.length).toBe(2);

      // Keep first 2 cards (original hand)
      const error = engine.handleChooseExchange('p1', [0, 1]);
      expect(error).toBeNull();

      // Turn should advance
      expect(engine.game.currentPlayerIndex).not.toBe(0);
    });
  });

  describe('Timer auto-resolution', () => {
    it('auto-resolves challenge phase when timer expires', () => {
      const engine = createEngine(3, 5000);
      setCards(engine, 'p1', [Character.Duke, Character.Captain]);

      engine.handleAction('p1', ActionType.Tax);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // Advance past timer
      vi.advanceTimersByTime(6000);

      // Should have resolved (all players auto-passed)
      expect(engine.game.turnPhase).not.toBe(TurnPhase.AwaitingActionChallenge);
    });

    it('auto-resolves block phase when timer expires', () => {
      const engine = createEngine(3, 5000);
      setCards(engine, 'p1', [Character.Captain, Character.Duke]);

      engine.handleAction('p1', ActionType.Steal, 'p2');
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);

      vi.advanceTimersByTime(6000);

      // Block phase should have resolved
      expect(engine.game.turnPhase).not.toBe(TurnPhase.AwaitingBlock);
    });

    it('auto-resolves influence loss when timer expires', () => {
      // Pass turnTimerMs=5000 as well since influence loss uses turnTimerMs
      const engine = createEngine(2, 5000, 5000);
      engine.game.getPlayer('p1')!.coins = 7;

      engine.handleAction('p1', ActionType.Coup, 'p2');
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);

      vi.advanceTimersByTime(6000);

      // Should have auto-chosen an influence to lose
      const p2 = engine.game.getPlayer('p2')!;
      const revealedCount = p2.influences.filter(i => i.revealed).length;
      expect(revealedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Forced coup at 10+ coins', () => {
    it('rejects non-Coup actions at 10 coins', () => {
      const engine = createEngine(3);
      engine.game.getPlayer('p1')!.coins = 10;

      const error = engine.handleAction('p1', ActionType.Tax);
      expect(error).toBeTruthy();
      expect(error).toContain('must Coup');
    });

    it('allows Coup at 10 coins', () => {
      const engine = createEngine(3);
      engine.game.getPlayer('p1')!.coins = 10;

      const error = engine.handleAction('p1', ActionType.Coup, 'p2');
      expect(error).toBeNull();
    });
  });

  describe('Deck exhaustion during exchange', () => {
    it('handles empty deck gracefully', () => {
      const engine = createEngine(3);
      setCards(engine, 'p1', [Character.Ambassador, Character.Duke]);

      // Empty the deck
      while (engine.game.deck.size > 0) {
        engine.game.deck.draw();
      }

      engine.handleAction('p1', ActionType.Exchange);
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');

      // Should resolve without entering exchange (deck empty)
      expect(engine.game.turnPhase).not.toBe(TurnPhase.AwaitingExchange);
    });
  });

  describe('Reformation: Examine E2E', () => {
    it('plays full examine flow: declare -> pass challenges -> force swap', () => {
      const engine = new GameEngine('TEST01');
      engine.startGame(
        [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }, { id: 'p3', name: 'Charlie' }, { id: 'p4', name: 'Diana' }],
        { gameMode: GameMode.Reformation, useInquisitor: true },
      );
      engine.game.currentPlayerIndex = 0;
      engine.game.turnPhase = TurnPhase.AwaitingAction;

      setCards(engine, 'p1', [Character.Inquisitor, Character.Duke]);
      setCards(engine, 'p2', [Character.Captain, Character.Assassin]);

      const error = engine.handleAction('p1', ActionType.Examine, 'p2');
      expect(error).toBeNull();

      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      engine.handlePassChallenge('p4');

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingExamineDecision);
      expect(engine.examineState).toBeDefined();

      const decError = engine.handleExamineDecision('p1', true);
      expect(decError).toBeNull();

      // Turn should advance
      expect(engine.game.turnPhase).not.toBe(TurnPhase.AwaitingExamineDecision);
    });
  });

  describe('Reformation: Embezzle E2E', () => {
    it('plays full embezzle flow: declare -> pass challenges -> coins transferred', () => {
      const engine = new GameEngine('TEST01');
      engine.startGame(
        [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }, { id: 'p3', name: 'Charlie' }, { id: 'p4', name: 'Diana' }],
        { gameMode: GameMode.Reformation, useInquisitor: true },
      );
      engine.game.currentPlayerIndex = 0;
      engine.game.turnPhase = TurnPhase.AwaitingAction;
      engine.game.treasuryReserve = 5;

      setCards(engine, 'p1', [Character.Captain, Character.Assassin]); // No Duke — truthful

      const coinsBefore = engine.game.getPlayer('p1')!.coins;
      const error = engine.handleEmbezzle('p1');
      expect(error).toBeNull();

      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      engine.handlePassChallenge('p4');

      expect(engine.game.getPlayer('p1')!.coins).toBe(coinsBefore + 5);
      expect(engine.game.treasuryReserve).toBe(0);
    });
  });

  describe('State change callback', () => {
    it('fires on every game action', () => {
      const states: GameState[] = [];
      const engine = createEngine(2);
      engine.setOnStateChange(state => states.push(state));

      const countBefore = states.length;
      engine.handleAction('p1', ActionType.Income);

      expect(states.length).toBeGreaterThan(countBefore);
    });

    it('includes winnerId when game ends', () => {
      const states: GameState[] = [];
      const engine = createEngine(2);
      engine.setOnStateChange(state => states.push(state));

      setCards(engine, 'p2', [Character.Duke, Character.Captain]);
      engine.game.getPlayer('p2')!.influences[0].revealed = true; // 1 alive

      engine.game.getPlayer('p1')!.coins = 7;
      engine.handleAction('p1', ActionType.Coup, 'p2');
      engine.handleChooseInfluenceLoss('p2', 1);

      // Should be game over
      expect(engine.game.status).toBe(GameStatus.Finished);
      const lastState = states[states.length - 1];
      expect(lastState.winnerId).toBe('p1');
    });
  });
});
