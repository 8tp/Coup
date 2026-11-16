import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import {
  buildFeedbackContext,
  FEEDBACK_PREFIX,
  FeedbackRateLimiter,
  FeedbackService,
  FeedbackSink,
  parseClientContext,
  resolveAppVersion,
  sanitizeFeedbackText,
  validateFeedback,
} from '@/server/feedback';
import { RoomManager } from '@/server/RoomManager';
import {
  FEEDBACK_GLOBAL_MAX,
  FEEDBACK_GLOBAL_WINDOW_MS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_PER_CONNECTION_MAX,
  FEEDBACK_PER_CONNECTION_WINDOW_MS,
} from '@/shared/constants';
import { FeedbackRecord, FeedbackRoomSnapshot } from '@/shared/feedbackTypes';
import { GameMode, GameStatus, TurnPhase } from '@/shared/types';

const NO_ROOM: FeedbackRoomSnapshot = {
  room: null, gameId: null, roomState: 'none', sender: 'no_room', origin: null,
  gameMode: null, useInquisitor: null, turnPhase: null, turn: null, humans: null, bots: null,
};

function feedbackLines(spy: { mock: { calls: unknown[][] } }): FeedbackRecord[] {
  return spy.mock.calls
    .map(call => String(call[0]))
    .filter(line => line.startsWith(`${FEEDBACK_PREFIX} `))
    .map(line => JSON.parse(line.slice(FEEDBACK_PREFIX.length + 1)) as FeedbackRecord);
}

describe('sanitizeFeedbackText', () => {
  it('strips control characters but keeps newlines', () => {
    expect(sanitizeFeedbackText('a\u0000b\u0007c\u001Bd\u007Fe\u0085f')).toBe('abcde\nf');
    expect(sanitizeFeedbackText('line one\r\nline two\rline three')).toBe('line one\nline two\nline three');
  });

  it('turns tabs into spaces, strips bidi overrides, and caps blank lines', () => {
    expect(sanitizeFeedbackText('a\tb')).toBe('a b');
    expect(sanitizeFeedbackText('evil\u202Etxt.exe\u2066x\u2069')).toBe('eviltxt.exex');
    expect(sanitizeFeedbackText('one\n\n\n\n\ntwo   \nthree')).toBe('one\n\ntwo\nthree');
  });

  it('trims and keeps emoji, accents and non-Latin scripts verbatim', () => {
    expect(sanitizeFeedbackText('  नमस्ते, jogo ótimo 👍🏽 مرحبا  ')).toBe('नमस्ते, jogo ótimo 👍🏽 مرحبا');
    // ZWJ emoji sequences survive (U+200D is not stripped)
    expect(sanitizeFeedbackText('👨\u200D👩\u200D👧')).toBe('👨\u200D👩\u200D👧');
  });

  it('replaces lone surrogates', () => {
    expect(sanitizeFeedbackText('a\uD800b')).toBe('a\uFFFDb');
  });

  it('does not censor words (no profanity filter)', () => {
    expect(sanitizeFeedbackText('this shit is broken')).toBe('this shit is broken');
  });
});

describe('validateFeedback', () => {
  it('accepts each kind with a trimmed message', () => {
    for (const kind of ['bug', 'idea', 'other'] as const) {
      expect(validateFeedback({ kind, message: '  hi  ' })).toEqual({ valid: true, kind, message: 'hi' });
    }
  });

  it('rejects malformed payloads', () => {
    expect(validateFeedback(null)).toEqual({ valid: false, error: 'invalid' });
    expect(validateFeedback('bug')).toEqual({ valid: false, error: 'invalid' });
    expect(validateFeedback({ kind: 'praise', message: 'x' })).toEqual({ valid: false, error: 'invalid' });
    expect(validateFeedback({ kind: 'bug', message: 42 })).toEqual({ valid: false, error: 'invalid' });
    expect(validateFeedback({ kind: 'bug' })).toEqual({ valid: false, error: 'invalid' });
  });

  it('rejects empty and whitespace/control-only messages', () => {
    expect(validateFeedback({ kind: 'bug', message: '' })).toEqual({ valid: false, error: 'empty' });
    expect(validateFeedback({ kind: 'bug', message: ' \n\t \u0000\u202E ' })).toEqual({ valid: false, error: 'empty' });
  });

  it('enforces the max length after sanitizing', () => {
    expect(validateFeedback({ kind: 'idea', message: 'x'.repeat(FEEDBACK_MAX_LENGTH) })).toMatchObject({ valid: true });
    expect(validateFeedback({ kind: 'idea', message: 'x'.repeat(FEEDBACK_MAX_LENGTH + 1) })).toEqual({ valid: false, error: 'too_long' });
    // Padding that sanitizes away does not count
    expect(validateFeedback({ kind: 'idea', message: `   ${'x'.repeat(FEEDBACK_MAX_LENGTH)}\u0000\u0000   ` })).toMatchObject({ valid: true });
    // Huge raw strings are refused before sanitizing
    expect(validateFeedback({ kind: 'idea', message: ' '.repeat(FEEDBACK_MAX_LENGTH * 10) })).toEqual({ valid: false, error: 'too_long' });
  });
});

