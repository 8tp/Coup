'use client';

import { useEffect, useState } from 'react';
import { CHALLENGE_TIMER_MS } from '@/shared/constants';

interface TimerProps {
  expiresAt: number | null;
}

export function Timer({ expiresAt }: TimerProps) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!expiresAt) {
      setRemaining(0);
      return;
    }

    const update = () => {
      const left = Math.max(0, expiresAt - Date.now());
      setRemaining(left);
    };

    update();
    const interval = setInterval(update, 100);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!expiresAt || remaining <= 0) return null;

  const seconds = Math.ceil(remaining / 1000);
  const fraction = remaining / CHALLENGE_TIMER_MS;
  const isLow = seconds <= 5;

  return (
    <div className="flex items-center gap-3 justify-center my-2">
      <div className="w-32 h-2.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-100 ${isLow ? 'bg-red-500' : 'bg-coup-accent'}`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      <span className={`text-sm font-bold w-8 text-right ${isLow ? 'text-red-400' : 'text-gray-300'}`}>
        {seconds}s
      </span>
    </div>
  );
}
