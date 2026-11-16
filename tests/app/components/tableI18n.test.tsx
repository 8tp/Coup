/**
 * The table speaks from the catalog.
 *
 *  1. Every prompt, the phase line, the claim plaque, the action bar, the
 *     knocked-out panel and the chat panel render in the accented
 *     pseudo-locale with every word inside ⟦ ⟧: text outside the markers is
 *     still hard-coded. Player names and numbers are the only exceptions.
 *  2. Their aria-labels, titles and placeholders are translated too.
 *  3. English reads exactly as it did before the catalog (spot checks of the
 *     sentences that were built from fragments).
 *  4. Chat reactions and quick phrases render in the reader's language.
 *  5. The converted files hold no hard-coded user-visible text.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import {
  ActionType, Character, Faction, GameMode, GameStatus, TurnPhase,
  type ChatMessage, type ClientGameState, type ClientPlayerState,
} from '@/shared/types';
import { QUICK_PHRASES } from '@/shared/constants';
import { useI18nStore, makePlainTranslator } from '@/app/i18n/runtime';
import type { Locale } from '@/shared/i18n/locales';
import { pseudoAccent } from '@/shared/i18n/pseudo';

vi.mock('@/app/hooks/useSocket', () => ({ getSocket: () => ({ emit: vi.fn(), on: vi.fn(), off: vi.fn() }) }));

import { PhaseStatus } from '@/app/components/game/PhaseStatus';
import { ChallengePrompt } from '@/app/components/game/ChallengePrompt';
import { BlockPrompt } from '@/app/components/game/BlockPrompt';
import { BlockChallengePrompt } from '@/app/components/game/BlockChallengePrompt';
import { InfluenceLossPrompt } from '@/app/components/game/InfluenceLossPrompt';
import { ExchangeView } from '@/app/components/game/ExchangeView';
import { ExaminePrompt } from '@/app/components/game/ExaminePrompt';
import { ExamineSelectionPrompt } from '@/app/components/game/ExamineSelectionPrompt';
import { WaitingView } from '@/app/components/game/WaitingView';
import { ActionBar } from '@/app/components/game/ActionBar';
import { ClaimPlaque } from '@/app/components/game/table/ClaimPlaque';
import { PlayerSeat } from '@/app/components/game/PlayerSeat';
import { ChatPanel } from '@/app/components/chat/ChatPanel';
import { chatText, refusalText } from '@/app/components/game/tableText';

const NAMES = ['Ana', 'Ben', 'Cy', 'Dee'];

function player(i: number, over: Partial<ClientPlayerState> = {}): ClientPlayerState {
  return {
    id: `p${i}`,
    name: NAMES[i],
    coins: 2,
    influences: i === 0
      ? [{ character: Character.Captain, revealed: false }, { character: Character.Duke, revealed: false }]
      : [{ character: null, revealed: false }, { character: null, revealed: false }],
    isAlive: true,
    seatIndex: i,
    ...over,
  };
}

function state(over: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'ABCD',
    status: GameStatus.InProgress,
    players: [player(0), player(1, { isBot: true }), player(2), player(3)],
    currentPlayerIndex: 1,
    turnPhase: TurnPhase.AwaitingAction,
    deckCount: 7,
    treasury: 40,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineState: null,
    examineSelectionState: null,
    blockPassedPlayerIds: [],
    actionLog: [],
    timerExpiry: null,
    winnerId: null,
    turnNumber: 4,
    myId: 'p0',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...over,
  };
}

const challengeOn = (type: ActionType, actorId: string, targetId: string | undefined, claimed: Character | null, passed: string[] = []): Partial<ClientGameState> => ({
  turnPhase: TurnPhase.AwaitingActionChallenge,
  pendingAction: { type, actorId, ...(targetId ? { targetId } : {}), ...(claimed ? { claimedCharacter: claimed } : {}) },
  challengeState: { challengerId: '', challengedPlayerId: actorId, claimedCharacter: claimed ?? Character.Duke, passedPlayerIds: [actorId, ...passed] },
});

/** One render per state each component can draw, keyed by a name for failures. */
function cases(): Array<[string, ReactElement]> {
  const reform = { gameMode: GameMode.Reformation, useInquisitor: true };
  const factions = (s: ClientGameState) => ({ ...s, players: s.players.map((p, i) => ({ ...p, faction: i % 2 ? Faction.Reformist : Faction.Loyalist })) });
  const list: Array<[string, ClientGameState]> = [
    ['my turn', state({ currentPlayerIndex: 0 })],
    ['my turn, poor', state({ currentPlayerIndex: 0, players: [player(0, { coins: 1 }), player(1, { coins: 0 }), player(2, { coins: 0 }), player(3, { coins: 0 })] })],
    ['my turn, forced coup', state({ currentPlayerIndex: 0, players: [player(0, { coins: 10 }), player(1), player(2), player(3)] })],
    ['reformation turn', factions(state({ ...reform, currentPlayerIndex: 0, treasuryReserve: 3 }))],
    ['reformation turn, empty reserve', factions(state({ ...reform, currentPlayerIndex: 0, players: [player(0, { coins: 0 }), player(1), player(2), player(3)] }))],
    ['their turn', state()],
    ['steal on me', state(challengeOn(ActionType.Steal, 'p1', 'p0', Character.Captain))],
    ['steal on me, passed', state(challengeOn(ActionType.Steal, 'p1', 'p0', Character.Captain, ['p0']))],
    ['assassinate on me', state(challengeOn(ActionType.Assassinate, 'p1', 'p0', Character.Assassin))],
    ['steal on another', state(challengeOn(ActionType.Steal, 'p1', 'p2', Character.Captain))],
    ['tax', state(challengeOn(ActionType.Tax, 'p1', undefined, Character.Duke))],
    ['my tax', state({ ...challengeOn(ActionType.Tax, 'p0', undefined, Character.Duke), currentPlayerIndex: 0 })],
    ['my steal', state({ ...challengeOn(ActionType.Steal, 'p0', 'p1', Character.Captain), currentPlayerIndex: 0 })],
    ['my embezzle', state({ ...reform, ...challengeOn(ActionType.Embezzle, 'p0', undefined, null), currentPlayerIndex: 0 })],
    ['embezzle', state({ ...reform, ...challengeOn(ActionType.Embezzle, 'p1', undefined, null) })],
    ['examine', state({ ...reform, ...challengeOn(ActionType.Examine, 'p1', 'p0', Character.Inquisitor) })],
    ['declared block, seen by others', state({
      ...challengeOn(ActionType.Steal, 'p1', 'p2', Character.Captain),
      pendingAction: { type: ActionType.Steal, actorId: 'p1', targetId: 'p2', claimedCharacter: Character.Captain, declaredBlock: { blockerId: 'p2', claimedCharacter: Character.Ambassador } },
    })],
    ['declared block, mine', state({
      ...challengeOn(ActionType.Steal, 'p1', 'p0', Character.Captain),
      pendingAction: { type: ActionType.Steal, actorId: 'p1', targetId: 'p0', claimedCharacter: Character.Captain, declaredBlock: { blockerId: 'p0', claimedCharacter: Character.Captain } },
    })],
    ['passed, waiting', state(challengeOn(ActionType.Tax, 'p1', undefined, Character.Duke, ['p0']))],
    ['block window, foreign aid', state({ turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.ForeignAid, actorId: 'p1' } })],
    ['block window, steal on me', state({ turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.Steal, actorId: 'p1', targetId: 'p0', claimedCharacter: Character.Captain } })],
    ['block window, assassinate on me', state({ turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.Assassinate, actorId: 'p1', targetId: 'p0', claimedCharacter: Character.Assassin } })],
    ['block window, on another', state({ turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.Assassinate, actorId: 'p1', targetId: 'p2', claimedCharacter: Character.Assassin } })],
    ['block window, mine', state({ turnPhase: TurnPhase.AwaitingBlock, currentPlayerIndex: 0, pendingAction: { type: ActionType.Steal, actorId: 'p0', targetId: 'p1', claimedCharacter: Character.Captain } })],
    ['block window, mine, untargeted', state({ turnPhase: TurnPhase.AwaitingBlock, currentPlayerIndex: 0, pendingAction: { type: ActionType.ForeignAid, actorId: 'p0' } })],
    ['block window, passed', state({ turnPhase: TurnPhase.AwaitingBlock, blockPassedPlayerIds: ['p0'], pendingAction: { type: ActionType.ForeignAid, actorId: 'p1' } })],
    ['block window, same faction', factions(state({ ...reform, turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.ForeignAid, actorId: 'p2' } }))],
    ['block challenge', state({ turnPhase: TurnPhase.AwaitingBlockChallenge, pendingAction: { type: ActionType.ForeignAid, actorId: 'p0' }, pendingBlock: { blockerId: 'p1', claimedCharacter: Character.Duke }, challengeState: { challengerId: '', challengedPlayerId: 'p1', claimedCharacter: Character.Duke, passedPlayerIds: ['p1'] } })],
    ['block challenge, passed', state({ turnPhase: TurnPhase.AwaitingBlockChallenge, pendingAction: { type: ActionType.ForeignAid, actorId: 'p2' }, pendingBlock: { blockerId: 'p1', claimedCharacter: Character.Duke }, challengeState: { challengerId: '', challengedPlayerId: 'p1', claimedCharacter: Character.Duke, passedPlayerIds: ['p1', 'p0'] } })],
    ['block challenge, my block', state({ turnPhase: TurnPhase.AwaitingBlockChallenge, pendingAction: { type: ActionType.ForeignAid, actorId: 'p1' }, pendingBlock: { blockerId: 'p0', claimedCharacter: Character.Duke }, challengeState: { challengerId: '', challengedPlayerId: 'p0', claimedCharacter: Character.Duke, passedPlayerIds: ['p0'] } })],
    ...(['coup', 'assassination', 'challenge_lost', 'challenge_failed_defense', 'embezzle_failed'] as const).flatMap(reason => [
      [`lose a card: ${reason}`, state({ turnPhase: TurnPhase.AwaitingInfluenceLoss, influenceLossRequest: { playerId: 'p0', reason } })] as [string, ClientGameState],
      [`watching a loss: ${reason}`, state({ turnPhase: TurnPhase.AwaitingInfluenceLoss, influenceLossRequest: { playerId: 'p2', reason } })] as [string, ClientGameState],
    ]),
    ['exchange', state({ turnPhase: TurnPhase.AwaitingExchange, currentPlayerIndex: 0, pendingAction: { type: ActionType.Exchange, actorId: 'p0', claimedCharacter: Character.Ambassador }, exchangeState: { availableCards: [Character.Duke, Character.Contessa, Character.Ambassador, Character.Captain], keepCount: 2 } })],
    ['exchange, inquisitor', state({ ...reform, turnPhase: TurnPhase.AwaitingExchange, currentPlayerIndex: 0, pendingAction: { type: ActionType.Exchange, actorId: 'p0', claimedCharacter: Character.Inquisitor }, exchangeState: { availableCards: [Character.Duke, Character.Inquisitor, Character.Assassin], keepCount: 1 } })],
    ['exchange, theirs', state({ turnPhase: TurnPhase.AwaitingExchange, pendingAction: { type: ActionType.Exchange, actorId: 'p1', claimedCharacter: Character.Ambassador } })],
    ['examine selection, me', state({ ...reform, turnPhase: TurnPhase.AwaitingExamineSelection, pendingAction: { type: ActionType.Examine, actorId: 'p1', targetId: 'p0', claimedCharacter: Character.Inquisitor }, examineSelectionState: { examinerId: 'p1', targetId: 'p0' } })],
    ['examine selection, others', state({ ...reform, turnPhase: TurnPhase.AwaitingExamineSelection, pendingAction: { type: ActionType.Examine, actorId: 'p1', targetId: 'p2', claimedCharacter: Character.Inquisitor }, examineSelectionState: { examinerId: 'p1', targetId: 'p2' } })],
    ['examine decision', state({ ...reform, turnPhase: TurnPhase.AwaitingExamineDecision, currentPlayerIndex: 0, pendingAction: { type: ActionType.Examine, actorId: 'p0', targetId: 'p1', claimedCharacter: Character.Inquisitor }, examineState: { targetId: 'p1', revealedCard: Character.Contessa } })],
    ['examine decision, theirs', state({ ...reform, turnPhase: TurnPhase.AwaitingExamineDecision, pendingAction: { type: ActionType.Examine, actorId: 'p1', targetId: 'p2', claimedCharacter: Character.Inquisitor } })],
    ['knocked out', state({ players: [player(0, { isAlive: false, influences: [{ character: Character.Duke, revealed: true }, { character: Character.Captain, revealed: true }] }), player(1, { isBot: true }), player(2, { isBot: true }), player(3, { isBot: true })] })],
    ['game over', state({ turnPhase: TurnPhase.GameOver })],
  ];
  const out: Array<[string, ReactElement]> = [];
  for (const [name, gs] of list) {
    out.push([`${name} / phase`, <PhaseStatus gameState={gs} />]);
    out.push([`${name} / plaque`, <ClaimPlaque gameState={gs} />]);
    out.push([`${name} / prompts`, (
      <div>
        <ChallengePrompt gameState={gs} />
        <BlockPrompt gameState={gs} />
        <BlockChallengePrompt gameState={gs} />
        <InfluenceLossPrompt gameState={gs} />
        <ExchangeView gameState={gs} />
        <ExamineSelectionPrompt gameState={gs} />
        <ExaminePrompt gameState={gs} />
        <ActionBar gameState={gs} />
        <WaitingView gameState={gs} onLeave={() => {}} onNewGame={() => {}} />
      </div>
    )]);
  }
  out.push(['seat, refused', <PlayerSeat player={player(1, { isBot: true, faction: Faction.Reformist })} isCurrentTurn={false} isMe={false} onSelect={() => {}} illegalReason={refusalText(makePlainTranslator(useI18nStore.getState().locale), { key: 'sameFaction' })} />]);
  out.push(['seat, choosable', <PlayerSeat player={player(2, { faction: Faction.Loyalist })} isCurrentTurn isMe={false} onSelect={() => {}} selectable />]);
  out.push(['chat', <ChatPanel messages={[]} myId="p0" onSend={() => {}} quickPhrases={QUICK_PHRASES} />]);
  return out;
}

