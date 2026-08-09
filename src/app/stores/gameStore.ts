'use client';

import { create } from 'zustand';
import { ChallengeRevealEvent, ChatMessage, ClientGameState, ClientRoomPlayer, ClientSpectator, PublicRoomInfo, RoomSettings, TargetingPublication } from '@/shared/types';

interface GameStore {
  // Connection state
  connected: boolean;
  reconnecting: boolean;
  setConnected: (connected: boolean) => void;
  setReconnecting: (reconnecting: boolean) => void;

  // Room state
  roomCode: string | null;
  playerId: string | null;
  hostId: string | null;
  roomPlayers: ClientRoomPlayer[];
  roomSettings: RoomSettings | null;
  lastWinnerId: string | null;
  spectators: ClientSpectator[];
  isSpectator: boolean;
  setRoom: (roomCode: string, playerId: string) => void;
  setSpectating: (roomCode: string, spectatorId: string) => void;
  setRoomPlayers: (players: ClientRoomPlayer[], hostId: string, settings: RoomSettings, lastWinnerId?: string | null, spectators?: ClientSpectator[]) => void;
  clearRoom: () => void;

  // Game state
  gameState: ClientGameState | null;
  setGameState: (state: ClientGameState | null) => void;

  /**
   * Target selection (ART-DIRECTION.md §6.2). `ActionBar` is the only writer
   * and `GameTable` the only reader: the seats need to know which of them are
   * legal targets, why the others are not, and how to choose one, and the
   * component that knows all three is not their parent. This is that seam.
   *
   * It is deliberately NOT derived in `GameTable` from `gameState`: the rules
   * for a legal target (faction split, a Steal target with no coins, a Convert
   * you cannot afford) are written once, in `ActionBar.buildTargetOptions`,
   * and a second copy in the seats is exactly how a UI starts lying about the
   * rules.
   */
  targeting: TargetingPublication | null;
  setTargeting: (targeting: TargetingPublication | null) => void;

  // Chat state
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;
  setChatHistory: (messages: ChatMessage[]) => void;
  mutedPlayerIds: string[];
  toggleMutedPlayer: (playerId: string) => void;

  // Challenge reveal
  challengeReveal: ChallengeRevealEvent | null;
  setChallengeReveal: (data: ChallengeRevealEvent | null) => void;

  // Server stats
  playersOnline: number;
  gamesInProgress: number;
  setServerStats: (playersOnline: number, gamesInProgress: number) => void;

  // Public rooms (browser)
  publicRooms: PublicRoomInfo[];
  setPublicRooms: (rooms: PublicRoomInfo[]) => void;

  // Reactions
  activeReactions: Map<string, { reactionId: string; timestamp: number }>;
  setReaction: (playerId: string, reactionId: string, timestamp: number) => void;
  clearReaction: (playerId: string) => void;

  // Sound
  isMuted: boolean;
  setMuted: (muted: boolean) => void;

  // Error state
  error: string | null;
  setError: (error: string | null) => void;
}

export const useGameStore = create<GameStore>((set) => ({
  connected: false,
  reconnecting: false,
  setConnected: (connected) => set({ connected }),
  setReconnecting: (reconnecting) => set({ reconnecting }),

  roomCode: null,
  playerId: null,
  hostId: null,
  roomPlayers: [],
  roomSettings: null,
  lastWinnerId: null,
  spectators: [],
  isSpectator: false,
  setRoom: (roomCode, playerId) => set({ roomCode, playerId, isSpectator: false }),
  setSpectating: (roomCode, spectatorId) => set({ roomCode, playerId: spectatorId, isSpectator: true }),
  setRoomPlayers: (players, hostId, settings, lastWinnerId, spectators) => set({
    roomPlayers: players,
    hostId,
    roomSettings: settings,
    lastWinnerId: lastWinnerId ?? null,
    spectators: spectators ?? [],
  }),
  clearRoom: () => set({
    roomCode: null,
    playerId: null,
    hostId: null,
    roomPlayers: [],
    roomSettings: null,
    lastWinnerId: null,
    spectators: [],
    isSpectator: false,
    gameState: null,
    targeting: null,
    chatMessages: [],
    mutedPlayerIds: [],
    challengeReveal: null,
    activeReactions: new Map(),
  }),

  gameState: null,
  setGameState: (state) => set({ gameState: state }),

  targeting: null,
  setTargeting: (targeting) => set({ targeting }),

  chatMessages: [],
  addChatMessage: (msg) => set((s) => ({ chatMessages: [...s.chatMessages, msg] })),
  setChatHistory: (messages) => set({ chatMessages: messages }),
  mutedPlayerIds: [],
  toggleMutedPlayer: (playerId) => set((s) => ({
    mutedPlayerIds: s.mutedPlayerIds.includes(playerId)
      ? s.mutedPlayerIds.filter(id => id !== playerId)
      : [...s.mutedPlayerIds, playerId],
  })),

  challengeReveal: null,
  setChallengeReveal: (data) => set({ challengeReveal: data }),

  playersOnline: 0,
  gamesInProgress: 0,
  setServerStats: (playersOnline, gamesInProgress) => set({ playersOnline, gamesInProgress }),

  publicRooms: [],
  setPublicRooms: (rooms) => set({ publicRooms: rooms }),

  activeReactions: new Map(),
  setReaction: (playerId, reactionId, timestamp) => set((s) => {
    const next = new Map(s.activeReactions);
    next.set(playerId, { reactionId, timestamp });
    return { activeReactions: next };
  }),
  clearReaction: (playerId) => set((s) => {
    const next = new Map(s.activeReactions);
    next.delete(playerId);
    return { activeReactions: next };
  }),

  isMuted: typeof window !== 'undefined' && localStorage.getItem('coup_sound_muted') === 'true',
  setMuted: (muted) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coup_sound_muted', String(muted));
    }
    // Sync to SoundEngine lazily to avoid circular import at module load
    import('../audio/SoundEngine').then(({ getSoundEngine }) => {
      getSoundEngine().setMuted(muted);
    });
    set({ isMuted: muted });
  },

  error: null,
  setError: (error) => set({ error }),
}));
