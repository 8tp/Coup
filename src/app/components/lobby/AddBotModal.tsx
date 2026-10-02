'use client';

import { useState, useCallback, useEffect } from 'react';
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
    description: 'Plays one of the six styles below, picked at random and kept hidden.',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
  },
  {
    value: 'aggressive',
    label: 'Aggressive',
    description: 'Bluffs often and favors attacks.',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500',
  },
  {
    value: 'conservative',
    label: 'Conservative',
    description: 'Plays honest and rarely bluffs.',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
  },
  {
    value: 'vengeful',
    label: 'Vengeful',
    description: 'Retaliates against whoever attacked it.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500',
  },
  {
    value: 'deceptive',
    label: 'Deceptive',
    description: 'Bluffs the most and avoids challenges.',
    color: 'text-pink-400',
    bgColor: 'bg-pink-500/20',
    borderColor: 'border-pink-500',
  },
  {
    value: 'analytical',
    label: 'Analytical',
    description: 'Challenges when the revealed cards point to a bluff.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500',
  },
  {
    value: 'optimal',
    label: 'Optimal',
    description: 'Counts revealed cards and bluffs selectively.',
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

  // Open with a name already chosen, so adding a bot is one tap.
  useEffect(() => {
    if (open && !name) pickRandomName();
  }, [open, name, pickRandomName]);

  const selected = PERSONALITY_OPTIONS.find(o => o.value === personality);

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
    <Modal open={open} onClose={onClose} title="Add a bot">
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
              className="input-field flex-1 min-w-0"
            />
            <button
              type="button"
              onClick={() => { haptic(); pickRandomName(); }}
              className="btn-secondary"
              aria-label="Pick a random name"
            >
              Random
            </button>
          </div>
        </div>

        {/* Personality Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Personality</label>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Personality">
            {PERSONALITY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={personality === opt.value}
                onClick={() => { haptic(); setPersonality(opt.value); }}
                className={`min-h-[48px] px-3 rounded border-2 text-left font-bold text-sm transition ${
                  personality === opt.value
                    ? `${opt.bgColor} ${opt.borderColor} ${opt.color}`
                    : 'border-coup-line text-gray-300 hover:border-coup-ink-mute'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {selected && <p className="text-sm text-coup-ink-mute mt-2">{selected.description}</p>}
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
            {submitting ? 'Adding…' : 'Add bot'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
