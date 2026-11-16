import type { NamespaceTranslation } from '../../schema';

/** pt-BR `stats`. */
const stats: NamespaceTranslation<'stats'> = {
  title: 'Minhas estatísticas',
  tabOverview: 'Resumo',
  tabAwards: 'Prêmios',
  tabHistory: 'Histórico',

  empty: 'Nenhuma partida jogada ainda.',
  emptyHint: 'Termine uma partida para começar a contar. Treinos não contam.',

  reset: 'Zerar estatísticas',
  resetWarning: 'Isso apaga todas as suas estatísticas. Não dá para desfazer.',
  resetConfirm: 'Confirmar',

  gamesPlayed: 'Partidas jogadas',
  gamesWon: 'Partidas vencidas',
  winRate: 'Taxa de vitória',
  winStreak: 'Sequência de vitórias',
  winStreakValue: '{current} (recorde {best})',
  challengesMade: 'Contestações feitas',
  challengesWon: 'Contestações ganhas',
  challengesWonValue: '{won} ({accuracy})',
  blocksMade: 'Bloqueios feitos',
  successfulBluffs: 'Blefes que passaram',
  timesCaught: 'Blefes descobertos',
  coups: 'Golpes',
  assassinations: 'Assassinatos',
  firstEliminated: 'Saiu primeiro',
  totalTurns: 'Turnos no total',
  favoriteAction: 'Ação favorita',
  noValue: '-',

  awardsEmpty: 'Termine partidas para ganhar prêmios.',
  awardCount: 'x{count}',
  'awardCriterion.pantsOnFire': 'Mais blefes descobertos',
  'awardCriterion.honestAbe': 'Mais vezes com a carta contestada, nenhum blefe descoberto',
  'awardCriterion.inquisitor': 'Mais contestações feitas',
  'awardCriterion.eagleEye': 'Melhor taxa de acerto nas contestações',
  'awardCriterion.wall': 'Mais bloqueios feitos',
  'awardCriterion.smoothOperator': 'Muitas alegações, nenhum blefe descoberto',
  'awardCriterion.coupMachine': 'Mais Golpes dados',
  'awardCriterion.silentAssassin': 'Mais assassinatos',
  'awardCriterion.boldStrategy': 'Mais contestações que deram errado',
  'awardCriterion.quickExit': 'Primeira pessoa eliminada',

  historyWonShort: 'V',
  historyLostShort: 'D',
  historyWon: 'Vitória',
  historyLost: 'Derrota',
  historyPlayers: '{count, plural, =0 {# jogadores} one {# jogador} other {# jogadores}}',
  historyTurns: '{count, plural, =0 {# turnos} one {# turno} other {# turnos}}',
  historyChallenges: 'Contestações: {made} ({won} ganhas)',
  historyBlocks: 'Bloqueios: {count}',
  historyCoups: 'Golpes: {count}',
  historyAssassinations: 'Assassinatos: {count}',
  historyAwards: 'Prêmios: {awards}',
  listSeparator: ', ',
};

export default stats;
