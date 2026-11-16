'use client';

import { useRef, type CSSProperties } from 'react';
import { useIsomorphicLayoutEffect } from '../../anim/useFlight';
import { Character } from '@/shared/types';
import {
  CARD_ART_DIMENSIONS,
  CARD_BACK_ART,
  CARD_BACK_FOCUS_ART,
  CHARACTER_CARD_ART,
  CHARACTER_CARD_FOCUS_ART,
} from '../../utils/assets';
import { CHARACTER_GLYPHS } from '../icons';
import { characterGlyphVars } from '../../utils/characterPalette';
import { characterName, useT } from '../../i18n';

let graphemes: Intl.Segmenter | null = null;

/**
 * How many characters a label holds, as the reader sees them: grapheme
 * clusters, so a Devanagari syllable with its vowel marks counts once, and an
 * accented Vietnamese letter counts once.
 */
export function labelLength(text: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    graphemes ??= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    let n = 0;
    for (const _ of graphemes.segment(text)) n++;
    return n;
  }
  return [...text].length;
}

/**
 * The plates' size steps, picked by length. The thresholds are the ones the
 * English names were tuned against (AMBASSADOR and INQUISITOR at 10 are
 * "extra long"). A word still wider than its plate is fitted by `fitLabel`.
 */
export function nameFit(length: number): string {
  return length >= 9 ? 'card-label-extra-long' : length >= 7 ? 'card-label-medium' : '';
}

export function actionFit(length: number): string {
  return length >= 8 ? 'card-label-medium' : '';
}

interface CardArtworkProps {
  character: Character;
  className?: string;
  variant?: 'full' | 'focus';
  priority?: boolean;
}

export function CardArtwork({ character, className = '', variant = 'full', priority = false }: CardArtworkProps) {
  const src = variant === 'focus' ? CHARACTER_CARD_FOCUS_ART[character] : CHARACTER_CARD_ART[character];

  return (
    <img
      src={src}
      alt=""
      width={CARD_ART_DIMENSIONS.width}
      height={CARD_ART_DIMENSIONS.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      draggable={false}
    />
  );
}

interface CardBackArtworkProps {
  className?: string;
  variant?: 'full' | 'focus';
  priority?: boolean;
}

export function CardBackArtwork({ className = '', variant = 'full', priority = false }: CardBackArtworkProps) {
  const src = variant === 'focus' ? CARD_BACK_FOCUS_ART : CARD_BACK_ART;

  return (
    <img
      src={src}
      alt=""
      width={CARD_ART_DIMENSIONS.width}
      height={CARD_ART_DIMENSIONS.height}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      draggable={false}
    />
  );
}

interface CharacterCardGlyphProps {
  character: Character;
}

const CHARACTER_CORNER_CHIP: CSSProperties = {
  position: 'absolute',
  top: 3,
  right: 3,
  /* Above `.card-face::before` (z 2, the hue band) so a wide band never clips
     it, and below `.card-face::after` (z 5, the trim hairline) so the card's
     frame still prints over everything. `.card-label-plate` is z 3 and is at
     the other end of the card. */
  zIndex: 4,
  width: 'min(42%, 40px)',
  aspectRatio: '1 / 1',
  display: 'block',
  /* The card is clickable on six of its seven surfaces. */
  pointerEvents: 'none',
  borderRadius: 3,
  backgroundColor: 'rgba(0, 0, 0, 0.86)',
  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.55)',
};

/* Full-bleed: rule 6 already gives every glyph a ~6px margin inside the 64
   grid, so the tile gets its optical padding from the artwork instead of from
   a percentage padding — which would have resolved against the CARD's width,
   not the tile's, and eaten half the mark on a 44px card. */
const CHARACTER_CORNER_GLYPH_CLASS = 'block h-full w-full';

/**
 * THE CORNER INDEX — ART-DIRECTION.md §1.2's character silhouette, printed on
 * the card. This is the thing §1.2 asks for when it says a character is
 * identified by "glyph silhouette first, colour second".
 *
 * ── WHY IT HAS TO EXIST AT ALL ───────────────────────────────────────────
 * Until now the only non-textual character signal on a card was the hue band
 * down the left edge, and §2.2 deliberately sets the Assassin at 206°/S15 —
 * near-achromatic cold steel — noting "the fix here is the glyph, not the hue".
 * With no glyph drawn, that band was invisible by design with nothing standing
 * in for it: the Assassin was an unmarked card. §2.4 adds that Assassin and
 * Captain are ONE degree of hue apart. Colour cannot separate those two, and
 * for a colourblind player it cannot separate any of the six. The silhouette is
 * the channel that can, so it has to be on the card, not only in the log.
 *
 * ── WHY TOP-RIGHT ────────────────────────────────────────────────────────
 * The card has exactly two unclaimed regions and this takes the one that
 * collides with nothing:
 *   - the LEFT edge is the printed hue band (`.card-face::before`), which
 *     "runs the whole exposed height" so a row of seats reads as a colour
 *     index. Putting the glyph there would cap the band on every card.
 *   - the BOTTOM 46% is `.card-label-plate`, a near-opaque wash carrying a type
 *     system tuned across five card sizes (`.card-face-sm/md/lg`,
 *     `.card-reveal-face`, `.card-preview-face`) with four length-fit classes.
 *     Nothing goes in there.
 *   - the TOP-RIGHT is free at every one of those five sizes, and it puts the
 *     shape channel and the colour channel on opposite edges of the card, so
 *     they are two reads rather than one crowded one.
 * It is also just where a playing card's index goes.
 *
 * ── WHY IT IS NOT A TRANSFORM AUTHOR ─────────────────────────────────────
 * Read the header of `CardFace.tsx`: `.card-face` composes --press-s/--card-lift
 * into one transform and `.card-flip-wrapper` carries the flight contract
 * --fx/--fy/--tilt/--fs. A third author on either element breaks one of them.
 * This element has NO transform, NO animation and NO transition — it is static
 * print inside the card, so it inherits both poses for free by being a child.
 *
 * ── SIZING ───────────────────────────────────────────────────────────────
 * `min(42%, 40px)` of the card's width, not a fixed px and not a pure
 * percentage. §1.2 requires legibility at 14x14 and the smallest card is 44x64,
 * where 42% lands the glyph at ~14.9px — on spec. A pure percentage would then
 * put a 74px chip on the 176px preview card, which is a poster, not an index;
 * the 40px cap holds it to a corner mark at presentation sizes. Everything
 * scales without touching globals.css, including the `.seat-cards` media query
 * that widens `card-face-sm` to 3.5rem on larger screens.
 *
 * The chip is a near-opaque black tile because the glyph prints over raster
 * gouache whose value varies per pixel and per character (§2.3 lists card art
 * as an UNMEASURED contrast case). Against the tile the hue is on a known
 * ground: the §2.3 figures for these six on `--ground` run 6.85:1 (Assassin) to
 * 9.50:1 (Ambassador), so even the weakest clears 4.5:1 with room to spare. The
 * 1px keyline is the same device the band uses for the same reason — it gives
 * the tile a guaranteed edge over a light passage of art.
 */