describe('parseClientContext', () => {
  it('keeps whitelisted values', () => {
    expect(parseClientContext({ screen: 'game', viewport: 'phone', browser: 'chrome', os: 'android', textSize: 'large', standalone: true }))
      .toEqual({ screen: 'game', viewport: 'phone', browser: 'chrome', os: 'android', textSize: 'large', standalone: true });
  });

  it('drops unknown keys and replaces free text with fallbacks', () => {
    const parsed = parseClientContext({
      screen: 'lobby ABCD', viewport: 390, browser: 'Mozilla/5.0 (Linux; Android 14)', os: { name: 'x' },
      textSize: 'huge', standalone: 'yes', name: 'Alice', roomCode: 'ABCD', ip: '1.2.3.4',
    });
    expect(parsed).toEqual({ screen: 'unknown', viewport: 'unknown', browser: 'other', os: 'other', textSize: 'unknown', standalone: false });
    expect(Object.keys(parsed).sort()).toEqual(['browser', 'os', 'screen', 'standalone', 'textSize', 'viewport']);
  });

  it('handles a missing context', () => {
    expect(parseClientContext(undefined).screen).toBe('unknown');
    expect(parseClientContext('home').screen).toBe('unknown');
  });
});

describe('resolveAppVersion', () => {
  it('uses a short commit sha when the platform provides one', () => {
    expect(resolveAppVersion({ RAILWAY_GIT_COMMIT_SHA: '9618828ABCDEF0123456789abcdef0123456789a' })).toBe('9618828abcde');
    expect(resolveAppVersion({})).toBeNull();
    expect(resolveAppVersion({ RAILWAY_GIT_COMMIT_SHA: 'not a sha; rm -rf' })).toBeNull();
  });
});

describe('FeedbackRateLimiter', () => {
  it('allows FEEDBACK_PER_CONNECTION_MAX per connection per window', () => {
    const limiter = new FeedbackRateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < FEEDBACK_PER_CONNECTION_MAX; i++) expect(limiter.tryConsume('a', t0 + i).ok).toBe(true);
    expect(limiter.tryConsume('a', t0 + 10)).toEqual({ ok: false, error: 'rate_limited' });
    // Another connection is unaffected
    expect(limiter.tryConsume('b', t0 + 10).ok).toBe(true);
    // The window slides
    expect(limiter.tryConsume('a', t0 + FEEDBACK_PER_CONNECTION_WINDOW_MS).ok).toBe(true);
  });

  it('caps the whole server at FEEDBACK_GLOBAL_MAX per window', () => {
    const limiter = new FeedbackRateLimiter();
    const t0 = 5_000_000;
    for (let i = 0; i < FEEDBACK_GLOBAL_MAX; i++) expect(limiter.tryConsume(`conn-${i}`, t0).ok).toBe(true);
    expect(limiter.tryConsume('fresh', t0 + 1)).toEqual({ ok: false, error: 'busy' });
    expect(limiter.tryConsume('fresh', t0 + FEEDBACK_GLOBAL_WINDOW_MS).ok).toBe(true);
  });

  it('a refused attempt does not consume quota, and release forgets the connection', () => {
    const limiter = new FeedbackRateLimiter({ perConnectionMax: 1, perConnectionWindowMs: 1000, globalMax: 1, globalWindowMs: 1000 });
    expect(limiter.tryConsume('a', 0).ok).toBe(true);
    expect(limiter.tryConsume('b', 1)).toEqual({ ok: false, error: 'busy' });
    expect(limiter.tryConsume('b', 1000).ok).toBe(true);
    expect(limiter.trackedConnections).toBe(2);
    limiter.release('a');
    limiter.release('b');
    expect(limiter.trackedConnections).toBe(0);
  });
});

