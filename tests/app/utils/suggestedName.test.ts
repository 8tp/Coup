import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadOrCreateSuggestedName,
  suggestPlayerName,
  SUGGESTED_NAME_STORAGE_KEY,
} from '@/app/utils/suggestedName';
import { validateName } from '@/server/ContentFilter';
import { Character } from '@/shared/types';
import {
  BOT_NAMES,
  NAME_MAX_LENGTH,
  SUGGESTED_NAME_ADJECTIVES,
  SUGGESTED_NAME_TITLES,
} from '@/shared/constants';

/** A random() that replays the given values in order. */
const sequence = (...values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('suggestPlayerName', () => {
  it('is an adjective, a court title and a two-digit number', () => {
    expect(suggestPlayerName(sequence(0, 0, 0))).toBe(`${SUGGESTED_NAME_ADJECTIVES[0]} ${SUGGESTED_NAME_TITLES[0]} 10`);
    const last = 0.999999;
    expect(suggestPlayerName(sequence(last, last, last))).toBe(
      `${SUGGESTED_NAME_ADJECTIVES[SUGGESTED_NAME_ADJECTIVES.length - 1]} ${SUGGESTED_NAME_TITLES[SUGGESTED_NAME_TITLES.length - 1]} 99`,
    );
    expect(suggestPlayerName()).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+ [1-9][0-9]$/);
  });

  it('clamps a random() that returns exactly 1', () => {
    expect(suggestPlayerName(() => 1)).toMatch(/ 99$/);
  });

  it('passes the server name filter for every possible suggestion', () => {
    const failures: string[] = [];
    for (const adjective of SUGGESTED_NAME_ADJECTIVES) {
      for (const title of SUGGESTED_NAME_TITLES) {
        for (let n = 10; n <= 99; n++) {
          const name = `${adjective} ${title} ${n}`;
          const result = validateName(name);
          if (!result.valid || result.sanitized !== name || name.length > NAME_MAX_LENGTH) failures.push(name);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('never uses a character name or collides with a bot name', () => {
    const words = [...SUGGESTED_NAME_ADJECTIVES, ...SUGGESTED_NAME_TITLES].map(w => w.toLowerCase());
    for (const character of Object.values(Character)) {
      expect(words).not.toContain(character.toLowerCase());
    }
    // Suggestions always end in a number; bot names that do ("HAL 9000", "Johnny 5") use other words.
    const botWords = new Set(BOT_NAMES.flatMap(n => n.toLowerCase().split(/\s+/)));
    expect(SUGGESTED_NAME_TITLES.filter(t => botWords.has(t.toLowerCase()))).toEqual([]);
  });

  it('has no repeated words, so the name space is what it claims', () => {
    expect(new Set(SUGGESTED_NAME_ADJECTIVES).size).toBe(SUGGESTED_NAME_ADJECTIVES.length);
    expect(new Set(SUGGESTED_NAME_TITLES).size).toBe(SUGGESTED_NAME_TITLES.length);
    expect(SUGGESTED_NAME_ADJECTIVES.length * SUGGESTED_NAME_TITLES.length * 90).toBeGreaterThanOrEqual(50_000);
  });

  it('makes two visitors at one table unlikely to share a name', () => {
    // 2,000 suggestions from Math.random: duplicates should be rare (birthday
    // bound for 60,840 names is ~33 expected pairs in 2,000; a table has six).
    const seen = new Set<string>();
    let duplicates = 0;
    for (let i = 0; i < 2000; i++) {
      const name = suggestPlayerName();
      if (seen.has(name)) duplicates++;
      seen.add(name);
    }
    expect(duplicates).toBeLessThan(80);
  });
});

describe('loadOrCreateSuggestedName', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const fakeSession = () => {
    const data = new Map<string, string>();
    return {
      data,
      store: {
        getItem: (k: string) => data.get(k) ?? null,
        setItem: (k: string, v: string) => { data.set(k, v); },
      },
    };
  };

  it('keeps one suggestion for the visit', () => {
    const { data, store } = fakeSession();
    vi.stubGlobal('sessionStorage', store);
    const first = loadOrCreateSuggestedName(sequence(0.1, 0.2, 0.3));
    expect(data.get(SUGGESTED_NAME_STORAGE_KEY)).toBe(first);
    expect(loadOrCreateSuggestedName(sequence(0.9, 0.9, 0.9))).toBe(first);
  });

  it('still suggests a name when storage throws', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    });
    expect(loadOrCreateSuggestedName(sequence(0, 0, 0))).toBe(`${SUGGESTED_NAME_ADJECTIVES[0]} ${SUGGESTED_NAME_TITLES[0]} 10`);
  });
});
