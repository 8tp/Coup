'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { MIN_PLAYERS, MAX_PLAYERS, MIN_ACTION_TIMER, MAX_ACTION_TIMER, MIN_TURN_TIMER, MAX_TURN_TIMER, MIN_BOT_REACTION_SECONDS, MAX_BOT_REACTION_SECONDS, FILL_WITH_BOTS_TARGET } from '@/shared/constants';
import { Character, GameMode, GameStatus } from '@/shared/types';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { AddBotModal } from '../../components/lobby/AddBotModal';
import { QRShareModal } from '../../components/lobby/QRShareModal';
import { SettingsModal } from '../../components/settings/SettingsModal';
import { HowToPlay } from '../../components/home/HowToPlay';
import { CrownGlyph } from '../../components/icons';
import { haptic } from '../../utils/haptic';
import { useLobbyMusic } from '../../hooks/useMusicDirector';
import { botsNeededToFill, buildBots } from '../../utils/botFill';
import { characterName, gameModeName, useT } from '../../i18n';

/** Figures in the figure face, inside a translated sentence. */
const fig = (chunks: ReactNode) => <span className="figure">{chunks}</span>;

/** How long a refreshed lobby waits for the automatic rejoin before sending the player home. */
const REJOIN_WAIT_MS = 8000;

