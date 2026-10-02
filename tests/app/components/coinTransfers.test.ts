import { describe, expect, it } from 'vitest';
import { coinTransfers, type CoinSnap } from '@/app/components/game/table/CoinFlights';

const snap = (treasury: number, coins: Record<string, number>, reserve = 0): CoinSnap => ({
  treasury,
  reserve,
  coins: new Map(Object.entries(coins)),
});

describe('coinTransfers', () => {
  it('is empty when nothing moved', () => {
    expect(coinTransfers(snap(40, { a: 2 }), snap(40, { a: 2 }))).toEqual([]);
  });

  it('pays Income, Foreign Aid and Tax out of the treasury', () => {
    expect(coinTransfers(snap(40, { a: 2, b: 2 }), snap(37, { a: 5, b: 2 }))).toEqual([
      { from: 'treasury', to: { playerId: 'a' }, amount: 3 },
    ]);
  });

  it('pays a Coup back into the treasury', () => {
    expect(coinTransfers(snap(30, { a: 7, b: 2 }), snap(37, { a: 0, b: 2 }))).toEqual([
      { from: { playerId: 'a' }, to: 'treasury', amount: 7 },
    ]);
  });

  it('moves a Steal seat to seat when no pool changed', () => {
    expect(coinTransfers(snap(40, { a: 2, b: 1 }), snap(40, { a: 3, b: 0 }))).toEqual([
      { from: { playerId: 'b' }, to: { playerId: 'a' }, amount: 1 },
    ]);
  });

  it('names the reserve only when the reserve is the pool that moved', () => {
    // Embezzle: the reserve empties into a player.
    expect(coinTransfers(snap(40, { a: 2 }, 4), snap(40, { a: 6 }, 0))).toEqual([
      { from: 'reserve', to: { playerId: 'a' }, amount: 4 },
    ]);
    // Convert: a player pays into the reserve.
    expect(coinTransfers(snap(40, { a: 3 }, 0), snap(40, { a: 1 }, 2))).toEqual([
      { from: { playerId: 'a' }, to: 'reserve', amount: 2 },
    ]);
  });

  it('ignores a player who was not in the previous state', () => {
    expect(coinTransfers(snap(40, { a: 2 }), snap(40, { a: 2, b: 2 }))).toEqual([]);
  });
});
