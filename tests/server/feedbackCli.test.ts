import { describe, expect, it } from 'vitest';
import { formatRecord, parseArgs, parseSince } from '../../scripts/feedback';
import { FEEDBACK_LIST_DEFAULT_LIMIT } from '@/server/storage/PostgresFeedbackStorage';
import { GameMode, TurnPhase } from '@/shared/types';

const NOW = Date.parse('2026-11-16T12:00:00Z');

describe('npm run feedback: argument parsing', () => {
  it('defaults to the newest 50 with no since', () => {
    expect(parseArgs([], NOW)).toEqual({ limit: FEEDBACK_LIST_DEFAULT_LIMIT, since: null, json: false });
  });

  it('parses --limit, --since (relative and ISO) and --json', () => {
    expect(parseArgs(['--limit', '20', '--since', '7d', '--json'], NOW)).toEqual({
      limit: 20, since: new Date('2026-11-09T12:00:00Z'), json: true,
    });
    expect(parseArgs(['--limit=5', '--since=2026-11-01'], NOW)).toMatchObject({ limit: 5, since: new Date('2026-11-01') });
    expect(parseSince('12h', NOW)).toEqual(new Date('2026-11-16T00:00:00Z'));
    expect(parseSince('30m', NOW)).toEqual(new Date('2026-11-16T11:30:00Z'));
  });

  it('rejects bad input', () => {
    expect(() => parseArgs(['--limit', '0'], NOW)).toThrow('--limit');
    expect(() => parseArgs(['--limit', 'ten'], NOW)).toThrow('--limit');
    expect(() => parseArgs(['--since', 'yesterday'], NOW)).toThrow('--since');
    expect(() => parseArgs(['--since'], NOW)).toThrow('--since');
    expect(() => parseArgs(['--verbose'], NOW)).toThrow('Unknown option');
  });

  it('formats a record with its context and the full message', () => {
    const text = formatRecord({
      id: 'abc',
      createdAt: '2026-11-16T10:00:00.000Z',
      kind: 'bug',
      message: 'Line one\nLine two',
      context: {
        screen: 'game', viewport: 'phone', browser: 'chrome', os: 'android', textSize: 'large', standalone: true,
        room: 'a1b2c3d4e5', gameId: 'a1b2c3d4e5-x', roomState: 'in_game', sender: 'eliminated', origin: 'standard',
        gameMode: GameMode.Reformation, useInquisitor: true, turnPhase: TurnPhase.AwaitingBlock, turn: 9, humans: 2, bots: 2,
        appVersion: '9618828',
      },
    });
    expect(text).toContain('BUG');
    expect(text).toContain('room a1b2c3d4e5');
    expect(text).toContain('turn 9 AwaitingBlock');
    expect(text).toContain('eliminated');
    expect(text).toContain('phone · android · chrome · text large · installed · 9618828');
    expect(text).toContain('  Line one\n  Line two');
  });
});
