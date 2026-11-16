import type { NamespaceTranslation } from '../../schema';

/**
 * pt-BR `seo`. Written for what Brazilian players search: "coup online",
 * "jogar coup online", "coup jogo de cartas", "coup online grátis",
 * "coup com amigos". Character and action names follow the Brazilian edition.
 */
const seo: NamespaceTranslation<'seo'> = {
  title: 'Coup Online: jogue Coup grátis com amigos ou contra bots',
  description: 'Jogue Coup, o jogo de cartas de blefe, online e grátis com amigos ou contra bots. Alegue personagens, conteste blefes e extorqua moedas. De 2 a 6 jogadores.',
  ogTitle: 'Coup Online',
  ogImageAlt: 'Coup Online, um jogo de cartas de blefe multijogador',
  manifestDescription: 'Coup multijogador em tempo real. Blefe e conteste amigos ou bots, sem precisar de conta.',

  aboutHeading: 'Sobre o Coup Online',
  aboutIntro: 'Coup Online é uma versão gratuita para navegador de Coup, o jogo de cartas de blefe e dedução para {min, number} a {max, number} jogadores. Cada jogador começa com 2 cartas de personagem viradas para baixo, chamadas de influência, e 2 moedas. Você pode alegar qualquer personagem, tendo a carta ou não. Perdeu as duas cartas, está fora. Vence quem ficar por último com uma carta.',
  roundHeading: 'Como funciona um turno',
  roundBody: 'Na sua vez, você faz uma ação. Renda e Ajuda Externa dão moedas. Uma ação de personagem, como Taxar com o Duque ou Extorquir com o Capitão, é uma alegação de que você tem aquela carta. Qualquer jogador pode contestar uma alegação: se era blefe, quem blefou perde uma carta, e se era verdade, quem contestou perde. Algumas ações podem ser bloqueadas alegando o personagem certo, e o bloqueio também pode ser contestado. Com {coupCost, number} moedas você pode dar um Golpe de Estado, que tira uma carta de qualquer jogador e não pode ser bloqueado. Com {forcedCoup, number} moedas, o Golpe é obrigatório.',
  freeHeading: 'Grátis e sem cadastro',
  freeBody: 'O Coup Online é grátis. Não tem cadastro: digite um nome e jogue. Funciona no navegador do celular, do tablet e do computador, e você pode adicioná-lo à tela inicial como um app.',
  faqHeading: 'Perguntas frequentes',
  faqFriendsQ: 'Dá para jogar Coup online com amigos?',
  faqFriendsA: 'Dá. Crie uma sala e compartilhe o código de 4 letras ou o link de convite. Seus amigos entram pelo próprio celular ou computador, sem criar conta.',
  faqBotsQ: 'Dá para jogar Coup contra bots?',
  faqBotsA: 'Dá. Jogar contra bots começa na hora uma partida contra {bots, plural, =0 {# jogadores controlados pelo computador} one {# jogador controlado pelo computador} other {# jogadores controlados pelo computador}}. Você também pode adicionar bots a uma sala com amigos e escolher o estilo de jogo de cada um.',
  faqPhoneQ: 'Dá para jogar Coup no celular?',
  faqPhoneA: 'Dá. Funciona no navegador do Android e do iPhone, sem baixar nada. Adicione à tela inicial para abrir como um app.',
  faqFreeQ: 'O Coup Online é grátis?',
  faqFreeA: 'É. Todos os modos de jogo são grátis, e você nunca precisa criar conta.',
  faqPlayersQ: 'Quantas pessoas podem jogar?',
  faqPlayersA: 'De {min, number} a {max, number} jogadores. Os bots ocupam os lugares vazios, então dá para jogar mesmo sem companhia.',
  faqReformationQ: 'O que é a expansão Reforma?',
  faqReformationA: 'A Reforma divide a mesa em duas facções, Lealistas e Reformistas. Enquanto as duas facções estão no jogo, você não pode dar um Golpe, Assassinar nem Extorquir alguém do seu lado. A expansão traz as ações Converter e Desviar e a Reserva do Tesouro, e o Inquisidor pode substituir o Embaixador. O host ativa a Reforma nas configurações da sala.',
  credit: 'Coup Online é uma adaptação não oficial, feita por fãs, de Coup, jogo de cartas criado por Rikki Tahta e publicado pela La Mame Games e pela Indie Boards & Cards. O Coup Online não é afiliado a eles nem endossado por eles.',
  languages: 'Idioma',
  suggestion: 'Ler em português',
  suggestionDismiss: 'Fechar',
};

export default seo;
