import { SUGGESTED_NAME_ADJECTIVES, SUGGESTED_NAME_TITLES } from '@/shared/constants';

/**
 * The name a first-time visitor finds already filled in ("Velvet Envoy 42"),
 * so Play vs Bots, Create room and Join room all work on the first tap. It
 * stays editable, and it is only remembered as *their* name once the server
 * accepts it (see utils/playerName.ts).
 *
 * The words stay English in every language, on purpose. An adjective plus a
 * title is a sentence built from fragments: Spanish, Portuguese, Arabic and
 * Hindi inflect the adjective for the title's gender, and most of them put it
 * after the noun, so per-language word lists would produce ungrammatical
 * names ("Baronesa Astuto"). The name is also shown to everyone at a mixed
 * table, where Latin letters are the script most players can read, and every
 * suggestion is checked against the server's filter, which is English only.
 * A player who wants a name in their own script types over it in one tap.
 */

/** sessionStorage key: keeps one suggestion for the visit, so a reload doesn't rename you. */
export const SUGGESTED_NAME_STORAGE_KEY = 'coup_suggested_name';

const NUMBER_MIN = 10;
const NUMBER_MAX = 99;

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}

/** A fresh suggestion: adjective, court title and a two-digit number. */
export function suggestPlayerName(random: () => number = Math.random): string {
  const adjective = pick(SUGGESTED_NAME_ADJECTIVES, random);
  const title = pick(SUGGESTED_NAME_TITLES, random);
  const number = NUMBER_MIN + Math.min(NUMBER_MAX - NUMBER_MIN, Math.floor(random() * (NUMBER_MAX - NUMBER_MIN + 1)));
  return `${adjective} ${title} ${number}`;
}

function session(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

/** This visit's suggestion: the one already made in this tab, or a new one. */
export function loadOrCreateSuggestedName(random: () => number = Math.random): string {
  const store = session();
  try {
    const existing = store?.getItem(SUGGESTED_NAME_STORAGE_KEY);
    if (existing) return existing;
  } catch {
    // Storage can throw in privacy modes; a new suggestion is fine.
  }
  const name = suggestPlayerName(random);
  try {
    store?.setItem(SUGGESTED_NAME_STORAGE_KEY, name);
  } catch {
    // Not remembering the suggestion across a reload is harmless.
  }
  return name;
}
