'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClientGameState, TurnPhase } from '@/shared/types';
import { useGameStore } from '../../stores/gameStore';
import { computeAwards, computeBluffSummary } from '../../utils/gameStats';
import { useT } from '../../i18n/react';
import { CrownGlyph, SkullGlyph } from '../icons';
import { useStatsStore } from '../../stores/statsStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { FeedbackModal } from '../feedback/FeedbackForm';
import { FinalHands } from './gameover/FinalHands';
import { GameRecap } from './gameover/GameRecap';
import { MoreDetails } from './gameover/MoreDetails';
import { GameOverFooter } from './gameover/GameOverFooter';
import { bluffLine, challengeLine, finishOrLength, loserLine, readerOf, winnerLine } from './gameover/summary';
import { useRecapText } from './gameover/RecapText';
import { leaveFinishedGame } from './gameover/leaveGame';
import { useDialogFocus } from './gameover/useDialogFocus';

interface GameOverOverlayProps {
  gameState: ClientGameState;
  isHost: boolean;
  onRematch: () => void;
  isSpectator?: boolean;
  isPracticeRoom?: boolean;
  onExitPractice?: () => void;
}

/** How long the winner holds the screen before the other hands turn over. */
const REVEAL_BEAT_MS = 1400;

export function GameOverOverlay({ gameState, isHost, onRematch, isSpectator, isPracticeRoom, onExitPractice }: GameOverOverlayProps) {
  const router = useRouter();
  const t = useT();
  const challengeReveal = useGameStore(s => s.challengeReveal);
  const roomPlayers = useGameStore(s => s.roomPlayers);
  const hostId = useGameStore(s => s.hostId);
  const recordGame = useStatsStore(s => s.recordGame);
  const reducedMotionEnabled = useSettingsStore(s => s.reducedMotionEnabled);
  const [statsRecorded, setStatsRecorded] = useState(false);
  const [showFullTruth, setShowFullTruth] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const awards = useMemo(() => computeAwards(gameState), [gameState]);
  const bluffSummary = useMemo(() => computeBluffSummary(gameState), [gameState]);
  const finish = useMemo(() => finishOrLength(gameState), [gameState]);
  const bluffs = useMemo(() => bluffLine(gameState), [gameState]);
  const challenges = useMemo(() => challengeLine(gameState), [gameState]);
  const winnerFlavor = useMemo(() => winnerLine(gameState), [gameState]);
  const loserFlavor = useMemo(() => loserLine(gameState), [gameState]);
  const reader = useMemo(() => readerOf(gameState), [gameState]);
  const recapText = useRecapText(reader);
  const totalBluffs = useMemo(() => bluffSummary.reduce((sum, e) => sum + e.bluffs, 0), [bluffSummary]);
  const winsById = useMemo(() => new Map(roomPlayers.map(rp => [rp.id, rp.wins ?? 0] as const)), [roomPlayers]);

  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const feedbackLinkRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const handsHeadingId = useId();
  const recapHeadingId = useId();
  const awardsHeadingId = useId();

  // Wait for any challenge reveal animation to finish before showing.
  const visible = gameState.turnPhase === TurnPhase.GameOver && !challengeReveal;
  const onDialogKeyDown = useDialogFocus(visible, rootRef, titleRef);

  useEffect(() => {
    const isPracticeSession = isPracticeRoom || sessionStorage.getItem('coup_practice_room') === 'true';
    if (gameState.turnPhase === TurnPhase.GameOver && !challengeReveal && !statsRecorded && !isSpectator && !isPracticeSession) {
      recordGame(gameState);
      setStatsRecorded(true);
    }
  }, [gameState, challengeReveal, statsRecorded, recordGame, isSpectator, isPracticeRoom]);

  useEffect(() => {
    if (gameState.turnPhase !== TurnPhase.GameOver || challengeReveal) return;

    if (reducedMotionEnabled) {
      setShowFullTruth(true);
      return;
    }

    setShowFullTruth(false);
    const revealTimer = setTimeout(() => setShowFullTruth(true), REVEAL_BEAT_MS);
    return () => clearTimeout(revealTimer);
  }, [gameState.roomCode, gameState.turnNumber, gameState.turnPhase, gameState.winnerId, challengeReveal, reducedMotionEnabled]);

  const closeFeedback = useCallback(() => {
    setShowFeedback(false);
    // Back to the link that opened it, once the panel is no longer inert.
    requestAnimationFrame(() => feedbackLinkRef.current?.focus());
  }, []);

  const leave = useCallback(() => {
    leaveFinishedGame(!!isSpectator);
    router.push('/');
  }, [isSpectator, router]);

  if (!visible) return null;

  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const isMe = !isSpectator && winner?.id === gameState.myId;
  const isOnlyHuman = !isSpectator && gameState.players.filter(p => !p.isBot).length <= 1;
  // The server lets any connected player start the rematch once the host has dropped.
  const hostAway = !isSpectator && !roomPlayers.some(rp => rp.id === hostId && rp.connected && !rp.isBot);
  const lost = !isSpectator && !isMe;
  const personal = isSpectator ? null : isMe ? winnerFlavor : loserFlavor;
  // "Quick Exit" for you says what the line under the title already says
  // (loserLine leads with "You were the first player out").
  const recapAwards = awards.filter(a => !(a.id === 'quickExit' && a.playerId === gameState.myId && !isMe));

  return (
    <div
      ref={rootRef}
      className="gameover-root animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={onDialogKeyDown}
      data-gameover
    >
      <div className="gameover-panel bg-coup-surface panel-sunk" inert={showFeedback}>
        <div className="gameover-scroll">
          <header className="gameover-header">
            {/* The crown for a win, and for a spectator watching one; the skull only for a player who lost. */}
            <span className={`gameover-glyph ${lost ? 'text-coup-ink-mute' : 'text-coup-accent'}`} aria-hidden="true">
              {lost ? <SkullGlyph size={40} /> : <CrownGlyph size={40} />}
            </span>
            <div className="min-w-0">
              {/* ART-DIRECTION.md §4: the game-over title is the largest Display use in the app. */}
              <h1 id={titleId} ref={titleRef} tabIndex={-1} className="gameover-title type-display">
                {isMe
                  ? t('gameover.titleYouWin')
                  : winner
                    ? t.rich('gameover.titleWins', { name: <bdi>{winner.name}</bdi> })
                    : t('gameover.titleNobodyWins')}
              </h1>
              {personal && <p className="gameover-subtitle text-coup-accent">{recapText(personal)}</p>}
            </div>
          </header>

          <div className="gameover-body">
            <div className="gameover-col">
              <FinalHands
                gameState={gameState}
                winsById={winsById}
                showFaces={showFullTruth}
                headingId={handsHeadingId}
              />
            </div>
            <div className="gameover-col">
              {showFullTruth && (
                <GameRecap
                  finish={finish}
                  bluffs={bluffs}
                  allHonest={totalBluffs === 0}
                  challenges={challenges}
                  awards={recapAwards}
                  reader={reader}
                  headingId={recapHeadingId}
                  awardsHeadingId={awardsHeadingId}
                />
              )}
              <MoreDetails
                gameState={gameState}
                bluffSummary={bluffSummary}
                showBluffTable={showFullTruth && totalBluffs > 0}
                isPracticeRoom={isPracticeRoom}
                reader={reader}
              />
            </div>
          </div>
        </div>

        <GameOverFooter
          canRematch={isHost || isOnlyHuman || hostAway}
          isSpectator={isSpectator}
          isPracticeRoom={isPracticeRoom}
          onRematch={onRematch}
          onExitPractice={onExitPractice}
          onLeave={leave}
          onFeedback={() => setShowFeedback(true)}
          feedbackRef={feedbackLinkRef}
        />
      </div>
      <FeedbackModal open={showFeedback} onClose={closeFeedback} screen="game_over" />
    </div>
  );
}
