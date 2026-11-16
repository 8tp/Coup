import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  bluffLine,
  challengeLine,
  eliminationTurns,
  finishLine,
  playersInFinishingOrder,
  readerOf,
  recapPlain,
  type RecapMessage,
} from '@/app/components/game/gameover/summary';
import { Character, ClientGameState, GameMode, GameStatus, LogEntry, TurnPhase } from '@/shared/types';
import { makePlainTranslator, translateIn, useI18nStore } from '@/app/i18n/runtime';
import type { MessageKey } from '@/app/i18n/schema';
import enCatalog from '@/app/i18n/messages/en';
import { messageArguments } from '@/shared/i18n/messageFormat';
import { AWARD_IDS } from '@/app/utils/gameStats';

const en = makePlainTranslator('en');

/** A summary line as the reader of `s` sees it in English, or null. */
function say(line: (s: ClientGameState) => RecapMessage | null, s: ClientGameState): string | null {
  const m = line(s);
  return m ? recapPlain(m, en, readerOf(s)) : null;
}

function entry(e: Partial<LogEntry> & Pick<LogEntry, 'eventType' | 'turnNumber'>): LogEntry {
  return { message: '', timestamp: 0, character: null, actorId: null, actorName: null, ...e };
}

function state(actionLog: LogEntry[], overrides: Partial<ClientGameState> = {}): ClientGameState {
  return {
    roomCode: 'TEST',
    status: GameStatus.Finished,
    players: [
      { id: 'a', name: 'Alice', coins: 4, influences: [], isAlive: true, seatIndex: 0 },
      { id: 'b', name: 'Bob', coins: 0, influences: [], isAlive: false, seatIndex: 1 },
      { id: 'c', name: 'Cleo', coins: 2, influences: [], isAlive: false, seatIndex: 2 },
    ],
    currentPlayerIndex: 0,
    turnPhase: TurnPhase.GameOver,
    deckCount: 9,
    treasury: 40,
    pendingAction: null,
    pendingBlock: null,
    challengeState: null,
    influenceLossRequest: null,
    exchangeState: null,
    examineSelectionState: null,
    examineState: null,
    blockPassedPlayerIds: [],
    actionLog,
    timerExpiry: null,
    winnerId: 'a',
    turnNumber: 12,
    myId: 'c',
    gameMode: GameMode.Classic,
    useInquisitor: false,
    treasuryReserve: 0,
    ...overrides,
  };
}

const coupEnding = [
  entry({ eventType: 'elimination', turnNumber: 4, actorId: 'c', actorName: 'Cleo' }),
  entry({ eventType: 'turn_start', turnNumber: 12 }),
  entry({ eventType: 'coup', turnNumber: 12, actorId: 'a', actorName: 'Alice', targetId: 'b' }),
  entry({ eventType: 'influence_loss', turnNumber: 12, actorId: 'b', actorName: 'Bob' }),
  entry({ eventType: 'elimination', turnNumber: 12, actorId: 'b', actorName: 'Bob' }),
  entry({ eventType: 'win', turnNumber: 12, actorId: 'a', actorName: 'Alice' }),
];

describe('game-over summary', () => {
  it('orders hands winner first, then from the last player out to the first', () => {
    expect(playersInFinishingOrder(state(coupEnding)).map(p => p.id)).toEqual(['a', 'b', 'c']);
    expect(eliminationTurns(state(coupEnding))).toEqual(new Map([['c', 4], ['b', 12]]));
  });

  it('names the move that ended the game', () => {
    expect(say(finishLine, state(coupEnding))).toBe('Alice ended it on turn 12 with a Coup on Bob.');
    expect(say(finishLine, state(coupEnding, { myId: 'b' }))).toBe('Alice ended it on turn 12 with a Coup on you.');
    expect(say(finishLine, state(coupEnding, { myId: 'a' }))).toBe('You ended it on turn 12 with a Coup on Bob.');
  });

  it('explains a lost challenge with the card that was there', () => {
    const log = [
      entry({ eventType: 'turn_start', turnNumber: 9 }),
      entry({ eventType: 'claim_action', turnNumber: 9, actorId: 'a', character: Character.Duke }),
      entry({ eventType: 'challenge', turnNumber: 9, actorId: 'b' }),
      entry({ eventType: 'challenge_fail', turnNumber: 9, actorId: 'a', character: Character.Duke }),
      entry({ eventType: 'elimination', turnNumber: 9, actorId: 'b' }),
      entry({ eventType: 'action_resolve', turnNumber: 9, actorId: 'a' }),
    ];
    expect(say(finishLine, state(log))).toBe('Alice ended it on turn 9: Bob challenged and Alice had the Duke.');
  });

  it('falls back to the last card lost when the cause is not in that turn', () => {
    const log = [
      entry({ eventType: 'turn_start', turnNumber: 3 }),
      entry({ eventType: 'elimination', turnNumber: 3, actorId: 'b' }),
    ];
    expect(say(finishLine, state(log))).toBe('Bob lost their last card on turn 3.');
    expect(say(finishLine, state([]))).toBeNull();
  });

  it('counts bluffs and challenges in plain sentences', () => {
    const log = [
      entry({ eventType: 'claim_action', turnNumber: 1, actorId: 'a', wasBluff: true }),
      entry({ eventType: 'claim_action', turnNumber: 2, actorId: 'a', wasBluff: true }),
      entry({ eventType: 'claim_action', turnNumber: 3, actorId: 'b', wasBluff: false }),
      entry({ eventType: 'challenge', turnNumber: 2, actorId: 'b' }),
      entry({ eventType: 'challenge_success', turnNumber: 2, actorId: 'b', targetId: 'a' }),
      entry({ eventType: 'challenge', turnNumber: 3, actorId: 'c' }),
      entry({ eventType: 'challenge_fail', turnNumber: 3, actorId: 'b' }),
    ];
    expect(say(bluffLine, state(log))).toBe('2 of 3 claims were bluffs. 1 was caught. Alice bluffed the most, twice.');
    expect(say(challengeLine, state(log))).toBe('Challengers won 1 of 2 challenges.');
    expect(say(bluffLine, state([]))).toBeNull();
    expect(say(challengeLine, state([]))).toBeNull();
    expect(say(bluffLine, state([entry({ eventType: 'claim_action', turnNumber: 1, actorId: 'a', wasBluff: false })])))
      .toBe('The one claim was honest.');
  });
});

