'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClientGameState, ClientInfluence, TurnPhase } from '@/shared/types';
import { useGameStore } from '../../stores/gameStore';
import { computeAwards, computeBluffSummary, computeGameRecap, getWinnerFlavorText, getLoserFlavorText } from '../../utils/gameStats';
import type { RecapTone } from '../../utils/gameStats';
import { formatLogMessage } from '../../utils/logFormat';
import { AWARD_GLYPHS } from '../../utils/logGlyphs';
import { CrownGlyph, SkullGlyph } from '../icons';
import { haptic } from '../../utils/haptic';
import { useStatsStore } from '../../stores/statsStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { CardFace } from './CardFace';
import { ActionLog } from './ActionLog';

const hiddenInfluence: ClientInfluence = { character: null, revealed: false };

function ResultCard({ influence, revealed = true }: { influence: ClientInfluence; revealed?: boolean }) {
  if (!revealed) return <CardFace influence={hiddenInfluence} size="sm" disablePreview />;
  if (!influence.character) return null;
  return <CardFace influence={influence} size="sm" />;
}

function recapToneClass(tone: RecapTone): string {
  switch (tone) {
    case 'gold':
      return 'bg-coup-accent/15';
    case 'green':
      return 'bg-green-500/15';
    case 'red':
      return 'bg-red-500/15';
    case 'blue':
      return 'bg-blue-500/15';
    case 'purple':
      return 'bg-purple-500/15';
    case 'gray':
    default:
      return 'bg-coup-bg/60';
  }
}

interface GameOverOverlayProps {
  gameState: ClientGameState;
  isHost: boolean;
  onRematch: () => void;
  isSpectator?: boolean;
  isPracticeRoom?: boolean;
  onExitPractice?: () => void;
}

function buildReplayExport(gameState: ClientGameState): string {
  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const lines = [
    `Coup Online recap - room ${gameState.roomCode}`,
    `Winner: ${winner?.name ?? 'Unknown'}`,
    `Turns: ${gameState.turnNumber}`,
    `Mode: ${gameState.gameMode}${gameState.useInquisitor ? ' with Inquisitor' : ''}`,
    '',
    'Final table:',
    ...gameState.players.map(player => {
      const cards = player.influences
        .map(inf => `${inf.character ?? 'Hidden'}${inf.revealed ? ' revealed' : ' hidden'}`)
        .join(', ');
      const status = player.id === gameState.winnerId ? 'winner' : player.isAlive ? 'alive' : 'eliminated';
      const faction = player.faction ? `, ${player.faction}` : '';
      return `- ${player.name}: ${status}, ${player.coins} coin${player.coins === 1 ? '' : 's'}${faction}, ${cards}`;
    }),
    '',
    'Final log:',
    ...gameState.actionLog.map(entry => {
      const turn = String(entry.turnNumber).padStart(2, '0');
      return `[T${turn}] ${entry.message}`;
    }),
  ];

  return lines.join('\n');
}

