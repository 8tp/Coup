'use client';

import type { LogEntry } from '@/shared/types';
import { LogStamp, logKind, renderLogText, useLogContext } from '../LogLine';

/**
 * The last few things that happened, beside your hand. The full log lives in
 * the drawer; this is the glance that answers "what just happened?" without
 * opening it. Newest at the bottom, nearest the hand, fading upward. Lines
 * are the drawer's own (LogLine), in the reader's language.
 */
export function LogTicker({ log, count = 4, onOpen }: { log: LogEntry[]; count?: number; onOpen: () => void }) {
  const ctx = useLogContext();
  const recent = log.filter(e => e.eventType !== 'turn_start').slice(-count);
  if (recent.length === 0) return null;
  return (
    <button type="button" className="log-ticker" onClick={onOpen} aria-label={ctx.t('log.openFull')}>
      {recent.map((entry, i) => (
        <span
          key={`${entry.timestamp}-${i}`}
          className="log-ticker-line"
          data-kind={logKind(entry)}
          style={{ opacity: 0.4 + (0.6 * (i + 1)) / recent.length }}
        >
          <LogStamp entry={entry} />
          <span className="log-ticker-text">{renderLogText(entry, ctx)}</span>
        </span>
      ))}
    </button>
  );
}
