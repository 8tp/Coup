/**
 * Where each opponent sits around the oval table.
 *
 * Angles are screen degrees (0 = right, 90 = down, 180 = left, 270 = up), and
 * you sit at 90 — the near edge. Opponents run clockwise from your left hand,
 * up over the far side and down to your right, which is turn order as it would
 * run around a real table. The arcs are hand-set per count rather than spread
 * evenly so that two players face each other, three make a triangle with you,
 * and a full table leaves the near corners clear for your hand.
 */
const ARCS: Record<number, number[]> = {
  1: [270],
  2: [200, 340],
  3: [190, 270, 350],
  4: [180, 240, 300, 360],
  5: [168, 219, 270, 321, 372],
  6: [160, 204, 248, 292, 336, 380],
};

/**
 * A phone's table is a tall oval, and the action sheet rises over its near
 * half on your turn — so every seat goes on the far half, where the sheet can
 * never cover the seat you are trying to pick.
 */
const COMPACT_ARCS: Record<number, number[]> = {
  1: [270],
  2: [225, 315],
  3: [205, 270, 335],
  4: [196, 245, 295, 344],
  5: [194, 232, 270, 308, 346],
  6: [190, 222, 254, 286, 318, 350],
};

export function seatAngles(count: number, compact = false): number[] {
  if (count <= 0) return [];
  const preset = (compact ? COMPACT_ARCS : ARCS)[count];
  if (preset) return preset;
  const start = 160;
  const end = 380;
  return Array.from({ length: count }, (_, i) => start + ((end - start) * i) / (count - 1));
}

/**
 * A seat's centre as percentages of the table's box, on the rim of the
 * ellipse inscribed in it. `inset` pulls seats in from the rim (0 = on it).
 */
export function seatPoint(angleDeg: number, inset = 0): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180;
  const r = 50 - inset;
  return { x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
}