export function GameOverOverlay({ gameState, isHost, onRematch, isSpectator, isPracticeRoom, onExitPractice }: GameOverOverlayProps) {
  const [showLog, setShowLog] = useState(false);
  const challengeReveal = useGameStore(s => s.challengeReveal);
  const roomPlayers = useGameStore(s => s.roomPlayers);
  const recordGame = useStatsStore(s => s.recordGame);
  const reducedMotionEnabled = useSettingsStore(s => s.reducedMotionEnabled);
  const [statsRecorded, setStatsRecorded] = useState(false);
  const [showFullTruth, setShowFullTruth] = useState(false);
  const [exportStatus, setExportStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const awards = useMemo(() => computeAwards(gameState), [gameState]);
  const bluffSummary = useMemo(() => computeBluffSummary(gameState), [gameState]);
  const recap = useMemo(() => computeGameRecap(gameState), [gameState]);
  const winnerFlavor = useMemo(() => getWinnerFlavorText(gameState), [gameState]);
  const loserFlavor = useMemo(() => getLoserFlavorText(gameState), [gameState]);
  const totalBluffs = useMemo(() => bluffSummary.reduce((sum, e) => sum + e.bluffs, 0), [bluffSummary]);

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
    const revealTimer = setTimeout(() => setShowFullTruth(true), 1400);
    return () => clearTimeout(revealTimer);
  }, [gameState.roomCode, gameState.turnNumber, gameState.turnPhase, gameState.winnerId, challengeReveal, reducedMotionEnabled]);

  // Wait for any challenge reveal animation to finish before showing
  if (gameState.turnPhase !== TurnPhase.GameOver || challengeReveal) return null;

  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const isMe = !isSpectator && winner?.id === gameState.myId;
  const isOnlyHuman = !isSpectator && gameState.players.filter(p => !p.isBot).length <= 1;
  const myName = gameState.players.find(p => p.id === gameState.myId)?.name ?? '';

  // Sort: winner first, then alive, then eliminated
  const sortedPlayers = [...gameState.players].sort((a, b) => {
    if (a.id === gameState.winnerId) return -1;
    if (b.id === gameState.winnerId) return 1;
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    return 0;
  });
  const nonWinnerPlayers = sortedPlayers.filter(p => p.id !== gameState.winnerId);
  const replayText = buildReplayExport(gameState);

  const copyReplay = () => {
    haptic();
    if (!navigator.clipboard?.writeText) {
      setExportStatus('error');
      return;
    }
    navigator.clipboard.writeText(replayText)
      .then(() => {
        setExportStatus('copied');
        setTimeout(() => setExportStatus('idle'), 2000);
      })
      .catch(() => setExportStatus('error'));
  };

  const downloadReplay = () => {
    haptic();
    const blob = new Blob([replayText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `coup-${gameState.roomCode.toLowerCase()}-recap.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in p-4">
      <div className="bg-coup-surface panel-sunk max-w-sm sm:max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="text-center pt-8 pb-4 px-6">
          <div className="mb-3 flex justify-center text-coup-accent">
            {isMe ? <CrownGlyph size={56} /> : <SkullGlyph size={56} className="text-coup-ink-mute" />}
          </div>
          {/* ART-DIRECTION.md §4: the game-over title is the largest Display use in the app. */}
          <h1 className="type-display text-step-4 mb-1 uppercase">
            {isMe ? 'You Win!' : `${winner?.name} Wins!`}
          </h1>
          <p className="text-coup-accent text-sm">
            {isMe ? winnerFlavor : loserFlavor}
          </p>
          <p className="text-coup-ink-mute text-xs mt-1">
            {gameState.turnNumber} turns
          </p>
        </div>

        {/* Winning hand */}
        {winner && (
          <div className="px-4 pb-4">
            <p className="text-center text-xs text-coup-ink-mute uppercase tracking-wider mb-2">Winning Hand</p>
            <div className="panel-sunk bg-coup-accent/15 px-3 py-3">
              <div className="flex items-center gap-3">
                <CrownGlyph size={20} className="flex-none text-coup-accent" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-coup-accent truncate">
                    {winner.id === gameState.myId ? 'You' : winner.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {winner.coins} coin{winner.coins === 1 ? '' : 's'} left
                  </p>
                </div>
                <div className="flex gap-1.5 flex-none">
                  {winner.influences.map((inf, i) => (
                    <ResultCard key={i} influence={inf} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Table truth */}
        <div className="px-4 pb-4">
          <p className="text-center text-xs text-coup-ink-mute uppercase tracking-wider mb-2">Table Truth</p>
          {!showFullTruth && nonWinnerPlayers.length > 0 ? (
            <div className="panel-sunk bg-coup-bg/60 px-4 py-4 text-center">
              <p className="text-sm font-medium text-gray-300">Revealing the rest of the table...</p>
              <button
                type="button"
                className="mt-3 text-xs text-coup-accent hover:text-yellow-300 transition-colors"
                onClick={() => { haptic(); setShowFullTruth(true); }}
              >
                Reveal now
              </button>
            </div>
          ) : (
            <div className="bg-coup-bg/60 panel-sunk divide-y divide-coup-line/60">
              {nonWinnerPlayers.map(p => {
              const wins = roomPlayers.find(rp => rp.id === p.id)?.wins ?? 0;
              return (
                <div
                  key={p.id}
                  className="flex items-center px-3 py-2.5 gap-3 animate-fade-in"
                >
                  {/* Place indicator */}
                  <span className="w-5 flex-none flex justify-center text-coup-ink-mute">
                    {!p.isAlive && <SkullGlyph size={14} title="Eliminated" />}
                  </span>

                  {/* Name + win count */}
                  <span className={`text-sm font-medium flex-1 truncate min-w-0 ${
                    p.isAlive ? 'text-gray-300' : 'text-coup-ink-mute'
                  }`}>
                    {p.id === gameState.myId ? 'You' : p.name}
                  </span>
                  {wins > 0 && (
                    <span className="shrink-0 text-[10px] bg-yellow-600/80 text-white px-1.5 py-px rounded-full font-bold">
                      {wins}W
                    </span>
                  )}

                  {/* Cards */}
                  <div className="flex gap-1.5 flex-none">
                    {p.influences.map((inf, i) => (
                      <ResultCard key={i} influence={inf} />
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>

        {/* Final recap */}
        {showFullTruth && recap.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-center text-xs text-coup-ink-mute uppercase tracking-wider mb-2">Final Recap</p>
            <div className="grid grid-cols-2 gap-2">
              {recap.map(item => (
                <div
                  key={item.label}
                  className={`panel-sunk p-2.5 min-w-0 animate-fade-in ${recapToneClass(item.tone)}`}
                >
                  <p className="text-[10px] uppercase tracking-wide text-coup-ink-mute font-bold mb-1">{item.label}</p>
                  <p className="text-sm font-bold text-gray-100 leading-snug">{item.value}</p>
                  <p className="text-xs text-gray-400 leading-snug mt-1">{formatLogMessage(item.detail, myName)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Awards */}
        {showFullTruth && awards.length > 0 && (
          <div className="px-4 pb-4">
            <p className="text-center text-xs text-coup-ink-mute uppercase tracking-wider mb-2">Awards</p>
            <div className="bg-coup-bg/60 panel-sunk divide-y divide-coup-line/60">
              {awards.map((award, i) => {
                const AwardGlyph = AWARD_GLYPHS[award.glyph];
                return (
                <div key={i} className="px-3 py-2.5 flex items-start gap-2.5">
                  <AwardGlyph size={18} className="mt-0.5 flex-none text-coup-accent" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-200">{award.title}</p>
                    <p className="text-xs"><span className="text-gray-300 font-medium">{award.playerName}</span><span className="text-coup-ink-mute"> · {award.description}</span></p>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Truth Reveal */}
        {showFullTruth && totalBluffs > 0 && (
          <div className="px-4 pb-4">
            <p className="text-center text-xs text-coup-ink-mute uppercase tracking-wider mb-2">Truth Reveal</p>
            <div className="bg-coup-bg/60 panel-sunk divide-y divide-coup-line/60">
              {bluffSummary.map(entry => {
                const bluffRate = entry.totalClaims > 0 ? Math.round((entry.bluffs / entry.totalClaims) * 100) : 0;
                return (
                  <div key={entry.playerId} className="px-3 py-2.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{entry.playerName}</p>
                      <p className="text-xs text-coup-ink-mute">
                        {entry.totalClaims} claim{entry.totalClaims !== 1 ? 's' : ''}
                        {entry.bluffs > 0 && (
                          <span className="text-red-400"> · {entry.bluffs} bluff{entry.bluffs !== 1 ? 's' : ''}</span>
                        )}
                        {entry.bluffs === 0 && (
                          <span className="text-green-400"> · all honest</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                      {entry.bluffs > 0 ? (
                        <>
                          {entry.unchallengedBluffs > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                              {entry.unchallengedBluffs} got away
                            </span>
                          )}
                          {entry.caughtBluffing > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              {entry.caughtBluffing} caught
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400/80 border border-green-500/20">
                          honest
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Game Log */}
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              className="rounded-lg border border-coup-line bg-coup-bg/70 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-coup-accent hover:text-coup-accent"
              onClick={copyReplay}
            >
              Copy Recap
            </button>
            <button
              type="button"
              className="rounded-lg border border-coup-line bg-coup-bg/70 px-3 py-2 text-xs font-bold text-gray-300 transition hover:border-coup-accent hover:text-coup-accent"
              onClick={downloadReplay}
            >
              Download Log
            </button>
          </div>
          <p className="min-h-4 text-center text-[11px] text-coup-ink-mute" aria-live="polite">
            {exportStatus === 'copied' && 'Recap copied'}
            {exportStatus === 'error' && 'Copy unavailable - download the log instead'}
          </p>
          <button
            className="w-full text-xs text-gray-400 hover:text-gray-200 transition-colors py-1"
            onClick={() => setShowLog(v => !v)}
          >
            {showLog ? 'Hide Log' : 'Show Full Log'}
          </button>
          {showLog && (
            <div className="mt-2 max-h-60 overflow-y-auto bg-coup-bg/60 panel-sunk">
              <ActionLog
                log={gameState.actionLog}
                myName={gameState.players.find(p => p.id === gameState.myId)?.name ?? ''}
                turnPhase={gameState.turnPhase}
                showExplanations={isPracticeRoom}
              />
            </div>
          )}
        </div>

        {/* Action */}
        <div className="px-6 pb-6">
          {isPracticeRoom ? (
            <button className="btn-primary w-full" onClick={() => { haptic(80); onExitPractice?.(); }} disabled={!onExitPractice}>
              Back Home
            </button>
          ) : isSpectator ? (
            <p className="text-purple-400 text-sm text-center">
              Spectating
            </p>
          ) : isHost || isOnlyHuman ? (
            <button className="btn-primary w-full" onClick={() => { haptic(80); onRematch(); }}>
              Play Again
            </button>
          ) : (
            <p className="text-coup-ink-mute text-sm text-center">
              Waiting for host to start rematch...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
