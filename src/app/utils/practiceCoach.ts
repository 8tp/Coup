import { ACTION_DEFINITIONS, ACTION_DISPLAY_NAMES, COUP_COST, FORCED_COUP_THRESHOLD } from '@/shared/constants';
import { ActionType, Character, ClientGameState, GameMode, TurnPhase } from '@/shared/types';

/**
 * The practice coach's brain: which tip fits this moment of the game, and
 * which part of the court table it is about. Pure — the callout component
 * (components/game/PracticeCoach.tsx) only measures and draws.
 */

/**
 * What a tip points at. Each is a `data-coach-anchor` attribute on the court
 * table (GameTable / ClaimPlaque):
 *
 *   dock    the action dock — your turn's choices
 *   prompt  the response prompt — challenge, block, lose a card, exchange
 *   plaque  the claim plaque in the middle of the felt
 *   hand    your own cards
 */
export type CoachAnchor = 'dock' | 'prompt' | 'plaque' | 'hand';

/**
 * Two materials, not four colours (ART-DIRECTION §1.2: hue never carries a
 * semantic). `danger` wears the hazard rail; everything else the brass one.
 */
export type PracticeCoachTone = 'info' | 'danger';

export interface PracticeCoachTip {
  id: string;
  label: string;
  title: string;
  body: string;
  tone: PracticeCoachTone;
  anchor: CoachAnchor;
  /**
   * A first-time tip: shown for the first situation that earns it and never
   * again. See {@link CoachHistory}.
   */
  once?: boolean;
}

/**
 * Tip id → the turn it was first shown on. A `once` tip stays up for the
 * whole turn it first appeared in (so it does not vanish the instant it is
 * recorded) and is skipped on every later turn.
 */
export type CoachHistory = ReadonlyMap<string, number>;

const EMPTY_HISTORY: CoachHistory = new Map();

function visibleBlockCharacters(gameState: ClientGameState): Character[] {
  const action = gameState.pendingAction;
  if (!action) return [];

  return ACTION_DEFINITIONS[action.type].blockedBy.filter(character => (
    gameState.useInquisitor
      ? character !== Character.Ambassador
      : character !== Character.Inquisitor
  ));
}

function formatCharacters(characters: Character[]): string {
  if (characters.length <= 1) return characters[0] ?? 'the shown character';
  return `${characters.slice(0, -1).join(', ')} or ${characters[characters.length - 1]}`;
}

/** True when a `once` tip may still be shown under this history. */
export function onceTipAvailable(id: string, history: CoachHistory, turnNumber: number): boolean {
  const shownOn = history.get(id);
  return shownOn === undefined || shownOn === turnNumber;
}

/** What a targeted action will do to you, in one sentence. */
function targetedConsequence(type: ActionType): string {
  switch (type) {
    case ActionType.Steal: return 'Steal takes 2 of your coins.';
    case ActionType.Assassinate: return 'Assassinate makes you lose a card.';
    case ActionType.Examine: return 'Examine lets them look at one of your cards.';
    default: return `${ACTION_DISPLAY_NAMES[type]} is aimed at you.`;
  }
}

