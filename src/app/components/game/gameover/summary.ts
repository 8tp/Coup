import type { Character, ClientGameState, ClientPlayerState, LogEntry } from '@/shared/types';
import { selectable } from '@/shared/i18n/messageFormat';
import { characterName } from '@/app/i18n/glossary';
import type { PlainTranslator } from '@/app/i18n/runtime';
import type { MessageKey, NamespaceKey } from '@/app/i18n/schema';
import { computePlayerStats, type Award, type BluffSummaryEntry, type PlayerStats } from '../../../utils/gameStats';

/**
 * Pure read-outs for the game-over screen. Everything here is derived from
 * the final log the server already sent; nothing decides an outcome.
 *
 * The sentences are returned as messages (a `gameover` catalog key and its
 * params), never as text: each variant is one whole message, so a translator
 * sees every sentence entire. Players travel as ids and are named at render
 * time, as "you" for the reader (`recapPlain` here, `RecapText` for React).
 */

export type GameoverKey = NamespaceKey<'gameover'>;

/** A player param: named at render time, or "you" for the reader. */
export interface PlayerArg { readonly player: string | null }
/** A character param: its name in the reader's language. */
export interface CharacterArg { readonly character: Character }
export type RecapArg = number | string | PlayerArg | CharacterArg;

export interface RecapMessage {
  key: GameoverKey;
  params?: Readonly<Record<string, RecapArg>>;
}

/** Who is reading, and what each player is called. */
export interface Reader {
  myId: string | null;
  names: ReadonlyMap<string, string>;
}

const player = (id: string | null | undefined): PlayerArg => ({ player: id ?? null });

function isPlayerArg(v: RecapArg): v is PlayerArg {
  return typeof v === 'object' && 'player' in v;
}

/**
 * Catalog params for a message. A player becomes a `selectable` matched as
 * `you` or `other`, so messages can spell the reader's own form; `name` and
 * `you` choose how a name and the reader's "you" are drawn (text, or nodes).
 */
export function recapParams<N>(
  params: RecapMessage['params'],
  t: PlainTranslator,
  reader: Reader,
  name: (name: string) => N,
  you: (word: string) => N,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (typeof v !== 'object') out[k] = v;
    else if (isPlayerArg(v)) {
      out[k] = v.player !== null && v.player === reader.myId
        ? selectable(you(t('gameover.you')), 'you')
        : selectable(name((v.player !== null && reader.names.get(v.player)) || t('gameover.someone')), 'other');
    } else out[k] = characterName(t, v.character);
  }
  return out;
}

export function recapKey(message: RecapMessage): MessageKey {
  return `gameover.${message.key}`;
}

/** A message as plain text in the translator's language (tests, aria, copies). */
export function recapPlain(message: RecapMessage, t: PlainTranslator, reader: Reader): string {
  return t(recapKey(message), recapParams(message.params, t, reader, n => n, w => w));
}

export function readerOf(state: ClientGameState): Reader {
  return { myId: state.myId, names: new Map(state.players.map(p => [p.id, p.name])) };
}

/** The turn each player went out on, read from the log's `elimination` lines. */
export function eliminationTurns(state: ClientGameState): Map<string, number> {
  const turns = new Map<string, number>();
  for (const entry of state.actionLog) {
    if (entry.eventType === 'elimination' && entry.actorId) turns.set(entry.actorId, entry.turnNumber);
  }
  return turns;
}

/**
 * Hands in finishing order: the winner, anyone somehow still standing, then
 * the rest from the last player out to the first.
 */
export function playersInFinishingOrder(state: ClientGameState): ClientPlayerState[] {
  const outOrder = new Map<string, number>();
  state.actionLog.forEach((entry, i) => {
    if (entry.eventType === 'elimination' && entry.actorId) outOrder.set(entry.actorId, i);
  });
  const rank = (p: ClientPlayerState) => {
    if (p.id === state.winnerId) return Number.POSITIVE_INFINITY;
    if (p.isAlive) return Number.MAX_SAFE_INTEGER;
    return outOrder.get(p.id) ?? -1;
  };
  return [...state.players].sort((a, b) => rank(b) - rank(a));
}

const FINISHING_CAUSES = new Set<LogEntry['eventType']>([
  'coup',
  'assassination',
  'challenge_success',
  'challenge_fail',
  'block_challenge_success',
  'block_challenge_fail',
]);

/**
 * One sentence on the move that ended the game: the cause of the last
 * elimination, looked for within that same turn.
 */
