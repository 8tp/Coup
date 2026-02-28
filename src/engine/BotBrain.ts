import {
  ActionType,
  AiPersonality,
  Character,
  TurnPhase,
  PendingAction,
  PendingBlock,
  ChallengeState,
  InfluenceLossRequest,
  ExchangeState,
} from '../shared/types';
import {
  ACTION_DEFINITIONS,
  FORCED_COUP_THRESHOLD,
  COUP_COST,
  ASSASSINATE_COST,
} from '../shared/constants';
import { Game } from './Game';

// ─── Bot Decision Types ───

export type BotDecision =
  | { type: 'action'; action: ActionType; targetId?: string }
  | { type: 'challenge' }
  | { type: 'pass_challenge' }
  | { type: 'block'; character: Character }
  | { type: 'pass_block' }
  | { type: 'challenge_block' }
  | { type: 'pass_challenge_block' }
  | { type: 'choose_influence_loss'; influenceIndex: number }
  | { type: 'choose_exchange'; keepIndices: number[] };

// ─── Card Value Rankings (higher = more valuable to keep) ───

const CARD_VALUE: Record<Character, number> = {
  [Character.Duke]: 5,       // Tax is strong income
  [Character.Assassin]: 4,   // Cheap elimination
  [Character.Captain]: 3,    // Steal disrupts + blocks steal
  [Character.Ambassador]: 2, // Exchange for better cards + blocks steal
  [Character.Contessa]: 1,   // Only blocks assassination
};

/**
 * BotBrain — Pure decision logic for AI players.
 * No I/O, no timers, no randomness in structure (only in probability thresholds).
 * Only reads the bot's own cards, never peeks at opponents or deck.
 */
export class BotBrain {

  /**
   * Given the current game state, determine what the bot should do.
   * Returns null if the bot has nothing to do in this phase.
   */
  static decide(
    game: Game,
    botId: string,
    personality: AiPersonality,
    pendingAction: PendingAction | null,
    pendingBlock: PendingBlock | null,
    challengeState: ChallengeState | null,
    influenceLossRequest: InfluenceLossRequest | null,
    exchangeState: ExchangeState | null,
    blockPassedPlayerIds: string[],
  ): BotDecision | null {
    const bot = game.getPlayer(botId);
    if (!bot || !bot.isAlive) return null;

    switch (game.turnPhase) {
      case TurnPhase.AwaitingAction:
        if (game.currentPlayer.id === botId) {
          return this.decideAction(game, botId, personality);
        }
        return null;

      case TurnPhase.AwaitingActionChallenge:
        return this.decideActionChallenge(game, botId, personality, pendingAction, challengeState);

      case TurnPhase.AwaitingBlock:
        return this.decideBlock(game, botId, personality, pendingAction, blockPassedPlayerIds);

      case TurnPhase.AwaitingBlockChallenge:
        return this.decideBlockChallenge(game, botId, personality, pendingAction, pendingBlock, challengeState);

      case TurnPhase.AwaitingInfluenceLoss:
        if (influenceLossRequest?.playerId === botId) {
          return this.decideInfluenceLoss(game, botId);
        }
        return null;

      case TurnPhase.AwaitingExchange:
        if (exchangeState?.playerId === botId) {
          return this.decideExchange(game, botId, exchangeState);
        }
        return null;

      default:
        return null;
    }
  }

  // ─── Action Selection ───

