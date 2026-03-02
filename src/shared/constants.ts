import { ActionType, BotPersonality, Character, PersonalityParams, LogEventType, RoomSettings } from './types';

// ─── Action Display Names ───
export const ACTION_DISPLAY_NAMES: Record<ActionType, string> = {
  [ActionType.Income]: 'Income',
  [ActionType.ForeignAid]: 'Foreign Aid',
  [ActionType.Coup]: 'Coup',
  [ActionType.Tax]: 'Tax',
  [ActionType.Assassinate]: 'Assassinate',
  [ActionType.Steal]: 'Steal',
  [ActionType.Exchange]: 'Exchange',
};

// ─── Game Constants ───
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const STARTING_COINS = 2;
export const CARDS_PER_CHARACTER = 3;
export const STARTING_HAND_SIZE = 2;
export const COUP_COST = 7;
export const ASSASSINATE_COST = 3;
export const FORCED_COUP_THRESHOLD = 10;
export const CHALLENGE_TIMER_MS = 15_000;
export const BLOCK_TIMER_MS = 15_000;
export const TURN_TIMER_MS = 30_000;
export const EXCHANGE_DRAW_COUNT = 2;

// ─── Room Settings ───
export const DEFAULT_BOT_MIN_REACTION_SECONDS = 2;
export const MIN_BOT_REACTION_SECONDS = 1;
export const MAX_BOT_REACTION_SECONDS = 10;
export const DEFAULT_ROOM_SETTINGS: RoomSettings = { actionTimerSeconds: 15, turnTimerSeconds: 30, isPublic: false, botMinReactionSeconds: DEFAULT_BOT_MIN_REACTION_SECONDS };
export const PUBLIC_ROOM_LIST_MAX = 50;
export const MIN_ACTION_TIMER = 10;
export const MAX_ACTION_TIMER = 60;
export const MIN_TURN_TIMER = 15;
export const MAX_TURN_TIMER = 90;

// Total coins in the game (physical game has 50)
export const TOTAL_COINS = 50;

// ─── Bot Constants ───
export const BOT_NAMES = [
  'R2-D2', 'HAL 9000', 'WALL-E', 'Terminator', 'GLaDOS',
  'JARVIS', 'Data', 'Cortana', 'Baymax', 'Optimus',
  'Ultron', 'Skynet', 'Bender', 'C-3PO', 'Marvin',
  'Agent Smith', 'Megatron', 'Robocop', 'TARS', 'Samantha',
  'EVE', 'Bishop', 'Sonny', 'MU-TH-UR', 'Auto',
  'Ash', 'Johnny 5', 'GERTY', 'T-1000', 'Dolores',
];
export const DEFAULT_BOT_PERSONALITY: BotPersonality = 'random';
export const BOT_ACTION_DELAY_MIN = 1500;
export const BOT_ACTION_DELAY_MAX = 3500;
export const BOT_REACTION_DELAY_MIN = 800;
export const BOT_REACTION_DELAY_MAX = 2000;
export const DISCONNECT_BOT_REPLACE_MS = 60_000;
export const INACTIVE_ROOM_CLEANUP_MS = 120_000; // 120s — rooms with no human activity are cleaned up

// ─── Bot Emote Constants ───
export const BOT_EMOTE_DELAY_MIN = 500;
export const BOT_EMOTE_DELAY_MAX = 2500;
export const BOT_EMOTE_COOLDOWN_MS = 8000;

export type BotEmoteRole = 'actor' | 'target' | 'other';

export interface BotEmoteTrigger {
  eventTypes: LogEventType[];
  botRole: BotEmoteRole;
  niceReactions: string[];
  meanReactions: string[];
}

