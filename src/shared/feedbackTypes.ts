import { GameMode, RoomOrigin, TurnPhase } from './types';

// ─── In-game feedback ───
// A player's note (bug / idea / other) plus context that is attached
// automatically. The context must never contain IPs, socket ids, session
// tokens, player names or room codes; only the room's random metric id.

export type FeedbackKind = 'bug' | 'idea' | 'other';
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ['bug', 'idea', 'other'];

/** Where the player opened the form (reported by the client, whitelisted on the server). */
export type FeedbackScreen = 'home' | 'lobby' | 'game' | 'game_over' | 'unknown';
export const FEEDBACK_SCREENS: readonly FeedbackScreen[] = ['home', 'lobby', 'game', 'game_over', 'unknown'];

export type ViewportBucket = 'phone' | 'tablet' | 'desktop' | 'unknown';
export const VIEWPORT_BUCKETS: readonly ViewportBucket[] = ['phone', 'tablet', 'desktop', 'unknown'];

export type BrowserFamily = 'chrome' | 'safari' | 'firefox' | 'edge' | 'samsung' | 'opera' | 'other';
export const BROWSER_FAMILIES: readonly BrowserFamily[] = ['chrome', 'safari', 'firefox', 'edge', 'samsung', 'opera', 'other'];

export type OsFamily = 'android' | 'ios' | 'windows' | 'macos' | 'linux' | 'chromeos' | 'other';
export const OS_FAMILIES: readonly OsFamily[] = ['android', 'ios', 'windows', 'macos', 'linux', 'chromeos', 'other'];

export type FeedbackTextSize = 'normal' | 'large' | 'xl' | 'unknown';
export const FEEDBACK_TEXT_SIZES: readonly FeedbackTextSize[] = ['normal', 'large', 'xl', 'unknown'];

/** Coarse, non-identifying device context the client attaches. */
export interface FeedbackClientContext {
  screen: FeedbackScreen;
  viewport: ViewportBucket;
  browser: BrowserFamily;
  os: OsFamily;
  textSize: FeedbackTextSize;
  /** Running as an installed app (display-mode: standalone). */
  standalone: boolean;
}

export type FeedbackRoomState = 'none' | 'lobby' | 'in_game' | 'finished';
export type FeedbackSenderStatus = 'no_room' | 'lobby' | 'alive' | 'eliminated' | 'spectating';

/** Room/game context the server derives from the sender's socket membership. */
export interface FeedbackRoomSnapshot {
  /** RoomMeta.metricId (random, never the room code). */
  room: string | null;
  gameId: string | null;
  roomState: FeedbackRoomState;
  sender: FeedbackSenderStatus;
  origin: RoomOrigin | null;
  gameMode: GameMode | null;
  useInquisitor: boolean | null;
  turnPhase: TurnPhase | null;
  turn: number | null;
  humans: number | null;
  bots: number | null;
}

export interface FeedbackContext extends FeedbackClientContext, FeedbackRoomSnapshot {
  /** Short commit sha from the deploy environment, when one is available. */
  appVersion: string | null;
}

export interface FeedbackRecord {
  /** Random UUID, shared by the log line and the database row. */
  id: string;
  createdAt: string;
  kind: FeedbackKind;
  message: string;
  context: FeedbackContext;
}

export type FeedbackErrorCode = 'invalid' | 'empty' | 'too_long' | 'rate_limited' | 'busy' | 'server_error';

export interface FeedbackSubmission {
  kind: FeedbackKind;
  message: string;
  context: Partial<FeedbackClientContext>;
}

export type FeedbackResponse = { success: true } | { success: false; error: FeedbackErrorCode };
