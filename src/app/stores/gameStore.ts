'use client';

import { create } from 'zustand';
import { ClientGameState, RoomPlayer } from '@/shared/types';

interface GameStore {
  // Connection state
  connected: boolean;
  setConnected: (connected: boolean) => void;

  // Room state
  roomCode: string | null;
  playerId: string | null;
  hostId: string | null;
  roomPlayers: RoomPlayer[];
  setRoom: (roomCode: string, playerId: string) => void;
  setRoomPlayers: (players: RoomPlayer[], hostId: string) => void;
  clearRoom: () => void;

  // Game state
  gameState: ClientGameState | null;
  setGameState: (state: ClientGameState) => void;

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
  setRoom: (roomCode, playerId) => set({ roomCode, playerId }),
  setRoomPlayers: (players, hostId) => set({ roomPlayers: players, hostId }),
  clearRoom: () => set({
    roomCode: null,
    playerId: null,
    hostId: null,
    roomPlayers: [],
    gameState: null,
  }),

  gameState: null,
  setGameState: (state) => set({ gameState: state }),

  error: null,
  setError: (error) => set({ error }),
}));
