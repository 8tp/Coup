import { describe, expect, it } from 'vitest';
import { seatAngles, seatPoint } from '@/app/components/game/table/seatLayout';

/**
 * Opponents sit on the rim of the oval table. These are the properties that
 * make it read as a table rather than a row of panels: every count gets its
 * own arc, seats run clockwise from your left, and nobody sits in your place
 * at the near edge.
 */
describe('seatAngles', () => {
  it('seats a heads-up opponent straight across the table', () => {
    expect(seatAngles(1)).toEqual([270]);
  });

  it('returns one angle per opponent for every count the game produces', () => {
    for (let n = 0; n <= 8; n++) expect(seatAngles(n)).toHaveLength(n);
  });

  it('runs clockwise from your left hand', () => {
    for (let n = 2; n <= 8; n++) {
      const angles = seatAngles(n);
      for (let i = 1; i < angles.length; i++) expect(angles[i]).toBeGreaterThan(angles[i - 1]);
    }
  });

  it('never seats anyone on the near edge where your hand sits', () => {
    for (let n = 1; n <= 8; n++) {
      for (const angle of seatAngles(n)) {
        const normalised = ((angle % 360) + 360) % 360;
        // 90° is you. Keep a 60° berth either side of it clear.
        expect(Math.abs(normalised - 90)).toBeGreaterThan(60);
      }
    }
  });
});

describe('seatAngles — compact (phone)', () => {
  it('keeps every seat on the far half of the table, clear of the action sheet', () => {
    for (let n = 1; n <= 6; n++) {
      for (const angle of seatAngles(n, true)) {
        const normalised = ((angle % 360) + 360) % 360;
        expect(normalised, `${n} seats`).toBeGreaterThan(180);
        expect(normalised).toBeLessThan(360);
      }
    }
  });
});

describe('seatPoint', () => {
  it('maps the far side to the top centre of the table box', () => {
    const p = seatPoint(270);
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(0);
  });

  it('pulls a seat in from the rim by the inset', () => {
    expect(seatPoint(180, 5).x).toBeCloseTo(5);
  });
});
