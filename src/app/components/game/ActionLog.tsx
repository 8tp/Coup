'use client';

import { useRef, useEffect, useState } from 'react';
import { LogEntry, TurnPhase } from '@/shared/types';
import { CHARACTER_COLORS } from '@/shared/constants';
import { LOG_EVENT_GLYPHS } from '@/app/utils/logGlyphs';
import { formatLogMessage } from '@/app/utils/logFormat';
import { getLogExplanation } from '@/app/utils/logExplanations';
import { haptic } from '../../utils/haptic';

interface ActionLogProps {
  log: LogEntry[];
  myName: string;
  turnPhase?: string;
  showExplanations?: boolean;
}

/** Log event types that represent claims (where wasBluff is meaningful) */
const CLAIM_EVENT_TYPES = new Set(['claim_action', 'block']);

/**
 * Glyph gutter. The mark is 14px inside a 20px (`text-sm`/`leading-5`) line box
 * and is nudged down 3px so it centres against the cap height rather than the
 * line box. The column is a fixed-width flex item so it cannot jitter between
 * rows regardless of which glyph lands in it.
 */
const LOG_GLYPH_SIZE = 14;

/** Group consecutive entries by turnNumber */
function groupByTurn(entries: LogEntry[]): LogEntry[][] {
  const groups: LogEntry[][] = [];
  let current: LogEntry[] = [];
  let currentTurn: number | null = null;

  for (const entry of entries) {
    if (entry.turnNumber !== currentTurn) {
      if (current.length > 0) groups.push(current);
      current = [entry];
      currentTurn = entry.turnNumber;
    } else {
      current.push(entry);
    }
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/** Get the primary character color for a turn group */
function getGroupBorderColor(group: LogEntry[]): string {
  for (const entry of group) {
    if (entry.character && entry.character in CHARACTER_COLORS) {
      return CHARACTER_COLORS[entry.character];
    }
  }
  return '#4b5563'; // gray-600 fallback
}

export function ActionLog({ log, myName, turnPhase, showExplanations = false }: ActionLogProps) {
  const isGameOver = turnPhase === TurnPhase.GameOver;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedEntryKey, setExpandedEntryKey] = useState<string | null>(null);

  // Scroll to bottom on new entries or phase changes
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [log.length, turnPhase]);

  // Re-scroll when the container resizes (e.g. prompt appears/disappears)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      el.scrollTop = el.scrollHeight;
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const turnGroups = groupByTurn(log);

  return (
    <div className="px-3 py-2 flex-1 min-h-0 flex flex-col">
      <div ref={scrollRef} className="space-y-1.5 overflow-y-auto flex-1 min-h-0 pb-2">
        {log.length === 0 && (
          <p className="text-sm text-coup-ink-mute italic">Game starting...</p>
        )}
        {turnGroups.map((group, gi) => {
          const borderColor = getGroupBorderColor(group);
          return (
            <div
              key={`turn-${group[0].turnNumber}-${gi}`}
              className="pl-2 space-y-0.5"
              style={{ borderLeft: `3px solid ${borderColor}` }}
            >
              {group.map((entry, ei) => {
                const EventGlyph = LOG_EVENT_GLYPHS[entry.eventType];
                const isLatestGroup = gi === turnGroups.length - 1;
                const isLatestEntry = isLatestGroup && ei === group.length - 1;
                const message = formatLogMessage(entry.message, myName);
                const showBluffBadge = isGameOver && CLAIM_EVENT_TYPES.has(entry.eventType) && entry.wasBluff !== undefined;
                const explanation = showExplanations ? getLogExplanation(entry) : null;
                const entryKey = `${entry.timestamp}-${entry.turnNumber}-${gi}-${ei}`;
                const isExpanded = expandedEntryKey === entryKey;

                return (
                  <div key={entryKey}>
                    <div
                      className={`flex items-start gap-1.5 text-sm leading-5 ${
                        isLatestEntry
                          ? 'text-gray-200 font-medium'
                          : 'text-gray-400'
                      }`}
                    >
                      <span
                        className="mt-[3px] flex-none"
                        style={{ width: LOG_GLYPH_SIZE, height: LOG_GLYPH_SIZE }}
                      >
                        {EventGlyph && <EventGlyph size={LOG_GLYPH_SIZE} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        {message}
                        {showBluffBadge && (
                          <span className={`ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full align-middle ${
                            entry.wasBluff
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-green-500/15 text-green-400/80 border border-green-500/20'
                          }`}>
                            {entry.wasBluff ? 'BLUFF' : 'TRUE'}
                          </span>
                        )}
                        {explanation && (
                          <button
                            type="button"
                            className={`ml-1.5 rounded-full border px-1.5 py-0.5 text-[10px] font-bold align-middle transition ${
                              isExpanded
                                ? 'border-coup-accent text-coup-accent'
                                : 'border-coup-line text-coup-ink-mute hover:border-coup-accent hover:text-coup-accent'
                            }`}
                            onClick={() => {
                              haptic();
                              setExpandedEntryKey(isExpanded ? null : entryKey);
                            }}
                            aria-expanded={isExpanded}
                          >
                            Why?
                          </button>
                        )}
                      </span>
                    </div>
                    {explanation && isExpanded && (
                      <div className="mt-1 mb-1 panel-sunk bg-coup-surface/80 px-2 py-1.5 text-xs leading-snug text-gray-400">
                        {explanation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div />
      </div>
    </div>
  );
}
