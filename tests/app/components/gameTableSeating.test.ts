import { describe, expect, it } from 'vitest';
import { ringSplit } from '@/app/components/game/GameTable';

/**
 * The desktop table seats opponents around a felt instead of stacking them in
 * a grid of identical rectangles (GAME-FEEL-PLAN §1.4). `ringSplit` is the
 * whole of that decision: how many seats go up the left rail, across the top
 * and down the right one, for every opponent count the game can produce.
 *
 * It is tested rather than eyeballed because the counts are not all reachable
 * from one game — 5 opponents needs a full six-player table and 6 only ever
 * happens for a spectator, who has no seat of their own.
 */
describe('ringSplit', () => {
  it('seats a heads-up opponent across the table, not off to one side', () => {
    expect(ringSplit(1)).toEqual({ left: 0, top: 1, right: 0 });
  });

  it('sits two opponents facing each other down the rails', () => {
    // Not both at the top: with `you` at the bottom, one seat per side is the
    // only arrangement that reads as three people around a table.
    expect(ringSplit(2)).toEqual({ left: 1, top: 0, right: 1 });
  });

  it('spreads three, four and five opponents around the felt', () => {
    expect(ringSplit(3)).toEqual({ left: 1, top: 1, right: 1 });
    expect(ringSplit(4)).toEqual({ left: 1, top: 2, right: 1 });
    // 2/1/2 rather than 1/3/1: the middle of the felt has to stay wide enough
    // for the deck, the discard and the treasury to sit under the top rail.
    expect(ringSplit(5)).toEqual({ left: 2, top: 1, right: 2 });
  });

  it('handles the spectator case, who sees every player as an opponent', () => {
    expect(ringSplit(6)).toEqual({ left: 2, top: 2, right: 2 });
  });

  it('never loses or invents a seat, and never leaves one rail overloaded', () => {
    for (let n = 0; n <= 6; n++) {
      const { left, top, right } = ringSplit(n);
      expect(left + top + right).toBe(n);
      expect(Math.min(left, top, right)).toBeGreaterThanOrEqual(0);
      // A rail may never hold more than half the table, or the "ring" is a row.
      expect(Math.max(left, top, right)).toBeLessThanOrEqual(Math.max(1, Math.ceil(n / 2)));
    }
  });
});
