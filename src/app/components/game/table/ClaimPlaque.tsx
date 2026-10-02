'use client';

import { ActionType, ClientGameState, TurnPhase } from '@/shared/types';
import { ACTION_DISPLAY_NAMES } from '@/shared/constants';
import {
  AssassinateGlyph,
  CharacterMedallion,
  CoinGlyph,
  ConvertGlyph,
  CoupGlyph,
  EmbezzleGlyph,
  ExamineGlyph,
  ExchangeGlyph,
  StealGlyph,
  type GlyphProps,
} from '../../icons';
import type { ComponentType } from 'react';

const ACTION_GLYPHS: Partial<Record<ActionType, ComponentType<GlyphProps>>> = {
  [ActionType.Income]: CoinGlyph,
  [ActionType.ForeignAid]: CoinGlyph,
  [ActionType.Coup]: CoupGlyph,
  [ActionType.Assassinate]: AssassinateGlyph,
  [ActionType.Steal]: StealGlyph,
  [ActionType.Exchange]: ExchangeGlyph,
  [ActionType.Examine]: ExamineGlyph,
  [ActionType.Convert]: ConvertGlyph,
  [ActionType.Embezzle]: EmbezzleGlyph,
};

/** Phases in which an action is on the table and worth showing as an object. */
const PLAQUE_PHASES = new Set<TurnPhase>([
  TurnPhase.AwaitingActionChallenge,
  TurnPhase.AwaitingBlock,
  TurnPhase.AwaitingBlockChallenge,
  TurnPhase.AwaitingInfluenceLoss,
  TurnPhase.AwaitingExchange,
  TurnPhase.AwaitingExamineSelection,
  TurnPhase.AwaitingExamineDecision,
]);

/**
 * The action on the table, as a printed plaque in the middle of the felt:
 * who, what they claim, and at whom. A block lands on top of it as a second
 * plaque under an ink slab, so the state of the turn reads as objects rather
 * than as a sentence in a banner.
 */
export function ClaimPlaque({ gameState }: { gameState: ClientGameState }) {
  const { pendingAction, pendingBlock, turnPhase } = gameState;
  if (!pendingAction || !PLAQUE_PHASES.has(turnPhase)) return null;

  const nameOf = (id?: string | null) => {
    if (!id) return null;
    if (id === gameState.myId) return 'You';
    return gameState.players.find(p => p.id === id)?.name ?? null;
  };
  const actor = nameOf(pendingAction.actorId);
  const target = nameOf(pendingAction.targetId);
  const blocker = pendingBlock ? nameOf(pendingBlock.blockerId) : null;
  const ActionGlyph = ACTION_GLYPHS[pendingAction.type];

  return (
    <div className="claim-stack" key={`${gameState.turnNumber}-${pendingAction.type}`}>
      <div className={`claim-plaque ${pendingBlock ? 'is-blocked' : ''}`}>
        <span className="claim-mark">
          {pendingAction.claimedCharacter
            ? <CharacterMedallion character={pendingAction.claimedCharacter} size={44} />
            : ActionGlyph && <ActionGlyph size={30} />}
        </span>
        <span className="claim-text">
          <span className="claim-actor">{actor}</span>
          <span className="claim-action type-display">{ACTION_DISPLAY_NAMES[pendingAction.type]}</span>
          <span className="claim-detail">
            {pendingAction.claimedCharacter && <>as {pendingAction.claimedCharacter}</>}
            {pendingAction.claimedCharacter && target && ' · '}
            {target && <>on {target}</>}
          </span>
        </span>
      </div>

      {pendingBlock && (
        <div className="claim-plaque claim-block">
          <span className="claim-mark">
            <CharacterMedallion character={pendingBlock.claimedCharacter} size={40} />
          </span>
          <span className="claim-text">
            <span className="claim-actor">{blocker}</span>
            <span className="claim-action type-display">Blocks</span>
            <span className="claim-detail">as {pendingBlock.claimedCharacter}</span>
          </span>
        </div>
      )}
    </div>
  );
}
