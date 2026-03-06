import {
  ActionType,
  Character,
  ExamineState,
  Faction,
  TurnPhase,
  PendingAction,
  PendingBlock,
  ChallengeState,
  InfluenceLossRequest,
  ExchangeState,
  LogEventType,
} from '../shared/types';
import {
  ACTION_DEFINITIONS,
  ACTION_DISPLAY_NAMES,
  CHALLENGE_TIMER_MS,
  BLOCK_TIMER_MS,
  FORCED_COUP_THRESHOLD,
  EXCHANGE_DRAW_COUNT,
  INQUISITOR_EXCHANGE_DRAW_COUNT,
  CONVERSION_SELF_COST,
  CONVERSION_OTHER_COST,
} from '../shared/constants';
import type { ChallengeRevealEvent } from '../shared/types';
import { Game } from './Game';
import { Player } from './Player';

/**
 * Side effects produced by the resolver.
 * The GameEngine applies these to the actual game state.
 */
export type SideEffect =
  | { type: 'give_coins'; playerId: string; amount: number }
  | { type: 'take_coins'; playerId: string; amount: number }
  | { type: 'transfer_coins'; fromId: string; toId: string; amount: number }
  | { type: 'reveal_influence'; playerId: string; influenceIndex: number }
  | { type: 'replace_influence'; playerId: string; oldCharacter: Character; newCharacter: Character }
  | { type: 'eliminate_check'; playerId: string }
  | { type: 'advance_turn' }
  | { type: 'set_timer'; durationMs: number }
  | { type: 'clear_timer' }
  | { type: 'log'; message: string; eventType: LogEventType; character: Character | null; actorId: string | null; actorName: string | null; targetId?: string | null; wasBluff?: boolean }
  | { type: 'start_exchange'; playerId: string; drawnCards: Character[] }
  | { type: 'win_check' }
  | { type: 'challenge_reveal'; challengerName: string; challengedName: string; character: Character; wasGenuine: boolean }
  // Reformation expansion
  | { type: 'transfer_to_reserve'; playerId: string; amount: number }
  | { type: 'take_from_reserve'; playerId: string }
  | { type: 'change_faction'; playerId: string; newFaction: Faction };

export interface ResolverResult {
  newPhase: TurnPhase;
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  challengeState: ChallengeState | null;
  influenceLossRequest: InfluenceLossRequest | null;
  exchangeState: ExchangeState | null;
  examineState?: ExamineState | null;
  sideEffects: SideEffect[];
  /** Players who should be auto-passed in the block phase (e.g., a challenger who already chose to challenge cannot also block) */
  blockAutoPassIds?: string[];
}

export class ActionResolver {
  private timerMs: number;

  constructor(timerMs?: number) {
    this.timerMs = timerMs ?? CHALLENGE_TIMER_MS;
  }

