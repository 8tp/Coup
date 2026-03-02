'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/protocol';
import type { BotPersonality, RoomSettings } from '@/shared/types';
import { useGameStore } from '../stores/gameStore';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

export function getSocket(): TypedSocket {
  if (!globalSocket) {
    globalSocket = io({
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return globalSocket;
}

export function useSocket() {
  const socketRef = useRef<TypedSocket>(getSocket());
  const {
    setConnected,
    setRoomPlayers,
    setGameState,
    setError,
    addChatMessage,
    setChatHistory,
    setChallengeReveal,
    setPublicRooms,
    setReaction,
    setServerStats,
    roomCode,
    playerId,
  } = useGameStore();

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket.connected) {
      socket.connect();
    }

    // Use named handlers so cleanup only removes THIS component's listeners
    const onConnect = () => {
      setConnected(true);

      // Attempt rejoin if we have room data
      const storedRoom = sessionStorage.getItem('coup_room');
      const storedPlayer = sessionStorage.getItem('coup_player');
      if (storedRoom && storedPlayer) {
        socket.emit('room:rejoin', {
          roomCode: storedRoom,
          playerId: storedPlayer,
        }, (response) => {
          if (response.success) {
            // Restore store state from sessionStorage after reconnection
            useGameStore.getState().setRoom(storedRoom, storedPlayer);
          } else {
            sessionStorage.removeItem('coup_room');
            sessionStorage.removeItem('coup_player');
            useGameStore.getState().clearRoom();
            useGameStore.getState().setGameState(null);
          }
        });
      }
    };

    const onDisconnect = () => {
      setConnected(false);
    };

    const onRoomUpdatedRaw = (data: { players: any; hostId: string; settings: any; lastWinnerId?: string | null }) => {
      setRoomPlayers(data.players, data.hostId, data.settings, data.lastWinnerId);
    };

    const onGameState = (state: any) => {
      setGameState(state);
    };

    const onGameError = (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    };

    const onRoomError = (data: { message: string }) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    };

    const onChatMessage = (data: any) => {
      addChatMessage(data);
    };

    const onChatHistory = (data: { messages: any[] }) => {
      setChatHistory(data.messages);
    };

    const onRematchToLobby = () => {
      setGameState(null);
    };

    const onChallengeReveal = (data: any) => {
      setChallengeReveal(data);
    };

    const onBrowserList = (data: { rooms: any[] }) => {
      setPublicRooms(data.rooms);
    };

    const onReactionFired = (data: { playerId: string; reactionId: string; timestamp: number }) => {
      setReaction(data.playerId, data.reactionId, data.timestamp);
    };

    const onServerStats = (data: { playersOnline: number; gamesInProgress: number }) => {
      setServerStats(data.playersOnline, data.gamesInProgress);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room:updated', onRoomUpdatedRaw);
    socket.on('game:state', onGameState);
    socket.on('game:error', onGameError);
    socket.on('room:error', onRoomError);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:history', onChatHistory);
    socket.on('game:rematch_to_lobby', onRematchToLobby);
    socket.on('game:challenge_reveal', onChallengeReveal);
    socket.on('browser:list', onBrowserList);
    socket.on('reaction:fired', onReactionFired);
    socket.on('server:stats', onServerStats);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:updated', onRoomUpdatedRaw);
      socket.off('game:state', onGameState);
      socket.off('game:error', onGameError);
      socket.off('room:error', onRoomError);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:history', onChatHistory);
      socket.off('game:rematch_to_lobby', onRematchToLobby);
      socket.off('game:challenge_reveal', onChallengeReveal);
      socket.off('browser:list', onBrowserList);
      socket.off('reaction:fired', onReactionFired);
      socket.off('server:stats', onServerStats);
    };
  }, [setConnected, setRoomPlayers, setGameState, setError, addChatMessage, setChatHistory, setChallengeReveal, setPublicRooms, setReaction, setServerStats]);

  const createRoom = useCallback((playerName: string, isPublic?: boolean): Promise<{ roomCode: string; playerId: string }> => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('room:create', { playerName, isPublic }, (response) => {
        if (response.success && response.roomCode && response.playerId) {
          sessionStorage.setItem('coup_room', response.roomCode);
          sessionStorage.setItem('coup_player', response.playerId);
          resolve({ roomCode: response.roomCode, playerId: response.playerId });
        } else {
          reject(new Error(response.error || 'Failed to create room'));
        }
      });
    });
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string): Promise<{ roomCode: string; playerId: string }> => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('room:join', { roomCode, playerName }, (response) => {
        if (response.success && response.roomCode && response.playerId) {
          sessionStorage.setItem('coup_room', response.roomCode);
          sessionStorage.setItem('coup_player', response.playerId);
          resolve({ roomCode: response.roomCode, playerId: response.playerId });
        } else {
          reject(new Error(response.error || 'Failed to join room'));
        }
      });
    });
  }, []);

  const startGame = useCallback(() => {
    socketRef.current.emit('game:start');
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current.emit('room:leave');
    sessionStorage.removeItem('coup_room');
    sessionStorage.removeItem('coup_player');
  }, []);

  const sendChat = useCallback((message: string) => {
    socketRef.current.emit('chat:send', { message });
  }, []);

  const rematch = useCallback(() => {
    socketRef.current.emit('game:rematch');
  }, []);

  const addBot = useCallback((name: string, personality: BotPersonality): Promise<string> => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('bot:add', { name, personality }, (response) => {
        if (response.success && response.botId) {
          resolve(response.botId);
        } else {
          reject(new Error(response.error || 'Failed to add bot'));
        }
      });
    });
  }, []);

  const updateRoomSettings = useCallback((settings: RoomSettings): Promise<void> => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('room:update_settings', { settings }, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to update settings'));
        }
      });
    });
  }, []);

  const removeBot = useCallback((botId: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('bot:remove', { botId }, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to remove bot'));
        }
      });
    });
  }, []);

  const sendReaction = useCallback((reactionId: string) => {
    socketRef.current.emit('reaction:send', { reactionId });
  }, []);

  const subscribeToBrowser = useCallback(() => {
    socketRef.current.emit('browser:subscribe');
  }, []);

  const unsubscribeFromBrowser = useCallback(() => {
    socketRef.current.emit('browser:unsubscribe');
  }, []);

  return {
    socket: socketRef.current,
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
    sendChat,
    sendReaction,
    rematch,
    addBot,
    removeBot,
    updateRoomSettings,
    subscribeToBrowser,
    unsubscribeFromBrowser,
  };
}
