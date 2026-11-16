import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { ActionResolver } from '@/engine/ActionResolver';
import { Game } from '@/engine/Game';
import { ActionType, Character, Faction, GameMode, TurnPhase } from '@/shared/types';
import { CHALLENGE_TIMER_MS } from '@/shared/constants';

/**
 * Issue #88: the target of a Steal or Assassinate can declare their block
 * while the action is still open to challenge, instead of only after it.
 */

const NAMES = ['Alice', 'Bob', 'Charlie', 'Diana'];

function createEngine(
  playerCount = 3,
  options?: { gameMode?: GameMode; useInquisitor?: boolean },
): GameEngine {
  const engine = new GameEngine('EARLY', CHALLENGE_TIMER_MS, 0);
  const players = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i + 1}`, name: NAMES[i] }));
  engine.startGame(players, options);
  engine.game.currentPlayerIndex = 0;
  engine.game.turnPhase = TurnPhase.AwaitingAction;
  return engine;
}

function setCards(engine: GameEngine, playerId: string, cards: Character[]): void {
  engine.game.getPlayer(playerId)!.influences = cards.map(c => ({ character: c, revealed: false }));
}

function coins(engine: GameEngine, playerId: string): number {
  return engine.game.getPlayer(playerId)!.coins;
}

function logTypes(engine: GameEngine): string[] {
  return engine.game.actionLog.map(e => e.eventType);
}

/** p1 (actor) Steals from p2 (target, holding Captain); p3 is a bystander. */
function stealFromCaptainHolder(actorHasCaptain = true): GameEngine {
  const engine = createEngine(3);
  setCards(engine, 'p1', actorHasCaptain ? [Character.Captain, Character.Duke] : [Character.Duke, Character.Contessa]);
  setCards(engine, 'p2', [Character.Captain, Character.Duke]);
  setCards(engine, 'p3', [Character.Assassin, Character.Contessa]);
  expect(engine.handleAction('p1', ActionType.Steal, 'p2')).toBeNull();
  expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);
  return engine;
}

describe('Block declared during the action challenge window', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Captain vs Steal', () => {
    it('target declares a block, which counts as passing the challenge', () => {
      const engine = stealFromCaptainHolder();

      expect(engine.handleBlock('p2', Character.Captain)).toBeNull();

      // Still the action's challenge window: p3 has not decided yet
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingActionChallenge);
      expect(engine.challengeState!.passedPlayerIds).toContain('p2');
      expect(engine.pendingAction!.declaredBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Captain });
      expect(engine.pendingBlock).toBeNull();
      // Nothing is logged as a block until it takes effect
      expect(logTypes(engine)).not.toContain('block');
    });

    it('the declared block takes effect once everyone else passes, without prompting the target again', () => {
      const engine = stealFromCaptainHolder();
      engine.handleBlock('p2', Character.Captain);
      engine.handlePassChallenge('p3');

      // Straight to the block challenge: the block step was never visited
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Captain });
      expect(engine.pendingAction!.declaredBlock).toBeUndefined();
      expect(engine.challengeState!.challengedPlayerId).toBe('p2');
      expect(engine.challengeState!.passedPlayerIds).toEqual(['p2']);
      expect(logTypes(engine).filter(t => t === 'block')).toHaveLength(1);
      expect(engine.timerExpiry).not.toBeNull();
    });

    it('an unchallenged declared block stops the steal', () => {
      const engine = stealFromCaptainHolder();
      const before = { p1: coins(engine, 'p1'), p2: coins(engine, 'p2') };
      engine.handleBlock('p2', Character.Captain);
      engine.handlePassChallenge('p3');
      engine.handlePassChallengeBlock('p1');
      engine.handlePassChallengeBlock('p3');

      expect(coins(engine, 'p1')).toBe(before.p1);
      expect(coins(engine, 'p2')).toBe(before.p2);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingAction);
      expect(engine.game.currentPlayer.id).toBe('p2');
    });

    it('applies at once in a 2-player game, where the target is the last to pass', () => {
      const engine = createEngine(2);
      setCards(engine, 'p1', [Character.Captain, Character.Duke]);
      setCards(engine, 'p2', [Character.Captain, Character.Duke]);
      engine.handleAction('p1', ActionType.Steal, 'p2');

      expect(engine.handleBlock('p2', Character.Captain)).toBeNull();
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Captain });
    });

    it('the target may still declare after passing on the challenge', () => {
      const engine = stealFromCaptainHolder();
      engine.handlePassChallenge('p2');
      expect(engine.handleBlock('p2', Character.Ambassador)).toBeNull();
      expect(engine.challengeState!.passedPlayerIds.filter(id => id === 'p2')).toHaveLength(1);

      engine.handlePassChallenge('p3');
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Ambassador });
    });
  });

  describe('validation', () => {
    it('only the target can declare a block early', () => {
      const engine = stealFromCaptainHolder();
      expect(engine.handleBlock('p3', Character.Captain)).toBe('Only the target can block this now');
      expect(engine.handleBlock('p1', Character.Captain)).toBe('Only the target can block this now');
      expect(engine.pendingAction!.declaredBlock).toBeUndefined();
    });

    it('rejects a character that cannot block the action', () => {
      const engine = stealFromCaptainHolder();
      expect(engine.handleBlock('p2', Character.Contessa)).toBe('Contessa cannot block Steal');
      expect(engine.challengeState!.passedPlayerIds).not.toContain('p2');
    });

    it('rejects a second declaration', () => {
      const engine = stealFromCaptainHolder();
      engine.handleBlock('p2', Character.Captain);
      expect(engine.handleBlock('p2', Character.Ambassador)).toBe('You already declared a block');
      expect(engine.pendingAction!.declaredBlock!.claimedCharacter).toBe(Character.Captain);
    });

    it('the declaring target can no longer challenge the action', () => {
      const engine = stealFromCaptainHolder(false);
      engine.handleBlock('p2', Character.Captain);
      expect(engine.handleChallenge('p2')).toBe('You already passed');
    });

    it('rejects blocking a claim that cannot be blocked', () => {
      const engine = createEngine(3);
      engine.handleAction('p1', ActionType.Tax);
      expect(engine.handleBlock('p2', Character.Duke)).toBe('Tax cannot be blocked');
    });

    it('rejects a block after the window has closed', () => {
      const engine = stealFromCaptainHolder();
      engine.handlePassChallenge('p2');
      engine.handlePassChallenge('p3');
      engine.handleBlock('p2', Character.Captain);
      engine.handlePassChallengeBlock('p1');
      engine.handlePassChallengeBlock('p3');
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingAction);
      expect(engine.handleBlock('p2', Character.Captain)).toBe('No pending action');
    });
  });

  describe('another player challenges the action after the target declared', () => {
    it('a successful challenge cancels the action and drops the declared block', () => {
      const engine = stealFromCaptainHolder(false); // actor is bluffing Captain
      const before = { p1: coins(engine, 'p1'), p2: coins(engine, 'p2') };
      engine.handleBlock('p2', Character.Captain);
      expect(engine.handleChallenge('p3')).toBeNull();

      // Actor must lose a card; the action (and the block riding on it) is gone
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      expect(engine.influenceLossRequest!.playerId).toBe('p1');
      expect(engine.pendingAction).toBeNull();

      engine.handleChooseInfluenceLoss('p1', 0);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingAction);
      expect(engine.pendingBlock).toBeNull();
      expect(logTypes(engine)).not.toContain('block');
      expect(coins(engine, 'p1')).toBe(before.p1);
      expect(coins(engine, 'p2')).toBe(before.p2);
    });

    it('a failed challenge leads straight to the declared block once the challenger loses a card', () => {
      const engine = stealFromCaptainHolder(true); // actor really has Captain
      engine.handleBlock('p2', Character.Captain);
      engine.handleChallenge('p3');

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      expect(engine.influenceLossRequest).toEqual({ playerId: 'p3', reason: 'challenge_lost' });

      engine.handleChooseInfluenceLoss('p3', 0);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Captain });
      expect(engine.timerExpiry).not.toBeNull();
    });

    it('a failed challenge by a one-card challenger (auto-revealed) also leads to the declared block', () => {
      const engine = createEngine(4);
      setCards(engine, 'p1', [Character.Captain, Character.Duke]);
      setCards(engine, 'p2', [Character.Captain, Character.Duke]);
      setCards(engine, 'p3', [Character.Assassin, Character.Contessa]);
      engine.game.getPlayer('p3')!.influences[0].revealed = true;
      engine.handleAction('p1', ActionType.Steal, 'p2');

      engine.handleBlock('p2', Character.Captain);
      engine.handleChallenge('p3');

      expect(engine.game.getPlayer('p3')!.isAlive).toBe(false);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Captain });
    });
  });

  describe('the actor challenges the resulting block', () => {
    it('a genuine Captain block stands and the actor loses a card', () => {
      const engine = stealFromCaptainHolder();
      const before = { p1: coins(engine, 'p1'), p2: coins(engine, 'p2') };
      engine.handleBlock('p2', Character.Captain);
      engine.handlePassChallenge('p3');
      expect(engine.handleChallengeBlock('p1')).toBeNull();

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingInfluenceLoss);
      expect(engine.influenceLossRequest!.playerId).toBe('p1');
      engine.handleChooseInfluenceLoss('p1', 1);

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingAction);
      expect(coins(engine, 'p1')).toBe(before.p1);
      expect(coins(engine, 'p2')).toBe(before.p2);
      expect(logTypes(engine)).toContain('block_challenge_fail');
    });

    it('a bluffed block falls and the steal goes ahead', () => {
      const engine = stealFromCaptainHolder();
      setCards(engine, 'p2', [Character.Duke, Character.Contessa]);
      const before = { p1: coins(engine, 'p1'), p2: coins(engine, 'p2') };
      engine.handleBlock('p2', Character.Ambassador);
      engine.handlePassChallenge('p3');
      engine.handleChallengeBlock('p1');

      expect(engine.influenceLossRequest).toEqual({ playerId: 'p2', reason: 'challenge_failed_defense' });
      engine.handleChooseInfluenceLoss('p2', 0);

      expect(coins(engine, 'p1')).toBe(before.p1 + 2);
      expect(coins(engine, 'p2')).toBe(before.p2 - 2);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingAction);
    });
  });

  describe('Contessa vs Assassinate', () => {
    function assassinate(): GameEngine {
      const engine = createEngine(3);
      setCards(engine, 'p1', [Character.Assassin, Character.Duke]);
      setCards(engine, 'p2', [Character.Contessa, Character.Duke]);
      engine.game.getPlayer('p1')!.coins = 3;
      engine.handleAction('p1', ActionType.Assassinate, 'p2');
      return engine;
    }

    it('a declared Contessa block applies after the challenge window and stops the assassination', () => {
      const engine = assassinate();
      expect(engine.handleBlock('p2', Character.Contessa)).toBeNull();
      engine.handlePassChallenge('p3');

      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Contessa });

      engine.handlePassChallengeBlock('p1');
      engine.handlePassChallengeBlock('p3');
      expect(engine.game.getPlayer('p2')!.aliveInfluenceCount).toBe(2);
      // The 3 coins stay spent on a blocked assassination
      expect(coins(engine, 'p1')).toBe(0);
    });

    it('a bluffed Contessa caught by the actor costs the target both cards', () => {
      const engine = assassinate();
      setCards(engine, 'p2', [Character.Captain, Character.Duke]);
      engine.handleBlock('p2', Character.Contessa);
      engine.handlePassChallenge('p3');
      engine.handleChallengeBlock('p1');

      engine.handleChooseInfluenceLoss('p2', 0); // caught bluff
      expect(engine.influenceLossRequest).toEqual({ playerId: 'p2', reason: 'assassination' });
      engine.handleChooseInfluenceLoss('p2', 1); // the assassination itself
      expect(engine.game.getPlayer('p2')!.isAlive).toBe(false);
    });

    it('Captain cannot be declared against an Assassinate', () => {
      const engine = assassinate();
      expect(engine.handleBlock('p2', Character.Captain)).toBe('Captain cannot block Assassinate');
    });
  });

  describe('timers', () => {
    it('challenge window expiry applies the declared block and starts the block-challenge timer', () => {
      const engine = stealFromCaptainHolder();
      engine.handleBlock('p2', Character.Captain);
      const expiry = engine.timerExpiry;
      // Declaring does not restart the challenge window
      expect(expiry).not.toBeNull();

      vi.advanceTimersByTime(CHALLENGE_TIMER_MS);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Captain });
      expect(engine.timerExpiry).not.toBeNull();

      // Nobody challenges the block before time runs out: it stands
      const p2Coins = coins(engine, 'p2');
      vi.advanceTimersByTime(CHALLENGE_TIMER_MS);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingAction);
      expect(coins(engine, 'p2')).toBe(p2Coins);
      expect(logTypes(engine)).toContain('block_unchallenged');
    });

    it('declaring does not change the remaining time in the challenge window', () => {
      const engine = stealFromCaptainHolder();
      const expiry = engine.timerExpiry;
      vi.advanceTimersByTime(5000);
      engine.handleBlock('p2', Character.Captain);
      expect(engine.timerExpiry).toBe(expiry);
    });

    it('without a declaration, expiry still opens the normal block step', () => {
      const engine = stealFromCaptainHolder();
      vi.advanceTimersByTime(CHALLENGE_TIMER_MS);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);
      expect(engine.pendingBlock).toBeNull();

      const before = { p1: coins(engine, 'p1'), p2: coins(engine, 'p2') };
      vi.advanceTimersByTime(CHALLENGE_TIMER_MS);
      expect(coins(engine, 'p1')).toBe(before.p1 + 2);
      expect(coins(engine, 'p2')).toBe(before.p2 - 2);
    });
  });

  describe('Reformation', () => {
    function reformation(useInquisitor: boolean): GameEngine {
      const engine = createEngine(4, { gameMode: GameMode.Reformation, useInquisitor });
      const factions = [Faction.Loyalist, Faction.Reformist, Faction.Loyalist, Faction.Reformist];
      engine.game.players.forEach((p, i) => { p.faction = factions[i]; });
      return engine;
    }

    it('same-faction targeting is still refused, so there is nothing to block', () => {
      const engine = reformation(true);
      expect(engine.handleAction('p1', ActionType.Steal, 'p3')).toBe("You can't target a player in the same faction");
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingAction);
    });

    it('the Inquisitor can be declared against a cross-faction Steal', () => {
      const engine = reformation(true);
      setCards(engine, 'p1', [Character.Captain, Character.Duke]);
      setCards(engine, 'p2', [Character.Inquisitor, Character.Duke]);
      engine.handleAction('p1', ActionType.Steal, 'p2');

      expect(engine.handleBlock('p2', Character.Inquisitor)).toBeNull();
      engine.handlePassChallenge('p3');
      engine.handlePassChallenge('p4');
      expect(engine.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Inquisitor });
    });

    it('Foreign Aid blocks keep the same-faction rule and the normal block step', () => {
      const engine = reformation(false);
      engine.handleAction('p1', ActionType.ForeignAid);
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlock);
      expect(engine.handleBlock('p3', Character.Duke)).toBe("You can't block Foreign Aid for a player in the same faction");
      expect(engine.handleBlock('p2', Character.Duke)).toBeNull();
      expect(engine.game.turnPhase).toBe(TurnPhase.AwaitingBlockChallenge);
    });
  });
});

describe('ActionResolver.declareBlockDuringChallenge', () => {
  function setup() {
    const game = new Game('RESOLVE');
    game.initialize([
      { id: 'p1', name: 'Alice' },
      { id: 'p2', name: 'Bob' },
      { id: 'p3', name: 'Charlie' },
    ]);
    game.currentPlayerIndex = 0;
    game.turnPhase = TurnPhase.AwaitingAction;
    const resolver = new ActionResolver();
    const declared = resolver.declareAction(game, 'p1', ActionType.Steal, 'p2');
    if ('error' in declared) throw new Error(declared.error);
    return { game, resolver, pendingAction: declared.pendingAction!, challengeState: declared.challengeState! };
  }

  it('is pure: returns the updated action and challenge state without touching the inputs or setting a timer', () => {
    const { game, resolver, pendingAction, challengeState } = setup();
    const result = resolver.declareBlockDuringChallenge(game, 'p2', Character.Captain, pendingAction, challengeState);
    if ('error' in result) throw new Error(result.error);

    expect(result.newPhase).toBe(TurnPhase.AwaitingActionChallenge);
    expect(result.pendingAction!.declaredBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Captain });
    expect(result.challengeState!.passedPlayerIds).toEqual(['p1', 'p2']);
    expect(result.sideEffects).toEqual([]);
    expect(pendingAction.declaredBlock).toBeUndefined();
    expect(challengeState.passedPlayerIds).toEqual(['p1']);
  });

  it('allPassedChallenge turns a declared block into the block-challenge step', () => {
    const { game, resolver, pendingAction } = setup();
    const result = resolver.allPassedChallenge(game, {
      ...pendingAction,
      declaredBlock: { blockerId: 'p2', claimedCharacter: Character.Ambassador },
    });

    expect(result.newPhase).toBe(TurnPhase.AwaitingBlockChallenge);
    expect(result.pendingBlock).toEqual({ blockerId: 'p2', claimedCharacter: Character.Ambassador });
    expect(result.pendingAction).toEqual(pendingAction);
    expect(result.sideEffects.map(e => e.type)).toEqual(['clear_timer', 'log', 'set_timer']);
  });
});