  /**
   * Player declares an action.
   */
  declareAction(
    game: Game,
    actorId: string,
    actionType: ActionType,
    targetId?: string,
  ): ResolverResult | { error: string } {
    const actor = game.getPlayer(actorId);
    if (!actor) return { error: 'Player not found' };
    if (!actor.isAlive) return { error: 'You are eliminated' };
    if (game.currentPlayer.id !== actorId) return { error: 'Not your turn' };
    if (game.turnPhase !== TurnPhase.AwaitingAction) return { error: 'Not awaiting action' };

    const def = ACTION_DEFINITIONS[actionType];

    // Must Coup if 10+ coins
    if (actor.coins >= FORCED_COUP_THRESHOLD && actionType !== ActionType.Coup) {
      return { error: 'You must Coup when you have 10 or more coins' };
    }

    // Check cost
    if (actor.coins < def.cost) {
      return { error: `Not enough coins (need ${def.cost}, have ${actor.coins})` };
    }

    // Check target requirements
    if (def.requiresTarget) {
      if (!targetId) return { error: 'This action requires a target' };
      const target = game.getPlayer(targetId);
      if (!target) return { error: 'Target not found' };
      if (!target.isAlive) return { error: 'Target is eliminated' };
      if (targetId === actorId) return { error: 'Cannot target yourself' };
    }

    // Check steal from player with 0 coins
    if (actionType === ActionType.Steal) {
      const target = game.getPlayer(targetId!);
      if (target && target.coins === 0) {
        return { error: 'Target has no coins to steal' };
      }
    }

    // Faction restriction check (Reformation mode)
    if (targetId && [ActionType.Coup, ActionType.Assassinate, ActionType.Steal, ActionType.Examine].includes(actionType)) {
      if (game.isFactionRestricted(actorId, targetId)) {
        return { error: 'Cannot target a player on your same faction' };
      }
    }

    // ─── Convert (Reformation only) ───
    if (actionType === ActionType.Convert) {
      return this.resolveConvert(game, actor, targetId);
    }

    // ─── Embezzle (Reformation only) ───
    if (actionType === ActionType.Embezzle) {
      return this.resolveEmbezzle(game, actor);
    }

    // Determine claimed character — override for Exchange in Inquisitor mode
    let claimedCharacter = def.claimedCharacter ?? undefined;
    if (actionType === ActionType.Exchange && this.isInquisitorMode(game)) {
      claimedCharacter = Character.Inquisitor;
    }

    const pendingAction: PendingAction = {
      type: actionType,
      actorId,
      targetId,
      claimedCharacter,
    };

    const sideEffects: SideEffect[] = [];

    // Pay cost immediately (refunded if action fails)
    if (def.cost > 0) {
      sideEffects.push({ type: 'take_coins', playerId: actorId, amount: def.cost });
    }

    // Determine next phase
    // Income and Coup cannot be challenged or blocked
    if (actionType === ActionType.Income) {
      sideEffects.push({ type: 'give_coins', playerId: actorId, amount: 1 });
      sideEffects.push({ type: 'log', message: `${actor.name} takes Income (+1 coin).`, eventType: 'income', character: null, actorId, actorName: actor.name });
      sideEffects.push({ type: 'advance_turn' });
      return this.resolved(sideEffects);
    }

    if (actionType === ActionType.Coup) {
      sideEffects.push({ type: 'log', message: `${actor.name} launches a Coup against ${game.getPlayer(targetId!)?.name}.`, eventType: 'coup', character: null, actorId, actorName: actor.name, targetId });
      // Target must lose influence
      return {
        newPhase: TurnPhase.AwaitingInfluenceLoss,
        pendingAction,
        pendingBlock: null,
        challengeState: null,
        influenceLossRequest: { playerId: targetId!, reason: 'coup' },
        exchangeState: null,
        sideEffects,
      };
    }

    // Log the action declaration
    const targetName = targetId ? game.getPlayer(targetId)?.name : null;
    if (claimedCharacter) {
      const targetPart = targetName ? ` targeting ${targetName}` : '';
      sideEffects.push({
        type: 'log',
        message: `${actor.name} claims ${claimedCharacter} to ${ACTION_DISPLAY_NAMES[actionType]}${targetPart}.`,
        eventType: 'claim_action',
        character: claimedCharacter,
        actorId,
        actorName: actor.name,
        targetId: targetId || null,
        wasBluff: !actor.hasCharacter(claimedCharacter),
      });
    } else {
      sideEffects.push({
        type: 'log',
        message: `${actor.name} declares ${ACTION_DISPLAY_NAMES[actionType]}.`,
        eventType: 'declare_action',
        character: null,
        actorId,
        actorName: actor.name,
        targetId: targetId || null,
      });
    }

    // Challengeable actions go to challenge phase
    if (def.challengeable) {
      sideEffects.push({ type: 'set_timer', durationMs: this.timerMs });
      return {
        newPhase: TurnPhase.AwaitingActionChallenge,
        pendingAction,
        pendingBlock: null,
        challengeState: {
          challengerId: '',
          challengedPlayerId: actorId,
          claimedCharacter: claimedCharacter!,
          passedPlayerIds: [actorId], // Actor can't challenge themselves
        },
        influenceLossRequest: null,
        exchangeState: null,
        sideEffects,
      };
    }

    // Non-challengeable but blockable (only Foreign Aid)
    if (def.blockedBy.length > 0) {
      sideEffects.push({ type: 'set_timer', durationMs: this.timerMs });
      return {
        newPhase: TurnPhase.AwaitingBlock,
        pendingAction,
        pendingBlock: null,
        challengeState: null,
        influenceLossRequest: null,
        exchangeState: null,
        sideEffects,
      };
    }

    // Should not reach here with current rules
    return this.resolved(sideEffects);
  }

  /**
   * A player challenges the action claim.
   */
  challenge(
    game: Game,
    challengerId: string,
    pendingAction: PendingAction,
    challengeState: ChallengeState,
  ): ResolverResult | { error: string } {
    const challenger = game.getPlayer(challengerId);
    if (!challenger || !challenger.isAlive) return { error: 'Invalid challenger' };
    if (challengerId === pendingAction.actorId) return { error: 'Cannot challenge your own action' };
    if (challengeState.passedPlayerIds.includes(challengerId)) return { error: 'You already passed' };

    // Embezzle uses inverse challenge logic
    if (pendingAction.type === ActionType.Embezzle) {
      return this.challengeEmbezzle(game, challengerId, pendingAction, challengeState);
    }

    const challenged = game.getPlayer(pendingAction.actorId)!;
    const claimedChar = pendingAction.claimedCharacter!;
    const sideEffects: SideEffect[] = [
      { type: 'clear_timer' },
      { type: 'log', message: `${challenger.name} challenges ${challenged.name}'s claim of ${claimedChar}!`, eventType: 'challenge', character: claimedChar, actorId: challengerId, actorName: challenger.name },
    ];

    if (challenged.hasCharacter(claimedChar)) {
      // Challenge FAILS — challenger loses influence
      sideEffects.push({
        type: 'challenge_reveal',
        challengerName: challenger.name,
        challengedName: challenged.name,
        character: claimedChar,
        wasGenuine: true,
      });
      sideEffects.push({
        type: 'log',
        message: `${challenged.name} reveals ${claimedChar} — challenge fails! ${challenger.name} must lose an influence.`,
        eventType: 'challenge_fail',
        character: claimedChar,
        actorId: challenged.id,
        actorName: challenged.name,
      });

      // Challenged player gets a replacement card (skip if this challenge ends the game)
      const isGameEnding = challenger.aliveInfluenceCount === 1 && game.getAlivePlayers().length === 2;
      if (!isGameEnding) {
        const newCard = game.deck.draw();
        if (newCard) {
          sideEffects.push({
            type: 'replace_influence',
            playerId: challenged.id,
            oldCharacter: claimedChar,
            newCharacter: newCard,
          });
        }
      }

      // Challenger must lose an influence
      if (challenger.aliveInfluenceCount === 1) {
        // Auto-reveal their only influence
        const idx = challenger.influences.findIndex(inf => !inf.revealed);
        sideEffects.push({ type: 'reveal_influence', playerId: challengerId, influenceIndex: idx });
        sideEffects.push({ type: 'eliminate_check', playerId: challengerId });

        // Action still proceeds — move to block phase or resolve
        return this.afterSuccessfulActionChallengeDefense(game, pendingAction, sideEffects, challengerId);
      }

      // Challenger must choose which influence to lose
      return {
        newPhase: TurnPhase.AwaitingInfluenceLoss,
        pendingAction,
        pendingBlock: null,
        challengeState: { ...challengeState, challengerId },
        influenceLossRequest: { playerId: challengerId, reason: 'challenge_lost' },
        exchangeState: null,
        sideEffects,
      };
    } else {
      // Challenge SUCCEEDS — challenged player loses influence, action cancelled
      sideEffects.push({
        type: 'challenge_reveal',
        challengerName: challenger.name,
        challengedName: challenged.name,
        character: claimedChar,
        wasGenuine: false,
      });
      sideEffects.push({
        type: 'log',
        message: `${challenged.name} does NOT have ${claimedChar} — challenge succeeds!`,
        eventType: 'challenge_success',
        character: claimedChar,
        actorId: challengerId,
        actorName: challenger.name,
        targetId: challenged.id,
      });

      // Refund action cost — per official rules, a successfully challenged action returns the cost
      const def = ACTION_DEFINITIONS[pendingAction.type];
      if (def.cost > 0) {
        sideEffects.push({ type: 'give_coins', playerId: pendingAction.actorId, amount: def.cost });
      }

      if (challenged.aliveInfluenceCount === 1) {
        const idx = challenged.influences.findIndex(inf => !inf.revealed);
        sideEffects.push({ type: 'reveal_influence', playerId: challenged.id, influenceIndex: idx });
        sideEffects.push({ type: 'eliminate_check', playerId: challenged.id });
        sideEffects.push({ type: 'win_check' });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
      }

      // Challenged player must choose which influence to lose
      return {
        newPhase: TurnPhase.AwaitingInfluenceLoss,
        pendingAction: null, // Action cancelled
        pendingBlock: null,
        challengeState: { ...challengeState, challengerId },
        influenceLossRequest: { playerId: challenged.id, reason: 'challenge_failed_defense' },
        exchangeState: null,
        sideEffects,
      };
    }
  }

