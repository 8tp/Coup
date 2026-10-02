'use client';

import type { LogEntry } from '@/shared/types';
import { LOG_EVENT_GLYPHS } from '../../../utils/logGlyphs';

/**
 * The last few things that happened, beside your hand. The full log lives in
 * the drawer; this is the glance that answers "what just happened?" without
 * opening it. Newest at the bottom, nearest the hand, fading upward.
 */
export function LogTicker({ log, count = 4, onOpen }: { log: LogEntry[]; count?: number; onOpen: () => void }) {
  const recent = log.filter(e => e.eventType !== 'turn_start').slice(-count);
  if (recent.length === 0) return null;
  return (
    <button type="button" className="log-ticker" onClick={onOpen} aria-label="Open the full game log">
      {recent.map((entry, i) => {
        const Glyph = LOG_EVENT_GLYPHS[entry.eventType];
        return (
          <span
            key={`${entry.timestamp}-${i}`}
            className="log-ticker-line"
            style={{ opacity: 0.4 + (0.6 * (i + 1)) / recent.length }}
          >
            {Glyph && <Glyph size={13} />}
            <span className="truncate">{entry.message}</span>
          </span>
        );
      })}
    </button>
  );
}
