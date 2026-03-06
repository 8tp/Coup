import { BotPersonality, Character, PersonalityParams, LogEntry, RoomPlayer } from '../shared/types';
import {
  BOT_ACTION_DELAY_MIN,
  BOT_ACTION_DELAY_MAX,
  BOT_REACTION_DELAY_MIN,
  BOT_REACTION_DELAY_MAX,
  BOT_EMOTE_DELAY_MIN,
  BOT_EMOTE_DELAY_MAX,
  BOT_EMOTE_COOLDOWN_MS,
  BOT_EMOTE_TRIGGERS,
  DEFAULT_BOT_PERSONALITY,
  DEFAULT_BOT_MIN_REACTION_SECONDS,
  BOT_PERSONALITIES,
  BOT_PERSONALITY_TYPES,
} from '../shared/constants';
import { GameEngine } from '../engine/GameEngine';
import { BotBrain, BotDecision } from '../engine/BotBrain';

export type BotEmoteCallback = (botId: string, botName: string, reactionId: string) => void;

function resolvePersonality(personalityType: BotPersonality): PersonalityParams {
  if (personalityType === 'random') {
    const chosen = BOT_PERSONALITY_TYPES[Math.floor(Math.random() * BOT_PERSONALITY_TYPES.length)];
    return BOT_PERSONALITIES[chosen];
  }
  return BOT_PERSONALITIES[personalityType];
}

interface BotInfo {
  id: string;
  name: string;
  personalityType: BotPersonality;
  personality: PersonalityParams;
  /** Characters the bot knows are in the deck (from its own Ambassador exchanges). */
  deckMemory: Map<Character, number>;
  /** How many actionLog entries have been processed for memory invalidation. */
  lastProcessedLogLength: number;
  /** 0-1 personality trait controlling emote frequency. */
  emotiveness: number;
  /** 0-1 personality trait: 0 = nice/sportsmanlike, 1 = mean/trash-talky. */
  meanness: number;
  /** How many actionLog entries have been scanned for emote triggers. */
  lastEmoteLogLength: number;
  /** Timestamp of last emote fired (for cooldown). */
  lastEmoteTime: number;
}

export class BotController {
  private bots: BotInfo[];
  private engine: GameEngine;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingEmoteTimeout: ReturnType<typeof setTimeout> | null = null;
  private onBotEmote: BotEmoteCallback | null = null;
  private destroyed = false;
  private botMinReactionMs: number;

  constructor(engine: GameEngine, botPlayers: RoomPlayer[], botMinReactionMs?: number) {
    this.engine = engine;
    this.botMinReactionMs = botMinReactionMs ?? (DEFAULT_BOT_MIN_REACTION_SECONDS * 1000);
    this.bots = botPlayers
      .filter(p => p.isBot)
      .map(p => {
        const personalityType = p.personality ?? DEFAULT_BOT_PERSONALITY;
        return {
          id: p.id,
          name: p.name,
          personalityType,
          personality: resolvePersonality(personalityType),
          deckMemory: new Map<Character, number>(),
          lastProcessedLogLength: 0,
          emotiveness: Math.random(),
          meanness: Math.random(),
          lastEmoteLogLength: 0,
          lastEmoteTime: 0,
        };
      });
  }

  setOnBotEmote(cb: BotEmoteCallback): void {
    this.onBotEmote = cb;
  }

  /**
   * Register a new bot mid-game (e.g., when a disconnected player is replaced).
   */
  addBot(playerId: string, personality: BotPersonality, name?: string): void {
    if (this.destroyed) return;
    if (this.bots.some(b => b.id === playerId)) return;
    this.bots.push({
      id: playerId,
      name: name ?? 'Bot',
      personalityType: personality,
      personality: resolvePersonality(personality),
      deckMemory: new Map<Character, number>(),
      lastProcessedLogLength: 0,
      emotiveness: Math.random(),
      meanness: Math.random(),
      lastEmoteLogLength: 0,
      lastEmoteTime: 0,
    });
  }

