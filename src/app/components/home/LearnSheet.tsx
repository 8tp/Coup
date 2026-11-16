'use client';

import { useEffect, useId, useRef } from 'react';
import { haptic } from '../../utils/haptic';

/**
 * "Learn to play": the home screen's one door for newcomers. It replaces the
 * old How to play / Tutorial / Practice row with three plainly described
 * choices, the guided game first, and keeps the full practice setup one tap
 * further in. A bottom sheet on phones, a centred panel on desktop (the
 * practice sheet's chrome).
 */

interface LearnSheetProps {
  open: boolean;
  onClose: () => void;
  /** A private practice game: 1 gentle bot, Classic, coach on. */
  onGuidedGame: () => void;
  /** The interactive "How Coup works" tutorial. */
  onTutorial: () => void;
  /** The rules reference (How to play). */
  onRules: () => void;
  /** The practice setup sheet: opponents, bot style, rules, coach. */
  onPracticeSetup: () => void;
  loading?: boolean;
}

const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function LearnSheet({ open, onClose, onGuidedGame, onTutorial, onRules, onPracticeSetup, loading = false }: LearnSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    sheetRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const nodes = Array.from(sheetRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (nodes.length === 0) return;
      const at = nodes.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && at <= 0) { event.preventDefault(); nodes[nodes.length - 1].focus(); }
      else if (!event.shiftKey && (at === -1 || at === nodes.length - 1)) { event.preventDefault(); nodes[0].focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="practice-sheet-root">
      <div className="practice-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={sheetRef} className="practice-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="practice-sheet-head">
          <h2 id={titleId} className="practice-sheet-title type-display">Learn to play</h2>
          <button type="button" className="court-icon-btn" aria-label="Close" onClick={() => { haptic(); onClose(); }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M5.3 4 10 8.6 14.7 4 16 5.3 11.4 10l4.6 4.7-1.3 1.3-4.7-4.6L5.3 16 4 14.7 8.6 10 4 5.3z" />
            </svg>
          </button>
        </header>

        <div className="practice-sheet-body learn-options">
          <button
            type="button"
            className="btn-primary learn-option"
            data-autofocus=""
            onClick={() => { haptic(80); onGuidedGame(); }}
            disabled={loading}
          >
            <span className="learn-option-title">{loading ? 'Dealing…' : 'Play a guided game'}</span>
            <span className="learn-option-sub">You against 1 gentle bot. A coach points at what to do next.</span>
          </button>

          <button type="button" className="btn-secondary learn-option" onClick={() => { haptic(); onTutorial(); }}>
            <span className="learn-option-title">Take the tutorial</span>
            <span className="learn-option-sub">6 short lessons. You try each move on a small table.</span>
          </button>

          <button type="button" className="btn-secondary learn-option" onClick={() => { haptic(); onRules(); }}>
            <span className="learn-option-title">Read the rules</span>
            <span className="learn-option-sub">Characters, actions, challenges and blocks. Reformation too.</span>
          </button>
        </div>

        <footer className="practice-sheet-foot learn-foot">
          <span className="learn-foot-text">More bots, other rules, or no coach</span>
          <button type="button" className="menu-link" onClick={() => { haptic(); onPracticeSetup(); }}>
            Set up practice
          </button>
        </footer>
      </div>
    </div>
  );
}
