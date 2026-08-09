/**
 * fx/palette.ts — the only colours the impact layer may use.
 *
 * Every value here is a token from ART-DIRECTION §2.1, copied rather than
 * invented. The FX layer is the easiest place in a codebase for a seventh gold
 * to appear, so the palette is a closed array of six and `ColorIndex` is a
 * union of its indices: an emitter cannot name a colour that is not in it.
 *
 * `--oxblood` is here for completeness of the danger material and is currently
 * unused by any emitter — a crimson particle over a dark teal table already
 * reads, and an oxblood one does not.
 */

/** Indices into `HEX` / `RGB`. Stored per particle in a `Uint8Array`. */
export const COL = {
  /** `--brass` #D6A12A — your turn, primary slabs. Rings you earned. */
  BRASS: 0,
  /** `--brass-lit` #F2C744 — figures and the treasury. The bright confetti. */
  BRASS_LIT: 1,
  /** `--crimson` #F27366 — the danger stripe, and ONLY the danger stripe. */
  CRIMSON: 2,
  /** `--oxblood` #5F141C — perimeter enamel. */
  OXBLOOD: 3,
  /** `--ink` #F1EBDE — bone. All primary text; here, neutral contact sparks. */
  BONE: 4,
  /** `--ink-mute` #9FADA6 — secondary. Grey puffs, bystander rings. */
  ASH: 5,
} as const;

export type ColorIndex = (typeof COL)[keyof typeof COL];

export const PALETTE_SIZE = 6;

export const HEX: readonly string[] = [
  '#D6A12A',
  '#F2C744',
  '#F27366',
  '#5F141C',
  '#F1EBDE',
  '#9FADA6',
];

export const RGB: readonly (readonly [number, number, number])[] = [
  [0xd6, 0xa1, 0x2a],
  [0xf2, 0xc7, 0x44],
  [0xf2, 0x73, 0x66],
  [0x5f, 0x14, 0x1c],
  [0xf1, 0xeb, 0xde],
  [0x9f, 0xad, 0xa6],
];
