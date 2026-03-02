'use client';

import { useState, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { BotPersonality } from '@/shared/types';
import { BOT_NAMES, DEFAULT_BOT_PERSONALITY } from '@/shared/constants';
import { haptic } from '../../utils/haptic';

interface AddBotModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, personality: BotPersonality) => Promise<void>;
  existingNames: string[];
}

const PERSONALITY_OPTIONS: Array<{
  value: BotPersonality;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    value: 'random',
    label: 'Random',
    description: 'Hidden random personality',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'High bluff rates, offensive actions',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500',
  },
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Plays honest, rarely bluffs',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
  },
  {
    value: 'vengeful',
    label: 'Vengeful',
    description: 'Retaliates against attackers',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500',
  },
  {
    value: 'deceptive',
    label: 'Deceptive',
    description: 'Constant bluffs, avoids challenges',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500',
  },
  {
    value: 'analytical',
    label: 'Analytical',
    description: 'Evidence-based, calculated risks',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
  },
  {
    value: 'optimal',
    label: 'Optimal',
    description: 'Strategic play with card counting',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500',
  },
];

export function AddBotModal({ open, onClose, onAdd, existingNames }: AddBotModalProps) {
  const [name, setName] = useState('');
  const [personality, setPersonality] = useState<BotPersonality>(DEFAULT_BOT_PERSONALITY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickRandomName = useCallback(() => {
    const available = BOT_NAMES.filter(
      n => !existingNames.some(en => en.toLowerCase() === n.toLowerCase()),
    );
    if (available.length === 0) {
      setName(`Bot-${Math.floor(Math.random() * 1000)}`);
      return;
    }
    setName(available[Math.floor(Math.random() * available.length)]);
  }, [existingNames]);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name');
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
      setError(err instanceof Error ? err.message : 'Failed to add bot');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Computer Player">
      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Name</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={20}
              placeholder="Bot name..."
              className="flex-1 bg-coup-bg border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-coup-accent"
            />
            <button
              type="button"
              onClick={() => { haptic(); pickRandomName(); }}
              className="btn-secondary text-sm px-3 py-2"
            >
              Random
            </button>
          </div>
        </div>

        {/* Personality Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Personality</label>
          <div className="space-y-2">
            {PERSONALITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { haptic(); setPersonality(opt.value); }}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                  personality === opt.value
                    ? `${opt.bgColor} ${opt.borderColor}`
                    : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <span className={`font-bold text-sm ${personality === opt.value ? opt.color : 'text-gray-300'}`}>
                  {opt.label}
                </span>
                <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
              </button>
            ))}
          </div>
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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { haptic(80); handleSubmit(); }}
            disabled={submitting || !name.trim()}
            className="btn-primary flex-1"
          >
            {submitting ? 'Adding...' : 'Add Bot'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
