import type { NamespaceTranslation } from '../../schema';

/** pt-BR `home`. */
const home: NamespaceTranslation<'home'> = {
  srTitle: 'Coup Online: jogo de cartas de blefe multijogador e grátis',
  tagline: 'O jogo de cartas de blefe, online com amigos ou bots.',
  presenceOnline: '<fig>{count}</fig> online',
  presenceGames: '{count, plural, =0 {<fig>#</fig> partidas rolando} one {<fig>#</fig> partida rolando} other {<fig>#</fig> partidas rolando}}',
  myStats: 'Minhas estatísticas',

  playSection: 'Jogar',
  nameLabel: 'Seu nome',
  playVsBots: 'Jogar contra bots',
  playVsBotsSub: 'Começa já · {count, plural, =0 {# adversários} one {# adversário} other {# adversários}}',
  dealing: 'Distribuindo…',
  createRoom: 'Criar sala',
  joinRoom: 'Entrar na sala',
  publicRoom: 'Sala pública',
  publicRoomOn: 'Aparece nesta tela. Qualquer um pode entrar.',
  publicRoomOff: 'Só quem tiver o código pode entrar.',
  creating: 'Criando…',
  createAndInvite: 'Criar e convidar',
  codePlaceholder: 'CÓDIGO',
  roomCode: 'Código da sala',
  joining: 'Entrando…',
  join: 'Entrar',

  learnTitle: 'Aprender a jogar',
  learnSub: 'Uma partida guiada, um tutorial ou as regras',

  openTables: 'Mesas abertas',
  watchLive: 'Assistir ao vivo',
  browseAll: 'Ver todas',
  noPublicTables: 'Nenhuma mesa pública agora.',
  roomName: 'Mesa de {host}',
  roomPlayers: '<fig>{seats}</fig> jogadores',
  roomPlayersBetweenGames: '<fig>{seats}</fig> jogadores · entre partidas',
  roomPlayersWatching: '<fig>{seats}</fig> jogadores · {watching} assistindo',
  roomFull: 'Cheia',
  watch: 'Assistir',

  footer: '{min} a {max} jogadores · grátis · sem cadastro',
  source: 'Código',
  sourceLabel: 'Ver o código no GitHub',

  defaultSpectatorName: 'Espectador',
  defaultPlayerName: 'Jogador',

  guidedGame: 'Jogar uma partida guiada',
  guidedGameSub: 'Você contra 1 bot tranquilo. Um treinador mostra o que fazer em seguida.',
  tutorial: 'Fazer o tutorial',
  // {count} is the number of lessons (6 today); wording assumes several lessons.
  tutorialSub: '{count} lições curtas. Você testa cada jogada numa mesa pequena.',
  rules: 'Ler as regras',
  rulesSub: 'Personagens, ações, contestações e bloqueios. E a Reforma.',
  practiceFoot: 'Mais bots, outras regras ou sem treinador',
  practiceSetup: 'Montar um treino',

  installTitle: 'Instalar o Coup',
  installBody: 'Abre mais rápido, e os arquivos do jogo ficam salvos para um Wi-Fi fraco.',
  install: 'Instalar',
  installDismiss: 'Fechar o convite para instalar',
};

export default home;
