'use client';

import { useEffect, useRef, useState } from 'react';
import { ClientPlayerState } from '@/shared/types';
import { CardFace } from './CardFace';
import { CoinIcon } from '../icons';

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

function CoinDelta({ coins }: { coins: number }) {
  const prevCoins = useRef(coins);
  const [delta, setDelta] = useState<number | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (prevCoins.current !== coins) {
      const diff = coins - prevCoins.current;
      prevCoins.current = coins;
      setDelta(diff);
      setKey(k => k + 1);
    }
  }, [coins]);

  if (delta === null) return null;

  return (
    <span
      key={key}
      className={`absolute -top-1 right-1 text-xs font-bold pointer-events-none animate-coin-float
        ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}
    >
      {delta > 0 ? `+${delta}` : delta}
    </span>
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
  return (
    <div
      className={`card-container text-center relative overflow-hidden
        ${isCurrentTurn ? 'ring-2 ring-coup-accent animate-pulse-gold' : ''}
        ${!player.isAlive ? 'opacity-40' : ''}
        ${isTarget ? 'ring-2 ring-red-500' : ''}
        ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-coup-accent' : ''}
        ${isMe ? 'bg-coup-surface' : '!p-2.5'}`}
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
        </div>
        <span className="flex items-center gap-1 text-coup-gold font-bold text-sm shrink-0 relative">
          <CoinIcon size={14} />
          {player.coins}
          <CoinDelta coins={player.coins} />
        </span>
      </div>

      <div className="flex gap-2 justify-center">
        {player.influences.map((inf, i) => (
          <CardFace key={i} influence={inf} size={isMe ? "md" : "sm"} />
        ))}
      </div>

      {timerExpiry && (
        <TimerBar timerExpiry={timerExpiry} />
      )}
    </div>
  );
}
