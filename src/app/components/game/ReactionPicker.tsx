'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { REACTIONS } from '@/shared/constants';
import { haptic } from '../../utils/haptic';

interface ReactionPickerProps {
  onReact: (reactionId: string) => void;
  disabled?: boolean;
}

export function ReactionPicker({ onReact, disabled }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, updatePos]);

  return (
    <div ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => { haptic(); setOpen((o) => !o); }}
        disabled={disabled}
        className="w-9 h-9 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        title="Send reaction"
      >
        😄
      </button>
      {open && pos && (
        <div
          className="fixed z-50 bg-coup-surface border border-gray-600 rounded-xl p-3 shadow-xl animate-fade-in w-72"
          style={{ top: pos.top, right: pos.right }}
        >
          <div className="grid grid-cols-4 gap-2">
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  haptic();
                  onReact(r.id);
                  setOpen(false);
                }}
                className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-gray-700/50 active:bg-gray-700/70 transition"
                title={r.label}
              >
                <span className="text-2xl">{r.emoji}</span>
                <span className="text-[11px] text-gray-400 leading-tight">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
