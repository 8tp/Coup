import { ActionType, BotPersonality, Character, GameMode, PersonalityParams, LogEventType, RoomSettings } from './types';

// ─── Action Display Names ───
/**
 * English, for the server's own log and error text. Screens name actions
 * with `actionName(t, type)` from `src/app/i18n`, so they read in the
 * player's language.
 */
export const ACTION_DISPLAY_NAMES: Record<ActionType, string> = {
  [ActionType.Income]: 'Income',
  [ActionType.ForeignAid]: 'Foreign Aid',
  [ActionType.Coup]: 'Coup',
  [ActionType.Tax]: 'Tax',
  [ActionType.Assassinate]: 'Assassinate',
  [ActionType.Steal]: 'Steal',
  [ActionType.Exchange]: 'Exchange',
  [ActionType.Convert]: 'Convert',
  [ActionType.Embezzle]: 'Embezzle',
  [ActionType.Examine]: 'Examine',
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
/** Coins Income takes from the treasury. */
export const INCOME_COINS = 1;
/** Coins Foreign Aid takes from the treasury. */
export const FOREIGN_AID_COINS = 2;
/** Coins Tax (Duke) takes from the treasury. */
export const TAX_COINS = 3;
/** Coins Steal (Captain) takes from the target, at most: a target with fewer gives what they have. */
export const STEAL_COINS = 2;
export const CHALLENGE_TIMER_MS = 15_000;
export const BLOCK_TIMER_MS = 15_000;
export const TURN_TIMER_MS = 30_000;
export const EXCHANGE_DRAW_COUNT = 2;
export const INQUISITOR_EXCHANGE_DRAW_COUNT = 1;

// ─── Reformation Constants ───
export const CONVERSION_SELF_COST = 1;
export const CONVERSION_OTHER_COST = 2;

// ─── Room Settings ───
export const DEFAULT_BOT_MIN_REACTION_SECONDS = 2;
export const MIN_BOT_REACTION_SECONDS = 1;
export const MAX_BOT_REACTION_SECONDS = 10;
export const DEFAULT_ROOM_SETTINGS: RoomSettings = { actionTimerSeconds: 15, turnTimerSeconds: 30, isPublic: false, botMinReactionSeconds: DEFAULT_BOT_MIN_REACTION_SECONDS, gameMode: GameMode.Classic, useInquisitor: false };
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
/** How long a player who drops their socket in the lobby (or on the game-over screen) keeps their seat. */
export const LOBBY_DISCONNECT_GRACE_MS = 45_000;
/** Consecutive turn-timer expiries on a connected human's own decisions before a bot takes the seat. */
export const AFK_TIMEOUTS_BEFORE_REPLACE = 2;
/** Number of bots added by the home-page "Play vs Bots" quick start. */
export const QUICK_PLAY_BOT_COUNT = 3;
/** "Fill with bots" in the lobby tops the table up to this many players. */
export const FILL_WITH_BOTS_TARGET = 4;

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
/** Longest name, in user-perceived characters (src/shared/textLimits.ts), whatever the script. */
export const NAME_MAX_LENGTH = 20;
/**
 * Hard cap on a name in UTF-16 code units, and the name inputs' `maxLength`.
 * Four per character leaves room for Devanagari conjuncts and emoji
 * sequences while bounding stacked combining marks.
 */
export const NAME_MAX_CODE_UNITS = NAME_MAX_LENGTH * 4;
/** Most combining marks kept in a row: real text needs two or three (Vietnamese, Arabic, Devanagari); more is "zalgo". */
export const TEXT_MAX_COMBINING_RUN = 4;

// ─── Chat Constants ───
/** Longest chat message, in user-perceived characters. */
export const CHAT_MAX_MESSAGE_LENGTH = 200;
/** Hard cap on a chat message in UTF-16 code units (see NAME_MAX_CODE_UNITS). */
export const CHAT_MAX_MESSAGE_CODE_UNITS = CHAT_MAX_MESSAGE_LENGTH * 4;
export const CHAT_RATE_LIMIT_MS = 1000;
export const CHAT_MAX_HISTORY = 50;

// ─── Quick Phrases ───
/**
 * One-tap chat lines offered in the desktop chat composer. The client sends
 * the `id` (`chat:send` with `phraseId`) and every reader renders it from the
 * catalog (`game.phrase.<id>`) in their own language. `text` is the English,
 * used only as the chat line's `message` for older clients and server logs.
 */
export const QUICK_PHRASE_IDS = ['nice_bluff', 'have_it', 'liar', 'well_played'] as const;
export type QuickPhraseId = (typeof QUICK_PHRASE_IDS)[number];

export const QUICK_PHRASES: ReadonlyArray<{ id: QuickPhraseId; text: string }> = [
  { id: 'nice_bluff', text: 'Nice bluff' },
  { id: 'have_it', text: 'I have it' },
  { id: 'liar', text: 'Liar!' },
  { id: 'well_played', text: 'Well played' },
];

export function isQuickPhraseId(value: unknown): value is QuickPhraseId {
  return typeof value === 'string' && (QUICK_PHRASE_IDS as readonly string[]).includes(value);
}

// ─── Reaction Constants ───
export const REACTION_IDS = [
  'gg', 'nice_bluff', 'sus', 'salty', 'wow', 'lol', 'rip', 'no_way', 'big_brain', 'sweat', 'eyes', 'cope',
] as const;
export type ReactionId = (typeof REACTION_IDS)[number];

export function isReactionId(value: unknown): value is ReactionId {
  return typeof value === 'string' && (REACTION_IDS as readonly string[]).includes(value);
}

export interface ReactionDefinition {
  id: ReactionId;
  emoji: string;
  /**
   * English, for the server's chat line (`"<emoji> <label>"`), which older
   * clients and server logs read. Screens render `game.reaction.<id>` from
   * the catalog instead.
   */
  label: string;
}

export const REACTIONS: ReactionDefinition[] = [
  { id: 'gg', emoji: '🤝', label: 'GG' },
  { id: 'nice_bluff', emoji: '🎭', label: 'Nice bluff' },
  { id: 'sus', emoji: '🤨', label: 'Sus' },
  { id: 'salty', emoji: '🧂', label: 'Salty' },
  { id: 'wow', emoji: '😮', label: 'Wow' },
  { id: 'lol', emoji: '😂', label: 'LOL' },
  { id: 'rip', emoji: '⚰️', label: 'RIP' },
  { id: 'no_way', emoji: '🙅', label: 'No way' },
  { id: 'big_brain', emoji: '🧠', label: 'Big brain' },
  { id: 'sweat', emoji: '😰', label: 'Sweating' },
  { id: 'eyes', emoji: '👀', label: 'Watching you' },
  { id: 'cope', emoji: '🤡', label: 'Cope' },
];

export const REACTION_RATE_LIMIT_MS = 2000;
export const REACTION_DISPLAY_MS = 3000;

// ─── Feedback Constants ───
/** Longest feedback note accepted, after trimming and stripping control characters. */
export const FEEDBACK_MAX_LENGTH = 1000;
/** Reject a raw payload this long without sanitizing it (cheap guard against huge strings). */
export const FEEDBACK_MAX_RAW_LENGTH = FEEDBACK_MAX_LENGTH * 4;
/** Per connection: at most this many notes in the window below. */
export const FEEDBACK_PER_CONNECTION_MAX = 5;
export const FEEDBACK_PER_CONNECTION_WINDOW_MS = 10 * 60_000;
/** Whole server: at most this many notes in the window below, so nobody can flood the log or database. */
export const FEEDBACK_GLOBAL_MAX = 30;
export const FEEDBACK_GLOBAL_WINDOW_MS = 10 * 60_000;
/** Client gives up waiting for the server's acknowledgement after this long. */
export const FEEDBACK_ACK_TIMEOUT_MS = 8000;
/** Viewport width buckets reported with feedback (CSS px). */
export const FEEDBACK_PHONE_MAX_WIDTH = 639;
export const FEEDBACK_TABLET_MAX_WIDTH = 1023;
/** GitHub issues page offered as a secondary route. */
export const FEEDBACK_GITHUB_ISSUES_URL = 'https://github.com/8tp/Coup/issues/new/choose';

// ─── Socket Rate Limits ───
export const RATE_LIMIT_ROOM_CREATE_MS = 3000;
export const RATE_LIMIT_ROOM_JOIN_MS = 2000;
export const RATE_LIMIT_GAME_ACTION_MS = 500;
export const RATE_LIMIT_BOT_ADD_MS = 400; // add-one then fill-seats in quick succession is normal use
/**
 * How long a prompt holds a sent answer (the chosen button stays pressed, a
 * second answer is ignored) while waiting for the server. Normally released
 * far sooner, by the server's reply; this only covers a reply that never comes.
 */
export const PENDING_ANSWER_TIMEOUT_MS = 5000;

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
    blockedBy: [Character.Captain, Character.Ambassador, Character.Inquisitor],
  },
  [ActionType.Exchange]: {
    type: ActionType.Exchange,
    claimedCharacter: Character.Ambassador,
    cost: 0,
    requiresTarget: false,
    challengeable: true,
    blockedBy: [],
  },
  // Reformation expansion actions
  [ActionType.Convert]: {
    type: ActionType.Convert,
    claimedCharacter: null,
    cost: 0, // Cost is dynamic (1 for self, 2 for other) — handled in resolver
    requiresTarget: false, // Can target self or another — handled in resolver
    challengeable: false,
    blockedBy: [],
  },
  [ActionType.Embezzle]: {
    type: ActionType.Embezzle,
    claimedCharacter: null, // Inverse claim: proves you DON'T have Duke
    cost: 0,
    requiresTarget: false,
    challengeable: true, // Inverse challenge
    blockedBy: [],
  },
  [ActionType.Examine]: {
    type: ActionType.Examine,
    claimedCharacter: Character.Inquisitor,
    cost: 0,
    requiresTarget: true,
    challengeable: true,
    blockedBy: [],
  },
};

