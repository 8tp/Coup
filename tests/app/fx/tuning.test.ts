import { describe, it, expect } from 'vitest';
import {
  FX_EVENTS,
  FX_TABLE,
  LAND_CEILING,
  QUIET_TRAUMA_CEILING,
  rowFor,
  rowsFor,
  type FxRow,
  type QuietRow,
} from '@/app/fx/tuning';
import { MIN_TRAUMA, CAP as TRAUMA_CAP } from '@/app/fx/shake';
import { HEX, PALETTE_SIZE } from '@/app/fx/palette';
import { HAPTICS, HAPTIC_PRIORITY } from '@/app/utils/haptic';

/**
 * These are the design rules made executable. `QuietRow` already makes a
 * reddened bystander event a TYPE error; these assert the same thing at
 * runtime, so the rule survives a cast, a refactor of the union, or a row
 * copy-pasted from the loud side of the table.
 */

const quiet = FX_TABLE.filter((r): r is QuietRow => r.condition === 'theirs');
const loud = FX_TABLE.filter((r) => r.condition !== 'theirs');

describe('tuning — completeness', () => {
  it('gives every event at least one row', () => {
    for (const event of FX_EVENTS) {
      expect(rowsFor(event).length, `no row for "${event}"`).toBeGreaterThan(0);
    }
  });

  it('has no row for an event outside the enum', () => {
    const known = new Set<string>(FX_EVENTS);
    for (const row of FX_TABLE) expect(known.has(row.event)).toBe(true);
  });

  it('never repeats an (event, condition) pair', () => {
    const seen = new Set<string>();
    for (const row of FX_TABLE) {
      const key = `${row.event}/${row.condition}`;
      expect(seen.has(key), `duplicate row ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it('states a reason on every row', () => {
    // A tuning number with no reason next to it is a number nobody can change.
    for (const row of FX_TABLE) {
      expect(row.why.length, `${row.event}/${row.condition}`).toBeGreaterThan(20);
    }
  });
});

describe('tuning — RED ONLY FOR THE VICTIM', () => {
  it('never flashes crimson on a beat between other players', () => {
    // The rule this file exists for. A table where every attack flashes red
    // teaches the player nothing; a table where only theirs do is one they can
    // read out of the corner of their eye.
    for (const row of quiet) {
      expect(row.flash?.tone, `${row.event}/theirs flashes red`).not.toBe('crimson');
    }
  });

  it('never buzzes the phone for a beat between other players', () => {
    for (const row of quiet) {
      expect(row.haptic, `${row.event}/theirs fires a haptic`).toBeNull();
    }
  });

  it('only ever flashes crimson at the player it happened to', () => {
    const red = loud.filter((r) => r.flash?.tone === 'crimson');
    expect(red.length).toBeGreaterThan(0);
    for (const row of red) {
      // Losing an influence is written as `mine`; being couped as `against_me`.
      // Either is "this happened to you"; neither is a bystander.
      expect(['mine', 'against_me'], row.event).toContain(row.condition);
      expect(row.haptic, row.event).not.toBeNull();
    }
  });

  it('keeps every bystander shake under the quiet ceiling', () => {
    for (const row of quiet) {
      expect(row.trauma, `${row.event}/theirs`).toBeLessThanOrEqual(QUIET_TRAUMA_CEILING);
    }
  });

  it('gives the loud form of a directed attack strictly more than the quiet form', () => {
    // challenge_lost, coup_landed and assassinate_blocked all exist in both
    // forms. In every case the victim's row must be louder on every axis that
    // matters, or the direction is not being taught.
    for (const event of ['challenge_lost', 'coup_landed', 'assassinate_blocked'] as const) {
      const victim = rowFor(event, 'against_me');
      const bystander = rowFor(event, 'theirs');
      expect(victim, event).not.toBeNull();
      expect(bystander, event).not.toBeNull();
      if (!victim || !bystander) continue;
      expect(victim.trauma, event).toBeGreaterThan(bystander.trauma);
      expect(victim.particles.length, event).toBeGreaterThan(bystander.particles.length);
      expect(bystander.flash, event).toBeNull();
      expect(victim.flash, event).not.toBeNull();
    }
  });
});

describe('tuning — RESTRAINT', () => {
  it('makes the quiet form of the commonest beat cost nothing but a ring', () => {
    // card_landed/theirs fires more than any other row in the table.
    const row = rowFor('card_landed', 'theirs');
    expect(row).not.toBeNull();
    expect(row?.particles.length).toBe(1);
    expect(row?.particles[0].emit).toBe('ring');
    expect(row?.trauma).toBe(0);
    expect(row?.flash).toBeNull();
    expect(row?.float).toBeNull();
    expect(row?.haptic).toBeNull();
  });

  it('caps routine landings so a caravan cannot out-shake the win', () => {
    const land = rowFor('card_landed', 'mine');
    const win = rowFor('game_over', 'mine');
    expect(land?.traumaCeiling).toBe(LAND_CEILING);
    expect(LAND_CEILING).toBeLessThan(win?.trauma ?? 0);
  });

  it('keeps the two world-stopping moments the loudest things in the table', () => {
    // ART-DIRECTION §6: influence lost, and victory. Nothing else may outrank
    // them, or the reason they land — that nothing else spent the attention —
    // stops being true.
    const win = rowFor('game_over', 'mine');
    const maxTrauma = Math.max(...FX_TABLE.map((r) => r.trauma));
    expect(win?.trauma).toBe(maxTrauma);

    const lost = rowFor('influence_lost', 'mine');
    expect(lost?.flash?.tone).toBe('crimson');
    expect(lost?.haptic).toBe('influenceLost');
    // Split the vocabulary in two. `land` and `denied` (priority 0 and 1) are
    // ACKNOWLEDGEMENTS of your own tap and may be frequent; anything at
    // priority 2 or above is EARNED and must stay rare, or the priority-aware
    // floor in utils/haptic.ts starts arbitrating between things that all think
    // they matter.
    const earned = FX_TABLE.filter(
      (r) => r.haptic !== null && HAPTIC_PRIORITY[r.haptic] >= 2,
    );
    expect(earned.length).toBeLessThanOrEqual(5);
    expect(earned.every((r) => r.condition !== 'theirs')).toBe(true);
    expect(FX_TABLE.filter((r) => r.haptic === 'win').length).toBe(1);
    expect(FX_TABLE.filter((r) => r.haptic === 'influenceLost').length).toBe(1);
  });

  it('leaves most beats silent', () => {
    const flashing = FX_TABLE.filter((r) => r.flash !== null).length;
    const shaking = FX_TABLE.filter((r) => r.trauma > 0).length;
    expect(flashing).toBeLessThan(FX_TABLE.length / 2);
    expect(shaking).toBeLessThan(FX_TABLE.length * 0.75);
  });
});

describe('tuning — no dead shakes', () => {
  it('never asks for a trauma the shake system will refuse', () => {
    // fx/shake.ts refuses anything under MIN_TRAUMA from rest, because it is
    // below the 0.1px write quantisation. A row asking for less is dead code
    // that still holds a transform.
    for (const row of FX_TABLE) {
      if (row.trauma === 0) continue;
      expect(row.trauma, `${row.event}/${row.condition}`).toBeGreaterThanOrEqual(MIN_TRAUMA);
      expect(row.trauma, `${row.event}/${row.condition}`).toBeLessThanOrEqual(TRAUMA_CAP);
    }
  });

  it('keeps every flash inside a usable opacity range', () => {
    for (const row of FX_TABLE) {
      if (!row.flash) continue;
      expect(row.flash.strength).toBeGreaterThan(0.05);
      expect(row.flash.strength).toBeLessThanOrEqual(0.5);
      expect(row.flash.durationMs).toBeGreaterThanOrEqual(200);
      expect(row.flash.durationMs).toBeLessThanOrEqual(1200);
    }
  });

  it('names only haptics that exist in the vocabulary', () => {
    for (const row of FX_TABLE) {
      if (!row.haptic) continue;
      expect(HAPTICS[row.haptic]).toBeDefined();
    }
  });

  it('names only colours that exist in the palette', () => {
    for (const row of FX_TABLE) {
      for (const e of row.particles) {
        if (e.emit === 'confetti') continue;
        expect(e.color).toBeGreaterThanOrEqual(0);
        expect(e.color).toBeLessThan(PALETTE_SIZE);
        expect(HEX[e.color]).toMatch(/^#[0-9A-F]{6}$/);
      }
    }
  });
});

describe('tuning — rowFor', () => {
  it('a bystander condition NEVER escalates to the loud form', () => {
    // `denied` has only a `mine` row. A bystander cue for it must resolve to
    // nothing — silence is the correct failure mode for an unmapped
    // combination, and a crimson wash is not.
    expect(rowFor('denied', 'mine')).not.toBeNull();
    expect(rowFor('denied', 'theirs')).toBeNull();

    for (const event of FX_EVENTS) {
      const row = rowFor(event, 'theirs');
      if (row) expect(row.condition, event).toBe('theirs');
    }
  });

  it('treats mine and against_me as two shades of "this concerns you"', () => {
    // influence_lost is written as `mine`; a caller who says `against_me`
    // (someone made you lose it) must get the same loud row, not the quiet one.
    const a = rowFor('influence_lost', 'against_me');
    const b = rowFor('influence_lost', 'mine');
    expect(a).toBe(b);

    // challenge_lost is written as `against_me`; the reverse must hold.
    expect(rowFor('challenge_lost', 'mine')).toBe(rowFor('challenge_lost', 'against_me'));
  });

  it('prefers an exact match over a fallback', () => {
    const mine = rowFor('coup_landed', 'mine') as FxRow;
    const victim = rowFor('coup_landed', 'against_me') as FxRow;
    expect(mine).not.toBe(victim);
    expect(mine.condition).toBe('mine');
    expect(victim.condition).toBe('against_me');
    // The one you launched is not the one that landed on you.
    expect(victim.trauma).toBeGreaterThan(mine.trauma);
  });
});
