import type { LogEntry } from '@/shared/types';

export function getLogExplanation(entry: LogEntry): string | null {
  switch (entry.eventType) {
    case 'game_start':
      return 'The server shuffled and dealt hidden influence cards. Each phone only sees its own cards.';
    case 'turn_start':
      return 'Only the active player can choose an action. Everyone else waits for challenges, blocks, or the next turn.';
    case 'income':
      return 'Income is always safe: it cannot be challenged or blocked.';
    case 'declare_action':
      return 'This announces the chosen action. If the action claims a character, players may get a chance to challenge it.';
    case 'claim_action': {
      const action = entry.message.match(/declares (.*?) claiming/)?.[1];
      return `${entry.actorName ?? 'This player'} is claiming ${entry.character ?? 'a role'}${action ? ` for ${action}` : ''}. Other players can challenge before it resolves.`;
    }
    case 'challenge':
    case 'block_challenge':
      return "A challenge asks the server to prove whether the claimed character was actually in that player's hidden hand.";
    case 'challenge_fail':
      return 'The challenged player had the claimed card. The challenger loses influence, and the revealed card is replaced from the deck.';
    case 'challenge_success':
      return 'The challenged player did not have the claimed card. Their bluff failed, so they lose influence.';
    case 'block':
      return 'Blocks are claims too. The blocker may be telling the truth or bluffing, and the block can be challenged.';
    case 'block_unchallenged':
      return 'No one challenged the block before the timer ended, so the block stands and the action is stopped.';
    case 'block_challenge_fail':
      return 'The blocker proved they had the claimed blocking card. The challenger loses influence and the action remains blocked.';
    case 'block_challenge_success':
      return 'The blocker was bluffing. They lose influence and the original action continues.';
    case 'coup':
      return 'Coup costs 7 coins, cannot be blocked or challenged, and always forces the target to reveal influence.';
    case 'assassination':
      return 'Assassination resolves after any challenge and Contessa block window. If it gets through, the target loses influence.';
    case 'influence_loss':
      return 'A revealed influence is out for the rest of the game. A player with no hidden influence is eliminated.';
    case 'exchange':
    case 'exchange_draw':
      return 'Exchange lets the claiming player look at extra cards and choose which hidden influences to keep.';
    case 'action_resolve':
      return entry.character
        ? `${entry.actorName ?? 'This player'}'s ${entry.character} claim survived the challenge/block windows, so the action resolved.`
        : 'The action reached the end of its challenge/block windows and resolved.';
    case 'elimination':
      return 'That player has no hidden influence left and is out, but they can still watch the rest of the table.';
    case 'win':
      return 'Only one player still has hidden influence, so the game is over.';
    case 'bot_replace':
      return 'A disconnected player was replaced so the table can keep moving.';
    case 'convert':
      return 'Convert changes faction. Self-convert costs 1 coin; converting someone else costs 2 coins. The coins go to the reserve.';
    case 'faction_change':
      return 'Faction restrictions affect Coup, Assassinate, Steal, and Examine unless all alive players share a faction.';
    case 'embezzle':
      return 'Embezzle takes the whole reserve. It is an inverse Duke claim: challengers win only if the embezzler actually has Duke.';
    case 'examine':
      return 'Examine claims Inquisitor to look at one hidden card from the target before choosing whether to force a swap.';
    case 'examine_decision':
      return 'The Inquisitor either returned the card unchanged or forced it to be swapped with the deck.';
    default:
      if (entry.targetId) {
        return 'Targeted actions can be limited by coins, factions, and whether the target is still alive.';
      }
      return null;
  }
}