  /**
   * After a challenge on the action fails (defender proved they had the card),
   * the action proceeds. Move to block phase or resolve.
   * The challenger cannot also block (per Coup rules: choose challenge OR block, not both).
   */
  private afterSuccessfulActionChallengeDefense(
    game: Game,
    pendingAction: PendingAction,
    sideEffects: SideEffect[],
    challengerId: string,
  ): ResolverResult {
    const def = ACTION_DEFINITIONS[pendingAction.type];

    // If blockable, go to block phase
    if (def.blockedBy.length > 0) {
      sideEffects.push({ type: 'set_timer', durationMs: this.timerMs });
      return {
        newPhase: TurnPhase.AwaitingBlock,
        pendingAction,
        pendingBlock: null,
        challengeState: null,
        influenceLossRequest: null,
        exchangeState: null,
        sideEffects,
        blockAutoPassIds: [challengerId],
      };
    }

    // Otherwise resolve the action
    return this.resolveAction(game, pendingAction, sideEffects);
  }

  /**
   * All eligible players have passed on challenging. Move to block or resolve.
   */
  allPassedChallenge(
    game: Game,
    pendingAction: PendingAction,
  ): ResolverResult {
    const def = ACTION_DEFINITIONS[pendingAction.type];
    const sideEffects: SideEffect[] = [{ type: 'clear_timer' }];

    if (def.blockedBy.length > 0) {
      sideEffects.push({ type: 'set_timer', durationMs: this.timerMs });
      return {
        newPhase: TurnPhase.AwaitingBlock,
        pendingAction,
        pendingBlock: null,
        challengeState: null,
        influenceLossRequest: null,
        exchangeState: null,
        sideEffects,
      };
    }

    return this.resolveAction(game, pendingAction, sideEffects);
  }

  /**
   * A player blocks the action.
   */
  block(
    game: Game,
    blockerId: string,
    claimedCharacter: Character,
    pendingAction: PendingAction,
  ): ResolverResult | { error: string } {
    const blocker = game.getPlayer(blockerId);
    if (!blocker || !blocker.isAlive) return { error: 'Invalid blocker' };
    if (blockerId === pendingAction.actorId) return { error: 'Cannot block your own action' };

    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (!def.blockedBy.includes(claimedCharacter)) {
      return { error: `${claimedCharacter} cannot block ${pendingAction.type}` };
    }

    // For Steal/Assassinate blocks, only the target can block (Contessa) or any player (Captain/Ambassador for steal)
    // Actually per Coup rules: Foreign Aid can be blocked by any player claiming Duke
    // Steal can be blocked by target claiming Captain or Ambassador
    // Assassinate can be blocked by target claiming Contessa
    if (pendingAction.type === ActionType.Assassinate && blockerId !== pendingAction.targetId) {
      return { error: 'Only the target can block an assassination' };
    }
    if (pendingAction.type === ActionType.Steal && blockerId !== pendingAction.targetId) {
      return { error: 'Only the target can block a steal' };
    }

    const sideEffects: SideEffect[] = [
      { type: 'clear_timer' },
      { type: 'log', message: `${blocker.name} blocks with ${claimedCharacter}!`, eventType: 'block', character: claimedCharacter, actorId: blockerId, actorName: blocker.name, wasBluff: !blocker.hasCharacter(claimedCharacter) },
      { type: 'set_timer', durationMs: this.timerMs },
    ];

    const pendingBlock: PendingBlock = { blockerId, claimedCharacter };

    // Only the blocker cannot challenge their own block — everyone else can
    const passedPlayerIds = game.getAlivePlayers()
      .filter(p => p.id === blockerId)
      .map(p => p.id);

    return {
      newPhase: TurnPhase.AwaitingBlockChallenge,
      pendingAction,
      pendingBlock,
      challengeState: {
        challengerId: '',
        challengedPlayerId: blockerId,
        claimedCharacter,
        passedPlayerIds,
      },
      influenceLossRequest: null,
      exchangeState: null,
      sideEffects,
    };
  }

