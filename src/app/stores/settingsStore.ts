'use client';

import { create } from 'zustand';

export type TextSize = 'normal' | 'large' | 'xl';

interface SettingsStore {
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;

  hapticEnabled: boolean;
  setHapticEnabled: (enabled: boolean) => void;

  textSize: TextSize;
  setTextSize: (size: TextSize) => void;

  reducedMotionEnabled: boolean;
  setReducedMotionEnabled: (enabled: boolean) => void;
}

function applyTextSizeClass(size: TextSize): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('text-size-large', 'text-size-xl');
  if (size === 'large') root.classList.add('text-size-large');
  else if (size === 'xl') root.classList.add('text-size-xl');
}

function applyReducedMotionClass(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('reduce-motion', enabled);
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  musicEnabled:
    typeof window === 'undefined'
      ? true
      : localStorage.getItem('coup_music_enabled') !== 'false',
  setMusicEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coup_music_enabled', String(enabled));
    }
    import('../audio/SoundEngine').then(({ getSoundEngine }) => {
      getSoundEngine().setMusicEnabled(enabled);
    });
    set({ musicEnabled: enabled });
  },

  hapticEnabled:
    typeof window === 'undefined'
      ? true
      : localStorage.getItem('coup_haptic_enabled') !== 'false',
  setHapticEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coup_haptic_enabled', String(enabled));
    }
    import('../utils/haptic').then(({ setHapticEnabled }) => {
      setHapticEnabled(enabled);
    });
    set({ hapticEnabled: enabled });
  },

  textSize:
    typeof window === 'undefined'
      ? 'normal'
      : (localStorage.getItem('coup_text_size') as TextSize) || 'normal',
  setTextSize: (size) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coup_text_size', size);
    }
    applyTextSizeClass(size);
    set({ textSize: size });
  },

  reducedMotionEnabled:
    typeof window === 'undefined'
      ? false
      : localStorage.getItem('coup_reduced_motion') === 'true',
  setReducedMotionEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('coup_reduced_motion', String(enabled));
    }
    applyReducedMotionClass(enabled);
    set({ reducedMotionEnabled: enabled });
  },
}));
