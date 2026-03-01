import { BotDifficulty, RoomPlayer } from '../shared/types';
import {
  BOT_ACTION_DELAY_MIN,
  BOT_ACTION_DELAY_MAX,
  BOT_REACTION_DELAY_MIN,
  BOT_REACTION_DELAY_MAX,
  DEFAULT_BOT_DIFFICULTY,
} from '../shared/constants';
import { GameEngine } from '../engine/GameEngine';
import { BotBrain, BotDecision } from '../engine/BotBrain';

interface BotInfo {
  id: string;
  difficulty: BotDifficulty;
}

export class BotController {
  private bots: BotInfo[];
  private engine: GameEngine;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(engine: GameEngine, botPlayers: RoomPlayer[]) {
    this.engine = engine;
    this.bots = botPlayers
      .filter(p => p.isBot)
      .map(p => ({ id: p.id, difficulty: p.difficulty ?? DEFAULT_BOT_DIFFICULTY }));
  }

  /**
   * Register a new bot mid-game (e.g., when a disconnected player is replaced).
   */
  addBot(playerId: string, difficulty: BotDifficulty): void {
    if (this.destroyed) return;
    if (this.bots.some(b => b.id === playerId)) return;
    this.bots.push({ id: playerId, difficulty });
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

    // Find the first bot that has a decision to make
    for (const bot of this.bots) {
      const state = this.engine.getFullState();
      const decision = BotBrain.decide(
        game,
        bot.id,
        bot.difficulty,
        state.pendingAction,
        state.pendingBlock,
        state.challengeState,
        state.influenceLossRequest,
        state.exchangeState,
        state.blockPassedPlayerIds,
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
      || decision.type === 'choose_influence_loss';

    const min = isActive ? BOT_ACTION_DELAY_MIN : BOT_REACTION_DELAY_MIN;
    const max = isActive ? BOT_ACTION_DELAY_MAX : BOT_REACTION_DELAY_MAX;

    return min + Math.random() * (max - min);
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
      case 'choose_exchange':
        error = this.engine.handleChooseExchange(botId, decision.keepIndices);
        break;
    }

    // If engine rejected the decision, re-evaluate (state may have changed)
    if (error) {
      this.onStateChange();
    }
    // If no error, engine already broadcast → onStateChange called via callback
  }
}
