import type { ActionType, Character, Faction } from '../types';

/**
 * Structured action-log lines.
 *
 * The server writes every log line twice: the English `message` it always
 * wrote (server logs, metrics, bots, stored game logs and old clients read
 * it), and a `msg` of a stable key plus typed params. Each client renders
 * `msg` through its own `log` catalog, so players at one table can read the
 * log in different languages. The key set below IS the `log` catalog's event
 * key set: `src/app/i18n/messages/en/log.ts` is typed against it, so adding a
 * key here without an English line is a compile error, and the
 * `tests/app/i18n/logMessages.test.ts` parity test proves the English catalog
 * reproduces every server `message` exactly.
 *
 * Param names carry their kind (table below). Players are passed by id and
 * named by the client from `gameState.players`, which keeps the payload
 * small and keeps names out of `msg` (stored logs map ids to seats).
 */
export const LOG_PARAM_KINDS = {
  actor: 'player',
  target: 'player',
  challenger: 'player',
  challenged: 'player',
  blocker: 'player',
  character: 'character',
  action: 'action',
  faction: 'faction',
  amount: 'number',
} as const;

export type LogParamName = keyof typeof LOG_PARAM_KINDS;
export type LogParamKind = (typeof LOG_PARAM_KINDS)[LogParamName];

interface LogParamKindValue {
  /** A player id. */
  player: string;
  character: Character;
  action: ActionType;
  faction: Faction;
  number: number;
}

type P<N extends LogParamName> = { [K in N]: LogParamKindValue[(typeof LOG_PARAM_KINDS)[K]] };

/** Every log line the server can write, with exactly the params it carries. */
export interface LogMessageParams {
  // Turn flow (Game.ts)
  gameStarted: P<'actor'>;
  turnStart: P<'actor'>;
  eliminated: P<'actor'>;
  win: P<'actor'>;
  // Seats handed to bots (RoomManager.ts)
  botReplacedIdle: P<'actor'>;
  botReplacedLeft: P<'actor'>;
  botReplacedDisconnected: P<'actor'>;
  // Declarations
  income: P<'actor' | 'amount'>;
  coup: P<'actor' | 'target'>;
  claimAction: P<'actor' | 'character' | 'action'>;
  claimActionTargeting: P<'actor' | 'character' | 'action' | 'target'>;
  declareAction: P<'actor' | 'action'>;
  // Challenges
  challenge: P<'challenger' | 'challenged' | 'character'>;
  challengeFailed: P<'challenger' | 'challenged' | 'character'>;
  challengeSucceeded: P<'challenged' | 'character'>;
  // Blocks
  block: P<'blocker' | 'character'>;
  blockChallenge: P<'challenger' | 'blocker' | 'character'>;
  blockChallengeFailed: P<'challenger' | 'blocker' | 'character'>;
  blockChallengeSucceeded: P<'blocker' | 'character'>;
  blockStands: P<never>;
  // Losing influence
  influenceLost: P<'actor' | 'character'>;
  assassinationLoss: P<'target'>;
  assassinationPending: P<'target'>;
  // Resolutions
  taxCollected: P<'actor' | 'amount'>;
  foreignAidTaken: P<'actor' | 'amount'>;
  stealResolved: P<'actor' | 'target' | 'amount'>;
  exchangeDraw: P<'actor'>;
  exchangeDeckEmpty: P<'actor'>;
  exchangeComplete: P<'actor'>;
  // Reformation
  convertSelf: P<'actor' | 'faction' | 'amount'>;
  convertOther: P<'actor' | 'target' | 'faction' | 'amount'>;
  embezzleClaim: P<'actor' | 'character' | 'amount'>;
  embezzleChallenge: P<'challenger' | 'challenged' | 'character'>;
  embezzleChallengeSucceeded: P<'challenged' | 'character'>;
  embezzleChallengeFailed: P<'challenger' | 'challenged' | 'character'>;
  embezzled: P<'actor'>;
  examineAsk: P<'actor' | 'target'>;
  examineShown: P<'actor' | 'target'>;
  examineForceSwap: P<'actor' | 'target'>;
  examineSwapDeckEmpty: P<'actor'>;
  examineReturn: P<'actor' | 'target'>;
}

export type LogMessageKey = keyof LogMessageParams;

/** One structured log line: a key and exactly that key's params. */
export type LogMessage = { [K in LogMessageKey]: { key: K; params: LogMessageParams[K] } }[LogMessageKey];

/** Build a `LogMessage` with the params checked against the key. */
export function logMsg<K extends LogMessageKey>(key: K, params: LogMessageParams[K]): { key: K; params: LogMessageParams[K] } {
  return { key, params };
}

export function logParamKind(name: string): LogParamKind | null {
  return Object.prototype.hasOwnProperty.call(LOG_PARAM_KINDS, name)
    ? LOG_PARAM_KINDS[name as LogParamName]
    : null;
}
