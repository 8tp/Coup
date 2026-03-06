import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { ActionType, Character, Faction, GameMode, TurnPhase } from '@/shared/types';

function createReformationEngine(playerCount = 4, useInquisitor = true): GameEngine {
  const engine = new GameEngine('TEST01');
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `p${i + 1}`, name: names[i] });
  }
  engine.startGame(players, { gameMode: GameMode.Reformation, useInquisitor });
  engine.game.currentPlayerIndex = 0;
  engine.game.turnPhase = TurnPhase.AwaitingAction;
  return engine;
}

function setCards(engine: GameEngine, playerId: string, cards: Character[]): void {
  const player = engine.game.getPlayer(playerId)!;
  player.influences = cards.map(c => ({ character: c, revealed: false }));
}

describe('Reformation Expansion', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  describe('Faction Assignment', () => {
    it('assigns alternating factions to players', () => {
      const engine = createReformationEngine(4);
      expect(engine.game.getPlayer('p1')!.faction).toBe(Faction.Loyalist);
      expect(engine.game.getPlayer('p2')!.faction).toBe(Faction.Reformist);
      expect(engine.game.getPlayer('p3')!.faction).toBe(Faction.Loyalist);
      expect(engine.game.getPlayer('p4')!.faction).toBe(Faction.Reformist);
    });

    it('does not assign factions in classic mode', () => {
      const engine = new GameEngine('TEST01');
      engine.startGame(
        [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
      );
      expect(engine.game.getPlayer('p1')!.faction).toBeUndefined();
    });
  });

  describe('Faction Targeting Restrictions', () => {
    it('prevents couping same-faction player', () => {
      const engine = createReformationEngine(4);
      // p1 is Loyalist, p3 is Loyalist — same faction
      engine.game.getPlayer('p1')!.coins = 7;
      const error = engine.handleAction('p1', ActionType.Coup, 'p3');
      expect(error).toContain('faction');
    });

    it('allows couping different-faction player', () => {
      const engine = createReformationEngine(4);
      // p1 is Loyalist, p2 is Reformist — different faction
      engine.game.getPlayer('p1')!.coins = 7;
      const error = engine.handleAction('p1', ActionType.Coup, 'p2');
      expect(error).toBeNull();
    });

    it('prevents assassinating same-faction player', () => {
      const engine = createReformationEngine(4);
      engine.game.getPlayer('p1')!.coins = 3;
      setCards(engine, 'p1', [Character.Assassin, Character.Duke]);
      const error = engine.handleAction('p1', ActionType.Assassinate, 'p3');
      expect(error).toContain('faction');
    });

    it('prevents stealing from same-faction player', () => {
      const engine = createReformationEngine(4);
      setCards(engine, 'p1', [Character.Captain, Character.Duke]);
      const error = engine.handleAction('p1', ActionType.Steal, 'p3');
      expect(error).toContain('faction');
    });

    it('allows targeting same-faction when all alive share same faction', () => {
      const engine = createReformationEngine(4);
      // Kill all Reformists (p2, p4)
      engine.game.getPlayer('p2')!.influences.forEach(i => { i.revealed = true; });
      engine.game.getPlayer('p4')!.influences.forEach(i => { i.revealed = true; });
      // Now only Loyalists remain — should be able to target each other
      engine.game.getPlayer('p1')!.coins = 7;
      const error = engine.handleAction('p1', ActionType.Coup, 'p3');
      expect(error).toBeNull();
    });
  });

  describe('Conversion', () => {
    it('self-converts and changes faction', () => {
      const engine = createReformationEngine(4);
      const p1 = engine.game.getPlayer('p1')!;
      expect(p1.faction).toBe(Faction.Loyalist);
      const coinsBefore = p1.coins;

      const error = engine.handleConvert('p1');
      expect(error).toBeNull();
      expect(p1.faction).toBe(Faction.Reformist);
      expect(p1.coins).toBe(coinsBefore - 1); // CONVERSION_SELF_COST = 1
      expect(engine.game.treasuryReserve).toBe(1);
    });

    it('converts another player and changes their faction', () => {
      const engine = createReformationEngine(4);
      const p1 = engine.game.getPlayer('p1')!;
      const p2 = engine.game.getPlayer('p2')!;
      p1.coins = 5;
      expect(p2.faction).toBe(Faction.Reformist);

      const error = engine.handleConvert('p1', 'p2');
      expect(error).toBeNull();
      expect(p2.faction).toBe(Faction.Loyalist);
      expect(p1.coins).toBe(3); // CONVERSION_OTHER_COST = 2
      expect(engine.game.treasuryReserve).toBe(2);
    });

    it('rejects conversion with insufficient coins', () => {
      const engine = createReformationEngine(4);
      engine.game.getPlayer('p1')!.coins = 0;
      const error = engine.handleConvert('p1');
      expect(error).toBeTruthy();
    });
  });

  describe('Treasury Reserve', () => {
    it('starts at zero', () => {
      const engine = createReformationEngine(4);
      expect(engine.game.treasuryReserve).toBe(0);
    });

    it('accumulates from conversions', () => {
      const engine = createReformationEngine(4);
      engine.handleConvert('p1'); // +1 to reserve
      engine.game.currentPlayerIndex = 1;
      engine.game.turnPhase = TurnPhase.AwaitingAction;
      engine.handleConvert('p2'); // +1 to reserve
      expect(engine.game.treasuryReserve).toBe(2);
    });
  });

  describe('Embezzlement', () => {
    it('takes all coins from treasury reserve when unchallenged', () => {
      const engine = createReformationEngine(4);
      engine.game.treasuryReserve = 5;
      const p1 = engine.game.getPlayer('p1')!;
      const coinsBefore = p1.coins;

      const error = engine.handleEmbezzle('p1');
      expect(error).toBeNull();

      // Embezzle enters challenge phase, pass all challenges
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      engine.handlePassChallenge('p4');

      expect(p1.coins).toBe(coinsBefore + 5);
      expect(engine.game.treasuryReserve).toBe(0);
    });

    it('inverse challenge succeeds when player HAS Duke', () => {
      const engine = createReformationEngine(4);
      engine.game.treasuryReserve = 5;
      setCards(engine, 'p1', [Character.Duke, Character.Captain]);

      engine.handleEmbezzle('p1');
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // Challenge: p1 has Duke, so challenge succeeds (inverse logic)
      const error = engine.handleChallenge('p2');
      expect(error).toBeNull();

      // p1 should lose an influence for lying about not having Duke
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      const state = engine.getFullState();
      expect(state.influenceLossRequest?.playerId).toBe('p1');
    });

    it('inverse challenge fails when player does NOT have Duke', () => {
      const engine = createReformationEngine(4);
      engine.game.treasuryReserve = 5;
      setCards(engine, 'p1', [Character.Captain, Character.Assassin]);

      engine.handleEmbezzle('p1');
      engine.handleChallenge('p2');

      // p2 loses for wrong challenge — p1 doesn't have Duke (honest embezzle)
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      const state = engine.getFullState();
      expect(state.influenceLossRequest?.playerId).toBe('p2');
    });
  });

  describe('Inquisitor / Deck Configuration', () => {
    it('uses Inquisitor instead of Ambassador in Reformation with useInquisitor', () => {
      const engine = createReformationEngine(4, true);
      const deckState = engine.game.deck;
      // Deck should contain Inquisitor cards, not Ambassador
      const allCards = [
        ...engine.game.players.flatMap(p => p.influences.map(i => i.character)),
        ...deckState.cards,
      ];
      expect(allCards).toContain(Character.Inquisitor);
      expect(allCards).not.toContain(Character.Ambassador);
    });

    it('uses Ambassador when useInquisitor is false', () => {
      const engine = createReformationEngine(4, false);
      const allCards = [
        ...engine.game.players.flatMap(p => p.influences.map(i => i.character)),
        ...engine.game.deck.cards,
      ];
      expect(allCards).toContain(Character.Ambassador);
      expect(allCards).not.toContain(Character.Inquisitor);
    });
  });

  describe('Examine Action', () => {
    it('enters examine flow and allows force swap', () => {
      const engine = createReformationEngine(4, true);
      setCards(engine, 'p1', [Character.Inquisitor, Character.Duke]);
      setCards(engine, 'p2', [Character.Captain, Character.Assassin]);

      // Examine p2
      const error = engine.handleAction('p1', ActionType.Examine, 'p2');
      expect(error).toBeNull();

      // Should enter challenge phase first
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // Pass all challenges
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      engine.handlePassChallenge('p4');

      // Should be in examine decision phase
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingExamineDecision);
      expect(engine.examineState).toBeTruthy();
      expect(engine.examineState!.targetId).toBe('p2');

      // Force swap
      const decError = engine.handleExamineDecision('p1', true);
      expect(decError).toBeNull();

      // Target's card should have been swapped
      const p2 = engine.game.getPlayer('p2')!;
      const originalCard = engine.examineState?.revealedCard;
      // After force swap, the card at that index should be different (drawn from deck)
      // We can't predict the exact card, but the turn should advance
      expect(engine.game.turnPhase).not.toBe(TurnPhase.AwaitingExamineDecision);
    });

    it('examine return does not change target cards', () => {
      const engine = createReformationEngine(4, true);
      setCards(engine, 'p1', [Character.Inquisitor, Character.Duke]);
      setCards(engine, 'p2', [Character.Captain, Character.Assassin]);

      engine.handleAction('p1', ActionType.Examine, 'p2');
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      engine.handlePassChallenge('p4');

      const p2CardsBefore = engine.game.getPlayer('p2')!.influences.map(i => i.character);

      engine.handleExamineDecision('p1', false); // Return

      const p2CardsAfter = engine.game.getPlayer('p2')!.influences.map(i => i.character);
      expect(p2CardsAfter).toEqual(p2CardsBefore);
    });

    it('prevents examining same-faction player', () => {
      const engine = createReformationEngine(4, true);
      setCards(engine, 'p1', [Character.Inquisitor, Character.Duke]);
      // p1 (Loyalist) examining p3 (Loyalist) — same faction
      const error = engine.handleAction('p1', ActionType.Examine, 'p3');
      expect(error).toContain('faction');
    });
  });

  describe('Inquisitor Exchange', () => {
    it('draws 1 card for Inquisitor exchange instead of 2', () => {
      const engine = createReformationEngine(4, true);
      setCards(engine, 'p1', [Character.Inquisitor, Character.Duke]);

      const error = engine.handleAction('p1', ActionType.Exchange);
      expect(error).toBeNull();

      // Pass challenges
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      engine.handlePassChallenge('p4');

      // Exchange state should have 1 drawn card (Inquisitor mode)
      const state = engine.getFullState();
      expect(state.exchangeState).toBeTruthy();
      expect(state.exchangeState!.drawnCards.length).toBe(1);
    });
  });
});