  /**
   * All players pass on blocking. Action resolves.
   */
  allPassedBlock(
    game: Game,
    pendingAction: PendingAction,
  ): ResolverResult {
    const sideEffects: SideEffect[] = [{ type: 'clear_timer' }];
    return this.resolveAction(game, pendingAction, sideEffects);
  }

  /**
   * A player challenges the block.
   */
  challengeBlock(
    game: Game,
    challengerId: string,
    pendingAction: PendingAction,
    pendingBlock: PendingBlock,
    challengeState: ChallengeState,
  ): ResolverResult | { error: string } {
    const challenger = game.getPlayer(challengerId);
    if (!challenger || !challenger.isAlive) return { error: 'Invalid challenger' };
    // The blocker cannot challenge their own block
    if (challengerId === pendingBlock.blockerId) return { error: 'Cannot challenge your own block' };

    const blocker = game.getPlayer(pendingBlock.blockerId)!;
    const claimedChar = pendingBlock.claimedCharacter;
    const sideEffects: SideEffect[] = [
      { type: 'clear_timer' },
      { type: 'log', message: `${challenger.name} challenges ${blocker.name}'s block with ${claimedChar}!`, eventType: 'block_challenge', character: claimedChar, actorId: challengerId, actorName: challenger.name },
    ];

    if (blocker.hasCharacter(claimedChar)) {
      // Block challenge FAILS — blocker proves they have the card
      // Challenger (actor) loses influence, action is blocked
      sideEffects.push({
        type: 'challenge_reveal',
        challengerName: challenger.name,
        challengedName: blocker.name,
        character: claimedChar,
        wasGenuine: true,
      });
      sideEffects.push({
        type: 'log',
        message: `${blocker.name} reveals ${claimedChar} — block stands! ${challenger.name} must lose an influence.`,
        eventType: 'block_challenge_fail',
        character: claimedChar,
        actorId: blocker.id,
        actorName: blocker.name,
      });

      // Blocker gets replacement (skip if this challenge ends the game)
      const isGameEnding = challenger.aliveInfluenceCount === 1 && game.getAlivePlayers().length === 2;
      if (!isGameEnding) {
        const newCard = game.deck.draw();
        if (newCard) {
          sideEffects.push({
            type: 'replace_influence',
            playerId: blocker.id,
            oldCharacter: claimedChar,
            newCharacter: newCard,
          });
        }
      }

      // No cost refund — per official rules, a counteracted action's cost remains spent

      if (challenger.aliveInfluenceCount === 1) {
        const idx = challenger.influences.findIndex(inf => !inf.revealed);
        sideEffects.push({ type: 'reveal_influence', playerId: challengerId, influenceIndex: idx });
        sideEffects.push({ type: 'eliminate_check', playerId: challengerId });
        sideEffects.push({ type: 'win_check' });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
      }

      // Challenger must choose influence to lose
      return {
        newPhase: TurnPhase.AwaitingInfluenceLoss,
        pendingAction: null, // Action blocked
        pendingBlock,
        challengeState: { ...challengeState, challengerId },
        influenceLossRequest: { playerId: challengerId, reason: 'challenge_lost' },
        exchangeState: null,
        sideEffects,
      };
    } else {
      // Block challenge SUCCEEDS — blocker lied, action proceeds
      sideEffects.push({
        type: 'challenge_reveal',
        challengerName: challenger.name,
        challengedName: blocker.name,
        character: claimedChar,
        wasGenuine: false,
      });
      sideEffects.push({
        type: 'log',
        message: `${blocker.name} does NOT have ${claimedChar} — block fails! Action proceeds.`,
        eventType: 'block_challenge_success',
        character: claimedChar,
        actorId: challengerId,
        actorName: challenger.name,
        targetId: blocker.id,
      });

      if (blocker.aliveInfluenceCount === 1) {
        const idx = blocker.influences.findIndex(inf => !inf.revealed);
        sideEffects.push({ type: 'reveal_influence', playerId: blocker.id, influenceIndex: idx });
        sideEffects.push({ type: 'eliminate_check', playerId: blocker.id });

        // Action proceeds
        return this.resolveAction(game, pendingAction, sideEffects);
      }

      // Blocker must choose influence to lose, then action resolves
      return {
        newPhase: TurnPhase.AwaitingInfluenceLoss,
        pendingAction, // Action will still resolve
        pendingBlock: null,
        challengeState: { ...challengeState, challengerId },
        influenceLossRequest: { playerId: blocker.id, reason: 'challenge_failed_defense' },
        exchangeState: null,
        sideEffects,
      };
    }
  }

  /**
   * All players pass on challenging the block. Block succeeds, action cancelled.
   */
  allPassedBlockChallenge(
    game: Game,
    pendingAction: PendingAction,
  ): ResolverResult {
    const sideEffects: SideEffect[] = [
      { type: 'clear_timer' },
      { type: 'log', message: 'Block is not challenged — action is blocked.', eventType: 'block_unchallenged', character: null, actorId: null, actorName: null },
    ];

    // No cost refund — per official rules, a counteracted action's cost remains spent

    sideEffects.push({ type: 'advance_turn' });
    return this.resolved(sideEffects);
  }

