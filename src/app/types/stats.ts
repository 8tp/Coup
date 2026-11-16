import { ActionType } from '@/shared/types';

export interface LifetimeStats {
  gamesPlayed: number;
  gamesWon: number;
  currentWinStreak: number;
  bestWinStreak: number;
  challengesMade: number;
  challengesWon: number;
  blocksMade: number;
  successfulBluffs: number;
  timesCaughtBluffing: number;
  coupsMade: number;
  assassinationsMade: number;
  firstEliminatedCount: number;
  totalTurns: number;
  actionCounts: Partial<Record<ActionType, number>>;
  /** Times each award was earned, by award id (`AwardId` in utils/gameStats.ts). */
  awardCounts: Record<string, number>;
}

export interface GameHistoryEntry {
  id: string;
  timestamp: number;
  won: boolean;
  playerCount: number;
  turnCount: number;
  challengesMade: number;
  challengesWon: number;
  blocksMade: number;
  coupsMade: number;
  assassinationsMade: number;
  /** Award ids. Stats saved before ids hold English award names; `normalizeStoredStats` converts them on load. */
  awardsEarned: string[];
}

export interface StoredPlayerStats {
  version: 1;
  deviceId: string;
  lifetime: LifetimeStats;
  history: GameHistoryEntry[];
}
