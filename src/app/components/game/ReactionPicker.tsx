'use client';

import { useState, useRef, useEffect } from 'react';
import { REACTIONS } from '@/shared/constants';

interface ReactionPickerProps {
  onReact: (reactionId: string) => void;
  disabled?: boolean;
}

export function ReactionPicker({ onReact, disabled }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="w-5 h-5 rounded-full border border-gray-600 text-gray-400 hover:border-coup-accent hover:text-coup-accent transition text-xs flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        title="Send reaction"
      >
        😄
      </button>
      {open && (
        <div className="fixed inset-x-0 bottom-0 sm:absolute sm:inset-auto sm:bottom-full sm:right-0 sm:mb-2 z-30 bg-coup-surface border border-gray-600 sm:rounded-xl rounded-t-xl p-3 shadow-xl animate-fade-in">
          <div className="grid grid-cols-4 gap-2 max-w-sm mx-auto">
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  onReact(r.id);
                  setOpen(false);
                }}
                className="flex flex-col items-center gap-1 p-2.5 rounded-xl hover:bg-gray-700/50 active:bg-gray-700/70 transition"
                title={r.label}
              >
                <span className="text-2xl">{r.emoji}</span>
                <span className="text-xs text-gray-400 leading-tight">{r.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
