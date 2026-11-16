import { ACTION_DEFINITIONS, COUP_COST, FORCED_COUP_THRESHOLD } from '@/shared/constants';
import { ActionType, Character, ClientGameState, GameMode, TurnPhase } from '@/shared/types';
import { formatListToParts } from '@/shared/i18n/messageFormat';
import { LOCALES } from '@/shared/i18n/locales';
import { actionName, characterName } from '../i18n/glossary';
import { makePlainTranslator, type PlainTranslator } from '../i18n/runtime';
import type { MessageKey } from '../i18n/schema';
import { visibleBlockCharacters } from './blockOptions';
import { RULE_NUMBERS, gameNouns } from './learnText';

/**
 * The practice coach's brain: which tip fits this moment of the game, and
 * which part of the court table it is about. Pure — the callout component
 * (components/game/PracticeCoach.tsx) only measures and draws.
 *
 * A tip is words only by reference: each of its lines is a `tutorial.coach.*`
 * message key with typed params (a player, a character, an action, a list of
 * characters, a number), so every line is one whole sentence a translator can
 * reorder. `renderCoachText` turns a line into a string; the component turns
 * it into nodes, wrapping player names in `<bdi>`.
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

/** A param of a coach line, typed by what it names. */
export type CoachParam =
  | number
  | string
  | { player: string }
  | { character: Character }
  | { action: ActionType }
  /** Characters joined with the language's "or". */
  | { anyOf: Character[] };

/** One line of a tip: a message key and its params. */
export interface CoachText {
  key: MessageKey;
  params?: Readonly<Record<string, CoachParam>>;
}

interface CoachTipBase {
  id: string;
  tone: PracticeCoachTone;
  anchor: CoachAnchor;
  /**
   * A first-time tip: shown for the first situation that earns it and never
   * again. See {@link CoachHistory}.
   */
  once?: boolean;
}

/** A tip as message references (what the callout renders). */
export interface PracticeCoachMessage extends CoachTipBase {
  /** A short tag naming the tip. Not shown on screen at present. */
  label: CoachText;
  title: CoachText;
  body: CoachText;
}

/** A tip rendered to plain strings in one language. */
export interface PracticeCoachTip extends CoachTipBase {
  label: string;
  title: string;
  body: string;
}

/**
 * Tip id → the turn it was first shown on. A `once` tip stays up for the
 * whole turn it first appeared in (so it does not vanish the instant it is
 * recorded) and is skipped on every later turn.
 */
export type CoachHistory = ReadonlyMap<string, number>;

const EMPTY_HISTORY: CoachHistory = new Map();

/** True when a `once` tip may still be shown under this history. */
export function onceTipAvailable(id: string, history: CoachHistory, turnNumber: number): boolean {
  const shownOn = history.get(id);
  return shownOn === undefined || shownOn === turnNumber;
}

/** The first-targeted body for each action that can be aimed at you; anything else uses `other`. */
const TARGETED_BODY: Partial<Record<ActionType, MessageKey>> = {
  [ActionType.Steal]: 'tutorial.coach.firstTargeted.Steal',
  [ActionType.Assassinate]: 'tutorial.coach.firstTargeted.Assassinate',
  [ActionType.Examine]: 'tutorial.coach.firstTargeted.Examine',
};

const text = (key: MessageKey, params?: Record<string, CoachParam>): CoachText => ({ key, params });

/** `claimed` select value plus the character, for lines that fall back when no character is claimed. */
function claimParams(character: Character | null | undefined): Record<string, CoachParam> {
  return character ? { claimed: 'yes', character: { character } } : { claimed: 'no', character: '' };
}