/* renderToStaticMarkup reads a zustand store through its server snapshot,
   which is the store's initial state object, so the locale is set on that
   object as well as on the live state. */
function setLocale(locale: Locale) {
  useI18nStore.setState({ locale });
  Object.assign(useI18nStore.getInitialState(), { locale });
}

/** What is left of the visible text once the ⟦…⟧ messages, names and numbers are taken out. */
function untranslated(html: string): string[] {
  const attrs = [...html.matchAll(/\s(?:aria-label|title|placeholder)="([^"]*)"/g)].map(m => m[1]);
  const text = html.replace(/<[^>]+>/g, '\n').replace(/&#x27;|&quot;|&amp;/g, "'");
  const leftovers: string[] = [];
  const check = (s: string, where: string) => {
    let rest = s;
    for (let prev = ''; prev !== rest;) { prev = rest; rest = rest.replace(/⟦[^⟦⟧]*⟧/g, ' '); }
    for (const n of NAMES) rest = rest.split(n).join(' ');
    rest = rest.replace(/[\d\s.,:;()+/·▲◆'!?-]+/g, ' ').trim();
    if (/\p{L}/u.test(rest)) leftovers.push(`${where}: ${rest} (in "${s.trim().slice(0, 80)}")`);
  };
  // Text nodes can split a message across tags, so check the text as one string.
  check(text.replace(/\n+/g, ' '), 'text');
  for (const a of attrs) check(a, 'attr');
  return leftovers;
}

describe('the table in the accented pseudo-locale', () => {
  beforeEach(() => setLocale('en-XA'));
  afterEach(() => setLocale('en'));

  it('renders every prompt, line and label from the catalog', () => {
    const problems: string[] = [];
    for (const [name, el] of cases()) {
      const html = renderToStaticMarkup(el);
      for (const p of untranslated(html)) problems.push(`${name} → ${p}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('the table in English', () => {
  beforeEach(() => setLocale('en'));
  const text = (el: ReactElement) => renderToStaticMarkup(el).replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');

  it('reads as the hard-coded English did', () => {
    const steal = state(challengeOn(ActionType.Steal, 'p1', 'p0', Character.Captain));
    expect(text(<ChallengePrompt gameState={steal} />)).toContain('Ben claims Captain to Steal from you');
    expect(text(<ChallengePrompt gameState={steal} />)).toContain('Block with Captain or Ambassador to keep your coins. You can claim either without holding it.');
    expect(text(<PhaseStatus gameState={steal} />)).toBe('Ben claims Captain: block or challenge');
    const waiting = state(challengeOn(ActionType.Tax, 'p1', undefined, Character.Duke, ['p0']));
    expect(text(<PhaseStatus gameState={waiting} />)).toBe('Waiting for Cy and Dee to challenge or pass');
    expect(text(<ChallengePrompt gameState={waiting} />)).toBe('You passed. Waiting for Cy and Dee.');
    const threeWaiting = state({ ...challengeOn(ActionType.Tax, 'p1', undefined, Character.Duke), myId: 'p9' });
    expect(text(<PhaseStatus gameState={threeWaiting} />)).toBe('Waiting for Ana, Cy, and Dee to challenge or pass');
    const fa = state({ turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.ForeignAid, actorId: 'p1' } });
    expect(text(<BlockPrompt gameState={fa} />)).toContain('Ben is taking Foreign Aid (+2 coins)');
    const stealBlock = state({ turnPhase: TurnPhase.AwaitingBlock, pendingAction: { type: ActionType.Steal, actorId: 'p1', targetId: 'p0', claimedCharacter: Character.Captain } });
    expect(text(<BlockPrompt gameState={stealBlock} />)).toContain('Ben is stealing 2 of your coins');
    expect(text(<BlockPrompt gameState={stealBlock} />)).toContain('Block with Captain or Ambassador to keep 2 of your coins. You can claim either without holding it.');
    const plaque = state(challengeOn(ActionType.Steal, 'p1', 'p0', Character.Captain));
    expect(text(<ClaimPlaque gameState={plaque} />)).toBe('BenStealas Captain · on You');
    const forced = state({ currentPlayerIndex: 0, players: [player(0, { coins: 10 }), player(1), player(2), player(3)] });
    expect(text(<ActionBar gameState={forced} />)).toContain('You have 10 coins, so you must Coup');
    expect(text(<ActionBar gameState={forced} />)).toContain('Coup Ben');
    const poor = state({ currentPlayerIndex: 0, players: [player(0, { coins: 1 }), player(1), player(2), player(3)] });
    expect(text(<ActionBar gameState={poor} />)).toContain('You need 3 coins to Assassinate. You have 1.');
    expect(text(<ActionBar gameState={poor} />)).toContain('+1 coin (no block)');
    expect(text(<ActionBar gameState={poor} />)).toContain('Draw 2, put back 2 (claim Ambassador)');
  });

  it('carries refusals as keys, and words them for the reader', () => {
    const en = makePlainTranslator('en');
    expect(refusalText(en, { key: 'noCoinsToSteal', params: { name: 'Ben' } })).toBe('Ben has no coins to steal.');
    expect(refusalText(en, { key: 'needCoinsConvertOther', params: { cost: 2, have: 1, name: 'Ben' } })).toBe('You need 2 coins to Convert Ben. You have 1.');
    expect(refusalText(en, { key: 'needCoinsConvertSelf', params: { cost: 1, have: 0 } })).toBe('You need 1 coin to Convert yourself. You have 0.');
    expect(refusalText(en, { key: 'nobodyLeft', params: { action: ActionType.Steal } })).toBe('Nobody else is left to Steal.');
    expect(refusalText(en, { key: 'reserveEmpty' })).toBe("The reserve is empty, so there's nothing to Embezzle.");
    expect(refusalText(makePlainTranslator('en-XA'), { key: 'pending' })).toMatch(/^⟦.*⟧$/);
  });
});

describe('chat lines', () => {
  const line = (over: Partial<ChatMessage>): ChatMessage => ({ id: 'm', playerId: 'p1', playerName: 'Ben', message: '', timestamp: 0, ...over });

  it('renders reactions and quick phrases in the reader\'s language, and typed chat as typed', () => {
    const en = makePlainTranslator('en');
    const xa = makePlainTranslator('en-XA');
    const reaction = line({ message: '🤝 GG', reactionId: 'gg' });
    expect(chatText(en, reaction)).toBe('🤝 GG');
    expect(chatText(xa, reaction)).toMatch(/^⟦🤝 ⟦ĜĜ⟧⟧$/);
    const phrase = line({ message: 'I have it', phraseId: 'have_it' });
    expect(chatText(en, phrase)).toBe('I have it');
    expect(chatText(xa, phrase)).toBe(`⟦${pseudoAccent('I have it')}⟧`);
    expect(chatText(xa, line({ message: 'Nice bluff' }))).toBe('Nice bluff');
    // An id this client does not know falls back to the server's English.
    expect(chatText(xa, line({ message: '🦄 New', reactionId: 'unicorn' }))).toBe('🦄 New');
    expect(chatText(xa, line({ message: 'Later', phraseId: 'later' }))).toBe('Later');
  });

  it('offers the quick phrases in the reader\'s language, and renders received ones the same way', () => {
    setLocale('en-XA');
    const html = renderToStaticMarkup(
      <ChatPanel
        messages={[line({ id: 'a', message: 'Liar!', phraseId: 'liar' }), line({ id: 'b', message: 'gg all', playerName: 'Cy' })]}
        myId="p0"
        onSend={() => {}}
        quickPhrases={QUICK_PHRASES}
      />,
    );
    setLocale('en');
    for (const p of QUICK_PHRASES) expect(html).toContain(`⟦${pseudoAccent(p.text)}⟧`);
    // The received phrase reads in the reader's language; typed chat stays as typed.
    expect(html.match(new RegExp(`⟦${pseudoAccent('Liar!')}⟧`, 'g'))).toHaveLength(2);
    expect(html).toContain('gg all');
  });
});

describe('no hard-coded text in the converted table files', () => {
  const ROOT = path.resolve(__dirname, '../../../src/app');
  const FILES = [
    'game/[roomCode]/page.tsx',
    'components/game/GameTable.tsx', 'components/game/PlayerSeat.tsx', 'components/game/PhaseStatus.tsx',
    'components/game/WaitingView.tsx', 'components/game/ActionBar.tsx', 'components/game/ChallengePrompt.tsx',
    'components/game/BlockPrompt.tsx', 'components/game/BlockChallengePrompt.tsx', 'components/game/InfluenceLossPrompt.tsx',
    'components/game/ExchangeView.tsx', 'components/game/ExaminePrompt.tsx', 'components/game/ExamineSelectionPrompt.tsx',
    'components/game/ChallengeRevealOverlay.tsx', 'components/game/CardFace.tsx', 'components/game/CardArtwork.tsx',
    'components/game/ReactionPicker.tsx', 'components/game/ReactionBubble.tsx', 'components/game/table/ClaimPlaque.tsx',
    'components/game/table/SeatSpeech.tsx', 'components/game/table/TableTalk.tsx', 'components/chat/ChatPanel.tsx',
    'components/ui/Timer.tsx',
  ];

  it('has no literal aria-label, title, placeholder or alt, and no letters in JSX text', () => {
    const problems: string[] = [];
    for (const file of FILES) {
      const src = readFileSync(path.join(ROOT, file), 'utf8')
        // Comments say plenty in English and are not on screen.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      for (const m of src.matchAll(/\b(aria-label|title|placeholder|alt)="([^"]*)"/g)) {
        if (/\p{L}/u.test(m[2])) problems.push(`${file}: ${m[1]}="${m[2]}"`);
      }
      // Text between a JSX tag and the next `<` or `{`. A `<` straight after
      // an identifier is a TypeScript generic (`useState<string>`), not a tag.
      for (const m of src.matchAll(/(?<![\w.$])<[A-Za-z][^<>]*>([^<>{}]*)[<{]/g)) {
        const t = m[1].trim();
        // An arrow function's `=>` inside a prop ends the match early; what
        // follows is code, not text.
        const code = /[`;=&|]|\w\(/.test(t);
        if (t && !code && /\p{L}{2,}/u.test(t)) problems.push(`${file}: JSX text "${t}"`);
      }
    }
    expect(problems).toEqual([]);
  });
});
