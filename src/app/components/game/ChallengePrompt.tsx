'use client';

import type { ReactNode } from 'react';
import { ActionType, Character, ClientGameState, PendingAction, TurnPhase } from '@/shared/types';
import { CHARACTER_SVG_ICONS } from '../icons';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { blockHint, canBlockDuringChallenge, visibleBlockCharacters } from '../../utils/blockOptions';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { actionName, characterName, useT, type Translator } from '../../i18n';
import { remainingChallengeNames } from './PhaseStatus';
import { nameList, playerName } from './tableText';

interface ChallengePromptProps {
  gameState: ClientGameState;
}

/** Bold, for a player's name inside a prompt sentence. */
const b = (chunks: ReactNode) => <span className="font-bold">{chunks}</span>;
/** The claimed character, in the accent. */
const c = (chunks: ReactNode) => <span className="text-coup-accent font-bold">{chunks}</span>;

/** "X claims Captain to Steal from you", "X claims Assassin to Assassinate you": the claim as the target hears it. */
function aimedAtYou(t: Translator, action: PendingAction, actor: ReactNode): ReactNode {
  const params = {
    actor,
    character: action.claimedCharacter ? characterName(t, action.claimedCharacter) : '',
    action: actionName(t, action.type),
  };
  return t.rich(action.type === ActionType.Steal ? 'prompts.claimStealFromYou' : 'prompts.claimAtYou', params);
}

function BlockButtons({ characters, pending, answer }: {
  characters: Character[];
  pending: string | null;
  answer: (choice: string, send: () => void) => void;
}) {
  const t = useT();
  const socket = getSocket();
  return (
    /* Stacked in the phone dock, where half a row cannot hold "Block with
       Ambassador"; side by side on the desktop felt (prompts leave the dock
       at 1024px), which keeps the prompt clear of the hand below it. */
    <div className={`grid grid-cols-1 gap-2 mt-3 ${characters.length > 1 ? 'lg:grid-cols-2' : ''}`}>
      {characters.map(char => {
        const Icon = CHARACTER_SVG_ICONS[char];
        return (
          <button
            key={char}
            className="btn-primary w-full flex items-center justify-center gap-2 lg:px-2"
            data-pending={pending === `block:${char}` || undefined}
            aria-busy={pending === `block:${char}` || undefined}
            onClick={() => answer(`block:${char}`, () => { haptic(80); socket.emit('game:block', { character: char }); })}
          >
            <Icon size={20} />
            {t('prompts.blockWith', { character: characterName(t, char) })}
          </button>
        );
      })}
    </div>
  );
}

