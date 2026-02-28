'use client';

import { ClientPlayerState } from '@/shared/types';
import { CardFace } from './CardFace';

interface PlayerSeatProps {
  player: ClientPlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
  isTarget?: boolean;
  onSelect?: () => void;
  selectable?: boolean;
}

export function PlayerSeat({
  player,
  isCurrentTurn,
  isMe,
  isTarget,
  onSelect,
  selectable,
}: PlayerSeatProps) {
  return (
    <div
      className={`card-container text-center
        ${isCurrentTurn ? 'ring-2 ring-coup-accent animate-pulse-gold' : ''}
        ${!player.isAlive ? 'opacity-40' : ''}
        ${isTarget ? 'ring-2 ring-red-500' : ''}
        ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-coup-accent' : ''}
        ${isMe ? 'bg-coup-surface' : ''}`}
      onClick={selectable ? onSelect : undefined}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className={`font-bold text-sm truncate max-w-[80px] ${isMe ? 'text-coup-accent' : ''}`}>
          {player.name}
          {isMe && ' (You)'}
        </span>
        <span className="text-coup-gold font-bold text-sm shrink-0">
          {player.coins} coin{player.coins !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex gap-2 justify-center">
        {player.influences.map((inf, i) => (
          <CardFace key={i} influence={inf} size="sm" />
        ))}
      </div>

      {!player.isAlive && (
        <div className="text-xs text-red-400 mt-1 font-medium">Eliminated</div>
      )}
    </div>
  );
}
