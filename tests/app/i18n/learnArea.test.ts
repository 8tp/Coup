/**
 * The teaching surfaces (How to Play, both walkthroughs, the practice setup
 * sheet and the practice coach) speak only through the `rules` and
 * `tutorial` catalogs:
 *
 * - no hard-coded English in their source files (a JSX text node, a
 *   user-visible attribute, or a sentence in a string literal);
 * - every message's params are ones the components actually pass (a game
 *   noun or rule number from utils/learnText.ts, or a named extra);
 * - every coach line renders whole, with realistic params, in English and
 *   both pseudo-locales, and every coach message key is reachable.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ActionType, Character, ClientGameState, Faction, GameMode, GameStatus, TurnPhase } from '@/shared/types';
import { messageArguments } from '@/shared/i18n/messageFormat';
import en from '@/app/i18n/messages/en';
import { makePlainTranslator } from '@/app/i18n/runtime';
import type { MessageKey } from '@/app/i18n/schema';
import { RULE_NUMBERS, learnParams } from '@/app/utils/learnText';
import {
  getPracticeCoachMessage,
  renderCoachText,
  type CoachHistory,
  type PracticeCoachMessage,
} from '@/app/utils/practiceCoach';

const ROOT = path.resolve(__dirname, '../../..');

const COMPONENTS = [
  'src/app/components/home/HowToPlay.tsx',
  'src/app/components/tutorial/Tutorial.tsx',
  'src/app/components/tutorial/ReformationTutorial.tsx',
  'src/app/components/onboarding/OnboardingShell.tsx',
  'src/app/components/onboarding/PracticeSetupSheet.tsx',
  'src/app/components/onboarding/parts.tsx',
  'src/app/components/game/PracticeCoach.tsx',
];

const UTILS = [
  'src/app/utils/practiceCoach.ts',
  'src/app/utils/practiceSetup.ts',
  'src/app/utils/tutorialMachine.ts',
  'src/app/utils/learnText.ts',
];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
    // JSX comments leave `{}` behind; harmless.
    ;
}

/** Literal strings that are allowed on screen: names, punctuation, figures. */
const ALLOWED_TEXT = new Set([
  'Rikki Tahta', 'La Mame Games', 'Indie Boards & Cards', 'Alex', 'Morgan', 'Tutor Bot', 'Morgan Bot', 'Rook Bot',
  // Keyboard key names.
  'Escape', 'Tab', 'ArrowLeft', 'ArrowRight',
]);

describe('no hard-coded English in the teaching surfaces', () => {
  it.each(COMPONENTS)('%s', (file) => {
    const source = stripComments(readFileSync(path.join(ROOT, file), 'utf8'));
    const problems: string[] = [];

    // JSX text: between a tag's `>` and the next `<` or `{`, with a word in it.
    for (const m of source.matchAll(/>([^<>{}]*)</g)) {
      const text = m[1].trim();
      if (!/[A-Za-z]{2,}/.test(text)) continue;
      if (/[;=()&|]|=>/.test(text) || /^[,\s]*\w+:$/.test(text)) continue; // TypeScript, not JSX text
      problems.push(`text: ${text}`);
    }
    for (const m of source.matchAll(/>\s*([A-Za-z][^<>{}]*?)\s*\{/g)) {
      const text = m[1].trim();
      if (/[;=()&|]/.test(text) || !/[A-Za-z]{2,}/.test(text)) continue;
      problems.push(`text: ${text}`);
    }
    // User-visible attributes given a literal.
    for (const m of source.matchAll(/\b(aria-label|title|placeholder|alt|label|nextLabel|headline|detail|actor|illegalReason|note|lede)="([^"]*)"/g)) {
      if (/[A-Za-z]{2,}/.test(m[2])) problems.push(`${m[1]}="${m[2]}"`);
    }
    // Sentences in string literals (class lists and keys have no capitalised words or full stops).
    for (const m of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
      const value = m[2];
      if (ALLOWED_TEXT.has(value)) continue;
      // Class names, keys, media queries (with any `${...}` taken out).
      if (/^[a-z0-9\-:/[\]._%() ]*$/.test(value.replace(/\$\{[^}]*\}/g, ''))) continue;
      if (/[A-Za-z]{2,} [A-Za-z]{2,}/.test(value) || /^[A-Z][a-z]+$/.test(value)) problems.push(`literal: ${value}`);
    }
    expect(problems).toEqual([]);
  });

  it.each(UTILS)('%s', (file) => {
    const source = stripComments(readFileSync(path.join(ROOT, file), 'utf8'));
    const problems: string[] = [];
    for (const m of source.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
      const value = m[2];
      if (ALLOWED_TEXT.has(value)) continue;
      if (/[A-Za-z]{2,} [A-Za-z]{2,}/.test(value)) problems.push(value);
    }
    expect(problems).toEqual([]);
  });
});

