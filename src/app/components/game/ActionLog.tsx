'use client';

import { useRef, useEffect } from 'react';
import { LogEntry } from '@/shared/types';

interface ActionLogProps {
  log: LogEntry[];
}

export function ActionLog({ log }: ActionLogProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log.length]);

  // Always show last 8 entries
  const recentLog = log.slice(-8);

  return (
    <div className="bg-coup-bg/60 rounded-lg border border-gray-800 px-3 py-2">
      <div className="space-y-0.5 overflow-y-auto max-h-28">
        {recentLog.length === 0 && (
          <p className="text-xs text-gray-600 italic">Game starting...</p>
        )}
        {recentLog.map((entry, i) => {
          const isLatest = i === recentLog.length - 1;
          return (
            <p key={log.length - recentLog.length + i} className={`text-xs ${isLatest ? 'text-gray-200 font-medium' : 'text-gray-500'}`}>
              {entry.message}
            </p>
          );
        })}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
