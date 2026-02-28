'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { CHARACTER_SVG_ICONS } from '../icons';
import { Character } from '@/shared/types';

const characterColors: Record<Character, string> = {
  [Character.Duke]: 'border-purple-500 bg-purple-900/60',
  [Character.Assassin]: 'border-gray-500 bg-gray-800/60',
  [Character.Captain]: 'border-blue-500 bg-blue-900/60',
  [Character.Ambassador]: 'border-green-500 bg-green-900/60',
  [Character.Contessa]: 'border-red-500 bg-red-900/60',
};

type Phase = 'reveal' | 'card-to-deck' | 'new-card' | 'done';

export function ChallengeRevealOverlay() {
  const challengeReveal = useGameStore(s => s.challengeReveal);
  const setChallengeReveal = useGameStore(s => s.setChallengeReveal);
  const [phase, setPhase] = useState<Phase>('reveal');

  useEffect(() => {
    if (!challengeReveal) {
      setPhase('reveal');
      return;
    }

    // Phase 1: Reveal (0–1.5s)
    setPhase('reveal');

    const t1 = setTimeout(() => {
      setPhase('card-to-deck');
    }, 1500);

    const t2 = setTimeout(() => {
      if (challengeReveal.wasGenuine) {
        setPhase('new-card');
      } else {
        setPhase('done');
      }
    }, 2500);

    const t3 = setTimeout(() => {
      setPhase('done');
    }, challengeReveal.wasGenuine ? 3500 : 2500);

    const tClear = setTimeout(() => {
      setChallengeReveal(null);
    }, challengeReveal.wasGenuine ? 3700 : 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tClear);
    };
  }, [challengeReveal, setChallengeReveal]);

  if (!challengeReveal || phase === 'done') return null;

  const { challengerName, challengedName, character, wasGenuine } = challengeReveal;
  const Icon = CHARACTER_SVG_ICONS[character];
  const cardStyle = characterColors[character];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 animate-fade-in">
      <div className="flex flex-col items-center gap-4">
        {/* Card */}
        {wasGenuine ? (
          <div
            className={`
              w-28 h-40 rounded-xl border-2 flex flex-col items-center justify-center gap-2 shadow-2xl
              ${cardStyle}
              ${phase === 'reveal' ? 'animate-challenge-card-in' : ''}
              ${phase === 'card-to-deck' ? 'animate-challenge-card-out' : ''}
              ${phase === 'new-card' ? 'hidden' : ''}
            `}
          >
            <Icon size={48} />
            <span className="text-white font-bold text-sm">{character}</span>
          </div>
        ) : (
          <div
            className={`
              w-28 h-40 rounded-xl border-2 border-red-500 bg-red-900/40 flex flex-col items-center justify-center gap-2 shadow-2xl
              ${phase === 'reveal' ? 'animate-challenge-card-in' : ''}
              ${phase === 'card-to-deck' ? 'hidden' : ''}
            `}
          >
            <span className="text-red-400 text-4xl font-bold">✗</span>
            <span className="text-red-300 font-bold text-sm">{character}</span>
          </div>
        )}

        {/* New card from deck (phase 3) */}
        {phase === 'new-card' && (
          <div className="w-28 h-40 rounded-xl border-2 border-gray-600 bg-coup-surface flex items-center justify-center shadow-2xl animate-card-from-deck">
            <span className="text-gray-400 text-2xl font-bold">?</span>
          </div>
        )}

        {/* Text */}
        <div className="text-center mt-2">
          {phase === 'reveal' && (
            <>
              <p className="text-white text-lg font-bold">
                {wasGenuine
                  ? <>{challengedName} reveals <span className="text-coup-accent">{character}</span>!</>
                  : <>{challengedName} does not have <span className="text-coup-accent">{character}</span>!</>
                }
              </p>
              <p className={`text-sm font-bold mt-1 ${wasGenuine ? 'text-green-400' : 'text-red-400'}`}>
                {wasGenuine ? 'Challenge fails!' : 'Caught bluffing!'}
              </p>
              <p className="text-gray-400 text-xs mt-1">
                {wasGenuine
                  ? `${challengerName} must lose an influence`
                  : `${challengedName} must lose an influence`}
              </p>
            </>
          )}
          {phase === 'card-to-deck' && (
            <p className="text-gray-400 text-sm animate-fade-in">
              Card returned to the deck...
            </p>
          )}
          {phase === 'new-card' && (
            <p className="text-gray-400 text-sm animate-fade-in">
              New card drawn from the deck.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
