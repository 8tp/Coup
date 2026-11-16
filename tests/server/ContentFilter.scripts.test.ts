/**
 * Names and chat in the scripts our players write: Arabic, Chinese,
 * Devanagari (Hindi), Vietnamese, Portuguese and Spanish, plus emoji. Lengths
 * count user-perceived characters; invisible and direction-changing
 * characters are removed; the English profanity filter still works.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateChatMessage, validateName } from '@/server/ContentFilter';
import { RoomManager } from '@/server/RoomManager';
import { CHAT_MAX_MESSAGE_LENGTH, NAME_MAX_LENGTH } from '@/shared/constants';

const REAL_NAMES: Record<string, string[]> = {
  ar: ['محمد', 'فاطمة الزهراء', 'عبد الرحمن', 'ليلى ٧'],
  zh: ['李伟', '王芳', '张小龙', '欧阳娜娜'],
  hi: ['प्रिया', 'प्रिया शर्मा', 'अनन्या', 'श्रीनिवासन रामचंद्रन', 'क्षितिज'],
  vi: ['Nguyễn Văn An', 'Trần Thị Hồng', 'Phạm Đức', 'Lê Ngọc Ánh'],
  'pt-BR': ['João', 'Conceição', 'Luís Gonçalves', 'Ângela'],
  es: ['José', 'Begoña', 'Íñigo Muñoz', 'Agustín'],
};

describe('names in every script', () => {
  for (const [lang, names] of Object.entries(REAL_NAMES)) {
    it(`accepts ${lang} names unchanged`, () => {
      for (const name of names) {
        expect(validateName(name), name).toEqual({ valid: true, sanitized: name });
      }
    });
  }

  it('counts user-perceived characters, not code units', () => {
    // 26 code units, 15 characters (Devanagari conjuncts and vowel signs).
    const longHindi = 'श्रीनिवासन रामचंद्रन अय्यर';
    expect(longHindi.length).toBeGreaterThan(NAME_MAX_LENGTH);
    expect(validateName(longHindi).valid).toBe(true);
    // Twenty Chinese characters is the limit, as twenty Latin letters are.
    expect(validateName('龙'.repeat(NAME_MAX_LENGTH)).valid).toBe(true);
    expect(validateName('龙'.repeat(NAME_MAX_LENGTH + 1))).toEqual({ valid: false, error: `Name must be ${NAME_MAX_LENGTH} characters or less` });
    // An emoji family is one character (8 code units).
    expect(validateName('Ana 👨‍👩‍👧').valid).toBe(true);
  });

  it('keeps the joiners that shape text and emoji', () => {
    expect(validateName('Ana 👨‍👩‍👧')).toEqual({ valid: true, sanitized: 'Ana 👨‍👩‍👧' });
    // ZWJ after a virama asks for the half form: क्‍ष.
    expect(validateName('क्‍ष')).toEqual({ valid: true, sanitized: 'क्‍ष' });
  });

  it('drops joiners that join nothing, and runs of them', () => {
    expect(validateName('‍Ana‌')).toEqual({ valid: true, sanitized: 'Ana' });
    expect(validateName('Ana ‍ Bo')).toEqual({ valid: true, sanitized: 'Ana Bo' });
    expect(validateName('A‍‍‍b')).toEqual({ valid: true, sanitized: 'A‍b' });
  });

  it('removes bidi controls, so a name cannot reverse the line it sits in', () => {
    for (const control of ['‮', '‭', '‪', '‫', '‬', '⁦', '⁧', '⁨', '⁩', '‎', '‏', '؜']) {
      expect(validateName(`${control}محمد${control}`)).toEqual({ valid: true, sanitized: 'محمد' });
    }
    expect(validateName('‮kcuf').valid).toBe(true); // reads "kcuf": nothing hidden once the override is gone
  });

  it('rejects names made only of invisible "letters"', () => {
    for (const blank of ['ㅤ', 'ㅤㅤ', 'ᅟᅠ', 'ﾠ', '⠀⠀', '​⁠﻿']) {
      expect(validateName(blank).valid, JSON.stringify(blank)).toBe(false);
    }
  });

  it('strips hidden tag characters and variation selectors that carry data', () => {
    expect(validateName('Ana\u{E0041}\u{E0042}')).toEqual({ valid: true, sanitized: 'Ana' });
    expect(validateName('Ana\u{E0100}\u{E0101}')).toEqual({ valid: true, sanitized: 'Ana' });
    // VS16 (emoji presentation) stays.
    expect(validateName('Ana ❤️')).toEqual({ valid: true, sanitized: 'Ana ❤️' });
  });

  it('caps stacked combining marks ("zalgo") but keeps real diacritics', () => {
    const zalgo = 'Z' + '́̂̃̄̅̆̇̈' + 'oe';
    const result = validateName(zalgo);
    expect(result.valid).toBe(true);
    if (result.valid) expect([...result.sanitized].filter(c => /\p{M}/u.test(c)).length).toBeLessThanOrEqual(4);
    // Arabic with shadda and a vowel mark keeps both.
    expect(validateName('مُحَمَّد')).toEqual({ valid: true, sanitized: 'مُحَمَّد' });
  });

  it('stores one spelling for composed and decomposed Vietnamese', () => {
    const decomposed = 'Nguyễn';
    expect(validateName(decomposed)).toEqual({ valid: true, sanitized: 'Nguyễn' });
  });

  it('treats ideographic and no-break spaces as spaces', () => {
    expect(validateName('李　伟')).toEqual({ valid: true, sanitized: '李 伟' });
    expect(validateName('Ana Maria')).toEqual({ valid: true, sanitized: 'Ana Maria' });
  });

  it('still needs a letter or a digit, in any script', () => {
    expect(validateName('🦊').valid).toBe(false);
    expect(validateName('!!!').valid).toBe(false);
    expect(validateName('٧').valid).toBe(true);
  });

  it('still blocks English profanity, including accented and fullwidth spellings', () => {
    for (const bad of ['fuck', 'fück', 'ｆｕｃｋ', 'ŝhit', 'محمد fuck']) {
      expect(validateName(bad), bad).toEqual({ valid: false, error: 'Name contains inappropriate language' });
    }
  });
});

describe('chat in every script', () => {
  it('accepts real messages', () => {
    for (const message of ['تحدي! أنت لا تملك الدوق', '我不信你有公爵', 'मुझे नहीं लगता तुम्हारे पास ड्यूक है', 'Tôi không tin bạn có Công tước', 'Não acredito', '¡Qué suerte!']) {
      expect(validateChatMessage(message), message).toEqual({ valid: true, sanitized: message });
    }
  });

  it('counts the length in characters', () => {
    // 4 characters per word ("नमस्ते" is 3 plus a space), 7 code units.
    const hindi = 'नमस्ते '.repeat(45).trim();
    expect(hindi.length).toBeGreaterThan(CHAT_MAX_MESSAGE_LENGTH);
    expect(validateChatMessage(hindi).valid).toBe(true);
    expect(validateChatMessage('字'.repeat(CHAT_MAX_MESSAGE_LENGTH + 1)).valid).toBe(false);
  });
});

describe('RoomManager with names and chat in other scripts', () => {
  let manager: RoomManager;
  beforeEach(() => { vi.useFakeTimers(); manager = new RoomManager(); });
  afterEach(() => { manager.destroy(); vi.useRealTimers(); });

  it('seats players named in Arabic, Chinese and Hindi', () => {
    const { room } = manager.createRoom('محمد الأحمد', 's1');
    expect(manager.joinRoom(room.code, '李小龙', 's2')).not.toHaveProperty('error');
    expect(manager.joinRoom(room.code, 'प्रिया शर्मा', 's3')).not.toHaveProperty('error');
    expect(room.players.map(p => p.name)).toEqual(['محمد الأحمد', '李小龙', 'प्रिया शर्मा']);
  });

  it('treats fullwidth and case variants as the same name', () => {
    const { room } = manager.createRoom('Bob', 's1');
    expect(manager.joinRoom(room.code, 'ＢＯＢ', 's2')).toEqual({ error: 'Name already taken in this room' });
  });

  it('keeps a long Hindi chat message that is within the limit in characters', () => {
    const { room, playerId } = manager.createRoom('प्रिया', 's1');
    const hindi = 'नमस्ते '.repeat(45).trim();
    const result = manager.addChatMessage(room.code, playerId, 'प्रिया', hindi);
    expect(result).not.toHaveProperty('error');
  });
});
