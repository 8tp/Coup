import {
  ActionType,
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
  CHALLENGE_TIMER_MS,
  BLOCK_TIMER_MS,
  FORCED_COUP_THRESHOLD,
  EXCHANGE_DRAW_COUNT,
} from '../shared/constants';
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
  | { type: 'log'; message: string }
  | { type: 'start_exchange'; playerId: string; drawnCards: Character[] }
  | { type: 'win_check' };

export interface ResolverResult {
  newPhase: TurnPhase;
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  challengeState: ChallengeState | null;
  influenceLossRequest: InfluenceLossRequest | null;
  exchangeState: ExchangeState | null;
  sideEffects: SideEffect[];
}

export class ActionResolver {

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

    const pendingAction: PendingAction = {
      type: actionType,
      actorId,
      targetId,
      claimedCharacter: def.claimedCharacter ?? undefined,
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
      sideEffects.push({ type: 'log', message: `${actor.name} takes Income (+1 coin).` });
      sideEffects.push({ type: 'advance_turn' });
      return this.resolved(sideEffects);
    }

    if (actionType === ActionType.Coup) {
      sideEffects.push({ type: 'log', message: `${actor.name} launches a Coup against ${game.getPlayer(targetId!)?.name}.` });
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
    if (def.claimedCharacter) {
      const targetPart = targetName ? ` targeting ${targetName}` : '';
      sideEffects.push({
        type: 'log',
        message: `${actor.name} claims ${def.claimedCharacter} to ${actionType}${targetPart}.`,
      });
    } else {
      sideEffects.push({
        type: 'log',
        message: `${actor.name} declares ${actionType}.`,
      });
    }

    // Challengeable actions go to challenge phase
    if (def.challengeable) {
      sideEffects.push({ type: 'set_timer', durationMs: CHALLENGE_TIMER_MS });
      return {
        newPhase: TurnPhase.AwaitingActionChallenge,
        pendingAction,
        pendingBlock: null,
        challengeState: {
          challengerId: '',
          challengedPlayerId: actorId,
          claimedCharacter: def.claimedCharacter!,
          passedPlayerIds: [actorId], // Actor can't challenge themselves
        },
        influenceLossRequest: null,
        exchangeState: null,
        sideEffects,
      };
    }

    // Non-challengeable but blockable (only Foreign Aid)
    if (def.blockedBy.length > 0) {
      sideEffects.push({ type: 'set_timer', durationMs: BLOCK_TIMER_MS });
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

    const challenged = game.getPlayer(pendingAction.actorId)!;
    const claimedChar = pendingAction.claimedCharacter!;
    const sideEffects: SideEffect[] = [
      { type: 'clear_timer' },
      { type: 'log', message: `${challenger.name} challenges ${challenged.name}'s claim of ${claimedChar}!` },
    ];

    if (challenged.hasCharacter(claimedChar)) {
      // Challenge FAILS — challenger loses influence
      sideEffects.push({
        type: 'log',
        message: `${challenged.name} reveals ${claimedChar} — challenge fails! ${challenger.name} must lose an influence.`,
      });

      // Challenged player gets a replacement card
      const newCard = game.deck.draw();
      if (newCard) {
        sideEffects.push({
          type: 'replace_influence',
          playerId: challenged.id,
          oldCharacter: claimedChar,
          newCharacter: newCard,
        });
      }
      // Return the revealed card to deck and shuffle (handled in replace_influence effect)

      // Challenger must lose an influence
      if (challenger.aliveInfluenceCount === 1) {
        // Auto-reveal their only influence
        const idx = challenger.influences.findIndex(inf => !inf.revealed);
        sideEffects.push({ type: 'reveal_influence', playerId: challengerId, influenceIndex: idx });
        sideEffects.push({ type: 'eliminate_check', playerId: challengerId });

        // Action still proceeds — move to block phase or resolve
        return this.afterSuccessfulActionChallengeDefense(game, pendingAction, sideEffects);
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
        type: 'log',
        message: `${challenged.name} does NOT have ${claimedChar} — challenge succeeds!`,
      });

      // Refund action cost
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
   */
  private afterSuccessfulActionChallengeDefense(
    game: Game,
    pendingAction: PendingAction,
    sideEffects: SideEffect[],
  ): ResolverResult {
    const def = ACTION_DEFINITIONS[pendingAction.type];

    // If blockable, go to block phase
    if (def.blockedBy.length > 0) {
      sideEffects.push({ type: 'set_timer', durationMs: BLOCK_TIMER_MS });
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
      sideEffects.push({ type: 'set_timer', durationMs: BLOCK_TIMER_MS });
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
      { type: 'log', message: `${blocker.name} blocks with ${claimedCharacter}!` },
      { type: 'set_timer', durationMs: CHALLENGE_TIMER_MS },
    ];

    const pendingBlock: PendingBlock = { blockerId, claimedCharacter };

    return {
      newPhase: TurnPhase.AwaitingBlockChallenge,
      pendingAction,
      pendingBlock,
      challengeState: {
        challengerId: '',
        challengedPlayerId: blockerId,
        claimedCharacter,
        passedPlayerIds: [blockerId], // Blocker can't challenge their own block
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
    // Only the actor of the original action can challenge the block
    if (challengerId !== pendingAction.actorId) return { error: 'Only the original actor can challenge a block' };

    const blocker = game.getPlayer(pendingBlock.blockerId)!;
    const claimedChar = pendingBlock.claimedCharacter;
    const sideEffects: SideEffect[] = [
      { type: 'clear_timer' },
      { type: 'log', message: `${challenger.name} challenges ${blocker.name}'s block with ${claimedChar}!` },
    ];

    if (blocker.hasCharacter(claimedChar)) {
      // Block challenge FAILS — blocker proves they have the card
      // Challenger (actor) loses influence, action is blocked
      sideEffects.push({
        type: 'log',
        message: `${blocker.name} reveals ${claimedChar} — block stands! ${challenger.name} must lose an influence.`,
      });

      // Blocker gets replacement
      const newCard = game.deck.draw();
      if (newCard) {
        sideEffects.push({
          type: 'replace_influence',
          playerId: blocker.id,
          oldCharacter: claimedChar,
          newCharacter: newCard,
        });
      }

      // Refund action cost since block succeeds
      const def = ACTION_DEFINITIONS[pendingAction.type];
      if (def.cost > 0) {
        sideEffects.push({ type: 'give_coins', playerId: pendingAction.actorId, amount: def.cost });
      }

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
        type: 'log',
        message: `${blocker.name} does NOT have ${claimedChar} — block fails! Action proceeds.`,
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
      { type: 'log', message: 'Block is not challenged — action is blocked.' },
    ];

    // Refund action cost
    const def = ACTION_DEFINITIONS[pendingAction.type];
    if (def.cost > 0) {
      sideEffects.push({ type: 'give_coins', playerId: pendingAction.actorId, amount: def.cost });
    }

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
      { type: 'log', message: `${player.name} loses ${revealedChar}.` },
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
      // The challenged player (action actor) lost — action cancelled, advance turn
      sideEffects.push({ type: 'win_check' });
      sideEffects.push({ type: 'advance_turn' });
      return this.resolved(sideEffects);
    }

    if (reason === 'challenge_lost') {
      // Challenger lost — the action still proceeds
      if (pendingAction) {
        // Check if there's a block phase after
        const def = ACTION_DEFINITIONS[pendingAction.type];
        if (def.blockedBy.length > 0) {
          // Check if the target is still alive to block
          const targetAlive = pendingAction.targetId
            ? game.getPlayer(pendingAction.targetId)?.isAlive ?? false
            : true;
          if (targetAlive) {
            sideEffects.push({ type: 'set_timer', durationMs: BLOCK_TIMER_MS });
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

    const sideEffects: SideEffect[] = [
      { type: 'log', message: `${player.name} completes the exchange.` },
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
        sideEffects.push({ type: 'log', message: `${actor.name} collects Tax (+3 coins).` });
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);

      case ActionType.ForeignAid:
        sideEffects.push({ type: 'give_coins', playerId: actor.id, amount: 2 });
        sideEffects.push({ type: 'log', message: `${actor.name} takes Foreign Aid (+2 coins).` });
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
          sideEffects.push({ type: 'log', message: `${target.name} loses an influence to assassination.` });
          sideEffects.push({ type: 'eliminate_check', playerId: target.id });
          sideEffects.push({ type: 'win_check' });
          sideEffects.push({ type: 'advance_turn' });
          return this.resolved(sideEffects);
        }

        // Target chooses which influence to lose
        sideEffects.push({ type: 'log', message: `${target.name} must lose an influence to assassination.` });
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
        const drawnCards = game.deck.drawMultiple(EXCHANGE_DRAW_COUNT);
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

      default:
        sideEffects.push({ type: 'advance_turn' });
        return this.resolved(sideEffects);
    }
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
