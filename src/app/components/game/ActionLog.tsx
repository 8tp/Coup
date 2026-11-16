'use client';

import { useRef, useEffect, useState } from 'react';
import { LogEntry, TurnPhase } from '@/shared/types';
import { CHARACTER_PALETTE } from '@/app/utils/characterPalette';
import { getLogExplanation } from '@/app/utils/logExplanations';
import { haptic } from '../../utils/haptic';
import { LogStamp, logKind, renderLogKey, renderLogText, useLogContext } from './LogLine';

interface ActionLogProps {
  log: LogEntry[];
  /** Kept for callers; the reader is identified by id from the game store. */
  myName?: string;
  turnPhase?: string;
  showExplanations?: boolean;
  /** Players to name; defaults to the live game's. */
  players?: ReadonlyArray<{ id: string; name: string }>;
}

/** Log event types that represent claims (where wasBluff is meaningful) */
const CLAIM_EVENT_TYPES = new Set(['claim_action', 'block']);

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

/**
 * The turn rail takes the hue of the first character claimed that turn, as a
 * printed band along the group's edge (§1.2), or the hairline when nobody
 * claimed anything.
 */
function getGroupRailColor(group: LogEntry[]): string {
  for (const entry of group) {
    if (entry.character && entry.character in CHARACTER_PALETTE) {
      return CHARACTER_PALETTE[entry.character].hue;
    }
  }
  return 'var(--line)';
}

export function ActionLog({ log, turnPhase, showExplanations = false, players }: ActionLogProps) {
  const isGameOver = turnPhase === TurnPhase.GameOver;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedEntryKey, setExpandedEntryKey] = useState<string | null>(null);
  const ctx = useLogContext(players);
  const { t } = ctx;

  // Scroll to the newest line on new entries, phase changes and a language switch.
  useEffect(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [log.length, turnPhase, t]);

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
      <div ref={scrollRef} className="action-log space-y-1.5 overflow-y-auto flex-1 min-h-0 pb-2">
        {log.length === 0 && (
          <p className="text-sm text-coup-ink-mute italic">{t('log.empty')}</p>
        )}
        {turnGroups.map((group, gi) => (
          <div
            key={`turn-${group[0].turnNumber}-${gi}`}
            className="log-turn"
            style={{ borderInlineStartColor: getGroupRailColor(group) }}
          >
            {group.map((entry, ei) => {
              const isLatestGroup = gi === turnGroups.length - 1;
              const isLatestEntry = isLatestGroup && ei === group.length - 1;
              const showBluffBadge = isGameOver && CLAIM_EVENT_TYPES.has(entry.eventType) && entry.wasBluff !== undefined;
              const explanation = showExplanations ? getLogExplanation(entry) : null;
              const entryKey = `${entry.timestamp}-${entry.turnNumber}-${gi}-${ei}`;
              const isExpanded = expandedEntryKey === entryKey;

              return (
                <div key={entryKey}>
                  <div
                    className={`log-line ${isLatestEntry ? 'is-latest' : ''}`}
                    data-kind={logKind(entry)}
                  >
                    <LogStamp entry={entry} />
                    <span className="log-text">
                      {renderLogText(entry, ctx)}
                      {showBluffBadge && (
                        <span className={`log-verdict ${entry.wasBluff ? 'is-bluff' : 'is-honest'}`}>
                          {entry.wasBluff ? t('log.bluff') : t('log.honest')}
                        </span>
                      )}
                      {explanation && (
                        <button
                          type="button"
                          className={`log-explain ${isExpanded ? 'is-open' : ''}`}
                          onClick={() => {
                            haptic();
                            setExpandedEntryKey(isExpanded ? null : entryKey);
                          }}
                          aria-expanded={isExpanded}
                        >
                          {t('log.explain')}
                        </button>
                      )}
                    </span>
                  </div>
                  {explanation && isExpanded && (
                    <div className="mt-1 mb-1 panel-sunk bg-coup-surface/80 px-2 py-1.5 text-xs leading-snug text-gray-400">
                      {renderLogKey(explanation.key, explanation.params, ctx)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div />
      </div>
    </div>
  );
}