/** Params a teaching message may use besides the nouns and numbers from learnText. */
const EXTRA_PARAMS = new Set([
  // rules
  'amount', 'first', 'second', 'designer', 'publisher1', 'publisher2', 'loyalistMark', 'reformistMark',
  // shell
  'index', 'total', 'label', 'title',
  // demonstrations
  'player', 'count', 'coins', 'cost', 'action', 'character', 'short',
  // setup
  'style', 'mode',
  // coach
  'actor', 'blocker', 'blockers', 'claimed', 'blockable',
]);

describe('teaching messages', () => {
  const t = makePlainTranslator('en');
  const known = new Set([...Object.keys(learnParams(t)), ...EXTRA_PARAMS]);

  it.each(['rules', 'tutorial'] as const)('%s: every param is one the components pass', (ns) => {
    const unknown: string[] = [];
    for (const [key, message] of Object.entries(en[ns])) {
      for (const arg of messageArguments(message).args) {
        if (!known.has(arg)) unknown.push(`${ns}.${key}: {${arg}}`);
      }
    }
    expect(unknown).toEqual([]);
  });

  it('states no rule number as a digit', () => {
    // Numbers in rules prose come from constants as params. The only digits
    // allowed are the credits' year and the plural `#`.
    const digits: string[] = [];
    for (const ns of ['rules', 'tutorial'] as const) {
      for (const [key, message] of Object.entries(en[ns])) {
        const stripped = message.replace(/2012/g, '').replace(/\{[^{}]*\}/g, '');
        if (/\d/.test(stripped)) digits.push(`${ns}.${key}`);
      }
    }
    expect(digits).toEqual([]);
  });

  it('every rule number is a real constant', () => {
    for (const value of Object.values(RULE_NUMBERS)) expect(Number.isInteger(value) && value > 0).toBe(true);
  });
});

// ─── The coach ───

function state(overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST',
    status: GameStatus.InProgress,
    players: [
      { id: 'me', name: 'Player', coins: 2, influences: [{ character: Character.Duke, revealed: false }, { character: Character.Captain, revealed: false }], isAlive: true, seatIndex: 0, faction: Faction.Loyalist },
      { id: 'bot', name: 'Tutor Bot', coins: 2, influences: [{ character: null, revealed: false }, { character: null, revealed: false }], isAlive: true, seatIndex: 1, isBot: true, faction: Faction.Reformist },
    ],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.AwaitingAction,
    deckCount: 11,
    treasury: 46,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineSelectionState: null,
    examineState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: 1,
    myId: 'me',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...overrides,
  };
}

