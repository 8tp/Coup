import {
  ActionType,
  Character,
  ExamineState,
  PersonalityParams,
  TurnPhase,
  PendingAction,
  PendingBlock,
  ChallengeState,
  InfluenceLossRequest,
  ExchangeState,
  LogEntry,
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
  | { type: 'choose_exchange'; keepIndices: number[] }
  | { type: 'examine_decision'; forceSwap: boolean }
  | { type: 'convert'; targetId?: string };

/**
 * BotBrain — Pure decision logic for AI players.
 * No I/O, no timers. Only reads the bot's own cards and publicly revealed cards.
 *
 * All bots use a personality-parameterized system with card counting,
 * bluff persistence, and demonstrated character tracking.
 */
export class BotBrain {

  /**
   * Given the current game state, determine what the bot should do.
   * Returns null if the bot has nothing to do in this phase.
   */
  static decide(
    game: Game,
    botId: string,
    personality: PersonalityParams,
    pendingAction: PendingAction | null,
    pendingBlock: PendingBlock | null,
    challengeState: ChallengeState | null,
    influenceLossRequest: InfluenceLossRequest | null,
    exchangeState: ExchangeState | null,
    blockPassedPlayerIds: string[],
    deckMemory?: Map<Character, number>,
    examineState?: ExamineState | null,
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
        return this.decideActionChallenge(game, botId, personality, pendingAction, challengeState, deckMemory);

      case TurnPhase.AwaitingBlock:
        return this.decideBlock(game, botId, personality, pendingAction, blockPassedPlayerIds);

      case TurnPhase.AwaitingBlockChallenge:
        return this.decideBlockChallenge(game, botId, personality, pendingAction, pendingBlock, challengeState, deckMemory);

      case TurnPhase.AwaitingInfluenceLoss:
        if (influenceLossRequest?.playerId === botId) {
          return this.decideInfluenceLoss(game, botId, personality);
        }
        return null;

      case TurnPhase.AwaitingExchange:
        if (exchangeState?.playerId === botId) {
          return this.decideExchange(game, botId, personality, exchangeState);
        }
        return null;

      case TurnPhase.AwaitingExamineDecision:
        if (examineState?.examinerId === botId) {
          return this.decideExamine(game, botId, personality, examineState);
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
   * Context-aware card ranking. Factors in game state.
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
        value = 5;
        if (aliveCount === 2) value += 2;
        if (aliveCount === 3) value += 1;
        break;

      case Character.Duke:
        // Tax is strong, especially early game
        value = 5;
        if (aliveCount > 3) value += 1;
        if (aliveCount === 2) value -= 1;
        break;

      case Character.Assassin:
        // Cheap elimination
        value = 3;
        if (bot.coins < ASSASSINATE_COST) value -= 1;
        if (aliveCount === 2) value -= 1;
        break;

      case Character.Ambassador:
      case Character.Inquisitor:
        // Exchange for better cards + blocks steal; Inquisitor also examines
        value = 3;
        if (character === Character.Inquisitor) value += 1; // Examine is powerful
        if (aliveCount > 3) value += 2;
        else if (aliveCount > 2 && !bot.hiddenCharacters.includes(Character.Captain)) value += 1;
        if (aliveCount <= 2) value -= 1;
        break;

      case Character.Contessa:
        // Blocks assassination
        value = 3;
        const opponentsWithCoins = alivePlayers.filter(p => p.id !== botId && p.coins >= ASSASSINATE_COST);
        if (opponentsWithCoins.length > 0) value += 2;
        if (aliveCount === 2) value -= 1;
        break;
    }

    // Reduce value if most copies are revealed
    const revealedCount = revealed.get(character) || 0;
    if (revealedCount >= 2) value -= 1;

    return value;
  }

  /**
   * Dynamic card value with personality spread modifier.
   * spread > 1 steepens differences (analytical/aggressive prefer specific cards).
   * spread < 1 flattens (conservative less opinionated about cards).
   */
  static dynamicCardValueWithSpread(character: Character, game: Game, botId: string, spread: number): number {
    const baseValue = this.dynamicCardValue(character, game, botId);
    const mean = 4;
    return mean + (baseValue - mean) * spread;
  }

  /**
   * Pick a target with personality-driven composite scoring.
   * Blends leader bias, revenge weight, and randomness.
   */
  private static pickTarget(
    game: Game,
    botId: string,
    personality: PersonalityParams,
    candidateIds?: string[],
    forCoup: boolean = false,
  ): string {
    let candidates = game.getAlivePlayers().filter(p => p.id !== botId);
    if (candidateIds) {
      candidates = candidates.filter(p => candidateIds.includes(p.id));
    }
    // Faction restriction: can't target same faction (unless all same faction)
    if (game.gameMode === 'Reformation' && !game.allSameFaction()) {
      const bot = game.getPlayer(botId);
      const factionFiltered = candidates.filter(p => p.faction !== bot?.faction);
      if (factionFiltered.length > 0) {
        candidates = factionFiltered;
      }
    }
    if (candidates.length === 0) return '';
    if (candidates.length === 1) return candidates[0].id;

    const revengeScores = this.getRevengeScores(game, botId);
    const maxCoins = Math.max(...candidates.map(p => p.coins));

    // Score each candidate
    const scored = candidates.map(p => {
      let score = 1.0; // base randomness

      // Leader bias: prefer high-coin players
      const leaderScore = maxCoins > 0 ? p.coins / maxCoins : 0;
      score += leaderScore * personality.leaderBias * 3;

      // Revenge weight: prefer recent attackers
      const revenge = revengeScores.get(p.id) || 0;
      score += revenge * personality.revengeWeight * 4;

      // For coups, prefer targets with more lives
      if (forCoup) {
        score += p.aliveInfluenceCount * 0.5;
      }

      // Small random jitter
      score += Math.random() * 0.5;

      return { id: p.id, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].id;
  }

  /**
   * Analyze action log to find which alive opponents have demonstrated
   * having specific characters (via successful blocks or unchallenged claims).
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
   * successfully claimed (bluffed) without being caught.
   *
   * Also tracks "burnt" characters the bot was caught bluffing.
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
          if (next.eventType === 'challenge_fail') break;
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

  /**
   * Scan the last ~20 action log entries for attacks against this bot.
   * Returns a map of attacker ID → revenge score, weighted by recency.
   */
  static getRevengeScores(game: Game, botId: string): Map<string, number> {
    const scores = new Map<string, number>();
    const log = game.actionLog;
    const start = Math.max(0, log.length - 20);

    for (let i = start; i < log.length; i++) {
      const entry = log[i];
      if (!entry.actorId || entry.actorId === botId) continue;

      let isHostile = false;

      // Targeted actions against us
      if (entry.targetId === botId) {
        const isTargetedAction =
          entry.eventType === 'claim_action' ||
          entry.eventType === 'declare_action' ||
          entry.eventType === 'action_resolve' ||
          entry.eventType === 'assassination' ||
          entry.eventType === 'coup';
        if (isTargetedAction) isHostile = true;
      }

      // Successful challenges against us
      if (entry.targetId === botId &&
          (entry.eventType === 'challenge_success' || entry.eventType === 'block_challenge_success')) {
        isHostile = true;
      }

      if (isHostile) {
        const recency = (i - start) / Math.max(1, log.length - start - 1);
        const weight = 0.25 + 0.75 * recency;
        const current = scores.get(entry.actorId) || 0;
        scores.set(entry.actorId, current + weight);
      }
    }

    return scores;
  }

  // ─── Action Selection ───

  private static decideAction(
    game: Game, botId: string, personality: PersonalityParams,
  ): BotDecision {
    const bot = game.getPlayer(botId)!;
    const alivePlayers = game.getAlivePlayers();
    const aliveCount = alivePlayers.length;

    // Must coup at 10+ coins
    if (bot.coins >= FORCED_COUP_THRESHOLD) {
      return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, personality, undefined, true) };
    }

    // Endgame coup logic
    let skip3P1LCoup = false;
    if (bot.coins >= COUP_COST) {
      // 1v1 with both at 1 influence — coup is a guaranteed win
      if (aliveCount === 2 && alivePlayers.every(p => p.aliveInfluenceCount === 1)) {
        return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, personality, undefined, true) };
      }

      const is3P1L = aliveCount === 3 && alivePlayers.every(p => p.aliveInfluenceCount === 1);
      if (is3P1L) {
        const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
        const isLeader = sortedByCoins[0].id === botId;
        const isLast = sortedByCoins[sortedByCoins.length - 1].id === botId;
        if (isLeader && Math.random() < 0.85) {
          return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, personality, undefined, true) };
        }
        if (isLast && Math.random() < 0.7) {
          skip3P1LCoup = true;
        }
      }
    }

    // Consider coup if affordable
    if (bot.coins >= COUP_COST && !skip3P1LCoup) {
      const ownedChars = bot.hiddenCharacters;
      const target = game.getPlayer(this.pickTarget(game, botId, personality));
      const hasAssassin = ownedChars.includes(Character.Assassin);
      if (hasAssassin && target && target.aliveInfluenceCount === 1 && Math.random() < 0.5) {
        return { type: 'action', action: ActionType.Assassinate, targetId: target.id };
      }
      if (Math.random() < 0.8) {
        return { type: 'action', action: ActionType.Coup, targetId: this.pickTarget(game, botId, personality, undefined, true) };
      }
    }

    const ownedCharacters = bot.hiddenCharacters;
    const candidates: Array<{ action: ActionType; targetId?: string; weight: number }> = [];

    // Card counting, bluff persistence, demonstrated chars
    const revealed = this.countRevealedCharacters(game);
    const demonstrated = this.getDemonstratedCharacters(game, botId);
    const { established, burnt } = this.getBluffIdentity(game, botId, ownedCharacters);

    // Detect 3P1L endgame
    const is3P1L = aliveCount === 3 && alivePlayers.every(p => p.aliveInfluenceCount === 1);

    if (is3P1L) {
      const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
      const isLeader = sortedByCoins[0].id === botId;
      const dukeRevealed = revealed.get(Character.Duke) || 0;

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
          const targetId = this.pickTarget(game, botId, personality);
          candidates.push({ action: ActionType.Assassinate, targetId, weight: 3 });
        }
        return this.weightedPick(candidates);
      }
    }

    // ─── 1v1 Leader/Underdog Strategy ───
    // Activated fully when personality.leaderBias >= 0.8, scaled for others
    let leaderBluffMod = 1.0;
    let underdogAssassinBonus = 0;
    let underdogAssassinBluffMult = 1.0;
    let underdogBluffMult = 1.0;
    let leaderIncomeBoost = 0;
    let leaderRealActionBoost = 0;
    if (aliveCount === 2) {
      const opponent = alivePlayers.find(p => p.id !== botId)!;
      const isLeader = bot.coins > opponent.coins ||
        (bot.coins === opponent.coins && bot.aliveInfluenceCount > opponent.aliveInfluenceCount);
      // Scale factor: full activation at leaderBias >= 0.8, partial below
      const scale = Math.min(personality.leaderBias / 0.8, 1.0);
      if (isLeader) {
        leaderBluffMod = 1.0 - 0.7 * scale; // 0.3 at full activation
        leaderIncomeBoost = 2 * scale;
        leaderRealActionBoost = 3 * scale;
      } else {
        underdogAssassinBonus = 3 * scale;
        underdogAssassinBluffMult = 1.0 + 1.5 * scale; // 2.5 at full
        underdogBluffMult = 1.0 + 0.5 * scale; // 1.5 at full
      }
    }

    // Bluff caution at 1 influence
    const bluffMod = bot.aliveInfluenceCount === 1
      ? (aliveCount === 2 ? 0.7 : 0.4)
      : 1.0;

    // Bluff persistence with personality modifier
    const persistBoost = 3.5 * personality.bluffPersistenceModifier;
    const switchPenalty = (established && aliveCount > 3) ? 0.3 : 1.0;

    // Income
    const incomeWeight = ((aliveCount === 2 ? 0.5 : aliveCount > 3 ? 1.5 : 1) + leaderIncomeBoost) * personality.actionWeightIncome;
    candidates.push({ action: ActionType.Income, weight: incomeWeight });

    // Foreign Aid
    let faWeight = (aliveCount > 3 ? 0.5 : aliveCount === 2 ? 1.5 : 1) * personality.actionWeightForeignAid;
    const aliveDukeCount = alivePlayers.filter(p =>
      p.id !== botId && demonstrated.get(p.id)?.has(Character.Duke)).length;
    if (aliveDukeCount > 0) faWeight *= 0.15;
    // In 3P1L, non-leaders boost FA
    if (is3P1L) {
      const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
      if (sortedByCoins[0].id !== botId) faWeight = Math.max(faWeight, 2.5);
    }
    candidates.push({ action: ActionType.ForeignAid, weight: faWeight });

    // Tax (Duke)
    const hasDuke = ownedCharacters.includes(Character.Duke);
    const dukeRevealed = revealed.get(Character.Duke) || 0;
    if (hasDuke) {
      const weight = (aliveCount > 3 ? 7 : 6) + leaderRealActionBoost;
      candidates.push({ action: ActionType.Tax, weight });
    } else if (dukeRevealed < 2 && !burnt.has(Character.Duke) && Math.random() < personality.bluffRateTax) {
      let weight = aliveCount === 2 ? 3 : 1.5;
      if (established === Character.Duke) weight *= persistBoost;
      else weight *= switchPenalty;
      candidates.push({ action: ActionType.Tax, weight: weight * bluffMod * leaderBluffMod * underdogBluffMult });
    }

    // Steal (Captain)
    const stealTargets = alivePlayers.filter(p => p.id !== botId && p.coins > 0);
    if (stealTargets.length > 0) {
      const hasCaptain = ownedCharacters.includes(Character.Captain);
      const captainRevealed = revealed.get(Character.Captain) || 0;
      const unblockedTargets = stealTargets.filter(p => {
        const demo = demonstrated.get(p.id);
        return !demo || (!demo.has(Character.Captain) && !demo.has(Character.Ambassador));
      });
      const effectiveTargets = unblockedTargets.length > 0 ? unblockedTargets : stealTargets;
      const targetId = this.pickTarget(game, botId, personality, effectiveTargets.map(p => p.id));
      const stealDemoMod = unblockedTargets.length > 0 ? 1.0 : 0.25;

      if (hasCaptain) {
        const weight = ((aliveCount === 2 ? 8 : (aliveCount > 3 ? 3.5 : 5)) + leaderRealActionBoost) * personality.actionWeightSteal;
        candidates.push({ action: ActionType.Steal, targetId, weight: weight * stealDemoMod });
      } else if (captainRevealed < 2 && !burnt.has(Character.Captain) && Math.random() < personality.bluffRateSteal) {
        let weight = aliveCount === 2 ? 2 : 1;
        if (established === Character.Captain) weight *= persistBoost;
        else weight *= switchPenalty;
        candidates.push({ action: ActionType.Steal, targetId, weight: weight * bluffMod * stealDemoMod * leaderBluffMod * underdogBluffMult });
      }
    }

    // Assassinate
    if (bot.coins >= ASSASSINATE_COST) {
      const hasAssassin = ownedCharacters.includes(Character.Assassin);
      const assassinRevealed = revealed.get(Character.Assassin) || 0;
      const targetId = this.pickTarget(game, botId, personality);
      const target = game.getPlayer(targetId);
      const targetBonus = target && target.aliveInfluenceCount === 1 ? 2 : 0;

      if (hasAssassin) {
        candidates.push({ action: ActionType.Assassinate, targetId, weight: (5 + targetBonus + underdogAssassinBonus) * personality.actionWeightAssassinate });
      } else if (assassinRevealed < 2 && !burnt.has(Character.Assassin) && Math.random() < personality.bluffRateAssassinate) {
        let weight = 1;
        if (established === Character.Assassin) weight *= persistBoost;
        else weight *= switchPenalty;
        candidates.push({ action: ActionType.Assassinate, targetId, weight: weight * bluffMod * leaderBluffMod * underdogAssassinBluffMult });
      }
    }

    // Exchange (Ambassador or Inquisitor)
    const hasAmbassador = ownedCharacters.includes(Character.Ambassador);
    const hasInquisitor = ownedCharacters.includes(Character.Inquisitor);
    const hasExchangeChar = hasAmbassador || hasInquisitor;
    const exchangeChar = hasInquisitor ? Character.Inquisitor : Character.Ambassador;
    const exchangeRevealed = revealed.get(exchangeChar) || 0;
    if (hasExchangeChar) {
      const weight = aliveCount <= 2 ? 1 : (aliveCount > 3 ? 4 : 3);
      candidates.push({ action: ActionType.Exchange, weight });
    } else if (aliveCount > 2 && exchangeRevealed < 2 && !burnt.has(exchangeChar) && Math.random() < personality.bluffRateExchange) {
      const hasStrongCard = ownedCharacters.includes(Character.Duke) || ownedCharacters.includes(Character.Captain);
      let weight = hasStrongCard ? 0.5 : 1.5;
      if (established === exchangeChar) weight *= persistBoost;
      else weight *= switchPenalty;
      candidates.push({ action: ActionType.Exchange, weight: weight * bluffMod });
    }

    // ─── Reformation-specific actions ───
    if (game.gameMode === 'Reformation') {
      // Embezzle: take from treasury reserve if it has coins and bot doesn't have Duke (or willing to bluff)
      if (game.treasuryReserve >= 3) {
        const hasDukeForEmbezzle = ownedCharacters.includes(Character.Duke);
        if (!hasDukeForEmbezzle) {
          // Truthful embezzle — safe if not challenged
          candidates.push({ action: ActionType.Embezzle, weight: game.treasuryReserve >= 5 ? 4 : 2 });
        } else if (Math.random() < personality.bluffRateTax * 0.5) {
          // Bluff embezzle (claim no Duke but actually have it) — risky
          candidates.push({ action: ActionType.Embezzle, weight: 0.5 * bluffMod });
        }
      }

      // Convert: consider when stuck with only same-faction targets
      if (!game.allSameFaction()) {
        const factionTargets = alivePlayers.filter(p => p.id !== botId && p.faction !== bot.faction);
        if (factionTargets.length === 0 && bot.coins >= 1) {
          // No valid targets — must convert to unlock targeting
          candidates.push({ action: ActionType.Convert, weight: 5 });
        } else if (bot.coins >= 2 && Math.random() < 0.15) {
          // Occasionally convert an opponent for strategic reasons
          candidates.push({ action: ActionType.Convert, weight: 0.5 });
        }
      }

      // Examine (Inquisitor only)
      if (hasInquisitor) {
        const examineTarget = this.pickTarget(game, botId, personality);
        if (examineTarget) {
          candidates.push({ action: ActionType.Examine, targetId: examineTarget, weight: aliveCount > 2 ? 3 : 1.5 });
        }
      }
    }

    return this.weightedPick(candidates);
  }

  // ─── Challenge Decision ───

  private static decideActionChallenge(
    game: Game,
    botId: string,
    personality: PersonalityParams,
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

    // If bot can block this action with a card it holds, prefer passing to block
    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (pendingAction.targetId === botId && def.blockedBy.length > 0) {
      const canBlock = def.blockedBy.some(c => bot.hiddenCharacters.includes(c));
      if (canBlock) return { type: 'pass_challenge' };
    }

    // Assassination survival logic
    if (pendingAction.type === ActionType.Assassinate && pendingAction.targetId === botId
        && bot.aliveInfluenceCount === 1) {
      const revealed = this.countRevealedCharacters(game);
      const revealedCount = revealed.get(claimedChar) || 0;
      const botHoldsCount = bot.hiddenCharacters.filter(c => c === claimedChar).length;
      if (revealedCount + botHoldsCount >= CARDS_PER_CHARACTER) return { type: 'challenge' };
      const revealedContessas = revealed.get(Character.Contessa) || 0;
      if (revealedContessas >= CARDS_PER_CHARACTER) return { type: 'challenge' };
      if (revealedContessas >= 2 && Math.random() < 0.7) return { type: 'challenge' };
      return { type: 'pass_challenge' };
    }

    // Card counting
    const revealed = this.countRevealedCharacters(game);
    const revealedCount = revealed.get(claimedChar) || 0;
    const botHoldsCount = bot.hiddenCharacters.filter(c => c === claimedChar).length;
    const knownInDeckCount = deckMemory?.get(claimedChar) || 0;
    const accountedFor = revealedCount + botHoldsCount + knownInDeckCount;

    // Never challenge assassination with 2 influences
    if (pendingAction.type === ActionType.Assassinate && pendingAction.targetId === botId && bot.aliveInfluenceCount >= 2) {
      return { type: 'pass_challenge' };
    }

    // 1v1 endgame desperation
    const alivePlayers = game.getAlivePlayers();
    const aliveCount = alivePlayers.length;
    if (aliveCount === 2 && bot.aliveInfluenceCount === 1) {
      const opponent = alivePlayers.find(p => p.id !== botId)!;
      let opponentCoinsAfter = opponent.coins;
      if (pendingAction.type === ActionType.Tax) opponentCoinsAfter += 3;
      else if (pendingAction.type === ActionType.Steal) opponentCoinsAfter += Math.min(2, bot.coins);
      if (opponentCoinsAfter >= COUP_COST && bot.coins < COUP_COST && bot.coins < ASSASSINATE_COST) {
        return { type: 'challenge' };
      }
    }

    // Guaranteed catch
    if (accountedFor >= CARDS_PER_CHARACTER) return { type: 'challenge' };

    // 1v1 underdog desperation
    if (aliveCount === 2) {
      const opponent = alivePlayers.find(p => p.id !== botId)!;
      const isUnderdog = bot.coins < opponent.coins ||
        (bot.coins === opponent.coins && bot.aliveInfluenceCount < opponent.aliveInfluenceCount);
      if (isUnderdog && Math.random() < 0.40) return { type: 'challenge' };
    }

    // Personality-driven challenge rates
    const isTargetedAction = pendingAction.targetId !== undefined;
    const isBystander = isTargetedAction && pendingAction.targetId !== botId && aliveCount > 2;
    const bystanderMod = isBystander ? 0.2 : 1.0;
    const earlyGameMod = game.turnNumber <= 2 ? 0.3 : game.turnNumber <= 4 ? 0.6 : 1.0;

    let challengeProb = personality.challengeRateBase;
    if (botHoldsCount > 0) challengeProb = personality.challengeRateWithEvidence;
    if (accountedFor >= 2) challengeProb = Math.min(challengeProb + 0.25, 0.65);

    challengeProb *= bystanderMod * earlyGameMod;

    // Caution at 1 influence
    if (bot.aliveInfluenceCount === 1 && pendingAction.targetId !== botId) {
      challengeProb *= 0.5;
    }

    return Math.random() < challengeProb ? { type: 'challenge' } : { type: 'pass_challenge' };
  }

  // ─── Block Decision ───

  private static decideBlock(
    game: Game,
    botId: string,
    personality: PersonalityParams,
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

    const isTarget = pendingAction.targetId === botId;
    if (pendingAction.targetId && !isTarget) return { type: 'pass_block' };

    // 3P1L anti-tempo for Foreign Aid
    if (pendingAction.type === ActionType.ForeignAid) {
      const alivePlayers = game.getAlivePlayers();
      const aliveCount = alivePlayers.length;
      const is3P1L = aliveCount === 3 && alivePlayers.every(p => p.aliveInfluenceCount === 1);
      if (is3P1L) {
        const sortedByCoins = [...alivePlayers].sort((a, b) => b.coins - a.coins);
        if (sortedByCoins[0].id === botId && Math.random() < 0.7) return { type: 'pass_block' };
      }
    }

    for (const blockChar of def.blockedBy) {
      const hasCard = bot.hiddenCharacters.includes(blockChar);

      if (hasCard) {
        if (isTarget) return { type: 'block', character: blockChar };
        if (Math.random() < 0.9) return { type: 'block', character: blockChar };
      } else {
        // Bluff blocking with personality rates
        const revealed = this.countRevealedCharacters(game);
        const revealedCount = revealed.get(blockChar) || 0;
        if (revealedCount >= CARDS_PER_CHARACTER) continue;

        if (isTarget && blockChar === Character.Contessa && pendingAction.type === ActionType.Assassinate) {
          if (bot.aliveInfluenceCount === 1) {
            // Always bluff Contessa when about to die
            return { type: 'block', character: blockChar };
          }
          if (Math.random() < personality.bluffRateContessa) return { type: 'block', character: blockChar };
          continue;
        }

        // Other block bluffs
        const bluffRate = isTarget ? personality.bluffRateOtherBlock : personality.bluffRateOtherBlock * 0.5;
        if (Math.random() < bluffRate) return { type: 'block', character: blockChar };
      }
    }

    return { type: 'pass_block' };
  }

  // ─── Block Challenge Decision ───

  private static decideBlockChallenge(
    game: Game,
    botId: string,
    personality: PersonalityParams,
    pendingAction: PendingAction | null,
    pendingBlock: PendingBlock | null,
    challengeState: ChallengeState | null,
    deckMemory?: Map<Character, number>,
  ): BotDecision | null {
    if (!pendingAction || !pendingBlock || !challengeState) return null;
    if (challengeState.passedPlayerIds.includes(botId)) return null;

    const bot = game.getPlayer(botId)!;
    const blockerClaimedChar = pendingBlock.claimedCharacter;

    // Card counting
    const revealed = this.countRevealedCharacters(game);
    const revealedCount = revealed.get(blockerClaimedChar) || 0;
    const botHoldsCount = bot.hiddenCharacters.filter(c => c === blockerClaimedChar).length;
    const knownInDeckCount = deckMemory?.get(blockerClaimedChar) || 0;
    const accountedFor = revealedCount + botHoldsCount + knownInDeckCount;

    // Guaranteed catch
    if (accountedFor >= CARDS_PER_CHARACTER) return { type: 'challenge_block' };

    // 1v1 underdog desperation
    const alivePlayers = game.getAlivePlayers();
    if (alivePlayers.length === 2) {
      const opponent = alivePlayers.find(p => p.id !== botId)!;
      const isUnderdog = bot.coins < opponent.coins ||
        (bot.coins === opponent.coins && bot.aliveInfluenceCount < opponent.aliveInfluenceCount);
      if (isUnderdog && Math.random() < 0.45) return { type: 'challenge_block' };
    }

    // Personality-driven block challenge rate
    let challengeProb = personality.challengeRateBlock;
    if (botHoldsCount > 0) challengeProb += 0.15;
    if (accountedFor >= 2) challengeProb = Math.min(challengeProb + 0.25, 0.6);
    if (bot.aliveInfluenceCount === 1) challengeProb *= 0.7;

    // Extra incentive if our action cost coins
    const costDef = ACTION_DEFINITIONS[pendingAction.type];
    if (costDef.cost > 0) challengeProb += 0.05;

    return Math.random() < challengeProb ? { type: 'challenge_block' } : { type: 'pass_challenge_block' };
  }

  // ─── Influence Loss Decision ───

  private static decideInfluenceLoss(
    game: Game, botId: string, personality: PersonalityParams,
  ): BotDecision {
    const bot = game.getPlayer(botId)!;
    const unrevealed = bot.influences
      .map((inf, i) => ({ character: inf.character, index: i }))
      .filter(x => !bot.influences[x.index].revealed);

    if (unrevealed.length === 1) {
      return { type: 'choose_influence_loss', influenceIndex: unrevealed[0].index };
    }

    // Dynamic card value with personality spread
    unrevealed.sort((a, b) =>
      this.dynamicCardValueWithSpread(a.character, game, botId, personality.cardValueSpread) -
      this.dynamicCardValueWithSpread(b.character, game, botId, personality.cardValueSpread)
    );
    return { type: 'choose_influence_loss', influenceIndex: unrevealed[0].index };
  }

  // ─── Exchange Decision ───

  private static decideExchange(
    game: Game, botId: string, personality: PersonalityParams, exchangeState: ExchangeState,
  ): BotDecision {
    const bot = game.getPlayer(botId)!;
    const currentCards = bot.hiddenCharacters;
    const allCards = [...currentCards, ...exchangeState.drawnCards];
    const keepCount = bot.aliveInfluenceCount;

    const indexed = allCards.map((char, i) => ({
      char,
      index: i,
      value: this.dynamicCardValueWithSpread(char, game, botId, personality.cardValueSpread),
    }));
    indexed.sort((a, b) => b.value - a.value);
    return { type: 'choose_exchange', keepIndices: indexed.slice(0, keepCount).map(x => x.index) };
  }

  // ─── Examine Decision (Inquisitor) ───

  private static decideExamine(
    game: Game, botId: string, personality: PersonalityParams, examineState: ExamineState,
  ): BotDecision {
    const revealedCard = examineState.revealedCard;
    // Force swap if the card is strong (Captain, Duke — cards that are threatening to the bot)
    const strongCards = [Character.Captain, Character.Duke, Character.Assassin];
    const forceSwap = strongCards.includes(revealedCard);
    return { type: 'examine_decision', forceSwap };
  }
}
