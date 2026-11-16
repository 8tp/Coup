import type { ActionType, Character, Faction, GameMode, TurnPhase } from '@/shared/types';

/**
 * The game's own nouns, named once. Every screen reaches these through
 * `characterName()`, `actionName()`, `factionName()` and `phaseName()` in
 * `src/app/i18n/glossary.ts`, never by printing an enum value: the enum values
 * (`Character.Duke === 'Duke'`, `ActionType.ForeignAid === 'ForeignAid'`) are
 * identifiers on the wire and must not change, so their display names live
 * here. Translators: fill in the per-language glossary in docs/I18N.md first
 * and keep these lines in step with it.
 */
const glossary = {
  'character.Duke': 'Duke',
  'character.Assassin': 'Assassin',
  'character.Captain': 'Captain',
  'character.Ambassador': 'Ambassador',
  'character.Contessa': 'Contessa',
  'character.Inquisitor': 'Inquisitor',

  'action.Income': 'Income',
  'action.ForeignAid': 'Foreign Aid',
  'action.Coup': 'Coup',
  'action.Tax': 'Tax',
  'action.Assassinate': 'Assassinate',
  'action.Steal': 'Steal',
  'action.Exchange': 'Exchange',
  'action.Convert': 'Convert',
  'action.Embezzle': 'Embezzle',
  'action.Examine': 'Examine',

  'mode.Classic': 'Classic',
  'mode.Reformation': 'Reformation',

  'faction.Loyalist': 'Loyalist',
  'faction.Reformist': 'Reformist',

  'phase.AwaitingAction': 'Choosing an action',
  'phase.AwaitingActionChallenge': 'Challenge window',
  'phase.AwaitingBlock': 'Block window',
  'phase.AwaitingBlockChallenge': 'Block challenge window',
  'phase.AwaitingInfluenceLoss': 'Losing a card',
  'phase.AwaitingExchange': 'Exchanging',
  'phase.AwaitingExamineSelection': 'Choosing a card to show',
  'phase.AwaitingExamineDecision': 'Examining',
  'phase.ActionResolved': 'Resolved',
  'phase.GameOver': 'Game over',

  // Terms with no enum of their own (rules, tutorial, coach).
  'term.influence': 'influence',
  'term.card': 'card',
  'term.claim': 'claim',
  'term.bluff': 'bluff',
  'term.challenge': 'challenge',
  'term.block': 'block',
  'term.coin': '{count, plural, one {# coin} other {# coins}}',
  'term.reserve': 'Treasury Reserve',
  'term.faction': 'faction',
} satisfies Record<
  | `character.${Character}`
  | `action.${ActionType}`
  | `faction.${Faction}`
  | `mode.${GameMode}`
  | `phase.${TurnPhase}`,
  string
> & Record<string, string>;

export default glossary;
