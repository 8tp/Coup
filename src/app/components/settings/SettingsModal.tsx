'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore, TextSize } from '../../stores/settingsStore';
import { haptic } from '../../utils/haptic';
import { GameMode } from '@/shared/types';
import { LOCALES, type Locale } from '@/shared/i18n/locales';
import { useT, selectableLocales, gameModeName, type MessageKey } from '../../i18n';
import { FEEDBACK_GITHUB_ISSUES_URL } from '@/shared/constants';
import { FeedbackForm } from '../feedback/FeedbackForm';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenTutorial?: () => void;
  onPracticeBot?: (gameMode: GameMode) => void;
  practiceLoading?: boolean;
}

const TEXT_SIZE_OPTIONS: { value: TextSize; label: MessageKey }[] = [
  { value: 'normal', label: 'settings.textSizeNormal' },
  { value: 'large', label: 'settings.textSizeLarge' },
  { value: 'xl', label: 'settings.textSizeXl' },
];

/**
 * Settings > Language. Each language is named in itself (and tagged with its
 * own `lang`, so it gets its own script's font) because a player who cannot
 * read the current language must still find theirs. "Match my device" clears
 * the saved choice and goes back to `navigator.languages`.
 */
function LanguagePicker() {
  const t = useT();
  const saved = useSettingsStore(s => s.locale);
  const setLocale = useSettingsStore(s => s.setLocale);
  const [options, setOptions] = useState<Locale[]>([]);

  // Read after mount: the list depends on the build and a localStorage preview flag.
  useEffect(() => { setOptions(selectableLocales()); }, []);

  if (options.length < 2) return null;

  const choose = (locale: Locale | null) => { haptic(); setLocale(locale); };

  return (
    <div>
      <span className="text-sm text-gray-300 block mb-2" id="settings-language">{t('settings.language')}</span>
      <div className="lang-picker" role="radiogroup" aria-labelledby="settings-language">
        <button
          type="button"
          role="radio"
          aria-checked={saved === null}
          className={`lang-picker-auto ${saved === null ? 'is-on' : ''}`}
          onClick={() => choose(null)}
          data-locale-option="auto"
        >
          {t('settings.languageAuto')}
        </button>
        {options.map(code => {
          const info = LOCALES[code];
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={saved === code}
              className={saved === code ? 'is-on' : ''}
              onClick={() => choose(code)}
              data-locale-option={code}
            >
              <span lang={info.dev ? undefined : code} dir={info.dir}>{info.nativeName}</span>
              {info.status !== 'ready' && <small>{t('settings.languageInProgress')}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsModal({ open, onClose, onOpenTutorial, onPracticeBot, practiceLoading }: SettingsModalProps) {
  const t = useT();
  const isMuted = useGameStore(s => s.isMuted);
  const setMuted = useGameStore(s => s.setMuted);
  const musicEnabled = useSettingsStore(s => s.musicEnabled);
  const setMusicEnabled = useSettingsStore(s => s.setMusicEnabled);
  const musicVolume = useSettingsStore(s => s.musicVolume);
  const setMusicVolume = useSettingsStore(s => s.setMusicVolume);
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);
  const setHapticEnabled = useSettingsStore(s => s.setHapticEnabled);
  const textSize = useSettingsStore(s => s.textSize);
  const setTextSize = useSettingsStore(s => s.setTextSize);
  const reducedMotionEnabled = useSettingsStore(s => s.reducedMotionEnabled);
  const setReducedMotionEnabled = useSettingsStore(s => s.setReducedMotionEnabled);

  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [view, setView] = useState<'settings' | 'feedback'>('settings');

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const feedbackButtonRef = useRef<HTMLButtonElement>(null);
  const returningFromFeedback = useRef(false);

  // Always reopen on the settings list.
  useEffect(() => {
    if (!open) setView('settings');
  }, [open]);

  // Coming back from the form, put focus back on the button that opened it.
  useEffect(() => {
    if (view === 'settings' && returningFromFeedback.current) {
      returningFromFeedback.current = false;
      feedbackButtonRef.current?.focus();
    }
  }, [view]);

  if (view === 'feedback') {
    return (
      <Modal open={open} onClose={onClose} title={t('feedback.title')} maxWidth="max-w-sm">
        <FeedbackForm onClose={() => { returningFromFeedback.current = true; setView('settings'); }} closeLabel={t('common.back')} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={t('settings.title')} maxWidth="max-w-sm">
      <div className="space-y-2">
        {/* Sound effects */}
        <button
          type="button"
          role="switch"
          aria-checked={!isMuted}
          className="menu-switch"
          onClick={() => { haptic(); setMuted(!isMuted); }}
        >
          <span className="font-semibold text-coup-ink">{t('settings.soundEffects')}</span>
          <span className={`switch-track ${!isMuted ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>

        {/* Music */}
        <button
          type="button"
          role="switch"
          aria-checked={musicEnabled}
          className="menu-switch"
          onClick={() => { haptic(); setMusicEnabled(!musicEnabled); }}
        >
          <span className="font-semibold text-coup-ink">{t('settings.music')}</span>
          <span className={`switch-track ${musicEnabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>
        {musicEnabled && (
          <div className="lobby-setting px-0.5">
            <div className="lobby-setting-head">
              <span className="text-sm font-normal text-coup-ink-mute">{t('settings.musicVolume')}</span>
              <span className="figure text-sm text-coup-accent">
                {musicVolume === 50
                  ? t('settings.musicVolumeBalanced')
                  : t('settings.musicVolumeDb', {
                    db: new Intl.NumberFormat(t.intl, { signDisplay: 'exceptZero' }).format(Math.round((musicVolume - 50) * 0.24)),
                  })}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={musicVolume}
              aria-label={t('settings.musicVolume')}
              onChange={(e) => setMusicVolume(Number(e.target.value))}
              className="lobby-range"
            />
          </div>
        )}

        {/* Haptic Feedback — touch devices only */}
        {isTouchDevice && (
          <button
            type="button"
            role="switch"
            aria-checked={hapticEnabled}
            className="menu-switch"
            onClick={() => { haptic(); setHapticEnabled(!hapticEnabled); }}
          >
            <span className="font-semibold text-coup-ink">{t('settings.haptics')}</span>
            <span className={`switch-track ${hapticEnabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
          </button>
        )}

        {/* Reduced Animation */}
        <button
          type="button"
          role="switch"
          aria-checked={reducedMotionEnabled}
          className="menu-switch"
          onClick={() => { haptic(); setReducedMotionEnabled(!reducedMotionEnabled); }}
        >
          <span className="font-semibold text-coup-ink">{t('settings.reducedMotion')}</span>
          <span className={`switch-track ${reducedMotionEnabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>

        {/* Language */}
        <LanguagePicker />

        {/* Text Size */}
        <div>
          <span className="text-sm text-gray-300 block mb-2">{t('settings.textSize')}</span>
          <div className="lobby-seg !grid-cols-3" role="radiogroup" aria-label={t('settings.textSize')}>
            {TEXT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { haptic(); setTextSize(opt.value); }}
                role="radio"
                aria-checked={textSize === opt.value}
                className={textSize === opt.value ? 'is-on' : ''}
              >
                {t(opt.label)}
              </button>
            ))}
          </div>
        </div>

        {/* Learning - main menu only */}
        {(onOpenTutorial || onPracticeBot) && (
          <div className="border-t border-coup-line/70 pt-4">
            <span className="text-sm text-gray-300 block mb-2">{t('settings.learning')}</span>
            <div className="space-y-2">
              {onOpenTutorial && (
                <button
                  className="btn-secondary w-full"
                  onClick={() => { haptic(); onClose(); onOpenTutorial(); }}
                >
                  {t('settings.tutorial')}
                </button>
              )}
              {onPracticeBot && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn-secondary !flex-col !gap-0.5"
                    onClick={() => { haptic(80); onClose(); onPracticeBot(GameMode.Classic); }}
                    disabled={practiceLoading}
                  >
                    <span className="block">{gameModeName(t, GameMode.Classic)}</span>
                    <span className="block font-sans text-xs font-normal text-coup-ink-mute">{t('settings.coachedBots', { count: 1 })}</span>
                  </button>
                  <button
                    className="btn-secondary !flex-col !gap-0.5"
                    onClick={() => { haptic(80); onClose(); onPracticeBot(GameMode.Reformation); }}
                    disabled={practiceLoading}
                  >
                    <span className="block">{gameModeName(t, GameMode.Reformation)}</span>
                    <span className="block font-sans text-xs font-normal text-coup-ink-mute">{t('settings.coachedBots', { count: 2 })}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback: opens the in-app form in place of the settings list */}
        <div className="border-t border-coup-line/70 pt-4">
          <span className="text-sm text-gray-300 block mb-2">{t('settings.help')}</span>
          <button
            ref={feedbackButtonRef}
            type="button"
            className="btn-secondary w-full"
            onClick={() => { haptic(); setView('feedback'); }}
          >
            {t('settings.feedbackOpen')}
          </button>
          <div className="flex justify-center">
            <a
              href={FEEDBACK_GITHUB_ISSUES_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic()}
              className="inline-flex min-h-[44px] items-center px-2 text-sm text-coup-ink-mute underline underline-offset-4 hover:text-coup-accent"
            >
              {t('settings.githubIssue')}
            </a>
          </div>
        </div>

        {/* Done */}
        <button
          className="btn-secondary w-full"
          onClick={() => { haptic(); onClose(); }}
        >
          {t('common.done')}
        </button>
      </div>
    </Modal>
  );
}
