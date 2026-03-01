'use client';

import { useRef, useEffect, useState } from 'react';
import { ChatMessage } from '@/shared/types';
import { CHAT_MAX_MESSAGE_LENGTH } from '@/shared/constants';
import { haptic } from '../../utils/haptic';

interface ChatPanelProps {
  messages: ChatMessage[];
  myId: string | null;
  onSend: (message: string) => void;
}

export function ChatPanel({ messages, myId, onSend }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    haptic();
    onSend(trimmed);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 px-3 py-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-xs text-gray-600 italic">No messages yet...</p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.playerId === myId;
          return (
            <div key={msg.id} className="text-xs">
              <span className={`font-medium ${isOwn ? 'text-coup-accent' : 'text-gray-300'}`}>
                {msg.playerName}:
              </span>{' '}
              <span className="text-gray-400">{msg.message}</span>
            </div>
          );
        })}
        <div />
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2 border-t border-gray-800">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={CHAT_MAX_MESSAGE_LENGTH}
          placeholder="Type a message..."
          className="flex-1 bg-coup-bg border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-coup-accent/50"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="text-xs px-3 py-1.5 rounded-lg bg-coup-accent/20 text-coup-accent font-medium disabled:opacity-30 disabled:cursor-not-allowed hover:bg-coup-accent/30 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
