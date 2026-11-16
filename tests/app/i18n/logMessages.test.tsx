/**
 * The structured action log, end to end:
 *
 *  1. Bot-only games in every mode: every log entry the server writes carries
 *     a `msg`, and the English catalog renders it to exactly the server's
 *     English `message` (so the catalog cannot drift from the server text).
 *  2. A typed sample for every key (a missing key is a compile error here):
 *     each English line uses exactly the params the key carries, and renders
 *     in English, the pseudo-locales and with each player as "you".
 *  3. The rich renderer (what ActionLog draws): "you" substitution, emblems,
 *     figures and bidi isolation of names.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameEngine } from '@/engine/GameEngine';
import { BotBrain, type BotDecision } from '@/engine/BotBrain';
import { RoomManager } from '@/server/RoomManager';
import { BOT_PERSONALITIES } from '@/shared/constants';
import { ActionType, Character, Faction, GameMode, GameStatus, type LogEntry } from '@/shared/types';
import { LOG_PARAM_KINDS, type LogMessageKey, type LogMessageParams } from '@/shared/i18n/logMessages';
import { messageArguments } from '@/shared/i18n/messageFormat';
import en from '@/app/i18n/messages/en';
import { makePlainTranslator } from '@/app/i18n/runtime';
import { makeTranslator } from '@/app/i18n/react';
import { logLinePlain } from '@/app/i18n/logText';
import { renderLogText, type LogContext } from '@/app/components/game/LogLine';

const tEn = makePlainTranslator('en');

function act(engine: GameEngine, id: string, d: BotDecision): string | null {
  switch (d.type) {
    case 'action': return engine.handleAction(id, d.action, d.targetId);
    case 'challenge': return engine.handleChallenge(id);
    case 'pass_challenge': return engine.handlePassChallenge(id);
    case 'block': return engine.handleBlock(id, d.character);
    case 'pass_block': return engine.handlePassBlock(id);
    case 'challenge_block': return engine.handleChallengeBlock(id);
    case 'pass_challenge_block': return engine.handlePassChallengeBlock(id);
    case 'choose_influence_loss': return engine.handleChooseInfluenceLoss(id, d.influenceIndex);
    case 'choose_exchange': return engine.handleChooseExchange(id, d.keepIndices);
    case 'choose_examine_influence': return engine.handleChooseExamineInfluence(id, d.influenceIndex);
    case 'examine_decision': return engine.handleExamineDecision(id, d.forceSwap);
    case 'convert': return engine.handleConvert(id, d.targetId);
    default: return 'unknown';
  }
}

const NAMES = ['Ana', "D'Arcy", 'Bùi Văn', 'محمد', '李雷', 'Zoë'];
const PERSONALITIES = ['aggressive', 'deceptive', 'analytical', 'optimal', 'conservative', 'vengeful'] as const;

function playGame(players: number, mode: GameMode, useInquisitor: boolean, seed: number): LogEntry[] {
  const engine = new GameEngine(`T${seed}`, 0, 0);
  const infos = Array.from({ length: players }, (_, i) => ({ id: `p${i}-${seed}`, name: NAMES[i] }));
  engine.startGame(infos, mode === GameMode.Reformation ? { gameMode: mode, useInquisitor } : undefined);
  const memory = new Map(infos.map(p => [p.id, new Map<Character, number>()]));
  for (let steps = 0; steps < 3000 && engine.game.status === GameStatus.InProgress; steps++) {
    let acted = false;
    for (const [i, p] of infos.entries()) {
      const s = engine.getFullState();
      const d = BotBrain.decide(engine.game, p.id, BOT_PERSONALITIES[PERSONALITIES[(i + seed) % PERSONALITIES.length]],
        s.pendingAction, s.pendingBlock, s.challengeState, s.influenceLossRequest, s.exchangeState,
        s.blockPassedPlayerIds, memory.get(p.id)!, s.examineState ?? undefined, s.examineSelectionState ?? undefined);
      if (d && !act(engine, p.id, d)) { acted = true; break; }
    }
    if (!acted) engine.handleTimerExpiry();
  }
  const log = [...engine.game.actionLog];
  engine.destroy();
  return log;
}

describe('every server log line has a structured form that renders to its English text', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('across Classic, Reformation and Inquisitor games', () => {
    const seen = new Set<LogMessageKey>();
    let lines = 0;
    let seed = 0;
    for (const [mode, inq] of [[GameMode.Classic, false], [GameMode.Reformation, false], [GameMode.Reformation, true]] as const) {
      for (let g = 0; g < 40; g++) {
        const players = 2 + (g % 5);
        const log = playGame(players, mode, inq, seed++);
        const names = new Map(Array.from({ length: players }, (_, i) => [`p${i}-${seed - 1}`, NAMES[i]]));
        for (const entry of log) {
          lines += 1;
          expect(entry.msg, entry.message).toBeDefined();
          seen.add(entry.msg!.key);
          expect(logLinePlain(entry, tEn, names)).toBe(entry.message);
        }
      }
    }
    expect(lines).toBeGreaterThan(1000);
    // The rare lines (empty deck, bot seats, self-Convert, caught Embezzle) are staged below.
    expect(seen.size).toBeGreaterThanOrEqual(30);
  });

  it('the rare lines, staged', () => {
    const stage = (mode: GameMode, useInquisitor = false) => {
      const engine = new GameEngine('RARE', 0, 0);
      engine.startGame([{ id: A, name: 'Ana' }, { id: B, name: 'Bo' }], mode === GameMode.Reformation ? { gameMode: mode, useInquisitor } : undefined);
      engine.game.currentPlayerIndex = 0;
      engine.game.players[0].coins = 5;
      return engine;
    };
    const emptyDeck = (engine: GameEngine) => { while (engine.game.deck.draw()) { /* drain */ } };
    const keysOf = (engine: GameEngine) => engine.game.actionLog.map(e => e.msg!.key);

    // Exchange with an empty deck.
    const ex = stage(GameMode.Classic);
    emptyDeck(ex);
    expect(ex.handleAction(A, ActionType.Exchange)).toBeNull();
    expect(ex.handlePassChallenge(B)).toBeNull();
    expect(keysOf(ex)).toContain('exchangeDeckEmpty');

    // Convert yourself.
    const cv = stage(GameMode.Reformation);
    expect(cv.handleConvert(A)).toBeNull();
    expect(keysOf(cv)).toContain('convertSelf');

    // Embezzle while holding a Duke, and get caught.
    const em = stage(GameMode.Reformation);
    em.game.treasuryReserve = 3;
    em.game.players[0].influences = [{ character: Character.Duke, revealed: false }, { character: Character.Captain, revealed: false }];
    expect(em.handleEmbezzle(A)).toBeNull();
    expect(em.handleChallenge(B)).toBeNull();
    expect(keysOf(em)).toContain('embezzleChallengeSucceeded');

    // `examineSwapDeckEmpty` cannot be staged: a forced swap returns the
    // examined card to the deck before drawing, so the draw always succeeds.
    // Its English line is still checked by the per-key tests below.

    for (const engine of [ex, cv, em]) {
      for (const entry of engine.game.actionLog) expect(logLinePlain(entry, tEn, NAME_OF)).toBe(entry.message);
      engine.destroy();
    }
  });

  it('bot seat replacement lines', () => {
    vi.useFakeTimers();
    const manager = new RoomManager({});
    const { room, playerId } = manager.createRoom('Ana', 's1') as { room: { code: string }; playerId: string };
    const bo = manager.joinRoom(room.code, 'Bo', 's2') as { playerId: string };
    const cy = manager.joinRoom(room.code, 'محمد', 's3') as { playerId: string };
    manager.joinRoom(room.code, 'Dee', 's4');
    manager.startGame(room.code);
    const engine = manager.getEngine(room.code)!;
    manager.getRoom(room.code)!.players.find(p => p.id === cy.playerId)!.connected = false;
    manager.replaceWithBot(room.code, playerId, 'afk');
    manager.replaceWithBot(room.code, bo.playerId, 'left');
    manager.replaceWithBot(room.code, cy.playerId, 'disconnect');
    const names = new Map(engine.game.players.map(p => [p.id, p.name]));
    const replaced = engine.game.actionLog.filter(e => e.eventType === 'bot_replace');
    expect(replaced.map(e => e.msg?.key)).toEqual(['botReplacedIdle', 'botReplacedLeft', 'botReplacedDisconnected']);
    for (const entry of replaced) expect(logLinePlain(entry, tEn, names)).toBe(entry.message);
    manager.destroy();
  });
});