describe('FeedbackService', () => {
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes one [feedback] JSON line including the message, and stores the same record', async () => {
    const saved: FeedbackRecord[] = [];
    const storage: FeedbackSink = { saveFeedback: async r => { saved.push(r); } };
    const service = new FeedbackService({ storage, appVersion: 'abc1234', now: () => Date.parse('2026-11-16T10:00:00Z') });

    const response = service.submit('sock-1', {
      kind: 'bug',
      message: 'Cards\nflicker',
      context: { screen: 'home', viewport: 'phone', browser: 'chrome', os: 'android', textSize: 'normal', standalone: false },
    }, NO_ROOM);

    expect(response).toEqual({ success: true });
    const lines = logSpy.mock.calls.map(c => String(c[0])).filter(l => l.startsWith(FEEDBACK_PREFIX));
    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain('\n');
    const [record] = feedbackLines(logSpy);
    expect(record).toMatchObject({
      kind: 'bug',
      message: 'Cards\nflicker',
      createdAt: '2026-11-16T10:00:00.000Z',
      context: { screen: 'home', viewport: 'phone', roomState: 'none', sender: 'no_room', room: null, appVersion: 'abc1234' },
    });
    expect(record.id).toMatch(/^[0-9a-f-]{36}$/);
    await Promise.resolve();
    expect(saved).toEqual([record]);
  });

  it('rejects invalid notes without logging or storing them, and without spending quota', () => {
    const saveFeedback = vi.fn(async () => {});
    const service = new FeedbackService({ storage: { saveFeedback }, appVersion: null });
    for (let i = 0; i < FEEDBACK_PER_CONNECTION_MAX + 2; i++) {
      expect(service.submit('s', { kind: 'bug', message: '   ' }, NO_ROOM)).toEqual({ success: false, error: 'empty' });
    }
    expect(service.submit('s', { kind: 'bug', message: 'real note' }, NO_ROOM)).toEqual({ success: true });
    expect(feedbackLines(logSpy)).toHaveLength(1);
    expect(saveFeedback).toHaveBeenCalledTimes(1);
  });

  it('rate limits per connection', () => {
    const service = new FeedbackService({ appVersion: null });
    for (let i = 0; i < FEEDBACK_PER_CONNECTION_MAX; i++) {
      expect(service.submit('s', { kind: 'idea', message: `note ${i}` }, NO_ROOM).success).toBe(true);
    }
    expect(service.submit('s', { kind: 'idea', message: 'one more' }, NO_ROOM)).toEqual({ success: false, error: 'rate_limited' });
    service.releaseConnection('s');
    expect(service.submit('s', { kind: 'idea', message: 'after reconnect' }, NO_ROOM).success).toBe(true);
    expect(feedbackLines(logSpy)).toHaveLength(FEEDBACK_PER_CONNECTION_MAX + 1);
  });

  it('still succeeds (log line written) when storage is absent or failing', async () => {
    const noStorage = new FeedbackService({ storage: null, appVersion: null });
    expect(noStorage.submit('a', { kind: 'other', message: 'no db' }, NO_ROOM)).toEqual({ success: true });

    const failing = new FeedbackService({ storage: { saveFeedback: () => Promise.reject(new Error('db down')) }, appVersion: null });
    expect(failing.submit('b', { kind: 'other', message: 'db down' }, NO_ROOM)).toEqual({ success: true });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(feedbackLines(logSpy).map(r => r.message)).toEqual(['no db', 'db down']);
  });

  it('answers server_error instead of throwing if storage throws synchronously', () => {
    const service = new FeedbackService({ storage: { saveFeedback: () => { throw new Error('boom'); } }, appVersion: null });
    expect(service.submit('a', { kind: 'other', message: 'x' }, NO_ROOM)).toEqual({ success: false, error: 'server_error' });
  });
});

