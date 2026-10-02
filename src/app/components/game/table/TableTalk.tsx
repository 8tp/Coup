'use client';

import { useEffect, useState } from 'react';
import type { ChatMessage } from '@/shared/types';
import { ChatPanel } from '../../chat/ChatPanel';
import { ReactionPicker } from '../ReactionPicker';
import { haptic } from '../../../utils/haptic';

const STORAGE_KEY = 'coup_table_talk_open';
const QUICK_PHRASES = ['Nice bluff', 'I have it', 'Liar!', 'Well played'] as const;

/**
 * The table's chat, always on screen on a desktop, beside your hand. It can be
 * folded down to a single bar (remembered per browser); folded, it still shows
 * how many lines arrived since. On phones chat lives in the log drawer instead
 * — this panel is hidden below 1024px by globals.css.
 *
 * Open, it also carries the reaction picker in its composer; globals.css hides
 * the header's picker on desktop while this one is showing.
 */
export function TableTalk({
  messages,
  myId,
  onSend,
  onReact,
  reactDisabled,
}: {
  messages: ChatMessage[];
  myId: string;
  onSend: (message: string) => void;
  onReact: (reactionId: string) => void;
  reactDisabled?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [seen, setSeen] = useState(messages.length);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'false') setOpen(false);
  }, []);

  useEffect(() => {
    if (open) setSeen(messages.length);
  }, [open, messages.length]);

  const toggle = () => {
    haptic();
    setOpen(o => {
      localStorage.setItem(STORAGE_KEY, String(!o));
      return !o;
    });
  };
  const unread = open ? 0 : Math.max(0, messages.length - seen);

  return (
    <section className={`table-talk ${open ? 'is-open' : ''}`} aria-label="Table chat">
      <button type="button" className="table-talk-head" onClick={toggle} aria-expanded={open}>
        <span className="type-display">Table talk</span>
        {unread > 0 && <span className="court-badge figure !static">{unread > 9 ? '9+' : unread}</span>}
        <span className="table-talk-chevron" aria-hidden="true">{open ? '▾' : '▴'}</span>
      </button>
      {open && (
        <div className="table-talk-body">
          <ChatPanel
            messages={messages}
            myId={myId}
            onSend={onSend}
            variant="roomy"
            quickPhrases={QUICK_PHRASES}
            accessory={(
              <ReactionPicker
                onReact={onReact}
                disabled={reactDisabled}
                placement="above"
                buttonClassName="court-icon-btn table-talk-react"
              />
            )}
          />
        </div>
      )}
    </section>
  );
}
