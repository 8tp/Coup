import { ACTION_DISPLAY_NAMES } from '../constants';
import { ActionType, Character } from '../types';

/**
 * Stable codes for every error and notice text the server sends a player.
 *
 * The server keeps sending its English text (`message` / `error`), and the
 * socket layer adds `code` + `params` from this table, so a client renders
 * the code through its `errors` catalog and an older client still shows the
 * English. One table, matched by exact text or pattern, means the engine and
 * room code keep returning plain strings and nothing about their tests
 * changes. `tests/server/serverErrors.test.ts` scans the server and engine
 * source for error literals and fails if any of them has no code here, so a
 * new error cannot ship untranslatable.
 *
 * Several texts may share one code when a player needs the same sentence for
 * all of them (malformed requests, races against a phase change).
 */
interface ErrorRule {
  code: string;
  match: string | RegExp;
  params?: (m: RegExpExecArray) => Record<string, string | number>;
}

const actionFromDisplayName = (name: string): string =>
  (Object.entries(ACTION_DISPLAY_NAMES).find(([, display]) => display === name)?.[0] as ActionType | undefined) ?? name;

const RULES = [
  // ── Requests and rate limits (SocketHandler) ──
  { code: 'rate_limited', match: 'Too many requests, please wait' },
  { code: 'server_error', match: 'Internal server error' },
  { code: 'invalid_request', match: /^Invalid (join data|rejoin data|spectate data|bot data|bot personality|bot|spectator|player|settings|action|target|character|exchange selection|examine influence|examine decision)$/ },
  { code: 'invalid_request', match: 'Player is not a bot' },
  { code: 'already_in_room', match: 'Socket is already a room member' },
  { code: 'not_in_room', match: 'Not in a room' },
  { code: 'no_game', match: 'No game in progress' },
  { code: 'host_only_start', match: 'Only the host can start the game' },
  { code: 'host_only_rematch', match: 'Only the host can start a rematch' },
  { code: 'host_only', match: /^Only the host can (remove players|remove spectators|add bots|remove bots|change settings)$/ },
  { code: 'game_not_finished', match: 'Game is not finished' },
  { code: 'start_failed', match: 'Failed to start game' },
  { code: 'rematch_failed', match: 'Failed to start rematch' },
  { code: 'removed_from_room', match: /^You were removed from room ([A-Z]+)\.$/, params: m => ({ room: m[1] }) },
  { code: 'removed_idle', match: 'You were idle too long, so a bot took your seat.' },

  // ── Rooms (RoomManager) ──
  { code: 'invalid_room_code', match: 'Invalid room code' },
  { code: 'room_not_found', match: 'Room not found' },
  { code: 'room_full', match: 'Room is full' },
  { code: 'game_in_progress', match: 'Game already in progress' },
  { code: 'name_taken', match: 'Name already taken in this room' },
  { code: 'cannot_remove_host', match: 'Cannot remove the host' },
  { code: 'player_not_found', match: /^Player not found( in room)?$/ },
  { code: 'seat_taken_by_bot', match: 'A bot took your seat while you were inactive' },
  { code: 'invalid_session', match: 'Invalid session token' },
  { code: 'settings_locked', match: 'Cannot change settings during a game' },
  { code: 'invalid_settings', match: /^Invalid (action timer|turn timer|bot reaction time) value$/ },
  { code: 'timer_range', match: /^Timer must be between (\d+) and (\d+) seconds$/, params: m => ({ min: Number(m[1]), max: Number(m[2]) }) },
  { code: 'need_players', match: /^Need at least (\d+) players$/, params: m => ({ count: Number(m[1]) }) },
  { code: 'message_length', match: /^Message must be 1-(\d+) characters$/, params: m => ({ max: Number(m[1]) }) },
  { code: 'chat_rate_limited', match: 'Sending messages too fast' },
  { code: 'spectate_unavailable', match: 'Spectating is only available for public live games' },
  { code: 'too_many_spectators', match: 'Too many spectators' },
  { code: 'spectator_not_found', match: 'Spectator not found' },

  // ── Names and chat (ContentFilter) ──
  { code: 'invalid_name', match: 'Invalid player name' },
  { code: 'name_required', match: 'Name is required' },
  { code: 'name_too_long', match: /^Name must be (\d+) characters or less$/, params: m => ({ max: Number(m[1]) }) },
  { code: 'name_needs_letter', match: 'Name must contain at least one letter or number' },
  { code: 'name_inappropriate', match: 'Name contains inappropriate language' },
  { code: 'message_required', match: 'Message is required' },
  { code: 'message_too_long', match: /^Message must be (\d+) characters or less$/, params: m => ({ max: Number(m[1]) }) },
  { code: 'message_inappropriate', match: 'Message contains inappropriate language' },

  // ── Game rules (ActionResolver, GameEngine) ──
  { code: 'not_your_turn', match: 'Not your turn' },
  { code: 'you_are_eliminated', match: 'You are eliminated' },
  { code: 'must_coup', match: /^You must Coup when you have (\d+) or more coins$/, params: m => ({ threshold: Number(m[1]) }) },
  { code: 'not_enough_coins', match: /^Not enough coins \(need (\d+), have (\d+)\)$/, params: m => ({ need: Number(m[1]), have: Number(m[2]) }) },
  { code: 'target_required', match: 'This action requires a target' },
  { code: 'target_not_found', match: /^Target not found( or eliminated)?$/ },
  { code: 'target_eliminated', match: 'Target is eliminated' },
  { code: 'cannot_target_self', match: 'Cannot target yourself' },
  { code: 'target_no_coins', match: 'Target has no coins to steal' },
  { code: 'same_faction_target', match: "You can't target a player in the same faction" },
  { code: 'same_faction_block', match: "You can't block Foreign Aid for a player in the same faction" },
  { code: 'invalid_challenger', match: 'Invalid challenger' },
  { code: 'cannot_challenge_own_action', match: 'Cannot challenge your own action' },
  { code: 'cannot_challenge_own_block', match: 'Cannot challenge your own block' },
  { code: 'already_passed', match: /^(You already passed|Already passed)$/ },
  { code: 'invalid_blocker', match: 'Invalid blocker' },
  { code: 'cannot_block_own_action', match: 'Cannot block your own action' },
  { code: 'cannot_pass_own_block', match: 'Actor cannot pass on their own block phase' },
  {
    code: 'cannot_block_with',
    match: new RegExp(`^(${Object.values(Character).join('|')}) cannot block (.+)$`),
    params: m => ({ character: m[1], action: actionFromDisplayName(m[2]) }),
  },
  // Early block: the target declares a block during the challenge window.
  { code: 'not_blockable', match: /^(.+) cannot be blocked$/, params: m => ({ action: actionFromDisplayName(m[1]) }) },
  { code: 'only_target_blocks_now', match: 'Only the target can block this now' },
  { code: 'block_already_declared', match: 'You already declared a block' },
  { code: 'only_target_blocks_assassination', match: 'Only the target can block an assassination' },
  { code: 'only_target_blocks_steal', match: 'Only the target can block a steal' },
  { code: 'not_your_influence_loss', match: 'Not your turn to lose influence' },
  { code: 'invalid_influence_index', match: 'Invalid influence index' },
  { code: 'influence_already_revealed', match: 'That influence is already revealed' },
  { code: 'not_your_exchange', match: 'Not your exchange' },
  { code: 'must_keep_cards', match: /^Must keep exactly (\d+) cards?$/, params: m => ({ count: Number(m[1]) }) },
  { code: 'invalid_card_index', match: /^(Invalid card index|Duplicate card indices)$/ },
  { code: 'reformation_only', match: /^(Convert|Embezzle) is only available in Reformation mode$/, params: m => ({ action: m[1] }) },
  { code: 'reserve_empty', match: 'Treasury Reserve is empty' },
  { code: 'not_your_examine', match: /^Not your examine (selection|decision)$/ },
  { code: 'invalid_examine', match: /^(No pending Examine action|Examine state does not match the pending action|Invalid Examine player)$/ },
  { code: 'cannot_present_revealed', match: 'Cannot present a revealed influence' },
  // A tap that lost a race with the timer or another player.
  { code: 'moment_passed', match: /^(No pending (challenge|action|block challenge|influence loss|exchange|examine|examine selection)|Not in (challenge|block|block challenge|influence loss|exchange|examine|examine selection) phase|Not awaiting action)$/ },
] as const satisfies readonly ErrorRule[];

