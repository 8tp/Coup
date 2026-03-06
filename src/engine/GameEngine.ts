import { randomInt } from 'crypto';
import {
  ActionType,
  ChallengeRevealEvent,
  Character,
  ExamineState,
  GameMode,
  TurnPhase,
  GameState,
  PendingAction,
  PendingBlock,
  ChallengeState,
  InfluenceLossRequest,
  ExchangeState,
} from '../shared/types';
import { ACTION_DEFINITIONS, FORCED_COUP_THRESHOLD, TURN_TIMER_MS } from '../shared/constants';
import { Game } from './Game';
import { ActionResolver, ResolverResult, SideEffect } from './ActionResolver';

export type StateChangeCallback = (state: GameState) => void;

export class GameEngine {
  game: Game;
  private resolver: ActionResolver;
  private onStateChange: StateChangeCallback | null = null;

  // Turn-specific state (mirrors what's in ResolverResult)
  pendingAction: PendingAction | null = null;
  pendingBlock: PendingBlock | null = null;
  challengeState: ChallengeState | null = null;
  influenceLossRequest: InfluenceLossRequest | null = null;
  exchangeState: ExchangeState | null = null;
  examineState: ExamineState | null = null;
  timerExpiry: number | null = null;
  lastChallengeReveal: ChallengeRevealEvent | null = null;
  private timerHandle: ReturnType<typeof setTimeout> | null = null;
  private blockPassedPlayerIds: Set<string> | null = null;

  private turnTimerMs: number;

  constructor(roomCode: string, timerMs?: number, turnTimerMs?: number) {
    this.game = new Game(roomCode);
    this.resolver = new ActionResolver(timerMs);
    this.turnTimerMs = turnTimerMs ?? TURN_TIMER_MS;
  }

  setOnStateChange(cb: StateChangeCallback): void {
    this.onStateChange = cb;
  }

  destroy(): void {
    this.clearTimer();
    this.onStateChange = null;
  }

  startGame(playerInfos: Array<{ id: string; name: string }>, options?: { gameMode?: GameMode; useInquisitor?: boolean }): void {
    this.game.initialize(playerInfos, options);
    this.clearTurnState();

    // Set turn timer for the first player's action
    if (this.turnTimerMs > 0) {
      this.timerExpiry = Date.now() + this.turnTimerMs;
      this.timerHandle = setTimeout(() => {
        this.handleTimerExpiry();
      }, this.turnTimerMs);
    }

    this.broadcastState();
  }

  getFullState(): GameState {
    const state = this.game.toState();
    state.pendingAction = this.pendingAction;
    state.pendingBlock = this.pendingBlock;
    state.challengeState = this.challengeState;
    state.influenceLossRequest = this.influenceLossRequest;
    state.exchangeState = this.exchangeState;
    state.examineState = this.examineState;
    state.timerExpiry = this.timerExpiry;
    state.blockPassedPlayerIds = this.blockPassedPlayerIds
      ? Array.from(this.blockPassedPlayerIds)
      : [];
    return state;
  }

  // ─── Action Entry Points ───

