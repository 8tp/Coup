'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { REACTIONS } from '@/shared/constants';
import { haptic } from '../../utils/haptic';
import { ReactGlyph } from '../icons';

interface ReactionPickerProps {
  onReact: (reactionId: string) => void;
  disabled?: boolean;
  /** `above` opens the panel upward, for a button at the bottom of the screen (the chat composer). */
  placement?: 'below' | 'above';
  /** Classes for the trigger button. */
  buttonClassName?: string;
}

export function ReactionPicker({ onReact, disabled, placement = 'below', buttonClassName = 'court-icon-btn' }: ReactionPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(null);

  const updatePos = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    // Keep the 288px panel on screen: anchor to the button's right edge, but
    // never let its left edge run past an 8px gutter on a narrow phone.
    const panelW = Math.min(288, window.innerWidth - 16);
    const right = Math.min(window.innerWidth - rect.right, window.innerWidth - panelW - 8);
    // Opening upward from the composer at the screen's left, it hangs off the
    // button's left edge instead.
    setPos(placement === 'above'
      ? { bottom: window.innerHeight - rect.top + 6, left: Math.max(8, Math.min(rect.left, window.innerWidth - panelW - 8)) }
      : { top: rect.bottom + 6, right: Math.max(8, right) });
  }, [placement]);

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
        className={`${buttonClassName} disabled:opacity-40 disabled:cursor-not-allowed`}
        title="Send a reaction"
        aria-label="Send a reaction"
        aria-expanded={open}
      >
        <ReactGlyph size={18} />
      </button>
      {open && pos && (
        <div
          className="fixed z-50 bg-coup-surface panel-sunk p-3 animate-fade-in w-72 max-w-[calc(100vw-1rem)]"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right }}
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
