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
    deckMemory?: Map<Character, number>,
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
        return this.decideActionChallenge(game, botId, difficulty, pendingAction, challengeState, deckMemory);

      case TurnPhase.AwaitingBlock:
        return this.decideBlock(game, botId, difficulty, pendingAction, blockPassedPlayerIds);

      case TurnPhase.AwaitingBlockChallenge:
        return this.decideBlockChallenge(game, botId, difficulty, pendingAction, pendingBlock, challengeState, deckMemory);

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
      case Character.Captain:
        // Best endgame card — Steal is a 4-coin swing, dominant in 1v1
        value = 6;
        if (aliveCount === 2) value += 2; // Absolute dominance in 1v1
        if (aliveCount === 3) value += 1; // Want Captain for eventual 2P
        break;

      case Character.Duke:
        // Tax is strong, especially early game
        value = 5;
        if (aliveCount > 3) value += 1; // Safe income source early
        if (aliveCount === 2) value -= 1; // Captain beats Duke in 1v1
        break;

      case Character.Assassin:
        // Cheap elimination
        value = 4;
        if (bot.coins < ASSASSINATE_COST) value -= 1; // Less useful without coins
        if (aliveCount === 2) value -= 1; // Weaker in 1v1 vs Captain/Duke
        break;

      case Character.Ambassador:
        // Exchange for better cards + blocks steal — A-tier early for hand improvement
        value = 2;
        if (aliveCount > 3) value += 2; // Very valuable early: exchange into Duke/Captain
        else if (aliveCount > 2 && !bot.hiddenCharacters.includes(Character.Captain)) value += 1;
        if (aliveCount <= 2) value -= 1; // Nearly useless in 1v1 (no offense)
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

    // 3P1L endgame coup logic for hard bots
    let skip3P1LCoup = false;
    if (difficulty === 'hard' && bot.coins >= COUP_COST) {
      const is3P1L = aliveCount === 3 && alivePlayers.every(p => p.aliveInfluenceCount === 1);
      if (is3P1L) {
        const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
        const isLeader = sortedByCoins[0].id === botId;
        const isLast = sortedByCoins[sortedByCoins.length - 1].id === botId;

        if (isLeader && Math.random() < 0.85) {
          // Leader should usually coup immediately — delaying gives runner-up time to reach 7
          return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, 'hard') };
        }
        if (isLast && Math.random() < 0.7) {
          // Underdog: usually delay couping to accumulate carefully
          skip3P1LCoup = true;
        }
      }
    }

    // Can afford coup — consider it based on difficulty
    if (bot.coins >= COUP_COST && !skip3P1LCoup) {
      if (difficulty === 'hard') {
        // Consider assassination over coup: 3 coins vs 7, more resource-efficient
        const ownedChars = bot.hiddenCharacters;
        const target = game.getPlayer(this.pickTarget(game, botId, 'hard'));
        const hasAssassin = ownedChars.includes(Character.Assassin);
        if (hasAssassin && target && target.aliveInfluenceCount === 1 && Math.random() < 0.5) {
          // Assassinate instead — save 4 coins, equally lethal vs 1-inf target
          return { type: 'action', action: ActionType.Assassinate, targetId: target.id };
        }
        // Otherwise coup at high probability
        if (Math.random() < 0.8) {
          return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, 'hard') };
        }
      } else {
        const coupProb = difficulty === 'medium' ? 0.65 : 0.4;
        if (Math.random() < coupProb) {
          return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, difficulty) };
        }
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
    const alivePlayers = game.getAlivePlayers();
    const dukeRevealed = revealed.get(Character.Duke) || 0;

    // Detect 3P1L endgame (3 players, all with 1 life)
    const is3P1L = aliveCount === 3 && alivePlayers.every(p => p.aliveInfluenceCount === 1);

    if (is3P1L) {
      const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
      const isLeader = sortedByCoins[0].id === botId;
      const isLast = sortedByCoins[sortedByCoins.length - 1].id === botId;

      if (isLeader && bot.coins >= COUP_COST && Math.random() < 0.85) {
        // Leader with 7+ should usually coup — target the runner-up
        return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, 'hard') };
      }

      if (isLeader && bot.coins < COUP_COST && Math.random() < 0.75) {
        // Leader below 7 — ANTI-TEMPO: slow down coin accumulation
        // Weighted pick still provides randomness in which slow action is chosen
        candidates.push({ action: ActionType.Income, weight: 5 });
        candidates.push({ action: ActionType.ForeignAid, weight: 2 });
        // Exchange to try for Captain (best endgame card)
        if (ownedCharacters.includes(Character.Ambassador)) {
          candidates.push({ action: ActionType.Exchange, weight: 6 });
        }
        // Low weight for high-gain actions
        if (ownedCharacters.includes(Character.Duke) || dukeRevealed < 2) {
          candidates.push({ action: ActionType.Tax, weight: 2 });
        }
        // "Waste" coins on assassination if we have 3+ coins
        if (bot.coins >= ASSASSINATE_COST) {
          const targetId = this.pickTarget(game, botId, 'hard');
          candidates.push({ action: ActionType.Assassinate, targetId, weight: 3 });
        }
        return this.weightedPick(candidates);
      }

      // If bot is the underdog (least coins) — best position, fall through to normal aggressive logic
    }

    // Bluff caution: at 1 influence, failed bluff = elimination
    const bluffMod = bot.aliveInfluenceCount === 1 ? 0.4 : 1.0;

    candidates.push({ action: ActionType.Income, weight: 1 });
    // Foreign Aid is weak — easily blocked by any Duke claim, especially early
    const faWeight = aliveCount > 3 ? 0.5 : aliveCount === 2 ? 1.5 : 1;
    candidates.push({ action: ActionType.ForeignAid, weight: faWeight });

    // Tax (Duke) — consensus best action, especially early game
    const hasDuke = ownedCharacters.includes(Character.Duke);
    if (hasDuke) {
      const weight = aliveCount > 3 ? 7 : 6; // Even stronger early (S-tier opener)
      candidates.push({ action: ActionType.Tax, weight });
    } else if (dukeRevealed < 2) {
      // Safe to bluff Duke if not many revealed — diffuse threat, rarely challenged early
      candidates.push({ action: ActionType.Tax, weight: 4 * bluffMod });
    }

    // Steal (Captain) — 4-coin swing, dominant in 1v1
    const stealTargets = alivePlayers.filter(p => p.id !== botId && p.coins > 0);
    if (stealTargets.length > 0) {
      const hasCaptain = ownedCharacters.includes(Character.Captain);
      const captainRevealed = revealed.get(Character.Captain) || 0;
      const targetId = this.pickTarget(game, botId, 'hard', stealTargets.map(p => p.id));
      if (hasCaptain) {
        const weight = aliveCount === 2 ? 8 : 5; // Dominant in 1v1
        candidates.push({ action: ActionType.Steal, targetId, weight });
      } else if (captainRevealed < 2) {
        const weight = aliveCount === 2 ? 5 : 3;
        candidates.push({ action: ActionType.Steal, targetId, weight: weight * bluffMod });
      }
    }

    // Assassinate — prioritize targets with 1 influence (they can't afford to challenge)
    if (bot.coins >= ASSASSINATE_COST) {
      const hasAssassin = ownedCharacters.includes(Character.Assassin);
      const assassinRevealed = revealed.get(Character.Assassin) || 0;
      const targetId = this.pickTarget(game, botId, 'hard');
      const target = game.getPlayer(targetId);
      // Assassination is more valuable against 1-influence targets
      const targetBonus = target && target.aliveInfluenceCount === 1 ? 2 : 0;
      if (hasAssassin) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 5 + targetBonus });
      } else if (assassinRevealed < 2) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: (3 + targetBonus) * bluffMod });
      }
    }

    // Exchange (Ambassador) — safest bluff in the game, almost never challenged
    const hasAmbassador = ownedCharacters.includes(Character.Ambassador);
    const ambassadorRevealed = revealed.get(Character.Ambassador) || 0;
    if (hasAmbassador) {
      const weight = aliveCount <= 2 ? 1 : 3;
      candidates.push({ action: ActionType.Exchange, weight });
    } else if (aliveCount > 2 && ambassadorRevealed < 2) {
      // Bluff Ambassador for hand improvement — near-zero challenge risk
      // More valuable with a weak hand (no Duke or Captain)
      const hasStrongCard = ownedCharacters.includes(Character.Duke) || ownedCharacters.includes(Character.Captain);
      const weight = hasStrongCard ? 1 : 2.5;
      candidates.push({ action: ActionType.Exchange, weight: weight * bluffMod });
    }

    return this.weightedPick(candidates);
  }

  // ─── Challenge Decision ───

  private static decideActionChallenge(
    game: Game,
    botId: string,
    difficulty: BotDifficulty,
    pendingAction: PendingAction | null,
    challengeState: ChallengeState | null,
    deckMemory?: Map<Character, number>,
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
    const knownInDeckCount = deckMemory?.get(claimedChar) || 0;
    const accountedFor = revealedCount + botHoldsCount + knownInDeckCount;

    // Never challenge assassination when we have 2 influences (too risky — can lose both)
    if (pendingAction.type === ActionType.Assassinate && pendingAction.targetId === botId) {
      if (bot.aliveInfluenceCount >= 2) {
        return { type: 'pass_challenge' };
      }
    }

    // "Hail Mary" challenge — if we're the target and down to 1 influence,
    // a failed challenge costs us what we'd lose anyway, so be more aggressive
    const isDesperateTarget = pendingAction.targetId === botId && bot.aliveInfluenceCount === 1;

    // If all copies are accounted for, 100% challenge (guaranteed catch)
    if (accountedFor >= CARDS_PER_CHARACTER) {
      return { type: 'challenge' };
    }

    // Early game: less information available, less reason to challenge
    const earlyGameMod = game.turnNumber <= 2 ? 0.3 : game.turnNumber <= 4 ? 0.6 : 1.0;

    // At 1 influence, be more cautious with challenges (elimination risk)
    // unless we're the target (desperate = nothing to lose)
    const isNonTarget = pendingAction.targetId !== botId;
    // Non-targets with 1 influence should almost never challenge — risking elimination to help someone else
    const cautionMod = (bot.aliveInfluenceCount === 1)
      ? (isDesperateTarget ? 1.0 : isNonTarget ? 0.1 : 0.6)
      : 1.0;
    // Desperation boost when we're about to lose influence anyway
    const desperationBoost = isDesperateTarget ? 0.15 : 0;

    // If 2+ copies accounted for, high challenge rate
    if (accountedFor >= 2) {
      const prob = Math.min(0.7 * cautionMod * earlyGameMod + desperationBoost, 0.85);
      return Math.random() < prob ? { type: 'challenge' } : { type: 'pass_challenge' };
    }

    // If bot holds a copy, moderate challenge rate
    if (botHoldsCount > 0) {
      const prob = Math.min(0.4 * cautionMod * earlyGameMod + desperationBoost, 0.7);
      return Math.random() < prob ? { type: 'challenge' } : { type: 'pass_challenge' };
    }

    // Otherwise low challenge rate — but boost if desperate (nothing to lose)
    const baseProb = 0.1 * cautionMod * earlyGameMod + desperationBoost;
    return Math.random() < baseProb ? { type: 'challenge' } : { type: 'pass_challenge' };
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
    if (!bot.isAlive) return null;

    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (def.blockedBy.length === 0) return { type: 'pass_block' };

    // Only the target can block targeted actions (Steal, Assassinate)
    const isTarget = pendingAction.targetId === botId;
    if (pendingAction.targetId && !isTarget) return { type: 'pass_block' };

    // Hard bot 3P1L anti-tempo: leader usually lets Foreign Aid through to distribute leader burden
    if (difficulty === 'hard' && pendingAction.type === ActionType.ForeignAid) {
      const alivePlayers = game.getAlivePlayers();
      const aliveCount = alivePlayers.length;
      const is3P1L = aliveCount === 3 && alivePlayers.every(p => p.aliveInfluenceCount === 1);
      if (is3P1L) {
        const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
        if (sortedByCoins[0].id === botId && Math.random() < 0.7) {
          return { type: 'pass_block' };
        }
      }
    }

    for (const blockChar of def.blockedBy) {
      const hasCard = bot.hiddenCharacters.includes(blockChar);

      if (hasCard) {
        // All tiers: always block when holding the card and targeted
        if (isTarget) return { type: 'block', character: blockChar };
        // Hard bots: almost always block Foreign Aid with Duke (it's free)
        if (difficulty === 'hard') {
          if (Math.random() < 0.9) return { type: 'block', character: blockChar };
        } else {
          // Easy/Medium: block Foreign Aid with some probability
          if (Math.random() < 0.6) return { type: 'block', character: blockChar };
        }
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
          // Contessa bluff vs assassination — weakly dominant at 2 influences (always bluff),
          // but at 1 influence being caught = elimination, so reduce to ~65%
          const contessaBluffProb = bot.aliveInfluenceCount >= 2 ? 0.95 : 0.65;
          if (Math.random() < contessaBluffProb) return { type: 'block', character: blockChar };
          continue;
        }

        if (isTarget) {
          // Bluff block if not too many copies revealed
          // At 1 influence, be more cautious with bluff blocks
          if (revealedCount < 2) {
            const prob = bot.aliveInfluenceCount === 1 ? 0.35 : 0.6;
            if (Math.random() < prob) return { type: 'block', character: blockChar };
          }
        } else {
          // Foreign aid Duke block — bluff to establish Duke claim for future Tax
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
    deckMemory?: Map<Character, number>,
  ): BotDecision | null {
    if (!pendingAction || !pendingBlock || !challengeState) return null;
    // Already passed (pre-passed by ActionResolver or previously acted)? Nothing to do.
    if (challengeState.passedPlayerIds.includes(botId)) return null;
    // Non-actor bots must actively pass so the phase resolves promptly
    if (pendingAction.actorId !== botId) return { type: 'pass_challenge_block' };

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
    const knownInDeckCount = deckMemory?.get(blockerClaimedChar) || 0;
    const accountedFor = revealedCount + botHoldsCount + knownInDeckCount;

    // At 1 influence, challenging a block is risky (lose = elimination)
    const cautionMod = bot.aliveInfluenceCount === 1 ? 0.7 : 1.0;

    if (accountedFor >= CARDS_PER_CHARACTER) {
      return { type: 'challenge_block' };
    }

    if (accountedFor >= 2) {
      return Math.random() < 0.6 * cautionMod ? { type: 'challenge_block' } : { type: 'pass_challenge_block' };
    }

    // If our action cost coins, more incentive to challenge the block
    const costDef = ACTION_DEFINITIONS[pendingAction.type];
    if (costDef.cost > 0 && Math.random() < 0.3 * cautionMod) {
      return { type: 'challenge_block' };
    }

    return Math.random() < 0.1 * cautionMod ? { type: 'challenge_block' } : { type: 'pass_challenge_block' };
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
