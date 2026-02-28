'use client';

import { useState, useRef, useEffect } from 'react';
import { LogEntry, ChatMessage } from '@/shared/types';
import { ActionLog } from './ActionLog';
import { ChatPanel } from '../chat/ChatPanel';

interface GameCenterTabsProps {
  log: LogEntry[];
  chatMessages: ChatMessage[];
  myId: string | null;
  myName: string;
  onSendChat: (message: string) => void;
}

export function GameCenterTabs({ log, chatMessages, myId, myName, onSendChat }: GameCenterTabsProps) {
  const [activeTab, setActiveTab] = useState<'log' | 'chat'>('log');
  const lastSeenCountRef = useRef(chatMessages.length);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (activeTab === 'chat') {
      lastSeenCountRef.current = chatMessages.length;
      setHasUnread(false);
    } else if (chatMessages.length > lastSeenCountRef.current) {
      setHasUnread(true);
    }
  }, [chatMessages.length, activeTab]);

  return (
    <div className="bg-coup-bg/60 rounded-lg border border-gray-800">
      {/* Tab headers */}
      <div className="flex border-b border-gray-800">
        <button
          className={`flex-1 text-xs py-1.5 font-medium transition ${
            activeTab === 'log' ? 'text-coup-accent border-b border-coup-accent' : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('log')}
        >
          Log
        </button>
        <button
          className={`flex-1 text-xs py-1.5 font-medium transition relative ${
            activeTab === 'chat' ? 'text-coup-accent border-b border-coup-accent' : 'text-gray-500 hover:text-gray-300'
          }`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
          {hasUnread && activeTab !== 'chat' && (
            <span className="absolute top-1 ml-1 w-1.5 h-1.5 bg-coup-accent rounded-full" />
          )}
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'log' ? (
        <ActionLog log={log} myName={myName} />
      ) : (
        <ChatPanel messages={chatMessages} myId={myId} onSend={onSendChat} />
      )}
    </div>
  );
}
