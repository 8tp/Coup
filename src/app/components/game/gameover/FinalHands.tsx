'use client';

import type { ClientGameState, ClientInfluence, ClientPlayerState } from '@/shared/types';
import { CrownGlyph } from '../../icons';
import { CardFace } from '../CardFace';
import { eliminationTurns, playersInFinishingOrder } from './summary';

const HIDDEN: ClientInfluence = { character: null, revealed: false };

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function HandCard({ influence, size, faceDown }: { influence: ClientInfluence; size: 'sm' | 'md'; faceDown: boolean }) {
  const shown = faceDown || !influence.character ? HIDDEN : influence;
  return (
    <span className={`gameover-card ${shown.revealed ? 'is-lost' : ''}`}>
      <CardFace influence={shown} size={size} />
    </span>
  );
}

interface FinalHandsProps {
  gameState: ClientGameState;
  /** Wins per player id this session, from the room roster. */
  winsById: Map<string, number>;
  /** False during the opening beat: only the winner's hand is face up. */
  showFaces: boolean;
  headingId: string;
}

export function FinalHands({ gameState, winsById, showFaces, headingId }: FinalHandsProps) {
  const outTurns = eliminationTurns(gameState);
  const players = playersInFinishingOrder(gameState);

  const meta = (p: ClientPlayerState, isWinner: boolean) => {
    const bits: string[] = [];
    if (isWinner) bits.push(`${plural(p.coins, 'coin')} left`);
    else if (outTurns.has(p.id)) bits.push(`Out on turn ${outTurns.get(p.id)}`);
    const wins = winsById.get(p.id) ?? 0;
    if (wins > 0) bits.push(plural(wins, 'win'));
    return bits.join(' · ');
  };

  return (
    <section aria-labelledby={headingId} className="gameover-section">
      <div className="gameover-section-head">
        <h2 id={headingId} className="gameover-heading">Final hands</h2>
        <span className="gameover-key" aria-hidden="true">
          <span className="gameover-key-swatch" />
          Lost card
        </span>
      </div>
      <ol className="gameover-hands">
        {players.map(p => {
          const isWinner = p.id === gameState.winnerId;
          const name = p.id === gameState.myId ? 'You' : p.name;
          const facesUp = isWinner || showFaces;
          const line = meta(p, isWinner);
          return (
            <li key={p.id} className={`gameover-hand ${isWinner ? 'is-winner' : ''}`}>
              <span className="gameover-hand-mark" aria-hidden="true">
                {isWinner && <CrownGlyph size={20} />}
              </span>
              <span className="gameover-hand-who">
                <span className="gameover-hand-name" title={p.name}>
                  {isWinner && <span className="sr-only">Winner: </span>}
                  {name}
                </span>
                {line && <span className="gameover-hand-meta">{line}</span>}
              </span>
              <span className="gameover-hand-cards">
                {p.influences.map((inf, i) => (
                  <HandCard key={i} influence={inf} size={isWinner ? 'md' : 'sm'} faceDown={!facesUp} />
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
