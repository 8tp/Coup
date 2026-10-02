'use client';

import { useEffect, useState } from 'react';
import type { ChatMessage } from '@/shared/types';
import { useGameStore } from '../../../stores/gameStore';

const SPEECH_MS = 5000;

/**
 * A player's latest chat line, said out loud at their seat for a few seconds.
 * The chat drawer keeps the record; this is the table hearing it.
 */
export function SeatSpeech({ playerId, messages }: { playerId: string; messages: ChatMessage[] }) {
  const muted = useGameStore(s => s.mutedPlayerIds.includes(playerId));
  const latest = [...messages].reverse().find(m => m.playerId === playerId);
  const [visibleId, setVisibleId] = useState<string | null>(null);

  useEffect(() => {
    if (!latest || Date.now() - latest.timestamp > SPEECH_MS) return;
    setVisibleId(latest.id);
    const t = setTimeout(() => setVisibleId(null), SPEECH_MS);
    return () => clearTimeout(t);
  }, [latest]);

  if (muted || !latest || visibleId !== latest.id) return null;
  return (
    <div className="seat-speech" role="status">
      {latest.message}
    </div>
  );
}
