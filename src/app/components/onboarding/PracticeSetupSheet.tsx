'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { GameMode } from '@/shared/types';
import {
  DEFAULT_PRACTICE_OPTIONS,
  PRACTICE_OPPONENT_CHOICES,
  PRACTICE_STYLES,
  describePracticeOptions,
  normalizePracticeOptions,
  type PracticeOptions,
} from '../../utils/practiceSetup';
import { haptic } from '../../utils/haptic';

/**
 * Practice vs Bots, set up in one sheet: how many opponents, how they play,
 * which rules, and whether the coach rides along. A bottom sheet on phones,
 * a menu panel in the middle of the room on desktop.
 */

interface PracticeSetupSheetProps {
  open: boolean;
  onClose: () => void;
  onStart: (options: PracticeOptions) => void;
  loading?: boolean;
}

const STORAGE_KEY = 'coup_practice_options';
const FOCUSABLE = 'button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function loadOptions(): PracticeOptions {
  if (typeof window === 'undefined') return DEFAULT_PRACTICE_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizePracticeOptions(JSON.parse(raw)) : DEFAULT_PRACTICE_OPTIONS;
  } catch {
    return DEFAULT_PRACTICE_OPTIONS;
  }
}

export function PracticeSetupSheet({ open, onClose, onStart, loading = false }: PracticeSetupSheetProps) {
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<PracticeOptions>(DEFAULT_PRACTICE_OPTIONS);

  useEffect(() => {
    if (open) setOptions(loadOptions());
  }, [open]);

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

  const set = (patch: Partial<PracticeOptions>) => {
    haptic();
    setOptions(current => normalizePracticeOptions({ ...current, ...patch }));
  };

  const start = () => {
    haptic(80);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(options)); } catch { /* private mode */ }
    onStart(options);
  };

  const style = PRACTICE_STYLES.find(s => s.id === options.style)!;
  const reformationSolo = options.gameMode === GameMode.Reformation && options.opponents === 1;

  return (
    <div className="practice-sheet-root">
      <div className="practice-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={sheetRef} className="practice-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="practice-sheet-head">
          <div>
            <h2 id={titleId} className="practice-sheet-title type-display">Practice vs Bots</h2>
            <p className="practice-sheet-lede">A private game against bots, with a coach that points at what matters.</p>
          </div>
          <button type="button" className="court-icon-btn" aria-label="Close practice setup" onClick={() => { haptic(); onClose(); }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M5.3 4 10 8.6 14.7 4 16 5.3 11.4 10l4.6 4.7-1.3 1.3-4.7-4.6L5.3 16 4 14.7 8.6 10 4 5.3z" />
            </svg>
          </button>
        </header>

        <div className="practice-sheet-body">
          <div className="lobby-setting">
            <span className="lobby-setting-head" id={`${titleId}-opp`}>Opponents</span>
            <div className="lobby-seg practice-seg-3" role="radiogroup" aria-labelledby={`${titleId}-opp`}>
              {PRACTICE_OPPONENT_CHOICES.map(n => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={options.opponents === n}
                  className={`figure ${options.opponents === n ? 'is-on' : ''}`}
                  data-autofocus={options.opponents === n ? '' : undefined}
                  onClick={() => set({ opponents: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="lobby-setting">
            <span className="lobby-setting-head" id={`${titleId}-style`}>Bot style</span>
            <div className="lobby-seg practice-seg-3" role="radiogroup" aria-labelledby={`${titleId}-style`}>
              {PRACTICE_STYLES.map(s => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={options.style === s.id}
                  className={options.style === s.id ? 'is-on' : ''}
                  onClick={() => set({ style: s.id })}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="practice-sheet-hint" aria-live="polite">{style.blurb}</p>
          </div>

          <div className="lobby-setting">
            <span className="lobby-setting-head" id={`${titleId}-mode`}>Rules</span>
            <div className="lobby-seg" role="radiogroup" aria-labelledby={`${titleId}-mode`}>
              {[GameMode.Classic, GameMode.Reformation].map(mode => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={options.gameMode === mode}
                  className={options.gameMode === mode ? 'is-on' : ''}
                  onClick={() => set({ gameMode: mode })}
                >
                  {mode}
                </button>
              ))}
            </div>
            <p className="practice-sheet-hint">
              {reformationSolo
                ? 'Factions need at least 2 opponents to matter.'
                : options.gameMode === GameMode.Reformation
                  ? 'Factions, Convert, Embezzle and the Inquisitor.'
                  : 'The base game. Start here if you\'re new.'}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={options.coach}
            className="menu-switch"
            onClick={() => set({ coach: !options.coach })}
          >
            <span className="text-left">
              <span className="block font-semibold text-coup-ink">Coach tips</span>
              <span className="block text-sm text-coup-ink-mute">
                {options.coach ? 'Callouts point at what to do next' : 'No tips'}
              </span>
            </span>
            <span className={`switch-track ${options.coach ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
          </button>
        </div>

        <footer className="practice-sheet-foot">
          <button type="button" className="btn-primary menu-play w-full" onClick={start} disabled={loading}>
            <span>{loading ? 'Dealing…' : 'Start practice'}</span>
            <span className="menu-play-sub">{describePracticeOptions(options)}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
