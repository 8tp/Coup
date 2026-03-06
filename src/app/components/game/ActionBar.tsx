'use client';

import { useState } from 'react';
import { ActionType, ClientGameState, GameMode, TurnPhase } from '@/shared/types';
import { ACTION_DEFINITIONS, FORCED_COUP_THRESHOLD, CONVERSION_SELF_COST, CONVERSION_OTHER_COST } from '@/shared/constants';
import { DukeIcon, AssassinIcon, CaptainIcon, AmbassadorIcon, InquisitorIcon, CoinIcon } from '../icons';
import { Timer } from '../ui/Timer';
import { getSocket } from '../../hooks/useSocket';
import { haptic, hapticHeavy } from '../../utils/haptic';

function CoinsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <circle cx="24" cy="36" r="18" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2.5" />
      <circle cx="40" cy="28" r="18" fill="#fbbf24" stroke="#f59e0b" strokeWidth="2.5" />
      <circle cx="24" cy="36" r="11" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
      <circle cx="40" cy="28" r="11" fill="none" stroke="#f59e0b" strokeWidth="1.5" />
    </svg>
  );
}

function SwordsIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M16 8l4 32-6 4 4 4 4-6 32 4" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 8l-4 32 6 4-4 4-4-6-32 4" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TreasuryIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <rect x="12" y="28" width="40" height="24" rx="4" fill="#92400e" stroke="#b45309" strokeWidth="2" />
      <path d="M12 32C12 28 16 24 32 24C48 24 52 28 52 32" fill="#a16207" />
      <rect x="28" y="22" width="8" height="6" rx="2" fill="#fbbf24" />
      <circle cx="32" cy="40" r="6" fill="#fbbf24" stroke="#f59e0b" strokeWidth="1.5" />
    </svg>
  );
}

function SwapIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M16 24h24l-8-8M48 40H24l8 8" stroke="#60a5fa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ActionConfig = {
  type: ActionType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number }>;
};

function getActionConfig(isReformation: boolean, useInquisitor: boolean, treasuryReserve: number): ActionConfig[] {
  const config: ActionConfig[] = [
    { type: ActionType.Income, label: 'Income', desc: '+1 coin (safe)', icon: CoinIcon },
    { type: ActionType.ForeignAid, label: 'Foreign Aid', desc: '+2 coins (blockable)', icon: CoinsIcon },
    { type: ActionType.Tax, label: 'Tax', desc: '+3 coins (claim Duke)', icon: DukeIcon },
    { type: ActionType.Steal, label: 'Steal', desc: 'Take 2 (claim Captain)', icon: CaptainIcon },
    { type: ActionType.Assassinate, label: 'Assassinate', desc: 'Pay 3, kill (claim Assassin)', icon: AssassinIcon },
    {
      type: ActionType.Exchange,
      label: 'Exchange',
      desc: useInquisitor ? 'Swap 1 card (claim Inquisitor)' : 'Swap cards (claim Ambassador)',
      icon: useInquisitor ? InquisitorIcon : AmbassadorIcon,
    },
    { type: ActionType.Coup, label: 'Coup', desc: 'Pay 7, guaranteed kill', icon: SwordsIcon },
  ];

  if (isReformation) {
    // Add Examine before Coup if using Inquisitor
    if (useInquisitor) {
      config.splice(-1, 0, {
        type: ActionType.Examine,
        label: 'Examine',
        desc: 'Look at card (claim Inquisitor)',
        icon: InquisitorIcon,
      });
    }
    // Add Convert and Embezzle
    config.splice(-1, 0, {
      type: ActionType.Convert,
      label: 'Convert',
      desc: `Switch faction (${CONVERSION_SELF_COST}/${CONVERSION_OTHER_COST} coins)`,
      icon: SwapIcon,
    });
    if (treasuryReserve > 0) {
      config.splice(-1, 0, {
        type: ActionType.Embezzle,
        label: 'Embezzle',
        desc: `Take ${treasuryReserve} from reserve`,
        icon: TreasuryIcon,
      });
    }
  }

  return config;
}

interface ActionBarProps {
  gameState: ClientGameState;
}

