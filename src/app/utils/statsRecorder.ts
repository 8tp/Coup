import { ClientGameState, ActionType, TurnPhase } from '@/shared/types';
import { StoredPlayerStats, LifetimeStats, GameHistoryEntry } from '../types/stats';
import { computePlayerStats, computeAwards } from './gameStats';

const MAX_HISTORY = 50;

export function createEmptyStats(deviceId: string): StoredPlayerStats {
  return {
    version: 1,
    deviceId,
    lifetime: {
      gamesPlayed: 0,
      gamesWon: 0,
      currentWinStreak: 0,
      bestWinStreak: 0,
      challengesMade: 0,
      challengesWon: 0,
      blocksMade: 0,
      successfulBluffs: 0,
      timesCaughtBluffing: 0,
      coupsMade: 0,
      assassinationsMade: 0,
      firstEliminatedCount: 0,
      totalTurns: 0,
      actionCounts: {},
      awardCounts: {},
    },
    history: [],
  };
}

function generateGameId(gameState: ClientGameState): string {
  const lastLog = gameState.actionLog[gameState.actionLog.length - 1];
  const ts = lastLog?.timestamp ?? Date.now();
  return `${gameState.roomCode}-${gameState.turnNumber}-${ts}`;
}

function countMyTurns(gameState: ClientGameState, myId: string): number {
  return gameState.actionLog.filter(
    e => e.eventType === 'turn_start' && e.actorId === myId
  ).length;
}

function countMyActions(gameState: ClientGameState, myId: string): Partial<Record<ActionType, number>> {
  const counts: Partial<Record<ActionType, number>> = {};
  const log = gameState.actionLog;

  for (let i = 0; i < log.length; i++) {
    const entry = log[i];
    if (entry.actorId !== myId) continue;

    switch (entry.eventType) {
      case 'income':
        counts[ActionType.Income] = (counts[ActionType.Income] ?? 0) + 1;
        break;
      case 'coup':
        counts[ActionType.Coup] = (counts[ActionType.Coup] ?? 0) + 1;
        break;
      case 'declare_action':
        counts[ActionType.ForeignAid] = (counts[ActionType.ForeignAid] ?? 0) + 1;
        break;
      case 'claim_action': {
        const char = entry.character;
        if (!char) break;
        // Reverse lookup: character → ActionType
        switch (char) {
          case 'Duke': counts[ActionType.Tax] = (counts[ActionType.Tax] ?? 0) + 1; break;
          case 'Captain': counts[ActionType.Steal] = (counts[ActionType.Steal] ?? 0) + 1; break;
          case 'Assassin': counts[ActionType.Assassinate] = (counts[ActionType.Assassinate] ?? 0) + 1; break;
          case 'Ambassador': counts[ActionType.Exchange] = (counts[ActionType.Exchange] ?? 0) + 1; break;
        }
        break;
      }
    }
  }

  return counts;
}

export function recordGameResult(
  current: StoredPlayerStats,
  gameState: ClientGameState,
): StoredPlayerStats {
  const myId = gameState.myId;
  if (!myId || gameState.turnPhase !== TurnPhase.GameOver) return current;

  // Dedup guard
  const gameId = generateGameId(gameState);
  if (current.history.length > 0 && current.history[0].id === gameId) {
    return current;
  }

  // Compute per-player stats
  const playerIds = gameState.players.map(p => p.id);
  const playerNames = new Map<string, string>();
  for (const p of gameState.players) {
    playerNames.set(p.id, p.name);
  }
  const allStats = computePlayerStats(gameState.actionLog, playerIds, playerNames);
  const myStats = allStats.get(myId);
  if (!myStats) return current;

  // Awards for this game (use real names, not "You")
  const awardsForDisplay = computeAwards(gameState);
  const myName = playerNames.get(myId) ?? '';
  // computeAwards replaces myId name with "You", so match on "You"
  const myAwards = awardsForDisplay
    .filter(a => a.playerName === 'You')
    .map(a => a.title);

  const won = gameState.winnerId === myId;
  const myTurns = countMyTurns(gameState, myId);
  const myActionCounts = countMyActions(gameState, myId);
  const successfulBluffs = Math.max(0, myStats.actualBluffs - myStats.timesCaughtBluffing);

  // Build history entry
  const historyEntry: GameHistoryEntry = {
    id: gameId,
    timestamp: Date.now(),
    won,
    playerCount: gameState.players.length,
    turnCount: gameState.turnNumber,
    challengesMade: myStats.challengesMade,
    challengesWon: myStats.challengesWon,
    blocksMade: myStats.blocksMade,
    coupsMade: myStats.coupsMade,
    assassinationsMade: myStats.assassinationsMade,
    awardsEarned: myAwards,
  };

  // Update lifetime stats
  const lt = { ...current.lifetime };
  lt.gamesPlayed++;
  if (won) {
    lt.gamesWon++;
    lt.currentWinStreak++;
    lt.bestWinStreak = Math.max(lt.bestWinStreak, lt.currentWinStreak);
  } else {
    lt.currentWinStreak = 0;
  }
  lt.challengesMade += myStats.challengesMade;
  lt.challengesWon += myStats.challengesWon;
  lt.blocksMade += myStats.blocksMade;
  lt.successfulBluffs += successfulBluffs;
  lt.timesCaughtBluffing += myStats.timesCaughtBluffing;
  lt.coupsMade += myStats.coupsMade;
  lt.assassinationsMade += myStats.assassinationsMade;
  lt.totalTurns += myTurns;
  if (myStats.eliminationOrder === 1) {
    lt.firstEliminatedCount++;
  }

  // Merge action counts
  const newActionCounts = { ...lt.actionCounts };
  for (const [action, count] of Object.entries(myActionCounts)) {
    const key = action as ActionType;
    newActionCounts[key] = (newActionCounts[key] ?? 0) + (count ?? 0);
  }
  lt.actionCounts = newActionCounts;

  // Merge award counts
  const newAwardCounts = { ...lt.awardCounts };
  for (const title of myAwards) {
    newAwardCounts[title] = (newAwardCounts[title] ?? 0) + 1;
  }
  lt.awardCounts = newAwardCounts;

  // Prepend history, cap at MAX_HISTORY
  const newHistory = [historyEntry, ...current.history].slice(0, MAX_HISTORY);

  return {
    ...current,
    lifetime: lt,
    history: newHistory,
  };
}
