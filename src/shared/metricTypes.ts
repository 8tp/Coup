import { BotPersonality, BotReplaceReason, GameMode, RoomOrigin } from './types';

/** Server-only per-room funnel bookkeeping held by RoomManager (never sent to clients). */
export interface RoomMeta {
  /** Random, non-reversible id used as `room` in metric lines (room codes are join credentials). */
  metricId: string;
  origin: RoomOrigin;
  gamesStarted: number;
  gamesFinished: number;
  currentGame: {
    gameId: string;
    startedAt: number;
    /** Seat counts at game start. */
    humans: number;
    bots: number;
    rematchIndex: number;
    finishedRecorded: boolean;
  } | null;
}

// ─── Structured Metric Events ───
// One JSON line per event, emitted by src/server/metrics.ts. These payloads
// must never contain IPs, socket ids, session tokens, chat text, or player names.

export type RoomCloseReason = 'empty' | 'ttl' | 'inactive';

export interface RoomCreatedMetric {
  event: 'room_created';
  /** Per-room random metric id — never the room code. */
  room: string;
  isPublic: boolean;
  viaQuickPlay: boolean;
  practice: boolean;
}

export interface RoomClosedMetric {
  event: 'room_closed';
  room: string;
  reason: RoomCloseReason;
  everStarted: boolean;
  gamesStarted: number;
  gamesPlayed: number;
  ageMs: number;
  isPublic: boolean;
  viaQuickPlay: boolean;
  practice: boolean;
}

export interface GameStartedMetric {
  event: 'game_started';
  room: string;
  gameId: string;
  players: number;
  humans: number;
  bots: number;
  /** Bot personalities as configured in the lobby ('random' stays 'random'). */
  botPersonalities: BotPersonality[];
  /** Humans whose socket was down at the moment the host pressed Start. */
  disconnectedHumans: number;
  gameMode: GameMode;
  useInquisitor: boolean;
  actionTimerMs: number;
  turnTimerMs: number;
  isPublic: boolean;
  viaQuickPlay: boolean;
  practice: boolean;
  /** 0 for the first game in a room, 1 for the first rematch, ... */
  rematchIndex: number;
}

export interface GameFinishedMetric {
  event: 'game_finished';
  room: string;
  gameId: string;
  durationMs: number;
  turns: number;
  winnerIsBot: boolean;
  /** Winner was a human seat that had been handed to a bot. */
  winnerWasReplaced: boolean;
  /** Seat counts as of game start. */
  humans: number;
  bots: number;
  /** Human seats handed to bots during the game (disconnect / left / afk). */
  replacedByBot: number;
  eliminations: number;
  gameMode: GameMode;
  useInquisitor: boolean;
  isPublic: boolean;
  viaQuickPlay: boolean;
  practice: boolean;
  rematchIndex: number;
}

export interface GameAbandonedMetric {
  event: 'game_abandoned';
  room: string;
  gameId: string;
  durationMs: number;
  turns: number;
  humans: number;
  bots: number;
  reason: RoomCloseReason;
}

export interface PlayerReplacedByBotMetric {
  event: 'player_replaced_by_bot';
  room: string;
  gameId: string | null;
  reason: BotReplaceReason;
  turn: number;
}

export type MetricEvent =
  | RoomCreatedMetric
  | RoomClosedMetric
  | GameStartedMetric
  | GameFinishedMetric
  | GameAbandonedMetric
  | PlayerReplacedByBotMetric;

/** Aggregate, PII-free numbers served by GET /api/stats when durable storage is configured. */
export interface AggregateGameStats {
  totalGames: number;
  gamesLast7Days: number;
  gamesLast30Days: number;
  medianDurationMsLast30Days: number | null;
  soloVsBotsGamesLast30Days: number;
  byGameModeLast30Days: Record<string, number>;
  byPlayerCountLast30Days: Record<string, number>;
  generatedAt: string;
}
