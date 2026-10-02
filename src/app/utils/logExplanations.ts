import type { LogEntry } from '@/shared/types';

export function getLogExplanation(entry: LogEntry): string | null {
  switch (entry.eventType) {
    case 'game_start':
      return 'The server shuffled the deck and dealt 2 hidden cards to each player. Each player sees only their own.';
    case 'turn_start':
      return 'Only the active player can choose an action. Everyone else waits for challenges, blocks, or the next turn.';
    case 'income':
      return "Income can't be challenged or blocked.";
    case 'declare_action':
      return 'This action claims no character. Only actions that claim a character can be challenged.';
    case 'claim_action': {
      const action = entry.character
        ? entry.message.match(new RegExp(`claims ${entry.character} to (.+?)(?: targeting .*)?\\.$`))?.[1]
        : undefined;
      return `${entry.actorName ?? 'This player'} is claiming ${entry.character ?? 'a role'}${action ? ` for ${action}` : ''}. Other players can challenge before it resolves.`;
    }
    case 'challenge':
    case 'block_challenge':
      return "A challenge checks whether the claimed character is in that player's hidden hand.";
    case 'challenge_fail':
      return 'The challenged player had the claimed card. The challenger loses a card, and the shown card is replaced from the deck.';
    case 'challenge_success':
      return "The challenged player didn't have the claimed card, so they lose a card.";
    case 'block':
      return 'A block is a claim. The blocker may be bluffing, and the block can be challenged.';
    case 'block_unchallenged':
      return 'No one challenged the block before the timer ended, so the block stands and the action is stopped.';
    case 'block_challenge_fail':
      return 'The blocker had the claimed card. The challenger loses a card and the action stays blocked.';
    case 'block_challenge_success':
      return 'The blocker was bluffing. They lose a card and the original action goes ahead.';
    case 'coup':
      return "A Coup costs 7 coins and can't be blocked or challenged. The target always loses a card.";
    case 'assassination':
      return 'An assassination resolves after the challenge and Contessa block windows. If no one stops it, the target loses a card.';
    case 'influence_loss':
      return 'A revealed card is out for the rest of the game. A player with no hidden cards is eliminated.';
    case 'exchange':
    case 'exchange_draw':
      return 'Exchange draws cards from the deck. The player chooses which cards to keep and returns the rest.';
    case 'action_resolve':
      return entry.character
        ? `No one stopped ${entry.actorName ?? 'this player'}'s ${entry.character} claim in the challenge and block windows, so the action resolved.`
        : 'No one stopped the action in its challenge and block windows, so it resolved.';
    case 'elimination':
      return 'That player has no hidden cards left and is out. They can keep watching the game.';
    case 'win':
      return 'Only one player has hidden cards left, so the game is over.';
    case 'bot_replace':
      return 'A bot took over for a player who left, disconnected or went idle, so the game can continue.';
    case 'convert':
      return 'Convert changes faction. Self-convert costs 1 coin; converting someone else costs 2 coins. The coins go to the reserve.';
    case 'faction_change':
      return 'Faction restrictions affect Coup, Assassinate, Steal, Examine, and Foreign Aid blocks unless all alive players share a faction.';
    case 'embezzle':
      return 'Embezzle takes the whole reserve. The player claims to have no Duke, so a challenger wins only if the player has Duke. Otherwise the player shows every hidden card and replaces them from the deck.';
    case 'examine':
      return 'Examine claims Inquisitor. The target chooses a hidden card to show before the examiner decides whether to force a swap.';
    case 'examine_decision':
      return 'The Inquisitor either returned the card unchanged or forced it to be swapped with the deck.';
    default:
      if (entry.targetId) {
        return 'Targeted actions can be limited by coins, factions, and whether the target is still alive.';
      }
      return null;
  }
}
