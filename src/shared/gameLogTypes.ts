import { ActionType, BotPersonality, Character, LogEntry, TurnPhase } from './types';

// ─── Game Log Types ───
// Captured after each completed game for analysis.

export interface GameLog {
  gameId: string;              // "{roomCode}_{timestamp}"
  startedAt: string;           // ISO-8601
  endedAt: string;
  durationMs: number;
  playerCount: number;
  players: PlayerSummary[];
  winnerId: string;
  winnerName: string;
  actionLog: LogEntry[];
  stats: GameStats;
  source: 'online' | 'simulation';
  /** Per-decision snapshots — only populated by simulation */
  decisions?: DecisionRecord[];
}

export interface DecisionRecord {
  turnNumber: number;
  phase: TurnPhase;
  botName: string;
  botId: string;
  hand: Character[];          // Bot's hidden (unrevealed) cards at decision time
  coins: number;
  aliveCount?: number;        // Number of alive players at decision time
  decision: string;           // Serialized BotDecision type field
  /** For 'action' decisions: the ActionType chosen */
  action?: ActionType;
  /** For 'action' decisions: the target player name */
  targetName?: string;
  /** For 'block' decisions: the character claimed */
  blockCharacter?: Character;
  /** For 'choose_influence_loss': which card was revealed */
  lostCharacter?: Character;
  /** For 'choose_exchange': cards kept vs returned */
  exchangeKept?: Character[];
  exchangeReturned?: Character[];
  /** Was this action a bluff? (claimed character not in hand) */
  isBluff?: boolean;
}

export interface PlayerSummary {
  id: string;
  name: string;
  isBot: boolean;
  personality: BotPersonality | null;
  finalCoins: number;
  revealedCharacters: Character[];
  hiddenCharacters: Character[];
  isAlive: boolean;
  eliminationOrder: number | null; // 1-based, null for winner
}

export interface GameStats {
  totalTurns: number;
  actionCounts: Record<string, number>;
  totalChallenges: number;
  successfulChallenges: number;
  totalBlocks: number;
  totalEliminations: number;
}
