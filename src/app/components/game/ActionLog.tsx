'use client';

import { useRef, useEffect } from 'react';
import { LogEntry } from '@/shared/types';
import { LOG_EVENT_ICONS, CHARACTER_COLORS } from '@/shared/constants';
import { formatLogMessage } from '@/app/utils/logFormat';

interface ActionLogProps {
  log: LogEntry[];
  myName: string;
  turnPhase?: string;
}

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

export function ActionLog({ log, myName, turnPhase }: ActionLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

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
          <p className="text-sm text-gray-600 italic">Game starting...</p>
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
                const icon = LOG_EVENT_ICONS[entry.eventType] ?? '';
                const isLatestGroup = gi === turnGroups.length - 1;
                const isLatestEntry = isLatestGroup && ei === group.length - 1;
                const message = formatLogMessage(entry.message, myName);

                return (
                  <p
                    key={`${entry.turnNumber}-${ei}`}
                    className={`text-sm ${
                      isLatestEntry
                        ? 'text-gray-200 font-medium'
                        : 'text-gray-400'
                    }`}
                  >
                    <span className="mr-1">{icon}</span>
                    {message}
                  </p>
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
