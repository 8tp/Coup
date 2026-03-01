'use client';

import { useState, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { BotDifficulty } from '@/shared/types';
import { BOT_NAMES, DEFAULT_BOT_DIFFICULTY } from '@/shared/constants';
import { haptic } from '../../utils/haptic';

interface AddBotModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, difficulty: BotDifficulty) => Promise<void>;
  existingNames: string[];
}

const DIFFICULTY_OPTIONS: Array<{
  value: BotDifficulty;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = [
  {
    value: 'easy',
    label: 'Easy',
    description: 'Plays honestly, never bluffs or challenges',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    borderColor: 'border-green-500',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Occasional bluffs and challenges',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    borderColor: 'border-yellow-500',
  },
  {
    value: 'hard',
    label: 'Hard',
    description: 'Strategic play with card counting',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    borderColor: 'border-red-500',
  },
  {
    value: 'random',
    label: 'Random',
    description: 'Randomly assigned difficulty — keep them guessing',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500',
  },
];

export function AddBotModal({ open, onClose, onAdd, existingNames }: AddBotModalProps) {
  const [name, setName] = useState('');
  const [difficulty, setDifficulty] = useState<BotDifficulty>(DEFAULT_BOT_DIFFICULTY);
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
      await onAdd(trimmed, difficulty);
      // Reset and close
      setName('');
      setDifficulty(DEFAULT_BOT_DIFFICULTY);
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

        {/* Difficulty Selector */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Difficulty</label>
          <div className="space-y-2">
            {DIFFICULTY_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { haptic(); setDifficulty(opt.value); }}
                className={`w-full text-left px-4 py-3 rounded-lg border-2 transition ${
                  difficulty === opt.value
                    ? `${opt.bgColor} ${opt.borderColor}`
                    : 'border-gray-700 hover:border-gray-500'
                }`}
              >
                <span className={`font-bold text-sm ${difficulty === opt.value ? opt.color : 'text-gray-300'}`}>
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
