'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore, TextSize } from '../../stores/settingsStore';
import { haptic } from '../../utils/haptic';
import { GameMode } from '@/shared/types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onOpenTutorial?: () => void;
  onPracticeBot?: (gameMode: GameMode) => void;
  practiceLoading?: boolean;
}

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
];

export function SettingsModal({ open, onClose, onOpenTutorial, onPracticeBot, practiceLoading }: SettingsModalProps) {
  const isMuted = useGameStore(s => s.isMuted);
  const setMuted = useGameStore(s => s.setMuted);
  const musicEnabled = useSettingsStore(s => s.musicEnabled);
  const setMusicEnabled = useSettingsStore(s => s.setMusicEnabled);
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);
  const setHapticEnabled = useSettingsStore(s => s.setHapticEnabled);
  const textSize = useSettingsStore(s => s.textSize);
  const setTextSize = useSettingsStore(s => s.setTextSize);
  const reducedMotionEnabled = useSettingsStore(s => s.reducedMotionEnabled);
  const setReducedMotionEnabled = useSettingsStore(s => s.setReducedMotionEnabled);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="Settings" maxWidth="max-w-sm">
      <div className="space-y-2">
        {/* Sound effects */}
        <button
          type="button"
          role="switch"
          aria-checked={!isMuted}
          className="menu-switch"
          onClick={() => { haptic(); setMuted(!isMuted); }}
        >
          <span className="font-semibold text-coup-ink">Sound Effects</span>
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
          <span className="font-semibold text-coup-ink">Music</span>
          <span className={`switch-track ${musicEnabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>

        {/* Haptic Feedback — touch devices only */}
        {isTouchDevice && (
          <button
            type="button"
            role="switch"
            aria-checked={hapticEnabled}
            className="menu-switch"
            onClick={() => { haptic(); setHapticEnabled(!hapticEnabled); }}
          >
            <span className="font-semibold text-coup-ink">Haptic Feedback</span>
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
          <span className="font-semibold text-coup-ink">Reduced Animation</span>
          <span className={`switch-track ${reducedMotionEnabled ? 'is-on' : ''}`} aria-hidden="true"><span /></span>
        </button>

        {/* Text Size */}
        <div>
          <span className="text-sm text-gray-300 block mb-2">Text Size</span>
          <div className="lobby-seg !grid-cols-3" role="radiogroup" aria-label="Text size">
            {TEXT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { haptic(); setTextSize(opt.value); }}
                role="radio"
                aria-checked={textSize === opt.value}
                className={textSize === opt.value ? 'is-on' : ''}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Learning - main menu only */}
        {(onOpenTutorial || onPracticeBot) && (
          <div className="border-t border-coup-line/70 pt-4">
            <span className="text-sm text-gray-300 block mb-2">Learning</span>
            <div className="space-y-2">
              {onOpenTutorial && (
                <button
                  className="btn-secondary w-full"
                  onClick={() => { haptic(); onClose(); onOpenTutorial(); }}
                >
                  New Player Tutorial
                </button>
              )}
              {onPracticeBot && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="btn-secondary !flex-col !gap-0.5"
                    onClick={() => { haptic(80); onClose(); onPracticeBot(GameMode.Classic); }}
                    disabled={practiceLoading}
                  >
                    <span className="block">Classic</span>
                    <span className="block font-sans text-xs font-normal text-coup-ink-mute">Practice vs Bot</span>
                  </button>
                  <button
                    className="btn-secondary !flex-col !gap-0.5"
                    onClick={() => { haptic(80); onClose(); onPracticeBot(GameMode.Reformation); }}
                    disabled={practiceLoading}
                  >
                    <span className="block">Reformation</span>
                    <span className="block font-sans text-xs font-normal text-coup-ink-mute">Guided Bot Game</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Feedback links */}
        <div className="border-t border-coup-line/70 pt-4">
          <span className="text-sm text-gray-300 block mb-2">Help & Feedback</span>
          <div className="flex gap-2">
            <a
              href="https://github.com/8tp/Coup/issues/new?template=bug_report.yml"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic()}
              className="btn-ghost flex-1"
            >
              Report Bug
            </a>
            <a
              href="https://github.com/8tp/Coup/issues/new?template=feature_request.yml"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic()}
              className="btn-ghost flex-1"
            >
              Send Feedback
            </a>
          </div>
        </div>

        {/* Done */}
        <button
          className="btn-secondary w-full"
          onClick={() => { haptic(); onClose(); }}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}
