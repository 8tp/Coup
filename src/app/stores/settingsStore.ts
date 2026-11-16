'use client';

import { create } from 'zustand';
import { isLocale, type Locale } from '@/shared/i18n/locales';
import { LOCALE_STORAGE_KEY } from '@/shared/i18n/bootScript';

export type TextSize = 'normal' | 'large' | 'xl';

interface SettingsStore {
  musicEnabled: boolean;
  setMusicEnabled: (enabled: boolean) => void;

  /** 0–100; 50 is the measured mix level (SoundEngine.musicVolumeGain). */
  musicVolume: number;
  setMusicVolume: (volume: number) => void;

  hapticEnabled: boolean;
  setHapticEnabled: (enabled: boolean) => void;

  textSize: TextSize;
  setTextSize: (size: TextSize) => void;

  reducedMotionEnabled: boolean;
  setReducedMotionEnabled: (enabled: boolean) => void;

  /**
   * The player's language choice, or null to match the device
   * (`navigator.languages`). `I18nBootstrap` resolves and applies it;
   * see docs/I18N.md for the full resolution order.
   */
  locale: Locale | null;
  setLocale: (locale: Locale | null) => void;
}

function readSavedLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(saved) ? saved : null;
  } catch {
    return null;
  }
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

  musicVolume:
    typeof window === 'undefined' || localStorage.getItem('coup_music_volume') === null
      ? 50
      : Number(localStorage.getItem('coup_music_volume')) || 0,
  setMusicVolume: (volume) => {
    import('../audio/SoundEngine').then(({ getSoundEngine }) => {
      getSoundEngine().setMusicVolume(volume);
    });
    set({ musicVolume: volume });
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

  locale: readSavedLocale(),
  setLocale: (locale) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(LOCALE_STORAGE_KEY, locale ?? 'auto');
      } catch {
        // Private mode: the choice lasts for this page only.
      }
    }
    set({ locale });
  },
}));
