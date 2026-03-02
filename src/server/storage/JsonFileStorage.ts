import fs from 'fs/promises';
import path from 'path';
import { GameLog } from '../../shared/gameLogTypes';
import { GameLogStorage } from './GameLogStorage';

const DEFAULT_DIR = path.join(process.cwd(), 'data', 'game-logs');

export class JsonFileStorage implements GameLogStorage {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? DEFAULT_DIR;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
  }

  async saveGameLog(log: GameLog): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.dir, `${log.gameId}.json`);
    await fs.writeFile(filePath, JSON.stringify(log, null, 2));
  }

  async getGameLogs(): Promise<GameLog[]> {
    await this.ensureDir();
    const files = await fs.readdir(this.dir);
    const logs: GameLog[] = [];
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const data = await fs.readFile(path.join(this.dir, file), 'utf-8');
      logs.push(JSON.parse(data));
    }
    return logs;
  }

  async getGameLog(gameId: string): Promise<GameLog | null> {
    const filePath = path.join(this.dir, `${gameId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
}
