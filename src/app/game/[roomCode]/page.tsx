'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { GameTable } from '../../components/game/GameTable';
import { getSoundEngine } from '../../audio/SoundEngine';

export default function GamePage() {
  const router = useRouter();
  const { sendChat, sendReaction, rematch, stopSpectating } = useSocket();

  const { gameState, chatMessages, playerId, hostId, error, isSpectator } = useGameStore();

  const isHost = !isSpectator && playerId === hostId;

  // Unlock AudioContext on first user gesture (required for mobile Safari)
  useEffect(() => {
    const unlock = () => getSoundEngine().unlock();
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
    };
  }, []);

  // Redirect when game state is cleared (rematch → lobby) or missing
  useEffect(() => {
    if (!gameState) {
      // Small delay to allow state to load (reconnection)
      const timer = setTimeout(() => {
        const current = useGameStore.getState();
        if (!current.gameState) {
          if (current.isSpectator) {
            // Spectator: game ended, go home
            current.clearRoom();
            router.push('/');
          } else if (current.roomCode) {
            // Rematch: sent back to lobby
            router.push(`/lobby/${current.roomCode}`);
          } else {
            router.push('/');
          }
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
      <GameTable
        gameState={gameState}
        chatMessages={chatMessages}
        onSendChat={isSpectator ? () => {} : sendChat}
        onSendReaction={sendReaction}
        isHost={isHost}
        onRematch={rematch}
        isSpectator={isSpectator}
        onStopSpectating={isSpectator ? () => {
          stopSpectating();
          useGameStore.getState().clearRoom();
          router.push('/');
        } : undefined}
      />
    </>
  );
}
