'use client';

import { useSettingsStore } from '../stores/settingsStore';
import { useMediaQuery } from './useMediaQuery';

/**
 * True when the player asked for less motion — in Settings ("Reduced
 * Animation") or in the OS. Components use it to drop JS-timed beats (a
 * reveal that waits for a flip) to zero; CSS handles the rest.
 */
export function useReducedMotion(): boolean {
  const setting = useSettingsStore(s => s.reducedMotionEnabled);
  const media = useMediaQuery('(prefers-reduced-motion: reduce)');
  return setting || media;
}
