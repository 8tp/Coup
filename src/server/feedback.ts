import { randomUUID } from 'crypto';
import {
  FEEDBACK_GLOBAL_MAX,
  FEEDBACK_GLOBAL_WINDOW_MS,
  FEEDBACK_MAX_LENGTH,
  FEEDBACK_MAX_RAW_LENGTH,
  FEEDBACK_PER_CONNECTION_MAX,
  FEEDBACK_PER_CONNECTION_WINDOW_MS,
} from '../shared/constants';
import {
  BROWSER_FAMILIES,
  FEEDBACK_KINDS,
  FEEDBACK_SCREENS,
  FEEDBACK_TEXT_SIZES,
  FeedbackClientContext,
  FeedbackContext,
  FeedbackErrorCode,
  FeedbackKind,
  FeedbackRecord,
  FeedbackResponse,
  FeedbackRoomSnapshot,
  OS_FAMILIES,
  VIEWPORT_BUCKETS,
} from '../shared/feedbackTypes';

/**
 * Stable prefix for feedback log lines, mirroring `[metric]` in metrics.ts.
 * Feedback stays readable from the platform logs even without a database.
 */
export const FEEDBACK_PREFIX = '[feedback]';

// ─── Sanitizing and validation ───

/** C0 controls except tab (\x09) and newline (\x0A), DEL, and C1 controls. */
const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
/** Bidi embeddings/overrides/isolates: they can make a note render misleadingly in a terminal. */
const BIDI_CONTROLS = /[\u202A-\u202E\u2066-\u2069]/g;
/** Unpaired UTF-16 surrogates (not storable as valid UTF-8). */
const LONE_SURROGATES = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/**
 * Normalize a feedback note: unify line breaks, turn tabs into spaces, strip
 * control and bidi-override characters, cap blank-line runs, trim. The text
 * is otherwise kept verbatim (no profanity filter): the owner reads what was written.
 */
