'use client';

import { useState, useRef, useEffect } from 'react';
import { LogEntry, ChatMessage } from '@/shared/types';
import { ActionLog } from './ActionLog';
import { ChatPanel } from '../chat/ChatPanel';
import { haptic } from '../../utils/haptic';
import { useGameStore } from '../../stores/gameStore';
import { LogStamp, logKind, renderLogText, useLogContext } from './LogLine';

interface GameCenterTabsProps {
  log: LogEntry[];
  chatMessages: ChatMessage[];
  myId: string | null;
  /** Kept for callers; log lines name the reader by id. */
  myName?: string;
  onSendChat: (message: string) => void;
  turnPhase?: string;
  showLogExplanations?: boolean;
}

export function GameCenterTabs({ log, chatMessages, myId, onSendChat, turnPhase, showLogExplanations = false }: GameCenterTabsProps) {
  const logCtx = useLogContext();
  const { t } = logCtx;
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
    <div className="flex-1 min-h-0 flex flex-col bg-coup-bg/60 panel-sunk">
      {/* Tab headers */}
      <div className="flex border-b border-coup-line/70 relative">
        <button
          className={`flex-1 text-sm min-h-[44px] font-semibold transition ${
            activeTab === 'log' ? 'text-coup-accent border-b border-coup-accent' : 'text-coup-ink-mute hover:text-gray-300'
          }`}
          onClick={() => { haptic(); setActiveTab('log'); }}
        >
          {t('log.tabLog')}
        </button>
        <button
          className={`flex-1 text-sm min-h-[44px] font-semibold transition relative ${
            activeTab === 'chat' ? 'text-coup-accent border-b border-coup-accent' : 'text-coup-ink-mute hover:text-gray-300'
          }`}
          onClick={() => { haptic(); setActiveTab('chat'); }}
        >
          {t('log.tabChat')}
          {unreadCount > 0 && activeTab !== 'chat' && (
            <span className="absolute -top-0.5 -end-1 min-w-[18px] h-[18px] bg-coup-accent text-coup-bg text-[11px] font-bold rounded-full flex items-center justify-center px-1">
              {unreadCount > 9 ? t('log.unreadMany') : t.number(unreadCount)}
            </span>
          )}
        </button>
      </div>

      {latestEntry && (
        <div className="border-b border-coup-line/70 bg-coup-surface/40 px-3 py-1.5 text-xs text-gray-400">
          {/* The same line the log below renders, stamp and all. */}
          <div className="log-latest" data-kind={logKind(latestEntry)}>
            <span className="text-coup-ink-mute shrink-0">{t('log.latest')}</span>
            <LogStamp entry={latestEntry} />
            <span className="truncate text-gray-300">{renderLogText(latestEntry, logCtx)}</span>
          </div>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === 'log' ? (
          <ActionLog log={log} turnPhase={turnPhase} showExplanations={showLogExplanations} />
        ) : (
          <ChatPanel messages={visibleChatMessages} myId={myId} onSend={onSendChat} />
        )}
      </div>
    </div>
  );
}
