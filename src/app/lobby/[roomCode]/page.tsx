'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { MIN_PLAYERS, MAX_PLAYERS, MIN_ACTION_TIMER, MAX_ACTION_TIMER, MIN_TURN_TIMER, MAX_TURN_TIMER, MIN_BOT_REACTION_SECONDS, MAX_BOT_REACTION_SECONDS, FILL_WITH_BOTS_TARGET } from '@/shared/constants';
import { GameMode, GameStatus } from '@/shared/types';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { AddBotModal } from '../../components/lobby/AddBotModal';
import { QRShareModal } from '../../components/lobby/QRShareModal';
import { SettingsModal } from '../../components/settings/SettingsModal';
import { HowToPlay } from '../../components/home/HowToPlay';
import { haptic } from '../../utils/haptic';
import { useLobbyMusic } from '../../hooks/useMusicDirector';
import { botsNeededToFill, buildBots } from '../../utils/botFill';

/** How long a refreshed lobby waits for the automatic rejoin before sending the player home. */
const REJOIN_WAIT_MS = 8000;

export default function LobbyPage() {
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
    ? `Need ${MIN_PLAYERS - roomPlayers.length} more player${MIN_PLAYERS - roomPlayers.length === 1 ? '' : 's'}`
    : roomPlayers.length > MAX_PLAYERS
      ? 'Too many players'
      : 'Ready when everyone has joined';
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
      setError(e instanceof Error ? e.message : 'Could not add bots');
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
        <span className="figure text-coup-accent">{value}s</span>
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
      <div className="lobby-range-ends"><span>{min}s</span>{hint && <span className="text-center">{hint}</span>}<span>{max}s</span></div>
    </div>
  );

  return (
    <div className="lobby-root">
      <header className="lobby-top">
        <button onClick={handleLeave} className="court-icon-btn" title="Leave room" aria-label="Leave room">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
            <path fillRule="evenodd" d="M9.7 4.3a1 1 0 010 1.4L6.4 9H16a1 1 0 110 2H6.4l3.3 3.3a1 1 0 01-1.4 1.4l-5-5a1 1 0 010-1.4l5-5a1 1 0 011.4 0z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="flex gap-2">
          <button onClick={() => { haptic(); setShowRules(true); }} className="court-icon-btn type-display" title="How to Play" aria-label="How to Play">?</button>
          <button onClick={() => { haptic(); setShowQRModal(true); }} className="court-icon-btn" title="Share room" aria-label="Share room">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
            </svg>
          </button>
          <button onClick={() => { haptic(); setShowSettings(true); }} className="court-icon-btn" title="Settings" aria-label="Settings">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5" aria-hidden="true">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </header>

      <main className="lobby-column">
        <section className="lobby-code-card">
          <p className="menu-label">Room code · {roomSettings?.isPublic ? 'public' : 'private'}</p>
          <button className="lobby-code figure" onClick={copyRoomCode} aria-label={`Copy room code ${roomCode}`}>
            {roomCode}
          </button>
          <p className="lobby-copy-status" aria-live="polite">
            {copyStatus === 'code' && 'Room code copied'}
            {copyStatus === 'link' && 'Invite link copied'}
            {copyStatus === 'error' && 'Copy failed — select the code or use the QR button'}
            {copyStatus === 'idle' && 'Share it with friends to bring them to the table'}
          </p>
          <div className="lobby-share">
            <button type="button" className="btn-secondary" onClick={copyRoomCode}>Copy code</button>
            <button type="button" className="btn-secondary" onClick={copyInviteLink}>Copy invite link</button>
          </div>
        </section>

        {error && <div className="menu-error" role="alert">{error}</div>}

        <div className="lobby-grid">
          <section className="menu-panel" aria-label="Players">
            <div className="menu-section-head">
              <h2 className="menu-section-title">Players</h2>
              <span className="figure text-coup-ink-mute">{roomPlayers.length}/{MAX_PLAYERS}</span>
            </div>
            <ul className="lobby-players">
              {roomPlayers.map(p => (
                <li key={p.id} className={`lobby-player ${!p.isBot && !p.connected ? 'is-away' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`lobby-player-name ${p.id === playerId ? 'text-coup-accent' : ''}`}>
                      {p.id === lastWinnerId && <span title="Last game winner" aria-label="Last game winner">♛ </span>}
                      {p.name}{p.id === playerId && ' (you)'}
                    </p>
                    <p className="lobby-player-meta">
                      {p.id === hostId && <span className="lobby-tag lobby-tag-host">Host</span>}
                      {p.isBot && (
                        <span className="lobby-tag">
                          <span className="lobby-dot" style={{ backgroundColor: personalityHue[p.personality ?? 'random'] }} aria-hidden="true" />
                          Bot · {p.personality ?? 'random'}
                        </span>
                      )}
                      {!p.isBot && (
                        <span className="lobby-tag">
                          <span className="lobby-dot" style={{ backgroundColor: p.connected ? '#6fbf8a' : '#e0705f' }} aria-hidden="true" />
                          {p.connected ? 'Here' : 'Reconnecting…'}
                        </span>
                      )}
                      {(p.wins ?? 0) > 0 && <span className="lobby-tag"><span className="figure">{p.wins}</span> {p.wins === 1 ? 'win' : 'wins'}</span>}
                    </p>
                  </div>
                  {isHost && p.id !== hostId && (
                    <button
                      onClick={() => { haptic(); if (p.isBot) handleRemoveBot(p.id); else handleRemovePlayer(p.id); }}
                      className="lobby-remove"
                      title={p.isBot ? 'Remove bot' : 'Remove player'}
                      aria-label={`Remove ${p.name}`}
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
                  + Add bot
                </button>
                {botsToFill > 0 && roomPlayers.length >= MIN_PLAYERS && (
                  <button className="btn-secondary" onClick={handleFillWithBots} disabled={fillingBots}>
                    Fill seats (+{botsToFill})
                  </button>
                )}
              </div>
            )}

            {spectators.length > 0 && (
              <div className="lobby-spectators">
                <h3 className="menu-label">Watching ({spectators.length})</h3>
                <ul className="lobby-players">
                  {spectators.map(s => (
                    <li key={s.id} className="lobby-player">
                      <span className="lobby-player-name flex-1">{s.name}</span>
                      {isHost && (
                        <button
                          type="button"
                          onClick={() => { haptic(); handleRemoveSpectator(s.id); }}
                          className="lobby-remove"
                          title="Remove spectator"
                          aria-label={`Remove spectator ${s.name}`}
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
            <section className="menu-panel" aria-label="Room settings">
              <h2 className="menu-section-title">Table rules</h2>

              {isHost ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={roomSettings.isPublic}
                  className="menu-switch"
                  onClick={() => { haptic(); updateRoomSettings({ ...roomSettings, isPublic: !roomSettings.isPublic }); }}
                >
                  <span>
                    <span className="block font-semibold text-coup-ink">Public room</span>
                    <span className="block text-sm text-coup-ink-mute">
                      {roomSettings.isPublic ? 'Listed in open tables' : 'Private — only people with the code'}
                    </span>
                  </span>
                  <span className={`switch-track ${roomSettings.isPublic ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                </button>
              ) : (
                <div className="lobby-setting-head"><span>Visibility</span><span>{roomSettings.isPublic ? 'Public' : 'Private'}</span></div>
              )}

              <div className="lobby-setting">
                <div className="lobby-setting-head"><span>Game mode</span></div>
                {isHost ? (
                  <div className="lobby-seg" role="radiogroup" aria-label="Game mode">
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
                        {m === GameMode.Classic ? 'Classic' : 'Reformation'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-sm text-coup-ink-mute">{roomSettings.gameMode}</span>
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
                    <span className="block font-semibold text-coup-ink">Use the Inquisitor</span>
                    <span className="block text-sm text-coup-ink-mute">Replaces the Ambassador</span>
                  </span>
                  <span className={`switch-track ${roomSettings.useInquisitor ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
                </button>
              ) : (
                <div className="lobby-setting-head"><span>Inquisitor</span><span>{roomSettings.useInquisitor ? 'Yes' : 'No'}</span></div>
              ))}

              {settingRange('Challenge & block window', roomSettings.actionTimerSeconds, MIN_ACTION_TIMER, MAX_ACTION_TIMER, 5, (v) => {
                updateRoomSettings({ ...roomSettings, actionTimerSeconds: v, botMinReactionSeconds: Math.min(roomSettings.botMinReactionSeconds, v) });
              })}
              {settingRange('Turn timer', roomSettings.turnTimerSeconds, MIN_TURN_TIMER, MAX_TURN_TIMER, 5, (v) => {
                updateRoomSettings({ ...roomSettings, turnTimerSeconds: v });
              }, 'actions, exchanges, losses')}
              {hasBots && settingRange('Bot thinking time', roomSettings.botMinReactionSeconds, MIN_BOT_REACTION_SECONDS, botReactionMax, 0.5, (v) => {
                updateRoomSettings({ ...roomSettings, botMinReactionSeconds: v });
              })}
            </section>
          )}
        </div>

        <section className="menu-panel lobby-chat" aria-label="Chat">
          <h2 className="menu-section-title">Chat</h2>
          <ChatPanel messages={chatMessages} myId={playerId} onSend={sendChat} />
        </section>
      </main>

      <div className="lobby-actions">
        <div className="lobby-actions-inner">
          {isHost ? (
            !canStart && botsToFill > 0 ? (
              <button className="btn-primary flex-1" disabled={fillingBots} onClick={handleFillWithBots}>
                {fillingBots ? 'Adding bots…' : `Play now with bots (${FILL_WITH_BOTS_TARGET} players)`}
              </button>
            ) : (
              <button className="btn-primary flex-1" disabled={!canStart} onClick={() => { haptic(80); startGame(); }} title={startReason}>
                {canStart ? `Start game · ${roomPlayers.length} players` : `Need ${MIN_PLAYERS}+ players`}
              </button>
            )
          ) : (
            <p className="flex-1 text-center text-coup-ink-mute">Waiting for the host to start…</p>
          )}
        </div>
        {isHost && (
          <p className={`lobby-actions-hint ${canStart ? '' : 'is-warn'}`}>
            {!canStart && botsToFill > 0 ? 'Invite friends with the code above, or start now against bots.' : startReason}
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
