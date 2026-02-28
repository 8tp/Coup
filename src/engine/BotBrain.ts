import {
  ActionType,
  BotDifficulty,
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
  CARDS_PER_CHARACTER,
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

/**
 * BotBrain — Pure decision logic for AI players.
 * No I/O, no timers. Only reads the bot's own cards and publicly revealed cards.
 *
 * Difficulty tiers:
 * - Easy: Plays honestly, never bluffs or challenges
 * - Medium: Occasional bluffs and challenges
 * - Hard: Strategic play with card counting
 */
export class BotBrain {

  /**
   * Given the current game state, determine what the bot should do.
   * Returns null if the bot has nothing to do in this phase.
   */
  static decide(
    game: Game,
    botId: string,
    difficulty: BotDifficulty,
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
          return this.decideAction(game, botId, difficulty);
        }
        return null;

      case TurnPhase.AwaitingActionChallenge:
        return this.decideActionChallenge(game, botId, difficulty, pendingAction, challengeState);

      case TurnPhase.AwaitingBlock:
        return this.decideBlock(game, botId, difficulty, pendingAction, blockPassedPlayerIds);

      case TurnPhase.AwaitingBlockChallenge:
        return this.decideBlockChallenge(game, botId, difficulty, pendingAction, pendingBlock, challengeState);

      case TurnPhase.AwaitingInfluenceLoss:
        if (influenceLossRequest?.playerId === botId) {
          return this.decideInfluenceLoss(game, botId, difficulty);
        }
        return null;

      case TurnPhase.AwaitingExchange:
        if (exchangeState?.playerId === botId) {
          return this.decideExchange(game, botId, difficulty, exchangeState);
        }
        return null;

      default:
        return null;
    }
  }

  // ─── Helpers ───

  /** Count all revealed (face-up) characters across all players. */
  static countRevealedCharacters(game: Game): Map<Character, number> {
    const counts = new Map<Character, number>();
    for (const char of Object.values(Character)) {
      counts.set(char, 0);
    }
    for (const player of game.players) {
      for (const inf of player.influences) {
        if (inf.revealed) {
          counts.set(inf.character, (counts.get(inf.character) || 0) + 1);
        }
      }
    }
    return counts;
  }

  /**
   * Context-aware card ranking. Factors in game state for hard bots.
   * Higher value = more valuable to keep.
   */
  static dynamicCardValue(character: Character, game: Game, botId: string): number {
    const alivePlayers = game.getAlivePlayers();
    const aliveCount = alivePlayers.length;
    const revealed = this.countRevealedCharacters(game);
    const bot = game.getPlayer(botId)!;

    let value = 0;

    switch (character) {
      case Character.Duke:
        // Tax is strong, especially early game
        value = 5;
        if (aliveCount > 3) value += 1; // More valuable with more players (safe income)
        break;

      case Character.Captain:
        // Steal is a 4-coin swing, dominant in 1v1
        value = 4;
        if (aliveCount === 2) value += 3; // Dominant in 1v1
        break;

      case Character.Assassin:
        // Cheap elimination
        value = 4;
        if (bot.coins < ASSASSINATE_COST) value -= 1; // Less useful without coins
        break;

      case Character.Ambassador:
        // Exchange for better cards + blocks steal
        value = 2;
        if (aliveCount <= 2) value -= 1; // Less useful late game
        break;

      case Character.Contessa:
        // Blocks assassination
        value = 2;
        // More valuable when opponents have 3+ coins (assassination threat)
        const opponentsWithCoins = alivePlayers.filter(p => p.id !== botId && p.coins >= ASSASSINATE_COST);
        if (opponentsWithCoins.length > 0) value += 2;
        break;
    }

    // Reduce value if most copies are revealed (harder to bluff with)
    const revealedCount = revealed.get(character) || 0;
    if (revealedCount >= 2) value -= 1;

    return value;
  }

  /** Pick a target: hard always targets highest-coin, medium 50%, easy random. */
  private static pickTarget(
    game: Game,
    botId: string,
    difficulty: BotDifficulty,
    candidateIds?: string[],
  ): string {
    let candidates = game.getAlivePlayers().filter(p => p.id !== botId);
    if (candidateIds) {
      candidates = candidates.filter(p => candidateIds.includes(p.id));
    }
    if (candidates.length === 0) return '';

    if (difficulty === 'hard') {
      // Always target highest-coin player (especially 7+ for coup threat)
      candidates.sort((a, b) => b.coins - a.coins);
      return candidates[0].id;
    }

    if (difficulty === 'medium') {
      // 50% chance to target leader
      if (Math.random() < 0.5) {
        candidates.sort((a, b) => b.coins - a.coins);
        return candidates[0].id;
      }
    }

    // Easy or random fallback
    return candidates[Math.floor(Math.random() * candidates.length)].id;
  }

  /** Weighted random pick from candidates. */
  private static weightedPick(
    candidates: Array<{ action: ActionType; targetId?: string; weight: number }>,
  ): BotDecision {
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

    const last = valid[valid.length - 1];
    return { type: 'action', action: last.action, targetId: last.targetId };
  }

  // ─── Action Selection ───

  private static decideAction(game: Game, botId: string, difficulty: BotDifficulty): BotDecision {
    const bot = game.getPlayer(botId)!;
    const alivePlayers = game.getAlivePlayers();
    const aliveCount = alivePlayers.length;

    // Must coup at 10+ coins (all tiers)
    if (bot.coins >= FORCED_COUP_THRESHOLD) {
      return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, difficulty) };
    }

    // Can afford coup — consider it based on difficulty
    if (bot.coins >= COUP_COST) {
      const coupProb = difficulty === 'hard' ? 0.85 : difficulty === 'medium' ? 0.65 : 0.4;
      if (Math.random() < coupProb) {
        return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, difficulty) };
      }
    }

    const ownedCharacters = bot.hiddenCharacters;
    const candidates: Array<{ action: ActionType; targetId?: string; weight: number }> = [];

    if (difficulty === 'easy') {
      return this.decideActionEasy(game, botId, bot, ownedCharacters, candidates);
    } else if (difficulty === 'medium') {
      return this.decideActionMedium(game, botId, bot, ownedCharacters, candidates);
    } else {
      return this.decideActionHard(game, botId, bot, ownedCharacters, candidates, aliveCount);
    }
  }

  private static decideActionEasy(
    game: Game, botId: string, bot: any, ownedCharacters: Character[],
    candidates: Array<{ action: ActionType; targetId?: string; weight: number }>,
  ): BotDecision {
    // Easy: never bluffs, only plays actions it has cards for
    candidates.push({ action: ActionType.Income, weight: 2 });
    candidates.push({ action: ActionType.ForeignAid, weight: 2 });

    if (ownedCharacters.includes(Character.Duke)) {
      candidates.push({ action: ActionType.Tax, weight: 3 });
    }

    const stealTargets = game.getAlivePlayers().filter(p => p.id !== botId && p.coins > 0);
    if (ownedCharacters.includes(Character.Captain) && stealTargets.length > 0) {
      const targetId = this.pickTarget(game, botId, 'easy', stealTargets.map(p => p.id));
      candidates.push({ action: ActionType.Steal, targetId, weight: 3 });
    }

    if (bot.coins >= ASSASSINATE_COST && ownedCharacters.includes(Character.Assassin)) {
      const targetId = this.pickTarget(game, botId, 'easy');
      candidates.push({ action: ActionType.Assassinate, targetId, weight: 3 });
    }

    if (ownedCharacters.includes(Character.Ambassador)) {
      candidates.push({ action: ActionType.Exchange, weight: 2 });
    }

    return this.weightedPick(candidates);
  }

  private static decideActionMedium(
    game: Game, botId: string, bot: any, ownedCharacters: Character[],
    candidates: Array<{ action: ActionType; targetId?: string; weight: number }>,
  ): BotDecision {
    // Medium: slight preference for Tax/Steal, 30% bluff chance
    candidates.push({ action: ActionType.Income, weight: 1 });
    candidates.push({ action: ActionType.ForeignAid, weight: 2 });

    const hasDuke = ownedCharacters.includes(Character.Duke);
    if (hasDuke) {
      candidates.push({ action: ActionType.Tax, weight: 5 });
    } else if (Math.random() < 0.3) {
      candidates.push({ action: ActionType.Tax, weight: 3 });
    }

    const stealTargets = game.getAlivePlayers().filter(p => p.id !== botId && p.coins > 0);
    if (stealTargets.length > 0) {
      const hasCaptain = ownedCharacters.includes(Character.Captain);
      const targetId = this.pickTarget(game, botId, 'medium', stealTargets.map(p => p.id));
      if (hasCaptain) {
        candidates.push({ action: ActionType.Steal, targetId, weight: 4 });
      } else if (Math.random() < 0.3) {
        candidates.push({ action: ActionType.Steal, targetId, weight: 2 });
      }
    }

    if (bot.coins >= ASSASSINATE_COST) {
      const hasAssassin = ownedCharacters.includes(Character.Assassin);
      const targetId = this.pickTarget(game, botId, 'medium');
      if (hasAssassin) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 4 });
      } else if (Math.random() < 0.3) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 2 });
      }
    }

    const hasAmbassador = ownedCharacters.includes(Character.Ambassador);
    if (hasAmbassador) {
      candidates.push({ action: ActionType.Exchange, weight: 2 });
    } else if (Math.random() < 0.3) {
      candidates.push({ action: ActionType.Exchange, weight: 1 });
    }

    return this.weightedPick(candidates);
  }

  private static decideActionHard(
    game: Game, botId: string, bot: any, ownedCharacters: Character[],
    candidates: Array<{ action: ActionType; targetId?: string; weight: number }>,
    aliveCount: number,
  ): BotDecision {
    // Hard: strategic, bluffs high-value claims, avoids bluffing dead characters
    const revealed = this.countRevealedCharacters(game);

    candidates.push({ action: ActionType.Income, weight: 1 });
    candidates.push({ action: ActionType.ForeignAid, weight: 1.5 });

    // Tax (Duke) — strong preference, especially early
    const hasDuke = ownedCharacters.includes(Character.Duke);
    const dukeRevealed = revealed.get(Character.Duke) || 0;
    if (hasDuke) {
      candidates.push({ action: ActionType.Tax, weight: 6 });
    } else if (dukeRevealed < 2) {
      // Safe to bluff Duke if not many revealed
      candidates.push({ action: ActionType.Tax, weight: 4 });
    }

    // Steal (Captain) — strong preference in 1v1
    const stealTargets = game.getAlivePlayers().filter(p => p.id !== botId && p.coins > 0);
    if (stealTargets.length > 0) {
      const hasCaptain = ownedCharacters.includes(Character.Captain);
      const captainRevealed = revealed.get(Character.Captain) || 0;
      const targetId = this.pickTarget(game, botId, 'hard', stealTargets.map(p => p.id));
      if (hasCaptain) {
        const weight = aliveCount === 2 ? 8 : 5; // Dominant in 1v1
        candidates.push({ action: ActionType.Steal, targetId, weight });
      } else if (captainRevealed < 2) {
        const weight = aliveCount === 2 ? 5 : 3;
        candidates.push({ action: ActionType.Steal, targetId, weight });
      }
    }

    // Assassinate
    if (bot.coins >= ASSASSINATE_COST) {
      const hasAssassin = ownedCharacters.includes(Character.Assassin);
      const assassinRevealed = revealed.get(Character.Assassin) || 0;
      const targetId = this.pickTarget(game, botId, 'hard');
      if (hasAssassin) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 5 });
      } else if (assassinRevealed < 2) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 3 });
      }
    }

    // Exchange (Ambassador)
    const hasAmbassador = ownedCharacters.includes(Character.Ambassador);
    if (hasAmbassador) {
      const weight = aliveCount <= 2 ? 1 : 2;
      candidates.push({ action: ActionType.Exchange, weight });
    }
    // Hard bots don't bluff Ambassador (low payoff)

    return this.weightedPick(candidates);
  }

  // ─── Challenge Decision ───

  private static decideActionChallenge(
    game: Game,
    botId: string,
    difficulty: BotDifficulty,
    pendingAction: PendingAction | null,
    challengeState: ChallengeState | null,
  ): BotDecision | null {
    if (!pendingAction || !challengeState) return null;
    if (pendingAction.actorId === botId) return null;
    if (challengeState.passedPlayerIds.includes(botId)) return null;

    const bot = game.getPlayer(botId)!;
    const claimedChar = pendingAction.claimedCharacter;
    if (!claimedChar) return { type: 'pass_challenge' };

    // If bot can block this action with a card it actually holds, prefer passing to block instead
    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (pendingAction.targetId === botId && def.blockedBy.length > 0) {
      const canBlock = def.blockedBy.some(c => bot.hiddenCharacters.includes(c));
      if (canBlock) {
        return { type: 'pass_challenge' };
      }
    }

    if (difficulty === 'easy') {
      // Easy: never challenges
      return { type: 'pass_challenge' };
    }

    if (difficulty === 'medium') {
      // Medium: 20% base challenge rate
      // Never challenge assassination when we have 2 influences (50% avoids)
      if (pendingAction.type === ActionType.Assassinate && pendingAction.targetId === botId) {
        if (bot.aliveInfluenceCount >= 2 && Math.random() < 0.5) {
          return { type: 'pass_challenge' };
        }
      }

      let challengeProb = 0.20;
      // Boost if bot holds the claimed character
      if (bot.hiddenCharacters.includes(claimedChar)) {
        challengeProb += 0.15;
      }
      // Boost if targeted
      if (pendingAction.targetId === botId) {
        challengeProb += 0.10;
      }

      return Math.random() < challengeProb ? { type: 'challenge' } : { type: 'pass_challenge' };
    }

    // Hard: card-counting challenges
    const revealed = this.countRevealedCharacters(game);
    const revealedCount = revealed.get(claimedChar) || 0;
    const botHoldsCount = bot.hiddenCharacters.filter(c => c === claimedChar).length;
    const accountedFor = revealedCount + botHoldsCount;

    // Never challenge assassination when we have 2 influences (too risky — can lose both)
    if (pendingAction.type === ActionType.Assassinate && pendingAction.targetId === botId) {
      if (bot.aliveInfluenceCount >= 2) {
        return { type: 'pass_challenge' };
      }
    }

    // If all copies are accounted for, 100% challenge
    if (accountedFor >= CARDS_PER_CHARACTER) {
      return { type: 'challenge' };
    }

    // If 2+ revealed, high challenge rate
    if (accountedFor >= 2) {
      return Math.random() < 0.7 ? { type: 'challenge' } : { type: 'pass_challenge' };
    }

    // If bot holds a copy, moderate challenge rate
    if (botHoldsCount > 0) {
      return Math.random() < 0.4 ? { type: 'challenge' } : { type: 'pass_challenge' };
    }

    // Otherwise low challenge rate
    return Math.random() < 0.1 ? { type: 'challenge' } : { type: 'pass_challenge' };
  }

  // ─── Block Decision ───

  private static decideBlock(
    game: Game,
    botId: string,
    difficulty: BotDifficulty,
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

    for (const blockChar of def.blockedBy) {
      const hasCard = bot.hiddenCharacters.includes(blockChar);

      if (hasCard) {
        // All tiers: always block when holding the card and targeted
        if (isTarget) return { type: 'block', character: blockChar };
        // For Foreign Aid, block with some probability
        if (Math.random() < 0.6) return { type: 'block', character: blockChar };
      } else {
        // Bluff blocking
        if (difficulty === 'easy') {
          // Easy: never bluff-blocks
          continue;
        }

        if (difficulty === 'medium') {
          if (isTarget && blockChar === Character.Contessa && pendingAction.type === ActionType.Assassinate) {
            // 50% bluff Contessa vs assassination
            if (Math.random() < 0.5) return { type: 'block', character: blockChar };
          } else if (isTarget) {
            // 20% bluff other blocks when targeted
            if (Math.random() < 0.2) return { type: 'block', character: blockChar };
          } else {
            // 10% bluff Duke block on foreign aid
            if (Math.random() < 0.1) return { type: 'block', character: blockChar };
          }
          continue;
        }

        // Hard: strategic bluff blocking
        const revealed = this.countRevealedCharacters(game);
        const revealedCount = revealed.get(blockChar) || 0;

        if (isTarget && blockChar === Character.Contessa && pendingAction.type === ActionType.Assassinate) {
          // Always bluff Contessa vs assassination (mathematically correct)
          return { type: 'block', character: blockChar };
        }

        if (isTarget) {
          // Bluff block if not too many copies revealed
          if (revealedCount < 2) {
            if (Math.random() < 0.6) return { type: 'block', character: blockChar };
          }
        } else {
          // Foreign aid Duke block — bluff based on revealed Duke count
          if (revealedCount < 2 && Math.random() < 0.3) {
            return { type: 'block', character: blockChar };
          }
        }
      }
    }

    return { type: 'pass_block' };
  }

  // ─── Block Challenge Decision ───

  private static decideBlockChallenge(
    game: Game,
    botId: string,
    difficulty: BotDifficulty,
    pendingAction: PendingAction | null,
    pendingBlock: PendingBlock | null,
    challengeState: ChallengeState | null,
  ): BotDecision | null {
    if (!pendingAction || !pendingBlock || !challengeState) return null;
    // Only the original actor can challenge the block
    if (pendingAction.actorId !== botId) return null;
    if (challengeState.passedPlayerIds.includes(botId)) return null;

    if (difficulty === 'easy') {
      // Easy: never challenges blocks
      return { type: 'pass_challenge_block' };
    }

    const bot = game.getPlayer(botId)!;
    const blockerClaimedChar = pendingBlock.claimedCharacter;

    if (difficulty === 'medium') {
      // Medium: 15% base challenge rate for blocks
      let challengeProb = 0.15;
      if (bot.hiddenCharacters.includes(blockerClaimedChar)) {
        challengeProb += 0.15;
      }
      const costDef = ACTION_DEFINITIONS[pendingAction.type];
      if (costDef.cost > 0) {
        challengeProb += 0.1;
      }
      return Math.random() < challengeProb ? { type: 'challenge_block' } : { type: 'pass_challenge_block' };
    }

    // Hard: card-counting
    const revealed = this.countRevealedCharacters(game);
    const revealedCount = revealed.get(blockerClaimedChar) || 0;
    const botHoldsCount = bot.hiddenCharacters.filter(c => c === blockerClaimedChar).length;
    const accountedFor = revealedCount + botHoldsCount;

    if (accountedFor >= CARDS_PER_CHARACTER) {
      return { type: 'challenge_block' };
    }

    if (accountedFor >= 2) {
      return Math.random() < 0.6 ? { type: 'challenge_block' } : { type: 'pass_challenge_block' };
    }

    // If our action cost coins, more incentive to challenge
    const costDef = ACTION_DEFINITIONS[pendingAction.type];
    if (costDef.cost > 0 && Math.random() < 0.3) {
      return { type: 'challenge_block' };
    }

    return Math.random() < 0.1 ? { type: 'challenge_block' } : { type: 'pass_challenge_block' };
  }

  // ─── Influence Loss Decision ───

  private static decideInfluenceLoss(game: Game, botId: string, difficulty: BotDifficulty): BotDecision {
    const bot = game.getPlayer(botId)!;

    // Find unrevealed influences
    const unrevealed = bot.influences
      .map((inf, i) => ({ character: inf.character, index: i }))
      .filter(x => !bot.influences[x.index].revealed);

    if (unrevealed.length === 1) {
      return { type: 'choose_influence_loss', influenceIndex: unrevealed[0].index };
    }

    if (difficulty === 'easy') {
      // Easy: random
      const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
      return { type: 'choose_influence_loss', influenceIndex: pick.index };
    }

    if (difficulty === 'medium') {
      // Medium: static card value ranking (lose lowest)
      const STATIC_VALUE: Record<Character, number> = {
        [Character.Duke]: 5,
        [Character.Assassin]: 4,
        [Character.Captain]: 3,
        [Character.Ambassador]: 2,
        [Character.Contessa]: 1,
      };
      unrevealed.sort((a, b) => STATIC_VALUE[a.character] - STATIC_VALUE[b.character]);
      return { type: 'choose_influence_loss', influenceIndex: unrevealed[0].index };
    }

    // Hard: dynamic card value (context-aware)
    unrevealed.sort((a, b) =>
      this.dynamicCardValue(a.character, game, botId) - this.dynamicCardValue(b.character, game, botId)
    );
    return { type: 'choose_influence_loss', influenceIndex: unrevealed[0].index };
  }

  // ─── Exchange Decision ───

  private static decideExchange(
    game: Game, botId: string, difficulty: BotDifficulty, exchangeState: ExchangeState,
  ): BotDecision {
    const bot = game.getPlayer(botId)!;
    const currentCards = bot.hiddenCharacters;
    const allCards = [...currentCards, ...exchangeState.drawnCards];
    const keepCount = bot.aliveInfluenceCount;

    if (difficulty === 'easy') {
      // Easy: random selection
      const indices = allCards.map((_, i) => i);
      // Shuffle
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      return { type: 'choose_exchange', keepIndices: indices.slice(0, keepCount) };
    }

    if (difficulty === 'medium') {
      // Medium: static card value ranking
      const STATIC_VALUE: Record<Character, number> = {
        [Character.Duke]: 5,
        [Character.Assassin]: 4,
        [Character.Captain]: 3,
        [Character.Ambassador]: 2,
        [Character.Contessa]: 1,
      };
      const indexed = allCards.map((char, i) => ({ char, index: i, value: STATIC_VALUE[char] }));
      indexed.sort((a, b) => b.value - a.value);
      return { type: 'choose_exchange', keepIndices: indexed.slice(0, keepCount).map(x => x.index) };
    }

    // Hard: dynamic card value
    const indexed = allCards.map((char, i) => ({
      char,
      index: i,
      value: this.dynamicCardValue(char, game, botId),
    }));
    indexed.sort((a, b) => b.value - a.value);
    return { type: 'choose_exchange', keepIndices: indexed.slice(0, keepCount).map(x => x.index) };
  }
}
