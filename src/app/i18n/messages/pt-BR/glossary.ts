import type { NamespaceTranslation } from '../../schema';

/**
 * pt-BR `glossary`. Names follow the Brazilian edition of Coup (Funbox Jogos):
 * Duque, Assassino, Capitão, Embaixador, Condessa, Inquisidor; Renda, Ajuda
 * Externa, Golpe (de Estado), Assassinar, Extorquir, Trocar, Investigar.
 * Reasons and the rest of the vocabulary: docs/i18n-glossary/pt-BR.md.
 */
const glossary: NamespaceTranslation<'glossary'> = {
  'character.Duke': 'Duque',
  'character.Assassin': 'Assassino',
  'character.Captain': 'Capitão',
  'character.Ambassador': 'Embaixador',
  'character.Contessa': 'Condessa',
  'character.Inquisitor': 'Inquisidor',

  'action.Income': 'Renda',
  'action.ForeignAid': 'Ajuda Externa',
  'action.Coup': 'Golpe',
  'action.Tax': 'Taxar',
  'action.Assassinate': 'Assassinar',
  'action.Steal': 'Extorquir',
  'action.Exchange': 'Trocar',
  'action.Convert': 'Converter',
  'action.Embezzle': 'Desviar',
  'action.Examine': 'Investigar',

  'mode.Classic': 'Clássico',
  'mode.Reformation': 'Reforma',

  'faction.Loyalist': 'Lealista',
  'faction.Reformist': 'Reformista',

  'phase.AwaitingAction': 'Escolhendo uma ação',
  'phase.AwaitingActionChallenge': 'Hora de contestar',
  'phase.AwaitingBlock': 'Hora de bloquear',
  'phase.AwaitingBlockChallenge': 'Hora de contestar o bloqueio',
  'phase.AwaitingInfluenceLoss': 'Perdendo uma carta',
  'phase.AwaitingExchange': 'Trocando cartas',
  'phase.AwaitingExamineSelection': 'Escolhendo a carta a mostrar',
  'phase.AwaitingExamineDecision': 'Investigando',
  'phase.ActionResolved': 'Resolvida',
  'phase.GameOver': 'Fim de jogo',

  'term.influence': 'influência',
  'term.card': 'carta',
  'term.claim': 'alegação',
  'term.bluff': 'blefe',
  'term.challenge': 'contestação',
  'term.block': 'bloqueio',
  'term.coin': '{count, plural, =0 {# moedas} one {# moeda} other {# moedas}}',
  'term.reserve': 'Reserva do Tesouro',
  'term.faction': 'facção',
};

export default glossary;