  /**
   * Player chooses which influence to lose.
   */
  chooseInfluenceLoss(
    game: Game,
    playerId: string,
    influenceIndex: number,
    pendingAction: PendingAction | null,
    influenceLossRequest: InfluenceLossRequest,
  ): ResolverResult | { error: string } {
    const player = game.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };
    if (influenceLossRequest.playerId !== playerId) return { error: 'Not your turn to lose influence' };

    if (influenceIndex < 0 || influenceIndex >= player.influences.length) {
      return { error: 'Invalid influence index' };
    }
    if (player.influences[influenceIndex].revealed) {
      return { error: 'That influence is already revealed' };
    }

    const revealedChar = player.influences[influenceIndex].character;
    const sideEffects: SideEffect[] = [
      { type: 'reveal_influence', playerId, influenceIndex },
      { type: 'log', message: `${player.name} loses ${revealedChar}.`, eventType: 'influence_loss', character: revealedChar, actorId: playerId, actorName: player.name },
      { type: 'eliminate_check', playerId },
    ];

    const { reason } = influenceLossRequest;

    // Always clear any lingering timer when influence loss resolves
    sideEffects.push({ type: 'clear_timer' });

    if (reason === 'coup') {
      // Coup resolved, advance turn
      sideEffects.push({ type: 'win_check' });
      sideEffects.push({ type: 'advance_turn' });
      return this.resolved(sideEffects);
    }

    if (reason === 'challenge_failed_defense') {
      if (pendingAction) {
        // Block challenge succeeded (blocker was bluffing) — original action proceeds
        return this.resolveAction(game, pendingAction, sideEffects);
      }
      // Action challenge succeeded (actor was bluffing) — action cancelled, advance turn
      sideEffects.push({ type: 'win_check' });
      sideEffects.push({ type: 'advance_turn' });
      return this.resolved(sideEffects);
    }

    if (reason === 'challenge_lost') {
      // Challenger lost — the action still proceeds
      // The challenger (playerId) cannot also block (challenge OR block, not both)
      if (pendingAction) {
        // Check if there's a block phase after
        const def = ACTION_DEFINITIONS[pendingAction.type];
        if (def.blockedBy.length > 0) {
          // Check if the target is still alive to block
          // If the challenger IS the target, they already chose to challenge so they can't block
          const targetAlive = pendingAction.targetId
            ? game.getPlayer(pendingAction.targetId)?.isAlive ?? false
            : true;
          const challengerIsTarget = pendingAction.targetId === playerId;
          if (targetAlive && !challengerIsTarget) {
            sideEffects.push({ type: 'set_timer', durationMs: this.timerMs });
            return {
              newPhase: TurnPhase.AwaitingBlock,
              pendingAction,
              pendingBlock: null,
              challengeState: null,
              influenceLossRequest: null,
              exchangeState: null,
              sideEffects,
              blockAutoPassIds: [playerId],
            };
          }
          // If challenger IS the target, they forfeited their block — resolve action directly
          if (challengerIsTarget) {
            return this.resolveAction(game, pendingAction, sideEffects);
          }
        }
        return this.resolveAction(game, pendingAction, sideEffects);
      }
      // If pendingAction is null, the block challenge was lost → block succeeds → advance
      sideEffects.push({ type: 'advance_turn' });
      return this.resolved(sideEffects);
    }

    if (reason === 'assassination') {
      sideEffects.push({ type: 'win_check' });
      sideEffects.push({ type: 'advance_turn' });
      return this.resolved(sideEffects);
    }

