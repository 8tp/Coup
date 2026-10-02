import { BotPersonality, GameMode } from '@/shared/types';

/**
 * Practice vs Bots — the options a new player picks on the setup sheet, and
 * the one place they are turned into a bot list. Pure, so the mapping is
 * tested rather than eyeballed.
 */

/** Plain-language bot styles. The personality behind each is an engine detail. */
export type PracticeStyle = 'gentle' | 'sharp' | 'ruthless';

export type PracticeOpponents = 1 | 2 | 3;

export interface PracticeOptions {
  opponents: PracticeOpponents;
  style: PracticeStyle;
  gameMode: GameMode;
  /** Show the coach callouts during the game. */
  coach: boolean;
}

export const PRACTICE_STYLE_PERSONALITY: Record<PracticeStyle, Exclude<BotPersonality, 'random'>> = {
  gentle: 'conservative',
  sharp: 'analytical',
  ruthless: 'optimal',
};

export const PRACTICE_STYLES: ReadonlyArray<{ id: PracticeStyle; label: string; blurb: string }> = [
  { id: 'gentle', label: 'Gentle', blurb: 'Rarely bluffs, rarely challenges. Good for a first game.' },
  { id: 'sharp', label: 'Sharp', blurb: 'Counts the cards and calls bluffs that do not add up.' },
  { id: 'ruthless', label: 'Ruthless', blurb: 'Plays to win: picks its bluffs and goes for the leader.' },
];

export const PRACTICE_OPPONENT_CHOICES: readonly PracticeOpponents[] = [1, 2, 3];

/** The names the practice table is seated with, in seat order. */
export const PRACTICE_BOT_NAMES = ['Tutor Bot', 'Morgan Bot', 'Rook Bot'] as const;

export const DEFAULT_PRACTICE_OPTIONS: PracticeOptions = {
  opponents: 1,
  style: 'gentle',
  gameMode: GameMode.Classic,
  coach: true,
};

/**
 * The options for a one-tap practice game in a given mode (Settings, the
 * tutorial's "Play a guided game"). Reformation keeps the two-bot table it
 * always had: with a single opponent the faction split never restricts a
 * target, so the expansion's main idea would never come up.
 */
export function practiceOptionsForMode(gameMode: GameMode): PracticeOptions {
  return {
    ...DEFAULT_PRACTICE_OPTIONS,
    gameMode,
    opponents: gameMode === GameMode.Reformation ? 2 : 1,
  };
}

/** Clamp anything that came from outside (storage, a URL) into a legal option set. */
export function normalizePracticeOptions(input: Partial<PracticeOptions> | null | undefined): PracticeOptions {
  const o = input ?? {};
  const rawOpponents = Math.round(Number(o.opponents));
  const opponents = (Number.isFinite(rawOpponents)
    ? Math.min(3, Math.max(1, rawOpponents))
    : DEFAULT_PRACTICE_OPTIONS.opponents) as PracticeOpponents;
  const style: PracticeStyle = o.style && o.style in PRACTICE_STYLE_PERSONALITY ? o.style : DEFAULT_PRACTICE_OPTIONS.style;
  const gameMode = o.gameMode === GameMode.Reformation ? GameMode.Reformation : GameMode.Classic;
  const coach = typeof o.coach === 'boolean' ? o.coach : DEFAULT_PRACTICE_OPTIONS.coach;
  return { opponents, style, gameMode, coach };
}

/**
 * The bots to seat for these options: one per opponent, all the chosen
 * style, named so none collides (case-insensitively) with a human at the
 * table — the server rejects a duplicate name.
 */
export function practiceBots(
  options: PracticeOptions,
  existingNames: readonly string[] = [],
): Array<{ name: string; personality: BotPersonality }> {
  const { opponents, style } = normalizePracticeOptions(options);
  const personality = PRACTICE_STYLE_PERSONALITY[style];
  const taken = new Set(existingNames.map(n => n.trim().toLowerCase()));
  const bots: Array<{ name: string; personality: BotPersonality }> = [];
  let fallback = 1;
  for (const preferred of PRACTICE_BOT_NAMES) {
    if (bots.length === opponents) break;
    let name: string = preferred;
    while (taken.has(name.toLowerCase())) name = `Bot ${fallback++}`;
    taken.add(name.toLowerCase());
    bots.push({ name, personality });
  }
  return bots;
}

/** One-line summary for the start button, e.g. "1 gentle opponent · Classic". */
export function describePracticeOptions(options: PracticeOptions): string {
  const style = PRACTICE_STYLES.find(s => s.id === options.style)?.label.toLowerCase() ?? options.style;
  const who = `${options.opponents} ${style} ${options.opponents === 1 ? 'opponent' : 'opponents'}`;
  return `${who} · ${options.gameMode}`;
}
