import { ActionType, BotDifficulty, Character, LogEventType, RoomSettings } from './types';

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
export const DEFAULT_BOT_DIFFICULTY: BotDifficulty = 'medium';
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