// ─── Every key, by hand ───

const A = 'id-ana';
const B = 'id-bo';
const C = 'id-cy';
const NAME_OF = new Map([[A, 'Ana'], [B, 'Bo'], [C, 'محمد']]);

/** A realistic sample per key. A key missing here is a compile error. */
const SAMPLES: { [K in LogMessageKey]: LogMessageParams[K] } = {
  gameStarted: { actor: A },
  turnStart: { actor: A },
  eliminated: { actor: B },
  win: { actor: A },
  botReplacedIdle: { actor: B },
  botReplacedLeft: { actor: B },
  botReplacedDisconnected: { actor: B },
  income: { actor: A, amount: 1 },
  coup: { actor: A, target: B },
  claimAction: { actor: A, character: Character.Duke, action: ActionType.Tax },
  claimActionTargeting: { actor: A, character: Character.Captain, action: ActionType.Steal, target: B },
  declareAction: { actor: A, action: ActionType.ForeignAid },
  challenge: { challenger: B, challenged: A, character: Character.Duke },
  challengeFailed: { challenger: B, challenged: A, character: Character.Duke },
  challengeSucceeded: { challenged: A, character: Character.Duke },
  block: { blocker: B, character: Character.Contessa },
  blockChallenge: { challenger: A, blocker: B, character: Character.Contessa },
  blockChallengeFailed: { challenger: A, blocker: B, character: Character.Contessa },
  blockChallengeSucceeded: { blocker: B, character: Character.Contessa },
  blockStands: {},
  influenceLost: { actor: B, character: Character.Assassin },
  assassinationLoss: { target: B },
  assassinationPending: { target: B },
  taxCollected: { actor: A, amount: 3 },
  foreignAidTaken: { actor: A, amount: 2 },
  stealResolved: { actor: A, target: B, amount: 1 },
  exchangeDraw: { actor: A },
  exchangeDeckEmpty: { actor: A },
  exchangeComplete: { actor: A },
  convertSelf: { actor: A, faction: Faction.Reformist, amount: 1 },
  convertOther: { actor: A, target: C, faction: Faction.Loyalist, amount: 2 },
  embezzleClaim: { actor: A, character: Character.Duke, amount: 4 },
  embezzleChallenge: { challenger: B, challenged: A, character: Character.Duke },
  embezzleChallengeSucceeded: { challenged: A, character: Character.Duke },
  embezzleChallengeFailed: { challenger: B, challenged: A, character: Character.Duke },
  embezzled: { actor: A },
  examineAsk: { actor: A, target: B },
  examineShown: { actor: A, target: B },
  examineForceSwap: { actor: A, target: B },
  examineSwapDeckEmpty: { actor: A },
  examineReturn: { actor: A, target: B },
};

