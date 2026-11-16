import { ActionType, Character, Faction, GameMode, TurnPhase } from '@/shared/types';
import type { PlainTranslator } from './runtime';

/**
 * One name per game concept, in the reader's language. Use these instead of
 * printing an enum value or `ACTION_DISPLAY_NAMES`: the enum values are wire
 * identifiers and stay English.
 *
 *   const t = useT();
 *   characterName(t, Character.Duke)   // "Duke", "Duque", "公爵"...
 */
export function characterName(t: PlainTranslator, character: Character): string {
  return t(`glossary.character.${character}`);
}

export function actionName(t: PlainTranslator, action: ActionType): string {
  return t(`glossary.action.${action}`);
}

export function factionName(t: PlainTranslator, faction: Faction): string {
  return t(`glossary.faction.${faction}`);
}

export function phaseName(t: PlainTranslator, phase: TurnPhase): string {
  return t(`glossary.phase.${phase}`);
}

export function gameModeName(t: PlainTranslator, mode: GameMode): string {
  return t(`glossary.mode.${mode}`);
}

const CHARACTERS = new Set<string>(Object.values(Character));
const ACTIONS = new Set<string>(Object.values(ActionType));
const FACTIONS = new Set<string>(Object.values(Faction));

export function isCharacter(value: unknown): value is Character {
  return typeof value === 'string' && CHARACTERS.has(value);
}

export function isActionType(value: unknown): value is ActionType {
  return typeof value === 'string' && ACTIONS.has(value);
}

export function isFaction(value: unknown): value is Faction {
  return typeof value === 'string' && FACTIONS.has(value);
}
