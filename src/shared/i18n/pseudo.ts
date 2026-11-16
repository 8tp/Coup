/**
 * Pseudo-localisation (development only; docs/I18N.md, "Pseudo-locales").
 *
 *   en-XA  accents every letter and doubles vowels (about 35% longer, roughly
 *          where German and Portuguese land), so layouts that only fit English
 *          show it.
 *   ar-XB  the same text forced right to left with bidi overrides, under
 *          `dir="rtl"`, so mirroring bugs show without reading Arabic.
 *
 * Both wrap every translated message in ⟦ ⟧. Text on screen without the
 * brackets did not come from a catalog: it is still hard-coded.
 *
 * Only literal catalog text is transformed. Player names, numbers and other
 * params pass through untouched, as they would in a real translation.
 */
export const PSEUDO_OPEN = '⟦';
export const PSEUDO_CLOSE = '⟧';

const ACCENTS: Record<string, string> = {
  a: 'á', b: 'ƀ', c: 'ç', d: 'ð', e: 'é', f: 'ƒ', g: 'ĝ', h: 'ĥ', i: 'î', j: 'ĵ', k: 'ķ', l: 'ļ', m: 'ɱ',
  n: 'ñ', o: 'ö', p: 'þ', q: 'ǫ', r: 'ŕ', s: 'š', t: 'ţ', u: 'û', v: 'ṽ', w: 'ŵ', x: 'ẋ', y: 'ý', z: 'ž',
  A: 'Á', B: 'Ɓ', C: 'Ç', D: 'Ð', E: 'É', F: 'Ƒ', G: 'Ĝ', H: 'Ĥ', I: 'Î', J: 'Ĵ', K: 'Ķ', L: 'Ļ', M: 'Ṁ',
  N: 'Ñ', O: 'Ö', P: 'Þ', Q: 'Ǫ', R: 'Ŕ', S: 'Š', T: 'Ţ', U: 'Û', V: 'Ṽ', W: 'Ŵ', X: 'Ẋ', Y: 'Ý', Z: 'Ž',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'A', 'E', 'I', 'O', 'U']);

export function pseudoAccent(text: string): string {
  let out = '';
  for (const ch of text) {
    const accented = ACCENTS[ch] ?? ch;
    out += VOWELS.has(ch) ? accented + accented.toLowerCase() : accented;
  }
  return out;
}

/**
 * Right-to-left override around the text (RLO … PDF), inside a right-to-left
 * isolate (RLI … PDI). The isolate matters when a message has a number or a
 * name between two literal runs ("Start game · {count} players"): without
 * it the overridden runs and the number nest at different embedding levels
 * and the bidi algorithm lays them out in left-to-right order, a garble no
 * real Arabic message would show. Isolated, each run is one neutral unit of
 * the right-to-left line and the sentence reads in order from the right.
 */
export function pseudoBidi(text: string): string {
  return text.trim() ? `\u2067\u202e${text}\u202c\u2069` : text;
}

export type PseudoMode = 'accent' | 'bidi';

export function pseudoTransform(mode: PseudoMode): (text: string) => string {
  return mode === 'accent' ? pseudoAccent : pseudoBidi;
}
