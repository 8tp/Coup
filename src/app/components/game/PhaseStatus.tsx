'use client';

import type { ReactNode } from 'react';
import { ActionType, Character, ClientGameState, GameMode, TurnPhase } from '@/shared/types';
import { actionName, characterName, useT } from '../../i18n';
import { canBlockDuringChallenge } from '../../utils/blockOptions';
import { nameList, playerName } from './tableText';

interface PhaseStatusProps {
  gameState: ClientGameState;
}

export function remainingChallengeNames(gameState: ClientGameState, excludedPlayerId?: string): string[] {
  const passed = new Set(gameState.challengeState?.passedPlayerIds ?? []);
  if (excludedPlayerId) passed.add(excludedPlayerId);
  return gameState.players
    .filter(p => p.isAlive && !passed.has(p.id))
    .map(p => p.name);
}

export function remainingBlockNames(gameState: ClientGameState): string[] {
  const pendingAction = gameState.pendingAction;
  if (!pendingAction) return [];

  const passed = new Set(gameState.blockPassedPlayerIds ?? []);
  passed.add(pendingAction.actorId);

  if (pendingAction.targetId) {
    const target = gameState.players.find(p => p.id === pendingAction.targetId && p.isAlive && !passed.has(p.id));
    return target ? [target.name] : [];
  }

  const actor = gameState.players.find(player => player.id === pendingAction.actorId);
  const aliveFactions = new Set(
    gameState.players.filter(player => player.isAlive && player.faction).map(player => player.faction),
  );

  return gameState.players
    .filter(p => {
      if (!p.isAlive || passed.has(p.id)) return false;
      if (
        pendingAction.type === ActionType.ForeignAid &&
        gameState.gameMode === GameMode.Reformation &&
        aliveFactions.size > 1 &&
        p.faction === actor?.faction
      ) {
        return false;
      }
      return true;
    })
    .map(p => p.name);
}

/**
 * The status line over the felt. During a claim it never restates the claim
 * itself: the plaque under it says who claimed what, at whom. It names who the
 * table is waiting on, and when you can answer it says what to do.
 *
 * Whenever a prompt is open (yours, or the waiting note for you) the prompt is
 * the one statement of the state, so globals.css hides this line visually and
 * keeps it for screen readers ("THE CENTRE SAYS IT ONCE").
 */
