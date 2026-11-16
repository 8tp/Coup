import {
  ASSASSINATE_COST,
  CONVERSION_OTHER_COST,
  CONVERSION_SELF_COST,
  COUP_COST,
  EXCHANGE_DRAW_COUNT,
  FORCED_COUP_THRESHOLD,
  INQUISITOR_EXCHANGE_DRAW_COUNT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  STARTING_COINS,
  INCOME_COINS,
  FOREIGN_AID_COINS,
  TAX_COINS,
  STEAL_COINS,
} from '@/shared/constants';
import { ActionType, Character, Faction, GameMode } from '@/shared/types';
import { actionName, characterName, factionName, gameModeName } from '../i18n/glossary';
import type { PlainTranslator } from '../i18n/runtime';

/**
 * The words and numbers every teaching surface (the rules reference, both
 * walkthroughs, the practice coach and its setup sheet) puts into sentences.
 *
 * Messages in the `rules` and `tutorial` catalogs name the game's nouns and
 * amounts as params (`{duke}`, `{coup}`, `{coupCost}`), never as literal
 * words or digits, so a rule reads with the same word on the table, in the
 * log and in the tutorial in every language, and a cost changed in
 * `src/shared/constants.ts` changes every sentence that states it.
 */

/** The coin amounts of Income, Foreign Aid, Tax and Steal, as the engine applies them. */
export { INCOME_COINS, FOREIGN_AID_COINS, TAX_COINS, STEAL_COINS };

/** Every rule number a teaching message may state, by param name. */
export const RULE_NUMBERS = {
  minPlayers: MIN_PLAYERS,
  maxPlayers: MAX_PLAYERS,
  startingCoins: STARTING_COINS,
  coupCost: COUP_COST,
  forcedCoup: FORCED_COUP_THRESHOLD,
  assassinateCost: ASSASSINATE_COST,
  exchangeDraw: EXCHANGE_DRAW_COUNT,
  inquisitorDraw: INQUISITOR_EXCHANGE_DRAW_COUNT,
  convertSelfCost: CONVERSION_SELF_COST,
  convertOtherCost: CONVERSION_OTHER_COST,
  incomeCoins: INCOME_COINS,
  foreignAidCoins: FOREIGN_AID_COINS,
  taxCoins: TAX_COINS,
  stealCoins: STEAL_COINS,
} as const;

/**
 * The game's nouns in the reader's language, by param name: every character,
 * action, faction and mode, plus the Treasury Reserve.
 */
export function gameNouns(t: PlainTranslator) {
  return {
    duke: characterName(t, Character.Duke),
    assassin: characterName(t, Character.Assassin),
    captain: characterName(t, Character.Captain),
    ambassador: characterName(t, Character.Ambassador),
    contessa: characterName(t, Character.Contessa),
    inquisitor: characterName(t, Character.Inquisitor),
    income: actionName(t, ActionType.Income),
    foreignAid: actionName(t, ActionType.ForeignAid),
    coup: actionName(t, ActionType.Coup),
    tax: actionName(t, ActionType.Tax),
    assassinate: actionName(t, ActionType.Assassinate),
    steal: actionName(t, ActionType.Steal),
    exchange: actionName(t, ActionType.Exchange),
    convert: actionName(t, ActionType.Convert),
    embezzle: actionName(t, ActionType.Embezzle),
    examine: actionName(t, ActionType.Examine),
    loyalist: factionName(t, Faction.Loyalist),
    reformist: factionName(t, Faction.Reformist),
    classic: gameModeName(t, GameMode.Classic),
    reformation: gameModeName(t, GameMode.Reformation),
    reserve: t('glossary.term.reserve'),
  };
}

export type LearnParams = typeof RULE_NUMBERS & ReturnType<typeof gameNouns>;

/** Nouns and numbers together: spread into any `rules` or `tutorial` message's params. */
export function learnParams(t: PlainTranslator): LearnParams {
  return { ...RULE_NUMBERS, ...gameNouns(t) };
}
