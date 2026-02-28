'use client';

import { ClientGameState, TurnPhase, ActionType, Character } from '@/shared/types';
import { ACTION_DEFINITIONS, CHARACTER_ICONS } from '@/shared/constants';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';

interface BlockPromptProps {
  gameState: ClientGameState;
}

export function BlockPrompt({ gameState }: BlockPromptProps) {
  const socket = getSocket();
  const { turnPhase, pendingAction, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingBlock || !pendingAction) return null;

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.isAlive) return null;

  const actor = gameState.players.find(p => p.id === pendingAction.actorId);
  const target = pendingAction.targetId
    ? gameState.players.find(p => p.id === pendingAction.targetId)
    : null;
  const def = ACTION_DEFINITIONS[pendingAction.type];

  // Actor sees waiting state
  if (myId === pendingAction.actorId) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-300 text-sm">
          Your {pendingAction.type} is proceeding...
          {target && <> Waiting for <span className="font-bold">{target.name}</span> to respond.</>}
          {!target && ' Waiting for potential blocks.'}
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // For targeted actions (Assassinate, Steal), only the target can block
  if (pendingAction.targetId && pendingAction.targetId !== myId) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          <span className="font-bold">{actor?.name}</span> uses {pendingAction.type} on{' '}
          <span className="font-bold">{target?.name}</span>.
          Waiting for their response...
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Already passed check
  if (gameState.blockPassedPlayerIds?.includes(myId)) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">You passed. Waiting for others...</p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // ── Actionable: this player can block ──
  // Different urgency for assassination vs other actions
  const isAssassination = pendingAction.type === ActionType.Assassinate;
  const isStealing = pendingAction.type === ActionType.Steal;
  const isForeignAid = pendingAction.type === ActionType.ForeignAid;

  const wrapperClass = isAssassination ? 'prompt-urgent' : 'prompt-action';

  let headline: string;
  let subtext: string;

  if (isAssassination) {
    headline = `${actor?.name} is trying to ASSASSINATE you!`;
    subtext = 'Block with Contessa to survive (you don\'t need to actually have her!)';
  } else if (isStealing) {
    headline = `${actor?.name} is trying to steal your coins!`;
    subtext = 'Block with Captain or Ambassador to keep your coins';
  } else if (isForeignAid) {
    headline = `${actor?.name} is taking Foreign Aid (+2 coins)`;
    subtext = 'Claim Duke to block them from getting coins';
  } else {
    headline = `${actor?.name} is using ${pendingAction.type}`;
    subtext = 'You can block this action';
  }

  return (
    <div className={wrapperClass}>
      <p className={`text-center font-bold text-lg mb-1 ${isAssassination ? 'text-red-300' : 'text-white'}`}>
        {headline}
      </p>
      <p className="text-center text-gray-400 text-xs mb-2">
        {subtext}
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="flex flex-col gap-2 mt-3">
        {def.blockedBy.map(char => (
          <button
            key={char}
            className={`${isAssassination ? 'btn-primary' : 'btn-primary'} w-full flex items-center justify-center gap-2`}
            onClick={() => socket.emit('game:block', { character: char })}
          >
            <span>{CHARACTER_ICONS[char]}</span>
            Block with {char}
          </button>
        ))}
        <button
          className="btn-secondary w-full"
          onClick={() => socket.emit('game:pass_block')}
        >
          {isAssassination ? 'Don\'t block (lose an influence)' : 'Don\'t block'}
        </button>
      </div>
    </div>
  );
}
