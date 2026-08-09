'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { GameTable } from '../../components/game/GameTable';
import { getSoundEngine } from '../../audio/SoundEngine';

export default function GamePage() {
  const router = useRouter();
  const { sendChat, sendReaction, rematch, stopSpectating, leaveRoom } = useSocket();

  const { gameState, chatMessages, playerId, hostId, error, isSpectator } = useGameStore();
  const [isPracticeRoom, setIsPracticeRoom] = useState(false);

  const isHost = !isSpectator && playerId === hostId;

  const clearPracticeSession = useCallback(() => {
    sessionStorage.removeItem('coup_practice_room');
    sessionStorage.removeItem('coup_room');
    sessionStorage.removeItem('coup_player');
    sessionStorage.removeItem('coup_session_token');
    sessionStorage.removeItem('coup_spectator');
    sessionStorage.removeItem('coup_player_name');
    useGameStore.getState().clearRoom();
  }, []);

  useEffect(() => {
    setIsPracticeRoom(sessionStorage.getItem('coup_practice_room') === 'true');
  }, []);

  // Unlock AudioContext on first user gesture (required for mobile Safari)
  useEffect(() => {
    const sound = getSoundEngine();
    const unlock = () => sound.unlock();
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    return () => {
      document.removeEventListener('click', unlock);
      document.removeEventListener('touchstart', unlock);
      sound.stopMusic();
    };
  }, []);

  // Redirect when game state is cleared (rematch -> lobby) or missing
  useEffect(() => {
    if (!gameState) {
      // Small delay to allow state to load (reconnection)
      const timer = setTimeout(() => {
        const current = useGameStore.getState();
        if (!current.gameState) {
          const isPracticeSession = sessionStorage.getItem('coup_practice_room') === 'true';
          if (current.isSpectator) {
            // Spectator: game ended, go home
            current.clearRoom();
            router.push('/');
          } else if (isPracticeSession) {
            // Practice games are disposable and should not return to a lobby.
            clearPracticeSession();
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
  }, [clearPracticeSession, gameState, router]);

  const handleExitPractice = useCallback(() => {
    leaveRoom();
    clearPracticeSession();
    router.push('/');
  }, [clearPracticeSession, leaveRoom, router]);

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
          bg-red-900/90 panel-sunk px-4 py-2 text-sm animate-fade-in">
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
        isPracticeRoom={isPracticeRoom}
        onExitPractice={handleExitPractice}
        onStopSpectating={isSpectator ? () => {
          stopSpectating();
          useGameStore.getState().clearRoom();
          router.push('/');
        } : undefined}
      />
    </>
  );
}
