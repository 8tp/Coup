'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FEEDBACK_GITHUB_ISSUES_URL, FEEDBACK_MAX_LENGTH } from '@/shared/constants';
import type { FeedbackErrorCode, FeedbackKind, FeedbackScreen } from '@/shared/feedbackTypes';
import { TurnPhase } from '@/shared/types';
import { sendFeedback } from '../../hooks/useSocket';
import { useGameStore } from '../../stores/gameStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { collectFeedbackClientContext } from '../../utils/feedbackContext';
import { haptic } from '../../utils/haptic';
import { Modal } from '../ui/Modal';

const KIND_OPTIONS: { value: FeedbackKind; label: string; placeholder: string }[] = [
  { value: 'bug', label: 'Bug', placeholder: 'Tell us what happened and what you expected.' },
  { value: 'idea', label: 'Idea', placeholder: "Tell us what you'd change or add." },
  { value: 'other', label: 'Other', placeholder: 'Tell us anything.' },
];

const ERROR_COPY: Record<FeedbackErrorCode, string> = {
  invalid: "Couldn't send that note. Try again.",
  empty: 'Write a few words first.',
  too_long: `Keep it under ${FEEDBACK_MAX_LENGTH} characters.`,
  rate_limited: "You've sent a few notes already. Try again in a few minutes.",
  busy: 'Too many notes are coming in right now. Try again in a few minutes.',
  server_error: "Couldn't send. Check your connection and try again.",
};

type Status = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * Kept between openings so closing the form by accident doesn't lose a
 * half-written note. Memory only: it is gone on reload.
 */
let draft: { kind: FeedbackKind; message: string } = { kind: 'bug', message: '' };

/** Where the form is: the route, refined by whether the game has ended. */
function useFeedbackScreen(override?: FeedbackScreen): FeedbackScreen {
  const pathname = usePathname() ?? '';
  const gameOver = useGameStore(s => s.gameState?.turnPhase === TurnPhase.GameOver);
  if (override) return override;
  if (pathname === '/') return 'home';
  if (pathname.startsWith('/lobby')) return 'lobby';
  if (pathname.startsWith('/game')) return gameOver ? 'game_over' : 'game';
  return 'unknown';
}

interface FeedbackFormProps {
  /** Set when the caller knows better than the route (the game-over screen). */
  screen?: FeedbackScreen;
  /** Escape, and the "Done" button after sending. */
  onClose?: () => void;
  /** Label for the button that calls onClose before sending. Omit to hide it. */
  closeLabel?: string;
}

