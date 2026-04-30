'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { CoinIcon } from '../icons';

interface CoinChangeBurstProps {
  coins: number;
}

interface BurstState {
  key: number;
  delta: number;
}

export function CoinChangeBurst({ coins }: CoinChangeBurstProps) {
  const prevCoins = useRef(coins);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [burst, setBurst] = useState<BurstState | null>(null);

  useEffect(() => {
    const delta = coins - prevCoins.current;
    prevCoins.current = coins;

    if (delta === 0) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setBurst({ key: Date.now(), delta });
    timeoutRef.current = setTimeout(() => setBurst(null), 950);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [coins]);

  if (!burst) return null;

  const isGain = burst.delta > 0;
  const tokenCount = Math.min(Math.abs(burst.delta), 4);

  return (
    <span key={burst.key} className="coin-change-burst" aria-hidden="true">
      <span className={`coin-change-label ${isGain ? 'text-green-400' : 'text-red-400'}`}>
        {isGain ? `+${burst.delta}` : burst.delta}
      </span>
      {Array.from({ length: tokenCount }, (_, i) => (
        <span
          key={i}
          className={`coin-motion-token ${isGain ? 'coin-motion-gain' : 'coin-motion-loss'}`}
          style={{
            '--coin-delay': `${i * 65}ms`,
            '--coin-offset': `${i * 5}px`,
          } as CSSProperties}
        >
          <CoinIcon size={12} />
        </span>
      ))}
    </span>
  );
}
