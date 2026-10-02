/** localStorage key for the last name the player used (survives tabs and visits). */
export const PLAYER_NAME_STORAGE_KEY = 'coup_player_name';

const MAX_SAVED_NAME_LENGTH = 20;

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
    return (storage()?.getItem(PLAYER_NAME_STORAGE_KEY) ?? '').slice(0, MAX_SAVED_NAME_LENGTH);
  } catch {
    return '';
  }
}

/** Remember a name the server accepted. Blank names are ignored. */
export function savePlayerName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_SAVED_NAME_LENGTH);
  if (!trimmed) return;
  try {
    storage()?.setItem(PLAYER_NAME_STORAGE_KEY, trimmed);
  } catch {
    // Quota / privacy mode — remembering the name is a nicety, never an error.
  }
}
