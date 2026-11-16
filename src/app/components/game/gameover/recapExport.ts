import type { ClientGameState } from '@/shared/types';
import { Character } from '@/shared/types';
import { characterName, factionName, gameModeName } from '@/app/i18n/glossary';
import { logLinePlain } from '@/app/i18n/logText';
import type { PlainTranslator } from '@/app/i18n/runtime';

/**
 * The plain-text recap behind Copy Recap and Download Log, in the reader's
 * language. It is written to be shared, so the log reads in the third
 * person with every player's name (no "you"), as the server wrote it.
 */
export function buildRecapExport(gameState: ClientGameState, t: PlainTranslator): string {
  const winner = gameState.players.find(p => p.id === gameState.winnerId);
  const names = new Map(gameState.players.map(p => [p.id, p.name] as const));
  const mode = gameModeName(t, gameState.gameMode);
  const lines = [
    t('gameover.exportTitle', { room: gameState.roomCode }),
    winner ? t('gameover.exportWinner', { name: winner.name }) : t('gameover.exportWinnerUnknown'),
    t('gameover.exportTurns', { count: gameState.turnNumber }),
    gameState.useInquisitor
      ? t('gameover.exportModeInquisitor', { mode, inquisitor: characterName(t, Character.Inquisitor) })
      : t('gameover.exportMode', { mode }),
    '',
    t('gameover.exportTableHeading'),
    ...gameState.players.map(player => {
      const cards = player.influences
        .map(inf => {
          if (!inf.character) return t('gameover.exportCardUnknown');
          const character = characterName(t, inf.character);
          return inf.revealed ? t('gameover.exportCardRevealed', { character }) : t('gameover.exportCardHidden', { character });
        })
        .join(t('gameover.exportListSeparator'));
      const status = player.id === gameState.winnerId
        ? t('gameover.exportStatusWinner')
        : player.isAlive ? t('gameover.exportStatusAlive') : t('gameover.exportStatusOut');
      const params = { name: player.name, status, coins: player.coins, cards };
      return player.faction
        ? t('gameover.exportPlayerFaction', { ...params, faction: factionName(t, player.faction) })
        : t('gameover.exportPlayer', params);
    }),
    '',
    t('gameover.exportLogHeading'),
    ...gameState.actionLog.map(entry => t('gameover.exportLogLine', {
      // Padded, so a string: "05", not the number 5.
      turn: String(entry.turnNumber).padStart(2, '0'),
      line: logLinePlain(entry, t, names, null),
    })),
  ];

  return lines.join('\n');
}