export default function LobbyPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;
  const { startGame, leaveRoom, sendChat, addBot, addBots, removeBot, removePlayer, removeSpectator, updateRoomSettings } = useSocket();
  const {
    playerId,
    hostId,
    roomPlayers,
    roomSettings,
    lastWinnerId,
    spectators,
    chatMessages,
    gameState,
    error,
    rejoinStatus,
  } = useGameStore();

  useLobbyMusic();
  const leavingRef = useRef(false);
  const copyStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'code' | 'link' | 'error'>('idle');
  const [inviteUrl, setInviteUrl] = useState(`https://coup.8tp.dev/lobby/${roomCode}`);
  const [fillingBots, setFillingBots] = useState(false);

  const isHost = playerId === hostId;
  const canStart = roomPlayers.length >= MIN_PLAYERS && roomPlayers.length <= MAX_PLAYERS;
  const startReason = roomPlayers.length < MIN_PLAYERS
    ? t('lobby.needMorePlayers', { count: MIN_PLAYERS - roomPlayers.length })
    : roomPlayers.length > MAX_PLAYERS
      ? t('lobby.tooManyPlayers')
      : t('lobby.startWhenReady');
  const canAddBot = roomPlayers.length < MAX_PLAYERS;
  const hasBots = roomPlayers.some(p => p.isBot);
  // Host is the only human: offer to fill the table with bots instead of a dead "need players" state.
  const isOnlyHuman = isHost && roomPlayers.filter(p => !p.isBot).length === 1;
  const botsToFill = isOnlyHuman ? botsNeededToFill(roomPlayers.length) : 0;
  const botReactionMax = Math.min(MAX_BOT_REACTION_SECONDS, roomSettings?.actionTimerSeconds ?? MAX_ACTION_TIMER);

  useEffect(() => {
    return () => {
      if (copyStatusTimerRef.current) {
        clearTimeout(copyStatusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setInviteUrl(`${window.location.origin}/lobby/${roomCode}`);
  }, [roomCode]);

  // Navigate to game when it starts
  useEffect(() => {
    if (gameState && gameState.status !== GameStatus.Lobby) {
      router.push(`/game/${roomCode}`);
    }
  }, [gameState, roomCode, router]);

  // Redirect home if no session for this room (QR scan / direct link) or rejoin failed
  useEffect(() => {
    if (leavingRef.current || playerId) return;
    // New user (e.g. QR code scan) — no session for this room, redirect immediately
    const storedRoom = sessionStorage.getItem('coup_room');
    if (storedRoom !== roomCode || rejoinStatus === 'failed') {
      router.replace(`/?join=${roomCode}`);
      return;
    }
    // Existing user reconnecting (refresh / backgrounded tab). The server holds
    // the seat for a grace period, so wait for the rejoin callback rather than
    // bouncing slow mobile connections home after a fixed 2s.
    const timer = setTimeout(() => {
      if (!leavingRef.current && !useGameStore.getState().playerId) {
        router.replace(`/?join=${roomCode}`);
      }
    }, REJOIN_WAIT_MS);
    return () => clearTimeout(timer);
  }, [playerId, rejoinStatus, roomCode, router]);

  const handleLeave = () => {
    haptic();
    leavingRef.current = true;
    leaveRoom();
    useGameStore.getState().clearRoom();
    router.push('/');
  };

  const showCopyStatus = (status: typeof copyStatus) => {
    if (copyStatusTimerRef.current) {
      clearTimeout(copyStatusTimerRef.current);
    }
    setCopyStatus(status);
    copyStatusTimerRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
  };

  const copyText = (value: string, status: 'code' | 'link') => {
    haptic();
    showCopyStatus(status);

    if (!navigator.clipboard?.writeText) {
      showCopyStatus('error');
      return;
    }

    navigator.clipboard.writeText(value).catch(() => {
      showCopyStatus('error');
    });
  };

  const copyRoomCode = () => {
    copyText(roomCode, 'code');
  };

  const copyInviteLink = () => {
    copyText(inviteUrl, 'link');
  };

  const handleAddBot = async (name: string, personality: import('@/shared/types').BotPersonality) => {
    await addBot(name, personality);
  };

  const handleFillWithBots = async () => {
    if (botsToFill <= 0 || fillingBots) return;
    haptic(80);
    setFillingBots(true);
    try {
      await addBots(buildBots(botsToFill, roomPlayers.map(p => p.name)));
    } catch (e: unknown) {
      const { setError } = useGameStore.getState();
      setError(e instanceof Error ? e.message : t('errors.fillBotsFailed'));
      setTimeout(() => setError(null), 3000);
    } finally {
      setFillingBots(false);
    }
  };

  const handleRemoveBot = async (botId: string) => {
    try {
      await removeBot(botId);
    } catch {
      // Error will be shown via room:error
    }
  };

  const handleRemovePlayer = async (targetPlayerId: string) => {
    try {
      await removePlayer(targetPlayerId);
    } catch {
      // Error will be shown via room:error
    }
  };

  const handleRemoveSpectator = async (spectatorId: string) => {
    try {
      await removeSpectator(spectatorId);
    } catch {
      // Error will be shown via room:error
    }
  };

  const personalityHue: Record<string, string> = {
    aggressive: '#e0705f', conservative: '#7fbf8a', vengeful: '#e39a52', deceptive: '#e07b90',
    analytical: '#5fa5d6', optimal: '#d6a12a', random: '#b48ad0',
  };
  const settingRange = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (v: number) => void,
    hint?: string,
  ) => (
    <div className="lobby-setting">
      <div className="lobby-setting-head">
        <span>{label}</span>
        <span className="figure text-coup-accent">{t('common.secondsShort', { seconds: value })}</span>
      </div>
      {isHost ? (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="lobby-range"
        />
      ) : (
        <div className="lobby-range-readonly"><div style={{ width: `${((value - min) / (max - min)) * 100}%` }} /></div>
      )}
      <div className="lobby-range-ends"><span>{t('common.secondsShort', { seconds: min })}</span>{hint && <span className="text-center">{hint}</span>}<span>{t('common.secondsShort', { seconds: max })}</span></div>
    </div>
  );

  return (
    <div className="lobby-root">
      <header className="lobby-top">
        <button onClick={handleLeave} className="court-icon-btn" title={t('lobby.leaveRoom')} aria-label={t('lobby.leaveRoom')}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 rtl:-scale-x-100" aria-hidden="true">
            <path fillRule="evenodd" d="M9.7 4.3a1 1 0 010 1.4L6.4 9H16a1 1 0 110 2H6.4l3.3 3.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="flex gap-2">
          <button onClick={() => { haptic(); setShowRules(true); }} className="court-icon-btn type-display" title={t('lobby.howToPlay')} aria-label={t('lobby.howToPlay')}>?</button>
          <button onClick={() => { haptic(); setShowQRModal(true); }} className="court-icon-btn" title={t('lobby.shareRoom')} aria-label={t('lobby.shareRoom')}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
          </button>
          <button onClick={() => { haptic(); setShowSettings(true); }} className="court-icon-btn" title={t('common.settings')} aria-label={t('common.settings')}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      <main className="lobby-column">
        <section className="lobby-code-card">
          <p className="menu-label">{t('lobby.codeLabel', { visibility: roomSettings?.isPublic ? 'public' : 'private' })}</p>
          <button className="lobby-code figure" onClick={copyRoomCode} aria-label={t('lobby.copyCodeLabel', { code: roomCode })}>
            {roomCode}
          </button>
          <p className="lobby-copy-status" aria-live="polite">
            {copyStatus === 'code' && t('lobby.codeCopied')}
            {copyStatus === 'link' && t('lobby.linkCopied')}
            {copyStatus === 'error' && t('lobby.copyFailed')}
            {copyStatus === 'idle' && t('lobby.codeHint')}
          </p>
          <div className="lobby-share">
            <button type="button" className="btn-secondary" onClick={copyRoomCode}>{t('lobby.copyCode')}</button>
            <button type="button" className="btn-secondary" onClick={copyInviteLink}>{t('lobby.copyInviteLink')}</button>
          </div>
        </section>

        {error && <div className="menu-error" role="alert">{error}</div>}

        <div className="lobby-grid">
          <section className="menu-panel" aria-label={t('lobby.players')}>
            <div className="menu-section-head">
              <h2 className="menu-section-title">{t('lobby.players')}</h2>
              <span className="figure text-coup-ink-mute">{t.number(roomPlayers.length)}/{t.number(MAX_PLAYERS)}</span>
            </div>
            <ul className="lobby-players">
              {roomPlayers.map(p => (
                <li key={p.id} className={`lobby-player ${!p.isBot && !p.connected ? 'is-away' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`lobby-player-name ${p.id === playerId ? 'text-coup-accent' : ''}`}>
                      {p.id === lastWinnerId && <CrownGlyph size={14} title={t('lobby.lastWinner')} className="inline-block me-1 align-[-2px] text-coup-accent" />}
                      {p.id === playerId ? t.rich('lobby.nameYou', { name: <bdi>{p.name}</bdi> }) : <bdi>{p.name}</bdi>}
                    </p>
                    <p className="lobby-player-meta">
                      {p.id === hostId && <span className="lobby-tag lobby-tag-host">{t('lobby.host')}</span>}
                      {p.isBot && (
                        <span className="lobby-tag">
                          <span className="lobby-dot" style={{ backgroundColor: personalityHue[p.personality ?? 'random'] }} aria-hidden="true" />
                          {t('lobby.botTag', { personality: t(`lobby.personality.${p.personality ?? 'random'}`) })}
                        </span>
                      )}
                      {!p.isBot && (
                        <span className="lobby-tag">
                          <span className="lobby-dot" style={{ backgroundColor: p.connected ? '#6fbf8a' : '#e0705f' }} aria-hidden="true" />
                          {p.connected ? t('lobby.here') : t('lobby.reconnecting')}
                        </span>
                      )}
                      {(p.wins ?? 0) > 0 && <span className="lobby-tag">{t.rich('lobby.wins', { count: p.wins ?? 0, fig })}</span>}
                    </p>
                  </div>
                  {isHost && p.id !== hostId && (
                    <button
                      onClick={() => { haptic(); if (p.isBot) handleRemoveBot(p.id); else handleRemovePlayer(p.id); }}
                      className="lobby-remove"
                      title={p.isBot ? t('lobby.removeBot') : t('lobby.removePlayer')}
                      aria-label={t('lobby.removeNamed', { name: p.name })}
                    >
                      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                        <path d="M5.3 4 10 8.6 14.7 4 16 5.3 11.4 10l4.6 4.7-1.3 1.3-4.7-4.6L5.3 16 4 14.7 8.6 10 4 5.3z" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {isHost && canAddBot && (
              <div className="menu-split">
                <button className="btn-secondary" onClick={() => { haptic(); setShowAddBotModal(true); }}>
                  {t('lobby.addBot')}
                </button>
                {botsToFill > 0 && roomPlayers.length >= MIN_PLAYERS && (
                  <button className="btn-secondary" onClick={handleFillWithBots} disabled={fillingBots}>
                    {t('lobby.fillSeats', { count: botsToFill })}
                  </button>
                )}
              </div>
            )}

            {spectators.length > 0 && (
              <div className="lobby-spectators">
                <h3 className="menu-label">{t('lobby.watching', { count: spectators.length })}</h3>
                <ul className="lobby-players">
                  {spectators.map(s => (
                    <li key={s.id} className="lobby-player">
                      <span className="lobby-player-name flex-1"><bdi>{s.name}</bdi></span>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => { haptic(); handleRemoveSpectator(s.id); }}
                          className="lobby-remove"
                          title={t('lobby.removeSpectator')}
                          aria-label={t('lobby.removeSpectatorNamed', { name: s.name })}
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
                            <path d="M5.3 4 10 8.6 14.7 4 16 5.3 11.4 10l4.6 4.7-1.3 1.3-4.7-4.6L5.3 16 4 14.7 8.6 10 4 5.3z" />
                          </svg>
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {roomSettings && (
            <section className="menu-panel" aria-label={t('lobby.roomSettings')}>
              <h2 className="menu-section-title">{t('lobby.tableRules')}</h2>

              {isHost ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={roomSettings.isPublic}
                  className="menu-switch"
                  onClick={() => { haptic(); updateRoomSettings({ ...roomSettings, isPublic: !roomSettings.isPublic }); }}
                >
                  <span>
                    <span className="block font-semibold text-coup-ink">{t('lobby.publicRoom')}</span>
                    <span className="block text-sm text-coup-ink-mute">
                      {roomSettings.isPublic ? t('lobby.publicRoomOn') : t('lobby.publicRoomOff')}
                    </span>
                  </span>
                  <span className={`switch-track ${roomSettings.isPublic ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                </button>
              ) : (
                <div className="lobby-setting-head"><span>{t('lobby.visibility')}</span><span>{roomSettings.isPublic ? t('lobby.public') : t('lobby.private')}</span></div>
              )}

              <div className="lobby-setting">
                <div className="lobby-setting-head"><span>{t('lobby.gameMode')}</span></div>
                {isHost ? (
                  <div className="lobby-seg" role="radiogroup" aria-label={t('lobby.gameMode')}>
                    {[GameMode.Classic, GameMode.Reformation].map(m => (
                      <button
                        key={m}
                        role="radio"
                        aria-checked={roomSettings.gameMode === m}
                        className={roomSettings.gameMode === m ? 'is-on' : ''}
                        onClick={() => {
                          haptic();
                          updateRoomSettings(m === GameMode.Classic
                            ? { ...roomSettings, gameMode: GameMode.Classic, useInquisitor: false }
                            : { ...roomSettings, gameMode: GameMode.Reformation });
                        }}
                      >
                        {gameModeName(t, m)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-coup-ink-mute">{gameModeName(t, roomSettings.gameMode)}</span>
                )}
              </div>

              {roomSettings.gameMode === GameMode.Reformation && (isHost ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={roomSettings.useInquisitor}
                  className="menu-switch"
                  onClick={() => { haptic(); updateRoomSettings({ ...roomSettings, useInquisitor: !roomSettings.useInquisitor }); }}
                >
                  <span>
                    <span className="block font-semibold text-coup-ink">{t('lobby.useInquisitor', { character: characterName(t, Character.Inquisitor) })}</span>
                    <span className="block text-sm text-coup-ink-mute">{t('lobby.useInquisitorSub', { character: characterName(t, Character.Ambassador) })}</span>
                  </span>
                  <span className={`switch-track ${roomSettings.useInquisitor ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                </button>
              ) : (
                <div className="lobby-setting-head"><span>{characterName(t, Character.Inquisitor)}</span><span>{roomSettings.useInquisitor ? t('lobby.yes') : t('lobby.no')}</span></div>
              ))}

              {settingRange(t('lobby.challengeWindow'), roomSettings.actionTimerSeconds, MIN_ACTION_TIMER, MAX_ACTION_TIMER, 5, (v) => {
                updateRoomSettings({ ...roomSettings, actionTimerSeconds: v, botMinReactionSeconds: Math.min(roomSettings.botMinReactionSeconds, v) });
              })}
              {settingRange(t('lobby.turnTimer'), roomSettings.turnTimerSeconds, MIN_TURN_TIMER, MAX_TURN_TIMER, 5, (v) => {
                updateRoomSettings({ ...roomSettings, turnTimerSeconds: v });
              }, t('lobby.turnTimerHint'))}
              {hasBots && settingRange(t('lobby.botThinking'), roomSettings.botMinReactionSeconds, MIN_BOT_REACTION_SECONDS, botReactionMax, 0.5, (v) => {
                updateRoomSettings({ ...roomSettings, botMinReactionSeconds: v });
              })}
            </section>
          )}
        </div>

        <section className="menu-panel lobby-chat" aria-label={t('lobby.chat')}>
          <h2 className="menu-section-title">{t('lobby.chat')}</h2>
          <ChatPanel messages={chatMessages} myId={playerId} onSend={sendChat} />
        </section>
      </main>

      <div className="lobby-actions">
        <div className="lobby-actions-inner">
          {isHost ? (
            !canStart && botsToFill > 0 ? (
              <button className="btn-primary flex-1" disabled={fillingBots} onClick={handleFillWithBots}>
                {fillingBots ? t('lobby.addingBots') : t('lobby.startWithBots', { count: FILL_WITH_BOTS_TARGET })}
              </button>
            ) : (
              <button className="btn-primary flex-1" disabled={!canStart} onClick={() => { haptic(80); startGame(); }} title={startReason}>
                {canStart ? t('lobby.startGame', { count: roomPlayers.length }) : t('lobby.needPlayersButton', { count: MIN_PLAYERS })}
              </button>
            )
          ) : (
            <p className="flex-1 text-center text-coup-ink-mute">{t('lobby.waitingForHost')}</p>
          )}
        </div>
        {isHost && (
          <p className={`lobby-actions-hint ${canStart ? '' : 'is-warn'}`}>
            {!canStart && botsToFill > 0 ? t('lobby.inviteOrBots') : startReason}
          </p>
        )}
      </div>

      <AddBotModal
        open={showAddBotModal}
        onClose={() => setShowAddBotModal(false)}
        onAdd={handleAddBot}
        existingNames={roomPlayers.map(p => p.name)}
      />
      <QRShareModal open={showQRModal} onClose={() => setShowQRModal(false)} roomCode={roomCode} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <HowToPlay open={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
}
