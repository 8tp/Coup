'use client';

import { useState, useCallback } from 'react';
import { Modal } from '../ui/Modal';
import { AiPersonality } from '@/shared/types';
import { BOT_NAMES, DEFAULT_PERSONALITY } from '@/shared/constants';

interface AddBotModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string, personality: AiPersonality) => Promise<void>;
  existingNames: string[];
}

export function AddBotModal({ open, onClose, onAdd, existingNames }: AddBotModalProps) {
  const [name, setName] = useState('');
  const [customize, setCustomize] = useState(false);
  const [personality, setPersonality] = useState<AiPersonality>({ ...DEFAULT_PERSONALITY });
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

  const randomizePersonality = useCallback(() => {
    setPersonality({
      honesty: Math.floor(Math.random() * 101),
      skepticism: Math.floor(Math.random() * 101),
      vengefulness: Math.floor(Math.random() * 101),
    });
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const finalPersonality = customize
        ? personality
        : {
          honesty: Math.floor(Math.random() * 101),
          skepticism: Math.floor(Math.random() * 101),
          vengefulness: Math.floor(Math.random() * 101),
        };
      await onAdd(trimmed, finalPersonality);
      // Reset and close
      setName('');
      setCustomize(false);
      setPersonality({ ...DEFAULT_PERSONALITY });
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
              onClick={pickRandomName}
              className="btn-secondary text-sm px-3 py-2"
            >
              Random
            </button>
          </div>
        </div>

        {/* Customize Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setCustomize(!customize)}
            className={`relative w-10 h-5 rounded-full transition-colors ${customize ? 'bg-coup-accent' : 'bg-gray-600'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${customize ? 'translate-x-5' : ''}`}
            />
          </button>
          <span className="text-sm text-gray-300">Customize Personality</span>
        </div>

        {/* Personality Sliders */}
        {customize && (
          <div className="space-y-3 bg-coup-bg rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-gray-500 uppercase font-bold">Personality</span>
              <button
                type="button"
                onClick={randomizePersonality}
                className="text-xs text-gray-400 hover:text-white transition"
              >
                Randomize
              </button>
            </div>

            <SliderRow
              label="Honesty"
              value={personality.honesty}
              onChange={v => setPersonality(p => ({ ...p, honesty: v }))}
              color="bg-green-500"
              lowLabel="Deceptive"
              highLabel="Truthful"
            />
            <SliderRow
              label="Skepticism"
              value={personality.skepticism}
              onChange={v => setPersonality(p => ({ ...p, skepticism: v }))}
              color="bg-blue-500"
              lowLabel="Trusting"
              highLabel="Suspicious"
            />
            <SliderRow
              label="Vengefulness"
              value={personality.vengefulness}
              onChange={v => setPersonality(p => ({ ...p, vengefulness: v }))}
              color="bg-red-500"
              lowLabel="Forgiving"
              highLabel="Ruthless"
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
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

function SliderRow({
  label,
  value,
  onChange,
  color,
  lowLabel,
  highLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  lowLabel: string;
  highLabel: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="text-gray-400 font-mono">{value}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full appearance-none cursor-pointer accent-current ${color}`}
        style={{ accentColor: color === 'bg-green-500' ? '#22c55e' : color === 'bg-blue-500' ? '#3b82f6' : '#ef4444' }}
      />
      <div className="flex justify-between text-xs text-gray-500 mt-0.5">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
