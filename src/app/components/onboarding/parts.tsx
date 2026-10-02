'use client';

import type { ReactNode } from 'react';
import { Character, ClientInfluence, ClientPlayerState, Faction } from '@/shared/types';
import { CardFace, FLIGHT_VARS_RESET } from '../game/CardFace';
import { CoinChangeBurst } from '../game/CoinChangeBurst';
import { PlayerSeat } from '../game/PlayerSeat';
import { CoinIcon } from '../icons';
import { useMediaQuery } from '../../hooks/useMediaQuery';

/**
 * The pieces a walkthrough is built from — the real game's own components
 * (CardFace, PlayerSeat, the hand plate, the felt) played from a script, so
 * the tutorial teaches the objects a new player will actually see.
 */

/** A face-down card. */
export const HIDDEN: ClientInfluence = { character: null, revealed: false };
export const shown = (character: Character): ClientInfluence => ({ character, revealed: false });
export const lost = (character: Character): ClientInfluence => ({ character, revealed: true });

/** Card size for the player's own hand: big on a desktop stage, smaller on a short phone. */
export function useHandCardSize(compact = false): 'sm' | 'md' | 'lg' | 'xl' {
  const desktop = useMediaQuery('(min-width: 768px) and (min-height: 600px)');
  const tallPhone = useMediaQuery('(min-height: 760px)');
  if (compact) return desktop ? 'lg' : tallPhone ? 'md' : 'sm';
  if (desktop) return 'xl';
  return tallPhone ? 'lg' : 'md';
}

/** One chapter: the words on one side, the demonstration on the other. */
export function ChapterLayout({
  kicker,
  title,
  lede,
  demo,
  note,
  noteTone = 'info',
}: {
  kicker: string;
  title: string;
  lede: ReactNode;
  demo: ReactNode;
  note?: ReactNode;
  noteTone?: 'info' | 'danger' | 'done';
}) {
  return (
    <>
      <div className="onb-text">
        <p className="onb-kicker">{kicker}</p>
        <h3 className="onb-title type-display">{title}</h3>
        <p className="onb-lede">{lede}</p>
      </div>
      <div className="onb-demo">{demo}</div>
      <p className={`onb-note is-${noteTone}`} role="status" aria-live="polite">{note}</p>
    </>
  );
}

/** The court table in miniature: oxblood enamel, a brass inlay, the felt. */
export function Felt({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className="onb-table">
      <div className={`onb-felt ${className}`}>{children}</div>
    </div>
  );
}

/** Your hand, on the same plate the court table puts it on. */
export function HandPlate({
  influences,
  coins,
  label = 'You',
  compact = false,
  out = false,
}: {
  influences: ClientInfluence[];
  coins?: number;
  label?: string;
  /** A supporting hand (the demo is about someone else): one size down. */
  compact?: boolean;
  out?: boolean;
}) {
  const size = useHandCardSize(compact);
  return (
    <div className={`court-hand-plate onb-hand ${out ? 'is-out' : ''}`}>
      <div className="onb-hand-cards" style={FLIGHT_VARS_RESET}>
        {influences.map((influence, i) => (
          <CardFace key={i} influence={influence} size={size} disablePreview />
        ))}
      </div>
      <div className="court-hand-meta">
        <span className="court-hand-name type-display">{label}</span>
        {coins !== undefined && (
          <span className="court-hand-coins figure" aria-label={`${coins} coins`}>
            <CoinIcon size={18} />
            {coins}
            <CoinChangeBurst coins={coins} />
          </span>
        )}
      </div>
      {out && <span className="onb-stamp type-display">Out</span>}
    </div>
  );
}

/** An opponent's seat — the real PlayerSeat, fed a scripted player. */
export function DemoSeat({
  name,
  influences,
  coins,
  isTarget = false,
  isTurn = false,
  faction,
  id,
}: {
  name: string;
  influences: ClientInfluence[];
  coins: number;
  isTarget?: boolean;
  isTurn?: boolean;
  faction?: Faction;
  id?: string;
}) {
  const player: ClientPlayerState = {
    id: id ?? `tutorial-${name.toLowerCase()}`,
    name,
    coins,
    influences,
    isAlive: influences.some(i => !i.revealed),
    seatIndex: 1,
    faction,
  };
  return (
    <div className="onb-seat">
      <PlayerSeat player={player} isCurrentTurn={isTurn} isMe={false} isTarget={isTarget} cardPreview={false} />
    </div>
  );
}
