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
    // Keep the 288px panel on screen: anchor to the button's right edge, but
    // never let its left edge run past an 8px gutter on a narrow phone.
    const panelW = Math.min(288, window.innerWidth - 16);
    const right = Math.min(window.innerWidth - rect.right, window.innerWidth - panelW - 8);
    setPos({ top: rect.bottom + 6, right: Math.max(8, right) });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open, updatePos]);

  return (
    <div ref={containerRef}>
      <button
        ref={buttonRef}
        onClick={() => { haptic(); setOpen((o) => !o); }}
        disabled={disabled}
        className="court-icon-btn disabled:opacity-40 disabled:cursor-not-allowed"
        title="Send reaction"
        aria-label="Send reaction"
        aria-expanded={open}
      >
        😄
      </button>
      {open && pos && (
        <div
          className="fixed z-50 bg-coup-surface panel-sunk p-3 animate-fade-in w-72 max-w-[calc(100vw-1rem)]"
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
                className="flex flex-col items-center justify-center gap-1 min-h-[52px] p-2 rounded hover:bg-gray-700/50 active:bg-gray-700/70 transition"
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
