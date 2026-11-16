import type { ClientGameState } from '@/shared/types';

/**
 * A decision this player has sent and the server has not answered yet.
 *
 * WHY THIS EXISTS. The server is authoritative, so a tap on Pass or Challenge
 * changes nothing on screen until the server's next `game:state` comes back.
 * At 200–300ms each way (most of the player base is far from the server) that
 * is half a second of a button that looks untouched. Players tap again, and the
 * second tap lands on the 500ms game-action rate limit and comes back as
 * "Too many requests, please wait".
 *
 * So the button that was chosen stays pressed, and the prompt takes no second
 * answer, until the server has replied. Nothing is decided on the client: the
 * prompt still changes only when the server's state does.
 *
 * The answer belongs to one DECISION WINDOW (see `decisionWindowKey`). It is
 * dropped when the window changes, when the server sends an error, or after
 * `PENDING_ANSWER_TIMEOUT_MS` with no reply, whichever comes first. Another
 * player's pass inside the same window does not drop it: that broadcast is not
 * the answer to this player's tap.
 */
export interface PendingAnswer {
  /** `decisionWindowKey` of the state the answer was given in. */
  window: string;
  /** Which control was chosen, e.g. `'pass'`, `'challenge'`, `'block:Duke'`. */
  choice: string;
}

/**
 * Identifies the decision a prompt is asking for: the same phase of the same
 * turn about the same claim. Passes by other players leave it unchanged; this
 * player's own pass, an early block, or the server moving the game on changes it.
 */
export function decisionWindowKey(gs: ClientGameState): string {
  const action = gs.pendingAction;
  const block = gs.pendingBlock;
  return [
    gs.turnNumber,
    gs.turnPhase,
    gs.players[gs.currentPlayerIndex]?.id ?? '',
    action?.actorId ?? '',
    action?.type ?? '',
    action?.targetId ?? '',
    block?.blockerId ?? '',
    block?.claimedCharacter ?? '',
    gs.influenceLossRequest?.playerId ?? '',
    gs.influenceLossRequest?.reason ?? '',
    // This player's own pass or early block is the server's answer to their
    // tap. A target who has passed on the challenge can still block in the
    // same window, so the pass must release the prompt for that second choice.
    gs.challengeState?.passedPlayerIds.includes(gs.myId) ? 'passed' : '',
    action?.declaredBlock?.blockerId ?? '',
  ].join('|');
}

/** The pending answer if it still applies to `gs`, otherwise null. */
export function activePendingAnswer(pending: PendingAnswer | null, gs: ClientGameState | null): PendingAnswer | null {
  if (!pending || !gs) return null;
  return pending.window === decisionWindowKey(gs) ? pending : null;
}
