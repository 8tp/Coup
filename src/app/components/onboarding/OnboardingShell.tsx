'use client';

import { useCallback, useEffect, useId, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { haptic } from '../../utils/haptic';

/**
 * The stage every onboarding walkthrough is played on — "How Coup works" and
 * the Reformation walkthrough share it.
 *
 * A full-screen sheet on phones and a centred ~880px stage over the dimmed
 * room on desktop. It owns everything that is the same in every chapter:
 * the progress rail, Back/Next, the keyboard (←/→/Esc), swipe on touch, the
 * focus trap, and the reduced-motion switch. Chapters bring only their
 * content.
 */

export interface OnboardingChapter {
  id: string;
  label: string;
}

interface OnboardingShellProps {
  open: boolean;
  onClose: () => void;
  /** The dialog's accessible name, e.g. "How Coup works". */
  title: string;
  /** Segments of the progress rail. An index past the end means "finished". */
  chapters: readonly OnboardingChapter[];
  index: number;
  onGoto: (index: number) => void;
  onNext: () => void;
  onBack: () => void;
  /** Whether a Next exists from here (false on the finish screen). */
  hasNext: boolean;
  /** Brass Next once the chapter's demonstration is done; enamel before. */
  nextReady?: boolean;
  nextLabel?: string;
  /** Replaces Back/Next entirely — the finish screen's own CTAs. */
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}

const SWIPE_MIN_PX = 56;
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function OnboardingShell({
  open,
  onClose,
  title,
  chapters,
  index,
  onGoto,
  onNext,
  onBack,
  hasNext,
  nextReady = true,
  nextLabel = 'Next',
  footer,
  children,
  className = '',
}: OnboardingShellProps) {
  const titleId = useId();
  const stageRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const lastIndex = useRef(index);
  const direction = index >= lastIndex.current ? 'fwd' : 'back';
  useEffect(() => { lastIndex.current = index; }, [index]);

  // Hold the page still behind the stage, and give focus back on close.
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    stageRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [open]);

  const goNext = useCallback(() => { if (hasNext) { haptic(); onNext(); } }, [hasNext, onNext]);
  const goBack = useCallback(() => { if (index > 0) { haptic(); onBack(); } }, [index, onBack]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, select, [contenteditable="true"]');
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (!typing && event.key === 'ArrowRight') { event.preventDefault(); goNext(); return; }
      if (!typing && event.key === 'ArrowLeft') { event.preventDefault(); goBack(); return; }
      if (event.key !== 'Tab') return;

      const nodes = Array.from(stageRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        .filter(n => n.offsetParent !== null || n === document.activeElement);
      if (nodes.length === 0) { event.preventDefault(); return; }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const at = nodes.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && at <= 0) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (at === -1 || at === nodes.length - 1)) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goBack, goNext, onClose, open]);

  // Swipe between chapters on touch. Vertical drags stay a scroll (the body
  // is `touch-action: pan-y`); only a clearly horizontal flick turns a page.
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const onPointerDown = (event: ReactPointerEvent) => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return;
    if ((event.target as HTMLElement).closest('[data-no-swipe]')) return;
    swipe.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };
  const onPointerUp = (event: ReactPointerEvent) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    if (dx < 0) goNext(); else goBack();
  };

  if (!open) return null;

  const finished = index >= chapters.length;
  const current = chapters[Math.min(index, chapters.length - 1)];

  return (
    <div className={`onb-root ${className}`} data-motion={reduced ? 'reduce' : 'full'}>
      <div className="onb-scrim" aria-hidden="true" onClick={onClose} />
      <div
        ref={stageRef}
        className="onb-stage"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="sr-only">{title}</h2>
        <header className="onb-head">
          <ol className="onb-progress" aria-label="Chapters">
            {chapters.map((chapter, i) => {
              const state = finished || i < index ? 'done' : i === index ? 'current' : 'todo';
              return (
                <li key={chapter.id} className="onb-progress-item">
                  <button
                    type="button"
                    className={`onb-seg is-${state}`}
                    aria-current={i === index ? 'step' : undefined}
                    aria-label={`Chapter ${i + 1}: ${chapter.label}`}
                    onClick={() => { haptic(); onGoto(i); }}
                  >
                    <span className="onb-seg-label" aria-hidden="true">{chapter.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <button type="button" className="court-icon-btn onb-close" aria-label={`Close ${title}`} onClick={() => { haptic(); onClose(); }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M5.3 4 10 8.6 14.7 4 16 5.3 11.4 10l4.6 4.7-1.3 1.3-4.7-4.6L5.3 16 4 14.7 8.6 10 4 5.3z" />
            </svg>
          </button>
        </header>

        <p className="sr-only" aria-live="polite">
          {finished ? `${title}: done` : `Chapter ${index + 1} of ${chapters.length}: ${current.label}`}
        </p>

        <main
          className="onb-body"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { swipe.current = null; }}
        >
          <div key={index} className="onb-chapter" data-dir={direction}>
            {children}
          </div>
        </main>

        <footer className="onb-foot">
          {footer ?? (
            <>
              <button
                type="button"
                className="btn-secondary onb-back"
                onClick={index > 0 ? goBack : () => { haptic(); onClose(); }}
              >
                {index > 0 ? 'Back' : 'Skip'}
              </button>
              <span className="onb-keys" aria-hidden="true">← → to move · Esc to close</span>
              <button
                type="button"
                className={`${nextReady ? 'btn-primary' : 'btn-secondary'} onb-next`}
                onClick={goNext}
                disabled={!hasNext}
              >
                {nextLabel}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