export function sanitizeFeedbackText(raw: string): string {
  return raw
    .replace(/\r\n?|[\u2028\u2029\u0085]/g, '\n')
    .replace(/\t/g, ' ')
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_CONTROLS, '')
    .replace(LONE_SURROGATES, '\uFFFD')
    .replace(/[  ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type FeedbackValidation =
  | { valid: true; kind: FeedbackKind; message: string }
  | { valid: false; error: FeedbackErrorCode };

export function validateFeedback(data: unknown): FeedbackValidation {
  if (!data || typeof data !== 'object') return { valid: false, error: 'invalid' };
  const { kind, message } = data as { kind?: unknown; message?: unknown };
  if (typeof kind !== 'string' || !(FEEDBACK_KINDS as readonly string[]).includes(kind)) {
    return { valid: false, error: 'invalid' };
  }
  if (typeof message !== 'string') return { valid: false, error: 'invalid' };
  if (message.length > FEEDBACK_MAX_RAW_LENGTH) return { valid: false, error: 'too_long' };
  const clean = sanitizeFeedbackText(message);
  if (clean.length === 0) return { valid: false, error: 'empty' };
  if (clean.length > FEEDBACK_MAX_LENGTH) return { valid: false, error: 'too_long' };
  return { valid: true, kind: kind as FeedbackKind, message: clean };
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

/**
 * Whitelist the client's self-reported context. Unknown keys are dropped and
 * unknown values become 'unknown'/'other', so free text can never ride along.
 */
export function parseClientContext(raw: unknown): FeedbackClientContext {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    screen: pick(c.screen, FEEDBACK_SCREENS, 'unknown'),
    viewport: pick(c.viewport, VIEWPORT_BUCKETS, 'unknown'),
    browser: pick(c.browser, BROWSER_FAMILIES, 'other'),
    os: pick(c.os, OS_FAMILIES, 'other'),
    textSize: pick(c.textSize, FEEDBACK_TEXT_SIZES, 'unknown'),
    standalone: c.standalone === true,
  };
}

/** Short commit sha from the deploy environment (Railway sets RAILWAY_GIT_COMMIT_SHA). */
export function resolveAppVersion(env: Record<string, string | undefined> = process.env): string | null {
  const sha = (env.RAILWAY_GIT_COMMIT_SHA ?? env.GIT_COMMIT_SHA ?? env.SOURCE_COMMIT ?? '').trim();
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 12).toLowerCase() : null;
}

/**
 * Assemble the attached context field by field. Built explicitly (never by
 * spreading caller objects) so nothing beyond these keys can be stored.
 */
export function buildFeedbackContext(
  client: FeedbackClientContext,
  room: FeedbackRoomSnapshot,
  appVersion: string | null,
): FeedbackContext {
  return {
    screen: client.screen,
    viewport: client.viewport,
    browser: client.browser,
    os: client.os,
    textSize: client.textSize,
    standalone: client.standalone,
    room: room.room,
    gameId: room.gameId,
    roomState: room.roomState,
    sender: room.sender,
    origin: room.origin,
    gameMode: room.gameMode,
    useInquisitor: room.useInquisitor,
    turnPhase: room.turnPhase,
    turn: room.turn,
    humans: room.humans,
    bots: room.bots,
    appVersion,
  };
}

// ─── Rate limiting ───

/** Sliding-window limits: per connection and across the whole server. In memory only. */
export class FeedbackRateLimiter {
  private perConnection = new Map<string, number[]>();
  private global: number[] = [];

  constructor(
    private readonly limits = {
      perConnectionMax: FEEDBACK_PER_CONNECTION_MAX,
      perConnectionWindowMs: FEEDBACK_PER_CONNECTION_WINDOW_MS,
      globalMax: FEEDBACK_GLOBAL_MAX,
      globalWindowMs: FEEDBACK_GLOBAL_WINDOW_MS,
    },
  ) {}

  /** Records the attempt when allowed. Returns why it was refused otherwise. */
  tryConsume(connectionId: string, now: number = Date.now()): { ok: true } | { ok: false; error: 'rate_limited' | 'busy' } {
    const mine = (this.perConnection.get(connectionId) ?? []).filter(t => now - t < this.limits.perConnectionWindowMs);
    if (mine.length >= this.limits.perConnectionMax) {
      this.perConnection.set(connectionId, mine);
      return { ok: false, error: 'rate_limited' };
    }
    this.global = this.global.filter(t => now - t < this.limits.globalWindowMs);
    if (this.global.length >= this.limits.globalMax) {
      this.perConnection.set(connectionId, mine);
      return { ok: false, error: 'busy' };
    }
    mine.push(now);
    this.global.push(now);
    this.perConnection.set(connectionId, mine);
    return { ok: true };
  }

  /** Forget a connection (on disconnect) so the map cannot grow without bound. */
  release(connectionId: string): void {
    this.perConnection.delete(connectionId);
  }

  get trackedConnections(): number {
    return this.perConnection.size;
  }
}

// ─── Output ───

/** Emit one feedback record as a single JSON line on stdout. Never throws. */
export function emitFeedbackLog(record: FeedbackRecord): void {
  try {
    console.log(`${FEEDBACK_PREFIX} ${JSON.stringify(record)}`);
  } catch {
    // best-effort, like emitMetric
  }
}

/** Durable sink for feedback; implemented by PostgresFeedbackStorage. */
export interface FeedbackSink {
  saveFeedback(record: FeedbackRecord): Promise<void>;
}

export interface FeedbackServiceOptions {
  storage?: FeedbackSink | null;
  limiter?: FeedbackRateLimiter;
  appVersion?: string | null;
  now?: () => number;
}

/**
 * Accepts a feedback note: rate limit, validate, attach context, write the
 * `[feedback]` log line and hand the record to durable storage. The storage
 * write is fire-and-forget: once the log line is out the note is captured,
 * so a slow or failing database never delays the reply or the game loop.
 */
export class FeedbackService {
  private storage: FeedbackSink | null;
  private limiter: FeedbackRateLimiter;
  private appVersion: string | null;
  private now: () => number;

  constructor(options: FeedbackServiceOptions = {}) {
    this.storage = options.storage ?? null;
    this.limiter = options.limiter ?? new FeedbackRateLimiter();
    this.appVersion = options.appVersion === undefined ? resolveAppVersion() : options.appVersion;
    this.now = options.now ?? Date.now;
  }

  submit(connectionId: string, data: unknown, room: FeedbackRoomSnapshot): FeedbackResponse {
    try {
      // Validate first so typos don't burn the sender's quota.
      const result = validateFeedback(data);
      if (!result.valid) return { success: false, error: result.error };

      const now = this.now();
      const limit = this.limiter.tryConsume(connectionId, now);
      if (!limit.ok) return { success: false, error: limit.error };

      const record: FeedbackRecord = {
        id: randomUUID(),
        createdAt: new Date(now).toISOString(),
        kind: result.kind,
        message: result.message,
        context: buildFeedbackContext(
          parseClientContext((data as { context?: unknown }).context),
          room,
          this.appVersion,
        ),
      };
      emitFeedbackLog(record);
      if (this.storage) {
        this.storage.saveFeedback(record).catch(() => { /* storage logs its own errors */ });
      }
      return { success: true };
    } catch (err) {
      console.error('[feedback] Failed to accept feedback:', err instanceof Error ? err.message : err);
      return { success: false, error: 'server_error' };
    }
  }

  releaseConnection(connectionId: string): void {
    this.limiter.release(connectionId);
  }
}
