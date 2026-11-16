/**
 * Print recent in-game feedback from Postgres, newest first.
 *
 *   DATABASE_URL=postgres://... npm run feedback
 *   DATABASE_URL=postgres://... npm run feedback -- --limit 20 --since 7d
 *   DATABASE_URL=postgres://... npm run feedback -- --since 2026-11-01 --json
 *
 * --limit N     rows to print (default 50, max 500)
 * --since X     only notes at or after X: an ISO date/time, or a relative
 *               age such as 30m, 12h, 7d
 * --json        one JSON object per line instead of the readable layout
 *
 * Read-only apart from `CREATE TABLE IF NOT EXISTS`. Never prints DATABASE_URL.
 */
import { FeedbackRecord } from '../src/shared/feedbackTypes';
import { createFeedbackStorage, FEEDBACK_LIST_DEFAULT_LIMIT } from '../src/server/storage/PostgresFeedbackStorage';

export interface FeedbackCliArgs {
  limit: number;
  since: Date | null;
  json: boolean;
}

const RELATIVE_UNITS_MS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

export function parseSince(value: string, now: number = Date.now()): Date {
  const rel = /^(\d+)([mhd])$/i.exec(value.trim());
  if (rel) return new Date(now - Number(rel[1]) * RELATIVE_UNITS_MS[rel[2].toLowerCase()]);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`--since: expected an ISO date or an age like 7d, got "${value}"`);
  return date;
}

export function parseArgs(argv: string[], now: number = Date.now()): FeedbackCliArgs {
  const args: FeedbackCliArgs = { limit: FEEDBACK_LIST_DEFAULT_LIMIT, since: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split('=', 2);
    const next = () => inline ?? argv[++i];
    if (flag === '--limit') {
      const n = Number(next());
      if (!Number.isInteger(n) || n < 1) throw new Error('--limit: expected a positive whole number');
      args.limit = n;
    } else if (flag === '--since') {
      const v = next();
      if (!v) throw new Error('--since: missing value');
      args.since = parseSince(v, now);
    } else if (flag === '--json') {
      args.json = true;
    } else if (flag === '--help' || flag === '-h') {
      throw new Error('usage: npm run feedback -- [--limit N] [--since 7d|ISO date] [--json]');
    } else {
      throw new Error(`Unknown option ${argv[i]}`);
    }
  }
  return args;
}

export function formatRecord(r: FeedbackRecord): string {
  const c = r.context;
  const where = [
    c.screen,
    c.roomState !== 'none' ? `room ${c.room ?? '?'}` : null,
    c.gameId ? `game ${c.gameId}` : null,
    c.turn !== null ? `turn ${c.turn}${c.turnPhase ? ` ${c.turnPhase}` : ''}` : null,
    c.sender !== 'no_room' ? c.sender : null,
    c.gameMode,
    c.humans !== null ? `${c.humans} humans, ${c.bots ?? 0} bots` : null,
  ].filter(Boolean).join(' · ');
  const device = [c.viewport, c.os, c.browser, c.textSize !== 'normal' ? `text ${c.textSize}` : null, c.standalone ? 'installed' : null]
    .filter(Boolean).join(' · ');
  const body = r.message.split('\n').map(line => `  ${line}`).join('\n');
  return [
    `── ${r.createdAt}  ${r.kind.toUpperCase()}  ${r.id}`,
    `   ${where}`,
    `   ${device}${c.appVersion ? ` · ${c.appVersion}` : ''}`,
    body,
  ].join('\n');
}

async function main(): Promise<number> {
  let args: FeedbackCliArgs;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    return 2;
  }
  const storage = createFeedbackStorage();
  if (!storage) {
    console.error('DATABASE_URL is not set. Without it, feedback lives only in the server log: search for "[feedback]".');
    return 2;
  }
  try {
    const rows = await storage.listRecent({ limit: args.limit, since: args.since });
    if (args.json) {
      for (const row of rows) console.log(JSON.stringify(row));
    } else if (rows.length === 0) {
      console.log('No feedback found.');
    } else {
      console.log(rows.map(formatRecord).join('\n\n'));
      console.log(`\n${rows.length} note${rows.length === 1 ? '' : 's'}, newest first.`);
    }
    return 0;
  } catch (err) {
    console.error('Failed to read feedback:', err instanceof Error ? err.message : err);
    return 1;
  } finally {
    await storage.close();
  }
}

// Run only when executed directly (tests import the helpers above).
if (typeof require !== 'undefined' && require.main === module) {
  main().then(code => { process.exitCode = code; });
}
