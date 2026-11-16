'use client';

import { useState, useCallback, useEffect, useId } from 'react';
import { Modal } from '../ui/Modal';
import { BotPersonality } from '@/shared/types';
import { BOT_NAMES, DEFAULT_BOT_PERSONALITY, NAME_MAX_CODE_UNITS, NAME_MAX_LENGTH } from '@/shared/constants';
import { clampToGraphemes, nameKey } from '@/shared/textLimits';
import { useT } from '../../i18n';
import { haptic } from '../../utils/haptic';

interface AddBotModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, personality: BotPersonality) => Promise<void>;
  existingNames: string[];
}

const PERSONALITY_OPTIONS: Array<{
  value: BotPersonality;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    value: 'random',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
  },
  {
    value: 'aggressive',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500',
  },
  {
    value: 'conservative',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
  },
  {
    value: 'vengeful',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500',
  },
  {
    value: 'deceptive',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500',
  },
  {
    value: 'analytical',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
  },
  {
    value: 'optimal',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500',
  },
];

export function AddBotModal({ open, onClose, onAdd, existingNames }: AddBotModalProps) {
  const t = useT();
  const nameId = useId();
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState<BotPersonality>(DEFAULT_BOT_PERSONALITY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickRandomName = useCallback(() => {
    const taken = new Set(existingNames.map(nameKey));
    const available = BOT_NAMES.filter(n => !taken.has(nameKey(n)));
    if (available.length === 0) {
      setName(`Bot-${Math.floor(Math.random() * 1000)}`);
      return;
    }
    setName(available[Math.floor(Math.random() * available.length)]);
  }, [existingNames]);

  // Open with a name already chosen, so adding a bot is one tap.
  useEffect(() => {
    if (open && !name) pickRandomName();
  }, [open, name, pickRandomName]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t('errors.enterBotName'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onAdd(trimmed, personality);
      // Reset and close
      setName('');
      setPersonality(DEFAULT_BOT_PERSONALITY);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.addBotFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('lobby.addBotTitle')}>
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm text-gray-400 mb-1" htmlFor={nameId}>{t('lobby.botName')}</label>
          <div className="flex gap-2">
            <input
              id={nameId}
              type="text"
              value={name}
              onChange={e => setName(clampToGraphemes(e.target.value, NAME_MAX_LENGTH))}
              maxLength={NAME_MAX_CODE_UNITS}
              dir="auto"
              className="input-field flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={() => { haptic(); pickRandomName(); }}
              className="btn-secondary"
              aria-label={t('lobby.randomNameLabel')}
            >
              {t('lobby.randomName')}
            </button>
          </div>
        </div>

        {/* Personality Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">{t('lobby.personality')}</label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('lobby.personality')}>
            {PERSONALITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={personality === opt.value}
                onClick={() => { haptic(); setPersonality(opt.value); }}
                className={`min-h-[48px] px-3 rounded border-2 text-start font-bold text-sm transition ${
                  personality === opt.value
                    ? `${opt.bgColor} ${opt.borderColor} ${opt.color}`
                    : 'border-coup-line text-gray-300 hover:border-coup-ink-mute'
                }`}
              >
                {t(`lobby.personality.${opt.value}`)}
              </button>
            ))}
          </div>
          <p className="text-sm text-coup-ink-mute mt-2">{t(`lobby.personalityDescription.${personality}`)}</p>
        </div>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => { haptic(); onClose(); }}
            className="btn-secondary flex-1"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={() => { haptic(80); handleSubmit(); }}
            disabled={submitting || !name.trim()}
            className="btn-primary flex-1"
          >
            {submitting ? t('lobby.adding') : t('lobby.addBotSubmit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
