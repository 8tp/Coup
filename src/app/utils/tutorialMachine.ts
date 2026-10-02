import { COUP_COST, FORCED_COUP_THRESHOLD, STARTING_COINS } from '@/shared/constants';
import { Character } from '@/shared/types';

/**
 * "How Coup works" — the tutorial's chapters and every demonstration's state,
 * as one reducer. The components only render this state and dispatch taps, so
 * the whole sequence is tested without a browser.
 */

export const TUTORIAL_CHAPTERS = [
  { id: 'goal', label: 'The goal' },
  { id: 'turn', label: 'Your turn' },
  { id: 'claims', label: 'Claims' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'coins', label: 'Coins' },
  { id: 'finish', label: 'Ready' },
] as const;

export type ChapterId = (typeof TUTORIAL_CHAPTERS)[number]['id'];

export const LAST_CHAPTER = TUTORIAL_CHAPTERS.length - 1;

/* ── Chapter 1: the goal ─────────────────────────────────────────────── */

/** dealt → peeked → lost-one → out, then "deal again" returns to peeked. */
export type GoalStep = 'dealt' | 'peeked' | 'lost-one' | 'out';
const GOAL_ORDER: readonly GoalStep[] = ['dealt', 'peeked', 'lost-one', 'out'];

/* ── Chapter 2: your turn ────────────────────────────────────────────── */

export type TurnActionId =
  | 'income' | 'foreign-aid' | 'coup'
  | 'tax' | 'steal' | 'assassinate' | 'exchange';

export interface TurnActionDef {
  id: TurnActionId;
  label: string;
  /** Coins gained (positive) or paid (negative). */
  delta: number;
  /** The character this action claims, or null for a general action. */
  claim: Character | null;
  /** What happened, in one sentence. */
  result: string;
}

export const TURN_ACTIONS: readonly TurnActionDef[] = [
  { id: 'income', label: 'Income', delta: 1, claim: null, result: 'Income: +1 coin. Nobody can stop it.' },
  { id: 'foreign-aid', label: 'Foreign Aid', delta: 2, claim: null, result: 'Foreign Aid: +2 coins — unless someone blocks with a Duke.' },
  { id: 'coup', label: 'Coup', delta: -COUP_COST, claim: null, result: 'Coup: pay 7 and a player of your choice loses a card.' },
  { id: 'tax', label: 'Tax', delta: 3, claim: Character.Duke, result: 'Tax: you claim the Duke and take 3 coins.' },
  { id: 'steal', label: 'Steal', delta: 2, claim: Character.Captain, result: 'Steal: you claim the Captain and take 2 coins from a player.' },
  { id: 'assassinate', label: 'Assassinate', delta: -3, claim: Character.Assassin, result: 'Assassinate: you claim the Assassin, pay 3, and a player loses a card.' },
  { id: 'exchange', label: 'Exchange', delta: 0, claim: Character.Ambassador, result: 'Exchange: you claim the Ambassador and swap cards with the deck.' },
];

export function turnAction(id: TurnActionId): TurnActionDef {
  return TURN_ACTIONS.find(a => a.id === id)!;
}

/* ── Chapter 4: challenge ────────────────────────────────────────────── */

/** Round 0: Alex bluffs. Round 1: Alex tells the truth. */
export type ChallengeRound = 0 | 1;
export type ChallengeStage = 'claim' | 'revealed' | 'passed';

/* ── Chapter 5: blocks ───────────────────────────────────────────────── */

export interface BlockThreat {
  action: 'Foreign Aid' | 'Steal' | 'Assassinate';
  /** The character the actor claims, or null (Foreign Aid claims nothing). */
  claim: Character | null;
  /** Whether it is aimed at you. */
  targeted: boolean;
}

export const BLOCK_THREATS: readonly BlockThreat[] = [
  { action: 'Foreign Aid', claim: null, targeted: false },
  { action: 'Steal', claim: Character.Captain, targeted: true },
  { action: 'Assassinate', claim: Character.Assassin, targeted: true },
];

/** Who may block a threat. The Inquisitor replaces the Ambassador in Reformation. */
export function blockersFor(threat: number, useInquisitor = false): Character[] {
  switch (BLOCK_THREATS[threat]?.action) {
    case 'Foreign Aid': return [Character.Duke];
    case 'Steal': return [Character.Captain, useInquisitor ? Character.Inquisitor : Character.Ambassador];
    case 'Assassinate': return [Character.Contessa];
    default: return [];
  }
}

/* ── Chapter 6: coins ────────────────────────────────────────────────── */

export const COINS_DEMO_START = 5;

export function canCoup(coins: number): boolean {
  return coins >= COUP_COST;
}

export function mustCoup(coins: number): boolean {
  return coins >= FORCED_COUP_THRESHOLD;
}

/* ── The whole tutorial ──────────────────────────────────────────────── */

export interface TutorialState {
  chapter: number;
  goal: { step: GoalStep };
  turn: { coins: number; last: TurnActionId | null; refused: boolean };
  claims: { claimed: boolean };
  challenge: { round: ChallengeRound; stage: ChallengeStage };
  blocks: { threat: number; blocked: boolean; miss: Character | null };
  coins: { coins: number; couped: boolean; refusal: string | null };
}