const entryFor = (key: LogMessageKey): LogEntry => ({
  message: '',
  timestamp: 0,
  eventType: 'claim_action',
  character: null,
  turnNumber: 1,
  actorId: A,
  actorName: 'Ana',
  msg: { key, params: SAMPLES[key] } as LogEntry['msg'],
});

describe('every log key', () => {
  const keys = Object.keys(SAMPLES) as LogMessageKey[];

  it('uses exactly the params its key carries', () => {
    for (const key of keys) {
      const { args } = messageArguments(en.log[key]);
      expect([...args].sort(), key).toEqual(Object.keys(SAMPLES[key]).sort());
      for (const name of args) expect(name in LOG_PARAM_KINDS, `${key}: ${name}`).toBe(true);
    }
  });

  it('renders in English, both pseudo-locales, and with each player as "you"', () => {
    const translators = (['en', 'en-XA', 'ar-XB'] as const).map(makePlainTranslator);
    for (const key of keys) {
      for (const t of translators) {
        for (const me of [null, A, B, C]) {
          const text = logLinePlain(entryFor(key), t, NAME_OF, me);
          expect(text, `${t.locale} ${key}`).not.toMatch(/\{|\}/);
          expect(text.length).toBeGreaterThan(5);
        }
      }
    }
  });

  it('reads naturally when the reader is the actor or the target', () => {
    const line = (key: LogMessageKey, me: string) => logLinePlain(entryFor(key), tEn, NAME_OF, me);
    expect(line('turnStart', A)).toBe('Your turn.');
    expect(line('income', A)).toBe('You take Income (+1 coin).');
    expect(line('coup', B)).toBe('Ana launches a Coup against you.');
    expect(line('claimActionTargeting', B)).toBe('Ana claims Captain to Steal targeting you.');
    expect(line('challenge', A)).toBe('Bo challenges your Duke claim.');
    expect(line('challengeFailed', B)).toBe('Ana has Duke. You must lose a card.');
    expect(line('stealResolved', B)).toBe('Ana steals 1 coin from you.');
    expect(line('examineShown', B)).toBe('You show Ana a card.');
    expect(line('eliminated', B)).toBe("You're out.");
    expect(line('botReplacedDisconnected', B)).toBe('A bot took your seat.');
  });
});

