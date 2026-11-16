'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { GameTable } from '../../components/game/GameTable';
import { useGameMusic } from '../../hooks/useMusicDirector';
import { QUICK_PLAY_BOT_COUNT } from '@/shared/constants';
import { buildBots } from '../../utils/botFill';
import { loadSavedPlayerName, savePlayerName } from '../../utils/playerName';

export default function GamePage() {
  const router = useRouter();
  const { sendChat, sendReaction, rematch, stopSpectating, leaveRoom, createRoom, addBots, startGame } = useSocket();

  const { gameState, chatMessages, playerId, hostId, error, isSpectator } = useGameStore();
  const [isPracticeRoom, setIsPracticeRoom] = useState(false);
  /* A knocked-out player asked for a new game: the old room is gone and the
     new one is being dealt. While this is set, a missing game state means
     "dealing", not "the game ended", so the redirect below holds off. */
  const [dealingNew, setDealingNew] = useState(false);

  const isHost = !isSpectator && playerId === hostId;

  // Audio unlock on the first gesture, then the score follows the game —
  // court / tension / duel / sudden death, or fallen once you are out — and
  // stops at game over. See hooks/useMusicDirector.ts.
  useGameMusic(gameState);

  const clearPracticeSession = useCallback(() => {
    sessionStorage.removeItem('coup_practice_room');
    sessionStorage.removeItem('coup_room');
    sessionStorage.removeItem('coup_player');
    sessionStorage.removeItem('coup_session_token');
    sessionStorage.removeItem('coup_spectator');
    sessionStorage.removeItem('coup_player_name');
    useGameStore.getState().clearRoom();
  }, []);

  useEffect(() => {
    setIsPracticeRoom(sessionStorage.getItem('coup_practice_room') === 'true');
  }, []);

  // Redirect when game state is cleared (rematch -> lobby) or missing
  useEffect(() => {
    if (gameState && dealingNew) setDealingNew(false);
  }, [gameState, dealingNew]);

  useEffect(() => {
    if (!gameState && !dealingNew) {
      // Small delay to allow state to load (reconnection)
      const timer = setTimeout(() => {
        const current = useGameStore.getState();
        if (!current.gameState) {
          const isPracticeSession = sessionStorage.getItem('coup_practice_room') === 'true';
          if (current.isSpectator) {
            // Spectator: game ended, go home
            current.clearRoom();
            router.push('/');
          } else if (isPracticeSession) {
            // Practice games are disposable and should not return to a lobby.
            clearPracticeSession();
            router.push('/');
          } else if (current.roomCode) {
            // Rematch: sent back to lobby
            router.push(`/lobby/${current.roomCode}`);
          } else {
            router.push('/');
          }
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [clearPracticeSession, dealingNew, gameState, router]);

  const handleExitPractice = useCallback(() => {
    leaveRoom();
    clearPracticeSession();
    router.push('/');
  }, [clearPracticeSession, leaveRoom, router]);

  /* A knocked-out player's way out. The game carries on without them: the
     server hands nothing to a bot for a player who is already out, and if
     they were the last person at the table it closes the room. */
  const handleLeaveTable = useCallback(() => {
    leaveRoom();
    clearPracticeSession();
    router.push('/');
  }, [clearPracticeSession, leaveRoom, router]);

  /* The menu's Play vs Bots (`handleQuickPlay` in app/page.tsx), from the
     table: leave this room, open a new one, seat the bots and deal. */
  const handleNewGame = useCallback(async () => {
    if (dealingNew) return;
    const current = useGameStore.getState();
    const seatName = current.gameState?.players.find(p => p.id === current.playerId)?.name;
    const playerName = (seatName || loadSavedPlayerName()).trim();
    if (!playerName) {
      handleLeaveTable();
      return;
    }
    setDealingNew(true);
    leaveRoom();
    clearPracticeSession();
    setIsPracticeRoom(false);
    let roomCreated = false;
    try {
      const result = await createRoom(playerName, false, 'quick_play');
      roomCreated = true;
      savePlayerName(playerName);
      useGameStore.getState().setRoom(result.roomCode, result.playerId);
      await addBots(buildBots(QUICK_PLAY_BOT_COUNT, [playerName]));
      startGame();
      router.replace(`/game/${result.roomCode}`);
    } catch (e: unknown) {
      if (roomCreated) {
        leaveRoom();
        useGameStore.getState().clearRoom();
      }
      setDealingNew(false);
      useGameStore.getState().setError(e instanceof Error ? e.message : 'Could not start a game');
      router.push('/');
    }
  }, [addBots, clearPracticeSession, createRoom, dealingNew, handleLeaveTable, leaveRoom, router, startGame]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">{dealingNew ? 'Dealing…' : 'Connecting…'}</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50
          bg-red-900/90 panel-sunk px-4 py-2 text-sm animate-fade-in">
          {error}
        </div>
      )}
      <GameTable
        gameState={gameState}
        chatMessages={chatMessages}
        onSendChat={isSpectator ? () => {} : sendChat}
        onSendReaction={sendReaction}
        isHost={isHost}
        onRematch={rematch}
        isSpectator={isSpectator}
        isPracticeRoom={isPracticeRoom}
        onExitPractice={handleExitPractice}
        onStopSpectating={isSpectator ? () => {
          stopSpectating();
          useGameStore.getState().clearRoom();
          router.push('/');
        } : undefined}
        onLeaveTable={isSpectator ? undefined : handleLeaveTable}
        onNewGame={isSpectator ? undefined : handleNewGame}
        newGamePending={dealingNew}
      />
    </>
  );
}