export function finishLine(state: ClientGameState): RecapMessage | null {
  const log = state.actionLog;
  let lastOut = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].eventType === 'elimination') { lastOut = i; break; }
  }
  if (lastOut < 0) return null;
  const out = log[lastOut];
  const turn = out.turnNumber;
  const loser = player(out.actorId);

  for (let i = lastOut - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.turnNumber !== turn || entry.eventType === 'turn_start') break;
    if (!FINISHING_CAUSES.has(entry.eventType)) continue;
    const actor = player(entry.actorId);
    switch (entry.eventType) {
      case 'coup':
        return { key: 'finishCoup', params: { actor, turn, loser } };
      case 'assassination':
        return { key: 'finishAssassination', params: { actor, turn, loser } };
      case 'challenge_success':
        return { key: 'finishCaughtBluffing', params: { actor, turn, loser } };
      case 'block_challenge_success':
        return { key: 'finishCaughtBlockBluff', params: { actor, turn, loser } };
      case 'challenge_fail':
        return entry.character
          ? { key: 'finishChallengeFailed', params: { actor, turn, loser, character: { character: entry.character } } }
          : { key: 'finishChallengeLost', params: { actor, turn, loser } };
      case 'block_challenge_fail':
        return entry.character
          ? { key: 'finishBlockChallengeFailed', params: { actor, turn, loser, character: { character: entry.character } } }
          : { key: 'finishChallengeLost', params: { actor, turn, loser } };
    }
  }

  return { key: 'finishLastCard', params: { player: loser, turn } };
}

/** The finishing line, or how long the game lasted when there is none. */
export function finishOrLength(state: ClientGameState): RecapMessage {
  return finishLine(state) ?? { key: 'finishLasted', params: { turns: state.turnNumber } };
}

function statsFor(state: ClientGameState): PlayerStats[] {
  return Array.from(computePlayerStats(state.actionLog, state.players.map(p => p.id)).values());
}

/** Bluffs across the table, or null when nobody made a claim. */
export function bluffLine(state: ClientGameState): RecapMessage | null {
  const all = statsFor(state);
  const claims = all.reduce((sum, s) => sum + s.actionsClaimed + s.blocksMade, 0);
  if (claims === 0) return null;
  const bluffs = all.reduce((sum, s) => sum + s.actualBluffs, 0);
  if (bluffs === 0) return claims === 1 ? { key: 'bluffsHonestOne' } : { key: 'bluffsHonestAll', params: { claims } };
  const caught = all.reduce((sum, s) => sum + s.timesCaughtBluffing, 0);
  if (bluffs === 1) return { key: caught > 0 ? 'bluffsOneCaught' : 'bluffsOneGotAway', params: { claims } };
  const outcome = caught === 0 ? 'none' : caught >= bluffs ? 'all' : 'some';
  const top = soleLeader(all, s => s.actualBluffs);
  if (top && top.actualBluffs > 1) {
    return {
      key: 'bluffsManyLeader',
      params: { bluffs, claims, outcome, caught, leader: player(top.playerId), leaderBluffs: top.actualBluffs },
    };
  }
  return { key: 'bluffsMany', params: { bluffs, claims, outcome, caught } };
}

/** The one player with the highest score, or null on a tie or a zero. */
function soleLeader(all: PlayerStats[], score: (s: PlayerStats) => number): PlayerStats | null {
  const sorted = [...all].sort((a, b) => score(b) - score(a));
  if (!sorted[0] || score(sorted[0]) === 0) return null;
  if (sorted[1] && score(sorted[1]) === score(sorted[0])) return null;
  return sorted[0];
}

/** Challenges across the table, or null when nobody challenged. */
export function challengeLine(state: ClientGameState): RecapMessage | null {
  const all = statsFor(state);
  const made = all.reduce((sum, s) => sum + s.challengesMade, 0);
  if (made === 0) return null;
  const won = all.reduce((sum, s) => sum + s.challengesWon, 0);
  if (made === 1) {
    const winner = all.find(s => s.challengesWon > 0);
    return winner
      ? { key: 'challengesOnlyWon', params: { winner: player(winner.playerId) } }
      : { key: 'challengesOnlyFailed' };
  }
  if (won === 0) return { key: 'challengesAllFailed', params: { made } };
  const best = soleLeader(all, s => s.challengesWon);
  if (!best || won === 1) return { key: 'challengesWon', params: { won, made } };
  return best.challengesWon === won
    ? { key: 'challengesWonLeaderAll', params: { won, made, best: player(best.playerId) } }
    : { key: 'challengesWonLeaderSome', params: { won, made, best: player(best.playerId), bestWon: best.challengesWon } };
}