export function PhaseStatus({ gameState }: PhaseStatusProps) {
  const t = useT();
  const { turnPhase, pendingAction, pendingBlock, influenceLossRequest, myId } = gameState;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer?.id === myId;
  // A spectator, or a seat that has been knocked out, can only watch.
  const canAnswer = !!gameState.players.find(p => p.id === myId)?.isAlive;
  const passedChallenge = gameState.challengeState?.passedPlayerIds.includes(myId) ?? false;
  const nameOf = (id?: string | null) => playerName(gameState.players.find(p => p.id === id)?.name);
  const waiting = (key: 'game.phase.waitingChallenge' | 'game.phase.waitingBlock', names: string[]) =>
    t.rich(key, { count: names.length, names: nameList(t, names) });

  let text: ReactNode = null;
  let tone: 'neutral' | 'mine' | 'ask' | 'danger' = 'neutral';

  switch (turnPhase) {
    case TurnPhase.AwaitingAction:
      if (isMyTurn) {
        text = t('game.phase.yourTurn');
        tone = 'mine';
      } else {
        text = t.rich('game.phase.theirTurn', { name: playerName(currentPlayer?.name) });
      }
      break;

    case TurnPhase.AwaitingActionChallenge: {
      const actor = nameOf(pendingAction?.actorId);
      // What the actor claimed. Embezzle's claim is that they hold no Duke.
      const isEmbezzle = pendingAction?.type === ActionType.Embezzle;
      const character = isEmbezzle
        ? characterName(t, Character.Duke)
        : pendingAction?.claimedCharacter
          ? characterName(t, pendingAction.claimedCharacter)
          : t('game.phase.aCharacter');
      if (canBlockDuringChallenge(gameState) && !passedChallenge) {
        // Only a Steal or an Assassinate aimed at you can be blocked from here, never an Embezzle.
        text = t.rich('game.phase.claimBlockOrChallenge', { actor, character });
        tone = pendingAction?.type === ActionType.Assassinate ? 'danger' : 'ask';
      } else if (canAnswer && myId !== pendingAction?.actorId && !passedChallenge) {
        text = t.rich(isEmbezzle ? 'game.phase.claimNoChallengeOrPass' : 'game.phase.claimChallengeOrPass', { actor, character });
        tone = 'ask';
      } else {
        text = waiting('game.phase.waitingChallenge', remainingChallengeNames(gameState, pendingAction?.actorId));
      }
      break;
    }

    case TurnPhase.AwaitingBlock: {
      const actor = nameOf(pendingAction?.actorId);
      const remaining = remainingBlockNames(gameState);
      const myName = gameState.players.find(p => p.id === myId)?.name;
      if (canAnswer && myName && remaining.includes(myName) && pendingAction) {
        if (pendingAction.targetId === myId) {
          text = t.rich('game.phase.targetingYou', { actor });
          tone = 'danger';
        } else {
          text = t.rich('game.phase.usesBlockOrAllow', { actor, action: actionName(t, pendingAction.type) });
          tone = 'ask';
        }
      } else {
        text = waiting('game.phase.waitingBlock', remaining);
      }
      break;
    }

    case TurnPhase.AwaitingBlockChallenge: {
      if (canAnswer && pendingBlock && myId !== pendingBlock.blockerId && !passedChallenge) {
        text = t.rich('game.phase.blockChallengeOrPass', {
          blocker: nameOf(pendingBlock.blockerId),
          character: characterName(t, pendingBlock.claimedCharacter),
        });
        tone = 'ask';
      } else {
        text = waiting('game.phase.waitingChallenge', remainingChallengeNames(gameState, pendingBlock?.blockerId));
      }
      break;
    }

    case TurnPhase.AwaitingInfluenceLoss: {
      if (influenceLossRequest?.playerId === myId) {
        text = t('game.phase.chooseLoss');
        tone = 'danger';
      } else {
        text = t.rich('game.phase.choosingLoss', { name: nameOf(influenceLossRequest?.playerId) });
      }
      break;
    }

    case TurnPhase.AwaitingExamineSelection: {
      const target = gameState.players.find(p => p.id === gameState.examineSelectionState?.targetId);
      const examiner = gameState.players.find(p => p.id === gameState.examineSelectionState?.examinerId);
      if (target && target.id === myId) {
        text = examiner
          ? t.rich('game.phase.chooseToShow', { examiner: playerName(examiner.name) })
          : t('game.phase.chooseToShowInquisitor', { character: characterName(t, Character.Inquisitor) });
        tone = 'ask';
      } else {
        text = t.rich('game.phase.choosingToShow', {
          target: playerName(target?.name),
          examiner: playerName(examiner?.name),
        });
      }
      break;
    }

    case TurnPhase.AwaitingExamineDecision: {
      if (myId === pendingAction?.actorId) {
        text = t('game.phase.examineDecision');
        tone = 'ask';
      } else {
        text = t.rich('game.phase.examining', { name: nameOf(pendingAction?.actorId) });
      }
      break;
    }

    case TurnPhase.AwaitingExchange:
      if (gameState.exchangeState) {
        text = t('game.phase.chooseKeep');
        tone = 'ask';
      } else {
        const exchanger = gameState.players.find(p => p.id === pendingAction?.actorId);
        text = exchanger
          ? t.rich('game.phase.choosingKeep', { name: playerName(exchanger.name) })
          : t('game.phase.someoneChoosingKeep');
      }
      break;

    case TurnPhase.GameOver:
      text = t('game.phase.gameOver');
      tone = 'mine';
      break;

    default:
      return null;
  }

  return (
    <div
      className="phase-status-enter phase-line"
      data-tone={tone}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {text}
    </div>
  );
}
