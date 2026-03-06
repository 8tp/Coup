'use client';

import { useState } from 'react';
import { ChatMessage, ClientGameState } from '@/shared/types';
import { PlayerSeat } from './PlayerSeat';
import { CardFace } from './CardFace';
import { CoinIcon } from '../icons';
import { ActionBar } from './ActionBar';
import { ChallengePrompt } from './ChallengePrompt';
import { BlockPrompt } from './BlockPrompt';
import { BlockChallengePrompt } from './BlockChallengePrompt';
import { InfluenceLossPrompt } from './InfluenceLossPrompt';
import { ExchangeView } from './ExchangeView';
import { ExaminePrompt } from './ExaminePrompt';
import { GameCenterTabs } from './GameCenterTabs';
import { GameOverOverlay } from './GameOverOverlay';
import { ChallengeRevealOverlay } from './ChallengeRevealOverlay';
import { PhaseStatus } from './PhaseStatus';
import { WaitingView } from './WaitingView';
import { HowToPlay } from '../home/HowToPlay';
import { ReactionBubble } from './ReactionBubble';
import { ReactionPicker } from './ReactionPicker';
import { SettingsModal } from '../settings/SettingsModal';
import { useSoundEffects } from '../../hooks/useSoundEffects';
import { useGameStore } from '../../stores/gameStore';
import { haptic } from '../../utils/haptic';

interface GameTableProps {
  gameState: ClientGameState;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void;
  onSendReaction: (reactionId: string) => void;
  isHost: boolean;
  onRematch: () => void;
  isSpectator?: boolean;
  onStopSpectating?: () => void;
}

export function GameTable({ gameState, chatMessages, onSendChat, onSendReaction, isHost, onRematch, isSpectator, onStopSpectating }: GameTableProps) {
  useSoundEffects();
  const isMuted = useGameStore(s => s.isMuted);
  const setMuted = useGameStore(s => s.setMuted);
  const reconnecting = useGameStore(s => s.reconnecting);
  const spectators = useGameStore(s => s.spectators);
  const [showRules, setShowRules] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const me = isSpectator ? undefined : gameState.players.find(p => p.id === gameState.myId);
  const opponents = isSpectator ? gameState.players : gameState.players.filter(p => p.id !== gameState.myId);
  const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id;

  // Determine which player should show the timer bar on their seat
  const timerPlayerId = gameState.influenceLossRequest?.playerId
    ?? (gameState.turnPhase === 'AwaitingExchange' && gameState.pendingAction?.actorId
      ? gameState.pendingAction.actorId
      : currentPlayerId);

  return (
    <div className="h-dvh flex flex-col max-w-lg mx-auto px-3 py-3 overflow-hidden" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))', paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <span>Room: <span className="text-gray-400 font-mono">{gameState.roomCode}</span></span>
        <span className="flex items-center gap-2">
          Turn {gameState.turnNumber}
          {spectators.length > 0 && (
            <span className="text-purple-400">{spectators.length} watching</span>
          )}
        </span>
        <div className="flex items-center gap-2.5">
          <span>Deck: {gameState.deckCount}</span>
          <button
            onClick={() => { haptic(); setMuted(!isMuted); }}
            className="w-8 h-8 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-xs flex items-center justify-center"
            title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => { haptic(); setShowSettings(true); }}
            className="w-8 h-8 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition flex items-center justify-center"
            title="Settings"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
          <ReactionPicker onReact={onSendReaction} disabled={isSpectator || (me ? !me.isAlive : true)} />
          <button
            onClick={() => { haptic(); setShowRules(true); }}
            className="w-8 h-8 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-xs font-bold flex items-center justify-center"
            title="How to Play"
          >
            ?
          </button>
        </div>
      </div>

      {/* Spectator banner */}
      {isSpectator && (
        <div className="bg-purple-900/60 border border-purple-600 text-purple-200 text-xs text-center py-1.5 px-3 rounded-lg mb-2 flex items-center justify-between">
          <span>Spectating</span>
          {onStopSpectating && (
            <button
              onClick={() => { haptic(); onStopSpectating(); }}
              className="text-purple-300 hover:text-white transition text-xs font-medium"
            >
              Leave
            </button>
          )}
        </div>
      )}

      {/* Reconnecting banner */}
      {reconnecting && (
        <div className="bg-yellow-900/80 border border-yellow-600 text-yellow-200 text-xs text-center py-1.5 px-3 rounded-lg mb-2 animate-pulse">
          Reconnecting to server...
        </div>
      )}

      {/* Phase status banner */}
      <div className="mb-3">
        <PhaseStatus gameState={gameState} />
      </div>

      {/* Opponents */}
      <div className={`grid gap-2 mb-3 ${opponents.length <= 2 ? 'grid-cols-2' : opponents.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {opponents.map(p => (
          <div key={p.id} className="relative">
            <ReactionBubble playerId={p.id} />
            <PlayerSeat
              player={p}
              isCurrentTurn={p.id === currentPlayerId}
              isMe={false}
              timerExpiry={p.id === timerPlayerId ? gameState.timerExpiry : null}
            />
          </div>
        ))}
      </div>

      {/* Center: Log + Interactive area */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <GameCenterTabs
          log={gameState.actionLog}
          chatMessages={chatMessages}
          myId={gameState.myId}
          myName={me?.name ?? ''}
          onSendChat={onSendChat}
          turnPhase={gameState.turnPhase}
        />

        {/* Interactive prompts - only one shows at a time (hidden for spectators) */}
        {!isSpectator && (
          <div className="flex flex-col gap-2">
            <ActionBar gameState={gameState} />
            <ChallengePrompt gameState={gameState} />
            <BlockPrompt gameState={gameState} />
            <BlockChallengePrompt gameState={gameState} />
            <InfluenceLossPrompt gameState={gameState} />
            <ExchangeView gameState={gameState} />
            <ExaminePrompt gameState={gameState} />
            <WaitingView gameState={gameState} />
          </div>
        )}
      </div>

      {/* My hand - pinned to bottom */}
      {me && (
        <div className="relative mt-2">
          <ReactionBubble playerId={me.id} />
        <div className={`card-container !px-3 !py-2.5 ${!me.isAlive ? 'opacity-50' : 'border-coup-accent/30'} ${
          me.faction === 'Loyalist' ? 'border-l-[3px] border-l-blue-400 bg-blue-500/[0.07]' :
          me.faction === 'Reformist' ? 'border-l-[3px] border-l-red-400 bg-red-500/[0.07]' : ''
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-coup-accent text-sm flex items-center gap-1.5">
              Your Hand
              {me.faction && (
                <span className={`text-xs font-medium ${
                  me.faction === 'Loyalist' ? 'text-blue-300' : 'text-red-300'
                }`}>
                  ({me.faction})
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 text-coup-gold font-bold text-sm">
              <CoinIcon size={16} />
              {me.coins}
            </span>
          </div>
          <div className="flex gap-2 justify-center">
            {me.influences.map((inf, i) => (
              <CardFace key={i} influence={inf} size="md" />
            ))}
          </div>
          {!me.isAlive && (
            <p className="text-center text-red-400 text-xs mt-2 font-medium">You have been eliminated</p>
          )}
        </div>
        </div>
      )}

      <GameOverOverlay gameState={gameState} isHost={isHost && !isSpectator} onRematch={onRematch} isSpectator={isSpectator} />
      <ChallengeRevealOverlay />
      <HowToPlay open={showRules} onClose={() => setShowRules(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