export function ActionBar({ gameState }: ActionBarProps) {
  const [selectingTarget, setSelectingTarget] = useState<ActionType | null>(null);
  const socket = getSocket();

  const me = gameState.players.find(p => p.id === gameState.myId);
  const isMyTurn = gameState.players[gameState.currentPlayerIndex]?.id === gameState.myId;

  if (!me || !me.isAlive || !isMyTurn || gameState.turnPhase !== TurnPhase.AwaitingAction) {
    return null;
  }

  const mustCoup = me.coins >= FORCED_COUP_THRESHOLD;
  const isReformation = gameState.gameMode === GameMode.Reformation;
  const allSameFaction = isReformation && gameState.players.filter(p => p.isAlive).every(p => p.faction === me.faction);
  const targets = gameState.players.filter(p => p.isAlive && p.id !== gameState.myId);

  // Faction-restricted targets: can't target same faction (unless all same faction)
  const factionTargets = isReformation && !allSameFaction
    ? targets.filter(p => p.faction !== me.faction)
    : targets;

  // Determine if Inquisitor mode based on whether any player has Inquisitor in their visible cards
  // (we can't see hidden cards, but the exchange label tells us)
  const useInquisitor = isReformation && gameState.players.some(p =>
    p.influences.some(inf => inf.character === 'Inquisitor'),
  );
  const actionConfig = getActionConfig(isReformation, useInquisitor || isReformation, gameState.treasuryReserve);

  const handleAction = (action: ActionType) => {
    haptic(80);
    // Convert can target self or other — handle specially
    if (action === ActionType.Convert) {
      setSelectingTarget(action);
      return;
    }
    const def = ACTION_DEFINITIONS[action];
    if (def.requiresTarget) {
      setSelectingTarget(action);
    } else {
      socket.emit('game:action', { action });
    }
  };

  const handleTargetSelect = (targetId: string) => {
    hapticHeavy();
    if (selectingTarget) {
      socket.emit('game:action', { action: selectingTarget, targetId });
      setSelectingTarget(null);
    }
  };

  if (selectingTarget) {
    const actionName = selectingTarget === ActionType.Coup ? 'Coup' :
                       selectingTarget === ActionType.Assassinate ? 'Assassinate' :
                       selectingTarget === ActionType.Steal ? 'Steal from' :
                       selectingTarget === ActionType.Examine ? 'Examine' :
                       selectingTarget === ActionType.Convert ? 'Convert' : selectingTarget;

    // Use faction-restricted targets for targeted actions
    const isFactionRestricted = [ActionType.Coup, ActionType.Assassinate, ActionType.Steal, ActionType.Examine].includes(selectingTarget);
    const availableTargets = isFactionRestricted ? factionTargets : targets;

    // Convert has special options: self-convert or target-convert
    if (selectingTarget === ActionType.Convert) {
      return (
        <div className="prompt-action">
          <Timer expiresAt={gameState.timerExpiry} />
          <p className="text-center text-white font-bold mb-3">Convert who?</p>
          <div className="flex flex-col gap-2">
            <button
              className="btn-secondary w-full"
              disabled={me.coins < CONVERSION_SELF_COST}
              onClick={() => {
                hapticHeavy();
                socket.emit('game:convert', {});
                setSelectingTarget(null);
              }}
            >
              Yourself ({CONVERSION_SELF_COST} coin)
            </button>
            {targets.map(t => (
              <button
                key={t.id}
                className="btn-secondary w-full"
                disabled={me.coins < CONVERSION_OTHER_COST}
                onClick={() => {
                  hapticHeavy();
                  socket.emit('game:convert', { targetId: t.id });
                  setSelectingTarget(null);
                }}
              >
                {t.name} ({CONVERSION_OTHER_COST} coins)
              </button>
            ))}
            <button
              className="text-gray-500 text-sm mt-1"
              onClick={() => { haptic(80); setSelectingTarget(null); }}
            >
              Cancel
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="prompt-action">
        <Timer expiresAt={gameState.timerExpiry} />
        <p className="text-center text-white font-bold mb-3">
          {actionName} who?
        </p>
        <div className="flex flex-col gap-2">
          {availableTargets.map(t => (
            <button
              key={t.id}
              className="btn-secondary w-full"
              onClick={() => handleTargetSelect(t.id)}
            >
              {t.name} ({t.coins} coins)
            </button>
          ))}
          {isFactionRestricted && availableTargets.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-2">No valid targets (same faction)</p>
          )}
          <button
            className="text-gray-500 text-sm mt-1"
            onClick={() => { haptic(80); setSelectingTarget(null); }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mustCoup) {
    const coupTargets = factionTargets;
    return (
      <div className="prompt-urgent">
        <Timer expiresAt={gameState.timerExpiry} />
        <p className="text-center text-red-300 font-bold mb-1">
          You have {me.coins} coins — you must Coup!
        </p>
        <p className="text-center text-gray-400 text-xs mb-3">
          Choose a player to eliminate
        </p>
        <div className="flex flex-col gap-2">
          {coupTargets.map(t => (
            <button
              key={t.id}
              className="btn-danger w-full"
              onClick={() => {
                hapticHeavy();
                socket.emit('game:action', { action: ActionType.Coup, targetId: t.id });
              }}
            >
              Coup {t.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-action">
      <Timer expiresAt={gameState.timerExpiry} />
      <div className="grid grid-cols-2 gap-2">
        {actionConfig.map(a => {
          const def = ACTION_DEFINITIONS[a.type];
          let canAfford = me.coins >= def.cost;
          // Convert cost is dynamic
          if (a.type === ActionType.Convert) {
            canAfford = me.coins >= CONVERSION_SELF_COST;
          }
          const isFactionAction = [ActionType.Coup, ActionType.Assassinate, ActionType.Steal, ActionType.Examine].includes(a.type);
          const relevantTargets = isFactionAction ? factionTargets : targets;
          const hasTargets = a.type === ActionType.Convert || !def.requiresTarget || relevantTargets.length > 0;
          const disabled = !canAfford || !hasTargets;
          const Icon = a.icon;

          return (
            <button
              key={a.type}
              className={`bg-coup-surface rounded-lg p-2 text-left border border-gray-700
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:border-coup-accent cursor-pointer active:scale-[0.97]'}
                transition-all`}
              onClick={() => !disabled && handleAction(a.type)}
              disabled={disabled}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0"><Icon size={18} /></span>
                <div className="min-w-0">
                  <div className="font-bold text-sm leading-tight">{a.label}</div>
                  <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{a.desc}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
