import type { NamespaceTranslation } from '../../schema';

/** pt-BR `prompts`. */
const prompts: NamespaceTranslation<'prompts'> = {
  // ── Buttons ──
  challenge: 'Contestar',
  pass: 'Passar',
  blockWith: 'Bloquear com {character}',
  dontBlock: 'Não bloquear',
  bluffHint: 'Conteste se achar que é blefe. Se não for, você perde uma carta.',

  // ── Challenge window ──
  declaredBlock: '<b>{blocker}</b> vai bloquear com {character} se a ação {action} for adiante.',
  youClaimed: 'Você alegou ter <c>{character}</c> para {action}',
  youClaimedOn: 'Você alegou ter <c>{character}</c> para {action} <b>{target}</b>',
  youClaimedNo: 'Você alegou <c>não ter {character}</c> para {action}',
  waitingChallenge: '{count, plural, =0 {Esperando os jogadores contestarem ou passarem.} one {Esperando {names} contestar ou passar.} other {Esperando {names} contestarem ou passarem.}}',
  youWillBlock: 'Você vai bloquear com <c>{character}</c> se a ação {action} for adiante.',
  waitingFor: '{count, plural, =0 {Esperando os jogadores.} other {Esperando {names}.}}',
  passedCanBlock: 'Você não contestou. Ainda pode bloquear.',
  passedWaiting: '{count, plural, =0 {Você passou. Esperando os jogadores.} other {Você passou. Esperando {names}.}}',
  claim: '{actor} alega ter {character} para {action}',
  claimOn: '{actor} alega ter {character} para {action} {target}',
  claimStealFrom: '{actor} alega ter {character} para {action} {target}',
  claimAtYou: '{actor} alega ter {character} para {action} você',
  claimStealFromYou: '{actor} alega ter {character} para {action} você',
  claimNo: '{actor} alega não ter {character} para {action}',
  embezzleHint: 'Conteste se achar que há {character} nessa mão. Se não houver, você perde uma carta.',
  'blockHint.Assassinate': '{count, plural, one {Bloqueie com {who} ou perca uma carta. Você pode alegar {who} sem ter a carta.} other {Bloqueie com {who} ou perca uma carta. Você pode alegar qualquer um dos dois sem ter a carta.}}',
  'blockHint.Steal': '{count, plural, one {Bloqueie com {who} para não perder suas moedas. Você pode alegar {who} sem ter a carta.} other {Bloqueie com {who} para não perder suas moedas. Você pode alegar qualquer um dos dois sem ter a carta.}}',
  'blockHint.other': '{count, plural, one {Bloqueie com {who} para impedir a ação. Você pode alegar {who} sem ter a carta.} other {Bloqueie com {who} para impedir a ação. Você pode alegar qualquer um dos dois sem ter a carta.}}',

  // ── Block window ──
  yourActionUnless: 'Sua ação {action} vai adiante, a menos que <b>{target}</b> bloqueie.',
  yourActionUnlessAnyone: 'Sua ação {action} vai adiante, a menos que alguém bloqueie.',
  usesOn: '<b>{actor}</b> usa {action} contra <b>{target}</b>.',
  waitingTarget: 'Esperando <b>{target}</b> bloquear ou deixar passar.',
  sameFactionForeignAid: 'Você não pode bloquear a {action} de <b>{actor}</b>. Vocês são da mesma facção, e as duas facções ainda estão no jogo.',
  blockPassed: 'Você passou.',
  blockPassedWaiting: 'Você passou. Esperando {names}.',
  assassinating: '{actor} quer assassinar você',
  assassinatingHint: 'Bloqueie com {character} ou perca uma carta. Você pode alegar {character} sem ter a carta.',
  stealing: '{actor} quer extorquir {count, plural, one {sua moeda} other {# das suas moedas}}',
  stealingHint: 'Bloqueie com {blockers} para ficar com {count, plural, one {sua moeda} other {suas # moedas}}. Você pode alegar qualquer um dos dois sem ter a carta.',
  foreignAid: '{actor} está pegando {action} (+{count, plural, =0 {# moedas} one {# moeda} other {# moedas}})',
  foreignAidHint: 'Alegue {character} para barrar {count, plural, =0 {essas # moedas} one {essa # moeda} other {essas # moedas}}. Você pode alegar {character} sem ter a carta.',
  uses: '{actor} usa {action}',
  canBlock: 'Você pode bloquear.',

  // ── Block challenge window ──
  youClaimedBlock: 'Você alegou ter <c>{character}</c> para bloquear.',
  acceptedWaiting: '{count, plural, =0 {Você aceitou o bloqueio. Esperando os jogadores.} other {Você aceitou o bloqueio. Esperando {names}.}}',
  blockClaim: '{blocker} alega ter <c>{character}</c> para bloquear a ação {action}',
  blockClaimPlain: '{blocker} alega ter <c>{character}</c> para bloquear',

  // ── Losing a card ──
  'loss.coup': 'Você sofreu um Golpe',
  'loss.assassination': 'Você sofreu um assassinato',
  'loss.challenge_lost': 'Você perdeu a contestação',
  'loss.challenge_failed_defense': 'Descobriram seu blefe',
  'loss.embezzle_failed': 'Descobriram que você tem {character}',
  'loss.default': 'Escolha uma carta para perder',
  tapToLose: 'Toque em uma carta para perdê-la. Ela fica virada para cima.',
  mustChoose: '<b>{name}</b> precisa escolher uma carta para perder.',
  'lossWatch.coup': 'Golpe',
  'lossWatch.assassination': 'Assassinato',
  'lossWatch.challenge_lost': 'Contestação perdida',
  'lossWatch.challenge_failed_defense': 'Blefe descoberto',
  'lossWatch.embezzle_failed': 'Desvio fracassado',
  'lossWatch.default': 'Precisa perder uma carta',

  // ── Exchange ──
  exchangeInProgress: 'Troca em andamento',
  exchangeTitle: '{character}: {action}',
  exchangeHint: 'Toque em {count, plural, =0 {# cartas} one {# carta} other {# cartas}} para manter. As outras voltam para o baralho.',
  keepSelected: 'Manter escolhidas ({selected}/{total})',

  // ── Examine ──
  examinedCard: 'Carta de {name}',
  forceSwapHint: 'Forçar troca manda a carta para o baralho, e quem a tinha compra outra.',
  examineReturn: 'Devolver',
  forceSwap: 'Forçar troca',
  showTo: 'Escolha uma carta para mostrar a {name}',
  showToInquisitor: 'Escolha uma carta para mostrar ao {character}',
  showHint: 'Só quem investiga vê a carta. Essa pessoa pode devolvê-la ou obrigar você a trocá-la por outra.',

  // ── Challenge reveal ──
  'reveal.skip': 'Pular a revelação',
  'reveal.newCard': 'Nova influência escondida',
  'reveal.showsAllNo': '{name} mostra todas as cartas e <c>não tem {character}</c>',
  'reveal.reveals': '{name} revela <c>{character}</c>',
  'reveal.doesNotHave': '{name} não tem <c>{character}</c>',
  'reveal.challengeFails': 'A contestação falhou',
  'reveal.caught': 'Blefe descoberto',
  'reveal.mustLose': '{name} precisa perder uma carta',
  'reveal.swap': '{count, plural, one {A carta volta para o baralho e outra é comprada no lugar.} other {As cartas mostradas voltam para o baralho e outras são compradas no lugar.}}',
};

export default prompts;