  private static decideAction(game: Game, botId: string, personality: AiPersonality): BotDecision {
    const bot = game.getPlayer(botId)!;
    const { honesty, vengefulness } = personality;

    // Must coup at 10+ coins
    if (bot.coins >= FORCED_COUP_THRESHOLD) {
      return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, vengefulness) };
    }

    // Can afford coup — consider it if we have 7+ coins
    if (bot.coins >= COUP_COST) {
      if (Math.random() < 0.4) {
        return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, vengefulness) };
      }
    }

    const ownedCharacters = bot.hiddenCharacters;
    const honestyFactor = honesty / 100;

    // Build list of candidate actions with weights
    const candidates: Array<{ action: ActionType; targetId?: string; weight: number }> = [];

    // Income — always safe, low reward
    candidates.push({ action: ActionType.Income, weight: 1 });

    // Foreign Aid — no bluff needed, but can be blocked
    candidates.push({ action: ActionType.ForeignAid, weight: 2 });

    // Tax (Duke) — high honesty prefers if has Duke, low honesty bluffs
    const hasDuke = ownedCharacters.includes(Character.Duke);
    if (hasDuke) {
      candidates.push({ action: ActionType.Tax, weight: 5 });
    } else {
      candidates.push({ action: ActionType.Tax, weight: 3 * (1 - honestyFactor) });
    }

    // Steal (Captain) — needs target with coins
    const stealTargets = game.getAlivePlayers().filter(p => p.id !== botId && p.coins > 0);
    if (stealTargets.length > 0) {
      const hasCaptain = ownedCharacters.includes(Character.Captain);
      const targetId = this.pickTarget(game, botId, vengefulness, stealTargets.map(p => p.id));
      if (hasCaptain) {
        candidates.push({ action: ActionType.Steal, targetId, weight: 4 });
      } else {
        candidates.push({ action: ActionType.Steal, targetId, weight: 2.5 * (1 - honestyFactor) });
      }
    }

    // Assassinate (Assassin) — needs 3 coins
    if (bot.coins >= ASSASSINATE_COST) {
      const hasAssassin = ownedCharacters.includes(Character.Assassin);
      const targetId = this.pickTarget(game, botId, vengefulness);
      if (hasAssassin) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 4 });
      } else {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 2 * (1 - honestyFactor) });
      }
    }

    // Exchange (Ambassador) — useful for getting better cards
    const hasAmbassador = ownedCharacters.includes(Character.Ambassador);
    if (hasAmbassador) {
      candidates.push({ action: ActionType.Exchange, weight: 2 });
    } else {
      candidates.push({ action: ActionType.Exchange, weight: 1 * (1 - honestyFactor) });
    }

    return this.weightedPick(candidates);
  }

  // ─── Challenge Decision ───

  private static decideActionChallenge(
    game: Game,
    botId: string,
    personality: AiPersonality,
    pendingAction: PendingAction | null,
    challengeState: ChallengeState | null,
  ): BotDecision | null {
    if (!pendingAction || !challengeState) return null;
    if (pendingAction.actorId === botId) return null;
    if (challengeState.passedPlayerIds.includes(botId)) return null;

    const { skepticism } = personality;
    const bot = game.getPlayer(botId)!;
    const claimedChar = pendingAction.claimedCharacter;
    if (!claimedChar) return { type: 'pass_challenge' };

    // If bot can block this action with a card it actually holds, strongly prefer
    // passing the challenge and blocking instead — blocking is much safer than challenging.
    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (pendingAction.targetId === botId && def.blockedBy.length > 0) {
      const canBlock = def.blockedBy.some(c => bot.hiddenCharacters.includes(c));
      if (canBlock) {
        // Almost always pass — wait to block instead. Only challenge 5% of the time.
        if (Math.random() > 0.05) {
          return { type: 'pass_challenge' };
        }
      }
    }

    // If bot holds the claimed character, the actor is more likely bluffing
    const botHasClaimedChar = bot.hiddenCharacters.includes(claimedChar);
    let challengeProb = skepticism / 100 * 0.5; // Base: 0–50% from skepticism

    if (botHasClaimedChar) {
      challengeProb += 0.25; // We hold one copy, so more likely a bluff
    }

    // If action is dangerous and targets us (and we can't block), be more willing to challenge
    if (pendingAction.targetId === botId) {
      challengeProb += 0.15;
    }

    if (Math.random() < challengeProb) {
      return { type: 'challenge' };
    }
    return { type: 'pass_challenge' };
  }

  // ─── Block Decision ───

  private static decideBlock(
    game: Game,
    botId: string,
    personality: AiPersonality,
    pendingAction: PendingAction | null,
    blockPassedPlayerIds: string[],
  ): BotDecision | null {
    if (!pendingAction) return null;
    if (pendingAction.actorId === botId) return null;
    if (blockPassedPlayerIds.includes(botId)) return null;

    const bot = game.getPlayer(botId)!;
    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (def.blockedBy.length === 0) return { type: 'pass_block' };

    // Check if bot is eligible to block
    const isTarget = pendingAction.targetId === botId;
    if (pendingAction.type === ActionType.Steal && !isTarget) return { type: 'pass_block' };
    if (pendingAction.type === ActionType.Assassinate && !isTarget) return { type: 'pass_block' };

    // For Foreign Aid, any player can block claiming Duke
    const { honesty } = personality;
    const honestyFactor = honesty / 100;

    for (const blockChar of def.blockedBy) {
      const hasCard = bot.hiddenCharacters.includes(blockChar);

      if (hasCard) {
        // We actually have the card — always block when targeted
        if (isTarget) return { type: 'block', character: blockChar };
        // For Foreign Aid, block with some probability
        if (Math.random() < 0.6) return { type: 'block', character: blockChar };
      } else {
        // Bluff block — more likely if dishonest, and much more likely if we're the target
        if (isTarget) {
          // Being assassinated/stolen from — bluff block more aggressively
          const bluffProb = 0.7 * (1 - honestyFactor);
          if (Math.random() < bluffProb) return { type: 'block', character: blockChar };
        } else {
          // Foreign aid — bluff Duke block occasionally
          const bluffProb = 0.2 * (1 - honestyFactor);
          if (Math.random() < bluffProb) return { type: 'block', character: blockChar };
        }
      }
    }

    return { type: 'pass_block' };
  }

  // ─── Block Challenge Decision ───

  private static decideBlockChallenge(
    game: Game,
    botId: string,
    personality: AiPersonality,
    pendingAction: PendingAction | null,
    pendingBlock: PendingBlock | null,
    challengeState: ChallengeState | null,
  ): BotDecision | null {
    if (!pendingAction || !pendingBlock || !challengeState) return null;
    // Only the original actor can challenge the block
    if (pendingAction.actorId !== botId) return null;
    if (challengeState.passedPlayerIds.includes(botId)) return null;

    const { skepticism } = personality;
    const bot = game.getPlayer(botId)!;
    const blockerClaimedChar = pendingBlock.claimedCharacter;

    // If bot holds the claimed character, more likely the blocker is bluffing
    const botHasChar = bot.hiddenCharacters.includes(blockerClaimedChar);
    let challengeProb = skepticism / 100 * 0.4;

    if (botHasChar) {
      challengeProb += 0.2;
    }

    // If our action cost coins (assassination), more incentive to challenge the block
    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (def.cost > 0) {
      challengeProb += 0.1;
    }

    if (Math.random() < challengeProb) {
      return { type: 'challenge_block' };
    }
    return { type: 'pass_challenge_block' };
  }

  // ─── Influence Loss Decision ───

  private static decideInfluenceLoss(game: Game, botId: string): BotDecision {
    const bot = game.getPlayer(botId)!;

    // Find unrevealed influences
    const unrevealed = bot.influences
      .map((inf, i) => ({ character: inf.character, index: i }))
      .filter(x => !bot.influences[x.index].revealed);

    if (unrevealed.length === 1) {
      return { type: 'choose_influence_loss', influenceIndex: unrevealed[0].index };
    }

    // Lose the least valuable card
    unrevealed.sort((a, b) => CARD_VALUE[a.character] - CARD_VALUE[b.character]);
    return { type: 'choose_influence_loss', influenceIndex: unrevealed[0].index };
  }

  // ─── Exchange Decision ───

  private static decideExchange(game: Game, botId: string, exchangeState: ExchangeState): BotDecision {
    const bot = game.getPlayer(botId)!;
    const currentCards = bot.hiddenCharacters;
    const allCards = [...currentCards, ...exchangeState.drawnCards];
    const keepCount = bot.aliveInfluenceCount;

    // Rank all cards by value, keep the best ones
    const indexed = allCards.map((char, i) => ({ char, index: i, value: CARD_VALUE[char] }));
    indexed.sort((a, b) => b.value - a.value);

    const keepIndices = indexed.slice(0, keepCount).map(x => x.index);
    return { type: 'choose_exchange', keepIndices };
  }

  // ─── Helpers ───

  /**
   * Pick a target player. Higher vengefulness = prefer leading players (most coins).
   * Lower vengefulness = more random.
   */
  private static pickTarget(
    game: Game,
    botId: string,
    vengefulness: number,
    candidateIds?: string[],
  ): string {
    let candidates = game.getAlivePlayers().filter(p => p.id !== botId);
    if (candidateIds) {
      candidates = candidates.filter(p => candidateIds.includes(p.id));
    }
    if (candidates.length === 0) return '';

    const vengeFactor = vengefulness / 100;

    if (Math.random() < vengeFactor) {
      // Target the player with the most coins (leading player)
      candidates.sort((a, b) => b.coins - a.coins);
      return candidates[0].id;
    }

    // Random target
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  /**
   * Weighted random pick from candidates.
   */
  private static weightedPick(
    candidates: Array<{ action: ActionType; targetId?: string; weight: number }>,
  ): BotDecision {
    // Filter out zero or negative weights
    const valid = candidates.filter(c => c.weight > 0);
    if (valid.length === 0) {
      return { type: 'action', action: ActionType.Income };
    }

    const totalWeight = valid.reduce((sum, c) => sum + c.weight, 0);
    let roll = Math.random() * totalWeight;

    for (const c of valid) {
      roll -= c.weight;
      if (roll <= 0) {
        return { type: 'action', action: c.action, targetId: c.targetId };
      }
    }

    // Fallback
    const last = valid[valid.length - 1];
    return { type: 'action', action: last.action, targetId: last.targetId };
  }
}