export const BOT_EMOTE_TRIGGERS: BotEmoteTrigger[] = [
  { eventTypes: ['coup'], botRole: 'target', niceReactions: ['rip', 'wow'], meanReactions: ['salty', 'cope'] },
  { eventTypes: ['assassination'], botRole: 'target', niceReactions: ['wow', 'rip'], meanReactions: ['salty', 'cope'] },
  { eventTypes: ['challenge_success'], botRole: 'actor', niceReactions: ['lol', 'wow'], meanReactions: ['big_brain', 'eyes'] },
  { eventTypes: ['challenge_success'], botRole: 'target', niceReactions: ['sweat'], meanReactions: ['cope'] },
  { eventTypes: ['challenge_fail'], botRole: 'target', niceReactions: ['sweat'], meanReactions: ['cope', 'salty'] },
  { eventTypes: ['elimination'], botRole: 'other', niceReactions: ['rip'], meanReactions: ['lol', 'cope'] },
  { eventTypes: ['block'], botRole: 'actor', niceReactions: ['no_way'], meanReactions: ['no_way', 'sus'] },
  { eventTypes: ['action_resolve'], botRole: 'actor', niceReactions: ['gg', 'nice_bluff'], meanReactions: ['lol', 'big_brain'] },
  { eventTypes: ['action_resolve'], botRole: 'target', niceReactions: ['wow'], meanReactions: ['salty', 'eyes'] },
  { eventTypes: ['win'], botRole: 'actor', niceReactions: ['gg'], meanReactions: ['lol', 'big_brain'] },
  { eventTypes: ['win'], botRole: 'other', niceReactions: ['gg', 'rip'], meanReactions: ['salty', 'cope'] },
];

// ─── Name Constants ───
export const NAME_MAX_LENGTH = 20;

// ─── Chat Constants ───
export const CHAT_MAX_MESSAGE_LENGTH = 200;
export const CHAT_RATE_LIMIT_MS = 1000;
export const CHAT_MAX_HISTORY = 50;

// ─── Reaction Constants ───
export interface ReactionDefinition {
  id: string;
  emoji: string;
  label: string;
}

export const REACTIONS: ReactionDefinition[] = [
  { id: 'gg', emoji: '🤝', label: 'GG' },
  { id: 'nice_bluff', emoji: '🎭', label: 'Nice bluff!' },
  { id: 'sus', emoji: '🤨', label: 'Sus...' },
  { id: 'salty', emoji: '🧂', label: 'Salty' },
  { id: 'wow', emoji: '😮', label: 'Wow.' },
  { id: 'lol', emoji: '😂', label: 'LOL' },
  { id: 'rip', emoji: '⚰️', label: 'RIP' },
  { id: 'no_way', emoji: '🙅', label: 'No way!' },
  { id: 'big_brain', emoji: '🧠', label: 'Big brain' },
  { id: 'sweat', emoji: '😰', label: 'Sweating...' },
  { id: 'eyes', emoji: '👀', label: 'Watching you' },
  { id: 'cope', emoji: '🤡', label: 'Cope' },
];

export const REACTION_RATE_LIMIT_MS = 2000;
export const REACTION_DISPLAY_MS = 3000;

// ─── Socket Rate Limits ───
export const RATE_LIMIT_ROOM_CREATE_MS = 3000;
export const RATE_LIMIT_ROOM_JOIN_MS = 2000;
export const RATE_LIMIT_GAME_ACTION_MS = 500;
export const RATE_LIMIT_BOT_ADD_MS = 1000;

// ─── Action Definitions ───
export interface ActionDefinition {
  type: ActionType;
  /** Character that must be claimed (null = no claim needed) */
  claimedCharacter: Character | null;
  /** Cost in coins */
  cost: number;
  /** Does this action require a target? */
  requiresTarget: boolean;
  /** Can this action be challenged? */
  challengeable: boolean;
  /** Which characters can block this action? */
  blockedBy: Character[];
}

export const ACTION_DEFINITIONS: Record<ActionType, ActionDefinition> = {
  [ActionType.Income]: {
    type: ActionType.Income,
    claimedCharacter: null,
    cost: 0,
    requiresTarget: false,
    challengeable: false,
    blockedBy: [],
  },
  [ActionType.ForeignAid]: {
    type: ActionType.ForeignAid,
    claimedCharacter: null,
    cost: 0,
    requiresTarget: false,
    challengeable: false,
    blockedBy: [Character.Duke],
  },
  [ActionType.Coup]: {
    type: ActionType.Coup,
    claimedCharacter: null,
    cost: COUP_COST,
    requiresTarget: true,
    challengeable: false,
    blockedBy: [],
  },
  [ActionType.Tax]: {
    type: ActionType.Tax,
    claimedCharacter: Character.Duke,
    cost: 0,
    requiresTarget: false,
    challengeable: true,
    blockedBy: [],
  },
  [ActionType.Assassinate]: {
    type: ActionType.Assassinate,
    claimedCharacter: Character.Assassin,
    cost: ASSASSINATE_COST,
    requiresTarget: true,
    challengeable: true,
    blockedBy: [Character.Contessa],
  },
  [ActionType.Steal]: {
    type: ActionType.Steal,
    claimedCharacter: Character.Captain,
    cost: 0,
    requiresTarget: true,
    challengeable: true,
    blockedBy: [Character.Captain, Character.Ambassador],
  },
  [ActionType.Exchange]: {
    type: ActionType.Exchange,
    claimedCharacter: Character.Ambassador,
    cost: 0,
    requiresTarget: false,
    challengeable: true,
    blockedBy: [],
  },
};

