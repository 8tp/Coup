'use client';

import { useState } from 'react';
import type { ClientGameState } from '@/shared/types';
import type { BluffSummaryEntry } from '../../../utils/gameStats';
import { haptic } from '../../../utils/haptic';
import { ActionLog } from '../ActionLog';

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function buildReplayExport(gameState: ClientGameState): string {
  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const lines = [
    `Coup Online recap, room ${gameState.roomCode}`,
    `Winner: ${winner?.name ?? 'Unknown'}`,
    `Turns: ${gameState.turnNumber}`,
    `Mode: ${gameState.gameMode}${gameState.useInquisitor ? ' with Inquisitor' : ''}`,
    '',
    'Final table:',
    ...gameState.players.map(player => {
      const cards = player.influences
        .map(inf => (inf.character ? `${inf.character} ${inf.revealed ? 'revealed' : 'hidden'}` : 'hidden card'))
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

function bluffDetail(entry: BluffSummaryEntry): string {
  const claims = plural(entry.totalClaims, 'claim');
  if (entry.bluffs === 0) return `${claims}, all honest`;
  const parts = [claims, plural(entry.bluffs, 'bluff')];
  if (entry.caughtBluffing > 0) parts.push(`${entry.caughtBluffing} caught`);
  if (entry.unchallengedBluffs > 0) parts.push(`${entry.unchallengedBluffs} got away`);
  return parts.join(' · ');
}

interface MoreDetailsProps {
  gameState: ClientGameState;
  bluffSummary: BluffSummaryEntry[];
  showBluffTable: boolean;
  isPracticeRoom?: boolean;
  myName: string;
}

/**
 * The long tail, folded away: per-player bluffs, the full log, and the
 * recap export. None of it is needed to read the result.
 */
export function MoreDetails({ gameState, bluffSummary, showBluffTable, isPracticeRoom, myName }: MoreDetailsProps) {
  const [open, setOpen] = useState<'bluffs' | 'log' | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'copied' | 'error'>('idle');

  const toggle = (which: 'bluffs' | 'log') => {
    haptic();
    setOpen(v => (v === which ? null : which));
  };

  const copyReplay = () => {
    haptic();
    if (!navigator.clipboard?.writeText) {
      setExportStatus('error');
      return;
    }
    navigator.clipboard.writeText(buildReplayExport(gameState))
      .then(() => {
        setExportStatus('copied');
        setTimeout(() => setExportStatus('idle'), 2000);
      })
      .catch(() => setExportStatus('error'));
  };

  const downloadReplay = () => {
    haptic();
    const blob = new Blob([buildReplayExport(gameState)], { type: 'text/plain;charset=utf-8' });
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
    <section className="gameover-section" aria-label="More about this game">
      <div className="gameover-more">
        {showBluffTable && (
          <button
            type="button"
            className="btn-ghost"
            aria-expanded={open === 'bluffs'}
            aria-controls="gameover-bluffs"
            onClick={() => toggle('bluffs')}
          >
            {open === 'bluffs' ? 'Hide Bluffs' : 'Show Bluffs'}
          </button>
        )}
        <button
          type="button"
          className="btn-ghost"
          aria-expanded={open === 'log'}
          aria-controls="gameover-log"
          onClick={() => toggle('log')}
        >
          {open === 'log' ? 'Hide Log' : 'Show Full Log'}
        </button>
        <button type="button" className="btn-ghost" onClick={copyReplay}>
          Copy Recap
        </button>
        <button type="button" className="btn-ghost" onClick={downloadReplay}>
          Download Log
        </button>
      </div>
      <p className="gameover-export-status" aria-live="polite">
        {exportStatus === 'copied' && 'Recap copied'}
        {exportStatus === 'error' && 'Can\'t copy here. Download the log instead.'}
      </p>

      {open === 'bluffs' && showBluffTable && (
        <ul id="gameover-bluffs" className="gameover-plate gameover-lines">
          {bluffSummary.map(entry => (
            <li key={entry.playerId} className="gameover-bluff-row">
              <span className="gameover-bluff-name">{entry.playerName}</span>
              <span className="gameover-bluff-detail">{bluffDetail(entry)}</span>
            </li>
          ))}
        </ul>
      )}

      {open === 'log' && (
        <div id="gameover-log" className="gameover-plate gameover-log">
          <ActionLog
            log={gameState.actionLog}
            myName={myName}
            turnPhase={gameState.turnPhase}
            showExplanations={isPracticeRoom}
          />
        </div>
      )}
    </section>
  );
}
