'use client';

import { Character, ClientGameState, TurnPhase, ActionType } from '@/shared/types';
import { ACTION_DEFINITIONS, ACTION_DISPLAY_NAMES } from '@/shared/constants';
import { CHARACTER_SVG_ICONS } from '../icons';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic } from '../../utils/haptic';

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
          Your {ACTION_DISPLAY_NAMES[pendingAction.type]} is proceeding...
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
          <span className="font-bold">{actor?.name}</span> uses {ACTION_DISPLAY_NAMES[pendingAction.type]} on{' '}
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
    headline = `${actor?.name} is trying to steal 2 of your coins!`;
    const blocker = gameState.useInquisitor ? 'Captain or Inquisitor' : 'Captain or Ambassador';
    subtext = `Block with ${blocker} to keep your coins`;
  } else if (isForeignAid) {
    headline = `${actor?.name} is taking Foreign Aid (+2 coins)`;
    subtext = 'Claim Duke to block them from getting coins';
  } else {
    headline = `${actor?.name} is using ${ACTION_DISPLAY_NAMES[pendingAction.type]}`;
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
        {def.blockedBy
          .filter(char => {
            // Hide Ambassador in Inquisitor mode and vice versa
            if (gameState.useInquisitor) return char !== Character.Ambassador;
            return char !== Character.Inquisitor;
          })
          .map(char => {
          const Icon = CHARACTER_SVG_ICONS[char];
          return (
            <button
              key={char}
              className="btn-primary w-full flex items-center justify-center gap-2"
              onClick={() => { haptic(80); socket.emit('game:block', { character: char }); }}
            >
              <Icon size={20} />
              Block with {char}
            </button>
          );
        })}
        <button
          className="btn-secondary w-full"
          onClick={() => { haptic(80); socket.emit('game:pass_block'); }}
        >
          {isAssassination ? 'Don\'t block (lose an influence)' : 'Don\'t block'}
        </button>
      </div>
    </div>
  );
}
