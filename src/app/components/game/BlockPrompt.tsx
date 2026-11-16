'use client';

import { Character, ClientGameState, GameMode, TurnPhase, ActionType } from '@/shared/types';
import { ACTION_DEFINITIONS, ACTION_DISPLAY_NAMES } from '@/shared/constants';
import { CHARACTER_SVG_ICONS } from '../icons';
import { formatNames, remainingBlockNames } from './PhaseStatus';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic } from '../../utils/haptic';

/** What a Steal takes, at most. Mirrors `Math.min(2, target.coins)` in ActionResolver. */
const STEAL_AMOUNT = 2;

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
          Your {ACTION_DISPLAY_NAMES[pendingAction.type]} goes ahead unless{' '}
          {target ? <><span className="font-bold">{target.name}</span> blocks it.</> : 'someone blocks it.'}
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // For targeted actions (Assassinate, Steal), only the target can block
  if (pendingAction.targetId && pendingAction.targetId !== myId) {
    return (
      <div className="prompt-info">
        <p className="prompt-claim text-center text-gray-300 text-sm mb-1">
          <span className="font-bold">{actor?.name}</span> uses {ACTION_DISPLAY_NAMES[pendingAction.type]} on{' '}
          <span className="font-bold">{target?.name}</span>.
        </p>
        <p className="text-center text-gray-400 text-sm">
          Waiting for <span className="font-bold text-gray-300">{target?.name}</span> to block or allow.
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  const aliveFactions = new Set(
    gameState.players.filter(player => player.isAlive && player.faction).map(player => player.faction),
  );
  const sameFactionForeignAid =
    pendingAction.type === ActionType.ForeignAid &&
    gameState.gameMode === GameMode.Reformation &&
    aliveFactions.size > 1 &&
    me.faction !== undefined &&
    me.faction === actor?.faction;

  if (sameFactionForeignAid) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          You can&apos;t block <span className="font-bold text-gray-300">{actor?.name}</span>&apos;s Foreign Aid.
          You share a faction, and both factions are still in the game.
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // Already passed check
  if (gameState.blockPassedPlayerIds?.includes(myId)) {
    const waitingOn = remainingBlockNames(gameState);
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-400 text-sm">
          {waitingOn.length > 0 ? <>You passed. Waiting for {formatNames(waitingOn)}.</> : 'You passed.'}
        </p>
        <Timer expiresAt={gameState.timerExpiry} />
      </div>
    );
  }

  // ── Actionable: this player can block ──
  const isAssassination = pendingAction.type === ActionType.Assassinate;
  const isStealing = pendingAction.type === ActionType.Steal;
  const isForeignAid = pendingAction.type === ActionType.ForeignAid;

  const wrapperClass = isAssassination ? 'prompt-urgent' : 'prompt-action';

  /* `headline` is the claim, for a phone (see ChallengePrompt). `subtext` is
     what blocking or allowing costs you, and it has to stand on its own on the
     desktop table, where the plaque states the claim and the headline is hidden. */
  let headline: string;
  let subtext: string;

  if (isAssassination) {
    headline = `${actor?.name} is assassinating you`;
    subtext = 'Block with Contessa or lose a card. You can claim Contessa without holding one.';
  } else if (isStealing) {
    const taken = Math.min(STEAL_AMOUNT, me.coins);
    const coins = taken === 1 ? 'your coin' : `${taken} of your coins`;
    headline = `${actor?.name} is stealing ${coins}`;
    const blocker = gameState.useInquisitor ? 'Captain or Inquisitor' : 'Captain or Ambassador';
    subtext = `Block with ${blocker} to keep ${coins}. You can claim either without holding it.`;
  } else if (isForeignAid) {
    headline = `${actor?.name} is taking Foreign Aid (+2 coins)`;
    subtext = 'Claim Duke to stop them taking 2 coins. You can claim Duke without holding one.';
  } else {
    headline = `${actor?.name} uses ${ACTION_DISPLAY_NAMES[pendingAction.type]}`;
    subtext = 'You can block it.';
  }

  return (
    <div className={wrapperClass}>
      <p className={`prompt-claim text-center font-bold text-lg mb-1 ${isAssassination ? 'text-red-300' : 'text-white'}`}>
        {headline}
      </p>
      <p className="prompt-hint text-center text-gray-400 text-xs mb-2">
        {subtext}
      </p>
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="block-choices flex flex-col gap-2 mt-3">
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
              className="block-choice btn-primary w-full flex items-center justify-center gap-2"
              onClick={() => { haptic(80); socket.emit('game:block', { character: char }); }}
            >
              <Icon size={20} />
              Block with {char}
            </button>
          );
        })}
        <button
          className="block-allow btn-secondary w-full"
          onClick={() => { haptic(80); socket.emit('game:pass_block'); }}
        >
          Don&apos;t block
        </button>
      </div>
    </div>
  );
}