// ─── Character role descriptions ───
export const CHARACTER_DESCRIPTIONS: Record<Character, string> = {
  [Character.Duke]: 'Tax: Take 3 coins. Blocks Foreign Aid.',
  [Character.Assassin]: 'Assassinate: Pay 3 coins, target loses influence.',
  [Character.Captain]: 'Steal: Take 2 coins from target. Blocks Steal.',
  [Character.Ambassador]: 'Exchange: Draw 2, return 2. Blocks Steal.',
  [Character.Contessa]: 'Blocks Assassination.',
};

// ─── Log Event Icons ───
export const LOG_EVENT_ICONS: Record<LogEventType, string> = {
  game_start: '🎮',
  turn_start: '▶',
  income: '💰',
  coup: '⚔️',
  claim_action: '🎭',
  declare_action: '📢',
  challenge: '❓',
  challenge_fail: '✅',
  challenge_success: '❌',
  block: '🛑',
  block_challenge: '❓',
  block_challenge_fail: '✅',
  block_challenge_success: '❌',
  block_unchallenged: '🛑',
  influence_loss: '💀',
  exchange: '🔄',
  exchange_draw: '🔄',
  action_resolve: '✨',
  assassination: '🗡️',
  elimination: '☠️',
  win: '🏆',
  bot_replace: '🤖',
};

// ─── Character colors (for UI) ───
export const CHARACTER_COLORS: Record<Character, string> = {
  [Character.Duke]: '#9b59b6',
  [Character.Assassin]: '#2c3e50',
  [Character.Captain]: '#2980b9',
  [Character.Ambassador]: '#27ae60',
  [Character.Contessa]: '#e74c3c',
};

// ─── Character icons (emoji placeholders) ───
export const CHARACTER_ICONS: Record<Character, string> = {
  [Character.Duke]: '👑',
  [Character.Assassin]: '🗡️',
  [Character.Captain]: '🛡️',
  [Character.Ambassador]: '📜',
  [Character.Contessa]: '💃',
};

// ─── Bot Personality Archetypes ───

/** Concrete personality types (excludes 'random' which resolves at runtime). */
export const BOT_PERSONALITY_TYPES: Exclude<BotPersonality, 'random'>[] = [
  'aggressive', 'conservative', 'vengeful', 'deceptive', 'analytical', 'optimal',
];

/**
 * Personality parameter profiles. The first 5 are calibrated from Treason game
 * dataset analysis. K-means clustering (k=5) on 35,809 human player-game
 * profiles from 19,871 five-player original Coup games identified 5 behavioral
 * archetypes. 'optimal' is a hand-tuned strategic profile based on winner data.
 *
 * Action bluff rates, challenge rates, action weights, leader bias, and revenge
 * weight are directly derived from cluster centroids. Contessa/block bluff rates
 * use scaled estimates (real data shows ~0% because the risk is too high, but
 * some floor is needed for interesting gameplay). Card value spread and bluff
 * persistence are derived from challenge success rate and overall bluff tendency.
 */
