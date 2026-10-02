import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGameStore } from '@/app/stores/gameStore';
import { ActionType, type TargetingPublication } from '@/shared/types';

/**
 * The targeting slice — the seam between `ActionBar` (which knows the target
 * RULES) and `PlayerSeat` (which draws them). It replaced a `window`
 * CustomEvent, so the two properties worth pinning are the ones the event
 * could not give us: a late subscriber sees the current selection rather than
 * only the next change, and leaving a room cannot leave a seat lit.
 */
function publication(overrides: Partial<TargetingPublication> = {}): TargetingPublication {
  return {
    action: ActionType.Steal,
    eligibleIds: ['bishop'],
    ineligibleIds: ['auto'],
    reasons: { auto: 'Auto has no coins to steal.' },
    onSelect: vi.fn(),
    ...overrides,
  };
}

describe('gameStore targeting', () => {
  beforeEach(() => {
    useGameStore.getState().setTargeting(null);
  });

  it('starts empty, so nothing is aimed at before a turn begins', () => {
    expect(useGameStore.getState().targeting).toBeNull();
  });

  it('holds the published selection for whoever reads it next', () => {
    const pub = publication();
    useGameStore.getState().setTargeting(pub);

    const held = useGameStore.getState().targeting;
    expect(held).toBe(pub);
    expect(held?.eligibleIds).toEqual(['bishop']);
    expect(held?.reasons.auto).toBe('Auto has no coins to steal.');
  });

  it('routes a seat tap through the publisher\'s own handler', () => {
    const onSelect = vi.fn();
    useGameStore.getState().setTargeting(publication({ onSelect }));

    // This is what a seat does. It must be the ActionBar's handler and not a
    // second copy of the send/refuse logic, or the two halves of a target pick
    // drift apart.
    useGameStore.getState().targeting?.onSelect('auto');
    expect(onSelect).toHaveBeenCalledExactlyOnceWith('auto');
  });

  it('clears when the action ends', () => {
    useGameStore.getState().setTargeting(publication());
    useGameStore.getState().setTargeting(null);
    expect(useGameStore.getState().targeting).toBeNull();
  });

  it('clears when the room does, so a rematch never opens with a lit seat', () => {
    useGameStore.getState().setTargeting(publication());
    useGameStore.getState().clearRoom();
    expect(useGameStore.getState().targeting).toBeNull();
  });
});
