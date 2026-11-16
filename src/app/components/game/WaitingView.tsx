'use client';

import { ClientGameState, TurnPhase } from '@/shared/types';
import { haptic } from '../../utils/haptic';
import { useT } from '../../i18n';

interface WaitingViewProps {
  gameState: ClientGameState;
  /** Leave the room and go back to the menu. */
  onLeave?: () => void;
  /** Start a fresh Play vs Bots game. Offered only when you are the one human here. */
  onNewGame?: () => void;
  /** A new game is being dealt: the buttons stay put but stop answering. */
  busy?: boolean;
}

/**
 * The seat of a player who has been knocked out.
 *
 * The game does not stop for them: the others (often all bots) play it out,
 * and they can stay and watch it to the end. What they need from the table is
 * to know that this is a choice, and the two ways out of it: leave, or, when
 * nobody else here is a person, deal a new game against bots straight away.
 *
 * It sits in the dock where your actions would be, on every screen size, so it
 * never covers the middle of the felt the watcher is following.
 *
 * Every other "waiting for X" line that used to live here is the phase line's
 * job (PhaseStatus), and the centre says each thing once.
 */
export function WaitingView({ gameState, onLeave, onNewGame, busy }: WaitingViewProps) {
  const t = useT();
  const { turnPhase, myId, players } = gameState;

  // The game-over overlay takes over from here.
  if (turnPhase === TurnPhase.GameOver) return null;

  const me = players.find(p => p.id === myId);
  if (!me || me.isAlive) return null;

  const onlyHuman = players.filter(p => !p.isBot).length === 1;
  const offerNewGame = onlyHuman && !!onNewGame;

  return (
    <div className="prompt-info watch-panel" role="region" aria-label={t('game.watch.label')}>
      <p className="watch-title type-display">{t('game.watch.title')}</p>
      <p className="watch-copy">
        {t('game.watch.body')}
      </p>
      {(onLeave || offerNewGame) && (
        <div className="watch-actions">
          {offerNewGame && (
            <button
              className="btn-primary"
              aria-disabled={busy || undefined}
              onClick={() => { if (busy) return; haptic(80); onNewGame?.(); }}
            >
              {busy ? t('game.dealing') : t('game.watch.newGame')}
            </button>
          )}
          {onLeave && (
            <button
              className="btn-secondary"
              aria-disabled={busy || undefined}
              onClick={() => { if (busy) return; haptic(); onLeave(); }}
            >
              {t('game.watch.leave')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
