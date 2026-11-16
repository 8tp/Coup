'use client';

import { useState } from 'react';
import type { ClientGameState } from '@/shared/types';
import type { BluffSummaryEntry } from '../../../utils/gameStats';
import { haptic } from '../../../utils/haptic';
import { useT } from '../../../i18n/react';
import { ActionLog } from '../ActionLog';
import { buildRecapExport } from './recapExport';
import { bluffRowText, type Reader } from './summary';

interface MoreDetailsProps {
  gameState: ClientGameState;
  bluffSummary: BluffSummaryEntry[];
  showBluffTable: boolean;
  isPracticeRoom?: boolean;
  reader: Reader;
}

/**
 * The long tail, folded away: per-player bluffs, the full log, and the
 * recap export. None of it is needed to read the result.
 */
export function MoreDetails({ gameState, bluffSummary, showBluffTable, isPracticeRoom, reader }: MoreDetailsProps) {
  const t = useT();
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
    navigator.clipboard.writeText(buildRecapExport(gameState, t))
      .then(() => {
        setExportStatus('copied');
        setTimeout(() => setExportStatus('idle'), 2000);
      })
      .catch(() => setExportStatus('error'));
  };

  const downloadReplay = () => {
    haptic();
    const blob = new Blob([buildRecapExport(gameState, t)], { type: 'text/plain;charset=utf-8' });
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
    <section className="gameover-section" aria-label={t('gameover.moreLabel')}>
      <div className="gameover-more">
        {showBluffTable && (
          <button
            type="button"
            className="btn-ghost"
            aria-expanded={open === 'bluffs'}
            aria-controls="gameover-bluffs"
            onClick={() => toggle('bluffs')}
          >
            {open === 'bluffs' ? t('gameover.hideBluffs') : t('gameover.showBluffs')}
          </button>
        )}
        <button
          type="button"
          className="btn-ghost"
          aria-expanded={open === 'log'}
          aria-controls="gameover-log"
          onClick={() => toggle('log')}
        >
          {open === 'log' ? t('gameover.hideLog') : t('gameover.showLog')}
        </button>
        <button type="button" className="btn-ghost" onClick={copyReplay}>
          {t('gameover.copyRecap')}
        </button>
        <button type="button" className="btn-ghost" onClick={downloadReplay}>
          {t('gameover.downloadLog')}
        </button>
      </div>
      <p className="gameover-export-status" aria-live="polite">
        {exportStatus === 'copied' && t('gameover.recapCopied')}
        {exportStatus === 'error' && t('gameover.copyFailed')}
      </p>

      {open === 'bluffs' && showBluffTable && (
        <ul id="gameover-bluffs" className="gameover-plate gameover-lines">
          {bluffSummary.map(entry => (
            <li key={entry.playerId} className="gameover-bluff-row">
              <span className="gameover-bluff-name">
                {entry.playerId === reader.myId ? t('gameover.youName') : <bdi>{reader.names.get(entry.playerId) ?? t('gameover.someone')}</bdi>}
              </span>
              <span className="gameover-bluff-detail">{bluffRowText(entry, t)}</span>
            </li>
          ))}
        </ul>
      )}

      {open === 'log' && (
        <div id="gameover-log" className="gameover-plate gameover-log">
          <ActionLog
            log={gameState.actionLog}
            players={gameState.players}
            turnPhase={gameState.turnPhase}
            showExplanations={isPracticeRoom}
          />
        </div>
      )}
    </section>
  );
}
