'use client';

import { useState } from 'react';
import { GameHistoryEntry } from '../../types/stats';

interface HistoryTabProps {
  history: GameHistoryEntry[];
}

const dateFormatter = typeof Intl !== 'undefined'
  ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  : null;

function formatDate(ts: number): string {
  if (dateFormatter) return dateFormatter.format(new Date(ts));
  return new Date(ts).toLocaleDateString();
}

function HistoryRow({ entry }: { entry: GameHistoryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-800 last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-coup-bg/40 transition-colors"
        onClick={() => setExpanded(v => !v)}
      >
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-none ${
          entry.won ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-300'
        }`}>
          {entry.won ? 'W' : 'L'}
        </span>
        <span className="text-sm text-gray-300 flex-1 min-w-0 truncate">
          {formatDate(entry.timestamp)}
        </span>
        <span className="text-xs text-gray-500 flex-none">
          {entry.playerCount}P
        </span>
        <span className="text-xs text-gray-500 flex-none">
          {entry.turnCount}T
        </span>
        <span className="text-xs text-gray-600 flex-none">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>Challenges: {entry.challengesMade} ({entry.challengesWon} won)</span>
          <span>Blocks: {entry.blocksMade}</span>
          <span>Coups: {entry.coupsMade}</span>
          <span>Assassinations: {entry.assassinationsMade}</span>
          {entry.awardsEarned.length > 0 && (
            <span className="col-span-2 text-yellow-500">
              Awards: {entry.awardsEarned.join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryTab({ history }: HistoryTabProps) {
  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">No games played yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-coup-bg/60 rounded-xl border border-gray-800 max-h-80 overflow-y-auto">
      {history.map(entry => (
        <HistoryRow key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
