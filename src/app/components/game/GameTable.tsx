'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { PlayerSeat } from './PlayerSeat';
import { CardFace } from './CardFace';
import { ActionBar } from './ActionBar';
import { ChallengePrompt } from './ChallengePrompt';
import { BlockPrompt } from './BlockPrompt';
import { BlockChallengePrompt } from './BlockChallengePrompt';
import { InfluenceLossPrompt } from './InfluenceLossPrompt';
import { ExchangeView } from './ExchangeView';
import { ActionLog } from './ActionLog';
import { GameOverOverlay } from './GameOverOverlay';
import { PhaseStatus } from './PhaseStatus';

interface GameTableProps {
  gameState: ClientGameState;
}

export function GameTable({ gameState }: GameTableProps) {
  const me = gameState.players.find(p => p.id === gameState.myId);
  const opponents = gameState.players.filter(p => p.id !== gameState.myId);
  const currentPlayerId = gameState.players[gameState.currentPlayerIndex]?.id;

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto px-3 py-3">
      {/* Header bar */}
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <span>Room: <span className="text-gray-400 font-mono">{gameState.roomCode}</span></span>
        <span>Turn {gameState.turnNumber}</span>
        <span>Deck: {gameState.deckCount}</span>
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
          />
        ))}
      </div>

      {/* Center: Log + Interactive area */}
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        <ActionLog log={gameState.actionLog} />

        {/* Interactive prompts - only one shows at a time */}
        <div className="flex flex-col gap-2">
          <ActionBar gameState={gameState} />
          <ChallengePrompt gameState={gameState} />
          <BlockPrompt gameState={gameState} />
          <BlockChallengePrompt gameState={gameState} />
          <InfluenceLossPrompt gameState={gameState} />
          <ExchangeView gameState={gameState} />
        </div>
      </div>

      {/* My hand - pinned to bottom */}
      {me && (
        <div className={`mt-3 card-container ${!me.isAlive ? 'opacity-50' : 'border-coup-accent/30'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-coup-accent text-sm">Your Hand</span>
            <span className="text-coup-gold font-bold text-sm">
              {me.coins} coin{me.coins !== 1 ? 's' : ''}
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

      <GameOverOverlay gameState={gameState} />
    </div>
  );
}
