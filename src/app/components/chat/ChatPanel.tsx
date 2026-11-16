'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { ChatMessage } from '@/shared/types';
import { CHAT_MAX_MESSAGE_LENGTH, type QuickPhraseId } from '@/shared/constants';
import { haptic } from '../../utils/haptic';
import { useGameStore } from '../../stores/gameStore';
import { useT } from '../../i18n';
import { chatText } from '../game/tableText';

/** A one-tap line for the composer: its id, and the English sent to older clients. */
export interface QuickPhrase {
  id: QuickPhraseId;
  text: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  myId: string | null;
  /** Send typed text, or a quick phrase by `phraseId` (with its English as `message`). */
  onSend: (message: string, phraseId?: string) => void;
  /** `roomy` reads at body size for a panel that stays on screen. */
  variant?: 'compact' | 'roomy';
  /** One-tap lines shown above the field. */
  quickPhrases?: readonly QuickPhrase[];
  /** A control at the start of the composer row (Table talk puts the reaction picker here). */
  accessory?: ReactNode;
}

export function ChatPanel({ messages, myId, onSend, variant = 'compact', quickPhrases, accessory }: ChatPanelProps) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const mutedPlayerIds = useGameStore(s => s.mutedPlayerIds);
  const visibleMessages = messages.filter(msg => !mutedPlayerIds.includes(msg.playerId));

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length]);

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
        {visibleMessages.length === 0 && (
          <p className={`${variant === 'roomy' ? 'text-sm' : 'text-xs'} text-coup-ink-mute italic`}>{t('game.chatEmpty')}</p>
        )}
        {visibleMessages.map((msg) => {
          const isOwn = msg.playerId === myId;
          return (
            <div key={msg.id} className={variant === 'roomy' ? 'text-sm leading-snug' : 'text-xs'}>
              <span className={`font-medium ${isOwn ? 'text-coup-accent' : 'text-gray-300'}`}>
                {t.rich('game.chatSpeaker', { name: <bdi>{msg.playerName}</bdi> })}
              </span>{' '}
              {/* Typed chat in any script keeps its own direction; `dir="auto"` reads it from the text. */}
              <span className="text-gray-400" dir={msg.reactionId || msg.phraseId ? undefined : 'auto'}>{chatText(t, msg)}</span>
            </div>
          );
        })}
        <div />
      </div>
      {quickPhrases && quickPhrases.length > 0 && (
        <div className="chat-quick" aria-label={t('game.quickPhrasesLabel')}>
          {quickPhrases.map(phrase => (
            <button key={phrase.id} type="button" onClick={() => { haptic(); onSend(phrase.text, phrase.id); }}>
              {t(`game.phrase.${phrase.id}`)}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex gap-2 px-3 py-2 border-t border-coup-line/70">
        {accessory}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={CHAT_MAX_MESSAGE_LENGTH}
          placeholder={t('game.chatPlaceholder')}
          aria-label={t('game.chatInputLabel')}
          className="input-field flex-1 min-w-0 !text-base"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="btn-primary !text-base !px-4"
        >
          {t('game.chatSend')}
        </button>
      </form>
    </div>
  );
}
