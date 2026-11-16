'use client';

import { getSocket } from '../../../hooks/useSocket';
import { useGameStore } from '../../../stores/gameStore';

/** Every session key that ties this tab to a room (see hooks/useSocket.ts). */
const ROOM_SESSION_KEYS = [
  'coup_room',
  'coup_player',
  'coup_session_token',
  'coup_spectator',
  'coup_player_name',
  'coup_practice_room',
] as const;

/**
 * Leave the finished game for good: tell the server (a player's seat is freed
 * at once after a game, a spectator stops watching), forget the room so the
 * home screen does not rejoin it, and clear the store. The caller navigates.
 *
 * A plain function on the shared socket, like `sendFeedback`, so the end
 * screen can leave without mounting useSocket's listeners a second time.
 */
export function leaveFinishedGame(isSpectator: boolean): void {
  const socket = getSocket();
  if (socket.connected) socket.emit(isSpectator ? 'room:stop_spectating' : 'room:leave');
  for (const key of ROOM_SESSION_KEYS) sessionStorage.removeItem(key);
  useGameStore.getState().clearRoom();
}
