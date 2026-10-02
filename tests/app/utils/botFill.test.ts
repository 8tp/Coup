import { afterEach, describe, expect, it, vi } from 'vitest';
import { botsNeededToFill, buildBots } from '@/app/utils/botFill';
import { loadSavedPlayerName, PLAYER_NAME_STORAGE_KEY, savePlayerName } from '@/app/utils/playerName';
import { BOT_NAMES, FILL_WITH_BOTS_TARGET, MAX_PLAYERS, QUICK_PLAY_BOT_COUNT } from '@/shared/constants';

describe('botsNeededToFill', () => {
  it('tops a table up to the fill target', () => {
    expect(FILL_WITH_BOTS_TARGET).toBe(4);
    expect(botsNeededToFill(1)).toBe(3);
    expect(botsNeededToFill(3)).toBe(1);
    expect(botsNeededToFill(4)).toBe(0);
    expect(botsNeededToFill(5)).toBe(0);
  });

  it('never exceeds the room cap', () => {
    expect(botsNeededToFill(1, 99)).toBe(MAX_PLAYERS - 1);
  });
});

describe('buildBots', () => {
  it('builds random-personality bots with unique names', () => {
    const bots = buildBots(QUICK_PLAY_BOT_COUNT, ['Alice']);
    expect(bots).toHaveLength(QUICK_PLAY_BOT_COUNT);
    expect(bots.every(b => b.personality === 'random')).toBe(true);
    expect(new Set(bots.map(b => b.name.toLowerCase())).size).toBe(QUICK_PLAY_BOT_COUNT);
  });

  it('avoids names already in the room, case-insensitively', () => {
    const taken = BOT_NAMES.slice(0, BOT_NAMES.length - 1).map(n => n.toUpperCase());
    const bots = buildBots(3, taken, 'random', () => 0);
    const takenLower = new Set(taken.map(n => n.toLowerCase()));
    expect(bots.every(b => !takenLower.has(b.name.toLowerCase()))).toBe(true);
    expect(bots[0].name).toBe(BOT_NAMES[BOT_NAMES.length - 1]);
    expect(bots.slice(1).map(b => b.name)).toEqual(['Bot 1', 'Bot 2']);
  });
});

describe('player name memory', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage() {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
    });
    return data;
  }

  it('round-trips a trimmed name under coup_player_name', () => {
    const data = stubStorage();
    expect(loadSavedPlayerName()).toBe('');
    savePlayerName('  Hunter  ');
    expect(data.get(PLAYER_NAME_STORAGE_KEY)).toBe('Hunter');
    expect(PLAYER_NAME_STORAGE_KEY).toBe('coup_player_name');
    expect(loadSavedPlayerName()).toBe('Hunter');
  });

  it('ignores blank names and survives storage that throws', () => {
    const data = stubStorage();
    savePlayerName('   ');
    expect(data.size).toBe(0);

    vi.stubGlobal('localStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    expect(loadSavedPlayerName()).toBe('');
    expect(() => savePlayerName('Hunter')).not.toThrow();
  });
});
