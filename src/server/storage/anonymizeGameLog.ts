import { GameLog } from '../../shared/gameLogTypes';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip personal data from a game log before it is stored durably.
 *
 * Players become seats: id `seat-N`, name `Player N` (N is 1-based, in seating
 * order). Every occurrence of a player's name in action-log text is replaced
 * with the same label, and actor/target ids are mapped to seat ids. Bot flags,
 * personalities, cards and stats are kept. The input is not mutated.
 */
export function anonymizeGameLog(log: GameLog): GameLog {
  const idToSeat = new Map<string, string>();
  const nameToLabel = new Map<string, string>();
  log.players.forEach((player, index) => {
    idToSeat.set(player.id, `seat-${index + 1}`);
    if (player.name) nameToLabel.set(player.name.toLowerCase(), `Player ${index + 1}`);
  });

  // One pass over all names (longest first, whole-name matches only) so a
  // replacement label can never be re-matched by another player's name.
  const names = [...nameToLabel.keys()].sort((a, b) => b.length - a.length);
  const pattern = names.length > 0
    ? new RegExp(`(?<![\\p{L}\\p{N}])(${names.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
    : null;
  const scrub = (text: string): string =>
    pattern ? text.replace(pattern, match => nameToLabel.get(match.toLowerCase()) ?? 'Player') : text;

  const seatOf = (id: string | null | undefined): string | null =>
    id ? idToSeat.get(id) ?? 'unknown' : null;

  const winnerIndex = log.players.findIndex(p => p.id === log.winnerId);

  return {
    ...log,
    players: log.players.map((player, index) => ({
      ...player,
      id: `seat-${index + 1}`,
      name: `Player ${index + 1}`,
    })),
    winnerId: winnerIndex >= 0 ? `seat-${winnerIndex + 1}` : '',
    winnerName: winnerIndex >= 0 ? `Player ${winnerIndex + 1}` : '',
    actionLog: log.actionLog.map(entry => ({
      ...entry,
      message: scrub(entry.message),
      actorId: seatOf(entry.actorId),
      actorName: entry.actorName ? scrub(entry.actorName) : entry.actorName,
      ...(entry.targetId !== undefined ? { targetId: seatOf(entry.targetId) } : {}),
    })),
    decisions: log.decisions?.map(decision => ({
      ...decision,
      botId: seatOf(decision.botId) ?? 'unknown',
      botName: scrub(decision.botName),
      ...(decision.targetName !== undefined ? { targetName: scrub(decision.targetName) } : {}),
    })),
  };
}
