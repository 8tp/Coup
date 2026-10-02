import { describe, expect, it } from 'vitest';
import { GameMode } from '@/shared/types';
import {
  DEFAULT_PRACTICE_OPTIONS,
  describePracticeOptions,
  normalizePracticeOptions,
  practiceBots,
  practiceOptionsForMode,
} from '@/app/utils/practiceSetup';

describe('practiceBots', () => {
  it('maps each style to its engine personality', () => {
    expect(practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, style: 'gentle' })[0].personality).toBe('conservative');
    expect(practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, style: 'sharp' })[0].personality).toBe('analytical');
    expect(practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, style: 'ruthless' })[0].personality).toBe('optimal');
  });

  it('seats one bot per opponent, all in the chosen style', () => {
    for (const opponents of [1, 2, 3] as const) {
      const bots = practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, opponents, style: 'sharp' });
      expect(bots).toHaveLength(opponents);
      expect(new Set(bots.map(b => b.personality))).toEqual(new Set(['analytical']));
    }
  });

  it('keeps the familiar Tutor Bot name for the first seat', () => {
    expect(practiceBots(DEFAULT_PRACTICE_OPTIONS)).toEqual([{ name: 'Tutor Bot', personality: 'conservative' }]);
    expect(practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, opponents: 3 }).map(b => b.name))
      .toEqual(['Tutor Bot', 'Morgan Bot', 'Rook Bot']);
  });

  it('never reuses a name already at the table, case-insensitively', () => {
    const bots = practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, opponents: 2 }, ['tutor bot']);
    const names = bots.map(b => b.name.toLowerCase());
    expect(names).not.toContain('tutor bot');
    expect(new Set(names).size).toBe(2);
  });

  it('clamps an out-of-range opponent count', () => {
    expect(practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, opponents: 9 as never })).toHaveLength(3);
    expect(practiceBots({ ...DEFAULT_PRACTICE_OPTIONS, opponents: 0 as never })).toHaveLength(1);
  });
});

describe('practice options', () => {
  it('defaults to one gentle opponent, Classic, coach on', () => {
    expect(DEFAULT_PRACTICE_OPTIONS).toEqual({ opponents: 1, style: 'gentle', gameMode: GameMode.Classic, coach: true });
  });

  it('keeps the two-bot table for one-tap Reformation practice', () => {
    expect(practiceOptionsForMode(GameMode.Reformation)).toMatchObject({ opponents: 2, gameMode: GameMode.Reformation });
    expect(practiceOptionsForMode(GameMode.Classic)).toMatchObject({ opponents: 1, gameMode: GameMode.Classic });
  });

  it('normalizes junk from outside into legal options', () => {
    expect(normalizePracticeOptions(null)).toEqual(DEFAULT_PRACTICE_OPTIONS);
    expect(normalizePracticeOptions({ style: 'brutal' as never, gameMode: 'Other' as never, coach: 'yes' as never }))
      .toEqual(DEFAULT_PRACTICE_OPTIONS);
    expect(normalizePracticeOptions({ opponents: 2.6 as never }).opponents).toBe(3);
  });

  it('summarizes the choice for the start button', () => {
    expect(describePracticeOptions(DEFAULT_PRACTICE_OPTIONS)).toBe('1 gentle opponent · Classic');
    expect(describePracticeOptions({ opponents: 3, style: 'ruthless', gameMode: GameMode.Reformation, coach: false }))
      .toBe('3 ruthless opponents · Reformation');
  });
});
