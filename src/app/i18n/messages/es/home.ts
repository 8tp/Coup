import type { NamespaceTranslation } from '../../schema';

/** es `home`. */
const home: NamespaceTranslation<'home'> = {
  srTitle: 'Coup Online: juego de cartas de faroles multijugador y gratis',
  tagline: 'El juego de faroles, online con amigos o bots.',
  presenceOnline: '<fig>{count}</fig> en línea',
  presenceGames: '{count, plural, one {<fig>#</fig> partida en juego} other {<fig>#</fig> partidas en juego}}',
  myStats: 'Mis estadísticas',

  playSection: 'Jugar',
  nameLabel: 'Tu nombre',
  playVsBots: 'Jugar con bots',
  playVsBotsSub: 'Empieza ya · {count, plural, one {# rival} other {# rivales}}',
  dealing: 'Repartiendo…',
  createRoom: 'Crear sala',
  joinRoom: 'Unirse a sala',
  publicRoom: 'Sala pública',
  publicRoomOn: 'Aparece en esta pantalla. Cualquiera puede unirse.',
  publicRoomOff: 'Solo puede unirse quien tenga el código.',
  creating: 'Creando…',
  createAndInvite: 'Crear e invitar',
  codePlaceholder: 'CÓDIGO',
  roomCode: 'Código de sala',
  joining: 'Entrando…',
  join: 'Entrar',

  learnTitle: 'Aprende a jugar',
  learnSub: 'Una partida guiada, un tutorial o las reglas',

  openTables: 'Mesas abiertas',
  watchLive: 'En vivo',
  browseAll: 'Ver todas',
  noPublicTables: 'Ahora no hay mesas públicas.',
  roomName: 'Mesa de {host}',
  roomPlayers: '<fig>{seats}</fig> jugadores',
  roomPlayersBetweenGames: '<fig>{seats}</fig> jugadores · entre partidas',
  roomPlayersWatching: '<fig>{seats}</fig> jugadores · {watching} mirando',
  roomFull: 'Llena',
  watch: 'Mirar',

  footer: '{min} a {max} jugadores · gratis · sin registro',
  source: 'Código',
  sourceLabel: 'Ver el código en GitHub',

  defaultSpectatorName: 'Espectador',
  defaultPlayerName: 'Jugador',

  guidedGame: 'Jugar una partida guiada',
  guidedGameSub: 'Tú contra 1 bot tranquilo. Un tutor te indica qué hacer.',
  tutorial: 'Hacer el tutorial',
  tutorialSub: '6 lecciones cortas. Pruebas cada jugada en una mesa pequeña.',
  rules: 'Leer las reglas',
  rulesSub: 'Personajes, acciones, desafíos y bloqueos. También Reforma.',
  practiceFoot: 'Más bots, otras reglas o sin tutor',
  practiceSetup: 'Configurar práctica',

  installTitle: 'Instalar Coup',
  installBody: 'Abre más rápido, y lo que ya se descargó del juego carga bien con wifi débil.',
  install: 'Instalar',
  installDismiss: 'Cerrar el aviso de instalación',
};

export default home;