/** The line under an award's name: who earned it and the numbers. */
export function awardLine(award: Award): RecapMessage {
  return { key: `awardLine.${award.id}`, params: { player: player(award.playerId), ...award.params } };
}

/** One player's row in the bluff table, beside their name. */
export function bluffRowText(entry: BluffSummaryEntry, t: PlainTranslator): string {
  if (entry.bluffs === 0) return t('gameover.bluffRowAllHonest', { claims: entry.totalClaims });
  const parts = [t('gameover.bluffRowClaims', { claims: entry.totalClaims }), t('gameover.bluffRowBluffs', { count: entry.bluffs })];
  if (entry.caughtBluffing > 0) parts.push(t('gameover.bluffRowCaught', { count: entry.caughtBluffing }));
  if (entry.unchallengedBluffs > 0) parts.push(t('gameover.bluffRowGotAway', { count: entry.unchallengedBluffs }));
  // Separate facts, not a sentence: a middle dot reads the same in every script.
  return parts.join(' · ');
}

function statsOf(state: ClientGameState, id: string | null): PlayerStats | undefined {
  if (!id) return undefined;
  return computePlayerStats(state.actionLog, state.players.map(p => p.id)).get(id);
}

/** The line under the title for the winner: what stood out in their game. */
export function winnerLine(state: ClientGameState): RecapMessage {
  const w = statsOf(state, state.winnerId);
  if (!w) return { key: 'winDefault' };

  // Pure Income + Coup: no character claims at all
  if (w.actionsClaimed === 0) return { key: 'winNoClaims' };
  // Caught bluffing but still won
  if (w.timesCaughtBluffing >= 1) return { key: 'winCaughtBluffing', params: { count: w.timesCaughtBluffing } };
  // Great at reading opponents
  if (w.challengesWon >= 2) return { key: 'winChallengesWon', params: { count: w.challengesWon } };
  // Proven honest multiple times (never caught, checked above)
  if (w.timesProvenHonest >= 2) return { key: 'winProvenHonest', params: { count: w.timesProvenHonest } };
  if (w.assassinationsMade >= 2) return { key: 'winAssassinations', params: { count: w.assassinationsMade } };
  if (w.coupsMade >= 2) return { key: 'winCoups', params: { count: w.coupsMade } };
  if (w.blocksMade >= 2) return { key: 'winBlocks', params: { count: w.blocksMade } };
  // Many claims, never caught
  if (w.actionsClaimed >= 3) return { key: 'winClaimsNeverCaught', params: { count: w.actionsClaimed } };
  return { key: 'winDefault' };
}

/** The line under the title for a player who lost. */
export function loserLine(state: ClientGameState): RecapMessage {
  // Spectators have no stats entry.
  const m = statsOf(state, state.myId);
  if (!m) return { key: 'loseSpectator' };

  if (m.eliminationOrder === 1) return { key: 'loseFirstOut' };
  if (m.timesCaughtBluffing >= 1) return { key: 'loseCaughtBluffing', params: { count: m.timesCaughtBluffing } };
  if (m.challengesLost >= 2) return { key: 'loseChallengesLost', params: { count: m.challengesLost } };
  // Played it safe with no claims
  if (m.actionsClaimed === 0) return { key: 'loseNoClaims' };
  // Good challenges but still lost
  if (m.challengesWon >= 2) return { key: 'loseChallengesWon', params: { count: m.challengesWon } };
  // Strong defense but still fell
  if (m.blocksMade >= 2) return { key: 'loseBlocks', params: { count: m.blocksMade } };
  // Landed assassinations or coups
  if (m.coupsMade >= 1 && m.assassinationsMade >= 1) {
    return { key: 'loseLandedBoth', params: { coups: m.coupsMade, assassinations: m.assassinationsMade } };
  }
  if (m.coupsMade >= 1) return { key: 'loseLandedCoups', params: { coups: m.coupsMade } };
  if (m.assassinationsMade >= 1) return { key: 'loseLandedAssassinations', params: { assassinations: m.assassinationsMade } };
  if (m.eliminationOrder > 1) return { key: 'loseOutPlace', params: { place: m.eliminationOrder } };
  return { key: 'loseOut' };
}
