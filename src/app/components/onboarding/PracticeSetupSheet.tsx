'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { GameMode } from '@/shared/types';
import {
  DEFAULT_PRACTICE_OPTIONS,
  PRACTICE_OPPONENT_CHOICES,
  PRACTICE_STYLES,
  REFORMATION_MIN_OPPONENTS,
  describePracticeOptions,
  normalizePracticeOptions,
  type PracticeOptions,
} from '../../utils/practiceSetup';
import { haptic } from '../../utils/haptic';
import { learnParams } from '../../utils/learnText';
import { gameModeName, useT } from '../../i18n';

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
  const t = useT();
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

  const reformationSolo = options.gameMode === GameMode.Reformation && options.opponents < REFORMATION_MIN_OPPONENTS;

  return (
    <div className="practice-sheet-root">
      <div className="practice-sheet-scrim" aria-hidden="true" onClick={onClose} />
      <div ref={sheetRef} className="practice-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="practice-sheet-head">
          <div>
            <h2 id={titleId} className="practice-sheet-title type-display">{t('tutorial.setup.title')}</h2>
            <p className="practice-sheet-lede">{t('tutorial.setup.lede')}</p>
          </div>
          <button type="button" className="court-icon-btn" aria-label={t('tutorial.setup.close')} onClick={() => { haptic(); onClose(); }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden="true">
              <path d="M5.3 4 10 8.6 14.7 4 16 5.3 11.4 10l4.6 4.7-1.3 1.3-4.7-4.6L5.3 16 4 14.7 8.6 10 4 5.3z" />
            </svg>
          </button>
        </header>

        <div className="practice-sheet-body">
          <div className="lobby-setting">
            <span className="lobby-setting-head" id={`${titleId}-opp`}>{t('tutorial.setup.opponents')}</span>
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
                  {t.number(n)}
                </button>
              ))}
            </div>
          </div>

          <div className="lobby-setting">
            <span className="lobby-setting-head" id={`${titleId}-style`}>{t('tutorial.setup.style')}</span>
            <div className="lobby-seg practice-seg-3" role="radiogroup" aria-labelledby={`${titleId}-style`}>
              {PRACTICE_STYLES.map(id => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={options.style === id}
                  className={options.style === id ? 'is-on' : ''}
                  onClick={() => set({ style: id })}
                >
                  {t(`tutorial.setup.style.${id}`)}
                </button>
              ))}
            </div>
            <p className="practice-sheet-hint" aria-live="polite">{t(`tutorial.setup.blurb.${options.style}`)}</p>
          </div>

          <div className="lobby-setting">
            <span className="lobby-setting-head" id={`${titleId}-mode`}>{t('tutorial.setup.rules')}</span>
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
                  {gameModeName(t, mode)}
                </button>
              ))}
            </div>
            <p className="practice-sheet-hint">
              {reformationSolo
                ? t('tutorial.setup.hint.reformationSolo', { count: REFORMATION_MIN_OPPONENTS })
                : options.gameMode === GameMode.Reformation
                  ? t('tutorial.setup.hint.reformation', learnParams(t))
                  : t('tutorial.setup.hint.classic')}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={options.coach}
            className="menu-switch"
            onClick={() => set({ coach: !options.coach })}
          >
            <span className="text-start">
              <span className="block font-semibold text-coup-ink">{t('tutorial.setup.coach')}</span>
              <span className="block text-sm text-coup-ink-mute">
                {options.coach ? t('tutorial.setup.coachOn') : t('tutorial.setup.coachOff')}
              </span>
            </span>
            <span className={`switch-track ${options.coach ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
          </button>
        </div>

        <footer className="practice-sheet-foot">
          <button type="button" className="btn-primary menu-play w-full" onClick={start} disabled={loading}>
            <span>{loading ? t('tutorial.setup.starting') : t('tutorial.setup.start')}</span>
            <span className="menu-play-sub">{describePracticeOptions(options, t)}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
