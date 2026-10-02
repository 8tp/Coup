'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientGameState } from '@/shared/types';
import { fly, cancel as cancelFlight, useIsomorphicLayoutEffect, FLIGHT_TRANSFORM_STYLE } from '../../../anim';
import { fxSeatPoint, type Point } from '../../../hooks/useFxCues';

/** A pool of coins, or a player by id. */
export type CoinEnd = 'treasury' | 'reserve' | { playerId: string };

export interface CoinTransfer {
  from: CoinEnd;
  to: CoinEnd;
  amount: number;
}

export interface CoinSnap {
  treasury: number;
  reserve: number;
  coins: ReadonlyMap<string, number>;
}

export function coinSnap(state: Pick<ClientGameState, 'treasury' | 'treasuryReserve' | 'players'>): CoinSnap {
  return {
    treasury: state.treasury,
    reserve: state.treasuryReserve,
    coins: new Map(state.players.map(p => [p.id, p.coins])),
  };
}

/**
 * Where the coins went between two states.
 *
 * The wire carries balances, not movements, so movements are inferred. When
 * neither pool moved, every coin a player gained came from another player —
 * a Steal — and gainers are paired with losers of the same amount. Otherwise
 * gains come out of whichever pool shrank and losses go into whichever grew;
 * the reserve is only named when it is the pool that moved.
 */
export function coinTransfers(prev: CoinSnap, next: CoinSnap): CoinTransfer[] {
  const gains: { id: string; n: number }[] = [];
  const losses: { id: string; n: number }[] = [];
  for (const [id, coins] of next.coins) {
    const before = prev.coins.get(id);
    if (before === undefined) continue;
    const d = coins - before;
    if (d > 0) gains.push({ id, n: d });
    else if (d < 0) losses.push({ id, n: -d });
  }
  if (gains.length === 0 && losses.length === 0) return [];

  const out: CoinTransfer[] = [];
  const dT = next.treasury - prev.treasury;
  const dR = next.reserve - prev.reserve;

  if (dT === 0 && dR === 0) {
    for (const g of gains) {
      const i = losses.findIndex(l => l.n === g.n);
      if (i < 0) continue;
      const [l] = losses.splice(i, 1);
      out.push({ from: { playerId: l.id }, to: { playerId: g.id }, amount: g.n });
    }
    return out;
  }

  const source: CoinEnd = dR < 0 ? 'reserve' : 'treasury';
  const sink: CoinEnd = dR > 0 ? 'reserve' : 'treasury';
  for (const g of gains) out.push({ from: source, to: { playerId: g.id }, amount: g.n });
  for (const l of losses) out.push({ from: { playerId: l.id }, to: sink, amount: l.n });
  return out;
}

const COIN_PX = 18;
/** Never throw more than this many discs for one transfer: a 7-coin Coup is a handful, not a fountain. */
const MAX_DISCS = 5;
const STAGGER_MS = 55;

function pointOf(end: CoinEnd): Point | null {
  if (typeof end === 'object') return fxSeatPoint(end.playerId);
  const el = document.querySelector(`[data-coin-pool="${end}"] .coin-well`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

interface Disc {
  id: number;
  at: Point;
  dx: number;
  dy: number;
  delay: number;
  key: string;
}

function CoinDisc({ disc, onDone }: { disc: Disc; onDone: (id: number) => void }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) { onDone(disc.id); return; }
    let settled = false;
    const done = () => { if (!settled) { settled = true; onDone(disc.id); } };
    const started = fly(el, {
      dx: disc.dx,
      dy: disc.dy,
      delay: disc.delay,
      spin: 160,
      bump: 0.25,
      key: disc.key,
      land: done,
      abort: done,
    });
    if (!started) done();
    const ceiling = setTimeout(() => { cancelFlight(el); done(); }, 1400);
    return () => {
      clearTimeout(ceiling);
      settled = true;
      cancelFlight(el);
    };
  }, [disc, onDone]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="coin-flight"
      style={{
        left: disc.at.x - COIN_PX / 2,
        top: disc.at.y - COIN_PX / 2,
        width: COIN_PX,
        height: COIN_PX,
        ...FLIGHT_TRANSFORM_STYLE,
      }}
    />
  );
}

/**
 * Coins thrown across the table whenever a balance changes: out of the
 * treasury on Income, Foreign Aid and Tax, back into it to pay for a Coup or
 * an Assassination, and from seat to seat on a Steal. Each disc lands on the
 * element the balance belongs to, so the number that ticks is the number the
 * coins arrived at.
 */
export function CoinFlights({ gameState }: { gameState: ClientGameState }) {
  const prevRef = useRef<CoinSnap | null>(null);
  const idRef = useRef(0);
  const [discs, setDiscs] = useState<Disc[]>([]);

  useEffect(() => {
    const next = coinSnap(gameState);
    const prev = prevRef.current;
    prevRef.current = next;
    if (!prev) return;

    const spawned: Disc[] = [];
    for (const t of coinTransfers(prev, next)) {
      const from = pointOf(t.from);
      const to = pointOf(t.to);
      if (!from || !to) continue;
      const n = Math.min(t.amount, MAX_DISCS);
      for (let i = 0; i < n; i++) {
        idRef.current += 1;
        spawned.push({
          id: idRef.current,
          at: to,
          dx: from.x - to.x + (i - (n - 1) / 2) * 4,
          dy: from.y - to.y,
          delay: i * STAGGER_MS,
          key: `${idRef.current}`,
        });
      }
    }
    if (spawned.length) setDiscs(d => [...d, ...spawned]);
  }, [gameState]);

  const remove = useCallback((id: number) => setDiscs(d => d.filter(x => x.id !== id)), []);

  return <>{discs.map(d => <CoinDisc key={d.id} disc={d} onDone={remove} />)}</>;
}
