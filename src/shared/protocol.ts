import { ActionType, Character, ClientGameState, RoomPlayer } from './types';

// ─── Client → Server Events ───
export interface ClientToServerEvents {
  'room:create': (data: { playerName: string }, callback: (response: RoomResponse) => void) => void;
  'room:join': (data: { roomCode: string; playerName: string }, callback: (response: RoomResponse) => void) => void;
  'room:leave': () => void;
  'game:start': () => void;

  // Game actions
  'game:action': (data: { action: ActionType; targetId?: string }) => void;
  'game:challenge': () => void;
  'game:pass_challenge': () => void;
  'game:block': (data: { character: Character }) => void;
  'game:pass_block': () => void;
  'game:challenge_block': () => void;
  'game:pass_challenge_block': () => void;
  'game:choose_influence_loss': (data: { influenceIndex: number }) => void;
  'game:choose_exchange': (data: { keepIndices: number[] }) => void;

  // Reconnection
  'room:rejoin': (data: { roomCode: string; playerId: string }, callback: (response: RoomResponse) => void) => void;
}

// ─── Server → Client Events ───
export interface ServerToClientEvents {
  'room:updated': (data: { players: RoomPlayer[]; hostId: string }) => void;
  'room:error': (data: { message: string }) => void;
  'game:state': (state: ClientGameState) => void;
  'game:error': (data: { message: string }) => void;
  'game:log': (data: { message: string }) => void;
}

// ─── Response Types ───
export interface RoomResponse {
  success: boolean;
  roomCode?: string;
  playerId?: string;
  error?: string;
}
