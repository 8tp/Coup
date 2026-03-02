import { ActionType, Character, LogEntry, RoomPlayer } from '../shared/types';
import { GameLog, PlayerSummary, GameStats } from '../shared/gameLogTypes';
import { GameEngine } from '../engine/GameEngine';

export class GameLogger {
  static buildGameLog(
    engine: GameEngine,
    roomPlayers: RoomPlayer[],
    source: 'online' | 'simulation',
  ): GameLog {
    const game = engine.game;
    const actionLog = game.actionLog;
    const now = Date.now();

    // Find start/end timestamps from the log
    const startTimestamp = actionLog.length > 0 ? actionLog[0].timestamp : now;
    const endTimestamp = actionLog.length > 0 ? actionLog[actionLog.length - 1].timestamp : now;

    // Build elimination order by scanning log for 'elimination' events
    const eliminationOrder = this.buildEliminationOrder(actionLog);

    // Build player summaries
    const players: PlayerSummary[] = game.players.map(p => {
      const roomPlayer = roomPlayers.find(rp => rp.id === p.id);
      return {
        id: p.id,
        name: p.name,
        isBot: roomPlayer?.isBot ?? false,
        personality: roomPlayer?.personality ?? null,
        finalCoins: p.coins,
        revealedCharacters: p.influences.filter(inf => inf.revealed).map(inf => inf.character),
        hiddenCharacters: p.influences.filter(inf => !inf.revealed).map(inf => inf.character),
        isAlive: p.isAlive,
        eliminationOrder: eliminationOrder.get(p.id) ?? null,
      };
    });

    const winnerId = game.winnerId ?? '';
    const winner = game.getPlayer(winnerId);

    return {
      gameId: `${game.roomCode}_${now}`,
      startedAt: new Date(startTimestamp).toISOString(),
      endedAt: new Date(endTimestamp).toISOString(),
      durationMs: endTimestamp - startTimestamp,
      playerCount: game.players.length,
      players,
      winnerId,
      winnerName: winner?.name ?? '',
      actionLog: [...actionLog],
      stats: this.buildStats(actionLog, game.turnNumber),
      source,
    };
  }

  private static buildEliminationOrder(log: LogEntry[]): Map<string, number> {
    const order = new Map<string, number>();
    let rank = 1;
    for (const entry of log) {
      if (entry.eventType === 'elimination' && entry.actorId) {
        order.set(entry.actorId, rank++);
      }
    }
    return order;
  }

  private static buildStats(log: LogEntry[], totalTurns: number): GameStats {
    const actionCounts: Record<string, number> = {};
    let totalChallenges = 0;
    let successfulChallenges = 0;
    let totalBlocks = 0;
    let totalEliminations = 0;

    // Map character claims to action types for counting
    const charToAction: Record<string, ActionType> = {
      [Character.Duke]: ActionType.Tax,
      [Character.Captain]: ActionType.Steal,
      [Character.Assassin]: ActionType.Assassinate,
      [Character.Ambassador]: ActionType.Exchange,
    };

    for (const entry of log) {
      switch (entry.eventType) {
        case 'income':
          actionCounts[ActionType.Income] = (actionCounts[ActionType.Income] || 0) + 1;
          break;
        case 'coup':
          actionCounts[ActionType.Coup] = (actionCounts[ActionType.Coup] || 0) + 1;
          break;
        case 'declare_action':
          // Foreign Aid is declared, not claimed
          actionCounts[ActionType.ForeignAid] = (actionCounts[ActionType.ForeignAid] || 0) + 1;
          break;
        case 'claim_action':
          if (entry.character) {
            const action = charToAction[entry.character];
            if (action) {
              actionCounts[action] = (actionCounts[action] || 0) + 1;
            }
          }
          break;
        case 'challenge':
        case 'block_challenge':
          totalChallenges++;
          break;
        case 'challenge_success':
        case 'block_challenge_success':
          successfulChallenges++;
          break;
        case 'block':
          totalBlocks++;
          break;
        case 'elimination':
          totalEliminations++;
          break;
      }
    }

    return {
      totalTurns,
      actionCounts,
      totalChallenges,
      successfulChallenges,
      totalBlocks,
      totalEliminations,
    };
  }
}
