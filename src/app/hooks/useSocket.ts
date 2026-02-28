'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/protocol';
import type { AiPersonality, RoomSettings } from '@/shared/types';
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
    roomCode,
    playerId,
  } = useGameStore();

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket.connected) {
      socket.connect();
    }

    socket.on('connect', () => {
      setConnected(true);

      // Attempt rejoin if we have room data
      const storedRoom = sessionStorage.getItem('coup_room');
      const storedPlayer = sessionStorage.getItem('coup_player');
      if (storedRoom && storedPlayer) {
        socket.emit('room:rejoin', {
          roomCode: storedRoom,
          playerId: storedPlayer,
        }, (response) => {
          if (!response.success) {
            sessionStorage.removeItem('coup_room');
            sessionStorage.removeItem('coup_player');
          }
        });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('room:updated', (data) => {
      setRoomPlayers(data.players, data.hostId, data.settings);
    });

    socket.on('game:state', (state) => {
      setGameState(state);
    });

    socket.on('game:error', (data) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('room:error', (data) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    socket.on('chat:message', (data) => {
      addChatMessage(data);
    });

    socket.on('chat:history', (data) => {
      setChatHistory(data.messages);
    });

    socket.on('game:rematch_to_lobby', () => {
      setGameState(null);
    });

    socket.on('game:challenge_reveal', (data) => {
      setChallengeReveal(data);
    });

    socket.on('browser:list', (data) => {
      setPublicRooms(data.rooms);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:updated');
      socket.off('game:state');
      socket.off('game:error');
      socket.off('room:error');
      socket.off('chat:message');
      socket.off('chat:history');
      socket.off('game:rematch_to_lobby');
      socket.off('game:challenge_reveal');
      socket.off('browser:list');
    };
  }, [setConnected, setRoomPlayers, setGameState, setError, addChatMessage, setChatHistory, setChallengeReveal, setPublicRooms]);

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

  const addBot = useCallback((name: string, personality: AiPersonality): Promise<string> => {
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
    rematch,
    addBot,
    removeBot,
    updateRoomSettings,
    subscribeToBrowser,
    unsubscribeFromBrowser,
  };
}
