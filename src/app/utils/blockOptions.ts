import { ACTION_DEFINITIONS } from '@/shared/constants';
import { ActionType, Character, ClientGameState, TurnPhase } from '@/shared/types';
import { characterName, type PlainTranslator } from '../i18n';
import { plainList } from '../components/game/tableText';

/**
 * Which characters the pending action can be blocked with in this game:
 * Ambassador and Inquisitor never share a deck, so only one of them shows.
 */
export function visibleBlockCharacters(gameState: ClientGameState): Character[] {
  const action = gameState.pendingAction;
  if (!action) return [];

  return ACTION_DEFINITIONS[action.type].blockedBy.filter(character => (
    gameState.useInquisitor
      ? character !== Character.Ambassador
      : character !== Character.Inquisitor
  ));
}

/**
 * "Captain", "Captain or Ambassador", "Duke, Captain or Contessa". English
 * only: the table uses `characterList` below. Kept for the practice coach
 * until it is converted.
 */
export function formatCharacters(characters: Character[]): string {
  if (characters.length <= 1) return characters[0] ?? 'the shown character';
  return `${characters.slice(0, -1).join(', ')} or ${characters[characters.length - 1]}`;
}

/**
 * True when you are the target of a claim that can also be blocked (Steal,
 * Assassinate) and its challenge window is open, so you can declare your
 * block now instead of waiting for the block step. The server decides; this
 * only says whether to offer the buttons.
 */
export function canBlockDuringChallenge(gameState: ClientGameState): boolean {
  const { turnPhase, pendingAction, myId } = gameState;
  if (turnPhase !== TurnPhase.AwaitingActionChallenge || !pendingAction) return false;
  if (pendingAction.targetId !== myId || pendingAction.actorId === myId) return false;
  if (pendingAction.declaredBlock) return false;
  const me = gameState.players.find(p => p.id === myId);
  if (!me?.isAlive) return false;
  const def = ACTION_DEFINITIONS[pendingAction.type];
  return def.challengeable && def.blockedBy.length > 0;
}

/** "Captain", "Captain or Ambassador": the characters' names, in the reader's language. */
export function characterList(t: PlainTranslator, characters: Character[]): string {
  return plainList(t, characters.map(c => characterName(t, c)), 'disjunction');
}

/** What blocking would save you from, in one sentence for a prompt. */
export function blockHint(t: PlainTranslator, type: ActionType, characters: Character[]): string {
  const params = { count: characters.length, who: characterList(t, characters) };
  switch (type) {
    case ActionType.Assassinate:
      return t('prompts.blockHint.Assassinate', params);
    case ActionType.Steal:
      return t('prompts.blockHint.Steal', params);
    default:
      return t('prompts.blockHint.other', params);
  }
}
