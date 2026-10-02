import { describe, expect, it } from 'vitest';
import {
  intersectionArea,
  placeDockBanner,
  placePointedCallout,
  type Rect,
} from '@/app/utils/coachPlacement';

const viewport = { width: 1440, height: 900 };
const size = { width: 300, height: 120 };

function rect(left: number, top: number, width: number, height: number): Rect {
  return { left, top, width, height };
}

describe('intersectionArea', () => {
  it('measures overlap and treats touching edges as none', () => {
    expect(intersectionArea(rect(0, 0, 10, 10), rect(5, 5, 10, 10))).toBe(25);
    expect(intersectionArea(rect(0, 0, 10, 10), rect(10, 0, 10, 10))).toBe(0);
  });
});

describe('placePointedCallout', () => {
  it('sits above the action dock, pointing at its centre, without covering it', () => {
    const dock = rect(920, 590, 500, 300);
    const p = placePointedCallout({ anchor: dock, size, viewport })!;
    expect(p.side).toBe('above');
    expect(p.top + size.height).toBeLessThanOrEqual(dock.top);
    expect(intersectionArea(rect(p.left, p.top, size.width, size.height), dock)).toBe(0);
    // pointer lands over the anchor's centre
    expect(p.left + p.pointer!).toBeCloseTo(dock.left + dock.width / 2, 0);
  });

  it('stays inside the viewport and clamps the pointer away from the corners', () => {
    const corner = rect(1380, 700, 50, 50);
    const p = placePointedCallout({ anchor: corner, size, viewport })!;
    expect(p.left + size.width).toBeLessThanOrEqual(viewport.width - 8);
    expect(p.pointer).toBeLessThanOrEqual(size.width - 18);
  });

  it('moves to the side when the space above holds a control', () => {
    const plaque = rect(620, 420, 200, 70);
    const prompt = rect(560, 250, 320, 160); // a prompt sitting right above
    const p = placePointedCallout({ anchor: plaque, size, viewport, avoid: [prompt] })!;
    expect(p.side).toBe('left');
    const box = rect(p.left, p.top, size.width, size.height);
    expect(intersectionArea(box, prompt)).toBe(0);
    expect(intersectionArea(box, plaque)).toBe(0);
  });

  it('refuses to point at all rather than cover a control', () => {
    const anchor = rect(100, 100, 1240, 700);
    expect(placePointedCallout({ anchor, size, viewport })).toBeNull();
  });

  it('declines an anchor that is not on screen', () => {
    expect(placePointedCallout({ anchor: rect(0, 0, 0, 0), size, viewport })).toBeNull();
  });
});

describe('placeDockBanner', () => {
  const phone = { width: 360, height: 640 };
  const banner = { width: 344, height: 96 };

  it('docks just above the bottom sheet, full width', () => {
    const p = placeDockBanner({ sheetTop: 400, topLimit: 48, size: banner, viewport: phone })!;
    expect(p.side).toBe('dock');
    expect(p.left).toBe(8);
    expect(p.top + banner.height).toBe(392);
  });

  it('moves under the header when the spot above the sheet covers the claim plaque', () => {
    const plaque = rect(60, 330, 240, 60);
    const p = placeDockBanner({ sheetTop: 400, topLimit: 48, size: banner, viewport: phone, avoid: [plaque] })!;
    expect(p.top).toBe(56);
  });

  it('prefers the spot that covers fewer seats', () => {
    const seat = rect(140, 60, 80, 100);
    const p = placeDockBanner({ sheetTop: 400, topLimit: 48, size: banner, viewport: phone, soft: [seat] })!;
    expect(p.top + banner.height).toBe(392);
  });

  it('gives up when there is no clean room between header and sheet', () => {
    const plaque = rect(0, 48, 360, 352);
    expect(placeDockBanner({ sheetTop: 400, topLimit: 48, size: banner, viewport: phone, avoid: [plaque] })).toBeNull();
    expect(placeDockBanner({ sheetTop: 120, topLimit: 48, size: banner, viewport: phone })).toBeNull();
  });

  it('centres a capped banner on a wide screen', () => {
    const p = placeDockBanner({ sheetTop: 600, topLimit: 48, size: { width: 512, height: 96 }, viewport, maxWidth: 512 })!;
    expect(p.left).toBe((1440 - 512) / 2);
  });
});