export function getPracticeCoachMessage(
  gameState: ClientGameState,
  history: CoachHistory = EMPTY_HISTORY,
): PracticeCoachMessage | null {
  const { myId, turnPhase, pendingAction, pendingBlock, turnNumber } = gameState;
  const me = gameState.players.find(player => player.id === myId);
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const canShowOnce = (id: string) => onceTipAvailable(id, history, turnNumber);
  // An empty name renders as `tutorial.coach.someone` ("The bot").
  const playerParam = (id: string | undefined): CoachParam => ({
    player: gameState.players.find(player => player.id === id)?.name ?? '',
  });

  if (!me?.isAlive || turnPhase === TurnPhase.GameOver) return null;

  if (
    turnPhase === TurnPhase.AwaitingInfluenceLoss
    && gameState.influenceLossRequest?.playerId === myId
  ) {
    return {
      id: 'choose-influence',
      label: text('tutorial.coach.chooseInfluence.label'),
      title: text('tutorial.coach.chooseInfluence.title'),
      body: text('tutorial.coach.chooseInfluence.body'),
      tone: 'danger',
      anchor: 'prompt',
    };
  }

  if (turnPhase === TurnPhase.AwaitingExchange && gameState.exchangeState) {
    return {
      id: 'exchange-hand',
      label: text('glossary.action.Exchange'),
      title: text('tutorial.coach.exchange.title'),
      body: text('tutorial.coach.exchange.body'),
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
      label: text('tutorial.coach.examineSelection.label'),
      title: text('tutorial.coach.examineSelection.title'),
      body: text('tutorial.coach.examineSelection.body'),
      tone: 'info',
      anchor: 'prompt',
    };
  }

  if (turnPhase === TurnPhase.AwaitingExamineDecision && gameState.examineState) {
    return {
      id: 'examine-decision',
      label: text('glossary.action.Examine'),
      title: text('tutorial.coach.examineDecision.title'),
      body: text('tutorial.coach.examineDecision.body'),
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
    const actor = playerParam(pendingAction.actorId);
    const action: CoachParam = { action: pendingAction.type };
    const claim = claimParams(pendingAction.claimedCharacter);

    const blockable = pendingAction.targetId === myId
      && ACTION_DEFINITIONS[pendingAction.type].blockedBy.length > 0;
    const blockers: CoachParam = { anyOf: visibleBlockCharacters(gameState) };

    if (pendingAction.targetId === myId && canShowOnce('first-targeted')) {
      return {
        id: 'first-targeted',
        label: text('tutorial.coach.firstTargeted.label'),
        title: text('tutorial.coach.firstTargeted.title', { actor }),
        body: text(TARGETED_BODY[pendingAction.type] ?? 'tutorial.coach.firstTargeted.other', {
          action,
          ...claim,
          blockable: blockable ? 'yes' : 'no',
          blockers,
        }),
        tone: 'danger',
        anchor: 'plaque',
        once: true,
      };
    }

    if (blockable) {
      return {
        id: 'block-or-challenge',
        label: text('tutorial.coach.blockOrChallenge.label'),
        title: text('tutorial.coach.blockOrChallenge.title', { action }),
        body: text('tutorial.coach.blockOrChallenge.body', { blockers, ...claim }),
        tone: pendingAction.type === ActionType.Assassinate ? 'danger' : 'info',
        anchor: 'plaque',
      };
    }

    const embezzle = pendingAction.type === ActionType.Embezzle;
    return {
      id: 'challenge-claim',
      label: text('tutorial.coach.challengeClaim.label'),
      title: embezzle
        ? text('tutorial.coach.challengeEmbezzle.title', { actor })
        : text('tutorial.coach.challengeClaim.title', { actor, ...claim }),
      body: embezzle
        ? text('tutorial.coach.challengeEmbezzle.body')
        : text('tutorial.coach.challengeClaim.body', claim),
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
    return {
      id: 'challenge-block',
      label: text('tutorial.coach.challengeBlock.label'),
      title: text('tutorial.coach.challengeBlock.title'),
      body: text('tutorial.coach.challengeBlock.body', {
        blocker: playerParam(pendingBlock.blockerId),
        character: { character: pendingBlock.claimedCharacter },
      }),
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
    const blockers: CoachParam = { anyOf: visibleBlockCharacters(gameState) };
    const action: CoachParam = { action: pendingAction.type };
    const tone: PracticeCoachTone = pendingAction.type === ActionType.Assassinate ? 'danger' : 'info';

    if (canShowOnce('first-block')) {
      return {
        id: 'first-block',
        label: text('tutorial.coach.firstBlock.label'),
        title: text('tutorial.coach.firstBlock.title', { action }),
        body: text('tutorial.coach.firstBlock.body', { blockers }),
        tone,
        anchor: 'prompt',
        once: true,
      };
    }

    return {
      id: 'make-block',
      label: text('tutorial.coach.makeBlock.label'),
      title: text('tutorial.coach.makeBlock.title', { action }),
      body: text('tutorial.coach.makeBlock.body', { blockers }),
      tone,
      anchor: 'prompt',
    };
  }

  if (turnPhase === TurnPhase.AwaitingAction && currentPlayer?.id === myId) {
    if (me.coins >= FORCED_COUP_THRESHOLD) {
      return {
        id: 'must-coup',
        label: text('tutorial.coach.coins', { count: me.coins }),
        title: text('tutorial.coach.mustCoup.title'),
        body: text('tutorial.coach.mustCoup.body'),
        tone: 'danger',
        anchor: 'dock',
      };
    }

    if (me.coins >= COUP_COST) {
      return {
        id: 'coup-ready',
        label: text('tutorial.coach.coins', { count: me.coins }),
        title: text('tutorial.coach.coupReady.title'),
        body: text('tutorial.coach.coupReady.body'),
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
          label: text('tutorial.coach.freeForAll.label'),
          title: text('tutorial.coach.freeForAll.title'),
          body: text('tutorial.coach.freeForAll.body'),
          tone: 'info',
          anchor: 'dock',
        };
      }

      if (gameState.turnNumber <= 2) {
        return {
          id: 'reformation-factions',
          label: text('tutorial.coach.factions.label'),
          title: text('tutorial.coach.factions.title'),
          body: text('tutorial.coach.factions.body'),
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
          label: text('tutorial.coach.embezzle.label', { count: gameState.treasuryReserve }),
          title: text('tutorial.coach.embezzle.title'),
          body: holdsDuke
            ? text('tutorial.coach.embezzle.holdsDuke')
            : text('tutorial.coach.embezzle.noDuke'),
          tone: 'info',
          anchor: 'dock',
        };
      }

      return {
        id: 'reformation-convert',
        label: text('glossary.action.Convert'),
        title: text('tutorial.coach.convert.title'),
        body: text('tutorial.coach.convert.body'),
        tone: 'info',
        anchor: 'dock',
      };
    }

    if (gameState.turnNumber <= 2) {
      return {
        id: 'opening-action',
        label: text('tutorial.coach.yourMove.label'),
        title: text('tutorial.coach.opening.title'),
        body: text('tutorial.coach.opening.body'),
        tone: 'info',
        anchor: 'dock',
      };
    }

    if (gameState.turnNumber <= 5) {
      return {
        id: 'repeat-claims',
        label: text('tutorial.coach.yourMove.label'),
        title: text('tutorial.coach.repeat.title'),
        body: text('tutorial.coach.repeat.body'),
        tone: 'info',
        anchor: 'dock',
      };
    }
  }

  return null;
}

/**
 * Resolve a line's typed params into format values: characters and actions to
 * their glossary names, a list of characters to "A or B" in the language,
 * a player to `renderPlayer(name)` (a string, or a `<bdi>` node in React).
 * The glossary nouns and rule numbers (`{coup}`, `{forcedCoup}`...) are always
 * available too.
 */
export function coachParams(
  t: PlainTranslator,
  params: CoachText['params'],
  renderPlayer: (name: string) => unknown,
  renderList: (items: string[]) => unknown,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...RULE_NUMBERS, ...gameNouns(t) };
  for (const [name, value] of Object.entries(params ?? {})) {
    if (typeof value === 'number' || typeof value === 'string') out[name] = value;
    else if ('player' in value) out[name] = renderPlayer(value.player || t('tutorial.coach.someone'));
    else if ('character' in value) out[name] = characterName(t, value.character);
    else if ('action' in value) out[name] = actionName(t, value.action);
    else if (value.anyOf.length === 0) out[name] = t('tutorial.coach.blockerFallback');
    else out[name] = renderList(value.anyOf.map(c => characterName(t, c)));
  }
  return out;
}

/** "Captain or Ambassador" in the translator's language, as a string. */
function orList(t: PlainTranslator, items: string[]): string {
  return formatListToParts(items, LOCALES[t.locale].intl, 'disjunction').map(String).join('');
}

/** One coach line as a plain string. */
export function renderCoachText(t: PlainTranslator, line: CoachText): string {
  return t(line.key, coachParams(t, line.params, name => name, items => orList(t, items)));
}

/**
 * The tip for this moment, rendered to plain strings (English unless a
 * translator is passed). The callout uses {@link getPracticeCoachMessage}
 * and renders rich text itself.
 */
export function getPracticeCoachTip(
  gameState: ClientGameState,
  history: CoachHistory = EMPTY_HISTORY,
  t: PlainTranslator = makePlainTranslator('en'),
): PracticeCoachTip | null {
  const message = getPracticeCoachMessage(gameState, history);
  if (!message) return null;
  return {
    ...message,
    label: renderCoachText(t, message.label),
    title: renderCoachText(t, message.title),
    body: renderCoachText(t, message.body),
  };
}
