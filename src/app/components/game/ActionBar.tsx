'use client';

import { useState } from 'react';
import { ActionType, ClientGameState, TurnPhase } from '@/shared/types';
import { ACTION_DEFINITIONS, FORCED_COUP_THRESHOLD } from '@/shared/constants';
import { getSocket } from '../../hooks/useSocket';

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
    const def = ACTION_DEFINITIONS[action];
    if (def.requiresTarget) {
      setSelectingTarget(action);
    } else {
      socket.emit('game:action', { action });
    }
  };

  const handleTargetSelect = (targetId: string) => {
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
            onClick={() => setSelectingTarget(null)}
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

  const actions = [
    { type: ActionType.Income, label: 'Income', desc: '+1 coin (safe)', icon: '🪙' },
    { type: ActionType.ForeignAid, label: 'Foreign Aid', desc: '+2 coins (blockable)', icon: '💰' },
    { type: ActionType.Tax, label: 'Tax', desc: '+3 coins (claim Duke)', icon: '👑' },
    { type: ActionType.Steal, label: 'Steal', desc: 'Take 2 (claim Captain)', icon: '🛡️' },
    { type: ActionType.Assassinate, label: 'Assassinate', desc: 'Pay 3, kill (claim Assassin)', icon: '🗡️' },
    { type: ActionType.Exchange, label: 'Exchange', desc: 'Swap cards (claim Ambassador)', icon: '📜' },
    { type: ActionType.Coup, label: 'Coup', desc: 'Pay 7, guaranteed kill', icon: '⚔️' },
  ];

  return (
    <div className="prompt-action">
      <div className="grid grid-cols-2 gap-2">
        {actions.map(a => {
          const def = ACTION_DEFINITIONS[a.type];
          const canAfford = me.coins >= def.cost;
          const hasTargets = !def.requiresTarget || targets.length > 0;
          const disabled = !canAfford || !hasTargets;

          return (
            <button
              key={a.type}
              className={`bg-coup-surface rounded-lg p-2.5 text-left border border-gray-700
                ${disabled ? 'opacity-30 cursor-not-allowed' : 'hover:border-coup-accent cursor-pointer active:scale-[0.97]'}
                transition-all`}
              onClick={() => !disabled && handleAction(a.type)}
              disabled={disabled}
            >
              <div className="flex items-start gap-2">
                <span className="text-base mt-0.5">{a.icon}</span>
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
