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
        // Strong endgame card — Steal is a 4-coin swing, dominant in 1v1
        // But winners succeed with any card; don't over-concentrate on Captain
        value = 5;
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
        value = 3;
        if (bot.coins < ASSASSINATE_COST) value -= 1; // Less useful without coins
        if (aliveCount === 2) value -= 1; // Weaker in 1v1 vs Captain/Duke
        break;

      case Character.Ambassador:
        // Exchange for better cards + blocks steal — valuable defensive utility
        // Winners protect Ambassador (14% sacrifice rate vs our 22%)
        value = 3;
        if (aliveCount > 3) value += 2; // Very valuable early: exchange into better cards
        else if (aliveCount > 2 && !bot.hiddenCharacters.includes(Character.Captain)) value += 1;
        if (aliveCount <= 2) value -= 1; // Nearly useless in 1v1 (no offense)
        break;

      case Character.Contessa:
        // Blocks assassination — winners hold Contessa 20.4% vs our 11.5%
        // Having real Contessa is far better than bluffing it
        value = 3;
        // More valuable when opponents have 3+ coins (assassination threat)
        const opponentsWithCoins = alivePlayers.filter(p => p.id !== botId && p.coins >= ASSASSINATE_COST);
        if (opponentsWithCoins.length > 0) value += 2;
        if (aliveCount === 2) value -= 1; // Less useful in 1v1 (Captain/Duke better)
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

  /**
   * Analyze action log to find which alive opponents have demonstrated
   * having specific characters (via successful blocks or unchallenged claims).
   * Used by hard bots to avoid repeatedly blocked actions.
   */
  private static getDemonstratedCharacters(game: Game, botId: string): Map<string, Set<Character>> {
    const demonstrated = new Map<string, Set<Character>>();
    const log = game.actionLog;

    const addDemo = (playerId: string, char: Character) => {
      if (playerId === botId) return;
      if (!demonstrated.has(playerId)) demonstrated.set(playerId, new Set());
      demonstrated.get(playerId)!.add(char);
    };

    for (let i = 0; i < log.length; i++) {
      const entry = log[i];

      // Track successful blocks (unchallenged or proven honest)
      if (entry.eventType === 'block' && entry.actorId && entry.character) {
        for (let j = i + 1; j < log.length; j++) {
          const o = log[j];
          if (o.eventType === 'block_unchallenged' || o.eventType === 'block_challenge_fail') {
            addDemo(entry.actorId, entry.character);
            break;
          }
          if (o.eventType === 'block_challenge_success') break;
          if (o.eventType === 'turn_start') break;
        }
      }

      // Track unchallenged or proven action claims
      if (entry.eventType === 'claim_action' && entry.actorId && entry.character) {
        for (let j = i + 1; j < log.length; j++) {
          const o = log[j];
          if (o.eventType === 'challenge_success') break;
          if (o.eventType === 'challenge_fail') {
            addDemo(entry.actorId, entry.character);
            break;
          }
          if (o.eventType === 'action_resolve' || o.eventType === 'block' || o.eventType === 'turn_start') {
            addDemo(entry.actorId, entry.character);
            break;
          }
        }
      }
    }

    // Only keep alive players
    for (const playerId of [...demonstrated.keys()]) {
      const player = game.getPlayer(playerId);
      if (!player || !player.isAlive) demonstrated.delete(playerId);
    }

    return demonstrated;
  }

  /**
   * Determine the bot's established bluff identity — a character it has
   * successfully claimed (bluffed) without being caught. Treason data shows
   * real winners persist with their bluffed identity ~30-50% of the time, so
   * hard bots should strongly prefer re-claiming established characters.
   *
   * Also tracks "burnt" characters the bot was caught bluffing — these
   * should never be bluffed again.
   */
  private static getBluffIdentity(
    game: Game, botId: string, ownedCharacters: Character[],
  ): { established: Character | null; burnt: Set<Character> } {
    const log = game.actionLog;
    let established: Character | null = null;
    const burnt = new Set<Character>();

    for (let i = 0; i < log.length; i++) {
      const entry = log[i];
      if (entry.actorId !== botId) continue;

      // Track action claims (claim_action)
      if (entry.eventType === 'claim_action' && entry.character) {
        let wasCaught = false;
        let unchallenged = false;
        for (let j = i + 1; j < log.length; j++) {
          const next = log[j];
          if (next.eventType === 'challenge_success') {
            wasCaught = true;
            break;
          }
          if (next.eventType === 'challenge_fail') break; // bot proved honest
          if (next.eventType === 'action_resolve' || next.eventType === 'block' || next.eventType === 'turn_start') {
            unchallenged = true;
            break;
          }
        }

        if (wasCaught) {
          burnt.add(entry.character);
          if (established === entry.character) established = null;
        } else if (unchallenged && !ownedCharacters.includes(entry.character)) {
          established = entry.character;
        }
      }

      // Track block claims (block)
      if (entry.eventType === 'block' && entry.character) {
        let wasCaught = false;
        let unchallenged = false;
        for (let j = i + 1; j < log.length; j++) {
          const next = log[j];
          if (next.eventType === 'block_challenge_success') {
            wasCaught = true;
            break;
          }
          if (next.eventType === 'block_challenge_fail') break;
          if (next.eventType === 'block_unchallenged' || next.eventType === 'action_resolve' || next.eventType === 'turn_start') {
            unchallenged = true;
            break;
          }
        }

        if (wasCaught) {
          burnt.add(entry.character);
          if (established === entry.character) established = null;
        } else if (unchallenged && !ownedCharacters.includes(entry.character)) {
          established = entry.character;
        }
      }
    }

    return { established, burnt };
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

    // Hard bot endgame coup logic
    let skip3P1LCoup = false;
    if (difficulty === 'hard' && bot.coins >= COUP_COST) {
      // 1v1 with both at 1 influence — coup is a guaranteed win, always take it
      if (aliveCount === 2 && alivePlayers.every(p => p.aliveInfluenceCount === 1)) {
        return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, 'hard') };
      }

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
        const coupProb = difficulty === 'medium' ? (aliveCount <= 3 ? 0.8 : 0.65) : 0.4;
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
      return this.decideActionMedium(game, botId, bot, ownedCharacters, candidates, aliveCount);
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
    aliveCount: number,
  ): BotDecision {
    // Medium: slight preference for Tax/Steal, 20% bluff chance
    const incomeWeight = aliveCount <= 3 ? 0.5 : 1;
    candidates.push({ action: ActionType.Income, weight: incomeWeight });
    candidates.push({ action: ActionType.ForeignAid, weight: 2 });

    const hasDuke = ownedCharacters.includes(Character.Duke);
    if (hasDuke) {
      candidates.push({ action: ActionType.Tax, weight: 5 });
    } else if (Math.random() < 0.2) {
      candidates.push({ action: ActionType.Tax, weight: 2 });
    }

    const stealTargets = game.getAlivePlayers().filter(p => p.id !== botId && p.coins > 0);
    if (stealTargets.length > 0) {
      const hasCaptain = ownedCharacters.includes(Character.Captain);
      const targetId = this.pickTarget(game, botId, 'medium', stealTargets.map(p => p.id));
      if (hasCaptain) {
        candidates.push({ action: ActionType.Steal, targetId, weight: 4 });
      } else if (Math.random() < 0.2) {
        candidates.push({ action: ActionType.Steal, targetId, weight: 2 });
      }
    }

    if (bot.coins >= ASSASSINATE_COST) {
      const hasAssassin = ownedCharacters.includes(Character.Assassin);
      const targetId = this.pickTarget(game, botId, 'medium');
      if (hasAssassin) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 4 });
      } else if (Math.random() < 0.15) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: 1.5 });
      }
    }

    const hasAmbassador = ownedCharacters.includes(Character.Ambassador);
    if (hasAmbassador) {
      candidates.push({ action: ActionType.Exchange, weight: 2 });
    } else if (Math.random() < 0.25) {
      candidates.push({ action: ActionType.Exchange, weight: 1 });
    }

    return this.weightedPick(candidates);
  }

  private static decideActionHard(
    game: Game, botId: string, bot: any, ownedCharacters: Character[],
    candidates: Array<{ action: ActionType; targetId?: string; weight: number }>,
    aliveCount: number,
  ): BotDecision {
    // Hard: strategic, bluffs selectively, persists with established identities
    const revealed = this.countRevealedCharacters(game);
    const alivePlayers = game.getAlivePlayers();
    const dukeRevealed = revealed.get(Character.Duke) || 0;

    // Learn from opponents' demonstrated characters (successful blocks + unchallenged claims)
    const demonstrated = this.getDemonstratedCharacters(game, botId);

    // Bluff persistence: track established identity and burnt characters
    const { established, burnt } = this.getBluffIdentity(game, botId, ownedCharacters);

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
        candidates.push({ action: ActionType.Income, weight: 5 });
        candidates.push({ action: ActionType.ForeignAid, weight: 2 });
        if (ownedCharacters.includes(Character.Ambassador)) {
          candidates.push({ action: ActionType.Exchange, weight: 6 });
        }
        if (ownedCharacters.includes(Character.Duke) || dukeRevealed < 2) {
          candidates.push({ action: ActionType.Tax, weight: 2 });
        }
        if (bot.coins >= ASSASSINATE_COST) {
          const targetId = this.pickTarget(game, botId, 'hard');
          candidates.push({ action: ActionType.Assassinate, targetId, weight: 3 });
        }
        return this.weightedPick(candidates);
      }

      // If bot is the underdog (least coins) — best position, fall through to normal aggressive logic
    }

    // Bluff caution: at 1 influence, failed bluff = elimination
    // In 1v1, both players are at 1 inf — being passive is worse than bluffing
    const bluffMod = bot.aliveInfluenceCount === 1
      ? (aliveCount === 2 ? 0.7 : 0.4)
      : 1.0;

    // Bluff persistence: if the bot has an established bluff identity,
    // strongly prefer re-claiming it and penalize switching characters.
    // Treason winners persist with their bluffed character ~30-50% of the time.
    const persistBoost = 3.5;
    // Switch penalty only applies in early/mid game (4+ alive) where multiple observers
    // track consistency. In endgame (2-3 alive), flexibility matters more.
    const switchPenalty = (established && aliveCount > 3) ? 0.3 : 1.0;

    // Income: useful early, weak in endgame (1 coin/turn falls behind Tax/Steal)
    // In 1v1, Income is especially bad — passivity lets the opponent reach 7 first
    const incomeWeight = aliveCount === 2 ? 0.5 : aliveCount > 3 ? 1.5 : 1;
    candidates.push({ action: ActionType.Income, weight: incomeWeight });
    // Foreign Aid: weak early (easily Duke-blocked), but safer in 3P1L (no claim to challenge)
    let faWeight = aliveCount > 3 ? 0.5 : aliveCount === 2 ? 1.5 : 1;
    // Heavily reduce if any alive opponent has demonstrated Duke (via block or Tax claim)
    const aliveDukeCount = alivePlayers.filter(p =>
      p.id !== botId && demonstrated.get(p.id)?.has(Character.Duke)).length;
    const faDemoMod = aliveDukeCount > 0 ? 0.15 : 1.0;
    faWeight *= faDemoMod;
    // In 3P1L, non-leaders boost FA — treason winners use FA at 19% in 3P1L
    // Applied after faDemoMod since the anti-tempo leader usually lets FA through anyway
    if (is3P1L) {
      const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
      if (sortedByCoins[0].id !== botId) faWeight = Math.max(faWeight, 2.5);
    }
    candidates.push({ action: ActionType.ForeignAid, weight: faWeight });

    // Tax (Duke) — consensus best action, especially early game
    const hasDuke = ownedCharacters.includes(Character.Duke);
    if (hasDuke) {
      const weight = aliveCount > 3 ? 7 : 6; // Even stronger early (S-tier opener)
      candidates.push({ action: ActionType.Tax, weight });
    } else if (dukeRevealed < 2 && !burnt.has(Character.Duke)) {
      // Bluff Duke — boosted if established identity, penalized if switching
      // In 1v1, Tax bluff is stronger: +3 coins/turn, passivity = death
      let weight = aliveCount === 2 ? 3 : 1.5;
      if (established === Character.Duke) weight *= persistBoost;
      else weight *= switchPenalty;
      candidates.push({ action: ActionType.Tax, weight: weight * bluffMod });
    }

    // Steal (Captain) — 4-coin swing, dominant in 1v1
    const stealTargets = alivePlayers.filter(p => p.id !== botId && p.coins > 0);
    if (stealTargets.length > 0) {
      const hasCaptain = ownedCharacters.includes(Character.Captain);
      const captainRevealed = revealed.get(Character.Captain) || 0;
      // Prefer targets who haven't demonstrated steal-blocking (Captain/Ambassador)
      const unblockedStealTargets = stealTargets.filter(p => {
        const demo = demonstrated.get(p.id);
        return !demo || (!demo.has(Character.Captain) && !demo.has(Character.Ambassador));
      });
      const effectiveTargets = unblockedStealTargets.length > 0 ? unblockedStealTargets : stealTargets;
      const targetId = this.pickTarget(game, botId, 'hard', effectiveTargets.map(p => p.id));
      // Reduce weight if all steal targets have demonstrated blocking
      const stealDemoMod = unblockedStealTargets.length > 0 ? 1.0 : 0.25;
      if (hasCaptain) {
        const weight = aliveCount === 2 ? 8 : (aliveCount > 3 ? 3.5 : 5);
        candidates.push({ action: ActionType.Steal, targetId, weight: weight * stealDemoMod });
      } else if (captainRevealed < 2 && !burnt.has(Character.Captain)) {
        let weight = aliveCount === 2 ? 2 : 1;
        if (established === Character.Captain) weight *= persistBoost;
        else weight *= switchPenalty;
        candidates.push({ action: ActionType.Steal, targetId, weight: weight * bluffMod * stealDemoMod });
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
      } else if (assassinRevealed < 2 && !burnt.has(Character.Assassin)) {
        // No targetBonus for bluffs: the 3-coin risk doesn't change with target health
        let weight = 1;
        if (established === Character.Assassin) weight *= persistBoost;
        else weight *= switchPenalty;
        candidates.push({ action: ActionType.Assassinate, targetId, weight: weight * bluffMod });
      }
    }

    // Exchange (Ambassador) — safest bluff in the game, almost never challenged
    const hasAmbassador = ownedCharacters.includes(Character.Ambassador);
    const ambassadorRevealed = revealed.get(Character.Ambassador) || 0;
    if (hasAmbassador) {
      const weight = aliveCount <= 2 ? 1 : (aliveCount > 3 ? 4 : 3);
      candidates.push({ action: ActionType.Exchange, weight });
    } else if (aliveCount > 2 && ambassadorRevealed < 2 && !burnt.has(Character.Ambassador)) {
      // Bluff Ambassador for hand improvement — near-zero challenge risk
      const hasStrongCard = ownedCharacters.includes(Character.Duke) || ownedCharacters.includes(Character.Captain);
      let weight = hasStrongCard ? 0.5 : 1.5;
      if (established === Character.Ambassador) weight *= persistBoost;
      else weight *= switchPenalty;
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
      // Medium: 10% base challenge rate
      // Never challenge assassination when we have 2 influences (too risky)
      if (pendingAction.type === ActionType.Assassinate && pendingAction.targetId === botId) {
        if (bot.aliveInfluenceCount >= 2) {
          return { type: 'pass_challenge' };
        }
      }

      let challengeProb = 0.10;
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

    const alivePlayers = game.getAlivePlayers();
    const aliveCount = alivePlayers.length;

    // 1v1 endgame desperation: if letting this action through means the opponent
    // reaches 7+ coins (guaranteed coup win) and we can't win on our next turn,
    // challenging is our only chance to survive
    if (aliveCount === 2 && bot.aliveInfluenceCount === 1) {
      const opponent = alivePlayers.find(p => p.id !== botId)!;
      let opponentCoinsAfter = opponent.coins;
      if (pendingAction.type === ActionType.Tax) opponentCoinsAfter += 3;
      else if (pendingAction.type === ActionType.Steal) opponentCoinsAfter += Math.min(2, bot.coins);

      const opponentCanCoupNext = opponentCoinsAfter >= COUP_COST;
      const canCoupNext = bot.coins >= COUP_COST;
      const canAssassinateNext = bot.coins >= ASSASSINATE_COST;
      const canWinNext = canCoupNext || canAssassinateNext;

      if (opponentCanCoupNext && !canWinNext) {
        return { type: 'challenge' };
      }
    }

    // If all copies are accounted for, 100% challenge (guaranteed catch)
    if (accountedFor >= CARDS_PER_CHARACTER) {
      return { type: 'challenge' };
    }

    // Early game: less information available, less reason to challenge
    const earlyGameMod = game.turnNumber <= 2 ? 0.3 : game.turnNumber <= 4 ? 0.6 : 1.0;

    // At 1 influence, be more cautious with challenges (elimination risk)
    // unless we're the target (desperate = nothing to lose)
    // In a 1v1 there is no third party, so the non-target penalty doesn't apply
    const isNonTarget = pendingAction.targetId !== botId && aliveCount > 2;
    // Non-targets with 1 influence should almost never challenge — risking elimination to help someone else
    const cautionMod = (bot.aliveInfluenceCount === 1)
      ? (isDesperateTarget ? 1.0 : isNonTarget ? 0.1 : 0.6)
      : 1.0;
    // Desperation boost when we're about to lose influence anyway
    const desperationBoost = isDesperateTarget ? 0.15 : 0;

    // If 2+ copies accounted for, high challenge rate
    if (accountedFor >= 2) {
      const prob = Math.min(0.65 * cautionMod * earlyGameMod + desperationBoost, 0.85);
      return Math.random() < prob ? { type: 'challenge' } : { type: 'pass_challenge' };
    }

    // If bot holds a copy, moderate challenge rate
    // Winners challenge less often but succeed 76% — be more selective
    if (botHoldsCount > 0) {
      const prob = Math.min(0.3 * cautionMod * earlyGameMod + desperationBoost, 0.6);
      return Math.random() < prob ? { type: 'challenge' } : { type: 'pass_challenge' };
    }

    // Otherwise very low challenge rate — winners don't speculate
    const baseProb = 0.05 * cautionMod * earlyGameMod + desperationBoost;
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
            // 30% bluff Contessa vs assassination
            if (Math.random() < 0.3) return { type: 'block', character: blockChar };
          } else if (isTarget) {
            // 12% bluff other blocks when targeted
            if (Math.random() < 0.12) return { type: 'block', character: blockChar };
          } else {
            // 5% bluff Duke block on foreign aid
            if (Math.random() < 0.05) return { type: 'block', character: blockChar };
          }
          continue;
        }

        // Hard: strategic bluff blocking
        const revealed = this.countRevealedCharacters(game);
        const revealedCount = revealed.get(blockChar) || 0;

        if (isTarget && blockChar === Character.Contessa && pendingAction.type === ActionType.Assassinate) {
          // Winners bluff Contessa only ~4% of the time — they actually hold it.
          // Bluff occasionally but not as a default strategy.
          const contessaBluffProb = bot.aliveInfluenceCount >= 2 ? 0.25 : 0.15;
          if (Math.random() < contessaBluffProb) return { type: 'block', character: blockChar };
          continue;
        }

        if (isTarget) {
          // Winners bluff-block ~10% — only bluff when desperate
          if (revealedCount < 2) {
            const prob = bot.aliveInfluenceCount === 1 ? 0.10 : 0.15;
            if (Math.random() < prob) return { type: 'block', character: blockChar };
          }
        } else {
          // Foreign aid Duke block — rarely bluff (winners bluff Duke blocks ~5%)
          if (revealedCount < 2 && Math.random() < 0.08) {
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
      // Medium: 10% base challenge rate for blocks
      let challengeProb = 0.10;
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
    if (costDef.cost > 0 && Math.random() < 0.15 * cautionMod) {
      return { type: 'challenge_block' };
    }

    return Math.random() < 0.05 * cautionMod ? { type: 'challenge_block' } : { type: 'pass_challenge_block' };
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
        [Character.Captain]: 4,
        [Character.Assassin]: 3,
        [Character.Contessa]: 3,
        [Character.Ambassador]: 2,
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
        [Character.Captain]: 4,
        [Character.Assassin]: 3,
        [Character.Contessa]: 3,
        [Character.Ambassador]: 2,
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
