import { GameLog } from '../../shared/gameLogTypes';

export interface GameLogStorage {
  saveGameLog(log: GameLog): Promise<void>;
  getGameLogs(): Promise<GameLog[]>;
  getGameLog(gameId: string): Promise<GameLog | null>;
}