const challengeOf = (claimed: Character) => ({ challengerId: '', challengedPlayerId: 'bot', claimedCharacter: claimed, passedPlayerIds: ['bot'] });
const onBot = (s: ClientGameState) => ({ ...s, currentPlayerIndex: 1 });
const seen: CoachHistory = new Map([['first-targeted', 0], ['first-block', 0]]);
const withCoins = (coins: number, s = state()) => ({ ...s, players: [{ ...s.players[0], coins }, s.players[1]] });
const withFactions = (a: Faction, b: Faction, s: ClientGameState) => ({ ...s, players: [{ ...s.players[0], faction: a }, { ...s.players[1], faction: b }] });
const reformation = (o: Partial<ClientGameState>) => state({ gameMode: GameMode.Reformation, useInquisitor: true, ...o });

/** One realistic game state per coach tip (and per variant of its text). */
const SCENARIOS: Array<[string, ClientGameState, CoachHistory?]> = [
  ['lose a card', state({ turnPhase: TurnPhase.AwaitingInfluenceLoss, influenceLossRequest: { playerId: 'me', reason: 'challenge_lost' } })],
  ['exchange', state({ turnPhase: TurnPhase.AwaitingExchange, exchangeState: { playerId: 'me', drawnCards: [Character.Duke, Character.Contessa] } as never })],
  ['examined', reformation({ turnPhase: TurnPhase.AwaitingExamineSelection, examineSelectionState: { examinerId: 'bot', targetId: 'me' } })],
  ['examining', reformation({ turnPhase: TurnPhase.AwaitingExamineDecision, examineState: { examinerId: 'me', targetId: 'bot', revealedCard: Character.Duke } as never })],
  ...[ActionType.Steal, ActionType.Assassinate].map((type): [string, ClientGameState] => [
    `first targeted by ${type}`,
    onBot(state({ turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type, actorId: 'bot', targetId: 'me', claimedCharacter: type === ActionType.Steal ? Character.Captain : Character.Assassin }, challengeState: challengeOf(Character.Captain) })),
  ]),
  ['first targeted by Examine', onBot(reformation({ turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type: ActionType.Examine, actorId: 'bot', targetId: 'me', claimedCharacter: Character.Inquisitor }, challengeState: challengeOf(Character.Inquisitor) }))],
  ['first targeted by something else', onBot(state({ turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type: ActionType.Tax, actorId: 'bot', targetId: 'me' }, challengeState: challengeOf(Character.Duke) }))],
  ['block or challenge', onBot(state({ turnNumber: 4, turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type: ActionType.Steal, actorId: 'bot', targetId: 'me', claimedCharacter: Character.Captain }, challengeState: challengeOf(Character.Captain) })), seen],
  ['block or challenge, no claim', onBot(state({ turnNumber: 4, turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type: ActionType.Assassinate, actorId: 'bot', targetId: 'me' }, challengeState: challengeOf(Character.Assassin) })), seen],
  ['challenge a claim', onBot(state({ turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type: ActionType.Tax, actorId: 'bot', claimedCharacter: Character.Duke }, challengeState: challengeOf(Character.Duke) }))],
  ['challenge a claim, no character', onBot(state({ turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type: ActionType.Exchange, actorId: 'bot' }, challengeState: challengeOf(Character.Ambassador) }))],
  ['challenge an Embezzle', onBot(reformation({ turnPhase: TurnPhase.AwaitingActionChallenge, pendingAction: { type: ActionType.Embezzle, actorId: 'bot' }, challengeState: challengeOf(Character.Duke) }))],
  ['challenge a block', state({ turnPhase: TurnPhase.AwaitingBlockChallenge, pendingAction: { type: ActionType.ForeignAid, actorId: 'me' }, pendingBlock: { blockerId: 'bot', claimedCharacter: Character.Duke }, challengeState: { ...challengeOf(Character.Duke), passedPlayerIds: [] } })],
  ['first block', onBot(state({ turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.ForeignAid, actorId: 'bot' } }))],
  ['make a block', onBot(state({ turnNumber: 9, turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.Steal, actorId: 'bot', targetId: 'me', claimedCharacter: Character.Captain } })), seen],
  ['must coup', withCoins(12)],
  ['coup ready', withCoins(8, state({ turnNumber: 6 }))],
  ['one faction', withFactions(Faction.Reformist, Faction.Reformist, reformation({ turnNumber: 4 }))],
  ['factions', reformation({})],
  ['embezzle, holding a Duke', reformation({ turnNumber: 4, treasuryReserve: 3 })],
  ['embezzle, no Duke', (() => { const s = reformation({ turnNumber: 4, treasuryReserve: 1 }); s.players[0] = { ...s.players[0], influences: [{ character: Character.Contessa, revealed: false }, { character: Character.Duke, revealed: true }] }; return s; })()],
  ['convert', reformation({ turnNumber: 4 })],
  ['opening', state()],
  ['repeat claims', state({ turnNumber: 4 })],
];

