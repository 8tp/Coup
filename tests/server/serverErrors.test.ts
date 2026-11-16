/**
 * Every error or notice text the server can send a player has a stable code
 * (src/shared/i18n/serverErrors.ts), so clients can show it in their language.
 * The scan below reads the engine and server source for error literals; a new
 * error without a code fails here.
 */
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { classifyServerError, failedAck, SERVER_ERROR_CODES, serverErrorPayload } from '@/shared/i18n/serverErrors';
import { ActionType, Character } from '@/shared/types';
import en from '@/app/i18n/messages/en';
import { describeAckError, describeServerError } from '@/app/i18n/serverErrors';
import { makePlainTranslator } from '@/app/i18n/runtime';

const ROOT = path.resolve(__dirname, '../..');
const FILES = [
  ...readdirSync(path.join(ROOT, 'src/engine')).map(f => `src/engine/${f}`),
  ...readdirSync(path.join(ROOT, 'src/server')).filter(f => f.endsWith('.ts')).map(f => `src/server/${f}`),
].filter(f => !f.includes('BotBrain'));

/** Literals in the positions that reach a player. */
const LITERAL = /(?:\berror:\s*|failedAck\(|serverErrorPayload\(|\breturn\s+)(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

function scan(): Array<{ file: string; text: string; template: boolean }> {
  const out: Array<{ file: string; text: string; template: boolean }> = [];
  for (const file of FILES) {
    const src = readFileSync(path.join(ROOT, file), 'utf8');
    for (const m of src.matchAll(LITERAL)) {
      const text = m[2];
      // Player-facing texts are sentences; this skips ids, regex sources and enum values.
      if (!/^([A-Z]|\$\{[^}]+\} [a-z])/.test(text) || text.length < 6) continue;
      out.push({ file, text, template: m[1] === '`' });
    }
  }
  return out;
}

/** Template literals whose `${}` holds a name or code, checked with real samples below. */
const TEMPLATE_SAMPLES: Record<string, string> = {
  '${claimedCharacter} cannot block ${ACTION_DISPLAY_NAMES[pendingAction.type]}': 'Duke cannot block Foreign Aid',
  'You were removed from room ${found.room.code}.': 'You were removed from room ABCD.',
  "Must keep exactly ${expectedKeep} card${expectedKeep === 1 ? '' : 's'}": 'Must keep exactly 2 cards',
};

describe('server error codes', () => {
  const found = scan();

  it('finds the error literals (sanity)', () => {
    expect(found.length).toBeGreaterThan(80);
  });

  it('every error literal in the engine and server has a code', () => {
    const uncoded: string[] = [];
    for (const { file, text, template } of found) {
      const sample = template ? (TEMPLATE_SAMPLES[text] ?? text.replace(/\$\{[^}]+\}/g, '7')) : text;
      if (classifyServerError(sample).code === 'unknown') uncoded.push(`${file}: ${text}`);
    }
    expect(uncoded).toEqual([]);
  });

  it('extracts params from dynamic texts', () => {
    expect(classifyServerError('Not enough coins (need 7, have 3)')).toEqual({ code: 'not_enough_coins', params: { need: 7, have: 3 } });
    expect(classifyServerError('Duke cannot block Foreign Aid')).toEqual({ code: 'cannot_block_with', params: { character: Character.Duke, action: ActionType.ForeignAid } });
    expect(classifyServerError('Must keep exactly 1 card')).toEqual({ code: 'must_keep_cards', params: { count: 1 } });
    expect(classifyServerError('You were removed from room ABCD.')).toEqual({ code: 'removed_from_room', params: { room: 'ABCD' } });
    expect(classifyServerError('Something new')).toEqual({ code: 'unknown' });
  });

  it('keeps the English text on the wire beside the code', () => {
    expect(serverErrorPayload('Too many requests, please wait')).toEqual({ message: 'Too many requests, please wait', code: 'rate_limited' });
    expect(failedAck('Room is full')).toEqual({ success: false, error: 'Room is full', errorCode: 'room_full' });
  });

  it('every code has an English line', () => {
    for (const code of SERVER_ERROR_CODES) {
      if (code === 'unknown') continue;
      expect(en.errors[code], code).toBeTruthy();
    }
  });
});

describe('rendering server errors on the client', () => {
  const t = makePlainTranslator('en');

  it('renders by code, with glossary names and plurals', () => {
    expect(describeServerError({ message: 'Too many requests, please wait', code: 'rate_limited' }, t)).toBe('Too many requests. Wait a moment.');
    expect(describeServerError({ message: 'x', code: 'not_enough_coins', params: { need: 7, have: 3 } }, t)).toBe('You need 7 coins and have 3.');
    expect(describeServerError({ message: 'x', code: 'cannot_block_with', params: { character: 'Duke', action: 'ForeignAid' } }, t)).toBe("Duke can't block Foreign Aid.");
  });

  it('falls back to the English text for an unknown or missing code', () => {
    expect(describeServerError({ message: 'Brand new failure', code: 'unknown' }, t)).toBe('Brand new failure');
    expect(describeServerError({ message: 'Old server' }, t)).toBe('Old server');
  });

  it('renders in the pseudo-locale', () => {
    expect(describeServerError({ message: 'x', code: 'room_full' }, makePlainTranslator('en-XA'))).toMatch(/^⟦.+⟧$/);
  });

  it('describes failed acknowledgements', () => {
    expect(describeAckError({ error: 'Room not found', errorCode: 'room_not_found' }, 'Failed')).toBe('Room not found.');
    expect(describeAckError({}, 'Failed to join room')).toBe('Failed to join room');
  });
});
