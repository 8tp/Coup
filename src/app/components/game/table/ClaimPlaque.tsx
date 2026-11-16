'use client';

import { ActionType, Character, ClientGameState, TurnPhase } from '@/shared/types';
import { selectable } from '@/shared/i18n/messageFormat';
import { actionName, characterName, useT } from '../../../i18n';
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
import type { ComponentType, ReactNode } from 'react';

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

interface PlaqueProps {
  /** Who is acting: a name, or "You". */
  actor: ReactNode;
  /** The printed headline — an action name, or "Blocks". */
  headline: string;
  /** The small line under it ("as Duke · on You"). */
  detail?: ReactNode;
  /** A claimed character strikes its medallion; otherwise the action's glyph. */
  character?: Character | null;
  actionType?: ActionType;
  /** The second plaque that lands on top of the action it blocks. */
  isBlock?: boolean;
  /** This action was stopped: an ink slab is stamped across it. */
  blocked?: boolean;
}

/**
 * One printed plaque. The table renders it from game state below; the
 * tutorial renders it from a script, so a new player learns the exact object
 * they will see on the felt.
 */
export function Plaque({ actor, headline, detail, character, actionType, isBlock, blocked }: PlaqueProps) {
  const ActionGlyph = actionType ? ACTION_GLYPHS[actionType] : undefined;
  return (
    <div className={`claim-plaque ${isBlock ? 'claim-block' : ''} ${blocked ? 'is-blocked' : ''}`}>
      <span className="claim-mark">
        {character
          ? <CharacterMedallion character={character} size={isBlock ? 40 : 44} />
          : ActionGlyph && <ActionGlyph size={30} />}
      </span>
      <span className="claim-text">
        <span className="claim-actor">{actor}</span>
        <span className="claim-action type-display">{headline}</span>
        {detail && <span className="claim-detail">{detail}</span>}
      </span>
    </div>
  );
}

/**
 * The action on the table, as a printed plaque in the middle of the felt:
 * who, what they claim, and at whom. A block lands on top of it as a second
 * plaque under an ink slab, so the state of the turn reads as objects rather
 * than as a sentence in a banner.
 *
 * `data-coach-anchor="plaque"` is what the practice coach points at when a
 * tip is about a claim (utils/practiceCoach.ts).
 */
export function ClaimPlaque({ gameState }: { gameState: ClientGameState }) {
  const t = useT();
  const { pendingAction, pendingBlock, turnPhase } = gameState;
  if (!pendingAction || !PLAQUE_PHASES.has(turnPhase)) return null;

  /** Who is acting: "You", or the player's name. */
  const actorOf = (id?: string | null): ReactNode => {
    if (!id) return null;
    if (id === gameState.myId) return t('game.plaque.you');
    const name = gameState.players.find(p => p.id === id)?.name;
    return name ? <bdi>{name}</bdi> : null;
  };
  /** A target param: `you` selects the reader's own wording in the message. */
  const targetOf = (id?: string | null) => {
    if (!id) return null;
    if (id === gameState.myId) return selectable('', 'you');
    const name = gameState.players.find(p => p.id === id)?.name;
    return name ? selectable(<bdi>{name}</bdi>, 'other') : null;
  };
  const actor = actorOf(pendingAction.actorId);
  const target = targetOf(pendingAction.targetId);
  const blocker = pendingBlock ? actorOf(pendingBlock.blockerId) : null;

  const claimed = pendingAction.claimedCharacter;
  const isEmbezzle = pendingAction.type === ActionType.Embezzle;
  /* The plaque's second line: the claim (Embezzle claims no Duke) and the target, as one sentence. */
  let detail: ReactNode = null;
  if (claimed && target) {
    detail = t.rich(isEmbezzle ? 'game.plaque.claimsNoOn' : 'game.plaque.asOn', { character: characterName(t, claimed), target });
  } else if (claimed) {
    detail = t.rich(isEmbezzle ? 'game.plaque.claimsNo' : 'game.plaque.as', { character: characterName(t, claimed) });
  } else if (target) {
    detail = t.rich('game.plaque.on', { target });
  }

  return (
    <div className="claim-stack" data-coach-anchor="plaque" key={`${gameState.turnNumber}-${pendingAction.type}`}>
      <Plaque
        actor={actor}
        headline={actionName(t, pendingAction.type)}
        character={pendingAction.claimedCharacter}
        actionType={pendingAction.type}
        blocked={!!pendingBlock}
        detail={detail}
      />

      {pendingBlock && (
        <Plaque
          isBlock
          actor={blocker}
          headline={t('game.plaque.blocks')}
          character={pendingBlock.claimedCharacter}
          detail={t.rich('game.plaque.as', { character: characterName(t, pendingBlock.claimedCharacter) })}
        />
      )}
    </div>
  );
}
