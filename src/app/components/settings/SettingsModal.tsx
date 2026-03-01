'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore, TextSize } from '../../stores/settingsStore';
import { haptic } from '../../utils/haptic';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const TEXT_SIZE_OPTIONS: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'large', label: 'Large' },
  { value: 'xl', label: 'Extra Large' },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const isMuted = useGameStore(s => s.isMuted);
  const setMuted = useGameStore(s => s.setMuted);
  const hapticEnabled = useSettingsStore(s => s.hapticEnabled);
  const setHapticEnabled = useSettingsStore(s => s.setHapticEnabled);
  const textSize = useSettingsStore(s => s.textSize);
  const setTextSize = useSettingsStore(s => s.setTextSize);

  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  return (
    <Modal open={open} onClose={onClose} title="Settings" maxWidth="max-w-sm">
      <div className="space-y-5">
        {/* Sound */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Sound</span>
          <button
            type="button"
            role="switch"
            aria-checked={!isMuted}
            onClick={() => { haptic(); setMuted(!isMuted); }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${!isMuted ? 'bg-coup-accent' : 'bg-gray-600'}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!isMuted ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {/* Haptic Feedback — touch devices only */}
        {isTouchDevice && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">Haptic Feedback</span>
            <button
              type="button"
              role="switch"
              aria-checked={hapticEnabled}
              onClick={() => { haptic(); setHapticEnabled(!hapticEnabled); }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${hapticEnabled ? 'bg-coup-accent' : 'bg-gray-600'}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${hapticEnabled ? 'translate-x-6' : 'translate-x-1'}`}
              />
            </button>
          </div>
        )}

        {/* Text Size */}
        <div>
          <span className="text-sm text-gray-300 block mb-2">Text Size</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-600">
            {TEXT_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { haptic(); setTextSize(opt.value); }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  textSize === opt.value
                    ? 'bg-coup-accent text-coup-bg'
                    : 'bg-coup-card text-gray-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback links */}
        <div className="border-t border-gray-700 pt-4">
          <span className="text-sm text-gray-300 block mb-2">Help & Feedback</span>
          <div className="flex gap-2">
            <a
              href="https://github.com/8tp/Coup/issues/new?template=bug_report.yml"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic()}
              className="flex-1 py-2 px-3 rounded-lg border border-gray-600 text-sm text-gray-300 hover:border-red-400 hover:text-red-400 transition text-center"
            >
              Report Bug
            </a>
            <a
              href="https://github.com/8tp/Coup/issues/new?template=feature_request.yml"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => haptic()}
              className="flex-1 py-2 px-3 rounded-lg border border-gray-600 text-sm text-gray-300 hover:border-coup-accent hover:text-coup-accent transition text-center"
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
