/**
 * The score's pure parts: the shuffle bag that picks the next piece of a pool,
 * and the pool table's shape. The playback itself (audio-clock handoffs,
 * crossfades, lazy loading) is exercised in a real Chrome by the harness's
 * `live` mode — see docs/AUDIO-MIX.md.
 */
import { describe, expect, it } from 'vitest';
import { drawFromBag, MUSIC_LUFS, MUSIC_POOLS, MUSIC_STATES } from '@/app/audio/SoundEngine';

/** A seeded LCG, so a failure reproduces. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function draws(size: number, n: number, seed: number): number[] {
  const rng = lcg(seed);
  let bag: number[] = [];
  let last: number | undefined;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const d = drawFromBag(bag, size, last, rng);
    out.push(d.pick);
    bag = d.bag;
    last = d.pick;
  }
  return out;
}

describe('drawFromBag — the next piece of a pool', () => {
  it.each([2, 3, 4])('never plays the same piece twice in a row (pool of %i)', (size) => {
    for (let seed = 1; seed <= 50; seed++) {
      const seq = draws(size, 60, seed);
      for (let i = 1; i < seq.length; i++) expect(seq[i], `seed ${seed} at ${i}: ${seq.join(',')}`).not.toBe(seq[i - 1]);
    }
  });

  it.each([2, 3, 4])('plays the whole pool before repeating any piece (pool of %i)', (size) => {
    for (let seed = 1; seed <= 50; seed++) {
      const seq = draws(size, size * 10, seed);
      for (let c = 0; c < seq.length; c += size) {
        expect(new Set(seq.slice(c, c + size)).size, `seed ${seed} cycle ${c / size}`).toBe(size);
      }
    }
  });

  it('a pool of one plays its one piece again — loop support', () => {
    expect(draws(1, 5, 7)).toEqual([0, 0, 0, 0, 0]);
  });

  it('is not the same order every cycle', () => {
    const orders = new Set<string>();
    const seq = draws(4, 4 * 20, 3);
    for (let c = 0; c < seq.length; c += 4) orders.add(seq.slice(c, c + 4).join(''));
    expect(orders.size).toBeGreaterThan(3);
  });
});

describe('the pools', () => {
  it('duel and sudden death are mastered hotter than the rest, by 1.5 LU at most', () => {
    for (const state of ['duel', 'sudden_death'] as const) {
      expect(MUSIC_LUFS[state] - MUSIC_LUFS.court).toBeGreaterThan(0);
      expect(MUSIC_LUFS[state] - MUSIC_LUFS.court).toBeLessThanOrEqual(1.5);
    }
    for (const state of ['lobby', 'tension', 'fallen'] as const) expect(MUSIC_LUFS[state]).toBe(MUSIC_LUFS.court);
  });

  it('court has 3–4 pieces, duel 2–3, every other state 2', () => {
    expect(MUSIC_POOLS.court.length).toBeGreaterThanOrEqual(3);
    expect(MUSIC_POOLS.court.length).toBeLessThanOrEqual(4);
    expect(MUSIC_POOLS.duel.length).toBeGreaterThanOrEqual(2);
    expect(MUSIC_POOLS.duel.length).toBeLessThanOrEqual(3);
    for (const s of MUSIC_STATES.filter(x => x !== 'court' && x !== 'duel')) expect(MUSIC_POOLS[s].length, s).toBe(2);
  });

  it('each piece belongs to its state by name', () => {
    for (const s of MUSIC_STATES) {
      const prefix = s.replace('_', '-');
      for (const p of MUSIC_POOLS[s]) expect(p.url).toMatch(new RegExp(`/audio/music/${prefix}-[a-z-]+\\.mp3$`));
    }
  });
});
