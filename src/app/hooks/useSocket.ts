'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/shared/protocol';
import type { BotPersonality, ChallengeRevealEvent, ChatMessage, ClientGameState, ClientRoomPlayer, ClientSpectator, PublicRoomInfo, RoomSettings } from '@/shared/types';
import { useGameStore } from '../stores/gameStore';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let globalSocket: TypedSocket | null = null;

const SOCKET_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms = SOCKET_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

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
    const errorTimers: ReturnType<typeof setTimeout>[] = [];

    if (!socket.connected) {
      socket.connect();
    }

    // Use named handlers so cleanup only removes THIS component's listeners
    const onConnect = () => {
      setConnected(true);
      useGameStore.getState().setReconnecting(false);

      // Attempt rejoin if we have room data
      const storedRoom = sessionStorage.getItem('coup_room');
      const storedPlayer = sessionStorage.getItem('coup_player');
      const storedToken = sessionStorage.getItem('coup_session_token');
      const isSpectator = sessionStorage.getItem('coup_spectator') === 'true';
      if (storedRoom && storedPlayer) {
        if (isSpectator) {
          // Spectators re-spectate instead of attempting player rejoin
          const storedName = sessionStorage.getItem('coup_player_name') || 'Spectator';
          socket.emit('room:spectate', {
            roomCode: storedRoom,
            playerName: storedName,
          }, (response) => {
            if (response.success && response.spectatorId) {
              sessionStorage.setItem('coup_player', response.spectatorId);
              useGameStore.getState().setSpectating(storedRoom, response.spectatorId);
            } else {
              sessionStorage.removeItem('coup_room');
              sessionStorage.removeItem('coup_player');
              sessionStorage.removeItem('coup_spectator');
              useGameStore.getState().clearRoom();
              useGameStore.getState().setGameState(null);
            }
          });
        } else {
          socket.emit('room:rejoin', {
            roomCode: storedRoom,
            playerId: storedPlayer,
            sessionToken: storedToken ?? undefined,
          }, (response) => {
            if (response.success) {
              // Restore store state from sessionStorage after reconnection
              useGameStore.getState().setRoom(storedRoom, storedPlayer);
            } else {
              sessionStorage.removeItem('coup_room');
              sessionStorage.removeItem('coup_player');
              sessionStorage.removeItem('coup_session_token');
              useGameStore.getState().clearRoom();
              useGameStore.getState().setGameState(null);
            }
          });
        }
      }
    };

    const onDisconnect = () => {
      setConnected(false);
      useGameStore.getState().setReconnecting(true);
    };

    const onReconnectAttempt = () => {
      useGameStore.getState().setReconnecting(true);
    };

    const onReconnect = () => {
      useGameStore.getState().setReconnecting(false);
    };

    const onReconnectFailed = () => {
      useGameStore.getState().setReconnecting(false);
    };

    const onRoomUpdatedRaw = (data: { players: ClientRoomPlayer[]; hostId: string; settings: RoomSettings; lastWinnerId?: string | null; spectators?: ClientSpectator[] }) => {
      setRoomPlayers(data.players, data.hostId, data.settings, data.lastWinnerId, data.spectators);
    };

    const onGameState = (state: ClientGameState) => {
      setGameState(state);
    };

    const onGameError = (data: { message: string }) => {
      setError(data.message);
      errorTimers.push(setTimeout(() => setError(null), 3000));
    };

    const onRoomError = (data: { message: string }) => {
      setError(data.message);
      errorTimers.push(setTimeout(() => setError(null), 3000));
    };

    const onChatMessage = (data: ChatMessage) => {
      addChatMessage(data);
    };

    const onChatHistory = (data: { messages: ChatMessage[] }) => {
      setChatHistory(data.messages);
    };

    const onRematchToLobby = () => {
      setGameState(null);
    };

    const onSpectatorPromoted = (data: { playerId: string; sessionToken: string }) => {
      // Spectator has been promoted to a player in the lobby
      const storedRoom = sessionStorage.getItem('coup_room');
      if (storedRoom) {
        sessionStorage.setItem('coup_player', data.playerId);
        sessionStorage.setItem('coup_session_token', data.sessionToken);
        sessionStorage.removeItem('coup_spectator');
        sessionStorage.removeItem('coup_player_name');
        useGameStore.getState().setRoom(storedRoom, data.playerId);
        setGameState(null);
      }
    };

    const onChallengeReveal = (data: ChallengeRevealEvent) => {
      setChallengeReveal(data);
    };

    const onBrowserList = (data: { rooms: PublicRoomInfo[] }) => {
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
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.io.on('reconnect', onReconnect);
    socket.io.on('reconnect_failed', onReconnectFailed);
    socket.on('room:updated', onRoomUpdatedRaw);
    socket.on('game:state', onGameState);
    socket.on('game:error', onGameError);
    socket.on('room:error', onRoomError);
    socket.on('chat:message', onChatMessage);
    socket.on('chat:history', onChatHistory);
    socket.on('game:rematch_to_lobby', onRematchToLobby);
    socket.on('spectator:promoted', onSpectatorPromoted);
    socket.on('game:challenge_reveal', onChallengeReveal);
    socket.on('browser:list', onBrowserList);
    socket.on('reaction:fired', onReactionFired);
    socket.on('server:stats', onServerStats);

    return () => {
      errorTimers.forEach(clearTimeout);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.io.off('reconnect', onReconnect);
      socket.io.off('reconnect_failed', onReconnectFailed);
      socket.off('room:updated', onRoomUpdatedRaw);
      socket.off('game:state', onGameState);
      socket.off('game:error', onGameError);
      socket.off('room:error', onRoomError);
      socket.off('chat:message', onChatMessage);
      socket.off('chat:history', onChatHistory);
      socket.off('game:rematch_to_lobby', onRematchToLobby);
      socket.off('spectator:promoted', onSpectatorPromoted);
      socket.off('game:challenge_reveal', onChallengeReveal);
      socket.off('browser:list', onBrowserList);
      socket.off('reaction:fired', onReactionFired);
      socket.off('server:stats', onServerStats);
    };
  }, [setConnected, setRoomPlayers, setGameState, setError, addChatMessage, setChatHistory, setChallengeReveal, setPublicRooms, setReaction, setServerStats]);

  const createRoom = useCallback((playerName: string, isPublic?: boolean): Promise<{ roomCode: string; playerId: string }> => {
    return withTimeout(new Promise((resolve, reject) => {
      socketRef.current.emit('room:create', { playerName, isPublic }, (response) => {
        if (response.success && response.roomCode && response.playerId) {
          sessionStorage.setItem('coup_room', response.roomCode);
          sessionStorage.setItem('coup_player', response.playerId);
          if (response.sessionToken) {
            sessionStorage.setItem('coup_session_token', response.sessionToken);
          }
          resolve({ roomCode: response.roomCode, playerId: response.playerId });
        } else {
          reject(new Error(response.error || 'Failed to create room'));
        }
      });
    }));
  }, []);

  const joinRoom = useCallback((roomCode: string, playerName: string): Promise<{ roomCode: string; playerId: string }> => {
    return withTimeout(new Promise((resolve, reject) => {
      socketRef.current.emit('room:join', { roomCode, playerName }, (response) => {
        if (response.success && response.roomCode && response.playerId) {
          sessionStorage.setItem('coup_room', response.roomCode);
          sessionStorage.setItem('coup_player', response.playerId);
          if (response.sessionToken) {
            sessionStorage.setItem('coup_session_token', response.sessionToken);
          }
          resolve({ roomCode: response.roomCode, playerId: response.playerId });
        } else {
          reject(new Error(response.error || 'Failed to join room'));
        }
      });
    }));
  }, []);

  const startGame = useCallback(() => {
    socketRef.current.emit('game:start');
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current.emit('room:leave');
    sessionStorage.removeItem('coup_room');
    sessionStorage.removeItem('coup_player');
    sessionStorage.removeItem('coup_session_token');
  }, []);

  const sendChat = useCallback((message: string) => {
    socketRef.current.emit('chat:send', { message });
  }, []);

  const rematch = useCallback(() => {
    socketRef.current.emit('game:rematch');
  }, []);

  const addBot = useCallback((name: string, personality: BotPersonality): Promise<string> => {
    return withTimeout(new Promise((resolve, reject) => {
      socketRef.current.emit('bot:add', { name, personality }, (response) => {
        if (response.success && response.botId) {
          resolve(response.botId);
        } else {
          reject(new Error(response.error || 'Failed to add bot'));
        }
      });
    }));
  }, []);

  const updateRoomSettings = useCallback((settings: RoomSettings): Promise<void> => {
    return withTimeout(new Promise((resolve, reject) => {
      socketRef.current.emit('room:update_settings', { settings }, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to update settings'));
        }
      });
    }));
  }, []);

  const removeBot = useCallback((botId: string): Promise<void> => {
    return withTimeout(new Promise((resolve, reject) => {
      socketRef.current.emit('bot:remove', { botId }, (response) => {
        if (response.success) {
          resolve();
        } else {
          reject(new Error(response.error || 'Failed to remove bot'));
        }
      });
    }));
  }, []);

  const sendReaction = useCallback((reactionId: string) => {
    socketRef.current.emit('reaction:send', { reactionId });
  }, []);

  const spectateRoom = useCallback((roomCode: string, playerName: string): Promise<{ roomCode: string; spectatorId: string }> => {
    return withTimeout(new Promise((resolve, reject) => {
      socketRef.current.emit('room:spectate', { roomCode, playerName }, (response) => {
        if (response.success && response.roomCode && response.spectatorId) {
          sessionStorage.setItem('coup_room', response.roomCode);
          sessionStorage.setItem('coup_player', response.spectatorId);
          sessionStorage.setItem('coup_spectator', 'true');
          sessionStorage.setItem('coup_player_name', playerName);
          resolve({ roomCode: response.roomCode, spectatorId: response.spectatorId });
        } else {
          reject(new Error(response.error || 'Failed to spectate'));
        }
      });
    }));
  }, []);

  const stopSpectating = useCallback(() => {
    socketRef.current.emit('room:stop_spectating');
    sessionStorage.removeItem('coup_room');
    sessionStorage.removeItem('coup_player');
    sessionStorage.removeItem('coup_spectator');
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
    spectateRoom,
    stopSpectating,
    subscribeToBrowser,
    unsubscribeFromBrowser,
  };
}
