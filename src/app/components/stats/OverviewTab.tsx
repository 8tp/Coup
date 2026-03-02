'use client';

import { LifetimeStats } from '../../types/stats';
import { ActionType } from '@/shared/types';
import { ACTION_DISPLAY_NAMES } from '@/shared/constants';

interface OverviewTabProps {
  lifetime: LifetimeStats;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-coup-bg/60 rounded-xl border border-gray-800 p-3">
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-lg font-bold text-gray-200">{value}</p>
    </div>
  );
}

function getFavoriteAction(actionCounts: Partial<Record<ActionType, number>>): string {
  let best: string | null = null;
  let bestCount = 0;
  for (const [action, count] of Object.entries(actionCounts)) {
    if ((count ?? 0) > bestCount) {
      bestCount = count ?? 0;
      best = action;
    }
  }
  return best ? ACTION_DISPLAY_NAMES[best as ActionType] ?? best : '-';
}

export function OverviewTab({ lifetime }: OverviewTabProps) {
  if (lifetime.gamesPlayed === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 text-sm">No games played yet.</p>
        <p className="text-gray-600 text-xs mt-1">Play a game to start tracking your stats!</p>
      </div>
    );
  }

  const winRate = lifetime.gamesPlayed > 0
    ? `${Math.round((lifetime.gamesWon / lifetime.gamesPlayed) * 100)}%`
    : '0%';

  const challengeAccuracy = lifetime.challengesMade > 0
    ? `${Math.round((lifetime.challengesWon / lifetime.challengesMade) * 100)}%`
    : '-';

  return (
    <div className="grid grid-cols-2 gap-2">
      <StatCard label="Games Played" value={lifetime.gamesPlayed} />
      <StatCard label="Games Won" value={lifetime.gamesWon} />
      <StatCard label="Win Rate" value={winRate} />
      <StatCard label="Win Streak" value={`${lifetime.currentWinStreak} (Best: ${lifetime.bestWinStreak})`} />
      <StatCard label="Challenges Made" value={lifetime.challengesMade} />
      <StatCard label="Challenges Won" value={`${lifetime.challengesWon} (${challengeAccuracy})`} />
      <StatCard label="Blocks Made" value={lifetime.blocksMade} />
      <StatCard label="Successful Bluffs" value={lifetime.successfulBluffs} />
      <StatCard label="Times Caught" value={lifetime.timesCaughtBluffing} />
      <StatCard label="Coups" value={lifetime.coupsMade} />
      <StatCard label="Assassinations" value={lifetime.assassinationsMade} />
      <StatCard label="First Eliminated" value={lifetime.firstEliminatedCount} />
      <StatCard label="Total Turns" value={lifetime.totalTurns} />
      <StatCard label="Favorite Action" value={getFavoriteAction(lifetime.actionCounts)} />
    </div>
  );
}
