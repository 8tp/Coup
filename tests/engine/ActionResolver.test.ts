import { describe, it, expect, beforeEach } from 'vitest';
import { ActionResolver, ResolverResult } from '@/engine/ActionResolver';
import { Game } from '@/engine/Game';
import { Character, ActionType, TurnPhase } from '@/shared/types';
import {
  FORCED_COUP_THRESHOLD,
  STARTING_COINS,
} from '@/shared/constants';

/** Helper: set up a 3-player game with known cards */
function setupGame(): Game {
  const game = new Game('TEST01');
  game.initialize([
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
    { id: 'p3', name: 'Charlie' },
  ]);
  game.currentPlayerIndex = 0; // Alice's turn
  game.turnPhase = TurnPhase.AwaitingAction;
  return game;
}

/** Helper: give specific cards to a player */
function setCards(game: Game, playerId: string, cards: Character[]): void {
  const player = game.getPlayer(playerId)!;
  player.influences = cards.map(c => ({ character: c, revealed: false }));
}

function isError(result: ResolverResult | { error: string }): result is { error: string } {
  return 'error' in result;
}

describe('ActionResolver', () => {
  let resolver: ActionResolver;
  let game: Game;

  beforeEach(() => {
    resolver = new ActionResolver();
    game = setupGame();
  });

  // ──────────────────────────────────────────────────
  // declareAction
  // ──────────────────────────────────────────────────

  describe('declareAction() - Income', () => {
    it('gives 1 coin and advances turn immediately', () => {
      const result = resolver.declareAction(game, 'p1', ActionType.Income);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.ActionResolved);
      expect(result.pendingAction).toBeNull();

      const giveEffect = result.sideEffects.find(e => e.type === 'give_coins');
      expect(giveEffect).toBeDefined();
      expect(giveEffect!.type === 'give_coins' && giveEffect!.amount).toBe(1);

      const advanceEffect = result.sideEffects.find(e => e.type === 'advance_turn');
      expect(advanceEffect).toBeDefined();
    });
  });

  describe('declareAction() - Foreign Aid', () => {
    it('goes to block phase (not challenge phase)', () => {
      const result = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingBlock);
      expect(result.pendingAction).toBeDefined();
      expect(result.pendingAction!.type).toBe(ActionType.ForeignAid);
      expect(result.challengeState).toBeNull();
    });
  });

  describe('declareAction() - Coup', () => {
    it('costs 7 coins and target must lose influence', () => {
      game.getPlayer('p1')!.coins = 10;
      const result = resolver.declareAction(game, 'p1', ActionType.Coup, 'p2');
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      expect(result.influenceLossRequest).toBeDefined();
      expect(result.influenceLossRequest!.playerId).toBe('p2');
      expect(result.influenceLossRequest!.reason).toBe('coup');

      const takeEffect = result.sideEffects.find(e => e.type === 'take_coins');
      expect(takeEffect).toBeDefined();
      expect(takeEffect!.type === 'take_coins' && takeEffect!.amount).toBe(7);
    });

    it('fails with insufficient coins', () => {
      game.getPlayer('p1')!.coins = 3;
      const result = resolver.declareAction(game, 'p1', ActionType.Coup, 'p2');
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Not enough coins');
      }
    });
  });

  describe('declareAction() - Tax (Duke claim)', () => {
    it('goes to challenge phase', () => {
      const result = resolver.declareAction(game, 'p1', ActionType.Tax);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingActionChallenge);
      expect(result.pendingAction!.type).toBe(ActionType.Tax);
      expect(result.pendingAction!.claimedCharacter).toBe(Character.Duke);
      expect(result.challengeState).toBeDefined();
      expect(result.challengeState!.claimedCharacter).toBe(Character.Duke);
    });
  });

  describe('declareAction() - Steal (Captain claim)', () => {
    it('goes to challenge phase with target', () => {
      game.getPlayer('p2')!.coins = 4;
      const result = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingActionChallenge);
      expect(result.pendingAction!.type).toBe(ActionType.Steal);
      expect(result.pendingAction!.targetId).toBe('p2');
      expect(result.pendingAction!.claimedCharacter).toBe(Character.Captain);
    });

    it('fails when target has 0 coins', () => {
      game.getPlayer('p2')!.coins = 0;
      const result = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('no coins');
      }
    });
  });

  describe('declareAction() - Assassinate (Assassin claim)', () => {
    it('costs 3 coins and goes to challenge phase', () => {
      game.getPlayer('p1')!.coins = 5;
      const result = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingActionChallenge);
      expect(result.pendingAction!.type).toBe(ActionType.Assassinate);
      expect(result.pendingAction!.claimedCharacter).toBe(Character.Assassin);

      const takeEffect = result.sideEffects.find(e => e.type === 'take_coins');
      expect(takeEffect).toBeDefined();
      expect(takeEffect!.type === 'take_coins' && takeEffect!.amount).toBe(3);
    });

    it('fails with insufficient coins', () => {
      game.getPlayer('p1')!.coins = 1;
      const result = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      expect(isError(result)).toBe(true);
    });
  });

  describe('declareAction() - Exchange (Ambassador claim)', () => {
    it('goes to challenge phase', () => {
      const result = resolver.declareAction(game, 'p1', ActionType.Exchange);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingActionChallenge);
      expect(result.pendingAction!.type).toBe(ActionType.Exchange);
      expect(result.pendingAction!.claimedCharacter).toBe(Character.Ambassador);
    });
  });

  describe('declareAction() - Forced coup at 10+ coins', () => {
    it('forces coup when player has 10+ coins', () => {
      game.getPlayer('p1')!.coins = FORCED_COUP_THRESHOLD;
      const result = resolver.declareAction(game, 'p1', ActionType.Tax);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('must Coup');
      }
    });

    it('allows coup when player has 10+ coins', () => {
      game.getPlayer('p1')!.coins = FORCED_COUP_THRESHOLD;
      const result = resolver.declareAction(game, 'p1', ActionType.Coup, 'p2');
      expect(isError(result)).toBe(false);
    });
  });

  describe('declareAction() - Validation', () => {
    it('cannot target yourself', () => {
      game.getPlayer('p1')!.coins = 10;
      const result = resolver.declareAction(game, 'p1', ActionType.Coup, 'p1');
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Cannot target yourself');
      }
    });

    it('cannot target dead player', () => {
      game.getPlayer('p1')!.coins = 10;
      game.getPlayer('p2')!.influences.forEach(inf => inf.revealed = true);
      const result = resolver.declareAction(game, 'p1', ActionType.Coup, 'p2');
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('eliminated');
      }
    });

    it('rejects if not the player turn', () => {
      const result = resolver.declareAction(game, 'p2', ActionType.Income);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Not your turn');
      }
    });

    it('rejects if not in AwaitingAction phase', () => {
      game.turnPhase = TurnPhase.AwaitingBlock;
      const result = resolver.declareAction(game, 'p1', ActionType.Income);
      expect(isError(result)).toBe(true);
    });

    it('rejects dead player', () => {
      game.getPlayer('p1')!.influences.forEach(inf => inf.revealed = true);
      const result = resolver.declareAction(game, 'p1', ActionType.Income);
      expect(isError(result)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────
  // challenge()
  // ──────────────────────────────────────────────────

  describe('challenge() - Challenge succeeds (actor lied)', () => {
    it('cancels action, refunds cost, challenged player must lose influence', () => {
      setCards(game, 'p1', [Character.Captain, Character.Contessa]);
      game.getPlayer('p1')!.coins = 5;

      // Alice claims Assassin to assassinate Bob, but she doesn't have Assassin
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      expect(isError(declareResult)).toBe(false);
      if (isError(declareResult)) return;

      // Apply cost side-effect manually so coins are correct for refund check
      game.takeCoins(game.getPlayer('p1')!, 3);

      const result = resolver.challenge(
        game,
        'p2',
        declareResult.pendingAction!,
        declareResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Action should be cancelled (pendingAction = null or AwaitingInfluenceLoss for the liar)
      // Refund cost
      const refund = result.sideEffects.find(
        e => e.type === 'give_coins' && e.type === 'give_coins' && (e as any).playerId === 'p1',
      );
      expect(refund).toBeDefined();

      // The challenged player (actor) must lose an influence
      expect(result.influenceLossRequest).toBeDefined();
      expect(result.influenceLossRequest!.playerId).toBe('p1');
      expect(result.influenceLossRequest!.reason).toBe('challenge_failed_defense');
    });
  });

  describe('challenge() - Challenge fails (actor has character)', () => {
    it('challenger loses influence, action proceeds', () => {
      setCards(game, 'p1', [Character.Duke, Character.Contessa]);

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      expect(isError(declareResult)).toBe(false);
      if (isError(declareResult)) return;

      const result = resolver.challenge(
        game,
        'p2',
        declareResult.pendingAction!,
        declareResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Challenger (p2) loses influence
      // Actor gets replacement card
      const replaceEffect = result.sideEffects.find(e => e.type === 'replace_influence');
      expect(replaceEffect).toBeDefined();
      if (replaceEffect && replaceEffect.type === 'replace_influence') {
        expect(replaceEffect.playerId).toBe('p1');
        expect(replaceEffect.oldCharacter).toBe(Character.Duke);
      }

      // The challenger should lose influence or we move to influence loss
      // If challenger has 2 influences, they must choose
      if (game.getPlayer('p2')!.aliveInfluenceCount > 1) {
        expect(result.influenceLossRequest).toBeDefined();
        expect(result.influenceLossRequest!.playerId).toBe('p2');
        expect(result.influenceLossRequest!.reason).toBe('challenge_lost');
      }
    });

    it('auto-reveals if challenger has only 1 influence', () => {
      setCards(game, 'p1', [Character.Duke, Character.Contessa]);
      // Give p2 only 1 unrevealed influence
      const p2 = game.getPlayer('p2')!;
      p2.influences = [
        { character: Character.Captain, revealed: true },
        { character: Character.Assassin, revealed: false },
      ];

      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      expect(isError(declareResult)).toBe(false);
      if (isError(declareResult)) return;

      const result = resolver.challenge(
        game,
        'p2',
        declareResult.pendingAction!,
        declareResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Should auto-reveal and eliminate, then proceed to block or resolve
      const revealEffect = result.sideEffects.find(
        e => e.type === 'reveal_influence' && (e as any).playerId === 'p2',
      );
      expect(revealEffect).toBeDefined();
    });
  });

  describe('challenge() - Validation', () => {
    it('cannot challenge own action', () => {
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      if (isError(declareResult)) return;
      const result = resolver.challenge(game, 'p1', declareResult.pendingAction!, declareResult.challengeState!);
      expect(isError(result)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────
  // block()
  // ──────────────────────────────────────────────────

  describe('block() - Valid block', () => {
    it('blocks with valid character, transitions to block challenge phase', () => {
      const declareResult = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      expect(isError(declareResult)).toBe(false);
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;

      const result = resolver.block(game, 'p2', Character.Duke, declareResult.pendingAction!);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingBlockChallenge);
      expect(result.pendingBlock).toBeDefined();
      expect(result.pendingBlock!.blockerId).toBe('p2');
      expect(result.pendingBlock!.claimedCharacter).toBe(Character.Duke);
    });
  });

  describe('block() - Invalid character', () => {
    it('rejects block with character that cannot block the action', () => {
      const declareResult = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      if (isError(declareResult)) return;

      const result = resolver.block(game, 'p2', Character.Captain, declareResult.pendingAction!);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('cannot block');
      }
    });
  });

  describe('block() - Only target can block assassination', () => {
    it('rejects non-target blocker for assassination', () => {
      game.getPlayer('p1')!.coins = 5;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;

      const result = resolver.block(game, 'p3', Character.Contessa, declareResult.pendingAction!);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Only the target');
      }
    });

    it('allows target to block assassination', () => {
      game.getPlayer('p1')!.coins = 5;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;

      const result = resolver.block(game, 'p2', Character.Contessa, declareResult.pendingAction!);
      expect(isError(result)).toBe(false);
    });
  });

  describe('block() - Only target can block steal', () => {
    it('rejects non-target blocker for steal', () => {
      game.getPlayer('p2')!.coins = 4;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;

      const result = resolver.block(game, 'p3', Character.Captain, declareResult.pendingAction!);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Only the target');
      }
    });

    it('allows target to block steal with Captain', () => {
      game.getPlayer('p2')!.coins = 4;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;

      const result = resolver.block(game, 'p2', Character.Captain, declareResult.pendingAction!);
      expect(isError(result)).toBe(false);
    });

    it('allows target to block steal with Ambassador', () => {
      game.getPlayer('p2')!.coins = 4;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;

      const result = resolver.block(game, 'p2', Character.Ambassador, declareResult.pendingAction!);
      expect(isError(result)).toBe(false);
    });
  });

  describe('block() - Cannot block own action', () => {
    it('rejects actor as blocker', () => {
      const declareResult = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      if (isError(declareResult)) return;

      const result = resolver.block(game, 'p1', Character.Duke, declareResult.pendingAction!);
      expect(isError(result)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────
  // challengeBlock()
  // ──────────────────────────────────────────────────

  describe('challengeBlock() - Block challenge succeeds (blocker lied)', () => {
    it('blocker loses influence, action proceeds', () => {
      setCards(game, 'p2', [Character.Captain, Character.Assassin]); // no Duke

      const declareResult = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;
      const blockResult = resolver.block(game, 'p2', Character.Duke, declareResult.pendingAction!);
      if (isError(blockResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      const result = resolver.challengeBlock(
        game,
        'p1',
        declareResult.pendingAction!,
        blockResult.pendingBlock!,
        blockResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Blocker must lose influence (or be auto-revealed)
      // The action should proceed (pendingAction kept or resolves)
      const logEffects = result.sideEffects.filter(e => e.type === 'log');
      const failLog = logEffects.find(e => e.type === 'log' && (e as any).message.includes('does NOT have'));
      expect(failLog).toBeDefined();
    });
  });

  describe('challengeBlock() - Block challenge fails (blocker has card)', () => {
    it('blocker keeps card, action is blocked, cost refunded', () => {
      setCards(game, 'p2', [Character.Duke, Character.Assassin]); // has Duke

      game.getPlayer('p1')!.coins = 5;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;
      const blockResult = resolver.block(game, 'p2', Character.Duke, declareResult.pendingAction!);
      if (isError(blockResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      const result = resolver.challengeBlock(
        game,
        'p1',
        declareResult.pendingAction!,
        blockResult.pendingBlock!,
        blockResult.challengeState!,
      );
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Block stands, challenger (actor p1) loses influence
      const logEffects = result.sideEffects.filter(e => e.type === 'log');
      const standLog = logEffects.find(e => e.type === 'log' && (e as any).message.includes('block stands'));
      expect(standLog).toBeDefined();

      // Blocker gets replacement
      const replaceEffect = result.sideEffects.find(e => e.type === 'replace_influence');
      expect(replaceEffect).toBeDefined();
    });

    it('only the original actor can challenge a block', () => {
      setCards(game, 'p2', [Character.Duke, Character.Assassin]);
      const declareResult = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      if (isError(declareResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlock;
      const blockResult = resolver.block(game, 'p2', Character.Duke, declareResult.pendingAction!);
      if (isError(blockResult)) return;

      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      const result = resolver.challengeBlock(
        game,
        'p3', // not the actor
        declareResult.pendingAction!,
        blockResult.pendingBlock!,
        blockResult.challengeState!,
      );
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Only the original actor');
      }
    });
  });

  // ──────────────────────────────────────────────────
  // allPassedChallenge()
  // ──────────────────────────────────────────────────

  describe('allPassedChallenge()', () => {
    it('transitions to block phase for blockable actions (Steal)', () => {
      game.getPlayer('p2')!.coins = 4;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
      if (isError(declareResult)) return;

      const result = resolver.allPassedChallenge(game, declareResult.pendingAction!);
      expect(result.newPhase).toBe(TurnPhase.AwaitingBlock);
    });

    it('transitions to block phase for blockable actions (Assassinate)', () => {
      game.getPlayer('p1')!.coins = 5;
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Assassinate, 'p2');
      if (isError(declareResult)) return;

      const result = resolver.allPassedChallenge(game, declareResult.pendingAction!);
      expect(result.newPhase).toBe(TurnPhase.AwaitingBlock);
    });

    it('resolves immediately for non-blockable challengeable actions (Tax)', () => {
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Tax);
      if (isError(declareResult)) return;

      const result = resolver.allPassedChallenge(game, declareResult.pendingAction!);
      // Tax resolves: give 3 coins and advance turn
      expect(result.newPhase).toBe(TurnPhase.ActionResolved);
      const giveEffect = result.sideEffects.find(e => e.type === 'give_coins');
      expect(giveEffect).toBeDefined();
      if (giveEffect && giveEffect.type === 'give_coins') {
        expect(giveEffect.amount).toBe(3);
      }
    });

    it('resolves to exchange for Exchange action', () => {
      const declareResult = resolver.declareAction(game, 'p1', ActionType.Exchange);
      if (isError(declareResult)) return;

      const result = resolver.allPassedChallenge(game, declareResult.pendingAction!);
      expect(result.newPhase).toBe(TurnPhase.AwaitingExchange);
      expect(result.exchangeState).toBeDefined();
      expect(result.exchangeState!.playerId).toBe('p1');
    });
  });

  // ──────────────────────────────────────────────────
  // allPassedBlock()
  // ──────────────────────────────────────────────────

  describe('allPassedBlock()', () => {
    it('resolves the action (Foreign Aid: +2 coins)', () => {
      const declareResult = resolver.declareAction(game, 'p1', ActionType.ForeignAid);
      if (isError(declareResult)) return;

      const result = resolver.allPassedBlock(game, declareResult.pendingAction!);
      expect(result.newPhase).toBe(TurnPhase.ActionResolved);
      const giveEffect = result.sideEffects.find(e => e.type === 'give_coins');
      expect(giveEffect).toBeDefined();
      if (giveEffect && giveEffect.type === 'give_coins') {
        expect(giveEffect.amount).toBe(2);
      }
    });

    it('resolves Steal: transfers up to 2 coins', () => {
      game.getPlayer('p2')!.coins = 1;
      const pendingAction = {
        type: ActionType.Steal,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Captain,
      };

      const result = resolver.allPassedBlock(game, pendingAction);
      expect(result.newPhase).toBe(TurnPhase.ActionResolved);
      const transferEffect = result.sideEffects.find(e => e.type === 'transfer_coins');
      expect(transferEffect).toBeDefined();
      if (transferEffect && transferEffect.type === 'transfer_coins') {
        expect(transferEffect.amount).toBe(1); // only 1 coin to steal
      }
    });

    it('resolves Assassinate: target must lose influence', () => {
      game.getPlayer('p1')!.coins = 5;
      const pendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      const result = resolver.allPassedBlock(game, pendingAction);
      // Target has 2 influences, must choose
      expect(result.newPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      expect(result.influenceLossRequest).toBeDefined();
      expect(result.influenceLossRequest!.playerId).toBe('p2');
      expect(result.influenceLossRequest!.reason).toBe('assassination');
    });
  });

  // ──────────────────────────────────────────────────
  // allPassedBlockChallenge()
  // ──────────────────────────────────────────────────

  describe('allPassedBlockChallenge()', () => {
    it('refunds cost and advances turn (block unchallenged)', () => {
      game.getPlayer('p1')!.coins = 5;
      const pendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      const result = resolver.allPassedBlockChallenge(game, pendingAction);
      expect(result.newPhase).toBe(TurnPhase.ActionResolved);

      const refund = result.sideEffects.find(
        e => e.type === 'give_coins' && (e as any).playerId === 'p1',
      );
      expect(refund).toBeDefined();
      if (refund && refund.type === 'give_coins') {
        expect(refund.amount).toBe(3);
      }

      const advanceEffect = result.sideEffects.find(e => e.type === 'advance_turn');
      expect(advanceEffect).toBeDefined();
    });

    it('no refund for zero-cost actions (ForeignAid block)', () => {
      const pendingAction = {
        type: ActionType.ForeignAid,
        actorId: 'p1',
      };

      const result = resolver.allPassedBlockChallenge(game, pendingAction);
      const refund = result.sideEffects.find(e => e.type === 'give_coins');
      expect(refund).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────
  // chooseInfluenceLoss()
  // ──────────────────────────────────────────────────

  describe('chooseInfluenceLoss()', () => {
    it('reveals selected influence for coup', () => {
      const request = { playerId: 'p2', reason: 'coup' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p2', 0, null, request);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      const revealEffect = result.sideEffects.find(e => e.type === 'reveal_influence');
      expect(revealEffect).toBeDefined();
      const advanceEffect = result.sideEffects.find(e => e.type === 'advance_turn');
      expect(advanceEffect).toBeDefined();
    });

    it('reveals selected influence for assassination', () => {
      const request = { playerId: 'p2', reason: 'assassination' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p2', 0, null, request);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      const advanceEffect = result.sideEffects.find(e => e.type === 'advance_turn');
      expect(advanceEffect).toBeDefined();
    });

    it('advances turn for challenge_failed_defense when action was cancelled (action challenge)', () => {
      const request = { playerId: 'p1', reason: 'challenge_failed_defense' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p1', 0, null, request);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      const advanceEffect = result.sideEffects.find(e => e.type === 'advance_turn');
      expect(advanceEffect).toBeDefined();
    });

    it('resolves action for challenge_failed_defense when pendingAction exists (block challenge)', () => {
      // Scenario: Player assassinates target, target claims Contessa to block,
      // assassin challenges block, target doesn't have Contessa → target loses
      // influence for failed bluff AND assassination proceeds
      game.getPlayer('p2')!.coins = 4;
      const pendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };
      const request = { playerId: 'p2', reason: 'challenge_failed_defense' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p2', 0, pendingAction, request);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      // Assassination should proceed — target must lose another influence
      expect(result.newPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      expect(result.influenceLossRequest?.playerId).toBe('p2');
      expect(result.influenceLossRequest?.reason).toBe('assassination');
    });

    it('proceeds to block phase for challenge_lost with blockable action', () => {
      game.getPlayer('p2')!.coins = 4;
      const pendingAction = {
        type: ActionType.Steal,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Captain,
      };
      const request = { playerId: 'p3', reason: 'challenge_lost' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p3', 0, pendingAction, request);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.AwaitingBlock);
    });

    it('rejects if not the right player', () => {
      const request = { playerId: 'p2', reason: 'coup' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p1', 0, null, request);
      expect(isError(result)).toBe(true);
    });

    it('rejects invalid influence index', () => {
      const request = { playerId: 'p2', reason: 'coup' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p2', 5, null, request);
      expect(isError(result)).toBe(true);
    });

    it('rejects already revealed influence', () => {
      game.getPlayer('p2')!.influences[0].revealed = true;
      const request = { playerId: 'p2', reason: 'coup' as const };
      const result = resolver.chooseInfluenceLoss(game, 'p2', 0, null, request);
      expect(isError(result)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────
  // chooseExchange()
  // ──────────────────────────────────────────────────

  describe('chooseExchange()', () => {
    it('validates keepCount matches alive influence count', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);
      const exchangeState = {
        playerId: 'p1',
        drawnCards: [Character.Assassin, Character.Contessa],
      };
      const pendingAction = {
        type: ActionType.Exchange,
        actorId: 'p1',
        claimedCharacter: Character.Ambassador,
      };

      // Must keep 2 (alive influence count), but trying to keep 1
      const result = resolver.chooseExchange(game, 'p1', [0], exchangeState, pendingAction);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Must keep exactly');
      }
    });

    it('validates indices are in range', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);
      const exchangeState = {
        playerId: 'p1',
        drawnCards: [Character.Assassin, Character.Contessa],
      };
      const pendingAction = {
        type: ActionType.Exchange,
        actorId: 'p1',
        claimedCharacter: Character.Ambassador,
      };

      const result = resolver.chooseExchange(game, 'p1', [0, 10], exchangeState, pendingAction);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Invalid card index');
      }
    });

    it('rejects duplicate indices', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);
      const exchangeState = {
        playerId: 'p1',
        drawnCards: [Character.Assassin, Character.Contessa],
      };
      const pendingAction = {
        type: ActionType.Exchange,
        actorId: 'p1',
        claimedCharacter: Character.Ambassador,
      };

      const result = resolver.chooseExchange(game, 'p1', [0, 0], exchangeState, pendingAction);
      expect(isError(result)).toBe(true);
      if (isError(result)) {
        expect(result.error).toContain('Duplicate');
      }
    });

    it('completes exchange with valid indices', () => {
      setCards(game, 'p1', [Character.Duke, Character.Captain]);
      const exchangeState = {
        playerId: 'p1',
        drawnCards: [Character.Assassin, Character.Contessa],
      };
      const pendingAction = {
        type: ActionType.Exchange,
        actorId: 'p1',
        claimedCharacter: Character.Ambassador,
      };

      // allCards = [Duke, Captain, Assassin, Contessa]; keep indices 2 and 3
      const result = resolver.chooseExchange(game, 'p1', [2, 3], exchangeState, pendingAction);
      expect(isError(result)).toBe(false);
      if (isError(result)) return;

      expect(result.newPhase).toBe(TurnPhase.ActionResolved);
      const advanceEffect = result.sideEffects.find(e => e.type === 'advance_turn');
      expect(advanceEffect).toBeDefined();

      // Player should now have Assassin and Contessa
      expect(game.getPlayer('p1')!.influences[0].character).toBe(Character.Assassin);
      expect(game.getPlayer('p1')!.influences[1].character).toBe(Character.Contessa);
    });

    it('rejects wrong player', () => {
      const exchangeState = {
        playerId: 'p1',
        drawnCards: [Character.Assassin, Character.Contessa],
      };
      const pendingAction = {
        type: ActionType.Exchange,
        actorId: 'p1',
        claimedCharacter: Character.Ambassador,
      };

      const result = resolver.chooseExchange(game, 'p2', [0, 1], exchangeState, pendingAction);
      expect(isError(result)).toBe(true);
    });
  });
});