export function FeedbackForm({ screen: screenOverride, onClose, closeLabel }: FeedbackFormProps) {
  const screen = useFeedbackScreen(screenOverride);
  const textSize = useSettingsStore(s => s.textSize);
  const [kind, setKind] = useState<FeedbackKind>(draft.kind);
  const [message, setMessage] = useState(draft.message);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<FeedbackErrorCode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const kindRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const mounted = useRef(true);
  const fieldId = useId();
  const hintId = useId();
  const statusId = useId();

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => { draft = { kind, message }; }, [kind, message]);

  // Focus the note field on open, and again after "Write another".
  useEffect(() => {
    if (status === 'idle' || status === 'failed') textareaRef.current?.focus();
  }, [status]);

  // Escape closes (or goes back), wherever focus is inside the dialog.
  const sending = status === 'sending';
  useEffect(() => {
    if (!onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || sending) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, sending]);

  const trimmed = message.trim();
  const canSend = status !== 'sending' && trimmed.length > 0 && trimmed.length <= FEEDBACK_MAX_LENGTH;
  const placeholder = KIND_OPTIONS.find(o => o.value === kind)?.placeholder ?? '';

  const submit = async () => {
    if (!canSend) return;
    haptic(80);
    setStatus('sending');
    setError(null);
    const response = await sendFeedback({
      kind,
      message: trimmed,
      context: collectFeedbackClientContext(screen, textSize),
    });
    if (!mounted.current) {
      if (response.success) draft = { kind: 'bug', message: '' };
      return;
    }
    if (response.success) {
      setStatus('sent');
      setMessage('');
      setKind('bug');
    } else {
      setStatus('failed');
      setError(response.error);
    }
  };

  const onKindKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (index + step + KIND_OPTIONS.length) % KIND_OPTIONS.length;
    setKind(KIND_OPTIONS[next].value);
    kindRefs.current[next]?.focus();
  };

  if (status === 'sent') {
    return (
      <div className="space-y-4">
        <div className="panel-sunk bg-coup-bg/60 px-4 py-4" role="status">
          <p className="font-semibold text-coup-ink">Sent. Thanks for the note.</p>
          <p className="mt-1 text-sm text-coup-ink-mute">It goes straight to the developer.</p>
        </div>
        <div className={onClose ? 'grid grid-cols-2 gap-2' : ''}>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => { haptic(); setStatus('idle'); }}
          >
            Write another
          </button>
          {onClose && (
            <button type="button" className="btn-primary w-full" onClick={() => { haptic(); onClose(); }} autoFocus>
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      aria-busy={status === 'sending'}
    >
      <div className="lobby-seg !grid-cols-3" role="radiogroup" aria-label="Kind of note">
        {KIND_OPTIONS.map((opt, i) => (
          <button
            key={opt.value}
            ref={el => { kindRefs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={kind === opt.value}
            tabIndex={kind === opt.value ? 0 : -1}
            className={kind === opt.value ? 'is-on' : ''}
            onClick={() => { haptic(); setKind(opt.value); }}
            onKeyDown={(e) => onKindKeyDown(e, i)}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor={fieldId} className="sr-only">Your note</label>
        <textarea
          id={fieldId}
          ref={textareaRef}
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            if (status === 'failed') { setStatus('idle'); setError(null); }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          maxLength={FEEDBACK_MAX_LENGTH}
          rows={5}
          placeholder={placeholder}
          aria-describedby={`${hintId} ${statusId}`}
          disabled={status === 'sending'}
          className="input-field block min-h-[8rem] resize-y leading-snug"
        />
        <div className="mt-1.5 flex items-start justify-between gap-3 text-xs text-coup-ink-mute">
          <span id={hintId}>Sent without your name or room code.</span>
          <span className="figure shrink-0" aria-hidden="true">{message.length}/{FEEDBACK_MAX_LENGTH}</span>
        </div>
      </div>

      <div id={statusId} role="status" aria-live="polite">
        {status === 'failed' && error && <p className="menu-error">{ERROR_COPY[error]}</p>}
      </div>

      <div className={onClose && closeLabel ? 'grid grid-cols-2 gap-2' : ''}>
        {onClose && closeLabel && (
          <button type="button" className="btn-secondary w-full" onClick={() => { haptic(); onClose(); }} disabled={status === 'sending'}>
            {closeLabel}
          </button>
        )}
        <button type="submit" className="btn-primary w-full" disabled={!canSend}>
          {status === 'sending' ? 'Sending' : status === 'failed' ? 'Try again' : 'Send'}
        </button>
      </div>

      <div className="flex justify-center">
        <a
          href={FEEDBACK_GITHUB_ISSUES_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => haptic()}
          className="inline-flex min-h-[44px] items-center px-2 text-sm text-coup-ink-mute underline underline-offset-4 hover:text-coup-accent"
        >
          Open a GitHub issue instead
        </a>
      </div>
    </form>
  );
}

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  screen?: FeedbackScreen;
}

/** The form in its own dialog, for screens without a settings modal at hand. */
export function FeedbackModal({ open, onClose, screen }: FeedbackModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Send feedback" maxWidth="max-w-md">
      <FeedbackForm screen={screen} onClose={onClose} closeLabel="Cancel" />
    </Modal>
  );
}
