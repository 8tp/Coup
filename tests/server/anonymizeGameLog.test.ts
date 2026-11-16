/**
 * Stored game logs carry no player names or ids, including inside the
 * structured log params (`msg`) added for i18n.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameEngine } from '@/engine/GameEngine';
import { GameLogger } from '@/server/GameLogger';
import { anonymizeGameLog } from '@/server/storage/anonymizeGameLog';
import { logParamKind } from '@/shared/i18n/logMessages';
import { ActionType, Character, type RoomPlayer } from '@/shared/types';

const PLAYERS = [
  { id: 'uuid-ana-1111', name: 'Anastasia' },
  { id: 'uuid-bo-2222', name: 'Borislav' },
  { id: 'uuid-cy-3333', name: 'محمد' },
];

describe('anonymizeGameLog', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('maps every player param in msg to a seat and leaves no name or id anywhere', () => {
    const engine = new GameEngine('ANON', 15000, 0);
    engine.startGame(PLAYERS);
    engine.game.currentPlayerIndex = 0;
    const [a, b, c] = engine.game.players;
    a.influences = [{ character: Character.Duke, revealed: false }, { character: Character.Captain, revealed: false }];
    b.influences = [{ character: Character.Captain, revealed: false }, { character: Character.Contessa, revealed: false }];
    c.influences = [{ character: Character.Assassin, revealed: false }, { character: Character.Duke, revealed: false }];
    a.coins = 5;
    expect(engine.handleAction(a.id, ActionType.Steal, b.id)).toBeNull();
    expect(engine.handleBlock(b.id, Character.Captain)).toBeNull();
    expect(engine.handleChallenge(c.id)).toBeNull();
    expect(engine.handleChooseInfluenceLoss(c.id, 0)).toBeNull();
    expect(engine.handleChallengeBlock(a.id)).toBeNull();

    const roomPlayers = PLAYERS.map(p => ({ ...p, socketId: `s-${p.id}`, connected: true })) as RoomPlayer[];
    const stored = anonymizeGameLog(GameLogger.buildGameLog(engine, roomPlayers, 'online'));
    engine.destroy();

    const json = JSON.stringify(stored);
    for (const p of PLAYERS) {
      expect(json).not.toContain(p.id);
      expect(json).not.toContain(p.name);
    }
    const withMsg = stored.actionLog.filter(e => e.msg);
    expect(withMsg.length).toBe(stored.actionLog.length);
    for (const entry of withMsg) {
      for (const [name, value] of Object.entries(entry.msg!.params)) {
        if (logParamKind(name) === 'player') expect(value).toMatch(/^seat-\d$/);
      }
    }
  });
});
