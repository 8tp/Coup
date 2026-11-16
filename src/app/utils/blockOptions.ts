import { ACTION_DEFINITIONS } from '@/shared/constants';
import { ActionType, Character, ClientGameState, TurnPhase } from '@/shared/types';

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

/** "Captain", "Captain or Ambassador", "Duke, Captain or Contessa". */
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

/** What blocking would save you from, in one sentence for a prompt. */
export function blockHint(type: ActionType, characters: Character[]): string {
  const who = formatCharacters(characters);
  const holding = characters.length > 1 ? 'either' : characters[0];
  switch (type) {
    case ActionType.Assassinate:
      return `Block with ${who} or lose a card. You can claim ${holding} without holding one.`;
    case ActionType.Steal:
      return `Block with ${who} to keep your coins. You can claim ${holding} without holding it.`;
    default:
      return `Block with ${who} to stop it. You can claim ${holding} without holding it.`;
  }
}
