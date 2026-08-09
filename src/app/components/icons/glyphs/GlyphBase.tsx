'use client';

import { useId, type ReactNode } from 'react';

/**
 * Shared chassis for the functional glyph set.
 *
 * Drawing rules (see ./index.ts for the full statement):
 *   - exactly two stroke widths, 6 and 3, at a 2:1 ratio
 *   - miter joins, butt caps, no rounded anything
 *   - no gradient, no blur, no soft shadow
 *   - hatch patterns instead of fill-opacity for tints
 *   - currentColor only
 *   - 64x64 grid, ~6px margin, legible at 16px
 */

/** Heavy weight — object lines and the load-bearing mark. */
export const GLYPH_STROKE_HEAVY = 6;
/** Light weight — secondary detail and frames. Exactly half the heavy weight. */
export const GLYPH_STROKE_LIGHT = 3;

export interface GlyphProps {
  /** Rendered box in px. The artwork is drawn on a 64px grid and scaled. */
  size?: number;
  className?: string;
  /**
   * Accessible name. When omitted the glyph is decorative (aria-hidden) and the
   * surrounding text is expected to carry the meaning.
   */
  title?: string;
}

export function Glyph({
  size = 24,
  className,
  title,
  children,
}: GlyphProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={GLYPH_STROKE_HEAVY}
      strokeLinejoin="miter"
      strokeLinecap="butt"
      strokeMiterlimit={10}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/**
 * A 45-degree line screen. Use this wherever a glyph needs a mid-tone: it reads
 * as the halftone screen it is imitating, where fill-opacity just reads as faded.
 * Pair with `useHatchId()` so multiple instances on a page do not collide.
 */
export function HatchPattern({
  id,
  spacing = 8,
  weight = GLYPH_STROKE_LIGHT,
}: {
  id: string;
  spacing?: number;
  weight?: number;
}) {
  return (
    <pattern
      id={id}
      width={spacing}
      height={spacing}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={spacing}
        stroke="currentColor"
        strokeWidth={weight}
        strokeLinecap="butt"
      />
    </pattern>
  );
}

/** Stable, collision-free id for a per-instance <pattern>. */
export function useHatchId(prefix: string): string {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}
