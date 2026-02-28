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
import { GameCenterTabs } from './GameCenterTabs';
import { GameOverOverlay } from './GameOverOverlay';
import { ChallengeRevealOverlay } from './ChallengeRevealOverlay';
import { PhaseStatus } from './PhaseStatus';
import { WaitingView } from './WaitingView';
import { HowToPlay } from '../home/HowToPlay';

interface GameTableProps {
  gameState: ClientGameState;
  chatMessages: ChatMessage[];
  onSendChat: (message: string) => void;
  isHost: boolean;
  onRematch: () => void;
}

export function GameTable({ gameState, chatMessages, onSendChat, isHost, onRematch }: GameTableProps) {
  const [showRules, setShowRules] = useState(false);
  const me = gameState.players.find(p => p.id === gameState.myId);
  const opponents = gameState.players.filter(p => p.id !== gameState.myId);
  const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id;

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-3 py-3">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <span>Room: <span className="text-gray-400 font-mono">{gameState.roomCode}</span></span>
        <span>Turn {gameState.turnNumber}</span>
        <div className="flex items-center gap-2">
          <span>Deck: {gameState.deckCount}</span>
          <button
            onClick={() => setShowRules(true)}
            className="w-5 h-5 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-xs font-bold flex items-center justify-center"
            title="How to Play"
          >
            ?
          </button>
        </div>
      </div>

      {/* Phase status banner */}
      <div className="mb-3">
        <PhaseStatus gameState={gameState} />
      </div>

      {/* Opponents */}
      <div className={`grid gap-2 mb-3 ${opponents.length <= 2 ? 'grid-cols-2' : opponents.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {opponents.map(p => (
          <PlayerSeat
            key={p.id}
            player={p}
            isCurrentTurn={p.id === currentPlayerId}
            isMe={false}
            timerExpiry={p.id === currentPlayerId ? gameState.timerExpiry : null}
          />
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
        />

        {/* Interactive prompts - only one shows at a time */}
        <div className="flex flex-col gap-2">
          <ActionBar gameState={gameState} />
          <ChallengePrompt gameState={gameState} />
          <BlockPrompt gameState={gameState} />
          <BlockChallengePrompt gameState={gameState} />
          <InfluenceLossPrompt gameState={gameState} />
          <ExchangeView gameState={gameState} />
          <WaitingView gameState={gameState} />
        </div>
      </div>

      {/* My hand - pinned to bottom */}
      {me && (
        <div className={`mt-3 card-container ${!me.isAlive ? 'opacity-50' : 'border-coup-accent/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-coup-accent text-sm">Your Hand</span>
            <span className="flex items-center gap-1 text-coup-gold font-bold text-sm">
              <CoinIcon size={16} />
              {me.coins}
            </span>
          </div>
          <div className="flex gap-3 justify-center">
            {me.influences.map((inf, i) => (
              <CardFace key={i} influence={inf} size="lg" />
            ))}
          </div>
          {!me.isAlive && (
            <p className="text-center text-red-400 text-xs mt-2 font-medium">You have been eliminated</p>
          )}
        </div>
      )}

      <GameOverOverlay gameState={gameState} isHost={isHost} onRematch={onRematch} />
      <ChallengeRevealOverlay />
      <HowToPlay open={showRules} onClose={() => setShowRules(false)} />
    </div>
  );
}
