import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BotBrain, BotDecision } from '@/engine/BotBrain';
import { Game } from '@/engine/Game';
import { Player } from '@/engine/Player';
import {
  ActionType,
  BotDifficulty,
  Character,
  TurnPhase,
  PendingAction,
  PendingBlock,
  ChallengeState,
  InfluenceLossRequest,
  ExchangeState,
} from '@/shared/types';

// ─── Helpers ───

function createGame(playerCount = 3): Game {
  const game = new Game('TEST01');
  const names = ['Alice', 'Bot1', 'Charlie', 'Diana', 'Eve', 'Frank'];
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

function revealCard(game: Game, playerId: string, index: number): void {
  const player = game.getPlayer(playerId)!;
  player.influences[index].revealed = true;
}

function decide(
  game: Game,
  botId: string,
  difficulty: BotDifficulty,
  overrides?: {
    pendingAction?: PendingAction | null;
    pendingBlock?: PendingBlock | null;
    challengeState?: ChallengeState | null;
    influenceLossRequest?: InfluenceLossRequest | null;
    exchangeState?: ExchangeState | null;
    blockPassedPlayerIds?: string[];
  },
): BotDecision | null {
  return BotBrain.decide(
    game,
    botId,
    difficulty,
    overrides?.pendingAction ?? null,
    overrides?.pendingBlock ?? null,
    overrides?.challengeState ?? null,
    overrides?.influenceLossRequest ?? null,
    overrides?.exchangeState ?? null,
    overrides?.blockPassedPlayerIds ?? [],
  );
}

describe('BotBrain', () => {

  describe('decide() routing', () => {
    it('returns null when bot is not alive', () => {
      const game = createGame();
      const bot = game.getPlayer('p2')!;
      bot.influences[0].revealed = true;
      bot.influences[1].revealed = true;

      const result = decide(game, 'p2', 'medium');
      expect(result).toBeNull();
    });

    it('returns null when bot is not the current player in AwaitingAction', () => {
      const game = createGame();
      game.currentPlayerIndex = 0; // p1's turn
      const result = decide(game, 'p2', 'medium');
      expect(result).toBeNull();
    });

    it('returns an action when bot is the current player in AwaitingAction', () => {
      const game = createGame();
      game.currentPlayerIndex = 1; // p2's turn (bot)
      const result = decide(game, 'p2', 'medium');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('action');
    });

    it('returns null for GameOver phase', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.GameOver;
      const result = decide(game, 'p2', 'medium');
      expect(result).toBeNull();
    });

    it('returns null for ActionResolved phase', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.ActionResolved;
      const result = decide(game, 'p2', 'medium');
      expect(result).toBeNull();
    });
  });

  // ─── Action Selection: All tiers ───

  describe('decideAction() — all tiers', () => {
    it('must coup at 10+ coins (all tiers)', () => {
      for (const diff of ['easy', 'medium', 'hard'] as BotDifficulty[]) {
        const game = createGame();
        game.currentPlayerIndex = 1;
        game.getPlayer('p2')!.coins = 10;
        setCards(game, 'p2', [Character.Duke, Character.Captain]);

        const result = decide(game, 'p2', diff);
        expect(result).not.toBeNull();
        expect(result!.type).toBe('action');
        if (result!.type === 'action') {
          expect(result!.action).toBe(ActionType.Coup);
          expect(result!.targetId).toBeDefined();
          expect(result!.targetId).not.toBe('p2');
        }
      }
    });

    it('always returns a valid action type', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;

      for (let i = 0; i < 50; i++) {
        for (const diff of ['easy', 'medium', 'hard'] as BotDifficulty[]) {
          const result = decide(game, 'p2', diff);
          expect(result).not.toBeNull();
          expect(result!.type).toBe('action');
          if (result!.type === 'action') {
            expect(Object.values(ActionType)).toContain(result!.action);
          }
        }
      }
    });

    it('does not assassinate without enough coins', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 2;
      setCards(game, 'p2', [Character.Assassin, Character.Assassin]);

      for (let i = 0; i < 100; i++) {
        for (const diff of ['easy', 'medium', 'hard'] as BotDifficulty[]) {
          const result = decide(game, 'p2', diff);
          if (result?.type === 'action') {
            expect(result.action).not.toBe(ActionType.Assassinate);
          }
        }
      }
    });

    it('never targets self', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;

      for (let i = 0; i < 100; i++) {
        for (const diff of ['easy', 'medium', 'hard'] as BotDifficulty[]) {
          const result = decide(game, 'p2', diff);
          if (result?.type === 'action' && result.targetId) {
            expect(result.targetId).not.toBe('p2');
          }
        }
      }
    });
  });

  // ─── Easy Bot Actions ───

  describe('decideAction() — easy', () => {
    it('never bluffs actions it does not have cards for', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);
      game.getPlayer('p2')!.coins = 2;

      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', 'easy');
        if (result?.type === 'action') {
          // Contessa has no action, so should only pick Income or ForeignAid
          expect([ActionType.Income, ActionType.ForeignAid]).toContain(result.action);
        }
      }
    });

    it('plays Tax when has Duke', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Duke, Character.Contessa]);

      let taxCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', 'easy');
        if (result?.type === 'action' && result.action === ActionType.Tax) {
          taxCount++;
        }
      }
      expect(taxCount).toBeGreaterThan(30);
    });
  });

  // ─── Medium Bot Actions ───

  describe('decideAction() — medium', () => {
    it('sometimes bluffs actions (~30% chance)', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);
      game.getPlayer('p2')!.coins = 2;

      let bluffCount = 0;
      for (let i = 0; i < 300; i++) {
        const result = decide(game, 'p2', 'medium');
        if (result?.type === 'action') {
          if ([ActionType.Tax, ActionType.Steal, ActionType.Exchange].includes(result.action)) {
            bluffCount++;
          }
        }
      }
      // Should bluff sometimes but not always
      expect(bluffCount).toBeGreaterThan(10);
      expect(bluffCount).toBeLessThan(280);
    });
  });

  // ─── Hard Bot Actions ───

  describe('decideAction() — hard', () => {
    it('prefers Tax and Steal when it has those cards', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      game.getPlayer('p1')!.coins = 5;
      game.getPlayer('p3')!.coins = 5;

      let taxOrStealCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', 'hard');
        if (result?.type === 'action' && [ActionType.Tax, ActionType.Steal].includes(result.action)) {
          taxOrStealCount++;
        }
      }
      expect(taxOrStealCount).toBeGreaterThan(120);
    });

    it('targets the highest-coin player', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;
      game.getPlayer('p1')!.coins = 2;
      game.getPlayer('p3')!.coins = 8;

      let targettedP3 = 0;
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'hard');
        if (result?.type === 'action' && result.action === ActionType.Coup) {
          if (result.targetId === 'p3') targettedP3++;
        }
      }
      // Hard bot should always target p3 (most coins)
      expect(targettedP3).toBeGreaterThan(70);
    });

    it('prefers Steal in 1v1', () => {
      const game = createGame(2);
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Captain, Character.Duke]);
      game.getPlayer('p1')!.coins = 3;
      game.getPlayer('p2')!.coins = 2;

      let stealCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', 'hard');
        if (result?.type === 'action' && result.action === ActionType.Steal) {
          stealCount++;
        }
      }
      expect(stealCount).toBeGreaterThan(60);
    });

    it('avoids bluffing characters with 2+ revealed', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);
      game.getPlayer('p2')!.coins = 2;

      // Reveal 2 Dukes on other players
      setCards(game, 'p1', [Character.Duke, Character.Duke]);
      game.getPlayer('p1')!.influences[0].revealed = true;
      game.getPlayer('p1')!.influences[1].revealed = true;

      // Hard bot should not bluff Tax (Duke) since 2 Dukes are revealed
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'hard');
        if (result?.type === 'action') {
          expect(result.action).not.toBe(ActionType.Tax);
        }
      }
    });
  });

  // ─── Challenge Decisions ───

  describe('decideActionChallenge()', () => {
    const makePendingTax = (actorId: string): PendingAction => ({
      type: ActionType.Tax,
      actorId,
      claimedCharacter: Character.Duke,
    });

    const makeChallengeState = (actorId: string): ChallengeState => ({
      challengerId: '',
      challengedPlayerId: actorId,
      claimedCharacter: Character.Duke,
      passedPlayerIds: [actorId],
    });

    it('returns null when bot is the actor', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      const result = decide(game, 'p1', 'hard', {
        pendingAction: makePendingTax('p1'),
        challengeState: makeChallengeState('p1'),
      });
      expect(result).toBeNull();
    });

    it('returns null when bot already passed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      const cs = makeChallengeState('p1');
      cs.passedPlayerIds.push('p2');
      const result = decide(game, 'p2', 'hard', {
        pendingAction: makePendingTax('p1'),
        challengeState: cs,
      });
      expect(result).toBeNull();
    });

    it('easy bot never challenges', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Duke, Character.Duke]); // Bot holds both Dukes!

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'easy', {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        expect(result).not.toBeNull();
        expect(result!.type).toBe('pass_challenge');
      }
    });

    it('medium bot challenges sometimes (~20%)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', 'medium', {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        if (result?.type === 'challenge') challengeCount++;
      }
      expect(challengeCount).toBeGreaterThan(50);
      expect(challengeCount).toBeLessThan(300);
    });

    it('hard bot challenges at 100% when all copies revealed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      // Reveal all 3 Dukes across players
      setCards(game, 'p1', [Character.Duke, Character.Duke]);
      game.getPlayer('p1')!.influences[0].revealed = true;
      game.getPlayer('p1')!.influences[1].revealed = true;
      setCards(game, 'p3', [Character.Duke, Character.Contessa]);
      game.getPlayer('p3')!.influences[0].revealed = true;

      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', 'hard', {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        expect(result!.type).toBe('challenge');
      }
    });

    it('hard bot never challenges assassination when it has 2 influences', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Duke, Character.Captain]); // 2 alive influences

      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };
      const cs: ChallengeState = {
        challengerId: '',
        challengedPlayerId: 'p1',
        claimedCharacter: Character.Assassin,
        passedPlayerIds: ['p1'],
      };

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'hard', {
          pendingAction,
          challengeState: cs,
        });
        expect(result!.type).toBe('pass_challenge');
      }
    });

    it('hard bot challenges much less on early turns (turn 1-2)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      // Bot holds one Duke — normally 40% challenge rate, but early game should dampen to ~12%
      setCards(game, 'p2', [Character.Duke, Character.Captain]);

      // Turn 1 (early game, 0.3x multiplier)
      game.turnNumber = 1;
      let earlyChallenge = 0;
      for (let i = 0; i < 1000; i++) {
        const result = decide(game, 'p2', 'hard', {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        if (result?.type === 'challenge') earlyChallenge++;
      }

      // Turn 10 (late game, 1.0x multiplier)
      game.turnNumber = 10;
      let lateChallenge = 0;
      for (let i = 0; i < 1000; i++) {
        const result = decide(game, 'p2', 'hard', {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        if (result?.type === 'challenge') lateChallenge++;
      }

      // Early game should have significantly fewer challenges than late game
      expect(earlyChallenge).toBeLessThan(lateChallenge);
      // Early game rate should be roughly 0.3x of late game rate (allow tolerance)
      expect(earlyChallenge).toBeLessThan(lateChallenge * 0.5);
    });

    it('hard bot still challenges at 100% when all copies accounted for, even early game', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      game.turnNumber = 1; // Early game
      setCards(game, 'p2', [Character.Duke, Character.Duke]);

      // Reveal 1 more Duke (bot has 2 + 1 revealed = 3 = all copies)
      setCards(game, 'p3', [Character.Duke, Character.Contessa]);
      game.getPlayer('p3')!.influences[0].revealed = true;

      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', 'hard', {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        expect(result!.type).toBe('challenge');
      }
    });

    it('prefers passing challenge when bot can block with a card it holds', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Captain]);
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };
      const cs: ChallengeState = {
        challengerId: '',
        challengedPlayerId: 'p1',
        claimedCharacter: Character.Assassin,
        passedPlayerIds: ['p1'],
      };

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'hard', {
          pendingAction,
          challengeState: cs,
        });
        expect(result!.type).toBe('pass_challenge');
      }
    });
  });

  // ─── Block Decisions ───

  describe('decideBlock()', () => {
    it('returns null when bot is the actor', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      const pendingAction: PendingAction = {
        type: ActionType.ForeignAid,
        actorId: 'p2',
      };
      const result = decide(game, 'p2', 'medium', { pendingAction, blockPassedPlayerIds: [] });
      expect(result).toBeNull();
    });

    it('passes block for non-blockable actions', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      const pendingAction: PendingAction = {
        type: ActionType.Tax,
        actorId: 'p1',
        claimedCharacter: Character.Duke,
      };
      const result = decide(game, 'p2', 'medium', { pendingAction, blockPassedPlayerIds: [] });
      expect(result!.type).toBe('pass_block');
    });

    it('all tiers always block when holding the right card and targeted', () => {
      for (const diff of ['easy', 'medium', 'hard'] as BotDifficulty[]) {
        const game = createGame();
        game.turnPhase = TurnPhase.AwaitingBlock;
        setCards(game, 'p2', [Character.Contessa, Character.Captain]);
        const pendingAction: PendingAction = {
          type: ActionType.Assassinate,
          actorId: 'p1',
          targetId: 'p2',
          claimedCharacter: Character.Assassin,
        };

        for (let i = 0; i < 20; i++) {
          const result = decide(game, 'p2', diff, { pendingAction, blockPassedPlayerIds: [] });
          expect(result!.type).toBe('block');
          if (result!.type === 'block') {
            expect(result!.character).toBe(Character.Contessa);
          }
        }
      }
    });

    it('easy bot never bluff-blocks', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p2', [Character.Duke, Character.Duke]); // No Contessa
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'easy', { pendingAction, blockPassedPlayerIds: [] });
        expect(result!.type).toBe('pass_block');
      }
    });

    it('medium bot sometimes bluff-blocks Contessa vs assassination (~50%)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p2', [Character.Duke, Character.Duke]); // No Contessa
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      let blockCount = 0;
      for (let i = 0; i < 300; i++) {
        const result = decide(game, 'p2', 'medium', { pendingAction, blockPassedPlayerIds: [] });
        if (result?.type === 'block') blockCount++;
      }
      expect(blockCount).toBeGreaterThan(80);
      expect(blockCount).toBeLessThan(250);
    });

    it('hard bot almost always bluff-blocks Contessa vs assassination', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p2', [Character.Duke, Character.Duke]); // No Contessa
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      let blockCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', 'hard', { pendingAction, blockPassedPlayerIds: [] });
        if (result?.type === 'block') {
          expect(result!.character).toBe(Character.Contessa);
          blockCount++;
        }
      }
      // With 2 influences, bluffs Contessa ~95% of the time
      expect(blockCount).toBeGreaterThan(150);
    });

    it('non-target cannot block assassination', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p3', [Character.Contessa, Character.Captain]);
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      const result = decide(game, 'p3', 'hard', { pendingAction, blockPassedPlayerIds: [] });
      expect(result!.type).toBe('pass_block');
    });
  });

  // ─── Block Challenge Decisions ───

  describe('decideBlockChallenge()', () => {
    const makePendingSteal = (): PendingAction => ({
      type: ActionType.Steal,
      actorId: 'p2',
      targetId: 'p1',
      claimedCharacter: Character.Captain,
    });

    const makePendingBlock = (): PendingBlock => ({
      blockerId: 'p1',
      claimedCharacter: Character.Captain,
    });

    const makeBlockChallengeState = (): ChallengeState => ({
      challengerId: '',
      challengedPlayerId: 'p1',
      claimedCharacter: Character.Captain,
      passedPlayerIds: ['p1'],
    });

    it('easy bot never challenges blocks', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      setCards(game, 'p2', [Character.Captain, Character.Captain]);

      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', 'easy', {
          pendingAction: makePendingSteal(),
          pendingBlock: makePendingBlock(),
          challengeState: makeBlockChallengeState(),
        });
        expect(result!.type).toBe('pass_challenge_block');
      }
    });

    it('medium bot sometimes challenges blocks', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', 'medium', {
          pendingAction: makePendingSteal(),
          pendingBlock: makePendingBlock(),
          challengeState: makeBlockChallengeState(),
        });
        if (result?.type === 'challenge_block') challengeCount++;
      }
      expect(challengeCount).toBeGreaterThan(30);
      expect(challengeCount).toBeLessThan(300);
    });

    it('hard bot challenges block when all copies revealed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      setCards(game, 'p2', [Character.Captain, Character.Contessa]);

      // Reveal 2 more Captains (bot has 1, so 3 total accounted for)
      setCards(game, 'p3', [Character.Captain, Character.Captain]);
      game.getPlayer('p3')!.influences[0].revealed = true;
      game.getPlayer('p3')!.influences[1].revealed = true;

      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', 'hard', {
          pendingAction: makePendingSteal(),
          pendingBlock: makePendingBlock(),
          challengeState: makeBlockChallengeState(),
        });
        expect(result!.type).toBe('challenge_block');
      }
    });
  });

  // ─── Influence Loss Decisions ───

  describe('decideInfluenceLoss()', () => {
    it('loses the only unrevealed card when only one remains', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      const bot = game.getPlayer('p2')!;
      bot.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Captain, revealed: false },
      ];

      for (const diff of ['easy', 'medium', 'hard'] as BotDifficulty[]) {
        const result = decide(game, 'p2', diff, {
          influenceLossRequest: { playerId: 'p2', reason: 'coup' },
        });
        expect(result!.type).toBe('choose_influence_loss');
        if (result!.type === 'choose_influence_loss') {
          expect(result!.influenceIndex).toBe(1);
        }
      }
    });

    it('easy bot picks randomly (both cards get chosen across many runs)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      setCards(game, 'p2', [Character.Duke, Character.Contessa]);

      const indices = new Set<number>();
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'easy', {
          influenceLossRequest: { playerId: 'p2', reason: 'coup' },
        });
        if (result!.type === 'choose_influence_loss') {
          indices.add(result!.influenceIndex);
        }
      }
      // Random should pick both indices across many runs
      expect(indices.size).toBe(2);
    });

    it('medium bot loses static lowest-value card', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      // Duke (5) vs Contessa (1) — should lose Contessa
      setCards(game, 'p2', [Character.Duke, Character.Contessa]);

      const result = decide(game, 'p2', 'medium', {
        influenceLossRequest: { playerId: 'p2', reason: 'coup' },
      });
      expect(result!.type).toBe('choose_influence_loss');
      if (result!.type === 'choose_influence_loss') {
        expect(result!.influenceIndex).toBe(1); // Contessa
      }
    });

    it('hard bot uses dynamic card value (keeps Contessa when opponents have 3+ coins)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      // Contessa vs Ambassador — normally Contessa (2) ≈ Ambassador (2)
      // But if opponents have 3+ coins, Contessa value rises
      setCards(game, 'p2', [Character.Contessa, Character.Ambassador]);
      game.getPlayer('p1')!.coins = 5; // Assassination threat
      game.getPlayer('p3')!.coins = 4;

      const result = decide(game, 'p2', 'hard', {
        influenceLossRequest: { playerId: 'p2', reason: 'coup' },
      });
      expect(result!.type).toBe('choose_influence_loss');
      if (result!.type === 'choose_influence_loss') {
        // Should lose Ambassador (lower dynamic value), keep Contessa
        expect(result!.influenceIndex).toBe(1); // Ambassador
      }
    });

    it('returns null when influence loss is for a different player', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      const result = decide(game, 'p2', 'medium', {
        influenceLossRequest: { playerId: 'p1', reason: 'coup' },
      });
      expect(result).toBeNull();
    });
  });

  // ─── Exchange Decisions ───

  describe('decideExchange()', () => {
    it('easy bot picks random cards', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      setCards(game, 'p2', [Character.Contessa, Character.Ambassador]);

      const exchangeState: ExchangeState = {
        playerId: 'p2',
        drawnCards: [Character.Duke, Character.Assassin],
      };

      // Over many runs, random picks should vary
      const picks = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', 'easy', { exchangeState });
        if (result!.type === 'choose_exchange') {
          picks.add(JSON.stringify(result!.keepIndices.sort()));
        }
      }
      // Should have multiple different picks
      expect(picks.size).toBeGreaterThan(1);
    });

    it('medium bot keeps highest static-value cards', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      setCards(game, 'p2', [Character.Duke, Character.Contessa]);

      const exchangeState: ExchangeState = {
        playerId: 'p2',
        drawnCards: [Character.Captain, Character.Assassin],
      };

      const result = decide(game, 'p2', 'medium', { exchangeState });
      expect(result!.type).toBe('choose_exchange');
      if (result!.type === 'choose_exchange') {
        // All cards: Duke(5)[0], Contessa(1)[1], Captain(3)[2], Assassin(4)[3]
        // Should keep Duke(0) and Assassin(3)
        expect(result!.keepIndices).toHaveLength(2);
        expect(result!.keepIndices).toContain(0); // Duke
        expect(result!.keepIndices).toContain(3); // Assassin
      }
    });

    it('hard bot uses dynamicCardValue for optimal hand', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      setCards(game, 'p2', [Character.Duke, Character.Ambassador]);

      const exchangeState: ExchangeState = {
        playerId: 'p2',
        drawnCards: [Character.Captain, Character.Contessa],
      };

      const result = decide(game, 'p2', 'hard', { exchangeState });
      expect(result!.type).toBe('choose_exchange');
      if (result!.type === 'choose_exchange') {
        expect(result!.keepIndices).toHaveLength(2);
        // Should keep Duke and Captain (high dynamic value) over Ambassador/Contessa
        expect(result!.keepIndices).toContain(0); // Duke
        expect(result!.keepIndices).toContain(2); // Captain
      }
    });

    it('keeps only 1 card when bot has 1 alive influence', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      const bot = game.getPlayer('p2')!;
      bot.influences = [
        { character: Character.Contessa, revealed: true },
        { character: Character.Ambassador, revealed: false },
      ];

      const exchangeState: ExchangeState = {
        playerId: 'p2',
        drawnCards: [Character.Duke, Character.Captain],
      };

      const result = decide(game, 'p2', 'medium', { exchangeState });
      expect(result!.type).toBe('choose_exchange');
      if (result!.type === 'choose_exchange') {
        expect(result!.keepIndices).toHaveLength(1);
        expect(result!.keepIndices).toContain(1); // Duke
      }
    });

    it('returns null when exchange is for a different player', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      const result = decide(game, 'p2', 'medium', {
        exchangeState: { playerId: 'p1', drawnCards: [Character.Duke] },
      });
      expect(result).toBeNull();
    });
  });

  // ─── Card Counting Helper ───

  describe('countRevealedCharacters()', () => {
    it('counts revealed characters across all players', () => {
      const game = createGame();
      setCards(game, 'p1', [Character.Duke, Character.Duke]);
      game.getPlayer('p1')!.influences[0].revealed = true;

      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      game.getPlayer('p2')!.influences[0].revealed = true;

      const counts = BotBrain.countRevealedCharacters(game);
      expect(counts.get(Character.Duke)).toBe(2);
      expect(counts.get(Character.Captain)).toBe(0);
    });
  });

  // ─── Dynamic Card Value ───

  describe('dynamicCardValue()', () => {
    it('Captain value rises in 1v1', () => {
      const game2 = createGame(2);
      const game4 = createGame(4);

      const val2 = BotBrain.dynamicCardValue(Character.Captain, game2, 'p1');
      const val4 = BotBrain.dynamicCardValue(Character.Captain, game4, 'p1');
      expect(val2).toBeGreaterThan(val4);
    });

    it('Contessa value rises when opponents have assassination coins', () => {
      const game = createGame();
      game.getPlayer('p2')!.coins = 0;
      game.getPlayer('p3')!.coins = 0;
      const valLow = BotBrain.dynamicCardValue(Character.Contessa, game, 'p1');

      game.getPlayer('p2')!.coins = 5;
      game.getPlayer('p3')!.coins = 4;
      const valHigh = BotBrain.dynamicCardValue(Character.Contessa, game, 'p1');

      expect(valHigh).toBeGreaterThan(valLow);
    });
  });

  // ─── Target Selection ───

  describe('pickTarget() via action decisions', () => {
    it('easy bot targets randomly', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;
      game.getPlayer('p1')!.coins = 2;
      game.getPlayer('p3')!.coins = 8;

      let targettedP1 = 0;
      let targettedP3 = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', 'easy');
        if (result?.type === 'action' && result.action === ActionType.Coup) {
          if (result.targetId === 'p1') targettedP1++;
          if (result.targetId === 'p3') targettedP3++;
        }
      }
      expect(targettedP1).toBeGreaterThan(10);
      expect(targettedP3).toBeGreaterThan(10);
    });
  });
});
