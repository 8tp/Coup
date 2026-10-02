import { BOT_NAMES, DEFAULT_BOT_PERSONALITY, FILL_WITH_BOTS_TARGET, MAX_PLAYERS } from '@/shared/constants';
import { BotPersonality } from '@/shared/types';

/** How many bots "Fill with bots" should add to reach `target` seats. */
export function botsNeededToFill(currentPlayers: number, target: number = FILL_WITH_BOTS_TARGET): number {
  return Math.max(0, Math.min(target, MAX_PLAYERS) - currentPlayers);
}

/**
 * Build `count` bots with distinct names that don't clash (case-insensitively)
 * with anyone already in the room, ready for `bot:add_many`.
 */
export function buildBots(
  count: number,
  existingNames: string[],
  personality: BotPersonality = DEFAULT_BOT_PERSONALITY,
  random: () => number = Math.random,
): Array<{ name: string; personality: BotPersonality }> {
  const taken = new Set(existingNames.map(n => n.toLowerCase()));
  const pool = BOT_NAMES.filter(n => !taken.has(n.toLowerCase()));

  // Fisher-Yates shuffle so tables get a different cast each time
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const bots: Array<{ name: string; personality: BotPersonality }> = [];
  let fallback = 1;
  for (let i = 0; i < count; i++) {
    let name = pool[i];
    while (!name || taken.has(name.toLowerCase())) {
      name = `Bot ${fallback++}`;
    }
    taken.add(name.toLowerCase());
    bots.push({ name, personality });
  }
  return bots;
}
