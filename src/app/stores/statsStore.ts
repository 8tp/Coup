'use client';

import { create } from 'zustand';
import { ClientGameState } from '@/shared/types';
import { StoredPlayerStats } from '../types/stats';
import { createEmptyStats, recordGameResult } from '../utils/statsRecorder';

const STORAGE_KEY_STATS = 'coup_player_stats';
const STORAGE_KEY_DEVICE = 'coup_device_id';

function getDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(STORAGE_KEY_DEVICE);
  if (!id) {
    id = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE_KEY_DEVICE, id);
  }
  return id;
}

interface StatsStore {
  stats: StoredPlayerStats | null;
  loaded: boolean;
  loadStats: () => void;
  recordGame: (gameState: ClientGameState) => void;
  resetStats: () => void;
}

export const useStatsStore = create<StatsStore>((set, get) => ({
  stats: null,
  loaded: false,

  loadStats: () => {
    if (typeof window === 'undefined') return;
    if (get().loaded) return;
    const deviceId = getDeviceId();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STATS);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredPlayerStats;
        if (parsed.version === 1) {
          set({ stats: parsed, loaded: true });
          return;
        }
      }
    } catch {
      // Corrupted data, start fresh
    }
    const empty = createEmptyStats(deviceId);
    set({ stats: empty, loaded: true });
  },

  recordGame: (gameState: ClientGameState) => {
    if (typeof window === 'undefined') return;
    const store = get();
    if (!store.loaded) {
      get().loadStats();
    }
    const current = get().stats ?? createEmptyStats(getDeviceId());
    const updated = recordGameResult(current, gameState);
    if (updated === current) return; // no change (dedup or invalid)
    set({ stats: updated });
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(updated));
    } catch {
      // localStorage full — silently fail
    }
  },

  resetStats: () => {
    if (typeof window === 'undefined') return;
    const deviceId = getDeviceId();
    const empty = createEmptyStats(deviceId);
    set({ stats: empty });
    try {
      localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(empty));
    } catch {
      // silently fail
    }
  },
}));
