'use client';

import { useEffect, useState } from 'react';
import type { ChatMessage } from '@/shared/types';
import { useGameStore } from '../../../stores/gameStore';
import { useT } from '../../../i18n';
import { chatText } from '../tableText';

const SPEECH_MS = 5000;

/**
 * A player's latest chat line, said out loud at their seat for a few seconds.
 * The chat drawer keeps the record; this is the table hearing it. Quick
 * phrases read in the reader's language (`chatText`). Reactions are left to
 * the seat's reaction bubble.
 */
export function SeatSpeech({ playerId, messages }: { playerId: string; messages: ChatMessage[] }) {
  const t = useT();
  const muted = useGameStore(s => s.mutedPlayerIds.includes(playerId));
  // A reaction already pops up over the seat as its bubble (ReactionBubble);
  // saying it again here showed it twice. Typed lines and quick phrases only.
  const latest = [...messages].reverse().find(m => m.playerId === playerId && !m.reactionId);
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    if (!latest || Date.now() - latest.timestamp > SPEECH_MS) return;
    setVisibleId(latest.id);
    const timer = setTimeout(() => setVisibleId(null), SPEECH_MS);
    return () => clearTimeout(timer);
  }, [latest]);

  if (muted || !latest || visibleId !== latest.id) return null;
  return (
    // The seat sits in the court table's left-to-right box; `dir="auto"` lets
    // a line in Arabic (typed, or a phrase in the reader's language) take
    // its own direction, so its punctuation lands on the right side.
    <div className="seat-speech" role="status" dir="auto">
      {chatText(t, latest)}
    </div>
  );
}
