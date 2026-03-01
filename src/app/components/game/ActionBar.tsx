'use client';

import { useState } from 'react';
import { ActionType, ClientGameState, TurnPhase } from '@/shared/types';
import { ACTION_DEFINITIONS, FORCED_COUP_THRESHOLD } from '@/shared/constants';
import { DukeIcon, AssassinIcon, CaptainIcon, AmbassadorIcon, CoinIcon } from '../icons';
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

const actionConfig: Array<{
  type: ActionType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number }>;
}> = [
  { type: ActionType.Income, label: 'Income', desc: '+1 coin (safe)', icon: CoinIcon },
  { type: ActionType.ForeignAid, label: 'Foreign Aid', desc: '+2 coins (blockable)', icon: CoinsIcon },
  { type: ActionType.Tax, label: 'Tax', desc: '+3 coins (claim Duke)', icon: DukeIcon },
  { type: ActionType.Steal, label: 'Steal', desc: 'Take 2 (claim Captain)', icon: CaptainIcon },
  { type: ActionType.Assassinate, label: 'Assassinate', desc: 'Pay 3, kill (claim Assassin)', icon: AssassinIcon },
  { type: ActionType.Exchange, label: 'Exchange', desc: 'Swap cards (claim Ambassador)', icon: AmbassadorIcon },
  { type: ActionType.Coup, label: 'Coup', desc: 'Pay 7, guaranteed kill', icon: SwordsIcon },
];

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
  const targets = gameState.players.filter(p => p.isAlive && p.id !== gameState.myId);

  const handleAction = (action: ActionType) => {
    haptic(80);
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
                       selectingTarget === ActionType.Steal ? 'Steal from' : selectingTarget;
    return (
      <div className="prompt-action">
        <p className="text-center text-white font-bold mb-3">
          {actionName} who?
        </p>
        <div className="flex flex-col gap-2">
          {targets.map(t => (
            <button
              key={t.id}
              className="btn-secondary w-full"
              onClick={() => handleTargetSelect(t.id)}
            >
              {t.name} ({t.coins} coins)
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

  if (mustCoup) {
    return (
      <div className="prompt-urgent">
        <p className="text-center text-red-300 font-bold mb-1">
          You have {me.coins} coins — you must Coup!
        </p>
        <p className="text-center text-gray-400 text-xs mb-3">
          Choose a player to eliminate
        </p>
        <div className="flex flex-col gap-2">
          {targets.map(t => (
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
      <div className="grid grid-cols-2 gap-2">
        {actionConfig.map(a => {
          const def = ACTION_DEFINITIONS[a.type];
          const canAfford = me.coins >= def.cost;
          const hasTargets = !def.requiresTarget || targets.length > 0;
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
