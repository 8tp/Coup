'use client';

import { Suspense, useCallback, useState, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSocket } from './hooks/useSocket';
import { useGameStore } from './stores/gameStore';
import { CoupLogo } from './components/icons';
import { HowToPlay } from './components/home/HowToPlay';
import { LearnSheet } from './components/home/LearnSheet';
import { SettingsModal } from './components/settings/SettingsModal';
import { StatsModal } from './components/stats/StatsModal';
import { Tutorial } from './components/tutorial/Tutorial';
import { PracticeSetupSheet } from './components/onboarding/PracticeSetupSheet';
import {
  DEFAULT_ROOM_SETTINGS,
  HOME_OPEN_TABLES_SHOWN,
  HOME_PRESENCE_MIN_ONLINE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NAME_MAX_CODE_UNITS,
  NAME_MAX_LENGTH,
  QUICK_PLAY_BOT_COUNT,
} from '@/shared/constants';
import { GameMode } from '@/shared/types';
import { haptic } from './utils/haptic';
import { loadSavedPlayerName, savePlayerName } from './utils/playerName';
import { loadOrCreateSuggestedName } from './utils/suggestedName';
import { buildBots } from './utils/botFill';
import { DEFAULT_PRACTICE_OPTIONS, practiceBots, practiceOptionsForMode, type PracticeOptions } from './utils/practiceSetup';
import { useLobbyMusic } from './hooks/useMusicDirector';
import { useT } from './i18n';
import { clampToGraphemes } from '@/shared/textLimits';

