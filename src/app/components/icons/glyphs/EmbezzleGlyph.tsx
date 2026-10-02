'use client';

import { Glyph, GlyphProps, HatchPattern, useHatchId } from './GlyphBase';

/**
 * Embezzle — empty the treasury reserve (Reformation). Replaces the money-bag emoji.
 * The strongbox carries a 45-degree line screen: the reserve is full. A coin is off the top.
 */
export function EmbezzleGlyph(props: GlyphProps) {
  const hatchId = useHatchId('embezzle-hatch');
  return (
    <Glyph {...props}>
      <defs>
        <HatchPattern id={hatchId} spacing={12} />
      </defs>
      <path d="M12 28h40v24H12z" fill={`url(#${hatchId})`} stroke="none" />
      <path d="M12 28h40v24H12z" />
      <circle cx="32" cy="14" r="8" fill="currentColor" stroke="none" />
    </Glyph>
  );
}
