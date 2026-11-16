import type { NamespaceTranslation } from '../../schema';

/** es `stats`. */
const stats: NamespaceTranslation<'stats'> = {
  title: 'Mis estadísticas',
  tabOverview: 'Resumen',
  tabAwards: 'Premios',
  tabHistory: 'Historial',

  empty: 'Todavía no has jugado ninguna partida.',
  emptyHint: 'Termina una partida para empezar a guardar estadísticas. Las partidas de práctica no cuentan.',

  reset: 'Borrar estadísticas',
  resetWarning: 'Esto borra todas tus estadísticas. No se puede deshacer.',
  resetConfirm: 'Confirmar',

  gamesPlayed: 'Partidas jugadas',
  gamesWon: 'Partidas ganadas',
  winRate: '% de victorias',
  winStreak: 'Racha',
  winStreakValue: '{current} (récord {best})',
  challengesMade: 'Desafíos lanzados',
  challengesWon: 'Desafíos ganados',
  challengesWonValue: '{won} ({accuracy})',
  blocksMade: 'Bloqueos',
  successfulBluffs: 'Faroles sin descubrir',
  timesCaught: 'Faroles descubiertos',
  coups: 'Coups',
  assassinations: 'Asesinatos',
  firstEliminated: 'Fuera antes que nadie',
  totalTurns: 'Turnos en total',
  favoriteAction: 'Acción favorita',
  noValue: '-',

  awardsEmpty: 'Termina partidas para ganar premios.',
  awardCount: 'x{count}',
  'awardCriterion.pantsOnFire': 'Más faroles descubiertos',
  'awardCriterion.honestAbe': 'Más desafíos superados, ningún farol descubierto',
  'awardCriterion.inquisitor': 'Más desafíos lanzados',
  'awardCriterion.eagleEye': 'Mejor puntería al desafiar',
  'awardCriterion.wall': 'Más bloqueos',
  'awardCriterion.smoothOperator': 'Muchas declaraciones, ningún farol descubierto',
  'awardCriterion.coupMachine': 'Más Coups lanzados',
  'awardCriterion.silentAssassin': 'Más Asesinatos',
  'awardCriterion.boldStrategy': 'Más desafíos que salieron mal',
  'awardCriterion.quickExit': 'Fuera antes que nadie',

  historyWonShort: 'V',
  historyLostShort: 'D',
  historyWon: 'Victoria',
  historyLost: 'Derrota',
  historyPlayers: '{count, plural, one {# jugador} other {# jugadores}}',
  historyTurns: '{count, plural, one {# turno} other {# turnos}}',
  historyChallenges: 'Desafíos: {made} ({won} ganados)',
  historyBlocks: 'Bloqueos: {count}',
  historyCoups: 'Coups: {count}',
  historyAssassinations: 'Asesinatos: {count}',
  historyAwards: 'Premios: {awards}',
  listSeparator: ', ',
};

export default stats;
