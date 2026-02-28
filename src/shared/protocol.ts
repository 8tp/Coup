import { ActionType, AiPersonality, Character, ChatMessage, ClientGameState, RoomPlayer } from './types';

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

  // Chat
  'chat:send': (data: { message: string }) => void;

  // Rematch
  'game:rematch': () => void;

  // Bots
  'bot:add': (data: { name: string; personality: AiPersonality }, callback: (response: { success: boolean; botId?: string; error?: string }) => void) => void;
  'bot:remove': (data: { botId: string }, callback: (response: { success: boolean; error?: string }) => void) => void;

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
  'chat:message': (data: ChatMessage) => void;
  'chat:history': (data: { messages: ChatMessage[] }) => void;
  'game:rematch_to_lobby': () => void;
}

// ─── Response Types ───
export interface RoomResponse {
  success: boolean;
  roomCode?: string;
  playerId?: string;
  error?: string;
}