export function getPracticeCoachTip(
  gameState: ClientGameState,
  history: CoachHistory = EMPTY_HISTORY,
): PracticeCoachTip | null {
  const { myId, turnPhase, pendingAction, pendingBlock, turnNumber } = gameState;
  const me = gameState.players.find(player => player.id === myId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const canShowOnce = (id: string) => onceTipAvailable(id, history, turnNumber);

  if (!me?.isAlive || turnPhase === TurnPhase.GameOver) return null;

  if (
    turnPhase === TurnPhase.AwaitingInfluenceLoss
    && gameState.influenceLossRequest?.playerId === myId
  ) {
    return {
      id: 'choose-influence',
      label: 'Lose a card',
      title: 'Give up the card you need least',
      body: 'It turns face-up for everyone. Keep the one that backs the claims and blocks you plan to make.',
      tone: 'danger',
      anchor: 'prompt',
    };
  }

  if (turnPhase === TurnPhase.AwaitingExchange && gameState.exchangeState) {
    return {
      id: 'exchange-hand',
      label: 'Exchange',
      title: 'Keep the characters you\'ve claimed',
      body: 'Holding them makes those claims safe to repeat. If you haven\'t claimed anything yet, keep the cards with the most uses. The rest go back into the deck.',
      tone: 'info',
      anchor: 'prompt',
    };
  }

  if (
    turnPhase === TurnPhase.AwaitingExamineSelection
    && gameState.examineSelectionState?.targetId === myId
  ) {
    return {
      id: 'examine-selection',
      label: 'Examined',
      title: 'You choose which card they see',
      body: 'Show the card you\'d mind least losing to a swap. Only the examiner learns what it is.',
      tone: 'info',
      anchor: 'prompt',
    };
  }

  if (turnPhase === TurnPhase.AwaitingExamineDecision && gameState.examineState) {
    return {
      id: 'examine-decision',
      label: 'Examine',
      title: 'You\'ve seen one of their cards',
      body: 'Return it and you know what they hold. Force a swap and the card goes into the deck, but you lose track of their hand.',
      tone: 'info',
      anchor: 'prompt',
    };
  }

  if (
    turnPhase === TurnPhase.AwaitingActionChallenge
    && pendingAction
    && pendingAction.actorId !== myId
    && !gameState.challengeState?.passedPlayerIds.includes(myId)
  ) {
    const actorName = gameState.players.find(player => player.id === pendingAction.actorId)?.name ?? 'The bot';

    if (pendingAction.targetId === myId && canShowOnce('first-targeted')) {
      const blockers = ACTION_DEFINITIONS[pendingAction.type].blockedBy.length > 0
        ? `, or wait and block with ${formatCharacters(visibleBlockCharacters(gameState))}`
        : '';
      return {
        id: 'first-targeted',
        label: 'You are the target',
        title: `${actorName} is targeting you`,
        body: `${targetedConsequence(pendingAction.type)} Challenge now if you doubt their ${pendingAction.claimedCharacter ?? 'claim'}${blockers}.`,
        tone: 'danger',
        anchor: 'plaque',
        once: true,
      };
    }

    return {
      id: 'challenge-claim',
      label: 'Challenge?',
      title: pendingAction.type === ActionType.Embezzle
        ? `${actorName} claims to have no Duke`
        : `${actorName} claims ${pendingAction.claimedCharacter ?? 'a character'}`,
      body: pendingAction.type === ActionType.Embezzle
        ? `Challenge only if you think they have a Duke. If they don't, you lose a card.`
        : `Challenge if you think they don't have ${pendingAction.claimedCharacter ?? 'that card'}. If they do, you lose a card, so letting it go is often safer.`,
      tone: 'info',
      anchor: 'plaque',
    };
  }

  if (
    turnPhase === TurnPhase.AwaitingBlockChallenge
    && pendingBlock
    && pendingBlock.blockerId !== myId
    && !gameState.challengeState?.passedPlayerIds.includes(myId)
  ) {
    const blocker = gameState.players.find(player => player.id === pendingBlock.blockerId);
    return {
      id: 'challenge-block',
      label: 'Blocked',
      title: 'A block is a claim too',
      body: `${blocker?.name ?? 'The bot'} claims ${pendingBlock.claimedCharacter} to block. Challenge only if you'll risk a card on it being a lie.`,
      tone: 'info',
      anchor: 'plaque',
    };
  }

  if (
    turnPhase === TurnPhase.AwaitingBlock
    && pendingAction
    && pendingAction.actorId !== myId
    && !gameState.blockPassedPlayerIds.includes(myId)
    && (!pendingAction.targetId || pendingAction.targetId === myId)
  ) {
    const blockCharacters = visibleBlockCharacters(gameState);
    const actionName = ACTION_DISPLAY_NAMES[pendingAction.type];
    const tone: PracticeCoachTone = pendingAction.type === ActionType.Assassinate ? 'danger' : 'info';

    if (canShowOnce('first-block')) {
      return {
        id: 'first-block',
        label: 'Your first block',
        title: `You can block this ${actionName}`,
        body: `Claim ${formatCharacters(blockCharacters)} to stop it, even if you don't have one. They can challenge your block, and a caught bluff costs you a card.`,
        tone,
        anchor: 'prompt',
        once: true,
      };
    }

    return {
      id: 'make-block',
      label: 'Block?',
      title: `You can block ${actionName}`,
      body: `Blocking means claiming ${formatCharacters(blockCharacters)}. You can bluff it, but they can challenge.`,
      tone,
      anchor: 'prompt',
    };
  }

  if (turnPhase === TurnPhase.AwaitingAction && currentPlayer?.id === myId) {
    if (me.coins >= FORCED_COUP_THRESHOLD) {
      return {
        id: 'must-coup',
        label: `${me.coins} coins`,
        title: 'At 10 coins you must Coup',
        body: 'Coup is your only move. Pick the opponent who worries you most. Nobody can block or challenge it.',
        tone: 'danger',
        anchor: 'dock',
      };
    }

    if (me.coins >= COUP_COST) {
      return {
        id: 'coup-ready',
        label: `${me.coins} coins`,
        title: 'You can Coup',
        body: 'Pay 7 and any opponent loses a card. Nobody can block or challenge it. You can keep saving, but at 10 you have to.',
        tone: 'info',
        anchor: 'dock',
      };
    }

    if (gameState.gameMode === GameMode.Reformation) {
      const aliveFactions = new Set(
        gameState.players
          .filter(player => player.isAlive && player.faction)
          .map(player => player.faction),
      );

      if (aliveFactions.size === 1) {
        return {
          id: 'reformation-free-for-all',
          label: 'One faction',
          title: 'One faction left, so target anyone',
          body: 'Coup, Assassinate, Steal and Examine can target anyone until a Convert splits the table again.',
          tone: 'info',
          anchor: 'dock',
        };
      }

      if (gameState.turnNumber <= 2) {
        return {
          id: 'reformation-factions',
          label: 'Factions',
          title: 'Target the other faction',
          body: 'Your faction limits who you can Coup, Assassinate, Steal from or Examine. Challenges ignore factions. While both factions remain, only the other faction can block your Foreign Aid.',
          tone: 'info',
          anchor: 'dock',
        };
      }

      if (gameState.treasuryReserve > 0) {
        const holdsDuke = me.influences.some(influence => (
          !influence.revealed && influence.character === Character.Duke
        ));
        return {
          id: 'reformation-embezzle',
          label: `${gameState.treasuryReserve} in reserve`,
          title: 'Embezzle takes the reserve',
          body: holdsDuke
            ? 'Embezzle claims you have no Duke, but you have one. Your hidden Duke would make a challenge succeed. Bluff only if the reserve is worth a card.'
            : 'Embezzle claims you have no Duke. You really don\'t, so anyone who challenges loses a card.',
          tone: 'info',
          anchor: 'dock',
        };
      }

      return {
        id: 'reformation-convert',
        label: 'Convert',
        title: 'Convert switches a faction',
        body: 'Pay 1 coin to switch yourself or 2 to switch another player. Nobody can challenge or block it, and the coins go to the reserve for Embezzle.',
        tone: 'info',
        anchor: 'dock',
      };
    }

    if (gameState.turnNumber <= 2) {
      return {
        id: 'opening-action',
        label: 'Your move',
        title: 'Take Income or make a claim',
        body: 'Income is guaranteed. Character actions pay more, and you can claim any character, but any claim can be challenged.',
        tone: 'info',
        anchor: 'dock',
      };
    }

    if (gameState.turnNumber <= 5) {
      return {
        id: 'repeat-claims',
        label: 'Your move',
        title: 'Repeat the character you claimed',
        body: 'Claiming the same character again is believable. Switching to a new one invites a challenge.',
        tone: 'info',
        anchor: 'dock',
      };
    }
  }

  return null;
}