  handleAction(actorId: string, actionType: ActionType, targetId?: string): string | null {
    const result = this.resolver.declareAction(this.game, actorId, actionType, targetId);
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handleChallenge(challengerId: string): string | null {
    if (!this.pendingAction || !this.challengeState) return 'No pending challenge';
    if (this.game.turnPhase !== TurnPhase.AwaitingActionChallenge) return 'Not in challenge phase';

    const result = this.resolver.challenge(
      this.game, challengerId, this.pendingAction, this.challengeState,
    );
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handlePassChallenge(playerId: string): string | null {
    if (!this.challengeState || !this.pendingAction) return 'No pending challenge';
    if (this.game.turnPhase !== TurnPhase.AwaitingActionChallenge) return 'Not in challenge phase';

    const player = this.game.getPlayer(playerId);
    if (!player || !player.isAlive) return 'Invalid player';
    if (this.challengeState.passedPlayerIds.includes(playerId)) return 'Already passed';

    this.challengeState.passedPlayerIds.push(playerId);

    // Check if all alive players (except actor) have passed
    const alivePlayers = this.game.getAlivePlayers();
    const allPassed = alivePlayers.every(p => this.challengeState!.passedPlayerIds.includes(p.id));

    if (allPassed) {
      const result = this.resolver.allPassedChallenge(this.game, this.pendingAction);
      this.applyResult(result);
    } else {
      this.broadcastState();
    }
    return null;
  }

  handleBlock(blockerId: string, character: Character): string | null {
    if (!this.pendingAction) return 'No pending action';
    if (this.game.turnPhase !== TurnPhase.AwaitingBlock) return 'Not in block phase';

    const result = this.resolver.block(this.game, blockerId, character, this.pendingAction);
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handlePassBlock(playerId: string): string | null {
    if (!this.pendingAction) return 'No pending action';
    if (this.game.turnPhase !== TurnPhase.AwaitingBlock) return 'Not in block phase';

    const player = this.game.getPlayer(playerId);
    if (!player || !player.isAlive) return 'Invalid player';
    if (playerId === this.pendingAction.actorId) return 'Actor cannot pass on their own block phase';

    // Initialize block pass tracking if needed
    if (!this.blockPassedPlayerIds) {
      this.blockPassedPlayerIds = new Set([this.pendingAction.actorId]);
    }

    if (this.blockPassedPlayerIds.has(playerId)) return 'Already passed';
    this.blockPassedPlayerIds.add(playerId);

    // Determine who needs to pass for the block phase to resolve
    let potentialBlockers: string[];
    if (this.pendingAction.type === ActionType.ForeignAid) {
      potentialBlockers = this.game.getAlivePlayers()
        .filter(p => p.id !== this.pendingAction!.actorId)
        .map(p => p.id);
    } else {
      // For targeted actions (Steal, Assassinate), only target can block
      potentialBlockers = this.pendingAction.targetId ? [this.pendingAction.targetId] : [];
    }

    const allPassed = potentialBlockers.every(id => this.blockPassedPlayerIds!.has(id));

    if (allPassed) {
      const result = this.resolver.allPassedBlock(this.game, this.pendingAction);
      this.applyResult(result);
    } else {
      this.broadcastState();
    }
    return null;
  }

  handleChallengeBlock(challengerId: string): string | null {
    if (!this.pendingAction || !this.pendingBlock || !this.challengeState) {
      return 'No pending block challenge';
    }
    if (this.game.turnPhase !== TurnPhase.AwaitingBlockChallenge) return 'Not in block challenge phase';

    const result = this.resolver.challengeBlock(
      this.game, challengerId, this.pendingAction, this.pendingBlock, this.challengeState,
    );
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handlePassChallengeBlock(playerId: string): string | null {
    if (!this.pendingAction || !this.pendingBlock || !this.challengeState) {
      return 'No pending block challenge';
    }
    if (this.game.turnPhase !== TurnPhase.AwaitingBlockChallenge) return 'Not in block challenge phase';

    if (this.challengeState.passedPlayerIds.includes(playerId)) return 'Already passed';
    this.challengeState.passedPlayerIds.push(playerId);

    // Any alive player (except the blocker) can challenge a block
    const alivePlayers = this.game.getAlivePlayers();
    const allPassed = alivePlayers.every(p => this.challengeState!.passedPlayerIds.includes(p.id));

    if (allPassed) {
      const result = this.resolver.allPassedBlockChallenge(this.game, this.pendingAction);
      this.applyResult(result);
    } else {
      this.broadcastState();
    }
    return null;
  }

  handleChooseInfluenceLoss(playerId: string, influenceIndex: number): string | null {
    if (!this.influenceLossRequest) return 'No pending influence loss';
    if (this.game.turnPhase !== TurnPhase.AwaitingInfluenceLoss) return 'Not in influence loss phase';

    const result = this.resolver.chooseInfluenceLoss(
      this.game, playerId, influenceIndex, this.pendingAction, this.influenceLossRequest,
    );
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handleChooseExchange(playerId: string, keepIndices: number[]): string | null {
    if (!this.exchangeState || !this.pendingAction) return 'No pending exchange';
    if (this.game.turnPhase !== TurnPhase.AwaitingExchange) return 'Not in exchange phase';

    const result = this.resolver.chooseExchange(
      this.game, playerId, keepIndices, this.exchangeState, this.pendingAction,
    );
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handleExamineDecision(playerId: string, forceSwap: boolean): string | null {
    if (!this.examineState || !this.pendingAction) return 'No pending examine';
    if (this.game.turnPhase !== TurnPhase.AwaitingExamineDecision) return 'Not in examine phase';

    const result = this.resolver.resolveExamine(
      this.game, playerId, forceSwap, this.examineState, this.pendingAction,
    );
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handleConvert(actorId: string, targetId?: string): string | null {
    const result = this.resolver.declareAction(this.game, actorId, ActionType.Convert, targetId);
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  handleEmbezzle(actorId: string): string | null {
    const result = this.resolver.declareAction(this.game, actorId, ActionType.Embezzle);
    if ('error' in result) return result.error;
    this.applyResult(result);
    return null;
  }

  // ─── Timer ───

  handleTimerExpiry(): void {
    const phase = this.game.turnPhase;

    if (phase === TurnPhase.AwaitingActionChallenge && this.pendingAction) {
      // Everyone effectively passes
      const result = this.resolver.allPassedChallenge(this.game, this.pendingAction);
      this.applyResult(result);
    } else if (phase === TurnPhase.AwaitingBlock && this.pendingAction) {
      const result = this.resolver.allPassedBlock(this.game, this.pendingAction);
      this.applyResult(result);
    } else if (phase === TurnPhase.AwaitingBlockChallenge && this.pendingAction) {
      const result = this.resolver.allPassedBlockChallenge(this.game, this.pendingAction);
      this.applyResult(result);
    } else if (phase === TurnPhase.AwaitingAction) {
      this.handleTurnTimeout();
    } else if (phase === TurnPhase.AwaitingExchange) {
      this.handleExchangeTimeout();
    } else if (phase === TurnPhase.AwaitingInfluenceLoss) {
      this.handleInfluenceLossTimeout();
    } else if (phase === TurnPhase.AwaitingExamineDecision) {
      this.handleExamineTimeout();
    }
  }

  private handleTurnTimeout(): void {
    const actor = this.game.currentPlayer;
    if (!actor || !actor.isAlive) return;

    if (actor.coins >= FORCED_COUP_THRESHOLD) {
      // Must coup — pick a random alive opponent
      const targets = this.game.getAlivePlayers().filter(p => p.id !== actor.id);
      if (targets.length === 0) return;
      const target = targets[randomInt(targets.length)];
      this.handleAction(actor.id, ActionType.Coup, target.id);
    } else {
      // Auto-Income
      this.handleAction(actor.id, ActionType.Income);
    }
  }

  private handleExchangeTimeout(): void {
    if (!this.exchangeState || !this.pendingAction) return;
    const player = this.game.getPlayer(this.exchangeState.playerId);
    if (!player) return;

    // Keep first N cards (player's original cards)
    const keepCount = player.aliveInfluenceCount;
    const keepIndices = Array.from({ length: keepCount }, (_, i) => i);
    this.handleChooseExchange(this.exchangeState.playerId, keepIndices);
  }

  private handleExamineTimeout(): void {
    if (!this.examineState) return;
    // Default: return the card (no swap)
    this.handleExamineDecision(this.examineState.examinerId, false);
  }

  private handleInfluenceLossTimeout(): void {
    if (!this.influenceLossRequest) return;
    const player = this.game.getPlayer(this.influenceLossRequest.playerId);
    if (!player) return;

    // Lose first unrevealed influence
    const idx = player.influences.findIndex(inf => !inf.revealed);
    if (idx >= 0) {
      this.handleChooseInfluenceLoss(this.influenceLossRequest.playerId, idx);
    }
  }

  // ─── Internals ───

  private applyResult(result: ResolverResult): void {
    // Apply side effects first
    for (const effect of result.sideEffects) {
      this.applySideEffect(effect);
    }

    // Update turn state
    this.pendingAction = result.pendingAction;
    this.pendingBlock = result.pendingBlock;
    this.challengeState = result.challengeState;
    this.influenceLossRequest = result.influenceLossRequest;
    this.exchangeState = result.exchangeState;
    this.examineState = result.examineState ?? null;

    // Clear block tracking when leaving block phase
    if (result.newPhase !== TurnPhase.AwaitingBlock) {
      this.blockPassedPlayerIds = null;
    }

    // Pre-populate block pass list with players who challenged (challenge OR block, not both)
    if (result.newPhase === TurnPhase.AwaitingBlock && result.blockAutoPassIds?.length) {
      if (!this.blockPassedPlayerIds) {
        this.blockPassedPlayerIds = new Set([this.pendingAction!.actorId]);
      }
      for (const id of result.blockAutoPassIds) {
        this.blockPassedPlayerIds.add(id);
      }
    }

    // Update phase (unless advance_turn effect already moved it)
    if (result.newPhase !== TurnPhase.ActionResolved) {
      this.game.turnPhase = result.newPhase;
    }

    // After side effects are applied, check if we're entering AwaitingBlock
    // but the target (potential blocker) is already dead. This happens when
    // an assassination target challenges, loses (auto-revealed), and the game
    // tries to give them a chance to block — but they're already eliminated.
    if (
      result.newPhase === TurnPhase.AwaitingBlock &&
      this.pendingAction?.targetId
    ) {
      const target = this.game.getPlayer(this.pendingAction.targetId);
      if (target && !target.isAlive) {
        const autoResult = this.resolver.allPassedBlock(this.game, this.pendingAction);
        this.applyResult(autoResult);
        return;
      }

      // For targeted actions, only the target can block. If the target already
      // challenged (and thus forfeited their block), skip block phase entirely.
      if (this.blockPassedPlayerIds?.has(this.pendingAction.targetId)) {
        const def = ACTION_DEFINITIONS[this.pendingAction.type];
        const isTargetedBlock = this.pendingAction.type !== ActionType.ForeignAid && def.blockedBy.length > 0;
        if (isTargetedBlock) {
          const autoResult = this.resolver.allPassedBlock(this.game, this.pendingAction);
          this.applyResult(autoResult);
          return;
        }
      }
    }

    // Set turn timer for exchange and influence loss phases
    // (AwaitingAction timer is set by advance_turn side effect and startGame)
    if (
      this.turnTimerMs > 0 &&
      (result.newPhase === TurnPhase.AwaitingExchange ||
       result.newPhase === TurnPhase.AwaitingInfluenceLoss ||
       result.newPhase === TurnPhase.AwaitingExamineDecision)
    ) {
      this.clearTimer();
      this.timerExpiry = Date.now() + this.turnTimerMs;
      this.timerHandle = setTimeout(() => {
        this.handleTimerExpiry();
      }, this.turnTimerMs);
    }

    this.broadcastState();
  }

  private applySideEffect(effect: SideEffect): void {
    switch (effect.type) {
      case 'give_coins': {
        const player = this.game.getPlayer(effect.playerId);
        if (player) this.game.giveCoins(player, effect.amount);
        break;
      }
      case 'take_coins': {
        const player = this.game.getPlayer(effect.playerId);
        if (player) this.game.takeCoins(player, effect.amount);
        break;
      }
      case 'transfer_coins': {
        const from = this.game.getPlayer(effect.fromId);
        const to = this.game.getPlayer(effect.toId);
        if (from && to) {
          const actual = Math.min(effect.amount, from.coins);
          from.removeCoins(actual);
          to.addCoins(actual);
        }
        break;
      }
      case 'reveal_influence': {
        const player = this.game.getPlayer(effect.playerId);
        if (player) {
          player.revealInfluence(effect.influenceIndex);
        }
        break;
      }
      case 'replace_influence': {
        const player = this.game.getPlayer(effect.playerId);
        if (player) {
          // Return old card to deck, give new card
          this.game.deck.returnAndShuffle(effect.oldCharacter);
          player.replaceInfluence(effect.oldCharacter, effect.newCharacter);
        }
        break;
      }
      case 'eliminate_check': {
        const player = this.game.getPlayer(effect.playerId);
        if (player && !player.isAlive) {
          this.game.eliminatePlayer(player);
        }
        break;
      }
      case 'advance_turn': {
        this.clearTimer();
        this.game.advanceTurn();
        // Set turn timer for next player's action (if game is still in progress)
        if (this.turnTimerMs > 0 && this.game.turnPhase === TurnPhase.AwaitingAction) {
          this.timerExpiry = Date.now() + this.turnTimerMs;
          this.timerHandle = setTimeout(() => {
            this.handleTimerExpiry();
          }, this.turnTimerMs);
        }
        break;
      }
      case 'set_timer': {
        this.clearTimer();
        this.timerExpiry = Date.now() + effect.durationMs;
        this.timerHandle = setTimeout(() => {
          this.handleTimerExpiry();
        }, effect.durationMs);
        break;
      }
      case 'clear_timer': {
        this.clearTimer();
        break;
      }
      case 'log': {
        this.game.log(effect.message, effect.eventType, effect.character, effect.actorId, effect.actorName, effect.targetId, effect.wasBluff);
        break;
      }
      case 'start_exchange': {
        // Exchange state is set in applyResult
        const exchPlayer = this.game.getPlayer(effect.playerId);
        this.game.log(
          `${exchPlayer?.name} draws cards for exchange.`,
          'exchange_draw',
          Character.Ambassador,
          effect.playerId,
          exchPlayer?.name ?? null,
        );
        break;
      }
      case 'win_check': {
        this.game.checkWinCondition();
        break;
      }
      case 'challenge_reveal': {
        this.lastChallengeReveal = {
          challengerName: effect.challengerName,
          challengedName: effect.challengedName,
          character: effect.character,
          wasGenuine: effect.wasGenuine,
        };
        break;
      }
      case 'transfer_to_reserve': {
        const player = this.game.getPlayer(effect.playerId);
        if (player) {
          const actual = Math.min(effect.amount, player.coins);
          player.removeCoins(actual);
          this.game.treasuryReserve += actual;
        }
        break;
      }
      case 'take_from_reserve': {
        const player = this.game.getPlayer(effect.playerId);
        if (player) {
          const actual = this.game.treasuryReserve;
          this.game.treasuryReserve = 0;
          player.addCoins(actual);
        }
        break;
      }
      case 'change_faction': {
        const player = this.game.getPlayer(effect.playerId);
        if (player) {
          player.faction = effect.newFaction;
        }
        break;
      }
    }
  }

  private clearTurnState(): void {
    this.pendingAction = null;
    this.pendingBlock = null;
    this.challengeState = null;
    this.influenceLossRequest = null;
    this.exchangeState = null;
    this.examineState = null;
    this.blockPassedPlayerIds = null;
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.timerHandle) {
      clearTimeout(this.timerHandle);
      this.timerHandle = null;
    }
    this.timerExpiry = null;
  }

  private broadcastState(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getFullState());
    }
  }
}
