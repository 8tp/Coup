import { ACTION_DEFINITIONS, ACTION_DISPLAY_NAMES } from '@/shared/constants';
import { ActionType, Character, ClientGameState, GameMode, TurnPhase } from '@/shared/types';

export type PracticeCoachTone = 'gold' | 'blue' | 'red' | 'green';

export interface PracticeCoachTip {
  id: string;
  label: string;
  title: string;
  body: string;
  tone: PracticeCoachTone;
}

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

export function getPracticeCoachTip(gameState: ClientGameState): PracticeCoachTip | null {
  const { myId, turnPhase, pendingAction, pendingBlock } = gameState;
  const me = gameState.players.find(player => player.id === myId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];

  if (!me?.isAlive || turnPhase === TurnPhase.GameOver) return null;

  if (
    turnPhase === TurnPhase.AwaitingInfluenceLoss
    && gameState.influenceLossRequest?.playerId === myId
  ) {
    return {
      id: 'choose-influence',
      label: 'Tough choice',
      title: 'Protect the story you want to tell',
      body: 'Reveal the card you need least. Everyone will know it is out, so keep the influence that supports your next claims and blocks.',
      tone: 'red',
    };
  }

  if (turnPhase === TurnPhase.AwaitingExchange && gameState.exchangeState) {
    return {
      id: 'exchange-hand',
      label: 'Hand shaping',
      title: 'Build a believable next turn',
      body: 'Keep cards that support claims you have already made, or choose flexibility. The unselected cards disappear back into the deck.',
      tone: 'green',
    };
  }

  if (turnPhase === TurnPhase.AwaitingExamineDecision && gameState.examineState) {
    return {
      id: 'examine-decision',
      label: 'Information edge',
      title: 'Decide whether this card helps your read',
      body: 'Returning it preserves what you learned. Forcing a swap disrupts their hand, but the replacement is unknown to you.',
      tone: 'green',
    };
  }

  if (
    turnPhase === TurnPhase.AwaitingActionChallenge
    && pendingAction
    && pendingAction.actorId !== myId
    && !gameState.challengeState?.passedPlayerIds.includes(myId)
  ) {
    const actor = gameState.players.find(player => player.id === pendingAction.actorId);
    const claim = pendingAction.type === ActionType.Embezzle
      ? 'not having Duke'
      : `having ${pendingAction.claimedCharacter ?? 'the claimed character'}`;

    return {
      id: 'challenge-claim',
      label: 'Read the claim',
      title: `Challenge means betting ${actor?.name ?? 'the bot'} is lying`,
      body: pendingAction.type === ActionType.Embezzle
        ? `Embezzle claims ${actor?.name ?? 'the bot'} does not hold Duke. Challenge only if you believe a Duke is in their hand; if none is found, you lose an influence.`
        : `If they are truthful about ${claim}, you lose an influence. Passing is often smart; challenge when their story or the revealed cards make the claim unlikely.`,
      tone: 'blue',
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
      label: 'Second bluff window',
      title: 'A block is a claim too',
      body: `${blocker?.name ?? 'The bot'} says they have ${pendingBlock.claimedCharacter}. Challenge only if you are willing to risk an influence on that read.`,
      tone: 'blue',
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
    return {
      id: 'make-block',
      label: 'Defend or bluff',
      title: `You may block ${ACTION_DISPLAY_NAMES[pendingAction.type]}`,
      body: `Blocking means claiming ${formatCharacters(blockCharacters)}. You may bluff that claim, but the bot gets a chance to challenge it.`,
      tone: pendingAction.type === ActionType.Assassinate ? 'red' : 'blue',
    };
  }

  if (turnPhase === TurnPhase.AwaitingAction && currentPlayer?.id === myId) {
    if (me.coins >= 7) {
      return {
        id: 'coup-ready',
        label: 'Guaranteed pressure',
        title: 'A Coup cannot be blocked or challenged',
        body: me.coins >= 10
          ? 'At 10 or more coins, Coup is mandatory. Pick the opponent whose remaining influence is the biggest threat.'
          : 'Seven coins buys certainty. You can Coup now, or keep building coins if the risk is worth it.',
        tone: 'red',
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
          label: 'Faction reset',
          title: 'One surviving faction means free-for-all targeting',
          body: 'Coup, Assassinate, Steal, and Examine may target anyone again until another Convert splits the table.',
          tone: 'blue',
        };
      }

      if (gameState.turnNumber <= 2) {
        return {
          id: 'reformation-factions',
          label: 'Read the table',
          title: 'Target across faction lines',
          body: 'Your faction marker controls Coup, Assassinate, Steal, and Examine targets. Challenges and blocks can still cross—or stay within—either faction.',
          tone: 'blue',
        };
      }

      if (gameState.treasuryReserve > 0) {
        const holdsDuke = me.influences.some(influence => (
          !influence.revealed && influence.character === Character.Duke
        ));
        return {
          id: 'reformation-embezzle',
          label: `${gameState.treasuryReserve} in reserve`,
          title: 'Embezzle is an inverse Duke claim',
          body: holdsDuke
            ? 'Embezzle claims you do not have Duke—but your hidden Duke would make a challenge succeed. Bluff only if the reserve is worth that risk.'
            : 'Embezzle claims you do not have Duke. If challenged, your current hand supports that claim; the challenger would lose an influence.',
          tone: 'gold',
        };
      }

      return {
        id: 'reformation-convert',
        label: 'Move the map',
        title: 'Convert changes factions and seeds the reserve',
        body: 'Pay 1 coin to switch yourself or 2 to switch another player. It cannot be challenged or blocked, and the cost becomes available to Embezzle later.',
        tone: 'green',
      };
    }

    if (gameState.turnNumber <= 2) {
      return {
        id: 'opening-action',
        label: 'Your first move',
        title: 'Choose safety or start a story',
        body: 'Income is guaranteed. Character actions are stronger—and you may claim any role—but every claim gives the bot a chance to challenge.',
        tone: 'gold',
      };
    }

    if (gameState.turnNumber <= 5) {
      return {
        id: 'repeat-claims',
        label: 'Table memory',
        title: 'Consistency makes a bluff believable',
        body: 'Notice which roles you and the bot keep claiming. Repeating a story can build trust, while suddenly switching roles may attract a challenge.',
        tone: 'gold',
      };
    }
  }

  return null;
}
