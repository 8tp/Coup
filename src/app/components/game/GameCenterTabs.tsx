'use client';

import { useState, useRef, useEffect } from 'react';
import { LogEntry, ChatMessage } from '@/shared/types';
import { ActionLog } from './ActionLog';
import { ChatPanel } from '../chat/ChatPanel';
import { haptic } from '../../utils/haptic';

interface GameCenterTabsProps {
  log: LogEntry[];
  chatMessages: ChatMessage[];
  myId: string | null;
  myName: string;
  onSendChat: (message: string) => void;
  turnPhase?: string;
}

export function GameCenterTabs({ log, chatMessages, myId, myName, onSendChat, turnPhase }: GameCenterTabsProps) {
  const [activeTab, setActiveTab] = useState<'log' | 'chat'>('log');
  const lastSeenCountRef = useRef(chatMessages.length);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (activeTab === 'chat') {
      lastSeenCountRef.current = chatMessages.length;
      setUnreadCount(0);
    } else if (chatMessages.length > lastSeenCountRef.current) {
      setUnreadCount(chatMessages.length - lastSeenCountRef.current);
    }
  }, [chatMessages.length, activeTab]);

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

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'log' ? (
          <ActionLog log={log} myName={myName} turnPhase={turnPhase} />
        ) : (
          <ChatPanel messages={chatMessages} myId={myId} onSend={onSendChat} />
        )}
      </div>
    </div>
  );
}
