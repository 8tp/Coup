/**
 * Text that players type (names, chat) in any script: how long it is, how to
 * cut it, and when two names are the same name.
 *
 * Length is counted in user-perceived characters (grapheme clusters), not
 * UTF-16 code units: "प्रिया" is 2 or 3 characters (by Unicode version) but 6 code units, "李小龙" is 3,
 * "👨‍👩‍👧" is 1 but 8 code units. A second cap in code units (see
 * NAME_MAX_CODE_UNITS) bounds the clusters themselves, which can grow
 * without limit by stacking combining marks.
 *
 * Shared by the server's validation (src/server/ContentFilter.ts) and the
 * client's inputs, so the field never accepts something the server rejects
 * for length.
 */

type Segmenter = { segment(input: string): Iterable<{ segment: string }> };

let segmenter: Segmenter | null | undefined;

function getSegmenter(): Segmenter | null {
  if (segmenter === undefined) {
    const Ctor = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => Segmenter }).Segmenter;
    segmenter = Ctor ? new Ctor(undefined, { granularity: 'grapheme' }) : null;
  }
  return segmenter;
}

/** The user-perceived characters of `text`. Falls back to code points where Intl.Segmenter is missing. */
export function graphemes(text: string): string[] {
  const seg = getSegmenter();
  if (!seg) return Array.from(text);
  const out: string[] = [];
  for (const { segment } of seg.segment(text)) out.push(segment);
  return out;
}

export function graphemeLength(text: string): number {
  // A string never has more graphemes than code units, so short text needs no segmenting.
  return text.length <= 1 ? text.length : graphemes(text).length;
}

/** `text` cut to at most `max` user-perceived characters, never splitting one. */
export function clampToGraphemes(text: string, max: number): string {
  if (text.length <= max) return text;
  const parts = graphemes(text);
  return parts.length <= max ? text : parts.slice(0, max).join('');
}

/**
 * The form two names are compared in: compatibility-normalised and
 * lower-cased, so "Bob", "BOB" and fullwidth "Ｂｏｂ" are one name in a room.
 */
export function nameKey(name: string): string {
  return name.normalize('NFKC').toLowerCase();
}
