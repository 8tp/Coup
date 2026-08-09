'use client';

import { useEffect, useRef, useState } from 'react';
import { ClientPlayerState, Faction } from '@/shared/types';
import { CardFace, FLIGHT_VARS_RESET } from './CardFace';
import { CoinIcon } from '../icons';
import { CoinChangeBurst } from './CoinChangeBurst';
import { useGameStore } from '../../stores/gameStore';

interface PlayerSeatProps {
  player: ClientPlayerState;
  isCurrentTurn: boolean;
  isMe: boolean;
  /**
   * This seat is in the crosshairs: a legal target of the action being aimed
   * right now, or the declared target of the action on the table.
   *
   * It draws ART-DIRECTION §1.2's HAZARD MATERIAL, not a red ring, and the
   * distinction is not stylistic. `ring-2 ring-red-500` used to live here, and
   * `#ef4444` is the exact hex §1.1 row 1 records as the old Contessa border:
   * "you are being targeted" and "she holds a Contessa" were the same pixel
   * value. The card frames moved to a rose band to open that gap; putting a
   * red ring back on the seat would close it again from the other side.
   */
  isTarget?: boolean;
  /** Tap handler. Present whenever the seat takes part in a selection — INCLUDING an illegal one, which must refuse out loud rather than do nothing. */
  onSelect?: () => void;
  /** A legal choice: brass hover ring (§1.2's selection material) and a pointer. */
  selectable?: boolean;
  /** Why this seat cannot be chosen. §6.2's "illegal half": marked, not omitted. */
  illegalReason?: string;
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
  illegalReason,
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

  /* A seat in a selection is a control, so it gets a control's affordances —
     including the illegal ones. A seat that cannot be chosen still answers the
     tap (the ActionBar's `refuse()` fires through `onSelect`), so it must stay
     reachable by keyboard too; `aria-disabled` says "refused", where
     `disabled` would say "not here", and §3.10 is explicit that refusal is
     out loud, not a control quietly going away. */
  const interactive = !!onSelect;
  const activate = () => { if (onSelect) onSelect(); };

  return (
    <div
      className={`card-container text-center relative overflow-hidden
        ${isCurrentTurn ? 'ring-2 ring-coup-accent animate-pulse-gold' : ''}
        ${!player.isAlive ? 'opacity-40' : ''}
        ${isTarget ? 'seat-target' : ''}
        ${selectable ? 'cursor-pointer hover:ring-2 hover:ring-coup-accent' : ''}
        ${isMe ? 'bg-coup-surface' : '!p-2.5'}
        ${player.faction ? `border-l-[3px] ${factionColor} ${factionBg}` : ''}`}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={illegalReason ? true : undefined}
      aria-label={interactive
        ? (illegalReason ? `${player.name} — ${illegalReason}` : `Choose ${player.name}`)
        : undefined}
      data-target-illegal={illegalReason ? 'true' : undefined}
      onClick={interactive ? activate : undefined}
      onKeyDown={interactive
        ? (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              activate();
            }
          }
        : undefined}
    >
      <div className={`flex items-center justify-between gap-1.5 ${isMe ? 'mb-2' : 'mb-1'}`}>
        <div className="flex items-center gap-1 min-w-0">
          {/* ART-DIRECTION.md §4: player names are a Display role. */}
          <span className={`type-display text-step-0 truncate ${isMe ? 'text-coup-accent' : ''}`}>
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
          <span className="figure flex items-center gap-1 text-coup-gold font-bold text-sm relative">
            <CoinIcon size={14} />
            {player.coins}
            <CoinChangeBurst coins={player.coins} />
          </span>
        </div>
      </div>

      {/* `seat-cards` is the hook the desktop table sizes through: globals.css
          steps these from `card-face-sm` (44x64, where the portrait is
          illegible) up to the md footprint at >=1024px without CardFace
          needing to know what a breakpoint is. The class is also what makes
          the cards inert during a selection — a revealed opponent card is
          click-to-preview, and a preview opening on top of a target pick is
          two answers to one tap. */}
      {/* `FLIGHT_VARS_RESET` is the inheritance stop, not decoration. The whole
          seat is a flight element — §6's Refuse verb shoves it — and
          `--fx/--fy/--tilt/--fs` inherit, so without a zero declared here every
          card in the seat would read the seat's displacement as its own and
          travel twice as far as the plate it is printed on. See the header of
          CardFace.tsx. */}
      <div
        className={`seat-cards flex gap-2 justify-center ${interactive ? 'pointer-events-none' : ''}`}
        style={FLIGHT_VARS_RESET}
      >
        {player.influences.map((inf, i) => (
          <CardFace key={i} influence={inf} size={isMe ? "md" : "sm"} priority={isMe} />
        ))}
      </div>

      {/* §6.2: the illegal half is the half that answers "why can't I click
          there". A sentence on the seat, not a tooltip — a tooltip does not
          exist on touch. */}
      {illegalReason && (
        <p className="mt-1.5 text-[10px] leading-tight text-coup-ink-mute">{illegalReason}</p>
      )}

      {timerExpiry && (
        <TimerBar timerExpiry={timerExpiry} />
      )}
    </div>
  );
}