export const BOT_PERSONALITIES: Record<Exclude<BotPersonality, 'random'>, PersonalityParams> = {
  aggressive: {
    name: 'aggressive',
    // Cluster 0 (22.4%): High steal bluffs, highest aggression, highest challenge rate
    bluffRateTax: 0.35,
    bluffRateSteal: 0.97,
    bluffRateAssassinate: 0.31,
    bluffRateExchange: 0.00,
    bluffRateContessa: 0.15,
    bluffRateOtherBlock: 0.08,
    challengeRateBase: 0.12,
    challengeRateWithEvidence: 0.30,
    challengeRateBlock: 0.14,
    actionWeightIncome: 0.76,
    actionWeightForeignAid: 0.84,
    actionWeightSteal: 1.54,
    actionWeightAssassinate: 1.63,
    leaderBias: 0.34,
    revengeWeight: 0.16,
    cardValueSpread: 0.97,
    bluffPersistenceModifier: 3.14,
  },

  conservative: {
    name: 'conservative',
    // Cluster 1 (23.2%): Lowest bluffs overall, highest safe actions, most honest
    bluffRateTax: 0.65,
    bluffRateSteal: 0.01,
    bluffRateAssassinate: 0.01,
    bluffRateExchange: 0.01,
    bluffRateContessa: 0.04,
    bluffRateOtherBlock: 0.04,
    challengeRateBase: 0.08,
    challengeRateWithEvidence: 0.21,
    challengeRateBlock: 0.10,
    actionWeightIncome: 0.85,
    actionWeightForeignAid: 0.89,
    actionWeightSteal: 1.06,
    actionWeightAssassinate: 1.03,
    leaderBias: 0.39,
    revengeWeight: 0.15,
    cardValueSpread: 0.92,
    bluffPersistenceModifier: 1.81,
  },

  vengeful: {
    name: 'vengeful',
    // Cluster 3 (16.9%): High assassin bluffs, highest revenge rate, high safe actions
    bluffRateTax: 0.47,
    bluffRateSteal: 0.01,
    bluffRateAssassinate: 0.98,
    bluffRateExchange: 0.01,
    bluffRateContessa: 0.10,
    bluffRateOtherBlock: 0.06,
    challengeRateBase: 0.11,
    challengeRateWithEvidence: 0.28,
    challengeRateBlock: 0.14,
    actionWeightIncome: 1.03,
    actionWeightForeignAid: 0.98,
    actionWeightSteal: 1.20,
    actionWeightAssassinate: 1.20,
    leaderBias: 0.32,
    revengeWeight: 0.75,
    cardValueSpread: 0.98,
    bluffPersistenceModifier: 1.47,
  },

  deceptive: {
    name: 'deceptive',
    // Cluster 2 (14.1%): Bluffs everything (steal+exchange+tax), lowest safe actions
    bluffRateTax: 0.36,
    bluffRateSteal: 0.97,
    bluffRateAssassinate: 0.27,
    bluffRateExchange: 0.98,
    bluffRateContessa: 0.20,
    bluffRateOtherBlock: 0.12,
    challengeRateBase: 0.10,
    challengeRateWithEvidence: 0.25,
    challengeRateBlock: 0.12,
    actionWeightIncome: 0.70,
    actionWeightForeignAid: 0.81,
    actionWeightSteal: 1.37,
    actionWeightAssassinate: 1.41,
    leaderBias: 0.33,
    revengeWeight: 0.18,
    cardValueSpread: 0.97,
    bluffPersistenceModifier: 3.15,
  },

  analytical: {
    name: 'analytical',
    // Cluster 4 (23.4%): High exchange bluffs, high leader targeting, calculated resource-gathering
    bluffRateTax: 0.57,
    bluffRateSteal: 0.01,
    bluffRateAssassinate: 0.34,
    bluffRateExchange: 1.00,
    bluffRateContessa: 0.06,
    bluffRateOtherBlock: 0.05,
    challengeRateBase: 0.09,
    challengeRateWithEvidence: 0.22,
    challengeRateBlock: 0.11,
    actionWeightIncome: 0.81,
    actionWeightForeignAid: 0.86,
    actionWeightSteal: 1.04,
    actionWeightAssassinate: 1.00,
    leaderBias: 0.37,
    revengeWeight: 0.17,
    cardValueSpread: 0.95,
    bluffPersistenceModifier: 1.65,
  },

  optimal: {
    name: 'optimal',
    // Hand-tuned strategic profile based on winner data analysis
    bluffRateTax: 0.90,
    bluffRateSteal: 0.60,
    bluffRateAssassinate: 0.50,
    bluffRateExchange: 0.50,
    bluffRateContessa: 0.25,
    bluffRateOtherBlock: 0.15,
    challengeRateBase: 0.05,
    challengeRateWithEvidence: 0.30,
    challengeRateBlock: 0.05,
    actionWeightIncome: 1.0,
    actionWeightForeignAid: 1.0,
    actionWeightSteal: 1.0,
    actionWeightAssassinate: 1.0,
    leaderBias: 1.0,
    revengeWeight: 0.0,
    cardValueSpread: 1.0,
    bluffPersistenceModifier: 1.0,
  },
};