describe('feedback context never carries personal data', () => {
  let manager: RoomManager;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    manager = new RoomManager();
  });

  afterEach(() => {
    manager.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const FORBIDDEN_KEYS = ['ip', 'socketId', 'sessionToken', 'name', 'playerName', 'roomCode', 'code', 'userAgent', 'playerId'];

  function assertClean(json: string, secrets: string[]): void {
    for (const secret of secrets) expect(json, `context leaked "${secret}"`).not.toContain(secret);
    const keys = new Set<string>();
    JSON.parse(json, (key, value) => { keys.add(key); return value; });
    for (const key of FORBIDDEN_KEYS) expect(keys.has(key), `context has key "${key}"`).toBe(false);
  }

  it('home: no room fields at all', () => {
    expect(manager.getFeedbackSnapshot('unknown-socket')).toEqual(NO_ROOM);
  });

  it('lobby, in game, eliminated, finished and spectating snapshots are PII-free', () => {
    const host = manager.createRoom('AliceSecretName', 'socket-host-123', true);
    const code = host.room.code;
    const guest = manager.joinRoom(code, 'BobSecretName', 'socket-guest-456');
    if ('error' in guest) throw new Error(guest.error);
    manager.addBot(code, 'BotSecretName', 'random');
    const secrets = ['AliceSecretName', 'BobSecretName', 'BotSecretName', 'socket-host-123', 'socket-guest-456',
      host.sessionToken, guest.sessionToken, host.playerId, guest.playerId, `"${code}"`];

    const lobby = manager.getFeedbackSnapshot('socket-host-123');
    expect(lobby).toMatchObject({ roomState: 'lobby', sender: 'lobby', gameId: null, humans: 2, bots: 1, turn: null, gameMode: GameMode.Classic });
    expect(lobby.room).toMatch(/^[0-9a-f]{10}$/);
    assertClean(JSON.stringify(lobby), secrets);

    const engine = manager.startGame(code);
    if ('error' in engine) throw new Error(engine.error);
    const inGame = manager.getFeedbackSnapshot('socket-guest-456');
    expect(inGame).toMatchObject({ roomState: 'in_game', sender: 'alive', room: lobby.room, turn: 1, turnPhase: TurnPhase.AwaitingAction });
    expect(inGame.gameId).toMatch(new RegExp(`^${lobby.room}-`));
    assertClean(JSON.stringify(inGame), secrets);

    // Guest loses both cards
    const guestSeat = engine.game.players.find(p => p.id === guest.playerId)!;
    for (const influence of guestSeat.influences) influence.revealed = true;
    expect(manager.getFeedbackSnapshot('socket-guest-456').sender).toBe('eliminated');

    const spectator = manager.addSpectator(code, 'CarolSecretName', 'socket-spec-789');
    if ('error' in spectator) throw new Error(spectator.error);
    const watching = manager.getFeedbackSnapshot('socket-spec-789');
    expect(watching).toMatchObject({ sender: 'spectating', roomState: 'in_game' });
    assertClean(JSON.stringify(watching), [...secrets, 'CarolSecretName', 'socket-spec-789', spectator.spectatorId]);

    // Finish the game: everyone but the host is out
    for (const player of engine.game.players) {
      if (player.id === host.playerId) continue;
      for (const influence of player.influences) influence.revealed = true;
    }
    engine.game.checkWinCondition();
    expect(engine.game.status).toBe(GameStatus.Finished);
    const finished = manager.getFeedbackSnapshot('socket-host-123');
    expect(finished).toMatchObject({ roomState: 'finished', sender: 'alive' });

    // The full record built from it is clean too
    const context = buildFeedbackContext(
      parseClientContext({ screen: 'game_over', viewport: 'desktop', browser: 'firefox', os: 'linux', textSize: 'xl', standalone: false, name: 'AliceSecretName' }),
      finished,
      'abc1234',
    );
    assertClean(JSON.stringify(context), secrets);
    expect(Object.keys(context).sort()).toEqual([
      'appVersion', 'bots', 'browser', 'gameId', 'gameMode', 'humans', 'origin', 'os', 'room', 'roomState',
      'screen', 'sender', 'standalone', 'textSize', 'turn', 'turnPhase', 'useInquisitor', 'viewport',
    ]);
  });
});