describe('game-over sentences with the reader in them', () => {
  const challengeEnding = (eventType: 'challenge_fail' | 'block_challenge_fail') => [
    entry({ eventType: 'turn_start', turnNumber: 9 }),
    entry({ eventType: 'claim_action', turnNumber: 9, actorId: 'a', character: Character.Duke }),
    entry({ eventType: eventType === 'challenge_fail' ? 'challenge' : 'block_challenge', turnNumber: 9, actorId: 'b' }),
    entry({ eventType, turnNumber: 9, actorId: 'a', character: Character.Duke }),
    entry({ eventType: 'elimination', turnNumber: 9, actorId: 'b' }),
  ];

  it('says "you" as the one who ended it, and as the one who lost', () => {
    expect(say(finishLine, state(challengeEnding('challenge_fail'), { myId: 'a' })))
      .toBe('You ended it on turn 9: Bob challenged and you had the Duke.');
    expect(say(finishLine, state(challengeEnding('challenge_fail'), { myId: 'b' })))
      .toBe('Alice ended it on turn 9: you challenged and Alice had the Duke.');
    expect(say(finishLine, state(challengeEnding('block_challenge_fail'), { myId: 'b' })))
      .toBe('Alice ended it on turn 9: you challenged the block and Alice had the Duke.');
    const assassination = [
      entry({ eventType: 'turn_start', turnNumber: 38 }),
      entry({ eventType: 'assassination', turnNumber: 38, actorId: 'a', targetId: 'b' }),
      entry({ eventType: 'elimination', turnNumber: 38, actorId: 'b' }),
    ];
    expect(say(finishLine, state(assassination, { myId: 'b' }))).toBe('Alice ended it on turn 38 by assassinating you.');
    const outOnly = [entry({ eventType: 'turn_start', turnNumber: 3 }), entry({ eventType: 'elimination', turnNumber: 3, actorId: 'b' })];
    expect(say(finishLine, state(outOnly, { myId: 'b' }))).toBe('You lost your last card on turn 3.');
  });

  it('names the reader as the top bluffer and the best challenger', () => {
    const log = [
      entry({ eventType: 'claim_action', turnNumber: 1, actorId: 'c', wasBluff: true }),
      entry({ eventType: 'claim_action', turnNumber: 2, actorId: 'c', wasBluff: true }),
      entry({ eventType: 'claim_action', turnNumber: 3, actorId: 'c', wasBluff: true }),
      entry({ eventType: 'challenge', turnNumber: 3, actorId: 'a' }),
      entry({ eventType: 'challenge_success', turnNumber: 3, actorId: 'a' }),
      entry({ eventType: 'claim_action', turnNumber: 4, actorId: 'b', wasBluff: true }),
      entry({ eventType: 'challenge', turnNumber: 4, actorId: 'a' }),
      entry({ eventType: 'challenge_success', turnNumber: 4, actorId: 'a' }),
    ];
    expect(say(bluffLine, state(log, { myId: 'c' }))).toBe('4 of 4 claims were bluffs. 2 were caught. You bluffed the most, 3 times.');
    expect(say(challengeLine, state(log, { myId: 'a' }))).toBe('Challengers won 2 of 2 challenges. You won all of them.');
    const one = [entry({ eventType: 'challenge', turnNumber: 4, actorId: 'a' }), entry({ eventType: 'challenge_success', turnNumber: 4, actorId: 'a' })];
    expect(say(challengeLine, state(one, { myId: 'a' }))).toBe('You made the only challenge and won it.');
    expect(say(challengeLine, state(one, { myId: 'c' }))).toBe('Alice made the only challenge and won it.');
  });
});

