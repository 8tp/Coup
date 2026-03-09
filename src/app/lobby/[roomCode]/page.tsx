'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { MIN_PLAYERS, MAX_PLAYERS, MIN_ACTION_TIMER, MAX_ACTION_TIMER, MIN_TURN_TIMER, MAX_TURN_TIMER, MIN_BOT_REACTION_SECONDS, MAX_BOT_REACTION_SECONDS } from '@/shared/constants';
import { GameMode, GameStatus } from '@/shared/types';
import { ChatPanel } from '../../components/chat/ChatPanel';
import { AddBotModal } from '../../components/lobby/AddBotModal';
import { QRShareModal } from '../../components/lobby/QRShareModal';
import { SettingsModal } from '../../components/settings/SettingsModal';
import { haptic } from '../../utils/haptic';

export default function LobbyPage() {
  const router = useRouter();
  const params = useParams();
  const roomCode = params.roomCode as string;
  const { startGame, leaveRoom, sendChat, addBot, removeBot, updateRoomSettings } = useSocket();
  const {
    playerId,
    hostId,
    roomPlayers,
    roomSettings,
    lastWinnerId,
    chatMessages,
    gameState,
    error,
  } = useGameStore();

  const leavingRef = useRef(false);
  const [showAddBotModal, setShowAddBotModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const isHost = playerId === hostId;
  const canStart = roomPlayers.length >= MIN_PLAYERS && roomPlayers.length <= MAX_PLAYERS;
  const canAddBot = roomPlayers.length < MAX_PLAYERS;
  const hasBots = roomPlayers.some(p => p.isBot);
  const botReactionMax = Math.min(MAX_BOT_REACTION_SECONDS, roomSettings?.actionTimerSeconds ?? MAX_ACTION_TIMER);

  // Navigate to game when it starts
  useEffect(() => {
    if (gameState && gameState.status !== GameStatus.Lobby) {
      router.push(`/game/${roomCode}`);
    }
  }, [gameState, roomCode, router]);

  // Redirect home if no session for this room (QR scan / direct link) or rejoin failed
  useEffect(() => {
    if (leavingRef.current) return;
    // New user (e.g. QR code scan) — no session for this room, redirect immediately
    const storedRoom = sessionStorage.getItem('coup_room');
    if (storedRoom !== roomCode) {
      router.replace(`/?join=${roomCode}`);
      return;
    }
    // Existing user reconnecting — wait for rejoin socket callback
    const timer = setTimeout(() => {
      if (!leavingRef.current && !useGameStore.getState().playerId) {
        router.replace(`/?join=${roomCode}`);
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [playerId, roomCode, router]);

  const handleLeave = () => {
    haptic();
    leavingRef.current = true;
    leaveRoom();
    useGameStore.getState().clearRoom();
    router.push('/');
  };

  const copyRoomCode = () => {
    haptic();
    try {
      navigator.clipboard.writeText(roomCode);
    } catch {
      // Clipboard API not available (HTTP or permission denied)
    }
  };

  const handleAddBot = async (name: string, personality: import('@/shared/types').BotPersonality) => {
    await addBot(name, personality);
  };

  const handleRemoveBot = async (botId: string) => {
    try {
      await removeBot(botId);
    } catch {
      // Error will be shown via room:error
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-6">
      <div className="max-w-sm lg:max-w-2xl w-full">
        {/* Top buttons + Room Code */}
        <div className="text-center mb-8 relative">
          <div className="flex justify-end gap-2 mb-3">
            <button
              onClick={() => { haptic(); setShowQRModal(true); }}
              className="w-9 h-9 rounded-full bg-gray-800 border border-gray-600 text-gray-300 hover:border-coup-accent hover:text-coup-accent transition flex items-center justify-center"
              title="Share Room"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
              </svg>
            </button>
            <button
              onClick={() => { haptic(); setShowSettings(true); }}
              className="w-9 h-9 rounded-full bg-gray-800 border border-gray-600 text-gray-300 hover:border-coup-accent hover:text-coup-accent transition flex items-center justify-center"
              title="Settings"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <p className="text-gray-400 text-sm mb-1">Room Code</p>
          <button
            className="text-4xl font-bold tracking-widest text-coup-accent hover:opacity-80 transition"
            onClick={copyRoomCode}
          >
            {roomCode}
          </button>
          <p className="text-gray-600 text-xs mt-1">
            Tap to copy &middot; {roomSettings?.isPublic ? 'Public' : 'Private'}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-600 rounded-xl p-3 mb-4 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div className="lg:grid lg:grid-cols-2 lg:gap-6">

        {/* Player List */}
        <div className="card-container mb-6">
          <h2 className="font-bold text-gray-400 text-sm uppercase mb-3">
            Players ({roomPlayers.length}/{MAX_PLAYERS})
          </h2>
          <div className="space-y-2">
            {roomPlayers.map(p => (
              <div
                key={p.id}
                className="flex items-center py-2 px-3 bg-coup-bg rounded-lg gap-2"
              >
                {p.id === lastWinnerId && (
                  <span className="text-yellow-400 shrink-0" title="Last game winner">&#128081;</span>
                )}
                <span className={`font-medium truncate min-w-0 ${p.id === playerId ? 'text-coup-accent' : ''}`}>
                  {p.name}
                  {p.id === playerId && ' (You)'}
                </span>
                {(p.wins ?? 0) > 0 && (
                  <span className="shrink-0 text-[10px] bg-yellow-600/80 text-white px-1.5 py-px rounded-full font-bold">
                    {p.wins}W
                  </span>
                )}
                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                  {p.isBot && p.personality && (
                    <span className={`text-[10px] px-1.5 py-px rounded-full font-bold text-white ${
                      p.personality === 'aggressive' ? 'bg-red-600' :
                      p.personality === 'conservative' ? 'bg-green-600' :
                      p.personality === 'vengeful' ? 'bg-orange-600' :
                      p.personality === 'deceptive' ? 'bg-pink-600' :
                      p.personality === 'analytical' ? 'bg-blue-600' :
                      p.personality === 'optimal' ? 'bg-yellow-600' :
                      'bg-purple-600'
                    }`}>
                      {p.personality.toUpperCase()}
                    </span>
                  )}
                  {p.isBot && (
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-px rounded-full font-bold">
                      BOT
                    </span>
                  )}
                  {p.id === hostId && (
                    <span className="text-[10px] bg-coup-accent text-coup-bg px-1.5 py-px rounded-full font-bold">
                      HOST
                    </span>
                  )}
                  {p.isBot && isHost && (
                    <button
                      onClick={() => { haptic(); handleRemoveBot(p.id); }}
                      className="text-gray-500 hover:text-red-400 transition text-xs font-bold w-4 h-4 flex items-center justify-center"
                      title="Remove bot"
                    >
                      &times;
                    </button>
                  )}
                  {!p.isBot && (
                    <span className={`w-2 h-2 rounded-full ${p.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add Bot Button */}
          {isHost && canAddBot && (
            <button
              className="w-full mt-3 py-2 px-3 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-sm"
              onClick={() => { haptic(); setShowAddBotModal(true); }}
            >
              + Add Computer Player
            </button>
          )}
        </div>

        {/* Room Settings */}
        {roomSettings && (
          <div className="card-container mb-6">
            <h2 className="font-bold text-gray-400 text-sm uppercase mb-3">Room Settings</h2>

            {/* Visibility Toggle */}
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm text-gray-300">{roomSettings.isPublic ? 'Public' : 'Private'}</label>
              {isHost ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={roomSettings.isPublic}
                  onClick={() => {
                    haptic();
                    updateRoomSettings({ ...roomSettings, isPublic: !roomSettings.isPublic });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${roomSettings.isPublic ? 'bg-coup-accent' : 'bg-gray-600'}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${roomSettings.isPublic ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              ) : (
                <span className="text-sm text-gray-400">{roomSettings.isPublic ? 'Public' : 'Private'}</span>
              )}
            </div>

            {/* Game Mode Toggle */}
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm text-gray-300">Game Mode</label>
              {isHost ? (
                <div className="flex bg-coup-bg rounded-lg overflow-hidden border border-gray-700">
                  <button
                    className={`px-3 py-1 text-xs font-medium transition-colors ${roomSettings.gameMode === GameMode.Classic ? 'bg-coup-accent text-white' : 'text-gray-400 hover:text-gray-200'}`}
                    onClick={() => {
                      haptic();
                      updateRoomSettings({ ...roomSettings, gameMode: GameMode.Classic, useInquisitor: false });
                    }}
                  >
                    Classic
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-medium transition-colors ${roomSettings.gameMode === GameMode.Reformation ? 'bg-coup-accent text-white' : 'text-gray-400 hover:text-gray-200'}`}
                    onClick={() => {
                      haptic();
                      updateRoomSettings({ ...roomSettings, gameMode: GameMode.Reformation });
                    }}
                  >
                    Reformation
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-400">{roomSettings.gameMode}</span>
              )}
            </div>

            {/* Inquisitor Toggle (Reformation only) */}
            {roomSettings.gameMode === GameMode.Reformation && (
              <div className="flex items-center justify-between mb-4">
                <label className="text-sm text-gray-300">Use Inquisitor</label>
                {isHost ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={roomSettings.useInquisitor}
                    onClick={() => {
                      haptic();
                      updateRoomSettings({ ...roomSettings, useInquisitor: !roomSettings.useInquisitor });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${roomSettings.useInquisitor ? 'bg-coup-accent' : 'bg-gray-600'}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${roomSettings.useInquisitor ? 'translate-x-6' : 'translate-x-1'}`}
                    />
                  </button>
                ) : (
                  <span className="text-sm text-gray-400">{roomSettings.useInquisitor ? 'Yes' : 'No'}</span>
                )}
              </div>
            )}

            {/* Action Timer */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-300">Action Timer</label>
              <span className="text-sm font-mono text-coup-accent">{roomSettings.actionTimerSeconds}s</span>
            </div>
            {isHost ? (
              <input
                type="range"
                min={MIN_ACTION_TIMER}
                max={MAX_ACTION_TIMER}
                step={5}
                value={roomSettings.actionTimerSeconds}
                onChange={(e) => {
                  const newTimer = Number(e.target.value);
                  const clampedBotReaction = Math.min(roomSettings.botMinReactionSeconds, newTimer);
                  updateRoomSettings({ ...roomSettings, actionTimerSeconds: newTimer, botMinReactionSeconds: clampedBotReaction });
                }}
                className="w-full mt-2 accent-coup-accent"
              />
            ) : (
              <div className="w-full bg-coup-bg rounded-full h-2 mt-2">
                <div
                  className="bg-coup-accent/40 h-2 rounded-full"
                  style={{ width: `${((roomSettings.actionTimerSeconds - MIN_ACTION_TIMER) / (MAX_ACTION_TIMER - MIN_ACTION_TIMER)) * 100}%` }}
                />
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{MIN_ACTION_TIMER}s</span>
              <span>{MAX_ACTION_TIMER}s</span>
            </div>

            {/* Turn Timer */}
            <div className="flex items-center justify-between mt-4">
              <label className="text-sm text-gray-300">Turn Timer</label>
              <span className="text-sm font-mono text-coup-accent">{roomSettings.turnTimerSeconds}s</span>
            </div>
            {isHost ? (
              <input
                type="range"
                min={MIN_TURN_TIMER}
                max={MAX_TURN_TIMER}
                step={5}
                value={roomSettings.turnTimerSeconds}
                onChange={(e) => {
                  updateRoomSettings({ ...roomSettings, turnTimerSeconds: Number(e.target.value) });
                }}
                className="w-full mt-2 accent-coup-accent"
              />
            ) : (
              <div className="w-full bg-coup-bg rounded-full h-2 mt-2">
                <div
                  className="bg-coup-accent/40 h-2 rounded-full"
                  style={{ width: `${((roomSettings.turnTimerSeconds - MIN_TURN_TIMER) / (MAX_TURN_TIMER - MIN_TURN_TIMER)) * 100}%` }}
                />
              </div>
            )}
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>{MIN_TURN_TIMER}s</span>
              <span>{MAX_TURN_TIMER}s</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">Time limit for action selection, exchange, and influence loss</p>

            {/* Bot Min Reaction Time */}
            {hasBots && (
              <>
                <div className="flex items-center justify-between mt-4">
                  <label className="text-sm text-gray-300">Bot Min Reaction</label>
                  <span className="text-sm font-mono text-coup-accent">{roomSettings.botMinReactionSeconds}s</span>
                </div>
                {isHost ? (
                  <input
                    type="range"
                    min={MIN_BOT_REACTION_SECONDS}
                    max={botReactionMax}
                    step={0.5}
                    value={roomSettings.botMinReactionSeconds}
                    onChange={(e) => {
                      updateRoomSettings({ ...roomSettings, botMinReactionSeconds: Number(e.target.value) });
                    }}
                    className="w-full mt-2 accent-coup-accent"
                  />
                ) : (
                  <div className="w-full bg-coup-bg rounded-full h-2 mt-2">
                    <div
                      className="bg-coup-accent/40 h-2 rounded-full"
                      style={{ width: `${((roomSettings.botMinReactionSeconds - MIN_BOT_REACTION_SECONDS) / (botReactionMax - MIN_BOT_REACTION_SECONDS)) * 100}%` }}
                    />
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-600 mt-1">
                  <span>{MIN_BOT_REACTION_SECONDS}s</span>
                  <span>{botReactionMax}s</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">Minimum time before bots react</p>
              </>
            )}
          </div>
        )}

        </div>{/* end lg:grid */}

        {/* Controls */}
        <div className="space-y-3 lg:max-w-xs lg:mx-auto">
          {isHost && (
            <button
              className="btn-primary w-full"
              disabled={!canStart}
              onClick={() => { haptic(80); startGame(); }}
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

        {/* Chat */}
        <div className="card-container mt-6 lg:max-w-sm lg:mx-auto">
          <h2 className="font-bold text-gray-400 text-sm uppercase mb-2">Chat</h2>
          <ChatPanel messages={chatMessages} myId={playerId} onSend={sendChat} />
        </div>
      </div>

      {/* Add Bot Modal */}
      <AddBotModal
        open={showAddBotModal}
        onClose={() => setShowAddBotModal(false)}
        onAdd={handleAddBot}
        existingNames={roomPlayers.map(p => p.name)}
      />
      <QRShareModal open={showQRModal} onClose={() => setShowQRModal(false)} roomCode={roomCode} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
