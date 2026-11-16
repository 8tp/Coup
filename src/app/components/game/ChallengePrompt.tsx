'use client';

import { ActionType, Character, ClientGameState, PendingAction, TurnPhase } from '@/shared/types';
import { ACTION_DISPLAY_NAMES } from '@/shared/constants';
import { CHARACTER_SVG_ICONS } from '../icons';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';
import { blockHint, canBlockDuringChallenge, visibleBlockCharacters } from '../../utils/blockOptions';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { formatNames, remainingChallengeNames } from './PhaseStatus';

interface ChallengePromptProps {
  gameState: ClientGameState;
}

/** "Steal from you", "Assassinate you": the claim as the target hears it. */
function aimedAtYou(action: PendingAction): string {
  const name = ACTION_DISPLAY_NAMES[action.type];
  return action.type === ActionType.Steal ? `${name} from you` : `${name} you`;
}

function BlockButtons({ characters, pending, answer }: {
  characters: Character[];
  pending: string | null;
  answer: (choice: string, send: () => void) => void;
}) {
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
            Block with {char}
          </button>
        );
      })}
    </div>
  );
}

export function ChallengePrompt({ gameState }: ChallengePromptProps) {
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
  const actionName = ACTION_DISPLAY_NAMES[pendingAction.type];
  const waitingOn = formatNames(remainingChallengeNames(gameState, pendingAction.actorId));

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
      <span className="font-bold">{declaredBy.name}</span> will block with {declared.claimedCharacter} if the {actionName} goes ahead.
    </p>
  ) : null;

  // Actor sees waiting state
  if (myId === pendingAction.actorId) {
    const isMyEmbezzle = pendingAction.type === ActionType.Embezzle;
    return (
      <div className="prompt-info">
        <p className="prompt-claim text-center text-gray-300 mb-1">
          {isMyEmbezzle
            ? <>You claimed <span className="text-coup-accent font-bold">no Duke</span> to Embezzle</>
            : <>You claimed <span className="text-coup-accent font-bold">{pendingAction.claimedCharacter}</span> to {actionName}
              {target && <> on <span className="font-bold">{target.name}</span></>}</>
          }
        </p>
        <p className="text-center text-coup-ink-mute text-sm">Waiting for {waitingOn} to challenge or pass.</p>
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
          You&apos;ll block with <span className="text-coup-accent font-bold">{declared.claimedCharacter}</span> if the {actionName} goes ahead.
        </p>
        <p className="text-center text-coup-ink-mute text-xs">Waiting for {waitingOn}.</p>
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
            You passed on the challenge. You can still block.
          </p>
          <p className="prompt-hint text-center text-gray-400 text-xs mb-2">{blockHint(pendingAction.type, blockers)}</p>
          <Timer expiresAt={gameState.timerExpiry} />
          <BlockButtons characters={blockers} pending={pending} answer={answer} />
        </div>
      );
    }
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          You passed. Waiting for {waitingOn}.
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
        Challenge
      </button>
      <button
        className="btn-secondary flex-1"
        data-pending={pending === 'pass' || undefined}
        aria-busy={pending === 'pass' || undefined}
        onClick={() => answer('pass', () => { haptic(80); socket.emit('game:pass_challenge'); })}
      >
        Pass
      </button>
    </div>
  );

  // Actionable target of a blockable claim: block, challenge or pass, all here.
  if (canBlock) {
    return (
      <div className={isAssassination ? 'prompt-urgent' : 'prompt-action'}>
        <p className={`prompt-claim text-center font-bold mb-1 ${isAssassination ? 'text-red-300' : 'text-white'}`}>
          {actor?.name} claims {pendingAction.claimedCharacter} to {aimedAtYou(pendingAction)}
        </p>
        <p className="prompt-hint text-center text-gray-400 text-xs mb-2">{blockHint(pendingAction.type, blockers)}</p>
        <Timer expiresAt={gameState.timerExpiry} />
        <BlockButtons characters={blockers} pending={pending} answer={answer} />
        <p className="prompt-hint text-center text-gray-400 text-xs mt-3">
          Challenge if you think they&apos;re bluffing. If they aren&apos;t, you lose a card.
        </p>
        {challengeButtons}
      </div>
    );
  }

  // Actionable: can challenge or pass
  const isEmbezzle = pendingAction.type === ActionType.Embezzle;
  const actionDesc = isEmbezzle
    ? `${actor?.name} claims no Duke to Embezzle`
    : target
      ? `${actor?.name} claims ${pendingAction.claimedCharacter} to ${actionName} ${pendingAction.type === ActionType.Steal ? 'from ' : ''}${target.id === myId ? 'you' : target.name}`
      : `${actor?.name} claims ${pendingAction.claimedCharacter} to ${actionName}`;

  return (
    <div className="prompt-action">
      <p className="prompt-claim text-center text-white font-bold mb-1">
        {actionDesc}
      </p>
      <p className="prompt-hint text-center text-gray-400 text-xs mb-2">
        {isEmbezzle
          ? "Challenge if you think they have a Duke. If they don't, you lose a card."
          : "Challenge if you think they're bluffing. If they aren't, you lose a card."}
      </p>
      {declaredNote}
      <Timer expiresAt={gameState.timerExpiry} />
      {challengeButtons}
    </div>
  );
}