export function ChallengePrompt({ gameState }: ChallengePromptProps) {
  const t = useT();
  const socket = getSocket();
  const { pending, answer } = usePendingAnswer(gameState);
  const { turnPhase, pendingAction, challengeState, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingActionChallenge || !pendingAction || !challengeState) {
    return null;
  }

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.isAlive) return null;

  const actor = gameState.players.find(p => p.id === pendingAction.actorId);
  const target = pendingAction.targetId
    ? gameState.players.find(p => p.id === pendingAction.targetId)
    : null;
  const action = actionName(t, pendingAction.type);
  const claimed = pendingAction.claimedCharacter ? characterName(t, pendingAction.claimedCharacter) : '';
  const waitingNames = remainingChallengeNames(gameState, pendingAction.actorId);
  const waitingOn = { count: waitingNames.length, names: nameList(t, waitingNames) };

  /* `.prompt-claim` restates the claim for a phone, where this prompt sits in
     the bottom sheet and can cover the plaque. On the desktop table the plaque
     sits right above the prompt, so globals.css hides the line there and the
     prompt carries only what you need to decide: the hint, the timer and the
     buttons. */

  // A block the target has already declared, shown to everyone else.
  const declared = pendingAction.declaredBlock;
  const declaredBy = declared ? gameState.players.find(p => p.id === declared.blockerId) : null;
  const declaredNote = declared && declared.blockerId !== myId && declaredBy ? (
    <p className="text-center text-coup-ink-mute text-xs mt-1">
      {t.rich('prompts.declaredBlock', {
        blocker: playerName(declaredBy.name),
        character: characterName(t, declared.claimedCharacter),
        action,
        b,
      })}
    </p>
  ) : null;

  // Actor sees waiting state
  if (myId === pendingAction.actorId) {
    const isMyEmbezzle = pendingAction.type === ActionType.Embezzle;
    return (
      <div className="prompt-info">
        <p className="prompt-claim text-center text-gray-300 mb-1">
          {isMyEmbezzle
            ? t.rich('prompts.youClaimedNo', { character: characterName(t, Character.Duke), action, c })
            : target
              ? t.rich('prompts.youClaimedOn', { character: claimed, action, target: playerName(target.name), b, c })
              : t.rich('prompts.youClaimed', { character: claimed, action, c })}
        </p>
        <p className="text-center text-coup-ink-mute text-sm">{t.rich('prompts.waitingChallenge', waitingOn)}</p>
        {declaredNote}
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // You declared a block: it applies if the action survives this window.
  if (declared && declared.blockerId === myId) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-300 text-sm">
          {t.rich('prompts.youWillBlock', { character: characterName(t, declared.claimedCharacter), action, c })}
        </p>
        <p className="text-center text-coup-ink-mute text-xs">{t.rich('prompts.waitingFor', waitingOn)}</p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  const canBlock = canBlockDuringChallenge(gameState);
  const blockers = canBlock ? visibleBlockCharacters(gameState) : [];
  const isAssassination = pendingAction.type === ActionType.Assassinate;

  // Already passed
  if (challengeState.passedPlayerIds.includes(myId)) {
    if (canBlock) {
      return (
        <div className={isAssassination ? 'prompt-urgent' : 'prompt-action'}>
          <p className="text-center text-gray-300 text-sm mb-1">
            {t('prompts.passedCanBlock')}
          </p>
          <p className="prompt-hint text-center text-gray-400 text-xs mb-2">{blockHint(t, pendingAction.type, blockers)}</p>
          <Timer expiresAt={gameState.timerExpiry} />
          <BlockButtons characters={blockers} pending={pending} answer={answer} />
        </div>
      );
    }
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          {t.rich('prompts.passedWaiting', waitingOn)}
        </p>
        {declaredNote}
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  const challengeButtons = (
    <div className="flex gap-3 mt-3">
      <button
        className="btn-danger flex-1"
        data-pending={pending === 'challenge' || undefined}
        aria-busy={pending === 'challenge' || undefined}
        onClick={() => answer('challenge', () => { hapticHeavy(); socket.emit('game:challenge'); })}
      >
        {t('prompts.challenge')}
      </button>
      <button
        className="btn-secondary flex-1"
        data-pending={pending === 'pass' || undefined}
        aria-busy={pending === 'pass' || undefined}
        onClick={() => answer('pass', () => { haptic(80); socket.emit('game:pass_challenge'); })}
      >
        {t('prompts.pass')}
      </button>
    </div>
  );

  const actorName = playerName(actor?.name);

  // Actionable target of a blockable claim: block, challenge or pass, all here.
  if (canBlock) {
    return (
      <div className={isAssassination ? 'prompt-urgent' : 'prompt-action'}>
        <p className={`prompt-claim text-center font-bold mb-1 ${isAssassination ? 'text-red-300' : 'text-white'}`}>
          {aimedAtYou(t, pendingAction, actorName)}
        </p>
        <p className="prompt-hint text-center text-gray-400 text-xs mb-2">{blockHint(t, pendingAction.type, blockers)}</p>
        <Timer expiresAt={gameState.timerExpiry} />
        <BlockButtons characters={blockers} pending={pending} answer={answer} />
        <p className="prompt-hint text-center text-gray-400 text-xs mt-3">
          {t('prompts.bluffHint')}
        </p>
        {challengeButtons}
      </div>
    );
  }

  // Actionable: can challenge or pass
  const isEmbezzle = pendingAction.type === ActionType.Embezzle;
  const isSteal = pendingAction.type === ActionType.Steal;
  const actionDesc = isEmbezzle
    ? t.rich('prompts.claimNo', { actor: actorName, character: characterName(t, Character.Duke), action })
    : target
      ? target.id === myId
        ? aimedAtYou(t, pendingAction, actorName)
        : t.rich(isSteal ? 'prompts.claimStealFrom' : 'prompts.claimOn', {
          actor: actorName, character: claimed, action, target: playerName(target.name),
        })
      : t.rich('prompts.claim', { actor: actorName, character: claimed, action });

  return (
    <div className="prompt-action">
      <p className="prompt-claim text-center text-white font-bold mb-1">
        {actionDesc}
      </p>
      <p className="prompt-hint text-center text-gray-400 text-xs mb-2">
        {isEmbezzle
          ? t('prompts.embezzleHint', { character: characterName(t, Character.Duke) })
          : t('prompts.bluffHint')}
      </p>
      {declaredNote}
      <Timer expiresAt={gameState.timerExpiry} />
      {challengeButtons}
    </div>
  );
}
