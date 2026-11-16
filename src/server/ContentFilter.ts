import {
  CHAT_MAX_MESSAGE_CODE_UNITS,
  CHAT_MAX_MESSAGE_LENGTH,
  NAME_MAX_CODE_UNITS,
  NAME_MAX_LENGTH,
  TEXT_MAX_COMBINING_RUN,
} from '../shared/constants';
import { graphemeLength } from '../shared/textLimits';

// ─── Result Types ───

type ValidResult = { valid: true; sanitized: string };
type InvalidResult = { valid: false; error: string };
type ValidationResult = ValidResult | InvalidResult;

// ─── Invisible / Control Character Stripping ───
//
// Names and chat arrive in any script (Arabic, Chinese, Devanagari,
// Vietnamese...). Letters, combining marks and emoji are kept. What is
// removed is anything invisible, or anything that changes how the text
// *around* it is displayed:
//
// - C0/C1 controls (tab and newlines become spaces below).
// - Bidi controls: LRM, RLM, ALM, the embeddings and overrides (LRE..RLO)
//   and the isolates (LRI..PDI). An override in a name would reverse every
//   line it is shown in.
// - Zero-width space, word joiner, invisible operators, BOM, soft hyphen,
//   combining grapheme joiner, Mongolian vowel separator, Khmer invisible
//   vowels, deprecated format characters.
// - "Blank letters" that render as nothing but count as letters: the Hangul
//   fillers (U+115F, U+1160, U+3164, U+FFA0) and the blank braille pattern.
// - Tag characters (U+E0000..E007F) and variation selectors other than
//   VS15/VS16, which can carry hidden text.
const STRIPPED = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­͏؜ᅟᅠ឴឵᠎​‎‏‪-‮⁠-⁯⠀ㅤ︀-︍﻿ﾠ\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;

// ZWNJ and ZWJ shape real text (Devanagari half forms, emoji sequences such
// as the family emoji), so one is kept between two visible characters. Runs
// of them, and joiners at an edge or next to a space, are removed.
const JOINER_RUN = /[‌‍]+/g;

// A base character followed by more combining marks than any script needs.
const MARK_RUN = new RegExp(`(\\p{M}{${TEXT_MAX_COMBINING_RUN}})\\p{M}+`, 'gu');

function sanitizeText(raw: string): string {
  // NFC first: composed and decomposed Vietnamese (one code point, or e plus
  // two marks) become one spelling, so lengths, names and the filter agree.
  let text = raw.normalize('NFC');
  text = text.replace(STRIPPED, '');
  text = text.replace(JOINER_RUN, (run: string, offset: number, whole: string) => {
    const before = whole[offset - 1];
    const after = whole[offset + run.length];
    if (!before || !after || /\s/.test(before) || /\s/.test(after)) return '';
    return run[0];
  });
  text = text.replace(MARK_RUN, '$1');
  // Collapse all whitespace runs (newlines, NBSP, ideographic space...) to
  // a single space, then trim.
  text = text.replace(/\s+/g, ' ').trim();
  return text;
}

/** Over the limit in user-perceived characters, or in code units (stacked marks). */
function tooLong(text: string, maxChars: number, maxCodeUnits: number): boolean {
  return text.length > maxCodeUnits || graphemeLength(text) > maxChars;
}

// ─── Game Term Whitelist ───

// These terms are blanked out (using word boundaries) before profanity checks
// to avoid false positives on game-related words
const GAME_TERMS = [
  'assassination',
  'assassinate',
  'assassin',
  'ambassador',
  'exchange',
  'contessa',
  'captain',
  'duke',
  'coup',
  'pass',
  'block',
  'challenge',
  'influence',
  'foreign',
  'income',
  'steal',
  'tax',
  'classic',
  'class',
  'grass',
  'mass',
  'bass',
  'brass',
  'compass',
  'bypass',
  'sass',
  'lasso',
  'trespass',
  'harass',
  'embassy',
  'embarrass',
];

// Pre-build game term regexes with word boundaries, sorted longest-first
const GAME_TERM_REGEXES = [...GAME_TERMS]
  .sort((a, b) => b.length - a.length)
  .map(term => ({ regex: new RegExp(`\\b${term}\\b`, 'gi'), length: term.length }));

function blankOutGameTerms(text: string): string {
  let result = text;
  for (const { regex, length } of GAME_TERM_REGEXES) {
    result = result.replace(regex, ' '.repeat(length));
  }
  return result;
}

// ─── Profanity Blocklist ───

