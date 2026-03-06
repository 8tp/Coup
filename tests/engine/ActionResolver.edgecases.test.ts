import { describe, it, expect, beforeEach } from 'vitest';
import { ActionResolver, ResolverResult } from '@/engine/ActionResolver';
import { Game } from '@/engine/Game';
import { Character, ActionType, TurnPhase } from '@/shared/types';
import { ASSASSINATE_COST, COUP_COST } from '@/shared/constants';

function setupGame(playerCount = 3): Game {
  const game = new Game('TEST01');
  const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
  const players = [];
  for (let i = 0; i < playerCount; i++) {
    players.push({ id: `p${i + 1}`, name: names[i] });
  }
  game.initialize(players);
  game.currentPlayerIndex = 0;
  game.turnPhase = TurnPhase.AwaitingAction;
  return game;
}

function setCards(game: Game, playerId: string, cards: Character[]): void {
  const player = game.getPlayer(playerId)!;
  player.influences = cards.map(c => ({ character: c, revealed: false }));
}

function isError(result: ResolverResult | { error: string }): result is { error: string } {
  return 'error' in result;
}

describe('ActionResolver — Edge Cases', () => {
  let resolver: ActionResolver;
  let game: Game;

  beforeEach(() => {
    resolver = new ActionResolver();
    game = setupGame();
  });

  // ─── Steal Edge Cases ───

  describe('Steal from player with 1 coin', () => {
    it('steals only 1 coin when target has 1 coin', () => {
      setCards(game, 'p1', [Character.Captain, Character.Duke]);
      game.getPlayer('p2')!.coins = 1;

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      expect(isError(declareResult)).toBe(false);
      if (isError(declareResult)) return;

      // All pass challenge → goes to block phase (Steal is blockable)
      const afterChallenge = resolver.allPassedChallenge(game, declareResult.pendingAction!);
      expect(afterChallenge.newPhase).toBe(TurnPhase.AwaitingBlock);

      // All pass block → action resolves
      const afterBlock = resolver.allPassedBlock(game, afterChallenge.pendingAction!);
      expect(afterBlock.newPhase).toBe(TurnPhase.ActionResolved);

      const transferEffect = afterBlock.sideEffects.find(
        (e: any) => e.type === 'transfer_coins'
      );
      expect(transferEffect).toBeDefined();
      if (transferEffect && 'amount' in transferEffect) {
        expect((transferEffect as any).amount).toBeLessThanOrEqual(1);
      }
    });

    it('rejects steal when target has 0 coins', () => {
      setCards(game, 'p1', [Character.Captain, Character.Duke]);
      game.getPlayer('p2')!.coins = 0;

      const result = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      expect(isError(result)).toBe(true);
    });
  });

  // ─── Exchange with 1 Influence ───

  describe('Exchange with 1 influence', () => {
    it('handles exchange when player has only 1 alive influence', () => {
      setCards(game, 'p1', [Character.Ambassador, Character.Duke]);
      game.getPlayer('p1')!.influences[1].revealed = true;

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Exchange);
      expect(isError(declareResult)).toBe(false);
      if (isError(declareResult)) return;

      // All pass challenge → exchange resolves
      const afterChallenge = resolver.allPassedChallenge(game, declareResult.pendingAction!);

      // Exchange state should exist
      expect(afterChallenge.exchangeState).toBeTruthy();

      // Player should only keep 1 card
      const keepResult = resolver.chooseExchange(
        game, 'p1', [0], afterChallenge.exchangeState!, afterChallenge.pendingAction!,
      );
      expect(isError(keepResult)).toBe(false);
    });

    it('rejects keeping wrong number of cards', () => {
      setCards(game, 'p1', [Character.Ambassador, Character.Duke]);
      game.getPlayer('p1')!.influences[1].revealed = true;

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Exchange);
      if (isError(declareResult)) return;

      const afterChallenge = resolver.allPassedChallenge(game, declareResult.pendingAction!);

      // Try to keep 2 cards when only 1 influence alive
      const result = resolver.chooseExchange(
        game, 'p1', [0, 1], afterChallenge.exchangeState!, afterChallenge.pendingAction!,
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('1');
      }
    });
  });

  // ─── Deck Exhaustion ───

  describe('Deck exhaustion during exchange', () => {
    it('resolves gracefully when deck is empty during exchange', () => {
      setCards(game, 'p1', [Character.Ambassador, Character.Duke]);

      // Empty the deck
      while (game.deck.size > 0) {
        game.deck.draw();
      }
      expect(game.deck.size).toBe(0);

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Exchange);
      if (isError(declareResult)) return;

      const afterChallenge = resolver.allPassedChallenge(game, declareResult.pendingAction!);

      // Should resolve immediately instead of entering exchange (no cards to draw)
      expect(afterChallenge.newPhase).toBe(TurnPhase.ActionResolved);
      const logEffect = afterChallenge.sideEffects.find(
        (e: any) => e.type === 'log' && e.message.toLowerCase().includes('deck')
      );
      expect(logEffect).toBeDefined();
    });
  });

  // ─── Challenge on Truthful Claim ───

  describe('Challenge on truthful claim', () => {
    it('challenger loses influence when challenging truthful Tax', () => {
      setCards(game, 'p1', [Character.Duke, Character.Contessa]);
      setCards(game, 'p2', [Character.Captain, Character.Assassin]);

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      if (isError(declareResult)) return;

      const result = resolver.challenge(
        game, 'p2', declareResult.pendingAction!, declareResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Challenger (p2) has 2 influences, so they must choose which to lose
      expect(result.influenceLossRequest).toBeDefined();
      expect(result.influenceLossRequest!.playerId).toBe('p2');
      expect(result.newPhase).toBe(TurnPhase.AwaitingInfluenceLoss);

      // Actor gets replacement card
      const replaceEffect = result.sideEffects.find(
        (e: any) => e.type === 'replace_influence' && e.playerId === 'p1'
      );
      expect(replaceEffect).toBeDefined();
    });

    it('auto-reveals challenger influence when they have only 1 left', () => {
      setCards(game, 'p1', [Character.Duke, Character.Contessa]);
      setCards(game, 'p2', [Character.Captain, Character.Assassin]);
      game.getPlayer('p2')!.influences[0].revealed = true; // Only 1 influence left

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      if (isError(declareResult)) return;

      const result = resolver.challenge(
        game, 'p2', declareResult.pendingAction!, declareResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // With only 1 influence, auto-reveal happens
      const revealEffect = result.sideEffects.find(
        (e: any) => e.type === 'reveal_influence' && e.playerId === 'p2'
      );
      expect(revealEffect).toBeDefined();
    });
  });

  // ─── Challenge on Bluff ───

  describe('Challenge on bluff', () => {
    it('actor loses influence when caught bluffing Assassinate', () => {
      setCards(game, 'p1', [Character.Captain, Character.Contessa]);
      game.getPlayer('p1')!.coins = 5;

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      if (isError(declareResult)) return;

      const result = resolver.challenge(
        game, 'p2', declareResult.pendingAction!, declareResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Actor should lose influence (challenge succeeded)
      expect(result.influenceLossRequest).toBeDefined();
      expect(result.influenceLossRequest!.playerId).toBe('p1');

      // Cost should be refunded
      const refund = result.sideEffects.find(
        (e: any) => e.type === 'give_coins' && e.playerId === 'p1'
      );
      expect(refund).toBeDefined();
    });
  });

  // ─── Multiple Players Passing Challenge ───

  describe('Multiple challenge passes', () => {
    it('resolves action when all eligible players pass via allPassedChallenge', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      if (isError(declareResult)) return;

      expect(declareResult.newPhase).toBe(TurnPhase.AwaitingActionChallenge);

      // Tax has no block — allPassedChallenge should resolve action
      const result = resolver.allPassedChallenge(game, declareResult.pendingAction!);
      expect(result.newPhase).toBe(TurnPhase.ActionResolved);
    });

    it('actor cannot challenge their own action', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      if (isError(declareResult)) return;

      const result = resolver.challenge(
        game, 'p1', declareResult.pendingAction!, declareResult.challengeState!,
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('own action');
      }
    });
  });

  // ─── Assassination + Contessa Block ───

  describe('Assassination blocked by Contessa', () => {
    it('full flow: assassinate -> pass challenge -> block with Contessa -> pass block challenge -> action cancelled', () => {
      setCards(game, 'p1', [Character.Assassin, Character.Duke]);
      setCards(game, 'p2', [Character.Contessa, Character.Captain]);
      game.getPlayer('p1')!.coins = 5;

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      if (isError(declareResult)) return;

      // All pass challenge
      const afterChallenge = resolver.allPassedChallenge(game, declareResult.pendingAction!);
      expect(afterChallenge.newPhase).toBe(TurnPhase.AwaitingBlock);

      // p2 blocks with Contessa
      const blockResult = resolver.block(
        game, 'p2', Character.Contessa, afterChallenge.pendingAction!,
      );
      expect(isError(blockResult)).toBe(false);
      if (isError(blockResult)) return;

      expect(blockResult.newPhase).toBe(TurnPhase.AwaitingBlockChallenge);

      // All pass block challenge — block stands, action cancelled
      const passBlock = resolver.allPassedBlockChallenge(game, blockResult.pendingAction!);
      expect(passBlock.newPhase).toBe(TurnPhase.ActionResolved);
    });
  });

  // ─── Influence Loss Selection ───

  describe('Influence loss', () => {
    it('allows choosing which influence to lose', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);

      const result = resolver.chooseInfluenceLoss(
        game, 'p1', 0, null, { playerId: 'p1', reason: 'coup' },
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      const revealEffect = result.sideEffects.find(
        (e: any) => e.type === 'reveal_influence' && e.playerId === 'p1' && e.influenceIndex === 0
      );
      expect(revealEffect).toBeDefined();
    });

    it('rejects invalid influence index', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);

      const result = resolver.chooseInfluenceLoss(
        game, 'p1', 2, null, { playerId: 'p1', reason: 'coup' },
      );
      expect(isError(result)).toBe(true);
    });

    it('rejects revealing already-revealed influence', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);
      game.getPlayer('p1')!.influences[0].revealed = true;

      const result = resolver.chooseInfluenceLoss(
        game, 'p1', 0, null, { playerId: 'p1', reason: 'coup' },
      );
      expect(isError(result)).toBe(true);
    });
  });

  // ─── 2-Player Endgame ───

  describe('2-player endgame', () => {
    it('game ends when player loses last influence', () => {
      const game = setupGame(2);
      setCards(game, 'p1', [Character.Duke, Character.Captain]);
      setCards(game, 'p2', [Character.Assassin, Character.Contessa]);

      // Reveal one of p2's cards first
      game.getPlayer('p2')!.influences[0].revealed = true;

      // p1 coups p2
      game.getPlayer('p1')!.coins = COUP_COST;
      const result = resolver.declareAction(game, 'p1', ActionType.Coup, 'p2');
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // p2 must lose their last influence
      expect(result.influenceLossRequest).toBeDefined();
      expect(result.influenceLossRequest!.playerId).toBe('p2');

      // Choose to lose their remaining card
      const lossResult = resolver.chooseInfluenceLoss(
        game, 'p2', 1, result.pendingAction ?? null, result.influenceLossRequest!,
      );
      expect(isError(lossResult)).toBe(false);
      if (isError(lossResult)) return;

      // Should have eliminate check and win check
      const eliminateCheck = lossResult.sideEffects.find((e: any) => e.type === 'eliminate_check');
      expect(eliminateCheck).toBeDefined();
    });
  });
});