  /**
   * Called after every state broadcast. Evaluates whether any bot needs to act
   * and schedules the first one with a randomized delay.
   */
  onStateChange(): void {
    if (this.destroyed) return;

    // Clear any pending action — state has changed, re-evaluate
    this.clearPending();

    const game = this.engine.game;
    if (game.status !== 'InProgress') return;

    // Invalidate deck memory when deck-mutating events occur
    const logLength = game.actionLog.length;
    for (const bot of this.bots) {
      if (bot.deckMemory.size === 0) {
        bot.lastProcessedLogLength = logLength;
        continue;
      }
      for (let i = bot.lastProcessedLogLength; i < logLength; i++) {
        const entry = game.actionLog[i];
        // Another player's exchange shuffles cards into the deck
        if (entry.eventType === 'exchange' && entry.actorId !== bot.id) {
          bot.deckMemory.clear();
          break;
        }
        // Challenge failure: defender shuffles their card back and draws a replacement
        if (entry.eventType === 'challenge_fail' || entry.eventType === 'block_challenge_fail') {
          bot.deckMemory.clear();
          break;
        }
      }
      bot.lastProcessedLogLength = logLength;
    }

    // Check for emote triggers in new log entries
    this.checkForEmotes();

    // Find the first bot that has a decision to make
    for (const bot of this.bots) {
      const state = this.engine.getFullState();
      const decision = BotBrain.decide(
        game,
        bot.id,
        bot.personality,
        state.pendingAction,
        state.pendingBlock,
        state.challengeState,
        state.influenceLossRequest,
        state.exchangeState,
        state.blockPassedPlayerIds,
        bot.deckMemory,
        state.examineState ?? undefined,
      );

      if (decision) {
        const delay = this.getDelay(decision);
        this.pendingTimeout = setTimeout(() => {
          if (this.destroyed) return;
          this.executeDecision(bot.id, decision);
        }, delay);
        return; // Only schedule one bot at a time
      }
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.clearPending();
    if (this.pendingEmoteTimeout) {
      clearTimeout(this.pendingEmoteTimeout);
      this.pendingEmoteTimeout = null;
    }
    this.onBotEmote = null;
  }

  private clearPending(): void {
    if (this.pendingTimeout) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }

  private getDelay(decision: BotDecision): number {
    // Active phases (choosing an action, exchange, influence loss) use longer delays
    const isActive = decision.type === 'action'
      || decision.type === 'choose_exchange'
      || decision.type === 'choose_influence_loss'
      || decision.type === 'examine_decision'
      || decision.type === 'convert';

    const configMin = isActive ? BOT_ACTION_DELAY_MIN : BOT_REACTION_DELAY_MIN;
    const effectiveMin = Math.max(configMin, this.botMinReactionMs);
    const configMax = isActive ? BOT_ACTION_DELAY_MAX : BOT_REACTION_DELAY_MAX;
    const max = Math.max(configMax, effectiveMin);

    return effectiveMin + Math.random() * (max - effectiveMin);
  }

  private executeDecision(botId: string, decision: BotDecision): void {
    if (this.destroyed) return;

    let error: string | null = null;
    switch (decision.type) {
      case 'action':
        error = this.engine.handleAction(botId, decision.action, decision.targetId);
        break;
      case 'challenge':
        error = this.engine.handleChallenge(botId);
        break;
      case 'pass_challenge':
        error = this.engine.handlePassChallenge(botId);
        break;
      case 'block':
        error = this.engine.handleBlock(botId, decision.character);
        break;
      case 'pass_block':
        error = this.engine.handlePassBlock(botId);
        break;
      case 'challenge_block':
        error = this.engine.handleChallengeBlock(botId);
        break;
      case 'pass_challenge_block':
        error = this.engine.handlePassChallengeBlock(botId);
        break;
      case 'choose_influence_loss':
        error = this.engine.handleChooseInfluenceLoss(botId, decision.influenceIndex);
        break;
      case 'examine_decision':
        error = this.engine.handleExamineDecision(botId, decision.forceSwap);
        break;
      case 'convert':
        error = this.engine.handleConvert(botId, decision.targetId);
        break;
      case 'choose_exchange': {
        const bot = this.bots.find(b => b.id === botId);
        if (bot) {
          const state = this.engine.getFullState();
          if (state.exchangeState) {
            const player = this.engine.game.getPlayer(botId);
            if (player) {
              const allCards = [...player.hiddenCharacters, ...state.exchangeState.drawnCards];
              const kept = new Set(decision.keepIndices);
              const returned = allCards.filter((_, i) => !kept.has(i));
              bot.deckMemory.clear();
              for (const card of returned) {
                bot.deckMemory.set(card, (bot.deckMemory.get(card) || 0) + 1);
              }
            }
          }
        }
        error = this.engine.handleChooseExchange(botId, decision.keepIndices);
        break;
      }
    }

    // If engine rejected the decision, re-evaluate (state may have changed)
    if (error) {
      this.onStateChange();
    }
    // If no error, engine already broadcast → onStateChange called via callback
  }

  // ─── Emote System ───

  private checkForEmotes(): void {
    if (!this.onBotEmote || this.pendingEmoteTimeout) return;

    const game = this.engine.game;
    const logLength = game.actionLog.length;
    const now = Date.now();
    const state = this.engine.getFullState();

    for (const bot of this.bots) {
      // Scan new log entries since last emote check
      for (let i = bot.lastEmoteLogLength; i < logLength; i++) {
        const entry = game.actionLog[i];
        const match = this.matchEmoteTrigger(bot, entry, state.pendingAction?.targetId ?? null, state.challengeState?.challengedPlayerId ?? null, state.challengeState?.challengerId ?? null);
        if (!match) continue;

        // Roll against emotiveness threshold
        const chance = bot.emotiveness < 0.3 ? 0.15 : bot.emotiveness > 0.7 ? 0.55 : 0.35;
        if (Math.random() > chance) continue;

        // Cooldown check
        if (now - bot.lastEmoteTime < BOT_EMOTE_COOLDOWN_MS) continue;

        // Schedule emote with random delay
        const reactionId = match[Math.floor(Math.random() * match.length)];
        const delay = BOT_EMOTE_DELAY_MIN + Math.random() * (BOT_EMOTE_DELAY_MAX - BOT_EMOTE_DELAY_MIN);
        const botId = bot.id;
        const botName = bot.name;
        bot.lastEmoteTime = now;

        this.pendingEmoteTimeout = setTimeout(() => {
          if (this.destroyed) return;
          this.pendingEmoteTimeout = null;
          this.onBotEmote?.(botId, botName, reactionId);
        }, delay);

        // Update all bots' lastEmoteLogLength before returning
        for (const b of this.bots) {
          if (b.lastEmoteLogLength < logLength) b.lastEmoteLogLength = logLength;
        }
        return; // Only one emote at a time globally
      }
      bot.lastEmoteLogLength = logLength;
    }
  }

  /**
   * Determine if a log entry matches any emote trigger for a given bot.
   * Returns the array of candidate reaction IDs (chosen by meanness), or null if no match.
   */
  private matchEmoteTrigger(
    bot: BotInfo,
    entry: LogEntry,
    pendingTargetId: string | null,
    challengedPlayerId: string | null,
    challengerId: string | null,
  ): string[] | null {
    for (const trigger of BOT_EMOTE_TRIGGERS) {
      if (!trigger.eventTypes.includes(entry.eventType)) continue;

      const role = this.getBotRole(bot.id, entry, pendingTargetId, challengedPlayerId, challengerId);
      if (role === trigger.botRole) {
        // Bluff-aware emotes for action_resolve/block where the bot is the actor
        if (role === 'actor' && (entry.eventType === 'action_resolve' || entry.eventType === 'block') && entry.character) {
          const player = this.engine.game.getPlayer(bot.id);
          const wasBluffing = player ? !player.hiddenCharacters.includes(entry.character) : false;
          const shouldLie = Math.random() < 0.15;
          const actAsBluffer = wasBluffing !== shouldLie;
          if (actAsBluffer) {
            return ['nice_bluff', 'big_brain', 'lol'];
          } else {
            return ['gg', 'lol', 'no_way'];
          }
        }

        return Math.random() < bot.meanness
          ? trigger.meanReactions
          : trigger.niceReactions;
      }
    }
    return null;
  }

  /**
   * Determine what role a bot plays in a given log entry.
   */
  private getBotRole(
    botId: string,
    entry: LogEntry,
    pendingTargetId: string | null,
    challengedPlayerId: string | null,
    challengerId: string | null,
  ): 'actor' | 'target' | 'other' {
    switch (entry.eventType) {
      case 'elimination':
      case 'influence_loss':
        if (entry.actorId === botId) return 'target';
        return 'other';

      case 'challenge_success':
        if (entry.actorId === botId) return 'actor';
        if (challengedPlayerId === botId) return 'target';
        return 'other';

      case 'challenge_fail':
        if (challengerId === botId) return 'target';
        if (entry.actorId === botId) return 'actor';
        return 'other';

      case 'block':
        if (entry.actorId === botId) return 'actor';
        return 'other';

      case 'win':
        if (entry.actorId === botId) return 'actor';
        return 'other';

      case 'coup':
      case 'assassination':
        if (entry.actorId === botId) return 'actor';
        if (pendingTargetId === botId) return 'target';
        return 'other';

      case 'action_resolve':
        if (entry.actorId === botId) return 'actor';
        if (pendingTargetId === botId) return 'target';
        return 'other';

      default:
        return 'other';
    }
  }
}
