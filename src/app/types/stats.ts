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
  awardsEarned: string[];
}

export interface StoredPlayerStats {
  version: 1;
  deviceId: string;
  lifetime: LifetimeStats;
  history: GameHistoryEntry[];
}