    // Fallback
    sideEffects.push({ type: 'win_check' });
    sideEffects.push({ type: 'advance_turn' });
    return this.resolved(sideEffects);
  }

  /**
   * Player chooses cards to keep during Exchange.
   */
  chooseExchange(
    game: Game,
    playerId: string,
    keepIndices: number[],
    exchangeState: ExchangeState,
    pendingAction: PendingAction,
  ): ResolverResult | { error: string } {
    const player = game.getPlayer(playerId);
    if (!player) return { error: 'Player not found' };
    if (exchangeState.playerId !== playerId) return { error: 'Not your exchange' };

    const allCards = [...player.hiddenCharacters, ...exchangeState.drawnCards];
    const expectedKeep = player.aliveInfluenceCount;

    if (keepIndices.length !== expectedKeep) {
      return { error: `Must keep exactly ${expectedKeep} card(s)` };
    }

    // Validate indices
    for (const idx of keepIndices) {
      if (idx < 0 || idx >= allCards.length) {
        return { error: 'Invalid card index' };
      }
    }

    // Check for duplicate indices
    if (new Set(keepIndices).size !== keepIndices.length) {
      return { error: 'Duplicate card indices' };
    }

    const keptCards = keepIndices.map(i => allCards[i]);
    const returnedCards = allCards.filter((_, i) => !keepIndices.includes(i));

    const exchangeChar = pendingAction.claimedCharacter === Character.Inquisitor ? Character.Inquisitor : Character.Ambassador;
    const sideEffects: SideEffect[] = [
      { type: 'log', message: `${player.name} completes the exchange.`, eventType: 'exchange', character: exchangeChar, actorId: playerId, actorName: player.name },
    ];

    // Return cards to deck
    for (const card of returnedCards) {
      game.deck.returnCard(card);
    }
    game.deck.shuffle();

    // Update player's influences
    let keptIndex = 0;
    for (let i = 0; i < player.influences.length; i++) {
      if (!player.influences[i].revealed) {
        player.influences[i].character = keptCards[keptIndex];
        keptIndex++;
      }
    }

    sideEffects.push({ type: 'advance_turn' });
    return this.resolved(sideEffects);
  }

  /**
   * Resolve the action effects (after all challenges/blocks are done).
   */
  private resolveAction(
    game: Game,
    pendingAction: PendingAction,
    existingEffects: SideEffect[],
  ): ResolverResult {
    const sideEffects = [...existingEffects];
    const actor = game.getPlayer(pendingAction.actorId)!;

    switch (pendingAction.type) {
      case ActionType.Tax:
        sideEffects.push({ type: 'give_coins', playerId: actor.id, amount: 3 });
        sideEffects.push({ type: 'log', message: `${actor.name} collects Tax (+3 coins).`, eventType: 'action_resolve', character: Character.Duke, actorId: actor.id, actorName: actor.name });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);

      case ActionType.ForeignAid:
        sideEffects.push({ type: 'give_coins', playerId: actor.id, amount: 2 });
        sideEffects.push({ type: 'log', message: `${actor.name} takes Foreign Aid (+2 coins).`, eventType: 'action_resolve', character: null, actorId: actor.id, actorName: actor.name });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);

      case ActionType.Steal: {
        const target = game.getPlayer(pendingAction.targetId!)!;
        const stealAmount = Math.min(2, target.coins);
        sideEffects.push({
          type: 'transfer_coins',
          fromId: target.id,
          toId: actor.id,
          amount: stealAmount,
        });
        sideEffects.push({
          type: 'log',
          message: `${actor.name} steals ${stealAmount} coin(s) from ${target.name}.`,
          eventType: 'action_resolve',
          character: Character.Captain,
          actorId: actor.id,
          actorName: actor.name,
          targetId: target.id,
        });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
      }

      case ActionType.Assassinate: {
        const target = game.getPlayer(pendingAction.targetId!)!;
        // Check if target is still alive (may have lost influence from challenge)
        if (!target.isAlive) {
          sideEffects.push({ type: 'advance_turn' });
          return this.resolved(sideEffects);
        }

        if (target.aliveInfluenceCount === 1) {
          const idx = target.influences.findIndex(inf => !inf.revealed);
          sideEffects.push({ type: 'reveal_influence', playerId: target.id, influenceIndex: idx });
          sideEffects.push({ type: 'log', message: `${target.name} loses an influence to assassination.`, eventType: 'assassination', character: Character.Assassin, actorId: actor.id, actorName: actor.name, targetId: target.id });
          sideEffects.push({ type: 'eliminate_check', playerId: target.id });
          sideEffects.push({ type: 'win_check' });
          sideEffects.push({ type: 'advance_turn' });
          return this.resolved(sideEffects);
        }

        // Target chooses which influence to lose
        sideEffects.push({ type: 'log', message: `${target.name} must lose an influence to assassination.`, eventType: 'assassination', character: Character.Assassin, actorId: actor.id, actorName: actor.name, targetId: target.id });
        return {
          newPhase: TurnPhase.AwaitingInfluenceLoss,
          pendingAction,
          pendingBlock: null,
          challengeState: null,
          influenceLossRequest: { playerId: target.id, reason: 'assassination' },
          exchangeState: null,
          sideEffects,
        };
      }

      case ActionType.Exchange: {
        // Inquisitor draws 1 card, Ambassador draws 2
        const isInquisitor = pendingAction.claimedCharacter === Character.Inquisitor;
        const drawCount = isInquisitor ? INQUISITOR_EXCHANGE_DRAW_COUNT : EXCHANGE_DRAW_COUNT;
        const drawnCards = game.deck.drawMultiple(drawCount);
        sideEffects.push({ type: 'start_exchange', playerId: actor.id, drawnCards });
        return {
          newPhase: TurnPhase.AwaitingExchange,
          pendingAction,
          pendingBlock: null,
          challengeState: null,
          influenceLossRequest: null,
          exchangeState: { playerId: actor.id, drawnCards },
          sideEffects,
        };
      }

      case ActionType.Examine: {
        // Inquisitor examines one of target's face-down cards
        const target = game.getPlayer(pendingAction.targetId!)!;
        if (!target.isAlive) {
          sideEffects.push({ type: 'advance_turn' });
          return this.resolved(sideEffects);
        }
        // Pick the first unrevealed influence (in real game, target chooses — simplified to first)
        const hiddenIndices = target.influences
          .map((inf, i) => ({ inf, i }))
          .filter(({ inf }) => !inf.revealed);
        if (hiddenIndices.length === 0) {
          sideEffects.push({ type: 'advance_turn' });
          return this.resolved(sideEffects);
        }
        // If target has only 1 hidden card, examine that one. Otherwise pick random.
        const examIdx = hiddenIndices.length === 1 ? hiddenIndices[0].i : hiddenIndices[0].i;
        const revealedCard = target.influences[examIdx].character;

        sideEffects.push({
          type: 'log',
          message: `${actor.name} examines one of ${target.name}'s cards.`,
          eventType: 'examine',
          character: Character.Inquisitor,
          actorId: actor.id,
          actorName: actor.name,
          targetId: target.id,
        });

        return {
          newPhase: TurnPhase.AwaitingExamineDecision,
          pendingAction,
          pendingBlock: null,
          challengeState: null,
          influenceLossRequest: null,
          exchangeState: null,
          examineState: {
            examinerId: actor.id,
            targetId: target.id,
            revealedCard,
            influenceIndex: examIdx,
          },
          sideEffects,
        };
      }

      case ActionType.Embezzle: {
        sideEffects.push({ type: 'take_from_reserve', playerId: actor.id });
        sideEffects.push({
          type: 'log',
          message: `${actor.name} embezzles the Treasury Reserve!`,
          eventType: 'embezzle',
          character: null,
          actorId: actor.id,
          actorName: actor.name,
        });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
      }

      default:
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
    }
  }

  /** Check if game is using Inquisitor instead of Ambassador */
  private isInquisitorMode(game: Game): boolean {
    // Check if any Inquisitor cards exist in the deck or player hands
    const deckHasInquisitor = game.deck.getCards().some(c => c === Character.Inquisitor);
    const playersHaveInquisitor = game.getAlivePlayers().some(p =>
      p.influences.some(inf => inf.character === Character.Inquisitor),
    );
    return deckHasInquisitor || playersHaveInquisitor;
  }

  /**
   * Resolve Convert action (Reformation only).
   * Self-convert: pay 1 coin to treasury reserve, flip own faction.
   * Other-convert: pay 2 coins to treasury reserve, flip target's faction.
   */
  private resolveConvert(
    game: Game,
    actor: Player,
    targetId?: string,
  ): ResolverResult | { error: string } {
    if (game.gameMode !== 'Reformation') {
      return { error: 'Convert is only available in Reformation mode' };
    }

    const sideEffects: SideEffect[] = [];
    const isSelf = !targetId || targetId === actor.id;
    const cost = isSelf ? CONVERSION_SELF_COST : CONVERSION_OTHER_COST;

    if (actor.coins < cost) {
      return { error: `Not enough coins (need ${cost}, have ${actor.coins})` };
    }

    // Pay to treasury reserve
    sideEffects.push({ type: 'transfer_to_reserve', playerId: actor.id, amount: cost });

    if (isSelf) {
      const newFaction = actor.faction === Faction.Loyalist ? Faction.Reformist : Faction.Loyalist;
      sideEffects.push({ type: 'change_faction', playerId: actor.id, newFaction });
      sideEffects.push({
        type: 'log',
        message: `${actor.name} converts to ${newFaction} (${cost} coin to Treasury Reserve).`,
        eventType: 'convert',
        character: null,
        actorId: actor.id,
        actorName: actor.name,
      });
    } else {
      const target = game.getPlayer(targetId!);
      if (!target || !target.isAlive) return { error: 'Target not found or eliminated' };
      const newFaction = target.faction === Faction.Loyalist ? Faction.Reformist : Faction.Loyalist;
      sideEffects.push({ type: 'change_faction', playerId: target.id, newFaction });
      sideEffects.push({
        type: 'log',
        message: `${actor.name} converts ${target.name} to ${newFaction} (${cost} coins to Treasury Reserve).`,
        eventType: 'convert',
        character: null,
        actorId: actor.id,
        actorName: actor.name,
        targetId: target.id,
      });
    }

    sideEffects.push({ type: 'advance_turn' });
    return this.resolved(sideEffects);
  }

  /**
   * Resolve Embezzle action (Reformation only).
   * Take all coins from Treasury Reserve.
   * Inverse challenge: player claims NOT to have Duke.
   */
  private resolveEmbezzle(
    game: Game,
    actor: Player,
  ): ResolverResult | { error: string } {
    if (game.gameMode !== 'Reformation') {
      return { error: 'Embezzle is only available in Reformation mode' };
    }

    if (game.treasuryReserve === 0) {
      return { error: 'Treasury Reserve is empty' };
    }

    const sideEffects: SideEffect[] = [];

    sideEffects.push({
      type: 'log',
      message: `${actor.name} claims to NOT have Duke and attempts to embezzle the Treasury Reserve (${game.treasuryReserve} coins).`,
      eventType: 'claim_action',
      character: Character.Duke,
      actorId: actor.id,
      actorName: actor.name,
      // Inverse bluff: wasBluff = true if they DO have Duke (they're lying about not having it)
      wasBluff: actor.hasCharacter(Character.Duke),
    });

    // Embezzle is challengeable (inverse challenge)
    sideEffects.push({ type: 'set_timer', durationMs: this.timerMs });

    const pendingAction: PendingAction = {
      type: ActionType.Embezzle,
      actorId: actor.id,
      claimedCharacter: Character.Duke, // The character in question for the inverse claim
    };

    return {
      newPhase: TurnPhase.AwaitingActionChallenge,
      pendingAction,
      pendingBlock: null,
      challengeState: {
        challengerId: '',
        challengedPlayerId: actor.id,
        claimedCharacter: Character.Duke,
        passedPlayerIds: [actor.id],
      },
      influenceLossRequest: null,
      exchangeState: null,
      sideEffects,
    };
  }

  /**
   * Handle challenge for Embezzle (inverse challenge).
   * If challenged player HAS Duke → challenge succeeds (they lied about not having Duke).
   * If challenged player does NOT have Duke → challenge fails (they were truthful).
   */
  challengeEmbezzle(
    game: Game,
    challengerId: string,
    pendingAction: PendingAction,
    challengeState: ChallengeState,
  ): ResolverResult | { error: string } {
    const challenger = game.getPlayer(challengerId);
    if (!challenger || !challenger.isAlive) return { error: 'Invalid challenger' };
    if (challengerId === pendingAction.actorId) return { error: 'Cannot challenge your own action' };

    const challenged = game.getPlayer(pendingAction.actorId)!;
    const sideEffects: SideEffect[] = [
      { type: 'clear_timer' },
      { type: 'log', message: `${challenger.name} challenges ${challenged.name}'s claim of not having Duke!`, eventType: 'challenge', character: Character.Duke, actorId: challengerId, actorName: challenger.name },
    ];

    // INVERSE: if challenged player HAS Duke, challenge SUCCEEDS (they were lying)
    if (challenged.hasCharacter(Character.Duke)) {
      sideEffects.push({
        type: 'challenge_reveal',
        challengerName: challenger.name,
        challengedName: challenged.name,
        character: Character.Duke,
        wasGenuine: false, // They claimed not to have Duke but did
      });
      sideEffects.push({
        type: 'log',
        message: `${challenged.name} DOES have Duke — embezzle fails! ${challenged.name} must lose an influence.`,
        eventType: 'challenge_success',
        character: Character.Duke,
        actorId: challengerId,
        actorName: challenger.name,
        targetId: challenged.id,
      });

      if (challenged.aliveInfluenceCount === 1) {
        const idx = challenged.influences.findIndex(inf => !inf.revealed);
        sideEffects.push({ type: 'reveal_influence', playerId: challenged.id, influenceIndex: idx });
        sideEffects.push({ type: 'eliminate_check', playerId: challenged.id });
        sideEffects.push({ type: 'win_check' });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
      }

      return {
        newPhase: TurnPhase.AwaitingInfluenceLoss,
        pendingAction: null,
        pendingBlock: null,
        challengeState: { ...challengeState, challengerId },
        influenceLossRequest: { playerId: challenged.id, reason: 'challenge_failed_defense' },
        exchangeState: null,
        sideEffects,
      };
    } else {
      // Challenge FAILS — challenged player truly doesn't have Duke, challenger loses influence
      sideEffects.push({
        type: 'challenge_reveal',
        challengerName: challenger.name,
        challengedName: challenged.name,
        character: Character.Duke,
        wasGenuine: true, // They truthfully don't have Duke
      });
      sideEffects.push({
        type: 'log',
        message: `${challenged.name} does NOT have Duke — challenge fails! ${challenger.name} must lose an influence. Embezzle proceeds.`,
        eventType: 'challenge_fail',
        character: Character.Duke,
        actorId: challenged.id,
        actorName: challenged.name,
      });

      if (challenger.aliveInfluenceCount === 1) {
        const idx = challenger.influences.findIndex(inf => !inf.revealed);
        sideEffects.push({ type: 'reveal_influence', playerId: challengerId, influenceIndex: idx });
        sideEffects.push({ type: 'eliminate_check', playerId: challengerId });
        // Embezzle proceeds
        sideEffects.push({ type: 'take_from_reserve', playerId: challenged.id });
        sideEffects.push({
          type: 'log',
          message: `${challenged.name} embezzles the Treasury Reserve!`,
          eventType: 'embezzle',
          character: null,
          actorId: challenged.id,
          actorName: challenged.name,
        });
        sideEffects.push({ type: 'win_check' });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
      }

      // Challenger must choose influence to lose, then embezzle resolves
      return {
        newPhase: TurnPhase.AwaitingInfluenceLoss,
        pendingAction,
        pendingBlock: null,
        challengeState: { ...challengeState, challengerId },
        influenceLossRequest: { playerId: challengerId, reason: 'challenge_lost' },
        exchangeState: null,
        sideEffects,
      };
    }
  }

  /**
   * Resolve the Inquisitor's examine decision.
   * forceSwap = true: target's card goes to deck, target draws a new one.
   * forceSwap = false: return the card (no change).
   */
  resolveExamine(
    game: Game,
    playerId: string,
    forceSwap: boolean,
    examineState: ExamineState,
    pendingAction: PendingAction,
  ): ResolverResult | { error: string } {
    if (examineState.examinerId !== playerId) return { error: 'Not your examine decision' };

    const target = game.getPlayer(examineState.targetId)!;
    const sideEffects: SideEffect[] = [];

    if (forceSwap) {
      // Return examined card to deck, draw new one for target
      const oldChar = examineState.revealedCard;
      const newCard = game.deck.draw();
      if (newCard) {
        game.deck.returnAndShuffle(oldChar);
        target.influences[examineState.influenceIndex].character = newCard;
        sideEffects.push({
          type: 'log',
          message: `${game.getPlayer(playerId)?.name} forces ${target.name} to swap a card.`,
          eventType: 'examine_decision',
          character: Character.Inquisitor,
          actorId: playerId,
          actorName: game.getPlayer(playerId)?.name ?? null,
          targetId: target.id,
        });
      }
    } else {
      sideEffects.push({
        type: 'log',
        message: `${game.getPlayer(playerId)?.name} returns ${target.name}'s card.`,
        eventType: 'examine_decision',
        character: Character.Inquisitor,
        actorId: playerId,
        actorName: game.getPlayer(playerId)?.name ?? null,
        targetId: target.id,
      });
    }

    sideEffects.push({ type: 'advance_turn' });
    return this.resolved(sideEffects);
  }

  /** Helper: create a resolved result (turn ends) */
  private resolved(sideEffects: SideEffect[]): ResolverResult {
    return {
      newPhase: TurnPhase.ActionResolved,
      pendingAction: null,
      pendingBlock: null,
      challengeState: null,
      influenceLossRequest: null,
      exchangeState: null,
      sideEffects,
    };
  }
}
