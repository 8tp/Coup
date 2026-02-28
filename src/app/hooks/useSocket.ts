'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/protocol';
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
      setRoomPlayers(data.players, data.hostId);
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

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room:updated');
      socket.off('game:state');
      socket.off('game:error');
      socket.off('room:error');
    };
  }, [setConnected, setRoomPlayers, setGameState, setError]);

  const createRoom = useCallback((playerName: string): Promise<{ roomCode: string; playerId: string }> => {
    return new Promise((resolve, reject) => {
      socketRef.current.emit('room:create', { playerName }, (response) => {
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

  return {
    socket: socketRef.current,
    createRoom,
    joinRoom,
    startGame,
    leaveRoom,
  };
}
