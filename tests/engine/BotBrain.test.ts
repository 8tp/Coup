import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BotBrain, BotDecision } from '@/engine/BotBrain';
import { Game } from '@/engine/Game';
import { Player } from '@/engine/Player';
import {
  ActionType,
  AiPersonality,
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

const HONEST: AiPersonality = { honesty: 100, skepticism: 50, vengefulness: 50 };
const DISHONEST: AiPersonality = { honesty: 0, skepticism: 50, vengefulness: 50 };
const SKEPTICAL: AiPersonality = { honesty: 50, skepticism: 100, vengefulness: 50 };
const TRUSTING: AiPersonality = { honesty: 50, skepticism: 0, vengefulness: 50 };
const VENGEFUL: AiPersonality = { honesty: 50, skepticism: 50, vengefulness: 100 };
const FORGIVING: AiPersonality = { honesty: 50, skepticism: 50, vengefulness: 0 };
const BALANCED: AiPersonality = { honesty: 50, skepticism: 50, vengefulness: 50 };

function decide(
  game: Game,
  botId: string,
  personality: AiPersonality,
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
    personality,
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

      const result = decide(game, 'p2', BALANCED);
      expect(result).toBeNull();
    });

    it('returns null when bot is not the current player in AwaitingAction', () => {
      const game = createGame();
      game.currentPlayerIndex = 0; // p1's turn
      const result = decide(game, 'p2', BALANCED);
      expect(result).toBeNull();
    });

    it('returns an action when bot is the current player in AwaitingAction', () => {
      const game = createGame();
      game.currentPlayerIndex = 1; // p2's turn (bot)
      const result = decide(game, 'p2', BALANCED);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('action');
    });

    it('returns null for GameOver phase', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.GameOver;
      const result = decide(game, 'p2', BALANCED);
      expect(result).toBeNull();
    });

    it('returns null for ActionResolved phase', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.ActionResolved;
      const result = decide(game, 'p2', BALANCED);
      expect(result).toBeNull();
    });
  });

  describe('decideAction()', () => {
    it('must coup at 10+ coins', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);

      const result = decide(game, 'p2', BALANCED);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('action');
      if (result!.type === 'action') {
        expect(result!.action).toBe(ActionType.Coup);
        expect(result!.targetId).toBeDefined();
        expect(result!.targetId).not.toBe('p2');
      }
    });

    it('coup target is not the bot itself', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;

      const result = decide(game, 'p2', BALANCED);
      if (result?.type === 'action') {
        expect(result.targetId).not.toBe('p2');
      }
    });

    it('always returns a valid action type', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;

      // Run many times to cover randomness
      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', BALANCED);
        expect(result).not.toBeNull();
        expect(result!.type).toBe('action');
        if (result!.type === 'action') {
          expect(Object.values(ActionType)).toContain(result!.action);
        }
      }
    });

    it('honest bot with Duke prefers Tax', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Duke, Character.Contessa]);

      let taxCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', HONEST);
        if (result?.type === 'action' && result.action === ActionType.Tax) {
          taxCount++;
        }
      }
      // With Duke and high honesty, Tax should be heavily weighted
      expect(taxCount).toBeGreaterThan(50);
    });

    it('dishonest bot bluffs actions it does not have cards for', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);
      game.getPlayer('p2')!.coins = 2;

      let bluffCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', DISHONEST);
        if (result?.type === 'action') {
          if ([ActionType.Tax, ActionType.Steal, ActionType.Exchange].includes(result.action)) {
            bluffCount++;
          }
        }
      }
      // Dishonest bot should bluff frequently
      expect(bluffCount).toBeGreaterThan(50);
    });

    it('does not assassinate without enough coins', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 2; // Below ASSASSINATE_COST (3)
      setCards(game, 'p2', [Character.Assassin, Character.Assassin]);

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BALANCED);
        if (result?.type === 'action') {
          expect(result.action).not.toBe(ActionType.Assassinate);
        }
      }
    });

    it('can assassinate with enough coins', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 3;
      setCards(game, 'p2', [Character.Assassin, Character.Assassin]);

      let assassinateCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', BALANCED);
        if (result?.type === 'action' && result.action === ActionType.Assassinate) {
          assassinateCount++;
        }
      }
      expect(assassinateCount).toBeGreaterThan(0);
    });

    it('steal requires a target with coins', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Captain, Character.Captain]);
      // Give all opponents 0 coins
      game.getPlayer('p1')!.coins = 0;
      game.getPlayer('p3')!.coins = 0;

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BALANCED);
        if (result?.type === 'action') {
          expect(result.action).not.toBe(ActionType.Steal);
        }
      }
    });

    it('income is always a candidate action (fallback)', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      let incomeCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', HONEST);
        if (result?.type === 'action' && result.action === ActionType.Income) {
          incomeCount++;
        }
      }
      expect(incomeCount).toBeGreaterThan(0);
    });
  });

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
      const result = decide(game, 'p1', SKEPTICAL, {
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
      const result = decide(game, 'p2', SKEPTICAL, {
        pendingAction: makePendingTax('p1'),
        challengeState: cs,
      });
      expect(result).toBeNull();
    });

    it('passes challenge for unchallegeable action (no claimed character)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      const pendingAction: PendingAction = {
        type: ActionType.ForeignAid,
        actorId: 'p1',
        // No claimedCharacter
      };
      const cs: ChallengeState = {
        challengerId: '',
        challengedPlayerId: 'p1',
        claimedCharacter: Character.Duke,
        passedPlayerIds: ['p1'],
      };
      // Override claimedCharacter to undefined to test this edge case
      (pendingAction as any).claimedCharacter = undefined;

      const result = decide(game, 'p2', SKEPTICAL, {
        pendingAction,
        challengeState: cs,
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('pass_challenge');
    });

    it('skeptical bot challenges more often', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', SKEPTICAL, {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        if (result?.type === 'challenge') challengeCount++;
      }
      expect(challengeCount).toBeGreaterThan(100); // Should challenge frequently
    });

    it('trusting bot rarely challenges', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', TRUSTING, {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        if (result?.type === 'challenge') challengeCount++;
      }
      expect(challengeCount).toBeLessThan(100);
    });

    it('challenges more when holding the claimed character', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Duke, Character.Contessa]); // Bot holds Duke

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', BALANCED, {
          pendingAction: makePendingTax('p1'), // p1 claims Duke
          challengeState: makeChallengeState('p1'),
        });
        if (result?.type === 'challenge') challengeCount++;
      }
      // Holding the claimed card should boost challenge rate
      expect(challengeCount).toBeGreaterThan(100);
    });

    it('prefers passing challenge when bot can block with a card it holds', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      // Bot has Contessa and is targeted by assassination
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

      let passCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', SKEPTICAL, {
          pendingAction,
          challengeState: cs,
        });
        if (result?.type === 'pass_challenge') passCount++;
      }
      // Should almost always pass (95% of the time) to block instead
      expect(passCount).toBeGreaterThan(170);
    });
  });

  describe('decideBlock()', () => {
    it('returns null when bot is the actor', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      const pendingAction: PendingAction = {
        type: ActionType.ForeignAid,
        actorId: 'p2',
      };
      const result = decide(game, 'p2', BALANCED, { pendingAction, blockPassedPlayerIds: [] });
      expect(result).toBeNull();
    });

    it('returns null when bot already passed block', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      const pendingAction: PendingAction = {
        type: ActionType.ForeignAid,
        actorId: 'p1',
      };
      const result = decide(game, 'p2', BALANCED, {
        pendingAction,
        blockPassedPlayerIds: ['p2'],
      });
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
      const result = decide(game, 'p2', BALANCED, { pendingAction, blockPassedPlayerIds: [] });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('pass_block');
    });

    it('always blocks assassination when targeted and has Contessa', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p2', [Character.Contessa, Character.Captain]);
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', BALANCED, { pendingAction, blockPassedPlayerIds: [] });
        expect(result).not.toBeNull();
        expect(result!.type).toBe('block');
        if (result!.type === 'block') {
          expect(result!.character).toBe(Character.Contessa);
        }
      }
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

      const result = decide(game, 'p3', BALANCED, { pendingAction, blockPassedPlayerIds: [] });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('pass_block');
    });

    it('non-target cannot block steal', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p3', [Character.Captain, Character.Ambassador]);
      const pendingAction: PendingAction = {
        type: ActionType.Steal,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Captain,
      };

      const result = decide(game, 'p3', BALANCED, { pendingAction, blockPassedPlayerIds: [] });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('pass_block');
    });

    it('dishonest bot bluff-blocks when targeted', () => {
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
        const result = decide(game, 'p2', DISHONEST, { pendingAction, blockPassedPlayerIds: [] });
        if (result?.type === 'block') blockCount++;
      }
      // Dishonest bot should bluff-block aggressively when targeted
      expect(blockCount).toBeGreaterThan(80);
    });

    it('honest bot rarely bluff-blocks', () => {
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
        const result = decide(game, 'p2', HONEST, { pendingAction, blockPassedPlayerIds: [] });
        if (result?.type === 'block') blockCount++;
      }
      // Honest bot should never bluff-block (0% chance at honesty=100)
      expect(blockCount).toBe(0);
    });

    it('any player can block foreign aid claiming Duke', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p3', [Character.Duke, Character.Contessa]);
      const pendingAction: PendingAction = {
        type: ActionType.ForeignAid,
        actorId: 'p1',
      };

      let blockCount = 0;
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p3', BALANCED, { pendingAction, blockPassedPlayerIds: [] });
        if (result?.type === 'block') blockCount++;
      }
      // p3 has Duke and can block foreign aid (with ~60% probability per iteration)
      expect(blockCount).toBeGreaterThan(20);
    });
  });

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
      passedPlayerIds: ['p1'], // Blocker has already passed
    });

    it('returns null when bot is not the original actor', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      // p3 is not the actor (p2 is)
      const result = decide(game, 'p3', SKEPTICAL, {
        pendingAction: makePendingSteal(),
        pendingBlock: makePendingBlock(),
        challengeState: makeBlockChallengeState(),
      });
      expect(result).toBeNull();
    });

    it('returns null when bot already passed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      const cs = makeBlockChallengeState();
      cs.passedPlayerIds.push('p2');
      const result = decide(game, 'p2', SKEPTICAL, {
        pendingAction: makePendingSteal(),
        pendingBlock: makePendingBlock(),
        challengeState: cs,
      });
      expect(result).toBeNull();
    });

    it('skeptical actor challenges blocks more often', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', SKEPTICAL, {
          pendingAction: makePendingSteal(),
          pendingBlock: makePendingBlock(),
          challengeState: makeBlockChallengeState(),
        });
        if (result?.type === 'challenge_block') challengeCount++;
      }
      expect(challengeCount).toBeGreaterThan(100);
    });

    it('trusting actor rarely challenges blocks', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', TRUSTING, {
          pendingAction: makePendingSteal(),
          pendingBlock: makePendingBlock(),
          challengeState: makeBlockChallengeState(),
        });
        if (result?.type === 'challenge_block') challengeCount++;
      }
      expect(challengeCount).toBeLessThan(50);
    });

    it('challenges block more when holding the claimed blocking character', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      // Bot holds Captain, so blocker claiming Captain is suspicious
      setCards(game, 'p2', [Character.Captain, Character.Contessa]);

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', BALANCED, {
          pendingAction: makePendingSteal(),
          pendingBlock: makePendingBlock(),
          challengeState: makeBlockChallengeState(),
        });
        if (result?.type === 'challenge_block') challengeCount++;
      }
      // Holding the claimed card should boost challenge probability
      expect(challengeCount).toBeGreaterThan(80);
    });

    it('challenges block more for costly actions', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);

      // Assassination costs 3 coins — more incentive to challenge the block
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p2',
        targetId: 'p1',
        claimedCharacter: Character.Assassin,
      };
      const pendingBlock: PendingBlock = {
        blockerId: 'p1',
        claimedCharacter: Character.Contessa,
      };
      const cs: ChallengeState = {
        challengerId: '',
        challengedPlayerId: 'p1',
        claimedCharacter: Character.Contessa,
        passedPlayerIds: ['p1'],
      };

      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', BALANCED, {
          pendingAction,
          pendingBlock,
          challengeState: cs,
        });
        if (result?.type === 'challenge_block') challengeCount++;
      }
      // Cost bonus should increase challenge rate
      expect(challengeCount).toBeGreaterThan(50);
    });
  });

  describe('decideInfluenceLoss()', () => {
    it('loses the only unrevealed card when only one remains', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      const bot = game.getPlayer('p2')!;
      bot.influences = [
        { character: Character.Duke, revealed: true },
        { character: Character.Captain, revealed: false },
      ];

      const result = decide(game, 'p2', BALANCED, {
        influenceLossRequest: { playerId: 'p2', reason: 'coup' },
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('choose_influence_loss');
      if (result!.type === 'choose_influence_loss') {
        expect(result!.influenceIndex).toBe(1);
      }
    });

    it('loses the least valuable card when both are unrevealed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      // Duke (value 5) vs Contessa (value 1) — should lose Contessa
      setCards(game, 'p2', [Character.Duke, Character.Contessa]);

      const result = decide(game, 'p2', BALANCED, {
        influenceLossRequest: { playerId: 'p2', reason: 'coup' },
      });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('choose_influence_loss');
      if (result!.type === 'choose_influence_loss') {
        // Contessa is index 1, and it's the least valuable
        expect(result!.influenceIndex).toBe(1);
      }
    });

    it('keeps Duke over Assassin (Duke=5, Assassin=4)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      setCards(game, 'p2', [Character.Duke, Character.Assassin]);

      const result = decide(game, 'p2', BALANCED, {
        influenceLossRequest: { playerId: 'p2', reason: 'coup' },
      });
      expect(result!.type).toBe('choose_influence_loss');
      if (result!.type === 'choose_influence_loss') {
        // Assassin (index 1) is less valuable
        expect(result!.influenceIndex).toBe(1);
      }
    });

    it('keeps Assassin over Ambassador (Assassin=4, Ambassador=2)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      setCards(game, 'p2', [Character.Ambassador, Character.Assassin]);

      const result = decide(game, 'p2', BALANCED, {
        influenceLossRequest: { playerId: 'p2', reason: 'coup' },
      });
      expect(result!.type).toBe('choose_influence_loss');
      if (result!.type === 'choose_influence_loss') {
        // Ambassador (index 0) is less valuable
        expect(result!.influenceIndex).toBe(0);
      }
    });

    it('returns null when influence loss is for a different player', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      const result = decide(game, 'p2', BALANCED, {
        influenceLossRequest: { playerId: 'p1', reason: 'coup' },
      });
      expect(result).toBeNull();
    });
  });

  describe('decideExchange()', () => {
    it('keeps the best cards by value', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      // Bot has Duke (5) + Contessa (1), draws Captain (3) + Assassin (4)
      setCards(game, 'p2', [Character.Duke, Character.Contessa]);

      const exchangeState: ExchangeState = {
        playerId: 'p2',
        drawnCards: [Character.Captain, Character.Assassin],
      };

      const result = decide(game, 'p2', BALANCED, { exchangeState });
      expect(result).not.toBeNull();
      expect(result!.type).toBe('choose_exchange');
      if (result!.type === 'choose_exchange') {
        // All cards: Duke(5)[0], Contessa(1)[1], Captain(3)[2], Assassin(4)[3]
        // Should keep Duke(0) and Assassin(3)
        expect(result!.keepIndices).toHaveLength(2);
        expect(result!.keepIndices).toContain(0); // Duke
        expect(result!.keepIndices).toContain(3); // Assassin
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

      const result = decide(game, 'p2', BALANCED, { exchangeState });
      expect(result!.type).toBe('choose_exchange');
      if (result!.type === 'choose_exchange') {
        // Hidden: Ambassador(2). All: Ambassador[0], Duke[1], Captain[2]
        // Should keep Duke (highest value)
        expect(result!.keepIndices).toHaveLength(1);
        expect(result!.keepIndices).toContain(1); // Duke
      }
    });

    it('returns null when exchange is for a different player', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      const result = decide(game, 'p2', BALANCED, {
        exchangeState: { playerId: 'p1', drawnCards: [Character.Duke] },
      });
      expect(result).toBeNull();
    });
  });

  describe('pickTarget() via action decisions', () => {
    it('vengeful bot targets the player with the most coins', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;
      game.getPlayer('p1')!.coins = 2;
      game.getPlayer('p3')!.coins = 8;

      let targettedP3 = 0;
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', VENGEFUL);
        if (result?.type === 'action' && result.action === ActionType.Coup) {
          if (result.targetId === 'p3') targettedP3++;
        }
      }
      // Vengeful bot should mostly target p3 (most coins among opponents)
      expect(targettedP3).toBeGreaterThan(70);
    });

    it('forgiving bot targets randomly', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;
      game.getPlayer('p1')!.coins = 2;
      game.getPlayer('p3')!.coins = 8;

      let targettedP1 = 0;
      let targettedP3 = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', FORGIVING);
        if (result?.type === 'action' && result.action === ActionType.Coup) {
          if (result.targetId === 'p1') targettedP1++;
          if (result.targetId === 'p3') targettedP3++;
        }
      }
      // Forgiving bot should target somewhat evenly
      expect(targettedP1).toBeGreaterThan(10);
      expect(targettedP3).toBeGreaterThan(10);
    });

    it('never targets self', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      game.getPlayer('p2')!.coins = 10;

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BALANCED);
        if (result?.type === 'action' && result.targetId) {
          expect(result.targetId).not.toBe('p2');
        }
      }
    });
  });
});
