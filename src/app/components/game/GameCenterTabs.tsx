'use client';

import { useState, useRef, useEffect } from 'react';
import { LogEntry, ChatMessage } from '@/shared/types';
import { ActionLog } from './ActionLog';
import { ChatPanel } from '../chat/ChatPanel';
import { haptic } from '../../utils/haptic';
import { LOG_EVENT_ICONS } from '@/shared/constants';
import { formatLogMessage } from '@/app/utils/logFormat';
import { useGameStore } from '../../stores/gameStore';

interface GameCenterTabsProps {
  log: LogEntry[];
  chatMessages: ChatMessage[];
  myId: string | null;
  myName: string;
  onSendChat: (message: string) => void;
  turnPhase?: string;
  showLogExplanations?: boolean;
}

export function GameCenterTabs({ log, chatMessages, myId, myName, onSendChat, turnPhase, showLogExplanations = false }: GameCenterTabsProps) {
  const mutedPlayerIds = useGameStore(s => s.mutedPlayerIds);
  const visibleChatMessages = chatMessages.filter(msg => !mutedPlayerIds.includes(msg.playerId));
  const [activeTab, setActiveTab] = useState<'log' | 'chat'>('log');
  const lastSeenCountRef = useRef(visibleChatMessages.length);
  const [unreadCount, setUnreadCount] = useState(0);
  const latestEntry = log[log.length - 1];

  useEffect(() => {
    if (activeTab === 'chat') {
      lastSeenCountRef.current = visibleChatMessages.length;
      setUnreadCount(0);
    } else if (visibleChatMessages.length > lastSeenCountRef.current) {
      setUnreadCount(visibleChatMessages.length - lastSeenCountRef.current);
    } else {
      setUnreadCount(0);
    }
  }, [visibleChatMessages.length, activeTab]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-coup-bg/60 rounded-lg border border-gray-800">
      {/* Tab headers */}
      <div className="flex border-b border-gray-800 relative">
        <button
          className={`flex-1 text-xs py-1.5 font-medium transition ${
            activeTab === 'log' ? 'text-coup-accent border-b border-coup-accent' : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => { haptic(); setActiveTab('log'); }}
        >
          Log
        </button>
        <button
          className={`flex-1 text-xs py-1.5 font-medium transition relative ${
            activeTab === 'chat' ? 'text-coup-accent border-b border-coup-accent' : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => { haptic(); setActiveTab('chat'); }}
        >
          Chat
          {unreadCount > 0 && activeTab !== 'chat' && (
            <span className="absolute -top-0.5 -right-1 min-w-[18px] h-[18px] bg-coup-accent text-coup-bg text-[10px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {latestEntry && (
        <div className="border-b border-gray-800 bg-coup-surface/40 px-3 py-1.5 text-xs text-gray-400">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-gray-500 shrink-0">Latest</span>
            <span className="shrink-0">{LOG_EVENT_ICONS[latestEntry.eventType] ?? ''}</span>
            <span className="truncate text-gray-300">{formatLogMessage(latestEntry.message, myName)}</span>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'log' ? (
          <ActionLog log={log} myName={myName} turnPhase={turnPhase} showExplanations={showLogExplanations} />
        ) : (
          <ChatPanel messages={visibleChatMessages} myId={myId} onSend={onSendChat} />
        )}
      </div>
    </div>
  );
}
