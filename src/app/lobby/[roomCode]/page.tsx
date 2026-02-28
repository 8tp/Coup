'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { MIN_PLAYERS, MAX_PLAYERS } from '@/shared/constants';
import { GameStatus } from '@/shared/types';

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;
  const { startGame, leaveRoom } = useSocket();
  const {
    playerId,
    hostId,
    roomPlayers,
    gameState,
    error,
  } = useGameStore();

  const isHost = playerId === hostId;
  const canStart = roomPlayers.length >= MIN_PLAYERS && roomPlayers.length <= MAX_PLAYERS;

  // Navigate to game when it starts
  useEffect(() => {
    if (gameState && gameState.status !== GameStatus.Lobby) {
      router.push(`/game/${roomCode}`);
    }
  }, [gameState, roomCode, router]);

  const handleLeave = () => {
    leaveRoom();
    useGameStore.getState().clearRoom();
    router.push('/');
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Room Code */}
        <div className="text-center mb-8">
          <p className="text-gray-400 text-sm mb-1">Room Code</p>
          <button
            className="text-4xl font-bold tracking-widest text-coup-accent hover:opacity-80 transition"
            onClick={copyRoomCode}
          >
            {roomCode}
          </button>
          <p className="text-gray-600 text-xs mt-1">Tap to copy</p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-3 mb-4 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Player List */}
        <div className="card-container mb-6">
          <h2 className="font-bold text-gray-400 text-sm uppercase mb-3">
            Players ({roomPlayers.length}/{MAX_PLAYERS})
          </h2>
          <div className="space-y-2">
            {roomPlayers.map(p => (
              <div
                key={p.id}
                className="flex items-center justify-between py-2 px-3 bg-coup-bg rounded-lg"
              >
                <span className={`font-medium ${p.id === playerId ? 'text-coup-accent' : ''}`}>
                  {p.name}
                  {p.id === playerId && ' (You)'}
                </span>
                <div className="flex items-center gap-2">
                  {p.id === hostId && (
                    <span className="text-xs bg-coup-accent text-coup-bg px-2 py-0.5 rounded-full font-bold">
                      HOST
                    </span>
                  )}
                  <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="space-y-3">
          {isHost && (
            <button
              className="btn-primary w-full"
              disabled={!canStart}
              onClick={startGame}
            >
              {canStart
                ? `Start Game (${roomPlayers.length} players)`
                : `Need ${MIN_PLAYERS}+ players`
              }
            </button>
          )}
          {!isHost && (
            <p className="text-center text-gray-400">
              Waiting for host to start...
            </p>
          )}
          <button className="btn-secondary w-full" onClick={handleLeave}>
            Leave Room
          </button>
        </div>
      </div>
    </div>
  );
}
