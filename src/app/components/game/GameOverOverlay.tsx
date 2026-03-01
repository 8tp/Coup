'use client';

import { useMemo } from 'react';
import { ClientGameState, ClientInfluence, TurnPhase } from '@/shared/types';
import { useGameStore } from '../../stores/gameStore';
import { computeAwards, getWinnerFlavorText, getLoserFlavorText } from '../../utils/gameStats';
import { haptic } from '../../utils/haptic';
import { CardFace } from './CardFace';

function ResultCard({ influence }: { influence: ClientInfluence }) {
  if (!influence.character) return null;
  return <CardFace influence={influence} size="sm" />;
}

interface GameOverOverlayProps {
  gameState: ClientGameState;
  isHost: boolean;
  onRematch: () => void;
}

export function GameOverOverlay({ gameState, isHost, onRematch }: GameOverOverlayProps) {
  const challengeReveal = useGameStore(s => s.challengeReveal);
  const roomPlayers = useGameStore(s => s.roomPlayers);
  const awards = useMemo(() => computeAwards(gameState), [gameState]);
  const winnerFlavor = useMemo(() => getWinnerFlavorText(gameState), [gameState]);
  const loserFlavor = useMemo(() => getLoserFlavorText(gameState), [gameState]);

  // Wait for any challenge reveal animation to finish before showing
  if (gameState.turnPhase !== TurnPhase.GameOver || challengeReveal) return null;

  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const isMe = winner?.id === gameState.myId;

  // Sort: winner first, then alive, then eliminated
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.id === gameState.winnerId) return -1;
    if (b.id === gameState.winnerId) return 1;
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in p-4">
      <div className="bg-coup-surface rounded-2xl border border-gray-700 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center pt-8 pb-4 px-6">
          <div className="text-5xl mb-3">{isMe ? '🏆' : '💀'}</div>
          <h1 className="text-3xl font-bold mb-1">
            {isMe ? 'You Win!' : `${winner?.name} Wins!`}
          </h1>
          <p className="text-coup-accent text-sm">
            {isMe ? winnerFlavor : loserFlavor}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {gameState.turnNumber} turns
          </p>
        </div>

        {/* Player results */}
        <div className="px-4 pb-4">
          <div className="bg-coup-bg/60 rounded-xl border border-gray-800 divide-y divide-gray-800">
            {sortedPlayers.map(p => {
              const isWinner = p.id === gameState.winnerId;
              const wins = roomPlayers.find(rp => rp.id === p.id)?.wins ?? 0;
              return (
                <div
                  key={p.id}
                  className={`flex items-center px-3 py-2.5 gap-3 ${
                    isWinner ? 'bg-coup-accent/5' : ''
                  }`}
                >
                  {/* Place indicator */}
                  <span className="text-sm w-5 text-center flex-none">
                    {isWinner ? '👑' : !p.isAlive ? '💀' : ''}
                  </span>

                  {/* Name + win count */}
                  <span className={`text-sm font-medium flex-1 min-w-0 truncate ${
                    isWinner ? 'text-coup-accent' : p.isAlive ? 'text-gray-300' : 'text-gray-500'
                  }`}>
                    {p.id === gameState.myId ? 'You' : p.name}
                    {wins > 0 && (
                      <span className="ml-1.5 text-xs bg-yellow-600 text-white px-1.5 py-0.5 rounded-full font-bold align-middle">
                        {wins} {wins === 1 ? 'win' : 'wins'}
                      </span>
                    )}
                  </span>

                  {/* Cards */}
                  <div className="flex gap-1.5 flex-none">
                    {p.influences.map((inf, i) => (
                      <ResultCard key={i} influence={inf} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Awards */}
        {awards.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-center text-xs text-gray-500 uppercase tracking-wider mb-2">Awards</p>
            <div className="bg-coup-bg/60 rounded-xl border border-gray-800 divide-y divide-gray-800">
              {awards.map((award, i) => (
                <div key={i} className="px-3 py-2.5 flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5">{award.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-200">{award.title}</p>
                    <p className="text-xs"><span className="text-gray-300 font-medium">{award.playerName}</span><span className="text-gray-500"> · {award.description}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        <div className="px-6 pb-6">
          {isHost ? (
            <button className="btn-primary w-full" onClick={() => { haptic(80); onRematch(); }}>
              Play Again
            </button>
          ) : (
            <p className="text-gray-500 text-sm text-center">
              Waiting for host to start rematch...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
