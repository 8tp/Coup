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
      title: 'Keep the cards that fit your story',
      body: 'Pick the cards that back up claims you have already made — or the ones that give you the most options. The rest go back in the deck.',
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
      title: 'You choose which card the Inquisitor sees',
      body: 'Show the card you can best afford to lose or have swapped. Only the examiner learns what it is.',
      tone: 'info',
      anchor: 'prompt',
    };
  }

  if (turnPhase === TurnPhase.AwaitingExamineDecision && gameState.examineState) {
    return {
      id: 'examine-decision',
      label: 'Examine',
      title: 'Keep what you learned, or shake up their hand',
      body: 'Return it and you know one of their cards. Force a swap and they lose it — but you no longer know what they hold.',
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
        ? ` or wait and block with ${formatCharacters(visibleBlockCharacters(gameState))}`
        : '';
      return {
        id: 'first-targeted',
        label: 'You are the target',
        title: `${actorName} is coming for you`,
        body: `${targetedConsequence(pendingAction.type)} Challenge now if you doubt their ${pendingAction.claimedCharacter ?? 'claim'}${blockers}.`,
        tone: 'danger',
        anchor: 'plaque',
        once: true,
      };
    }

    return {
      id: 'challenge-claim',
      label: 'Challenge?',
      title: `Is ${actorName} lying?`,
      body: pendingAction.type === ActionType.Embezzle
        ? `Embezzle claims ${actorName} does not hold Duke. Challenge only if you think a Duke is in their hand; if none is found, you lose an influence.`
        : `Challenge if you think they do not hold ${pendingAction.claimedCharacter ?? 'that card'}. If they do, you lose an influence — so passing is often the safe call.`,
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
      body: `${blocker?.name ?? 'The bot'} says they hold ${pendingBlock.claimedCharacter}. Challenge only if you will risk a card on that being a lie.`,
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
        title: `You can stop this ${actionName}`,
        body: `Claim ${formatCharacters(blockCharacters)} to block it — even if you do not hold one. They can challenge your block, so a caught bluff costs you a card.`,
        tone,
        anchor: 'prompt',
        once: true,
      };
    }

    return {
      id: 'make-block',
      label: 'Block?',
      title: `You may block ${actionName}`,
      body: `Blocking means claiming ${formatCharacters(blockCharacters)}. You may bluff it, but they get a chance to challenge.`,
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
        body: 'Coup is your only move now. Pick the opponent who worries you most — it cannot be blocked or challenged.',
        tone: 'danger',
        anchor: 'dock',
      };
    }

    if (me.coins >= COUP_COST) {
      return {
        id: 'coup-ready',
        label: `${me.coins} coins`,
        title: 'You can Coup now',
        body: 'Pay 7 and any opponent loses a card. Nobody can block or challenge it. Or keep saving — at 10 you have to.',
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
          title: 'Everyone shares a faction: target anyone',
          body: 'Coup, Assassinate, Steal, and Examine may target anyone again until another Convert splits the table.',
          tone: 'info',
          anchor: 'dock',
        };
      }

      if (gameState.turnNumber <= 2) {
        return {
          id: 'reformation-factions',
          label: 'Factions',
          title: 'Aim across faction lines',
          body: 'Your faction marker limits who you can Coup, Assassinate, Steal from, or Examine. Challenges ignore factions; Foreign Aid may only be blocked across faction lines while both factions remain.',
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
          title: 'Embezzle is a Duke claim turned inside out',
          body: holdsDuke
            ? 'Embezzle claims you do not have Duke—but your hidden Duke would make a challenge succeed. Bluff only if the reserve is worth that risk.'
            : 'Embezzle claims you do not have Duke. If challenged, your current hand supports that claim; the challenger would lose an influence.',
          tone: 'info',
          anchor: 'dock',
        };
      }

      return {
        id: 'reformation-convert',
        label: 'Convert',
        title: 'Convert moves the faction lines',
        body: 'Pay 1 coin to switch yourself or 2 to switch another player. It cannot be challenged or blocked, and the coins go to the reserve for Embezzle.',
        tone: 'info',
        anchor: 'dock',
      };
    }

    if (gameState.turnNumber <= 2) {
      return {
        id: 'opening-action',
        label: 'Your move',
        title: 'Play it safe, or start a story',
        body: 'Income is guaranteed. Character actions are stronger, and you may claim any role — but every claim can be challenged.',
        tone: 'info',
        anchor: 'dock',
      };
    }

    if (gameState.turnNumber <= 5) {
      return {
        id: 'repeat-claims',
        label: 'Your move',
        title: 'Stick to your story',
        body: 'Repeating a role you already claimed is believable. Suddenly switching roles invites a challenge.',
        tone: 'info',
        anchor: 'dock',
      };
    }
  }

  return null;
}