describe('the rich log line (ActionLog, LogTicker)', () => {
  const ctx = (me: string | null): LogContext => ({ t: makeTranslator('en'), myId: me, names: NAME_OF, myName: me ? NAME_OF.get(me)! : '' });
  const html = (key: LogMessageKey, me: string | null) => renderToStaticMarkup(<>{renderLogText(entryFor(key), ctx(me))}</>);

  it('names players in <bdi>, characters with their emblem, coins as figures', () => {
    const out = html('claimActionTargeting', null);
    expect(out).toContain('<bdi class="log-name">Ana</bdi>');
    expect(out).toMatch(/<span class="log-char" style="color:var\(--char-captain\)"><svg[^>]*>.*<\/svg><span class="log-char-name">Captain<\/span><\/span>/);
    expect(html('taxCollected', null)).toContain('(+<span class="log-figure">3</span> coins)');
  });

  it('says "you" for the reader', () => {
    expect(html('income', A)).toMatch(/^You take Income/);
    expect(html('coup', B)).toContain('against <span class="log-you">you</span>.');
  });

  it('falls back to the English message for entries without msg', () => {
    const old: LogEntry = { ...entryFor('income'), msg: undefined, message: 'Ana takes Income (+1 coin).' };
    expect(renderToStaticMarkup(<>{renderLogText(old, ctx(A))}</>)).toBe('You take Income (+1 coin).');
  });

  it('re-renders in another locale from the same entry', () => {
    const pseudo: LogContext = { ...ctx(null), t: makeTranslator('en-XA') };
    const out = renderToStaticMarkup(<>{renderLogText(entryFor('block'), pseudo)}</>);
    expect(out.startsWith('⟦')).toBe(true);
    expect(out).toContain('>Bo</bdi>');
    expect(out).toContain('ƀļööçķš');
  });
});
