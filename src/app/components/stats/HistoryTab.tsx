'use client';

import { useMemo, useState } from 'react';
import { GameHistoryEntry } from '../../types/stats';
import { useT, type Translator } from '../../i18n/react';
import { storedAwardId } from '../../utils/statsRecorder';

interface HistoryTabProps {
  history: GameHistoryEntry[];
}

/**
 * Dates in the player's language. When that is the browser's own language
 * the browser's regional format wins (an English reader in the UK keeps
 * "16 Nov"); otherwise the app language's default region.
 */
function useDateFormatter(t: Translator): Intl.DateTimeFormat | null {
  return useMemo(() => {
    if (typeof Intl === 'undefined') return null;
    const browser = new Intl.DateTimeFormat().resolvedOptions().locale;
    const tag = browser.split('-')[0] === t.intl.split('-')[0] ? browser : t.intl;
    return new Intl.DateTimeFormat(tag, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }, [t.intl]);
}

function HistoryRow({ entry, t, dates }: { entry: GameHistoryEntry; t: Translator; dates: Intl.DateTimeFormat | null }) {
  const [expanded, setExpanded] = useState(false);
  const date = dates ? dates.format(new Date(entry.timestamp)) : new Date(entry.timestamp).toLocaleDateString();
  const awards = entry.awardsEarned
    .map(key => {
      const id = storedAwardId(key);
      return id ? t(`gameover.awardTitle.${id}`) : key;
    })
    .join(t('stats.listSeparator'));

  return (
    <div className="border-b border-coup-line/50 last:border-b-0">
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-start hover:bg-coup-bg/40 transition-colors"
        aria-expanded={expanded}
        onClick={() => setExpanded(v => !v)}
      >
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded flex-none ${
          entry.won ? 'bg-green-800 text-green-200' : 'bg-red-900 text-red-300'
        }`}>
          <span aria-hidden="true">{entry.won ? t('stats.historyWonShort') : t('stats.historyLostShort')}</span>
          <span className="sr-only">{entry.won ? t('stats.historyWon') : t('stats.historyLost')}</span>
        </span>
        <span className="text-sm text-gray-300 flex-1 min-w-0 truncate">
          {date}
        </span>
        <span className="text-xs text-coup-ink-mute flex-none">
          {t('stats.historyPlayers', { count: entry.playerCount })}
        </span>
        <span className="text-xs text-coup-ink-mute flex-none">
          {t('stats.historyTurns', { count: entry.turnCount })}
        </span>
        <span className="text-xs text-coup-ink-mute flex-none" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
          <span>{t('stats.historyChallenges', { made: entry.challengesMade, won: entry.challengesWon })}</span>
          <span>{t('stats.historyBlocks', { count: entry.blocksMade })}</span>
          <span>{t('stats.historyCoups', { count: entry.coupsMade })}</span>
          <span>{t('stats.historyAssassinations', { count: entry.assassinationsMade })}</span>
          {entry.awardsEarned.length > 0 && (
            <span className="col-span-2 text-yellow-500">
              {t('stats.historyAwards', { awards })}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function HistoryTab({ history }: HistoryTabProps) {
  const t = useT();
  const dates = useDateFormatter(t);

  if (history.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-coup-ink-mute text-sm">{t('stats.empty')}</p>
      </div>
    );
  }

  return (
    <div className="bg-coup-bg/60 panel-sunk max-h-80 overflow-y-auto">
      {history.map(entry => (
        <HistoryRow key={entry.id} entry={entry} t={t} dates={dates} />
      ))}
    </div>
  );
}