// Each entry is a base word; the checker builds a regex with leet-speak character
// classes and repeated-char tolerance.
// Categories: slurs/hate speech, explicit sexual terms, strong profanity
const BLOCKED_WORDS = [
  // Strong profanity
  'fuck',
  'shit',
  'bitch',
  'cunt',
  'dick',
  'cock',
  'pussy',
  'twat',
  'wanker',
  'prick',
  // Compound forms (standalone "ass" is NOT blocked due to false positives)
  'asshole',
  'arsehole',
  'dumbass',
  'jackass',
  'fatass',
  'badass',
  'smartass',
  'kickass',
  'hardass',
  // Slurs and hate speech
  'nigger',
  'nigga',
  'faggot',
  'fag',
  'dyke',
  'tranny',
  'retard',
  'spic',
  'chink',
  'kike',
  'wetback',
  'beaner',
  'gook',
  'towelhead',
  'raghead',
  'coon',
  'darkie',
  'honky',
  'cracker',
  'gringo',
  'jigaboo',
  // Explicit sexual terms
  'blowjob',
  'handjob',
  'rimjob',
  'cumshot',
  'creampie',
  'bukkake',
  'dildo',
  'masturbat',
  'jerkoff',
  'jackoff',
  'orgasm',
  'erection',
  'penis',
  'vagina',
  'anus',
  'tits',
  'boobs',
  'whore',
  'slut',
  'hentai',
  'porn',
];

// For each letter, which leet-speak characters can represent it
const LEET_VARIANTS: Record<string, string[]> = {
  'a': ['@', '4'],
  'e': ['3'],
  'i': ['1', '!'],
  'o': ['0'],
  's': ['\\$', '5'],
  't': ['7', '\\+'],
  'u': ['@', 'v'],
};

// Characters to preserve when stripping (letters + leet chars)
const STRIP_REGEX = /[^a-z0-9@$!+]/g;

// Build regex with leet-speak character classes and repeated-char tolerance
// e.g., "fuck" → /f+[u@v]+c+k+/i
function buildBlockedRegex(word: string): RegExp {
  const pattern = word.split('').map(ch => {
    const variants = LEET_VARIANTS[ch];
    if (variants) {
      const escaped = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return `[${escaped}${variants.join('')}]+`;
    }
    const escaped = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `${escaped}+`;
  }).join('');
  return new RegExp(pattern, 'i');
}

const BLOCKED_REGEXES = BLOCKED_WORDS.map(w => buildBlockedRegex(w));

function containsProfanity(text: string): boolean {
  // Fold compatibility forms and accents first, so fullwidth "ｆｕｃｋ" and
  // "fück" read as the plain word. Non-Latin letters are then dropped by
  // STRIP_REGEX, as before: the list is English only.
  const lower = text.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

  // Blank game terms using word boundaries (before stripping, so boundaries exist)
  const blanked = blankOutGameTerms(lower);

  // Strip separators but keep letters, digits, and leet characters
  const stripped = blanked.replace(STRIP_REGEX, '');

  for (const regex of BLOCKED_REGEXES) {
    if (regex.test(stripped)) return true;
  }

  return false;
}

// ─── Public API ───

export function validateName(raw: string): ValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Name is required' };
  }

  const sanitized = sanitizeText(raw);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Name is required' };
  }

  if (tooLong(sanitized, NAME_MAX_LENGTH, NAME_MAX_CODE_UNITS)) {
    return { valid: false, error: `Name must be ${NAME_MAX_LENGTH} characters or less` };
  }

  // Must contain at least one letter or digit, in any script
  if (!/[\p{L}\p{N}]/u.test(sanitized)) {
    return { valid: false, error: 'Name must contain at least one letter or number' };
  }

  if (containsProfanity(sanitized)) {
    return { valid: false, error: 'Name contains inappropriate language' };
  }

  return { valid: true, sanitized };
}

export function validateChatMessage(raw: string): ValidationResult {
  if (!raw || typeof raw !== 'string') {
    return { valid: false, error: 'Message is required' };
  }

  const sanitized = sanitizeText(raw);

  if (sanitized.length === 0) {
    return { valid: false, error: 'Message is required' };
  }

  if (tooLong(sanitized, CHAT_MAX_MESSAGE_LENGTH, CHAT_MAX_MESSAGE_CODE_UNITS)) {
    return { valid: false, error: `Message must be ${CHAT_MAX_MESSAGE_LENGTH} characters or less` };
  }

  if (containsProfanity(sanitized)) {
    return { valid: false, error: 'Message contains inappropriate language' };
  }

  return { valid: true, sanitized };
}
