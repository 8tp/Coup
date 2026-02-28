'use client';

import { create } from 'zustand';
import { ChallengeRevealEvent, ChatMessage, ClientGameState, PublicRoomInfo, RoomPlayer, RoomSettings } from '@/shared/types';

interface GameStore {
  // Connection state
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Room state
  roomCode: string | null;
  playerId: string | null;
  hostId: string | null;
  roomPlayers: RoomPlayer[];
  roomSettings: RoomSettings | null;
  setRoom: (roomCode: string, playerId: string) => void;
  setRoomPlayers: (players: RoomPlayer[], hostId: string, settings: RoomSettings) => void;
  clearRoom: () => void;

  // Game state
  gameState: ClientGameState | null;
  setGameState: (state: ClientGameState | null) => void;

  // Chat state
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  setChatHistory: (messages: ChatMessage[]) => void;

  // Challenge reveal
  challengeReveal: ChallengeRevealEvent | null;
  setChallengeReveal: (data: ChallengeRevealEvent | null) => void;

  // Public rooms (browser)
  publicRooms: PublicRoomInfo[];
  setPublicRooms: (rooms: PublicRoomInfo[]) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),

  roomCode: null,
  playerId: null,
  hostId: null,
  roomPlayers: [],
  roomSettings: null,
  setRoom: (roomCode, playerId) => set({ roomCode, playerId }),
  setRoomPlayers: (players, hostId, settings) => set({ roomPlayers: players, hostId, roomSettings: settings }),
  clearRoom: () => set({
    roomCode: null,
    playerId: null,
    hostId: null,
    roomPlayers: [],
    roomSettings: null,
    gameState: null,
    chatMessages: [],
    challengeReveal: null,
  }),

  gameState: null,
  setGameState: (state) => set({ gameState: state }),

  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatHistory: (messages) => set({ chatMessages: messages }),

  challengeReveal: null,
  setChallengeReveal: (data) => set({ challengeReveal: data }),

  publicRooms: [],
  setPublicRooms: (rooms) => set({ publicRooms: rooms }),

  error: null,
  setError: (error) => set({ error }),
}));