export type TutorialEvent =
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'goto'; chapter: number }
  | { type: 'reset' }
  | { type: 'goal/advance' }
  | { type: 'turn/take'; action: TurnActionId }
  | { type: 'claims/claim' }
  | { type: 'claims/reset' }
  | { type: 'challenge/challenge' }
  | { type: 'challenge/pass' }
  | { type: 'challenge/rewind' }
  | { type: 'challenge/next-round' }
  | { type: 'blocks/pick'; character: Character; useInquisitor?: boolean }
  | { type: 'blocks/next' }
  | { type: 'coins/take'; amount: number }
  | { type: 'coins/coup' }
  | { type: 'coins/reset' };

export const INITIAL_TUTORIAL_STATE: TutorialState = {
  chapter: 0,
  goal: { step: 'dealt' },
  turn: { coins: STARTING_COINS, last: null, refused: false },
  claims: { claimed: false },
  challenge: { round: 0, stage: 'claim' },
  blocks: { threat: 0, blocked: false, miss: null },
  coins: { coins: COINS_DEMO_START, couped: false, refusal: null },
};

function clampChapter(n: number): number {
  return Math.max(0, Math.min(LAST_CHAPTER, Math.round(n)));
}

export function tutorialReducer(state: TutorialState, event: TutorialEvent): TutorialState {
  switch (event.type) {
    case 'next':
      return state.chapter >= LAST_CHAPTER ? state : { ...state, chapter: state.chapter + 1 };
    case 'back':
      return state.chapter <= 0 ? state : { ...state, chapter: state.chapter - 1 };
    case 'goto': {
      const chapter = clampChapter(event.chapter);
      return chapter === state.chapter ? state : { ...state, chapter };
    }
    case 'reset':
      return INITIAL_TUTORIAL_STATE;

    case 'goal/advance': {
      const at = GOAL_ORDER.indexOf(state.goal.step);
      // After "out", dealing again goes straight to looking at a fresh hand.
      const step = at >= GOAL_ORDER.length - 1 ? 'peeked' : GOAL_ORDER[at + 1];
      return { ...state, goal: { step } };
    }

    case 'turn/take': {
      const def = turnAction(event.action);
      const coins = state.turn.coins + def.delta;
      if (coins < 0) return { ...state, turn: { ...state.turn, last: def.id, refused: true } };
      return { ...state, turn: { coins, last: def.id, refused: false } };
    }

    case 'claims/claim':
      return state.claims.claimed ? state : { ...state, claims: { claimed: true } };
    case 'claims/reset':
      return { ...state, claims: { claimed: false } };

    case 'challenge/challenge':
      return state.challenge.stage === 'claim'
        ? { ...state, challenge: { ...state.challenge, stage: 'revealed' } }
        : state;
    case 'challenge/pass':
      return state.challenge.stage === 'claim'
        ? { ...state, challenge: { ...state.challenge, stage: 'passed' } }
        : state;
    case 'challenge/rewind':
      return { ...state, challenge: { ...state.challenge, stage: 'claim' } };
    case 'challenge/next-round':
      // From the bluff to the truth; from the truth back to the start.
      return {
        ...state,
        challenge: { round: state.challenge.round === 0 ? 1 : 0, stage: 'claim' },
      };

    case 'blocks/pick': {
      if (state.blocks.blocked) return state;
      const right = blockersFor(state.blocks.threat, event.useInquisitor).includes(event.character);
      return {
        ...state,
        blocks: right
          ? { ...state.blocks, blocked: true, miss: null }
          : { ...state.blocks, miss: event.character },
      };
    }
    case 'blocks/next': {
      const threat = (state.blocks.threat + 1) % BLOCK_THREATS.length;
      return { ...state, blocks: { threat, blocked: false, miss: null } };
    }

    case 'coins/take': {
      if (state.coins.couped) return state;
      if (mustCoup(state.coins.coins)) {
        return { ...state, coins: { ...state.coins, refusal: 'At 10 coins you must Coup — nothing else is allowed.' } };
      }
      return { ...state, coins: { coins: state.coins.coins + event.amount, couped: false, refusal: null } };
    }
    case 'coins/coup': {
      if (state.coins.couped) return state;
      if (!canCoup(state.coins.coins)) {
        const short = COUP_COST - state.coins.coins;
        return {
          ...state,
          coins: { ...state.coins, refusal: `A Coup costs 7. You need ${short} more ${short === 1 ? 'coin' : 'coins'}.` },
        };
      }
      return { ...state, coins: { coins: state.coins.coins - COUP_COST, couped: true, refusal: null } };
    }
    case 'coins/reset':
      return { ...state, coins: INITIAL_TUTORIAL_STATE.coins };
  }
}

/**
 * Has the player done the thing this chapter's demonstration is for? Drives
 * which footer button is the brass one — the tutorial never locks Next.
 */
export function chapterDone(state: TutorialState, id: ChapterId = TUTORIAL_CHAPTERS[state.chapter].id): boolean {
  switch (id) {
    case 'goal': return GOAL_ORDER.indexOf(state.goal.step) >= GOAL_ORDER.indexOf('lost-one');
    case 'turn': return state.turn.last !== null;
    case 'claims': return state.claims.claimed;
    case 'challenge': return state.challenge.round === 1 && state.challenge.stage === 'revealed';
    case 'blocks': return state.blocks.threat === BLOCK_THREATS.length - 1 && state.blocks.blocked;
    case 'coins': return state.coins.couped;
    case 'finish': return true;
  }
}
