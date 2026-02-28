import { ActionType, AiPersonality, Character, RoomSettings } from './types';

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
export const EXCHANGE_DRAW_COUNT = 2;

// ─── Room Settings ───
export const DEFAULT_ROOM_SETTINGS: RoomSettings = { actionTimerSeconds: 15, isPublic: false };
export const PUBLIC_ROOM_LIST_MAX = 50;
export const MIN_ACTION_TIMER = 10;
export const MAX_ACTION_TIMER = 60;

// Total coins in the game (physical game has 50)
export const TOTAL_COINS = 50;

// ─── Bot Constants ───
export const BOT_NAMES = [
  'R2-D2', 'HAL 9000', 'WALL-E', 'Terminator', 'GLaDOS',
  'JARVIS', 'Data', 'Cortana', 'Baymax', 'Optimus',
  'Ultron', 'Skynet', 'Bender', 'C-3PO', 'Marvin',
];
export const DEFAULT_PERSONALITY: AiPersonality = { honesty: 50, skepticism: 50, vengefulness: 50 };
export const BOT_ACTION_DELAY_MIN = 1500;
export const BOT_ACTION_DELAY_MAX = 3500;
export const BOT_REACTION_DELAY_MIN = 800;
export const BOT_REACTION_DELAY_MAX = 2000;

// ─── Chat Constants ───
export const CHAT_MAX_MESSAGE_LENGTH = 200;
export const CHAT_RATE_LIMIT_MS = 1000;
export const CHAT_MAX_HISTORY = 50;

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