describe('game-over sentences are whole messages a translation can reorder', () => {
  afterEach(() => useI18nStore.setState({ catalogs: {} }));

  it('puts the names where the translation puts them, with its own "you" forms', () => {
    // A made-up Spanish line: the sentence order differs from English and
    // the reader's branch changes the verb.
    useI18nStore.setState({ catalogs: { es: { gameover: {
      finishCoup: 'Turno {turn}: {actor, select, you {diste} other {{actor} dio}} un Golpe a {loser, select, you {ti} other {{loser}}} y terminó.',
    } } } });
    const es = makePlainTranslator('es');
    const s = state(coupEnding, { myId: 'b' });
    expect(recapPlain(finishLine(s)!, es, readerOf(s))).toBe('Turno 12: Alice dio un Golpe a ti y terminó.');
    const mine = state(coupEnding, { myId: 'a' });
    expect(recapPlain(finishLine(mine)!, es, readerOf(mine))).toBe('Turno 12: diste un Golpe a Bob y terminó.');
  });

  it('renders every gameover and stats message in the pseudo-locales, markers around it, names untouched', () => {
    const NUMERIC = /^(count|turn|turns|claims|bluffs|caught|made|won|bestWon|leaderBluffs|coins|place|coups|assassinations|current|best)$/;
    for (const ns of ['gameover', 'stats'] as const) {
      for (const [key, message] of Object.entries(enCatalog[ns])) {
        const { args, tags } = messageArguments(message);
        const params: Record<string, unknown> = {};
        for (const arg of args) params[arg] = NUMERIC.test(arg) ? 3 : 'Zoë';
        for (const tag of tags) params[tag] = (c: unknown) => c;
        for (const locale of ['en-XA', 'ar-XB'] as const) {
          const out = translateIn(locale, `${ns}.${key}` as MessageKey, params);
          expect(out, `${ns}.${key}`).toMatch(/^⟦[\s\S]*⟧$/);
          expect(out, `${ns}.${key}`).not.toMatch(/\{[a-zA-Z]+\}/);
          if (/\{(name|player)\}/.test(message)) expect(out, `${ns}.${key}`).toContain('Zoë');
        }
      }
    }
  });
});

describe('translator context', () => {
  const source = readFileSync(path.join(__dirname, '../../../src/app/i18n/messages/en/gameover.ts'), 'utf8');

  it('explains every award name, which are jokes, above its key', () => {
    for (const id of AWARD_IDS) {
      const at = source.indexOf(`'awardTitle.${id}':`);
      expect(at, id).toBeGreaterThan(0);
      const before = source.slice(0, at).trimEnd();
      expect(before.endsWith('*/'), `awardTitle.${id} needs a comment`).toBe(true);
      expect(before.slice(before.lastIndexOf('/**')).length, `awardTitle.${id} comment`).toBeGreaterThan(60);
    }
  });
});

describe('converted files keep no hard-coded English', () => {
  // Text between tags and string attributes a person reads. Player names,
  // numbers and glyphs come in through `{...}`, so any letters here are copy.
  const FILES = [
    'components/game/GameOverOverlay.tsx',
    'components/game/gameover/FinalHands.tsx',
    'components/game/gameover/GameOverFooter.tsx',
    'components/game/gameover/GameRecap.tsx',
    'components/game/gameover/MoreDetails.tsx',
    'components/game/gameover/RecapText.tsx',
    'components/stats/AwardsTab.tsx',
    'components/stats/HistoryTab.tsx',
    'components/stats/OverviewTab.tsx',
    'components/stats/StatsModal.tsx',
  ];
  it.each(FILES)('%s', file => {
    const code = readFileSync(path.join(__dirname, '../../../src/app', file), 'utf8')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const jsxText = [...code.matchAll(/>([^<>{}]*[A-Za-z]{2,}[^<>{}]*)</g)]
      .map(m => m[1].trim())
      // Arrows, comparisons and generics between `>` and `<` are code, not text.
      .filter(text => !/=>|[;()=&|?]/.test(text));
    expect(jsxText).toEqual([]);
    expect([...code.matchAll(/\b(aria-label|title|placeholder|alt)="[^"]*[A-Za-z][^"]*"/g)].map(m => m[0])).toEqual([]);
  });
});