/** A stable server error code; `'unknown'` when the text is not in the table. */
export type ServerErrorCode = (typeof RULES)[number]['code'] | 'unknown';

export const SERVER_ERROR_CODES: readonly ServerErrorCode[] = [...new Set<ServerErrorCode>([...RULES.map(r => r.code), 'unknown'])];

export type ServerErrorParams = Record<string, string | number>;

export interface ClassifiedServerError {
  code: ServerErrorCode;
  params?: ServerErrorParams;
}

export function classifyServerError(message: string): ClassifiedServerError {
  for (const rule of RULES as readonly ErrorRule[]) {
    if (typeof rule.match === 'string') {
      if (rule.match === message) return { code: rule.code as ServerErrorCode };
      continue;
    }
    const m = rule.match.exec(message);
    if (m) {
      return rule.params
        ? { code: rule.code as ServerErrorCode, params: rule.params(m) }
        : { code: rule.code as ServerErrorCode };
    }
  }
  return { code: 'unknown' };
}

/** The `game:error` / `room:error` / `room:removed` payload for an English message. */
export function serverErrorPayload(message: string): { message: string; code: ServerErrorCode; params?: ServerErrorParams } {
  return { message, ...classifyServerError(message) };
}

/** A failed acknowledgement for an English error message. */
export function failedAck(error: string): { success: false; error: string; errorCode: ServerErrorCode; errorParams?: ServerErrorParams } {
  const { code, params } = classifyServerError(error);
  return params ? { success: false, error, errorCode: code, errorParams: params } : { success: false, error, errorCode: code };
}