// ─── Character role descriptions ───
/**
 * English only. The table's card preview reads `game.cardAbility.<Character>`
 * from the catalog instead; this stays for code not yet converted.
 */
export const CHARACTER_DESCRIPTIONS: Record<Character, string> = {
  [Character.Duke]: 'Tax: Take 3 coins. Blocks Foreign Aid.',
  [Character.Assassin]: 'Assassinate: Pay 3 coins. The target loses a card.',
  [Character.Captain]: 'Steal: Take 2 coins from target. Blocks Steal.',
  [Character.Ambassador]: 'Exchange: Draw 2, return 2. Blocks Steal.',
  [Character.Contessa]: 'Blocks Assassination.',
  [Character.Inquisitor]: "Exchange: Draw 1, return 1. Examine: Look at an opponent's card. Blocks Steal.",
};

// ─── Log Event Icons ───

// ─── Character colors (for UI) ───
export const CHARACTER_COLORS: Record<Character, string> = {
  [Character.Duke]: '#9b59b6',
  [Character.Assassin]: '#2c3e50',
  [Character.Captain]: '#2980b9',
  [Character.Ambassador]: '#27ae60',
  [Character.Contessa]: '#e74c3c',
  [Character.Inquisitor]: '#0d9488',
};

// ─── Character icons (emoji placeholders) ───
export const CHARACTER_ICONS: Record<Character, string> = {
  [Character.Duke]: '👑',
  [Character.Assassin]: '🗡️',
  [Character.Captain]: '🛡️',
  [Character.Ambassador]: '📜',
  [Character.Contessa]: '💃',
  [Character.Inquisitor]: '🔍',
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

// ─── Home Screen Constants ───

/**
 * The live counter on the home screen ("12 online · 3 games in play") shows
 * only at or above this many people online, and is left out entirely below
 * it. `playersOnline` counts distinct connections by IP and includes the
 * visitor reading it, so a single-digit figure mostly says "nobody else is
 * here". Ten is the first two-digit number: enough people for a couple of
 * full tables, which reads as a busy room rather than an empty one. At the
 * current ~20 visitors a day it rarely shows; it appears when there is a
 * real crowd to point at.
 */
export const HOME_PRESENCE_MIN_ONLINE = 10;

/** Public tables listed on the home screen before "Browse all" takes over. */
export const HOME_OPEN_TABLES_SHOWN = 3;

/**
 * Words for the name suggested to a first-time visitor ("Velvet Envoy 42"),
 * so Play vs Bots is a single tap. Court titles and manners to match the
 * game, never one of the character names (no "Duke 12 claims Duke"). With a
 * number from 10 to 99 that is 26 × 26 × 90 = 60,840 names, at most 18
 * characters, and every one passes the server's name filter
 * (tests/app/utils/suggestedName.test.ts checks them all).
 */
export const SUGGESTED_NAME_ADJECTIVES = [
  'Quiet', 'Sly', 'Bold', 'Velvet', 'Silver', 'Gilded', 'Masked', 'Shrewd',
  'Wily', 'Hidden', 'Steady', 'Lucky', 'Stern', 'Candid', 'Subtle', 'Brazen',
  'Nimble', 'Ashen', 'Iron', 'Golden', 'Veiled', 'Dapper', 'Placid', 'Wary',
  'Grim', 'Sombre',
] as const;

export const SUGGESTED_NAME_TITLES = [
  'Envoy', 'Baron', 'Regent', 'Herald', 'Steward', 'Marquis', 'Squire',
  'Consul', 'Notary', 'Heir', 'Warden', 'Jester', 'Scribe', 'Sheriff',
  'Abbess', 'Baroness', 'Courier', 'Vizier', 'Bailiff', 'Page',
  'Minister', 'Prior', 'Earl', 'Lady', 'Knight', 'Falconer',
] as const;
