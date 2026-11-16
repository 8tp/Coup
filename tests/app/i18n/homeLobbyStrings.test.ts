/**
 * The home screen, lobby, shared UI and their hooks are converted to the
 * catalogs (docs/I18N.md). This guards against a new hard-coded English
 * string: JSX text, user-facing attributes and error fallbacks in these
 * files must come from `t()`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '@/app/i18n/messages/en';
import { makePlainTranslator } from '@/app/i18n/runtime';
import { BOT_PERSONALITY_TYPES } from '@/shared/constants';
import type { BotPersonality } from '@/shared/types';

const ROOT = path.resolve(__dirname, '../../..');
const CONVERTED = [
  'src/app/page.tsx',
  'src/app/lobby/[roomCode]/page.tsx',
  'src/app/components/home/LearnSheet.tsx',
  'src/app/components/lobby/AddBotModal.tsx',
  'src/app/components/lobby/QRShareModal.tsx',
  'src/app/components/pwa/PWAInstallPrompt.tsx',
  'src/app/components/ui/Modal.tsx',
  'src/app/components/ui/Timer.tsx',
];

function source(file: string): string {
  return readFileSync(path.join(ROOT, file), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\s\/\/ .*$/gm, '');
}

/** Text between JSX tags that contains a letter, e.g. `>Join room<` or `>Bot · {`. */
function jsxText(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/(?<!=)>([^<>{};=()`?']*?[A-Za-z][^<>{};=()`?']*?)[<{]/g)) {
    const text = m[1].trim();
    if (text && !/^&\w+;$/.test(text)) out.push(text);
  }
  return out;
}

function literalAttributes(code: string): string[] {
  return [...code.matchAll(/\b(title|aria-label|placeholder|alt)="([^"]*[A-Za-z][^"]*)"/g)].map(m => `${m[1]}="${m[2]}"`);
}

function literalFallbacks(code: string): string[] {
  return [
    ...code.matchAll(/(?:setError|new Error|describeAckError\([^,]+,)\(?\s*'([^']*[A-Za-z][^']*)'/g),
    ...code.matchAll(/(?:\|\||\?\?)\s*'([A-Z][^']*)'/g),
    ...code.matchAll(/:\s*'([A-Z][a-z][^']*\s[^']*)'\)/g),
  ].map(m => m[1]);
}

describe('home and lobby strings come from the catalogs', () => {
  for (const file of CONVERTED) {
    it(file, () => {
      const code = source(file);
      expect(jsxText(code), 'JSX text').toEqual([]);
      expect(literalAttributes(code), 'attributes').toEqual([]);
      expect(literalFallbacks(code), 'fallback strings').toEqual([]);
    });
  }

  it('useSocket has no English fallbacks', () => {
    const code = source('src/app/hooks/useSocket.ts');
    expect(literalFallbacks(code)).toEqual([]);
    expect(code).not.toMatch(/new Error\('/);
  });

  it('the checks catch what they guard against', () => {
    expect(jsxText('<button>Join room</button><span>Bot · {x}</span>')).toEqual(['Join room', 'Bot ·']);
    expect(literalAttributes('<b aria-label="Close" title={t(\'x\')} />')).toEqual(['aria-label="Close"']);
    expect(literalFallbacks("setError('Enter your name'); x || 'Spectator'")).toEqual(['Enter your name', 'Spectator']);
  });
});

describe('bot personalities', () => {
  it('every personality has a name and a description', () => {
    const t = makePlainTranslator('en');
    const all: BotPersonality[] = ['random', ...BOT_PERSONALITY_TYPES];
    for (const p of all) {
      expect(t(`lobby.personality.${p}`), p).toBeTruthy();
      expect(t(`lobby.personalityDescription.${p}`), p).toBeTruthy();
    }
    expect(Object.keys(en.lobby).filter(k => k.startsWith('personality.'))).toHaveLength(all.length);
  });
});
