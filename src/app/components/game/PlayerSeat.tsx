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
  /** Tap a known card to preview it. Off for scripted seats (the tutorial). */
  cardPreview?: boolean;
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

  return (
    <div className="court-seat-timer" data-low={percent <= 33 ? 'true' : undefined}>
      <div style={{ width: `${percent}%` }} />
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
  cardPreview = true,
}: PlayerSeatProps) {
  const mutedPlayerIds = useGameStore(s => s.mutedPlayerIds);
  const toggleMutedPlayer = useGameStore(s => s.toggleMutedPlayer);
  const isMuted = mutedPlayerIds.includes(player.id);

  /* A seat in a selection is a control, so it gets a control's affordances —
     including the illegal ones. A seat that cannot be chosen still answers the
     tap (the ActionBar's `refuse()` fires through `onSelect`), so it stays
     reachable by keyboard; `aria-disabled` says "refused", where `disabled`
     would say "not here". */
  const interactive = !!onSelect;
  const activate = () => { if (onSelect) onSelect(); };

  const stateClasses = [
    'court-seat',
    isCurrentTurn ? 'is-turn' : '',
    !player.isAlive ? 'is-out' : '',
    isTarget ? 'is-target' : '',
    selectable ? 'is-selectable' : '',
    illegalReason ? 'is-illegal' : '',
    isMe ? 'is-me' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={stateClasses}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-disabled={illegalReason ? true : undefined}
      aria-label={interactive
        ? (illegalReason ? `${player.name}: ${illegalReason}` : `Choose ${player.name}`)
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
      {/* The cards lie on the felt in front of the player, fanned. `seat-cards`
          is also what makes them inert during a selection — a revealed card is
          click-to-preview, and a preview opening on top of a target pick is two
          answers to one tap. `FLIGHT_VARS_RESET` stops the seat's own shove
          displacement inheriting into the cards (see CardFace.tsx). */}
      <div
        className={`seat-cards court-seat-cards ${interactive ? 'pointer-events-none' : ''}`}
        style={FLIGHT_VARS_RESET}
      >
        {player.influences.map((inf, i) => (
          <span key={i} className="seat-card-slot">
            <CardFace influence={inf} size={isMe ? 'md' : 'sm'} priority={isMe} disablePreview={!cardPreview} />
          </span>
        ))}
      </div>

      <div className="court-seat-plate">
        <span className="court-seat-name type-display">{player.name}</span>
        {player.isBot && <span className="court-seat-tag">BOT</span>}
        {player.faction && (
          <span className="court-seat-tag" title={player.faction}>
            {player.faction === Faction.Loyalist ? '▲ LOY' : '◆ REF'}
          </span>
        )}
        <span className="court-seat-coins figure">
          <CoinIcon size={13} />
          {player.coins}
          <CoinChangeBurst coins={player.coins} />
        </span>
        {timerExpiry && <TimerBar timerExpiry={timerExpiry} />}
      </div>

      {!isMe && (
        <button
          type="button"
          aria-label={isMuted ? `Unmute ${player.name}` : `Mute chat and reactions from ${player.name}`}
          aria-pressed={isMuted}
          title={isMuted ? `Unmute ${player.name}` : `Mute ${player.name}`}
          className={`court-seat-mute ${isMuted ? 'is-muted' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            toggleMutedPlayer(player.id);
          }}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3" aria-hidden="true">
            <path d="M4 8.5a1 1 0 011-1h2.1l3.2-2.7A1 1 0 0112 5.6v8.8a1 1 0 01-1.7.7l-3.2-2.6H5a1 1 0 01-1-1v-3z" />
            <path d="M14.2 7.2a.8.8 0 011.1 0L16.5 8.4l1.2-1.2a.8.8 0 111.1 1.1L17.6 9.5l1.2 1.2a.8.8 0 11-1.1 1.1l-1.2-1.2-1.2 1.2a.8.8 0 01-1.1-1.1l1.2-1.2-1.2-1.2a.8.8 0 010-1.1z" />
          </svg>
        </button>
      )}

      {/* The illegal half answers "why can't I click there" — a sentence on
          the seat, not a tooltip, because a tooltip does not exist on touch. */}
      {illegalReason && <p className="court-seat-reason">{illegalReason}</p>}
    </div>
  );
}
