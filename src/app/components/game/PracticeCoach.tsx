'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClientGameState } from '@/shared/types';
import { getPracticeCoachTip, type PracticeCoachTone } from '../../utils/practiceCoach';
import { haptic } from '../../utils/haptic';

interface PracticeCoachProps {
  gameState: ClientGameState;
  onOpenRules: () => void;
}

const HIDDEN_KEY = 'coup_practice_coach_hidden';

const TONE_CLASSES: Record<PracticeCoachTone, string> = {
  gold: 'bg-amber-950/85 text-coup-accent',
  blue: 'bg-blue-950/85 text-blue-300',
  red: 'bg-red-950/90 text-red-300',
  green: 'bg-emerald-950/85 text-emerald-300',
};

export function PracticeCoach({ gameState, onOpenRules }: PracticeCoachProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    setHidden(sessionStorage.getItem(HIDDEN_KEY) === 'true');
  }, []);

  const tip = useMemo(() => getPracticeCoachTip(gameState), [gameState]);

  if (hidden !== false || !tip || dismissedIds.has(tip.id)) return null;

  const dismissTip = () => {
    haptic();
    setDismissedIds(previous => new Set(previous).add(tip.id));
  };

  const hideCoach = () => {
    haptic();
    sessionStorage.setItem(HIDDEN_KEY, 'true');
    setHidden(true);
  };

  return (
    <aside
      key={tip.id}
      className={`practice-coach panel-sunk px-3 py-2.5 ${TONE_CLASSES[tip.tone]}`}
      aria-label="Practice coach"
    >
      <div className="flex items-start gap-2.5">
        <div className="practice-coach-mark mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/40 bg-black/20 text-sm font-black">
          C
        </div>
        <div className="min-w-0 flex-1" role="status" aria-live="polite">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] opacity-80">Coach · {tip.label}</span>
            <button
              type="button"
              className="ml-auto shrink-0 text-[10px] font-medium text-gray-400 underline decoration-gray-600 underline-offset-2 hover:text-white"
              onClick={hideCoach}
            >
              Hide tips
            </button>
          </div>
          <p className="mt-0.5 text-sm font-bold leading-tight text-white">{tip.title}</p>
          <p className="mt-1 text-xs leading-snug text-gray-300">{tip.body}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-current/40 bg-black/[0.15] px-3 py-1 text-[11px] font-bold hover:bg-black/30"
              onClick={dismissTip}
            >
              Got it
            </button>
            <button
              type="button"
              className="text-[11px] font-medium text-gray-300 underline decoration-gray-600 underline-offset-2 hover:text-white"
              onClick={() => { haptic(); onOpenRules(); }}
            >
              Check the rules
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
