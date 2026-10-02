'use client';

import type { ComponentType } from 'react';
import type { LogEventType } from '@/shared/types';
import type { GlyphProps } from '../components/icons';
import {
  AssassinateGlyph,
  BlockGlyph,
  BluffGlyph,
  BotGlyph,
  ChallengeGlyph,
  ClaimGlyph,
  CoinGlyph,
  ConvertGlyph,
  CoupGlyph,
  CrownGlyph,
  DeckGlyph,
  DeclareGlyph,
  DiceGlyph,
  EmbezzleGlyph,
  ExamineGlyph,
  ExchangeGlyph,
  ExitGlyph,
  GameStartGlyph,
  ResolveGlyph,
  SkullGlyph,
  TargetGlyph,
  TruthGlyph,
  TurnGlyph,
} from '../components/icons';

/**
 * Client-side visual mapping for the action log and the awards list.
 *
 * This lives here, not in `src/shared/constants.ts`, on purpose: `src/shared/`
 * is imported by the engine and the server, and a React component reaching that
 * far would drag JSX into the server bundle. `LOG_EVENT_ICONS` stays a plain
 * `Record<LogEventType, string>` over there; this is the presentation layer.
 */
export type GlyphComponent = ComponentType<GlyphProps>;

/** One glyph per log event type. The glyph is decorative — the message carries the meaning. */
export const LOG_EVENT_GLYPHS: Record<LogEventType, GlyphComponent> = {
  game_start: GameStartGlyph,
  turn_start: TurnGlyph,
  income: CoinGlyph,
  coup: CoupGlyph,
  claim_action: ClaimGlyph,
  declare_action: DeclareGlyph,
  challenge: ChallengeGlyph,
  challenge_fail: TruthGlyph,
  challenge_success: BluffGlyph,
  block: BlockGlyph,
  block_challenge: ChallengeGlyph,
  block_challenge_fail: TruthGlyph,
  block_challenge_success: BluffGlyph,
  block_unchallenged: BlockGlyph,
  influence_loss: SkullGlyph,
  exchange: ExchangeGlyph,
  exchange_draw: DeckGlyph,
  action_resolve: ResolveGlyph,
  assassination: AssassinateGlyph,
  elimination: SkullGlyph,
  win: CrownGlyph,
  bot_replace: BotGlyph,
  // Reformation expansion
  convert: ConvertGlyph,
  embezzle: EmbezzleGlyph,
  examine: ExamineGlyph,
  examine_decision: ExamineGlyph,
  faction_change: ConvertGlyph,
};

/**
 * Award glyphs, keyed by a stable identifier. `computeAwards()` in `gameStats.ts`
 * carries the key (a plain string) so that module stays React-free; the render
 * sites resolve it to a component through here.
 */
export const AWARD_GLYPHS = {
  bluff: BluffGlyph,
  truth: TruthGlyph,
  challenge: ChallengeGlyph,
  target: TargetGlyph,
  block: BlockGlyph,
  claim: ClaimGlyph,
  coup: CoupGlyph,
  assassinate: AssassinateGlyph,
  dice: DiceGlyph,
  exit: ExitGlyph,
} satisfies Record<string, GlyphComponent>;

export type AwardGlyphKey = keyof typeof AWARD_GLYPHS;