/** Coach keys that are chrome or fallbacks, not tip lines. */
const COACH_CHROME = new Set(['region', 'tag', 'gotIt', 'hide', 'rules', 'someone', 'blockerFallback']);

describe('the coach', () => {
  const tips: Array<[string, PracticeCoachMessage]> = SCENARIOS.map(([name, s, history]) => {
    const tip = getPracticeCoachMessage(s, history);
    if (!tip) throw new Error(`no tip for "${name}"`);
    return [name, tip];
  });

  it.each(['en', 'en-XA', 'ar-XB'] as const)('renders every line whole in %s', (locale) => {
    const t = makePlainTranslator(locale);
    for (const [name, tip] of tips) {
      for (const line of [tip.label, tip.title, tip.body]) {
        const out = renderCoachText(t, line);
        expect(out, `${name}: ${line.key}`).not.toMatch(/[{}]/);
        expect(out.length, `${name}: ${line.key}`).toBeGreaterThan(2);
        if (locale !== 'en') expect(out.startsWith('⟦'), `${name}: ${line.key} is not from the catalog`).toBe(true);
      }
    }
  });

  it('names players, characters and actions as given', () => {
    const t = makePlainTranslator('en');
    const byName = new Map(tips);
    expect(renderCoachText(t, byName.get('first targeted by Steal')!.title)).toBe('Tutor Bot is targeting you');
    expect(renderCoachText(t, byName.get('first targeted by Steal')!.body))
      .toBe('Steal takes 2 of your coins. Challenge if you doubt their Captain. Or block it now with Captain or Ambassador.');
    expect(renderCoachText(t, byName.get('first targeted by Examine')!.body))
      .toBe('Examine lets them look at one of your cards. Challenge if you doubt their Inquisitor.');
    expect(renderCoachText(t, byName.get('first targeted by something else')!.body))
      .toBe('Tax is aimed at you. Challenge if you doubt their claim.');
    expect(renderCoachText(t, byName.get('block or challenge, no claim')!.body))
      .toBe('Claim Contessa to stop it, even without the card. Or challenge their claim. A lost challenge costs you a card.');
    expect(renderCoachText(t, byName.get('challenge a claim, no character')!.title)).toBe('Tutor Bot claims a character');
    expect(renderCoachText(t, byName.get('challenge a block')!.body))
      .toBe("Tutor Bot claims Duke to block. Challenge only if you'll risk a card on it being a lie.");
    expect(renderCoachText(t, byName.get('must coup')!.label)).toBe('12 coins');
    expect(renderCoachText(t, byName.get('embezzle, no Duke')!.label)).toBe('1 in reserve');
  });

  it('reaches every coach message key', () => {
    const used = new Set<MessageKey>(tips.flatMap(([, tip]) => [tip.label.key, tip.title.key, tip.body.key]));
    const missing = Object.keys(en.tutorial)
      .filter(k => k.startsWith('coach.') && !COACH_CHROME.has(k.slice('coach.'.length)))
      .map(k => `tutorial.${k}` as MessageKey)
      .filter(k => !used.has(k));
    expect(missing).toEqual([]);
  });
});