/** Figures (counts, seat ratios) in the figure face, inside a translated sentence. */
const fig = (chunks: ReactNode) => <span className="figure">{chunks}</span>;

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createRoom, joinRoom, spectateRoom, addBots, startGame, leaveRoom, updateRoomSettings, subscribeToBrowser, unsubscribeFromBrowser } = useSocket();
  const { error, setError, setRoom, clearRoom, publicRooms, playersOnline, gamesInProgress } = useGameStore();
  const joinCode = searchParams.get('join');
  useLobbyMusic();
  const [mode, setMode] = useState<'idle' | 'create' | 'join' | 'browse'>(joinCode ? 'join' : 'idle');
  const [name, setName] = useState('');
  /** The name we filled in for a first-time visitor; '' for a returning one. */
  const [suggestedName, setSuggestedName] = useState('');
  const [roomCode, setRoomCode] = useState(joinCode ?? '');
  const [loading, setLoading] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showPracticeSetup, setShowPracticeSetup] = useState(false);
  const [showLearn, setShowLearn] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // Stable, so the sheet's focus trap isn't torn down on every re-render.
  const closeLearn = useCallback(() => setShowLearn(false), []);

  // Prefill the name: the one used last time, or a suggestion on a first
  // visit, so Play vs Bots is a single tap. A layout effect, so the field is
  // never painted empty and then filled.
  useLayoutEffect(() => {
    const saved = loadSavedPlayerName();
    if (saved) {
      setName(current => current || saved);
      return;
    }
    const suggestion = loadOrCreateSuggestedName();
    setSuggestedName(suggestion);
    setName(current => current || suggestion);
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

  /**
   * Coming back to the menu rejoins the last room in the background (so a
   * reload mid-game is harmless). Starting something new from here has to
   * leave that room first, or the server refuses: one socket, one room.
   */
  const leaveStaleRoom = () => {
    if (!sessionStorage.getItem('coup_room') && !useGameStore.getState().roomCode) return;
    leaveRoom();
    clearRoom();
  };

  const handleCreate = async () => {
    haptic(80);
    if (!name.trim()) { setError(t('errors.enterName')); return; }
    setLoading(true);
    try {
      leaveStaleRoom();
      const result = await createRoom(name.trim(), isPublic);
      savePlayerName(name);
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    haptic(80);
    if (!name.trim()) { setError(t('errors.enterName')); return; }
    if (!roomCode.trim()) { setError(t('errors.enterRoomCode')); return; }
    setLoading(true);
    try {
      leaveStaleRoom();
      const result = await joinRoom(roomCode.trim(), name.trim());
      savePlayerName(name);
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleBrowseJoin = async (code: string) => {
    haptic(80);
    if (!name.trim()) { setError(t('errors.enterName')); return; }
    setLoading(true);
    try {
      leaveStaleRoom();
      const result = await joinRoom(code, name.trim());
      savePlayerName(name);
      setRoom(result.roomCode, result.playerId);
      router.push(`/lobby/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  const handleSpectate = async (code: string) => {
    haptic(80);
    const spectatorName = name.trim() || t('home.defaultSpectatorName');
    setLoading(true);
    try {
      leaveStaleRoom();
      const result = await spectateRoom(code, spectatorName);
      useGameStore.getState().setSpectating(result.roomCode, result.spectatorId);
      router.push(`/game/${result.roomCode}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  };

  /** A private practice game: a mode alone (Settings) or the full setup sheet's options. */
  const handlePracticeBot = async (input: GameMode | PracticeOptions) => {
    haptic(80);
    const options = typeof input === 'string' ? practiceOptionsForMode(input) : input;
    const { gameMode } = options;
    const practiceName = name.trim() || t('home.defaultPlayerName');
    // A fresh coach for every practice game: tips, dismissals and first-time
    // history all start over, unless the player switched the coach off.
    for (const key of ['coup_practice_coach_hidden', 'coup_practice_coach_dismissed', 'coup_practice_coach_seen']) {
      sessionStorage.removeItem(key);
    }
    if (!options.coach) sessionStorage.setItem('coup_practice_coach_hidden', 'true');
    setLoading(true);
    let practiceRoomCreated = false;
    try {
      leaveStaleRoom();
      const result = await createRoom(practiceName, false, 'practice');
      practiceRoomCreated = true;
      savePlayerName(name);
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
      setError(e instanceof Error ? e.message : t('errors.practiceFailed'));
    } finally {
      setLoading(false);
    }
  };

  /** One click to a running game: private room, random-personality bots, started immediately. */
  const handleQuickPlay = async () => {
    haptic(80);
    if (!name.trim()) { setError(t('errors.enterName')); return; }
    setLoading(true);
    let roomCreated = false;
    try {
      const playerName = name.trim();
      leaveStaleRoom();
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
      setError(e instanceof Error ? e.message : t('errors.quickPlayFailed'));
    } finally {
      setLoading(false);
    }
  };

  const joinableRooms = publicRooms.filter(r => !r.hasGame && r.playerCount < r.maxPlayers);
  const watchableRooms = publicRooms.filter(r => r.hasGame);
  // The home list shows tables to join, or failing that games to watch, and
  // nothing at all when there are neither. "Browse all" appears only when the
  // browse view has more to show than the list does.
  const homeRoomKind: 'join' | 'watch' = joinableRooms.length > 0 ? 'join' : 'watch';
  const homeRooms = (homeRoomKind === 'join' ? joinableRooms : watchableRooms).slice(0, HOME_OPEN_TABLES_SHOWN);
  const hasMoreToBrowse = joinableRooms.length + watchableRooms.length > homeRooms.length;
  const showPresence = playersOnline >= HOME_PRESENCE_MIN_ONLINE;
  const needName = () => {
    if (name.trim()) return false;
    setError(t('errors.enterNameFirst'));
    nameRef.current?.focus();
    return true;
  };

  const roomRow = (room: typeof publicRooms[number], kind: 'join' | 'watch') => (
    <li key={room.code} className="menu-room">
      <div className="min-w-0">
        <p className="menu-room-name">{t.rich('home.roomName', { host: <bdi>{room.hostName}</bdi> })}</p>
        <p className="menu-room-meta">
          {t.rich(
            kind === 'join' && room.betweenGames ? 'home.roomPlayersBetweenGames'
              : kind === 'watch' && room.spectatorCount > 0 ? 'home.roomPlayersWatching'
                : 'home.roomPlayers',
            { seats: `${t.number(room.playerCount)}/${t.number(room.maxPlayers)}`, watching: room.spectatorCount, fig },
          )}
        </p>
      </div>
      {kind === 'join' ? (
        <button
          className="btn-primary menu-room-btn"
          onClick={() => { if (!needName()) handleBrowseJoin(room.code); }}
          disabled={loading || room.playerCount >= MAX_PLAYERS}
        >
          {room.playerCount >= MAX_PLAYERS ? t('home.roomFull') : t('home.join')}
        </button>
      ) : (
        <button className="btn-secondary menu-room-btn" onClick={() => handleSpectate(room.code)} disabled={loading}>
          {t('home.watch')}
        </button>
      )}
    </li>
  );

  return (
    <div className="menu-root">
      <h1 className="sr-only">{t('home.srTitle')}</h1>

      {/* Out of the flow, so it can arrive over the socket without moving anything. */}
      {showPresence && (
        <p className="menu-presence animate-fade-in">
          <span className="menu-presence-online">
            <span className="menu-presence-dot" aria-hidden="true" />
            <span>{t.rich('home.presenceOnline', { count: playersOnline, fig })}</span>
          </span>
          {gamesInProgress > 0 && (
            <span className="menu-presence-games">
              {t.rich('home.presenceGames', { count: gamesInProgress, fig })}
            </span>
          )}
        </p>
      )}

      <div className="menu-topbar">
        <button
          onClick={() => { haptic(); setShowStats(true); }}
          className="court-icon-btn"
          title={t('home.myStats')}
          aria-label={t('home.myStats')}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <path d="M2 3a1 1 0 011-1h1a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm5 2a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5zm5-4a1 1 0 011-1h1a1 1 0 011 1v16a1 1 0 01-1 1h-1a1 1 0 01-1-1V1z" />
          </svg>
        </button>
        <button
          onClick={() => { haptic(); setShowSettings(true); }}
          className="court-icon-btn"
          title={t('common.settings')}
          aria-label={t('common.settings')}
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <main className="menu-column">
        <header className="menu-hero">
          <CoupLogo className="brand-wordmark menu-wordmark" />
          <p className="menu-tagline">{t('home.tagline')}</p>
        </header>

        {error && <div className="menu-error" role="alert">{error}</div>}

        {mode !== 'browse' ? (
          <>
            <section className="menu-panel" aria-label={t('home.playSection')}>
              <label className="menu-label" htmlFor="player-name">{t('home.nameLabel')}</label>
              <input
                id="player-name"
                ref={nameRef}
                className="input-field"
                value={name}
                onChange={e => setName(clampToGraphemes(e.target.value, NAME_MAX_LENGTH))}
                // Still our suggestion: select it, so typing replaces it.
                onFocus={e => { if (suggestedName && e.currentTarget.value === suggestedName) e.currentTarget.select(); }}
                onKeyDown={e => { if (e.key === 'Enter') handleQuickPlay(); }}
                maxLength={NAME_MAX_CODE_UNITS}
                dir="auto"
                autoComplete="nickname"
                enterKeyHint="go"
              />

              <button className="btn-primary menu-play" onClick={() => { if (!needName()) handleQuickPlay(); }} disabled={loading}>
                <span>{loading ? t('home.dealing') : t('home.playVsBots')}</span>
                <span className="menu-play-sub">{t('home.playVsBotsSub', { count: QUICK_PLAY_BOT_COUNT })}</span>
              </button>

              <div className="menu-split">
                <button
                  className={`btn-secondary ${mode === 'create' ? 'is-open' : ''}`}
                  aria-expanded={mode === 'create'}
                  onClick={() => { haptic(); setMode(mode === 'create' ? 'idle' : 'create'); }}
                >
                  {t('home.createRoom')}
                </button>
                <button
                  className={`btn-secondary ${mode === 'join' ? 'is-open' : ''}`}
                  aria-expanded={mode === 'join'}
                  onClick={() => { haptic(); setMode(mode === 'join' ? 'idle' : 'join'); }}
                >
                  {t('home.joinRoom')}
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
                    <span className="text-start">
                      <span className="block font-semibold text-coup-ink">{t('home.publicRoom')}</span>
                      <span className="block text-sm text-coup-ink-mute">
                        {isPublic ? t('home.publicRoomOn') : t('home.publicRoomOff')}
                      </span>
                    </span>
                    <span className={`switch-track ${isPublic ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                  </button>
                  <button className="btn-primary w-full" onClick={() => { if (!needName()) handleCreate(); }} disabled={loading}>
                    {loading ? t('home.creating') : t('home.createAndInvite')}
                  </button>
                </div>
              )}

              {mode === 'join' && (
                <div className="menu-drawer animate-slide-up">
                  <div className="menu-code-row">
                    <input
                      className="input-field menu-code"
                      placeholder={t('home.codePlaceholder')}
                      aria-label={t('home.roomCode')}
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
                      {loading ? t('home.joining') : t('home.join')}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <button
              type="button"
              className="btn-ghost menu-learn"
              aria-haspopup="dialog"
              onClick={() => { haptic(); setShowLearn(true); }}
            >
              <span className="menu-learn-text">
                <span className="menu-learn-title">{t('home.learnTitle')}</span>
                <span className="menu-learn-sub">{t('home.learnSub')}</span>
              </span>
              <svg viewBox="0 0 20 20" fill="currentColor" className="menu-learn-chevron rtl:-scale-x-100" aria-hidden="true">
                <path d="M7.3 4.3 13 10l-5.7 5.7-1.4-1.4L10.2 10 5.9 5.7z" />
              </svg>
            </button>

            {homeRooms.length > 0 && (
              <section className="menu-section animate-fade-in" aria-label={homeRoomKind === 'join' ? t('home.openTables') : t('home.watchLive')}>
                <div className="menu-section-head">
                  <h2 className="menu-section-title">{homeRoomKind === 'join' ? t('home.openTables') : t('home.watchLive')}</h2>
                  {hasMoreToBrowse && (
                    <button className="menu-link" onClick={() => { haptic(); setMode('browse'); }}>
                      {t('home.browseAll')}
                    </button>
                  )}
                </div>
                <ul className="menu-rooms">{homeRooms.map(r => roomRow(r, homeRoomKind))}</ul>
              </section>
            )}
          </>
        ) : (
          <section className="menu-panel" aria-label={t('home.openTables')}>
            <div className="menu-section-head">
              <h2 className="menu-section-title">{t('home.openTables')}</h2>
              <button className="menu-link" onClick={() => { haptic(); setMode('idle'); }}>{t('common.back')}</button>
            </div>
            {!name.trim() && (
              <input
                ref={nameRef}
                className="input-field"
                placeholder={t('home.nameLabel')}
                aria-label={t('home.nameLabel')}
                value={name}
                onChange={e => setName(clampToGraphemes(e.target.value, NAME_MAX_LENGTH))}
                maxLength={NAME_MAX_CODE_UNITS}
                dir="auto"
              />
            )}
            {joinableRooms.length === 0 ? (
              <p className="menu-empty">{t('home.noPublicTables')}</p>
            ) : (
              <ul className="menu-rooms">{joinableRooms.map(r => roomRow(r, 'join'))}</ul>
            )}
            {watchableRooms.length > 0 && (
              <>
                <h2 className="menu-section-title mt-2">{t('home.watchLive')}</h2>
                <ul className="menu-rooms">{watchableRooms.map(r => roomRow(r, 'watch'))}</ul>
              </>
            )}
          </section>
        )}

        <footer className="menu-footer">
          <span>{t('home.footer', { min: MIN_PLAYERS, max: MAX_PLAYERS })}</span>
          <a
            href="https://github.com/8tp/Coup"
            target="_blank"
            rel="noopener noreferrer"
            className="menu-footer-link"
            aria-label={t('home.sourceLabel')}
          >
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            {t('home.source')}
          </a>
        </footer>
      </main>

      <LearnSheet
        open={showLearn}
        onClose={closeLearn}
        onGuidedGame={() => { setShowLearn(false); handlePracticeBot(DEFAULT_PRACTICE_OPTIONS); }}
        onTutorial={() => { setShowLearn(false); setShowTutorial(true); }}
        onRules={() => { setShowLearn(false); setShowHowToPlay(true); }}
        onPracticeSetup={() => { setShowLearn(false); setShowPracticeSetup(true); }}
        loading={loading}
      />
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
