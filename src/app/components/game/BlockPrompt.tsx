'use client';

import type { ReactNode } from 'react';
import { Character, ClientGameState, GameMode, TurnPhase, ActionType } from '@/shared/types';
import { ACTION_DEFINITIONS, FOREIGN_AID_COINS, STEAL_COINS } from '@/shared/constants';
import { CHARACTER_SVG_ICONS } from '../icons';
import { remainingBlockNames } from './PhaseStatus';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic } from '../../utils/haptic';
import { characterList } from '../../utils/blockOptions';
import { usePendingAnswer } from '../../hooks/usePendingAnswer';
import { actionName, characterName, useT } from '../../i18n';
import { nameList, playerName } from './tableText';


/** Bold, for a player's name inside a prompt sentence. */
const b = (chunks: ReactNode) => <span className="font-bold">{chunks}</span>;
/** Bold and a shade brighter: the one player the table is waiting on. */
const bLit = (chunks: ReactNode) => <span className="font-bold text-gray-300">{chunks}</span>;

interface BlockPromptProps {
  gameState: ClientGameState;
}

export function BlockPrompt({ gameState }: BlockPromptProps) {
  const t = useT();
  const socket = getSocket();
  const { pending, answer } = usePendingAnswer(gameState);
  const { turnPhase, pendingAction, myId } = gameState;

  if (turnPhase !== TurnPhase.AwaitingBlock || !pendingAction) return null;

  const me = gameState.players.find(p => p.id === myId);
  if (!me || !me.isAlive) return null;

  const actor = gameState.players.find(p => p.id === pendingAction.actorId);
  const target = pendingAction.targetId
    ? gameState.players.find(p => p.id === pendingAction.targetId)
    : null;
  const def = ACTION_DEFINITIONS[pendingAction.type];
  const action = actionName(t, pendingAction.type);

  // Actor sees waiting state
  if (myId === pendingAction.actorId) {
    return (
      <div className="prompt-info">
        <p className="text-center text-gray-300 text-sm">
          {target
            ? t.rich('prompts.yourActionUnless', { action, target: playerName(target.name), b })
            : t('prompts.yourActionUnlessAnyone', { action })}
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
          {t.rich('prompts.usesOn', { actor: playerName(actor?.name), action, target: playerName(target?.name), b })}
        </p>
        <p className="text-center text-gray-400 text-sm">
          {t.rich('prompts.waitingTarget', { target: playerName(target?.name), b: bLit })}
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
          {t.rich('prompts.sameFactionForeignAid', { actor: playerName(actor?.name), action, b: bLit })}
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
          {waitingOn.length > 0
            ? t.rich('prompts.blockPassedWaiting', { names: nameList(t, waitingOn) })
            : t('prompts.blockPassed')}
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
  const actorName = playerName(actor?.name);

  /* `headline` is the claim, for a phone (see ChallengePrompt). `subtext` is
     what blocking or allowing costs you, and it has to stand on its own on the
     desktop table, where the plaque states the claim and the headline is hidden. */
  let headline: ReactNode;
  let subtext: string;

  if (isAssassination) {
    const contessa = characterName(t, Character.Contessa);
    headline = t.rich('prompts.assassinating', { actor: actorName });
    subtext = t('prompts.assassinatingHint', { character: contessa });
  } else if (isStealing) {
    const taken = Math.min(STEAL_COINS, me.coins);
    headline = t.rich('prompts.stealing', { actor: actorName, count: taken });
    const blockers = characterList(t, [Character.Captain, gameState.useInquisitor ? Character.Inquisitor : Character.Ambassador]);
    subtext = t('prompts.stealingHint', { blockers, count: taken });
  } else if (isForeignAid) {
    headline = t.rich('prompts.foreignAid', { actor: actorName, action, count: FOREIGN_AID_COINS });
    subtext = t('prompts.foreignAidHint', { character: characterName(t, Character.Duke), count: FOREIGN_AID_COINS });
  } else {
    headline = t.rich('prompts.uses', { actor: actorName, action });
    subtext = t('prompts.canBlock');
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
              data-pending={pending === `block:${char}` || undefined}
              aria-busy={pending === `block:${char}` || undefined}
              onClick={() => answer(`block:${char}`, () => { haptic(80); socket.emit('game:block', { character: char }); })}
            >
              <Icon size={20} />
              {t('prompts.blockWith', { character: characterName(t, char) })}
            </button>
          );
        })}
        <button
          className="block-allow btn-secondary w-full"
          data-pending={pending === 'pass' || undefined}
          aria-busy={pending === 'pass' || undefined}
          onClick={() => answer('pass', () => { haptic(80); socket.emit('game:pass_block'); })}
        >
          {t('prompts.dontBlock')}
        </button>
      </div>
    </div>
  );
}
