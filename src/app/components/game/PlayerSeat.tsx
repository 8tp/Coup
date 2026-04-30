'use client';

import { useEffect, useRef, useState } from 'react';
import { ClientPlayerState, Faction } from '@/shared/types';
import { CardFace } from './CardFace';
import { CoinIcon } from '../icons';
import { CoinChangeBurst } from './CoinChangeBurst';
import { useGameStore } from '../../stores/gameStore';

interface PlayerSeatProps {
  player: ClientPlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
  isTarget?: boolean;
  onSelect?: () => void;
  selectable?: boolean;
  timerExpiry?: number | null;
}

function TimerBar({ timerExpiry }: { timerExpiry: number }) {
  const [percent, setPercent] = useState(100);
  const durationRef = useRef(timerExpiry - Date.now());

  useEffect(() => {
    durationRef.current = timerExpiry - Date.now();
    if (durationRef.current <= 0) {
      setPercent(0);
      return;
    }

    let raf: number;
    const tick = () => {
      const remaining = timerExpiry - Date.now();
      const pct = Math.max(0, Math.min(100, (remaining / durationRef.current) * 100));
      setPercent(pct);
      if (remaining > 0) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timerExpiry]);

  const color = percent > 33 ? 'bg-coup-gold' : 'bg-red-500';

  return (
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/50 rounded-b overflow-hidden">
      <div
        className={`h-full ${color} transition-none`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function PlayerSeat({
  player,
  isCurrentTurn,
  isMe,
  isTarget,
  onSelect,
  selectable,
  timerExpiry,
}: PlayerSeatProps) {
  const mutedPlayerIds = useGameStore(s => s.mutedPlayerIds);
  const toggleMutedPlayer = useGameStore(s => s.toggleMutedPlayer);
  const isMuted = mutedPlayerIds.includes(player.id);
  const factionColor = player.faction === Faction.Loyalist
    ? 'border-l-blue-400'
    : player.faction === Faction.Reformist
      ? 'border-l-red-400'
      : '';
  const factionBg = player.faction === Faction.Loyalist
    ? 'bg-blue-500/[0.07]'
    : player.faction === Faction.Reformist
      ? 'bg-red-500/[0.07]'
      : '';

  return (
    <div
      className={`card-container text-center relative overflow-hidden
        ${isCurrentTurn ? 'ring-2 ring-coup-accent animate-pulse-gold' : ''}
        ${!player.isAlive ? 'opacity-40' : ''}
        ${isTarget ? 'ring-2 ring-red-500' : ''}
        ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-coup-accent' : ''}
        ${isMe ? 'bg-coup-surface' : '!p-2.5'}
        ${player.faction ? `border-l-[3px] ${factionColor} ${factionBg}` : ''}`}
      onClick={selectable ? onSelect : undefined}
    >
      <div className={`flex items-center justify-between gap-1.5 ${isMe ? 'mb-2' : 'mb-1'}`}>
        <div className="flex items-center gap-1 min-w-0">
          <span className={`font-bold text-sm truncate ${isMe ? 'text-coup-accent' : ''}`}>
            {player.name}
            {isMe && ' (You)'}
          </span>
          {player.isBot && (
            <span className="shrink-0 text-[10px] bg-blue-600 text-white px-1 py-px rounded font-bold leading-tight">
              BOT
            </span>
          )}
          {player.faction && (
            <span className={`shrink-0 text-[10px] px-1 py-px rounded font-bold leading-tight ${
              player.faction === Faction.Loyalist
                ? 'bg-blue-500/20 text-blue-300 ring-1 ring-blue-500/30'
                : 'bg-red-500/20 text-red-300 ring-1 ring-red-500/30'
            }`}>
              {player.faction === Faction.Loyalist ? '▲ LOY' : '◆ REF'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!isMe && (
            <button
              type="button"
              aria-label={isMuted ? `Unmute ${player.name}` : `Mute chat and reactions from ${player.name}`}
              aria-pressed={isMuted}
              title={isMuted ? `Unmute ${player.name}` : `Mute ${player.name}`}
              className={`w-6 h-6 rounded-full border flex items-center justify-center transition ${
                isMuted
                  ? 'border-coup-accent/60 text-coup-accent bg-coup-accent/10'
                  : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-300'
              }`}
              onClick={(event) => {
                event.stopPropagation();
                toggleMutedPlayer(player.id);
              }}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5" aria-hidden="true">
                <path d="M4 8.5a1 1 0 011-1h2.1l3.2-2.7A1 1 0 0112 5.6v8.8a1 1 0 01-1.7.7l-3.2-2.6H5a1 1 0 01-1-1v-3z" />
                <path d="M14.2 7.2a.8.8 0 011.1 0L16.5 8.4l1.2-1.2a.8.8 0 111.1 1.1L17.6 9.5l1.2 1.2a.8.8 0 11-1.1 1.1l-1.2-1.2-1.2 1.2a.8.8 0 01-1.1-1.1l1.2-1.2-1.2-1.2a.8.8 0 010-1.1z" />
              </svg>
            </button>
          )}
          <span className="flex items-center gap-1 text-coup-gold font-bold text-sm relative">
            <CoinIcon size={14} />
            {player.coins}
            <CoinChangeBurst coins={player.coins} />
          </span>
        </div>
      </div>

      <div className="flex gap-2 justify-center">
        {player.influences.map((inf, i) => (
          <CardFace key={i} influence={inf} size={isMe ? "md" : "sm"} priority={isMe} />
        ))}
      </div>

      {timerExpiry && (
        <TimerBar timerExpiry={timerExpiry} />
      )}
    </div>
  );
}
