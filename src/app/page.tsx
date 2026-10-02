'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './stores/gameStore';
import { CoupLogo } from './components/icons';
import { HowToPlay } from './components/home/HowToPlay';
import { SettingsModal } from './components/settings/SettingsModal';
import { StatsModal } from './components/stats/StatsModal';
import { Tutorial } from './components/tutorial/Tutorial';
import { PracticeSetupSheet } from './components/onboarding/PracticeSetupSheet';
import { DEFAULT_ROOM_SETTINGS, MAX_PLAYERS, QUICK_PLAY_BOT_COUNT } from '@/shared/constants';
import { GameMode } from '@/shared/types';
import { haptic } from './utils/haptic';
import { loadSavedPlayerName, savePlayerName } from './utils/playerName';
import { buildBots } from './utils/botFill';
import { DEFAULT_PRACTICE_OPTIONS, practiceBots, practiceOptionsForMode, type PracticeOptions } from './utils/practiceSetup';
import { useLobbyMusic } from './hooks/useMusicDirector';

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createRoom, joinRoom, spectateRoom, addBots, startGame, leaveRoom, updateRoomSettings, subscribeToBrowser, unsubscribeFromBrowser } = useSocket();
  const { error, setError, setRoom, clearRoom, publicRooms, playersOnline, gamesInProgress } = useGameStore();
  const joinCode = searchParams.get('join');
  useLobbyMusic();
  const [mode, setMode] = useState<'idle' | 'create' | 'join' | 'browse' | 'quick'>(joinCode ? 'join' : 'idle');
  const [name, setName] = useState('');
  const [roomCode, setRoomCode] = useState(joinCode ?? '');
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPracticeSetup, setShowPracticeSetup] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  // Prefill the name the player used last time
  useEffect(() => {
    const saved = loadSavedPlayerName();
    if (saved) setName(current => current || saved);
  }, []);

  useEffect(() => {
    subscribeToBrowser();
    return () => {
      unsubscribeFromBrowser();
    };
  }, [subscribeToBrowser, unsubscribeFromBrowser]);

  useEffect(() => {
    const removedMessage = sessionStorage.getItem('coup_removed_message');
    if (!removedMessage) return;
    sessionStorage.removeItem('coup_removed_message');
    setError(removedMessage);
  }, [setError]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 3000);
    return () => clearTimeout(timer);
  }, [error, setError]);

  const handleCreate = async () => {
    haptic(80);
    if (!name.trim()) { setError('Enter your name'); return; }
    setLoading(true);
    try {
      const result = await createRoom(name.trim(), isPublic);
      savePlayerName(name);
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
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
      savePlayerName(name);
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
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
      savePlayerName(name);
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSpectate = async (code: string) => {
    haptic(80);
    const spectatorName = name.trim() || 'Spectator';
    setLoading(true);
    try {
      const result = await spectateRoom(code, spectatorName);
      useGameStore.getState().setSpectating(result.roomCode, result.spectatorId);
      router.push(`/game/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  /** A private practice game: a mode alone (Settings) or the full setup sheet's options. */
  const handlePracticeBot = async (input: GameMode | PracticeOptions) => {
    haptic(80);
    const options = typeof input === 'string' ? practiceOptionsForMode(input) : input;
    const { gameMode } = options;
    const practiceName = name.trim() || 'Player';
    // A fresh coach for every practice game: tips, dismissals and first-time
    // history all start over, unless the player switched the coach off.
    for (const key of ['coup_practice_coach_hidden', 'coup_practice_coach_dismissed', 'coup_practice_coach_seen']) {
      sessionStorage.removeItem(key);
    }
    if (!options.coach) sessionStorage.setItem('coup_practice_coach_hidden', 'true');
    setLoading(true);
    let practiceRoomCreated = false;
    try {
      const result = await createRoom(practiceName, false, 'practice');
      practiceRoomCreated = true;
      setRoom(result.roomCode, result.playerId);
      await updateRoomSettings({
        ...DEFAULT_ROOM_SETTINGS,
        gameMode,
        useInquisitor: gameMode === GameMode.Reformation,
      });
      await addBots(practiceBots(options, [practiceName]));
      sessionStorage.setItem('coup_practice_room', 'true');
      startGame();
      router.push(`/game/${result.roomCode}`);
    } catch (e: unknown) {
      if (practiceRoomCreated) {
        leaveRoom();
        clearRoom();
      }
      setError(e instanceof Error ? e.message : 'Could not start practice game');
    } finally {
      setLoading(false);
    }
  };

  /** One click to a running game: private room, random-personality bots, started immediately. */
  const handleQuickPlay = async () => {
    haptic(80);
    if (!name.trim()) {
      // No saved name yet — ask once, then play.
      if (mode !== 'quick') { setMode('quick'); return; }
      setError('Enter your name');
      return;
    }
    setLoading(true);
    let roomCreated = false;
    try {
      const playerName = name.trim();
      const result = await createRoom(playerName, false, 'quick_play');
      roomCreated = true;
      savePlayerName(playerName);
      setRoom(result.roomCode, result.playerId);
      await addBots(buildBots(QUICK_PLAY_BOT_COUNT, [playerName]));
      startGame();
      router.push(`/game/${result.roomCode}`);
    } catch (e: unknown) {
      if (roomCreated) {
        leaveRoom();
        clearRoom();
      }
      setError(e instanceof Error ? e.message : 'Could not start a game');
    } finally {
      setLoading(false);
    }
  };

  const joinableRooms = publicRooms.filter(r => !r.hasGame && r.playerCount < r.maxPlayers);
  const watchableRooms = publicRooms.filter(r => r.hasGame);
  const needName = () => {
    if (name.trim()) return false;
    setError('Enter your name first');
    nameRef.current?.focus();
    return true;
  };

  const roomRow = (room: typeof publicRooms[number], kind: 'join' | 'watch') => (
    <li key={room.code} className="menu-room">
      <div className="min-w-0">
        <p className="menu-room-name">{room.hostName}&apos;s table</p>
        <p className="menu-room-meta">
          <span className="figure">{room.playerCount}/{room.maxPlayers}</span> players
          {kind === 'join' && room.betweenGames && <> · between games</>}
          {kind === 'watch' && room.spectatorCount > 0 && <> · {room.spectatorCount} watching</>}
        </p>
      </div>
      {kind === 'join' ? (
        <button
          className="btn-primary menu-room-btn"
          onClick={() => { if (!needName()) handleBrowseJoin(room.code); }}
          disabled={loading || room.playerCount >= MAX_PLAYERS}
        >
          {room.playerCount >= MAX_PLAYERS ? 'Full' : 'Join'}
        </button>
      ) : (
        <button className="btn-secondary menu-room-btn" onClick={() => handleSpectate(room.code)} disabled={loading}>
          Watch
        </button>
      )}
    </li>
  );

  return (
    <div className="menu-root">
      <h1 className="sr-only">Coup Online: a free multiplayer bluffing card game</h1>

      <div className="menu-topbar">
        <button
          onClick={() => { haptic(); setShowStats(true); }}
          className="court-icon-btn"
          title="My stats"
          aria-label="My stats"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <path d="M2 3a1 1 0 011-1h1a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm5 2a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5zm5-4a1 1 0 011-1h1a1 1 0 011 1v16a1 1 0 01-1 1h-1a1 1 0 01-1-1V1z" />
          </svg>
        </button>
        <button
          onClick={() => { haptic(); setShowSettings(true); }}
          className="court-icon-btn"
          title="Settings"
          aria-label="Settings"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <main className="menu-column">
        <header className="menu-hero">
          <CoupLogo className="brand-wordmark menu-wordmark" />
          <p className="menu-tagline">The bluffing card game, online with friends or bots.</p>
          <p className="menu-presence">
            <span className="menu-presence-dot" aria-hidden="true" />
            <span className="figure">{playersOnline}</span> online · <span className="figure">{gamesInProgress}</span> {gamesInProgress === 1 ? 'game' : 'games'} in play
          </p>
        </header>

        {error && <div className="menu-error" role="alert">{error}</div>}

        {mode !== 'browse' ? (
          <>
            <section className="menu-panel" aria-label="Play">
              <label className="menu-label" htmlFor="player-name">Your name</label>
              <input
                id="player-name"
                ref={nameRef}
                className="input-field"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleQuickPlay(); }}
                maxLength={20}
                autoComplete="nickname"
                enterKeyHint="go"
              />

              <button className="btn-primary menu-play" onClick={() => { if (!needName()) handleQuickPlay(); }} disabled={loading}>
                <span>{loading ? 'Dealing…' : 'Play vs Bots'}</span>
                <span className="menu-play-sub">Starts now · {QUICK_PLAY_BOT_COUNT} opponents</span>
              </button>

              <div className="menu-split">
                <button
                  className={`btn-secondary ${mode === 'create' ? 'is-open' : ''}`}
                  aria-expanded={mode === 'create'}
                  onClick={() => { haptic(); setMode(mode === 'create' ? 'idle' : 'create'); }}
                >
                  Create room
                </button>
                <button
                  className={`btn-secondary ${mode === 'join' ? 'is-open' : ''}`}
                  aria-expanded={mode === 'join'}
                  onClick={() => { haptic(); setMode(mode === 'join' ? 'idle' : 'join'); }}
                >
                  Join room
                </button>
              </div>

              {mode === 'create' && (
                <div className="menu-drawer animate-slide-up">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isPublic}
                    className="menu-switch"
                    onClick={() => { haptic(); setIsPublic(!isPublic); }}
                  >
                    <span className="text-left">
                      <span className="block font-semibold text-coup-ink">Public room</span>
                      <span className="block text-sm text-coup-ink-mute">
                        {isPublic ? 'Listed in Open tables. Anyone can join.' : 'Only people with the code can join.'}
                      </span>
                    </span>
                    <span className={`switch-track ${isPublic ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                  </button>
                  <button className="btn-primary w-full" onClick={() => { if (!needName()) handleCreate(); }} disabled={loading}>
                    {loading ? 'Creating…' : 'Create and invite'}
                  </button>
                </div>
              )}

              {mode === 'join' && (
                <div className="menu-drawer animate-slide-up">
                  <div className="menu-code-row">
                    <input
                      className="input-field menu-code"
                      placeholder="CODE"
                      aria-label="Room code"
                      value={roomCode}
                      onChange={e => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))}
                      onKeyDown={e => { if (e.key === 'Enter' && !needName()) handleJoin(); }}
                      maxLength={4}
                      autoCapitalize="characters"
                      autoComplete="off"
                      enterKeyHint="go"
                      autoFocus
                    />
                    <button className="btn-primary" onClick={() => { if (!needName()) handleJoin(); }} disabled={loading || roomCode.length < 4}>
                      {loading ? 'Joining…' : 'Join'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="menu-section" aria-label="Open tables">
              <div className="menu-section-head">
                <h2 className="menu-section-title">Open tables</h2>
                <button className="menu-link" onClick={() => { haptic(); setMode('browse'); }}>
                  Browse all
                </button>
              </div>
              {joinableRooms.length === 0 ? (
                <p className="menu-empty">No public tables right now. Create one and it shows up here.</p>
              ) : (
                <ul className="menu-rooms">{joinableRooms.slice(0, 3).map(r => roomRow(r, 'join'))}</ul>
              )}
            </section>

            <section className="menu-learn" aria-label="Learn to play">
              <button className="btn-ghost" onClick={() => { haptic(); setShowHowToPlay(true); }}>How to play</button>
              <button className="btn-ghost" onClick={() => { haptic(); setShowTutorial(true); }}>Tutorial</button>
              <button className="btn-ghost" onClick={() => { haptic(); setShowPracticeSetup(true); }} disabled={loading}>Practice</button>
            </section>
          </>
        ) : (
          <section className="menu-panel" aria-label="Open tables">
            <div className="menu-section-head">
              <h2 className="menu-section-title">Open tables</h2>
              <button className="menu-link" onClick={() => { haptic(); setMode('idle'); }}>Back</button>
            </div>
            {!name.trim() && (
              <input
                ref={nameRef}
                className="input-field"
                placeholder="Your name"
                aria-label="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={20}
              />
            )}
            {joinableRooms.length === 0 ? (
              <p className="menu-empty">No public tables right now.</p>
            ) : (
              <ul className="menu-rooms">{joinableRooms.map(r => roomRow(r, 'join'))}</ul>
            )}
            {watchableRooms.length > 0 && (
              <>
                <h2 className="menu-section-title mt-2">Watch live</h2>
                <ul className="menu-rooms">{watchableRooms.map(r => roomRow(r, 'watch'))}</ul>
              </>
            )}
          </section>
        )}

        <footer className="menu-footer">
          <span>2–6 players · free · no sign-up</span>
          <a
            href="https://github.com/8tp/Coup"
            target="_blank"
            rel="noopener noreferrer"
            className="menu-footer-link"
            aria-label="View source on GitHub"
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            Source
          </a>
        </footer>
      </main>

      <HowToPlay open={showHowToPlay} onClose={() => setShowHowToPlay(false)} />
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenTutorial={() => setShowTutorial(true)}
        onPracticeBot={handlePracticeBot}
        practiceLoading={loading}
      />
      <Tutorial
        open={showTutorial}
        onClose={() => setShowTutorial(false)}
        onPlayGuided={() => { setShowTutorial(false); handlePracticeBot(DEFAULT_PRACTICE_OPTIONS); }}
      />
      <PracticeSetupSheet
        open={showPracticeSetup}
        onClose={() => setShowPracticeSetup(false)}
        onStart={(options) => { setShowPracticeSetup(false); handlePracticeBot(options); }}
        loading={loading}
      />
      <StatsModal open={showStats} onClose={() => setShowStats(false)} />
    </div>
  );
}
