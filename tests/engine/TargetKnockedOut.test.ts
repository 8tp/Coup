import { describe, it, expect, afterEach } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { ActionType, Character, Faction, GameMode, TurnPhase } from '@/shared/types';
import { TOTAL_COINS } from '@/shared/constants';

/**
 * The target of a Steal, Assassinate or Examine loses their last card to a
 * challenge (on the action or on their own block) and the action then goes
 * ahead. They are out: the action has nothing left to take, and must not
 * log a second card lost, a second knock-out or a steal that moved no coins.
 */

let engine: GameEngine;

function start(mode: GameMode = GameMode.Classic, useInquisitor = false) {
  engine = new GameEngine('KO', 15_000, 0);
  engine.startGame(
    [{ id: 'ann', name: 'Ann' }, { id: 'tom', name: 'Tom' }, { id: 'bea', name: 'Bea' }],
    { gameMode: mode, useInquisitor },
  );
  const g = engine.game;
  g.currentPlayerIndex = 0;
  g.turnPhase = TurnPhase.AwaitingAction;
  return g;
}

const lastTurn = () => engine.game.actionLog.filter(e => e.turnNumber === engine.game.turnNumber - 1);
const outs = (id: string) => engine.game.actionLog.filter(e => e.eventType === 'elimination' && e.actorId === id).length;

afterEach(() => engine.destroy());

describe('Target knocked out before the action resolves', () => {
  it('Assassinate: a one-card target caught bluffing Contessa is out once, with no assassination line', () => {
    const g = start();
    g.getPlayer('ann')!.influences = [{ character: Character.Assassin, revealed: false }, { character: Character.Duke, revealed: false }];
    g.getPlayer('tom')!.influences = [{ character: Character.Duke, revealed: true }, { character: Character.Captain, revealed: false }];
    g.getPlayer('ann')!.coins = 3;

    expect(engine.handleAction('ann', ActionType.Assassinate, 'tom')).toBeNull();
    expect(engine.handleBlock('tom', Character.Contessa)).toBeNull(); // declared early
    expect(engine.handlePassChallenge('bea')).toBeNull();
    expect(engine.handleChallengeBlock('ann')).toBeNull();

    expect(g.getPlayer('tom')!.isAlive).toBe(false);
    expect(outs('tom')).toBe(1);
    const types = lastTurn().map(e => e.eventType);
    expect(types).not.toContain('assassination');
    expect(g.turnPhase).toBe(TurnPhase.AwaitingAction);
    expect(g.currentPlayer.id).toBe('bea');
  });

  it('Steal: a one-card target caught bluffing Captain is out, and no steal is logged when no coins move', () => {
    const g = start();
    g.getPlayer('ann')!.influences = [{ character: Character.Captain, revealed: false }, { character: Character.Duke, revealed: false }];
    g.getPlayer('tom')!.influences = [{ character: Character.Duke, revealed: true }, { character: Character.Contessa, revealed: false }];

    expect(engine.handleAction('ann', ActionType.Steal, 'tom')).toBeNull();
    expect(engine.handleBlock('tom', Character.Captain)).toBeNull();
    expect(engine.handlePassChallenge('bea')).toBeNull();
    expect(engine.handleChallengeBlock('ann')).toBeNull();

    expect(outs('tom')).toBe(1);
    // Tom's coins went back to the treasury when he was knocked out
    expect(g.getPlayer('ann')!.coins).toBe(2);
    expect(lastTurn().some(e => e.msg?.key === 'stealResolved')).toBe(false);
    expect(g.players.reduce((a, p) => a + p.coins, 0) + g.treasury).toBe(TOTAL_COINS);
  });

  it('Examine: a one-card target who challenges and loses is not examined, and their face-up card stays put', () => {
    const g = start(GameMode.Reformation, true);
    g.getPlayer('ann')!.faction = Faction.Loyalist;
    g.getPlayer('tom')!.faction = Faction.Reformist;
    g.getPlayer('bea')!.faction = Faction.Reformist;
    g.getPlayer('ann')!.influences = [{ character: Character.Inquisitor, revealed: false }, { character: Character.Duke, revealed: false }];
    g.getPlayer('tom')!.influences = [{ character: Character.Captain, revealed: true }, { character: Character.Contessa, revealed: false }];

    expect(engine.handleAction('ann', ActionType.Examine, 'tom')).toBeNull();
    expect(engine.handleChallenge('tom')).toBeNull();

    expect(g.getPlayer('tom')!.isAlive).toBe(false);
    expect(engine.examineState).toBeNull();
    expect(g.turnPhase).toBe(TurnPhase.AwaitingAction);
    expect(g.getPlayer('tom')!.influences.map(i => i.character)).toEqual([Character.Captain, Character.Contessa]);
    expect(lastTurn().map(e => e.eventType)).not.toContain('examine');
  });

  it('Assassinate: a two-card target caught bluffing Contessa still loses a second card to the assassination', () => {
    const g = start();
    g.getPlayer('ann')!.influences = [{ character: Character.Assassin, revealed: false }, { character: Character.Duke, revealed: false }];
    g.getPlayer('tom')!.influences = [{ character: Character.Duke, revealed: false }, { character: Character.Captain, revealed: false }];
    g.getPlayer('ann')!.coins = 3;

    expect(engine.handleAction('ann', ActionType.Assassinate, 'tom')).toBeNull();
    expect(engine.handlePassChallenge('tom')).toBeNull();
    expect(engine.handlePassChallenge('bea')).toBeNull();
    expect(engine.handleBlock('tom', Character.Contessa)).toBeNull();
    expect(engine.handleChallengeBlock('ann')).toBeNull();
    expect(engine.handleChooseInfluenceLoss('tom', 0)).toBeNull();
    expect(engine.influenceLossRequest).toEqual({ playerId: 'tom', reason: 'assassination' });
    expect(engine.handleChooseInfluenceLoss('tom', 1)).toBeNull();
    expect(outs('tom')).toBe(1);
  });
});
