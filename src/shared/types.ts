// ─── Character Cards ───
export enum Character {
  Duke = 'Duke',
  Assassin = 'Assassin',
  Captain = 'Captain',
  Ambassador = 'Ambassador',
  Contessa = 'Contessa',
}

// ─── Actions ───
export enum ActionType {
  Income = 'Income',
  ForeignAid = 'ForeignAid',
  Coup = 'Coup',
  Tax = 'Tax',
  Assassinate = 'Assassinate',
  Steal = 'Steal',
  Exchange = 'Exchange',
}

// ─── Turn Phases ───
export enum TurnPhase {
  AwaitingAction = 'AwaitingAction',
  AwaitingActionChallenge = 'AwaitingActionChallenge',
  AwaitingBlock = 'AwaitingBlock',
  AwaitingBlockChallenge = 'AwaitingBlockChallenge',
  AwaitingInfluenceLoss = 'AwaitingInfluenceLoss',
  AwaitingExchange = 'AwaitingExchange',
  ActionResolved = 'ActionResolved',
  GameOver = 'GameOver',
}

// ─── Game Status ───
export enum GameStatus {
  Lobby = 'Lobby',
  InProgress = 'InProgress',
  Finished = 'Finished',
}

// ─── Influence (a card held by a player) ───
export interface Influence {
  character: Character;
  revealed: boolean;
}

// ─── Player State ───
export interface PlayerState {
  id: string;
  name: string;
  coins: number;
  influences: Influence[];
  isAlive: boolean;
  /** Index in the turn order */
  seatIndex: number;
}

// ─── Pending Action ───
export interface PendingAction {
  type: ActionType;
  actorId: string;
  targetId?: string;
  /** Character claimed for this action (e.g., Duke for Tax) */
  claimedCharacter?: Character;
}

// ─── Pending Block ───
export interface PendingBlock {
  blockerId: string;
  claimedCharacter: Character;
}

// ─── Action Challenge / Block Challenge result tracking ───
export interface ChallengeState {
  challengerId: string;
  challengedPlayerId: string;
  claimedCharacter: Character;
  /** Which players have passed on challenging (used during the challenge window) */
  passedPlayerIds: string[];
}

// ─── Influence Loss Tracking ───
export interface InfluenceLossRequest {
  playerId: string;
  reason: 'challenge_lost' | 'assassination' | 'coup' | 'challenge_failed_defense';
}

// ─── Exchange State ───
export interface ExchangeState {
  playerId: string;
  /** Cards the player can choose from (their current + drawn) */
  drawnCards: Character[];
}

// ─── Full Game State (server-side, authoritative) ───
export interface GameState {
  roomCode: string;
  status: GameStatus;
  players: PlayerState[];
  /** Index into players array for whose turn it is */
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  /** Court deck (hidden from all clients) */
  deck: Character[];
  /** Treasury coins (conceptually unlimited, but tracked) */
  treasury: number;

  // Turn-specific state
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  challengeState: ChallengeState | null;
  influenceLossRequest: InfluenceLossRequest | null;
  exchangeState: ExchangeState | null;

  // Block pass tracking
  blockPassedPlayerIds: string[];

  // Action log
  actionLog: LogEntry[];

  // Timer
  timerExpiry: number | null;

  // Winner
  winnerId: string | null;

  // Turn number for tracking
  turnNumber: number;
}

// ─── Log Entry ───
export interface LogEntry {
  message: string;
  timestamp: number;
}

// ─── Client-visible state (what gets sent to each player) ───
export interface ClientGameState {
  roomCode: string;
  status: GameStatus;
  players: ClientPlayerState[];
  currentPlayerIndex: number;
  turnPhase: TurnPhase;
  deckCount: number;
  treasury: number;
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  challengeState: ClientChallengeState | null;
  influenceLossRequest: InfluenceLossRequest | null;
  /** Only set if the current client is the one exchanging */
  exchangeState: ClientExchangeState | null;
  blockPassedPlayerIds: string[];
  actionLog: LogEntry[];
  timerExpiry: number | null;
  winnerId: string | null;
  turnNumber: number;
  /** The client's own player ID */
  myId: string;
}

export interface ClientPlayerState {
  id: string;
  name: string;
  coins: number;
  influences: ClientInfluence[];
  isAlive: boolean;
  seatIndex: number;
  isBot?: boolean;
}

export interface ClientInfluence {
  /** Only visible if revealed or if this is the client's own card */
  character: Character | null;
  revealed: boolean;
}

export interface ClientChallengeState {
  challengerId: string;
  challengedPlayerId: string;
  claimedCharacter: Character;
  passedPlayerIds: string[];
}

export interface ClientExchangeState {
  /** All cards the player can choose from */
  availableCards: Character[];
  /** How many cards the player must keep */
  keepCount: number;
}

// ─── AI Personality ───
export interface AiPersonality {
  honesty: number;     // 0–100
  skepticism: number;  // 0–100
  vengefulness: number; // 0–100
}

// ─── Room ───
export interface Room {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  createdAt: number;
}

export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
  isBot?: boolean;
  personality?: AiPersonality;
}

// ─── Chat ───
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}
