'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './stores/gameStore';
import { CoupLogo } from './components/icons';
import { HowToPlay } from './components/home/HowToPlay';
import { SettingsModal } from './components/settings/SettingsModal';
import { MAX_PLAYERS } from '@/shared/constants';
import { haptic } from './utils/haptic';

export default function Home() {
  const router = useRouter();
  const { createRoom, joinRoom, subscribeToBrowser, unsubscribeFromBrowser } = useSocket();
  const { error, setError, setRoom, publicRooms, playersOnline, gamesInProgress } = useGameStore();
  const [mode, setMode] = useState<'idle' | 'create' | 'join' | 'browse'>('idle');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    subscribeToBrowser();
    return () => {
      unsubscribeFromBrowser();
    };
  }, [subscribeToBrowser, unsubscribeFromBrowser]);

  const handleCreate = async () => {
    haptic(80);
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
    haptic(80);
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
    haptic(80);
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
      <h1 className="sr-only">Coup Online — Free Multiplayer Bluffing Card Game</h1>

      {/* Settings gear */}
      <button
        onClick={() => { haptic(); setShowSettings(true); }}
        className="absolute top-4 right-4 w-9 h-9 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition flex items-center justify-center z-10"
        title="Settings"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5">
          <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
        </svg>
      </button>

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
        <p className="text-gray-400 mb-2">The classic bluffing game</p>
        <p className="text-gray-500 text-sm mb-8">
          {playersOnline} player{playersOnline !== 1 ? 's' : ''} online · {gamesInProgress} game{gamesInProgress !== 1 ? 's' : ''} in progress
        </p>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-3 mb-4 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {mode === 'idle' && (
          <div className="space-y-4 animate-fade-in">
            <button className="btn-primary w-full" onClick={() => { haptic(); setMode('create'); }}>
              Create Room
            </button>
            <button className="btn-secondary w-full" onClick={() => { haptic(); setMode('join'); }}>
              Join Room
            </button>
            <button className="btn-secondary w-full" onClick={() => { haptic(); setMode('browse'); }}>
              Browse Public Games
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-gray-600 text-xs">or</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            <button
              className="text-gray-400 hover:text-coup-accent text-sm font-medium transition-colors w-full py-2"
              onClick={() => { haptic(); setShowHowToPlay(true); }}
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
                onClick={() => { haptic(); setIsPublic(!isPublic); }}
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
              onClick={() => { haptic(); setMode('idle'); }}
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
              onClick={() => { haptic(); setMode('idle'); }}
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
              onClick={() => { haptic(); setMode('idle'); }}
            >
              Back
            </button>
          </div>
        )}

        <div className="mt-12 flex items-center justify-center gap-3 text-gray-600 text-xs">
          <p>2-6 players. Bluff, challenge, eliminate.</p>
          <span className="text-gray-700">·</span>
          <a
            href="https://github.com/8tp/Coup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-gray-300 transition-colors"
            aria-label="View source on GitHub"
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </div>
      </div>

      <HowToPlay open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
