'use client';

import type { Ref } from 'react';
import { haptic } from '../../../utils/haptic';

interface GameOverFooterProps {
  /** Host, the only human, or the host has dropped: this player starts the rematch. */
  canRematch: boolean;
  isSpectator?: boolean;
  isPracticeRoom?: boolean;
  onRematch: () => void;
  onExitPractice?: () => void;
  onLeave: () => void;
  onFeedback: () => void;
  feedbackRef?: Ref<HTMLButtonElement>;
}

/**
 * The actions, pinned under the scrolling content so the rematch is on screen
 * the moment the result is. Practice has one way out, so it shows no Leave.
 *
 * DOM order is the desktop reading order (feedback, Leave, primary); on a
 * phone the CSS stacks the actions above the feedback link.
 */
export function GameOverFooter({
  canRematch,
  isSpectator,
  isPracticeRoom,
  onRematch,
  onExitPractice,
  onLeave,
  onFeedback,
  feedbackRef,
}: GameOverFooterProps) {
  let primary: React.ReactNode;
  if (isPracticeRoom) {
    primary = (
      <button
        type="button"
        className="btn-primary gameover-primary"
        onClick={() => { haptic(80); onExitPractice?.(); }}
        disabled={!onExitPractice}
      >
        Back Home
      </button>
    );
  } else if (isSpectator) {
    primary = <p className="gameover-status">Spectating</p>;
  } else if (canRematch) {
    primary = (
      <button type="button" className="btn-primary gameover-primary" onClick={() => { haptic(80); onRematch(); }}>
        Play Again
      </button>
    );
  } else {
    primary = <p className="gameover-status" role="status">Waiting for the host to start a rematch</p>;
  }

  return (
    <footer className="gameover-footer">
      <button
        ref={feedbackRef}
        type="button"
        className="gameover-feedback"
        onClick={() => { haptic(); onFeedback(); }}
      >
        Report a bug or idea
      </button>
      <div className="gameover-actions">
        {!isPracticeRoom && (
          <button type="button" className="btn-secondary gameover-leave" onClick={() => { haptic(); onLeave(); }}>
            Leave
          </button>
        )}
        {primary}
      </div>
    </footer>
  );
}
