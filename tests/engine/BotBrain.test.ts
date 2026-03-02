import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BotBrain, BotDecision } from '@/engine/BotBrain';
import { Game } from '@/engine/Game';
import { Player } from '@/engine/Player';
import {
  ActionType,
  BotPersonality,
  Character,
  PersonalityParams,
  TurnPhase,
  PendingAction,
  PendingBlock,
  ChallengeState,
  InfluenceLossRequest,
  ExchangeState,
} from '@/shared/types';
import { BOT_PERSONALITIES } from '@/shared/constants';

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
  personality: PersonalityParams,
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

      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
      expect(result).toBeNull();
    });

    it('returns null when bot is not the current player in AwaitingAction', () => {
      const game = createGame();
      game.currentPlayerIndex = 0; // p1's turn
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
      expect(result).toBeNull();
    });

    it('returns an action when bot is the current player in AwaitingAction', () => {
      const game = createGame();
      game.currentPlayerIndex = 1; // p2's turn (bot)
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('action');
    });

    it('returns null for GameOver phase', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.GameOver;
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
      expect(result).toBeNull();
    });

    it('returns null for ActionResolved phase', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.ActionResolved;
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
      expect(result).toBeNull();
    });
  });

  // ─── Action Selection: All personalities ───

  describe('decideAction() — all personalities', () => {
    it('must coup at 10+ coins (all personalities)', () => {
      for (const pName of ['aggressive', 'conservative', 'optimal'] as const) {
        const game = createGame();
        game.currentPlayerIndex = 1;
        game.getPlayer('p2')!.coins = 10;
        setCards(game, 'p2', [Character.Duke, Character.Captain]);

        const result = decide(game, 'p2', BOT_PERSONALITIES[pName]);
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
        for (const pName of ['aggressive', 'conservative', 'optimal'] as const) {
          const result = decide(game, 'p2', BOT_PERSONALITIES[pName]);
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
        for (const pName of ['aggressive', 'conservative', 'optimal'] as const) {
          const result = decide(game, 'p2', BOT_PERSONALITIES[pName]);
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
        for (const pName of ['aggressive', 'conservative', 'optimal'] as const) {
          const result = decide(game, 'p2', BOT_PERSONALITIES[pName]);
          if (result?.type === 'action' && result.targetId) {
            expect(result.targetId).not.toBe('p2');
          }
        }
      }
    });
  });

  // ─── Optimal Bot Actions ───

  describe('decideAction() — optimal', () => {
    it('prefers Tax and Steal when it has those cards', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      game.getPlayer('p1')!.coins = 5;
      game.getPlayer('p3')!.coins = 5;

      let taxOrStealCount = 0;
      for (let i = 0; i < 200; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
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
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
        if (result?.type === 'action' && result.action === ActionType.Coup) {
          if (result.targetId === 'p3') targettedP3++;
        }
      }
      // Optimal bot should always target p3 (most coins)
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
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
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

      // Should not bluff Tax (Duke) since 2 Dukes are revealed
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal);
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
      const result = decide(game, 'p1', BOT_PERSONALITIES.optimal, {
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
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
        pendingAction: makePendingTax('p1'),
        challengeState: cs,
      });
      expect(result).toBeNull();
    });

    it('challenges at 100% when all copies revealed', () => {
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
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        expect(result!.type).toBe('challenge');
      }
    });

    it('never challenges assassination when it has 2 influences', () => {
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
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
          pendingAction,
          challengeState: cs,
        });
        expect(result!.type).toBe('pass_challenge');
      }
    });

    it('challenges much less on early turns (turn 1-2)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      // Bot holds one Duke — normally boosted challenge rate, but early game should dampen
      setCards(game, 'p2', [Character.Duke, Character.Captain]);

      // Turn 1 (early game, 0.3x multiplier)
      game.turnNumber = 1;
      let earlyChallenge = 0;
      for (let i = 0; i < 1000; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
          pendingAction: makePendingTax('p1'),
          challengeState: makeChallengeState('p1'),
        });
        if (result?.type === 'challenge') earlyChallenge++;
      }

      // Turn 10 (late game, 1.0x multiplier)
      game.turnNumber = 10;
      let lateChallenge = 0;
      for (let i = 0; i < 1000; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
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

    it('still challenges at 100% when all copies accounted for, even early game', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      game.turnNumber = 1; // Early game
      setCards(game, 'p2', [Character.Duke, Character.Duke]);

      // Reveal 1 more Duke (bot has 2 + 1 revealed = 3 = all copies)
      setCards(game, 'p3', [Character.Duke, Character.Contessa]);
      game.getPlayer('p3')!.influences[0].revealed = true;

      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
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
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
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
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, blockPassedPlayerIds: [] });
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
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, blockPassedPlayerIds: [] });
      expect(result!.type).toBe('pass_block');
    });

    it('always blocks when holding the right card and targeted (all personalities)', () => {
      for (const pName of ['aggressive', 'conservative', 'optimal'] as const) {
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
          const result = decide(game, 'p2', BOT_PERSONALITIES[pName], { pendingAction, blockPassedPlayerIds: [] });
          expect(result!.type).toBe('block');
          if (result!.type === 'block') {
            expect(result!.character).toBe(Character.Contessa);
          }
        }
      }
    });

    it('optimal bot occasionally bluff-blocks Contessa vs assassination', () => {
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
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, blockPassedPlayerIds: [] });
        if (result?.type === 'block') {
          expect(result!.character).toBe(Character.Contessa);
          blockCount++;
        }
      }
      // With 2 influences, bluffs Contessa ~25% of the time
      expect(blockCount).toBeGreaterThan(20);
      expect(blockCount).toBeLessThan(100);
    });

    it('does NOT bluff Contessa when all 3 Contessas are revealed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      revealCard(game, 'p2', 0); // 1 influence

      // Reveal all 3 Contessas on other players
      setCards(game, 'p1', [Character.Contessa, Character.Contessa]);
      revealCard(game, 'p1', 0);
      revealCard(game, 'p1', 1);
      setCards(game, 'p3', [Character.Contessa, Character.Duke]);
      revealCard(game, 'p3', 0);

      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, blockPassedPlayerIds: [] });
        expect(result!.type).toBe('pass_block');
      }
    });

    it('bluff-blocks Contessa when at 1 influence vs assassination (no Contessas revealed)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlock;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      // Reveal one card so bot has 1 influence
      revealCard(game, 'p2', 0);
      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, blockPassedPlayerIds: [] });
        expect(result!.type).toBe('block');
        if (result!.type === 'block') {
          expect(result!.character).toBe(Character.Contessa);
        }
      }
    });

    it('at 1 influence passes challenge to bluff-block Contessa vs assassination', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      // Bot has no Contessa and 1 influence
      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      revealCard(game, 'p2', 0);
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

      // Should always pass challenge (to bluff-block with Contessa in block phase)
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, challengeState: cs });
        expect(result!.type).toBe('pass_challenge');
      }
    });

    it('at 1 influence challenges assassination when all Contessas are revealed (bluff not viable)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      revealCard(game, 'p2', 0); // 1 influence

      // Reveal all 3 Contessas — bluff-blocking Contessa is not viable
      setCards(game, 'p1', [Character.Contessa, Character.Contessa]);
      revealCard(game, 'p1', 0);
      revealCard(game, 'p1', 1);
      setCards(game, 'p3', [Character.Contessa, Character.Duke]);
      revealCard(game, 'p3', 0);

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

      // Should always challenge since Contessa bluff would be caught
      for (let i = 0; i < 100; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, challengeState: cs });
        expect(result!.type).toBe('challenge');
      }
    });

    it('at 1 influence prefers challenging assassination when 2 Contessas revealed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);
      revealCard(game, 'p2', 0); // 1 influence

      // Reveal 2 Contessas — bluff is risky
      setCards(game, 'p1', [Character.Contessa, Character.Contessa]);
      revealCard(game, 'p1', 0);
      revealCard(game, 'p1', 1);

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

      // Should challenge ~70% of the time when 2 Contessas revealed
      let challengeCount = 0;
      for (let i = 0; i < 500; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, challengeState: cs });
        if (result!.type === 'challenge') challengeCount++;
      }
      // ~70% challenge rate, allow tolerance
      expect(challengeCount).toBeGreaterThan(250);
      expect(challengeCount).toBeLessThan(450);
    });

    it('at 1 influence challenges assassination when all Assassin copies accounted for', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      // Bot holds 1 Assassin + has 1 influence
      setCards(game, 'p2', [Character.Assassin, Character.Captain]);
      revealCard(game, 'p2', 1);

      // Reveal 2 more Assassins on other players (1 held + 2 revealed = 3 = all copies)
      setCards(game, 'p1', [Character.Assassin, Character.Duke]);
      setCards(game, 'p3', [Character.Assassin, Character.Duke]);
      revealCard(game, 'p1', 0);
      revealCard(game, 'p3', 0);

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

      // Should challenge since all Assassin copies are accounted for
      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { pendingAction, challengeState: cs });
        expect(result!.type).toBe('challenge');
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

      const result = decide(game, 'p3', BOT_PERSONALITIES.optimal, { pendingAction, blockPassedPlayerIds: [] });
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

    it('challenges block when all copies revealed', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingBlockChallenge;
      setCards(game, 'p2', [Character.Captain, Character.Contessa]);

      // Reveal 2 more Captains (bot has 1, so 3 total accounted for)
      setCards(game, 'p3', [Character.Captain, Character.Captain]);
      game.getPlayer('p3')!.influences[0].revealed = true;
      game.getPlayer('p3')!.influences[1].revealed = true;

      for (let i = 0; i < 50; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
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

      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
        influenceLossRequest: { playerId: 'p2', reason: 'coup' },
      });
      expect(result!.type).toBe('choose_influence_loss');
      if (result!.type === 'choose_influence_loss') {
        expect(result!.influenceIndex).toBe(1);
      }
    });

    it('uses dynamic card value (keeps Contessa when opponents have 3+ coins)', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      // Contessa vs Ambassador — normally Contessa (2) ~ Ambassador (2)
      // But if opponents have 3+ coins, Contessa value rises
      setCards(game, 'p2', [Character.Contessa, Character.Ambassador]);
      game.getPlayer('p1')!.coins = 5; // Assassination threat
      game.getPlayer('p3')!.coins = 4;

      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
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
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
        influenceLossRequest: { playerId: 'p1', reason: 'coup' },
      });
      expect(result).toBeNull();
    });
  });

  // ─── Exchange Decisions ───

  describe('decideExchange()', () => {
    it('uses dynamicCardValue for optimal hand', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      setCards(game, 'p2', [Character.Duke, Character.Ambassador]);

      const exchangeState: ExchangeState = {
        playerId: 'p2',
        drawnCards: [Character.Captain, Character.Contessa],
      };

      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { exchangeState });
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

      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, { exchangeState });
      expect(result!.type).toBe('choose_exchange');
      if (result!.type === 'choose_exchange') {
        expect(result!.keepIndices).toHaveLength(1);
        // allCards = [Ambassador(0), Duke(1), Captain(2)]
        // Captain has highest dynamic value in 3-player game
        expect([1, 2]).toContain(result!.keepIndices[0]); // Duke or Captain (both high value)
      }
    });

    it('returns null when exchange is for a different player', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingExchange;
      const result = decide(game, 'p2', BOT_PERSONALITIES.optimal, {
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

  // ═══════════════════════════════════════════════════════════
  // ─── Personality Differentiation Tests ─────────────────────
  // ═══════════════════════════════════════════════════════════

  describe('Personality differentiation', () => {

    it('aggressive personality bluffs Steal more than conservative over many trials', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      // Give bot cards that DON'T include Captain — forces Steal to be a bluff
      setCards(game, 'p2', [Character.Contessa, Character.Ambassador]);
      game.getPlayer('p2')!.coins = 2;

      let aggressiveStealBluffs = 0;
      let conservativeStealBluffs = 0;
      const trials = 500;

      for (let i = 0; i < trials; i++) {
        const aggResult = decide(game, 'p2', BOT_PERSONALITIES.aggressive);
        if (aggResult?.type === 'action' && aggResult.action === ActionType.Steal) aggressiveStealBluffs++;

        const conResult = decide(game, 'p2', BOT_PERSONALITIES.conservative);
        if (conResult?.type === 'action' && conResult.action === ActionType.Steal) conservativeStealBluffs++;
      }

      // Aggressive should bluff Steal far more often (97% vs 1% bluff rate)
      expect(aggressiveStealBluffs).toBeGreaterThan(conservativeStealBluffs);
    });

    it('deceptive personality has highest bluff rate across action types', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Contessa, Character.Contessa]);
      game.getPlayer('p2')!.coins = 4;
      game.getPlayer('p1')!.coins = 3;
      game.getPlayer('p3')!.coins = 3;

      const bluffCounts: Record<string, number> = {};
      const trials = 500;

      for (const pName of ['aggressive', 'conservative', 'deceptive', 'analytical'] as const) {
        let bluffs = 0;
        for (let i = 0; i < trials; i++) {
          const result = decide(game, 'p2', BOT_PERSONALITIES[pName]);
          if (result?.type === 'action') {
            const claimable = [ActionType.Tax, ActionType.Steal, ActionType.Assassinate, ActionType.Exchange];
            if (claimable.includes(result.action)) bluffs++;
          }
        }
        bluffCounts[pName] = bluffs;
      }

      // Deceptive should bluff more than conservative and analytical
      expect(bluffCounts.deceptive).toBeGreaterThan(bluffCounts.conservative);
      expect(bluffCounts.deceptive).toBeGreaterThan(bluffCounts.analytical);
    });

    it('conservative personality prefers safe actions (Income/ForeignAid)', () => {
      const game = createGame();
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Contessa, Character.Ambassador]);
      game.getPlayer('p2')!.coins = 2;

      let safeActions = 0;
      const trials = 300;

      for (let i = 0; i < trials; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.conservative);
        if (result?.type === 'action' &&
            (result.action === ActionType.Income || result.action === ActionType.ForeignAid || result.action === ActionType.Exchange)) {
          safeActions++;
        }
      }

      // Conservative should pick safe actions most of the time
      expect(safeActions / trials).toBeGreaterThan(0.5);
    });

    it('challenge rates differ between aggressive and conservative', () => {
      const game = createGame(3);
      game.currentPlayerIndex = 0;
      game.turnPhase = TurnPhase.AwaitingActionChallenge;
      setCards(game, 'p2', [Character.Duke, Character.Captain]);

      const pendingAction: PendingAction = {
        type: ActionType.Tax,
        actorId: 'p1',
        claimedCharacter: Character.Duke,
      };
      const challengeState: ChallengeState = {
        challengerId: '',
        challengedPlayerId: 'p1',
        claimedCharacter: Character.Duke,
        passedPlayerIds: [],
      };

      let aggChallenges = 0;
      let conChallenges = 0;
      const trials = 500;

      for (let i = 0; i < trials; i++) {
        const aggResult = decide(game, 'p2', BOT_PERSONALITIES.aggressive, {
          pendingAction, challengeState,
        });
        if (aggResult?.type === 'challenge') aggChallenges++;

        const conResult = decide(game, 'p2', BOT_PERSONALITIES.conservative, {
          pendingAction, challengeState,
        });
        if (conResult?.type === 'challenge') conChallenges++;
      }

      // Aggressive should challenge more than conservative
      expect(aggChallenges).toBeGreaterThan(conChallenges);
    });

    it('Contessa bluff rate varies by personality', () => {
      const game = createGame();
      game.currentPlayerIndex = 0;
      game.turnPhase = TurnPhase.AwaitingBlock;
      // Bot doesn't have Contessa — any block would be a bluff
      setCards(game, 'p2', [Character.Duke, Character.Captain]);

      const pendingAction: PendingAction = {
        type: ActionType.Assassinate,
        actorId: 'p1',
        targetId: 'p2',
        claimedCharacter: Character.Assassin,
      };

      let deceptiveBlocks = 0;
      let analyticalBlocks = 0;
      const trials = 500;

      for (let i = 0; i < trials; i++) {
        const decResult = decide(game, 'p2', BOT_PERSONALITIES.deceptive, {
          pendingAction, blockPassedPlayerIds: [],
        });
        if (decResult?.type === 'block') deceptiveBlocks++;

        const anaResult = decide(game, 'p2', BOT_PERSONALITIES.analytical, {
          pendingAction, blockPassedPlayerIds: [],
        });
        if (anaResult?.type === 'block') analyticalBlocks++;
      }

      // Deceptive should bluff Contessa more than analytical
      expect(deceptiveBlocks).toBeGreaterThan(analyticalBlocks);
    });

    it('card value spread produces different ordering with extreme spreads', () => {
      const game = createGame();

      // With normal spread (1.0), Duke and Captain should be top-valued
      const normalDuke = BotBrain.dynamicCardValueWithSpread(Character.Duke, game, 'p1', 1.0);
      const normalAmb = BotBrain.dynamicCardValueWithSpread(Character.Ambassador, game, 'p1', 1.0);
      expect(normalDuke).toBeGreaterThan(normalAmb);

      // With very flat spread (0.1), values should be nearly equal
      const flatDuke = BotBrain.dynamicCardValueWithSpread(Character.Duke, game, 'p1', 0.1);
      const flatAmb = BotBrain.dynamicCardValueWithSpread(Character.Ambassador, game, 'p1', 0.1);
      const flatDiff = Math.abs(flatDuke - flatAmb);
      const normalDiff = Math.abs(normalDuke - normalAmb);
      expect(flatDiff).toBeLessThan(normalDiff);
    });

    it('revenge targeting gives weight to recent attackers for vengeful personality', () => {
      const game = createGame(4);
      game.currentPlayerIndex = 1;
      setCards(game, 'p2', [Character.Captain, Character.Duke]);
      game.getPlayer('p2')!.coins = 10; // Force coup

      // p1 attacked p2 via steal and assassination, p3 successfully challenged p2's bluff
      game.actionLog.push(
        { message: 'Alice steals from Bot1', timestamp: 1, eventType: 'action_resolve', character: Character.Captain, turnNumber: 1, actorId: 'p1', actorName: 'Alice', targetId: 'p2' },
        { message: 'Alice assassinates Bot1', timestamp: 2, eventType: 'assassination', character: Character.Assassin, turnNumber: 2, actorId: 'p1', actorName: 'Alice', targetId: 'p2' },
        { message: 'Carol catches Bot1 bluffing', timestamp: 3, eventType: 'challenge_success', character: Character.Duke, turnNumber: 3, actorId: 'p3', actorName: 'Carol', targetId: 'p2' },
      );

      // Set p1 with low coins and p3/p4 with high coins
      game.getPlayer('p1')!.coins = 2;
      game.getPlayer('p3')!.coins = 8;
      game.getPlayer('p4')!.coins = 6;

      // Vengeful should target p1 and p3 more (revenge) despite p4 having more coins
      let targetP1 = 0;
      let targetP3 = 0;
      let targetP4 = 0;
      const trials = 300;

      for (let i = 0; i < trials; i++) {
        const result = decide(game, 'p2', BOT_PERSONALITIES.vengeful);
        if (result?.type === 'action' && result.action === ActionType.Coup) {
          if (result.targetId === 'p1') targetP1++;
          if (result.targetId === 'p3') targetP3++;
          if (result.targetId === 'p4') targetP4++;
        }
      }

      // p1 (steal+assassinate) and p3 (successful challenge) should both
      // be targeted more than p4 who never acted against the bot
      expect(targetP1).toBeGreaterThan(targetP4);
      expect(targetP3).toBeGreaterThan(targetP4);
    });

    it('all six personality archetypes produce valid decisions', () => {
      for (const pName of ['aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal'] as const) {
        const game = createGame();
        game.currentPlayerIndex = 1;
        setCards(game, 'p2', [Character.Duke, Character.Captain]);

        const result = decide(game, 'p2', BOT_PERSONALITIES[pName]);
        expect(result).not.toBeNull();
        expect(result!.type).toBe('action');
      }
    });

    it('influence loss uses personality card value spread', () => {
      const game = createGame();
      game.turnPhase = TurnPhase.AwaitingInfluenceLoss;
      // Give bot two cards with different values
      setCards(game, 'p2', [Character.Duke, Character.Ambassador]);

      const req: InfluenceLossRequest = { playerId: 'p2', reason: 'coup' };

      // With high spread, should consistently sacrifice the lower-valued card
      // With low spread, choices should be more mixed
      let highSpreadAmbLoss = 0;
      let lowSpreadAmbLoss = 0;
      const highSpread: PersonalityParams = { ...BOT_PERSONALITIES.analytical, cardValueSpread: 2.0 };
      const lowSpread: PersonalityParams = { ...BOT_PERSONALITIES.conservative, cardValueSpread: 0.3 };
      const trials = 200;

      for (let i = 0; i < trials; i++) {
        const highResult = decide(game, 'p2', highSpread, { influenceLossRequest: req });
        if (highResult?.type === 'choose_influence_loss') {
          const lost = game.getPlayer('p2')!.influences[highResult.influenceIndex].character;
          if (lost === Character.Ambassador) highSpreadAmbLoss++;
        }

        const lowResult = decide(game, 'p2', lowSpread, { influenceLossRequest: req });
        if (lowResult?.type === 'choose_influence_loss') {
          const lost = game.getPlayer('p2')!.influences[lowResult.influenceIndex].character;
          if (lost === Character.Ambassador) lowSpreadAmbLoss++;
        }
      }

      // High spread should more consistently sacrifice Ambassador
      // (Duke is more valuable, spread amplifies the difference)
      expect(highSpreadAmbLoss).toBeGreaterThanOrEqual(lowSpreadAmbLoss * 0.8);
    });
  });
});
