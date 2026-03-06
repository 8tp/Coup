// ─── Character Cards ───
export enum Character {
  Duke = 'Duke',
  Assassin = 'Assassin',
  Captain = 'Captain',
  Ambassador = 'Ambassador',
  Contessa = 'Contessa',
  Inquisitor = 'Inquisitor',
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
  // Reformation expansion
  Convert = 'Convert',
  Embezzle = 'Embezzle',
  Examine = 'Examine',
}

// ─── Game Mode ───
export enum GameMode {
  Classic = 'Classic',
  Reformation = 'Reformation',
}

// ─── Factions (Reformation) ───
export enum Faction {
  Loyalist = 'Loyalist',
  Reformist = 'Reformist',
}

// ─── Turn Phases ───
export enum TurnPhase {
  AwaitingAction = 'AwaitingAction',
  AwaitingActionChallenge = 'AwaitingActionChallenge',
  AwaitingBlock = 'AwaitingBlock',
  AwaitingBlockChallenge = 'AwaitingBlockChallenge',
  AwaitingInfluenceLoss = 'AwaitingInfluenceLoss',
  AwaitingExchange = 'AwaitingExchange',
  AwaitingExamineDecision = 'AwaitingExamineDecision',
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
  /** Faction allegiance (Reformation mode only) */
  faction?: Faction;
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
  reason: 'challenge_lost' | 'assassination' | 'coup' | 'challenge_failed_defense' | 'embezzle_failed';
}

// ─── Examine State (Inquisitor) ───
export interface ExamineState {
  examinerId: string;
  targetId: string;
  /** The card the inquisitor is looking at (server-side, sent only to examiner) */
  revealedCard: Character;
  /** Index of the revealed influence on the target */
  influenceIndex: number;
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
  examineState: ExamineState | null;

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

  // Reformation expansion
  gameMode: GameMode;
  useInquisitor: boolean;
  /** Treasury Reserve / Almshouse (coins from conversions) */
  treasuryReserve: number;
}

// ─── Log Event Types ───
export type LogEventType =
  | 'game_start' | 'turn_start' | 'income' | 'coup'
  | 'claim_action' | 'declare_action'
  | 'challenge' | 'challenge_fail' | 'challenge_success'
  | 'block' | 'block_challenge' | 'block_challenge_fail' | 'block_challenge_success' | 'block_unchallenged'
  | 'influence_loss' | 'exchange' | 'exchange_draw'
  | 'action_resolve' | 'assassination' | 'elimination' | 'win'
  | 'bot_replace'
  // Reformation expansion
  | 'convert' | 'embezzle' | 'examine' | 'examine_decision' | 'faction_change';

// ─── Log Entry ───
export interface LogEntry {
  message: string;
  timestamp: number;
  eventType: LogEventType;
  character: Character | null;
  turnNumber: number;
  actorId: string | null;
  actorName: string | null;
  /** The player targeted by this action (steal, assassinate, coup), if any. */
  targetId?: string | null;
  /** Whether this claim was a bluff (actor did not hold the claimed character). Only set on claim_action/block entries. */
  wasBluff?: boolean;
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
  /** Only set if the current client is the one examining */
  examineState: ClientExamineState | null;
  blockPassedPlayerIds: string[];
  actionLog: LogEntry[];
  timerExpiry: number | null;
  winnerId: string | null;
  turnNumber: number;
  /** The client's own player ID */
  myId: string;
  // Reformation expansion
  gameMode: GameMode;
  useInquisitor: boolean;
  treasuryReserve: number;
}

export interface ClientPlayerState {
  id: string;
  name: string;
  coins: number;
  influences: ClientInfluence[];
  isAlive: boolean;
  seatIndex: number;
  isBot?: boolean;
  faction?: Faction;
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

export interface ClientExamineState {
  targetId: string;
  /** The card revealed to the examiner */
  revealedCard: Character;
}

// ─── Bot Personality ───
export type BotPersonality = 'aggressive' | 'conservative' | 'vengeful' | 'deceptive' | 'analytical' | 'optimal' | 'random';

export interface PersonalityParams {
  name: Exclude<BotPersonality, 'random'>;

  // Bluff rates (probability of bluffing when bot does NOT hold the card)
  bluffRateTax: number;
  bluffRateSteal: number;
  bluffRateAssassinate: number;
  bluffRateExchange: number;
  bluffRateContessa: number;       // Contessa block bluff when targeted by assassination
  bluffRateOtherBlock: number;     // Other block bluffs (Duke FA block, Captain/Amb steal block)

  // Challenge rates
  challengeRateBase: number;       // Base probability of challenging an action claim
  challengeRateWithEvidence: number; // Boost when bot holds a copy of the claimed character
  challengeRateBlock: number;      // Rate of challenging opponent's block claim

  // Action weight modifiers (multiplied onto the base weight for each action)
  actionWeightIncome: number;
  actionWeightForeignAid: number;
  actionWeightSteal: number;
  actionWeightAssassinate: number;

  // Targeting
  leaderBias: number;              // 0-1, probability of targeting the coin leader
  revengeWeight: number;           // 0-1, weight given to revenge targeting vs leader targeting

  // Card valuation
  cardValueSpread: number;         // >1 steepens card ranking, <1 flattens it (1.0 = same as optimal)
  bluffPersistenceModifier: number; // Multiplier on bluff persistence boost (1.0 = same as optimal's 3.5)
}

// ─── Room ───
export interface Room {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  gameState: GameState | null;
  createdAt: number;
  settings: RoomSettings;
  lastWinnerId?: string | null;
}

export interface RoomPlayer {
  id: string;
  name: string;
  socketId: string;
  connected: boolean;
  isBot?: boolean;
  personality?: BotPersonality;
  replacedByBot?: boolean;
  wins?: number;
  /** Server-only session token for rejoin authentication (never serialized to clients) */
  sessionToken?: string;
}

export type ClientRoomPlayer = Omit<RoomPlayer, 'socketId' | 'sessionToken'>;

// ─── Room Settings ───
export interface RoomSettings {
  actionTimerSeconds: number;
  turnTimerSeconds: number;
  isPublic: boolean;
  botMinReactionSeconds: number;
  // Reformation expansion
  gameMode: GameMode;
  useInquisitor: boolean;
}

// ─── Public Room Info (for room browser) ───
export interface PublicRoomInfo {
  code: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  settings: RoomSettings;
  hasGame: boolean;
}

// ─── Challenge Reveal Event ───
export interface ChallengeRevealEvent {
  challengerName: string;
  challengedName: string;
  character: Character;
  wasGenuine: boolean; // true = challenged player had the card (challenge fails)
}

// ─── Reactions ───
export interface ReactionEvent {
  playerId: string;
  reactionId: string;
  timestamp: number;
}

// ─── Chat ───
export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}