export function CharacterCardGlyph({ character }: CharacterCardGlyphProps) {
  const CharacterGlyph = CHARACTER_GLYPHS[character];

  return (
    <span
      style={{ ...CHARACTER_CORNER_CHIP, ...characterGlyphVars(character) }}
      aria-hidden="true"
      data-character-glyph={character}
    >
      <CharacterGlyph className={CHARACTER_CORNER_GLYPH_CLASS} />
    </span>
  );
}

interface CharacterCardBadgeProps {
  character: Character;
}

/**
 * The printed furniture on a character card: the corner silhouette (§1.2's
 * shape channel) and the bottom label plate (the type channel).
 *
 * They ship as one component on purpose. Seven surfaces render a card face —
 * the table, the exchange tray, the challenge reveal, the examine prompt, the
 * preview modal, How to Play and both tutorials — and every one of them already
 * calls this. Emitting the glyph from here is what makes "a character is
 * identifiable by shape" true on all seven at once instead of on whichever ones
 * someone remembered to update. The two children are absolutely positioned at
 * opposite ends of the card and never meet.
 */
/** Below half its tuned size a word stops shrinking and wraps instead. */
const LABEL_FIT_FLOOR = 0.5;

/**
 * Shrink a label that is wider than its plate, so a long name in another
 * language fits rather than being clipped. A label that fits is left at the
 * size its class sets, so nothing changes for a word that already fit.
 * Measured at the tuned size every time, so it also grows back.
 */
export function fitLabel(el: HTMLElement): void {
  el.style.removeProperty('--label-fit');
  delete el.dataset.wrap;
  const room = el.clientWidth;
  const need = el.scrollWidth;
  // A hidden plate (display: none at some sizes) measures 0: nothing to fit.
  if (room <= 0 || need <= room + 0.5) return;
  // 3% under the exact ratio: text width does not scale quite linearly with
  // font size (hinting, rounding), and `scrollWidth` is a whole pixel.
  const fit = Math.floor((room / need) * 0.97 * 1000) / 1000;
  if (fit >= LABEL_FIT_FLOOR) {
    el.style.setProperty('--label-fit', String(fit));
  } else {
    el.style.setProperty('--label-fit', String(LABEL_FIT_FLOOR));
    el.dataset.wrap = 'true';
  }
}

/**
 * One observer for every label on screen: a plate's width changes with the
 * breakpoint (seat and hand cards are sized off the viewport), and only a
 * change of width can change the fit. Created on first use, in the browser.
 */
let labelObserver: ResizeObserver | null = null;
const labelWidths = new WeakMap<Element, number>();

function observeLabel(el: HTMLElement): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  labelObserver ??= new ResizeObserver(entries => {
    for (const entry of entries) {
      const width = entry.contentRect.width;
      if (labelWidths.get(entry.target) === width) continue;
      labelWidths.set(entry.target, width);
      fitLabel(entry.target as HTMLElement);
    }
  });
  labelObserver.observe(el);
  return () => {
    labelObserver?.unobserve(el);
    labelWidths.delete(el);
  };
}

export function CharacterCardBadge({ character }: CharacterCardBadgeProps) {
  const t = useT();
  /* Printed in capitals by CSS (`.card-character-label`), which leaves
     scripts without case alone; the catalog holds the names as words. */
  const name = characterName(t, character);
  const action = t(`game.cardAction.${character}`);
  const nameRef = useRef<HTMLSpanElement>(null);
  const actionRef = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const els = [nameRef.current, actionRef.current].filter((el): el is HTMLSpanElement => el !== null);
    els.forEach(fitLabel);
    const stops = els.map(observeLabel);
    return () => stops.forEach(stop => stop());
  }, [name, action]);

  return (
    <>
      <CharacterCardGlyph character={character} />
      <span className="card-label-plate">
        <span ref={nameRef} className={`card-character-label ${nameFit(labelLength(name))}`}>
          {name}
        </span>
        <span ref={actionRef} className={`card-action-label ${actionFit(labelLength(action))}`}>
          {action}
        </span>
      </span>
    </>
  );
}
