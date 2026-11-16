'use client';

import type { Ref } from 'react';
import { haptic } from '../../../utils/haptic';
import { useT } from '../../../i18n/react';

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
  const t = useT();
  let primary: React.ReactNode;
  if (isPracticeRoom) {
    primary = (
      <button
        type="button"
        className="btn-primary gameover-primary"
        onClick={() => { haptic(80); onExitPractice?.(); }}
        disabled={!onExitPractice}
      >
        {t('gameover.backHome')}
      </button>
    );
  } else if (isSpectator) {
    primary = <p className="gameover-status">{t('gameover.spectating')}</p>;
  } else if (canRematch) {
    primary = (
      <button type="button" className="btn-primary gameover-primary" onClick={() => { haptic(80); onRematch(); }}>
        {t('gameover.playAgain')}
      </button>
    );
  } else {
    primary = <p className="gameover-status" role="status">{t('gameover.waitingForHost')}</p>;
  }

  return (
    <footer className="gameover-footer">
      <button
        ref={feedbackRef}
        type="button"
        className="gameover-feedback"
        onClick={() => { haptic(); onFeedback(); }}
      >
        {t('gameover.feedback')}
      </button>
      <div className="gameover-actions">
        {!isPracticeRoom && (
          <button type="button" className="btn-secondary gameover-leave" onClick={() => { haptic(); onLeave(); }}>
            {t('gameover.leave')}
          </button>
        )}
        {primary}
      </div>
    </footer>
  );
}
