import type { NamespaceTranslation } from '../../schema';

/**
 * es `glossary`. Character and action names follow the Spanish edition
 * (Zacatrus, "Coup: Ciudad Corrupta" and "Coup + Reforma"); see
 * docs/i18n-glossary/es.md for every choice.
 */
const glossary: NamespaceTranslation<'glossary'> = {
  'character.Duke': 'Duque',
  'character.Assassin': 'Asesino',
  'character.Captain': 'Capitán',
  'character.Ambassador': 'Embajador',
  'character.Contessa': 'Condesa',
  'character.Inquisitor': 'Inquisidor',

  'action.Income': 'Ingreso',
  'action.ForeignAid': 'Ayuda exterior',
  'action.Coup': 'Coup',
  'action.Tax': 'Impuestos',
  'action.Assassinate': 'Asesinato',
  'action.Steal': 'Extorsión',
  'action.Exchange': 'Intercambio',
  'action.Convert': 'Conversión',
  'action.Embezzle': 'Desfalco',
  'action.Examine': 'Interrogatorio',

  'mode.Classic': 'Clásico',
  'mode.Reformation': 'Reforma',

  'faction.Loyalist': 'Leal',
  'faction.Reformist': 'Reformista',

  'phase.AwaitingAction': 'Eligiendo acción',
  'phase.AwaitingActionChallenge': 'Turno de desafíos',
  'phase.AwaitingBlock': 'Turno de bloqueos',
  'phase.AwaitingBlockChallenge': 'Desafío al bloqueo',
  'phase.AwaitingInfluenceLoss': 'Perdiendo una carta',
  'phase.AwaitingExchange': 'Intercambiando',
  'phase.AwaitingExamineSelection': 'Eligiendo carta para mostrar',
  'phase.AwaitingExamineDecision': 'Interrogando',
  'phase.ActionResolved': 'Resuelta',
  'phase.GameOver': 'Fin de la partida',

  'term.influence': 'influencia',
  'term.card': 'carta',
  'term.claim': 'declaración',
  'term.bluff': 'farol',
  'term.challenge': 'desafío',
  'term.block': 'bloqueo',
  'term.coin': '{count, plural, one {# moneda} other {# monedas}}',
  'term.reserve': 'Reserva',
  'term.faction': 'facción',
};

export default glossary;
