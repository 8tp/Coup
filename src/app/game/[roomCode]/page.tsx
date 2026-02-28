'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { GameTable } from '../../components/game/GameTable';

export default function GamePage() {
  const router = useRouter();
  useSocket(); // Keep socket connected

  const { gameState, error } = useGameStore();

  // Redirect to home if no game state
  useEffect(() => {
    if (!gameState) {
      // Small delay to allow state to load (reconnection)
      const timer = setTimeout(() => {
        if (!useGameStore.getState().gameState) {
          router.push('/');
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [gameState, router]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Connecting...</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50
          bg-red-900/90 border border-red-600 rounded-xl px-4 py-2 text-sm animate-fade-in">
          {error}
        </div>
      )}
      <GameTable gameState={gameState} />
    </>
  );
}
