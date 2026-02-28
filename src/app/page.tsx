'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './stores/gameStore';
import { CoupLogo } from './components/icons';
import { HowToPlay } from './components/home/HowToPlay';
import { MAX_PLAYERS } from '@/shared/constants';

export default function Home() {
  const router = useRouter();
  const { createRoom, joinRoom, subscribeToBrowser, unsubscribeFromBrowser } = useSocket();
  const { error, setError, setRoom, publicRooms } = useGameStore();
  const [mode, setMode] = useState<'idle' | 'create' | 'join' | 'browse'>('idle');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    subscribeToBrowser();
    return () => {
      unsubscribeFromBrowser();
    };
  }, [subscribeToBrowser, unsubscribeFromBrowser]);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    try {
      const result = await createRoom(name.trim(), isPublic);
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

  const handleBrowseJoin = async (code: string) => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    try {
      const result = await joinRoom(code, name.trim());
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const joinableRooms = publicRooms.filter(r => !r.hasGame && r.playerCount < r.maxPlayers);

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
            <button className="btn-secondary w-full" onClick={() => setMode('browse')}>
              Browse Public Games
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
            <label className="flex items-center justify-between px-1 cursor-pointer">
              <span className="text-sm text-gray-300">Public Room</span>
              <button
                type="button"
                role="switch"
                aria-checked={isPublic}
                onClick={() => setIsPublic(!isPublic)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isPublic ? 'bg-coup-accent' : 'bg-gray-600'}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isPublic ? 'translate-x-6' : 'translate-x-1'}`}
                />
              </button>
            </label>
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

        {mode === 'browse' && (
          <div className="space-y-4 animate-slide-up">
            <input
              className="input-field"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              autoFocus
            />

            <div className="card-container text-left">
              <h2 className="font-bold text-gray-400 text-sm uppercase mb-3">
                Public Games
              </h2>

              {joinableRooms.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  No public games available right now.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {joinableRooms.map(room => (
                    <div
                      key={room.code}
                      className="flex items-center justify-between py-2 px-3 bg-coup-bg rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-200 truncate">
                            {room.hostName}&apos;s game
                          </span>
                          <span className="text-xs text-gray-500 font-mono">{room.code}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">
                            {room.playerCount}/{room.maxPlayers} players
                          </span>
                          <span className="text-xs text-gray-600">
                            {room.settings.actionTimerSeconds}s timer
                          </span>
                        </div>
                      </div>
                      <button
                        className="btn-primary text-xs px-3 py-1 ml-2"
                        onClick={() => handleBrowseJoin(room.code)}
                        disabled={loading || room.playerCount >= MAX_PLAYERS}
                      >
                        {room.playerCount >= MAX_PLAYERS ? 'Full' : 'Join'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

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
