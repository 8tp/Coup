'use client';

import { LifetimeStats } from '../../types/stats';
import { isActionType, actionName } from '../../i18n/glossary';
import { useT, type Translator } from '../../i18n/react';

interface OverviewTabProps {
  lifetime: LifetimeStats;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-coup-bg/60 panel-sunk p-3">
      <p className="text-xs text-coup-ink-mute mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-200">{value}</p>
    </div>
  );
}

function getFavoriteAction(actionCounts: LifetimeStats['actionCounts'], t: Translator): string {
  let best: string | null = null;
  let bestCount = 0;
  for (const [action, count] of Object.entries(actionCounts)) {
    if ((count ?? 0) > bestCount) {
      bestCount = count ?? 0;
      best = action;
    }
  }
  if (!best) return t('stats.noValue');
  return isActionType(best) ? actionName(t, best) : best;
}

/** A whole-number percentage in the reader's format ("67%", "67 %", "٪67"). */
function percent(t: Translator, ratio: number): string {
  return new Intl.NumberFormat(t.intl, { style: 'percent', maximumFractionDigits: 0 }).format(ratio);
}

export function OverviewTab({ lifetime }: OverviewTabProps) {
  const t = useT();
  if (lifetime.gamesPlayed === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-coup-ink-mute text-sm">{t('stats.empty')}</p>
        <p className="text-coup-ink-mute text-xs mt-1">{t('stats.emptyHint')}</p>
      </div>
    );
  }

  const winRate = percent(t, lifetime.gamesWon / lifetime.gamesPlayed);

  const challengeAccuracy = lifetime.challengesMade > 0
    ? percent(t, lifetime.challengesWon / lifetime.challengesMade)
    : t('stats.noValue');

  const n = (value: number) => t.number(value);

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label={t('stats.gamesPlayed')} value={n(lifetime.gamesPlayed)} />
      <StatCard label={t('stats.gamesWon')} value={n(lifetime.gamesWon)} />
      <StatCard label={t('stats.winRate')} value={winRate} />
      <StatCard label={t('stats.winStreak')} value={t('stats.winStreakValue', { current: lifetime.currentWinStreak, best: lifetime.bestWinStreak })} />
      <StatCard label={t('stats.challengesMade')} value={n(lifetime.challengesMade)} />
      <StatCard label={t('stats.challengesWon')} value={t('stats.challengesWonValue', { won: lifetime.challengesWon, accuracy: challengeAccuracy })} />
      <StatCard label={t('stats.blocksMade')} value={n(lifetime.blocksMade)} />
      <StatCard label={t('stats.successfulBluffs')} value={n(lifetime.successfulBluffs)} />
      <StatCard label={t('stats.timesCaught')} value={n(lifetime.timesCaughtBluffing)} />
      <StatCard label={t('stats.coups')} value={n(lifetime.coupsMade)} />
      <StatCard label={t('stats.assassinations')} value={n(lifetime.assassinationsMade)} />
      <StatCard label={t('stats.firstEliminated')} value={n(lifetime.firstEliminatedCount)} />
      <StatCard label={t('stats.totalTurns')} value={n(lifetime.totalTurns)} />
      <StatCard label={t('stats.favoriteAction')} value={getFavoriteAction(lifetime.actionCounts, t)} />
    </div>
  );
}
