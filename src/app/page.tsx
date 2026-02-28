'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './stores/gameStore';
import { CoupLogo } from './components/icons';
import { HowToPlay } from './components/home/HowToPlay';

export default function Home() {
  const router = useRouter();
  const { createRoom, joinRoom } = useSocket();
  const { error, setError, setRoom } = useGameStore();
  const [mode, setMode] = useState<'idle' | 'create' | 'join'>('idle');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    try {
      const result = await createRoom(name.trim());
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!roomCode.trim()) { setError('Enter room code'); return; }
    setLoading(true);
    try {
      const result = await joinRoom(roomCode.trim(), name.trim());
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative background pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 20px,
            currentColor 20px,
            currentColor 21px
          )`,
        }}
      />

      <div className="max-w-md w-full text-center relative">
        <CoupLogo className="w-64 h-auto mx-auto mb-2" />
        <p className="text-gray-400 mb-8">The classic bluffing game</p>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-3 mb-4 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {mode === 'idle' && (
          <div className="space-y-4 animate-fade-in">
            <button className="btn-primary w-full" onClick={() => setMode('create')}>
              Create Room
            </button>
            <button className="btn-secondary w-full" onClick={() => setMode('join')}>
              Join Room
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-gray-600 text-xs">or</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            <button
              className="text-gray-400 hover:text-coup-accent text-sm font-medium transition-colors w-full py-2"
              onClick={() => setShowHowToPlay(true)}
            >
              How to Play
            </button>
          </div>
        )}

        {mode === 'create' && (
          <div className="space-y-4 animate-slide-up">
            <input
              className="input-field"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <button
              className="btn-primary w-full"
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => setMode('idle')}
            >
              Back
            </button>
          </div>
        )}

        {mode === 'join' && (
          <div className="space-y-4 animate-slide-up">
            <input
              className="input-field"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />
            <input
              className="input-field uppercase"
              placeholder="Room code"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
            <button
              className="btn-primary w-full"
              onClick={handleJoin}
              disabled={loading}
            >
              {loading ? 'Joining...' : 'Join Room'}
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => setMode('idle')}
            >
              Back
            </button>
          </div>
        )}

        <div className="mt-12 text-gray-600 text-xs">
          <p>2-6 players. Bluff, challenge, eliminate.</p>
        </div>
      </div>

      <HowToPlay open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
    </div>
  );
}
