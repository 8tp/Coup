import type { ClientGameState, ClientPlayerState, LogEntry } from '@/shared/types';
import { computePlayerStats, type PlayerStats } from '../../../utils/gameStats';

/**
 * Pure read-outs for the game-over screen. Everything here is derived from
 * the final log the server already sent; nothing decides an outcome.
 */

function nameOf(state: ClientGameState, id: string | null | undefined): string {
  if (!id) return 'Someone';
  if (id === state.myId) return 'You';
  return state.players.find(p => p.id === id)?.name ?? 'Someone';
}

/** The same name in object position: "a Coup on you", not "on You". */
function objectNameOf(state: ClientGameState, id: string | null | undefined): string {
  const name = nameOf(state, id);
  return name === 'You' ? 'you' : name;
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
export function finishLine(state: ClientGameState): string | null {
  const log = state.actionLog;
  let lastOut = -1;
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].eventType === 'elimination') { lastOut = i; break; }
  }
  if (lastOut < 0) return null;
  const out = log[lastOut];
  const turn = out.turnNumber;
  const loser = objectNameOf(state, out.actorId);

  for (let i = lastOut - 1; i >= 0; i--) {
    const entry = log[i];
    if (entry.turnNumber !== turn || entry.eventType === 'turn_start') break;
    if (!FINISHING_CAUSES.has(entry.eventType)) continue;
    const actor = nameOf(state, entry.actorId);
    switch (entry.eventType) {
      case 'coup':
        return `${actor} ended it on turn ${turn} with a Coup on ${loser}.`;
      case 'assassination':
        return `${actor} ended it on turn ${turn} by assassinating ${loser}.`;
      case 'challenge_success':
        return `${actor} ended it on turn ${turn} by catching ${loser} bluffing.`;
      case 'block_challenge_success':
        return `${actor} ended it on turn ${turn} by catching ${loser} bluffing a block.`;
      case 'challenge_fail':
        return entry.character
          ? `${actor} ended it on turn ${turn}: ${loser} challenged and ${actor === 'You' ? 'you' : actor} had the ${entry.character}.`
          : `${actor} ended it on turn ${turn} when ${loser} lost a challenge.`;
      case 'block_challenge_fail':
        return entry.character
          ? `${actor} ended it on turn ${turn}: ${loser} challenged the block and ${actor === 'You' ? 'you' : actor} had the ${entry.character}.`
          : `${actor} ended it on turn ${turn} when ${loser} lost a challenge.`;
    }
  }

  const who = nameOf(state, out.actorId);
  return `${who} lost ${who === 'You' ? 'your' : 'their'} last card on turn ${turn}.`;
}

function statsFor(state: ClientGameState): PlayerStats[] {
  const names = new Map(state.players.map(p => [p.id, nameOf(state, p.id)] as const));
  return Array.from(computePlayerStats(state.actionLog, state.players.map(p => p.id), names).values());
}

function times(n: number): string {
  return n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
}

/** Bluffs across the table, or null when nobody made a claim. */
export function bluffLine(state: ClientGameState): string | null {
  const all = statsFor(state);
  const claims = all.reduce((sum, s) => sum + s.actionsClaimed + s.blocksMade, 0);
  if (claims === 0) return null;
  const bluffs = all.reduce((sum, s) => sum + s.actualBluffs, 0);
  if (bluffs === 0) return claims === 1 ? 'The one claim was honest.' : `All ${claims} claims were honest.`;
  const caught = all.reduce((sum, s) => sum + s.timesCaughtBluffing, 0);
  const lead = bluffs === 1 ? `1 of ${claims} claims was a bluff.` : `${bluffs} of ${claims} claims were bluffs.`;
  let caughtText: string;
  if (bluffs === 1) caughtText = caught > 0 ? 'It was caught.' : 'It got away.';
  else if (caught === 0) caughtText = 'None were caught.';
  else if (caught >= bluffs) caughtText = 'All were caught.';
  else caughtText = `${caught} ${caught === 1 ? 'was' : 'were'} caught.`;
  const top = soleLeader(all, s => s.actualBluffs);
  const who = top && top.actualBluffs > 1 ? ` ${top.playerName} bluffed the most, ${times(top.actualBluffs)}.` : '';
  return `${lead} ${caughtText}${who}`;
}

/** The one player with the highest score, or null on a tie or a zero. */
function soleLeader(all: PlayerStats[], score: (s: PlayerStats) => number): PlayerStats | null {
  const sorted = [...all].sort((a, b) => score(b) - score(a));
  if (!sorted[0] || score(sorted[0]) === 0) return null;
  if (sorted[1] && score(sorted[1]) === score(sorted[0])) return null;
  return sorted[0];
}

/** Challenges across the table, or null when nobody challenged. */
export function challengeLine(state: ClientGameState): string | null {
  const all = statsFor(state);
  const made = all.reduce((sum, s) => sum + s.challengesMade, 0);
  if (made === 0) return null;
  const won = all.reduce((sum, s) => sum + s.challengesWon, 0);
  if (made === 1) {
    const winner = all.find(s => s.challengesWon > 0);
    return winner ? `${winner.playerName} made the only challenge and won it.` : 'The only challenge failed.';
  }
  if (won === 0) return `All ${made} challenges failed.`;
  const lead = `Challengers won ${won} of ${made} challenges.`;
  const best = soleLeader(all, s => s.challengesWon);
  if (!best || won === 1) return lead;
  return `${lead} ${best.playerName} won ${best.challengesWon === won ? 'all of them' : best.challengesWon}.`;
}
