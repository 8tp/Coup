import { NAME_MAX_LENGTH } from '@/shared/constants';
import { clampToGraphemes } from '@/shared/textLimits';

/** localStorage key for the last name the player used (survives tabs and visits). */
export const PLAYER_NAME_STORAGE_KEY = 'coup_player_name';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    // Access can throw in privacy modes / sandboxed iframes.
    return null;
  }
}

/** The previously used player name, or '' if none (or storage is unavailable). */
export function loadSavedPlayerName(): string {
  try {
    return clampToGraphemes(storage()?.getItem(PLAYER_NAME_STORAGE_KEY) ?? '', NAME_MAX_LENGTH);
  } catch {
    return '';
  }
}

/** Remember a name the server accepted. Blank names are ignored. */
export function savePlayerName(name: string): void {
  const trimmed = clampToGraphemes(name.trim(), NAME_MAX_LENGTH);
  if (!trimmed) return;
  try {
    storage()?.setItem(PLAYER_NAME_STORAGE_KEY, trimmed);
  } catch {
    // Quota / privacy mode — remembering the name is a nicety, never an error.
  }
}
