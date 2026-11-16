import type { LogMessageKey } from '@/shared/i18n/logMessages';

/**
 * The action log. Event keys (the first block) are exactly the server's
 * `LogMessageKey`s (`src/shared/i18n/logMessages.ts`); the type below makes a
 * missing one a compile error. With no player being "you", each line must
 * reproduce the server's English `message` character for character, which
 * `tests/app/i18n/logMessages.test.ts` checks.
 *
 * Player params render as the player's name, or as `log.you` when the player
 * is the reader. Sentence-initial and possessive forms use `select` on the
 * param: `{actor, select, you {You take} other {{actor} takes}}`.
 * Character params render as the character's emblem plus its glossary name.
 */
const log = {
  // ── Event lines ──
  gameStarted: 'Game started. {actor, select, you {You go} other {{actor} goes}} first.',
  turnStart: "{actor, select, you {Your turn.} other {{actor}'s turn.}}",
  eliminated: "{actor, select, you {You're out.} other {{actor} is out.}}",
  win: '{actor, select, you {You win the game.} other {{actor} wins the game.}}',
  botReplacedIdle: '{actor, select, you {You were idle, so a bot took your seat.} other {{actor} was idle, so a bot took their seat.}}',
  botReplacedLeft: '{actor, select, you {You left, so a bot took your seat.} other {{actor} left, so a bot took their seat.}}',
  botReplacedDisconnected: "A bot took {actor, select, you {your} other {{actor}'s}} seat.",
  income: '{actor, select, you {You take} other {{actor} takes}} Income (+{amount, plural, one {# coin} other {# coins}}).',
  coup: '{actor, select, you {You launch} other {{actor} launches}} a Coup against {target}.',
  claimAction: '{actor, select, you {You claim} other {{actor} claims}} {character} to {action}.',
  claimActionTargeting: '{actor, select, you {You claim} other {{actor} claims}} {character} to {action} targeting {target}.',
  declareAction: '{actor, select, you {You declare} other {{actor} declares}} {action}.',
  challenge: "{challenger, select, you {You challenge} other {{challenger} challenges}} {challenged, select, you {your} other {{challenged}'s}} {character} claim.",
  challengeFailed: '{challenged, select, you {You have} other {{challenged} has}} {character}. {challenger, select, you {You} other {{challenger}}} must lose a card.',
  challengeSucceeded: '{challenged, select, you {You have} other {{challenged} has}} no {character} and must lose a card.',
  block: '{blocker, select, you {You block} other {{blocker} blocks}} with {character}.',
  blockChallenge: "{challenger, select, you {You challenge} other {{challenger} challenges}} {blocker, select, you {your} other {{blocker}'s}} {character} block.",
  blockChallengeFailed: '{blocker, select, you {You have} other {{blocker} has}} {character}, so the block stands. {challenger, select, you {You} other {{challenger}}} must lose a card.',
  blockChallengeSucceeded: '{blocker, select, you {You have} other {{blocker} has}} no {character} and must lose a card. The block fails and the action goes ahead.',
  blockStands: 'No one challenges the block. The action is blocked.',
  influenceLost: '{actor, select, you {You lose} other {{actor} loses}} {character}.',
  assassinationLoss: '{target, select, you {You lose} other {{target} loses}} a card to the assassination.',
  assassinationPending: '{target, select, you {You} other {{target}}} must lose a card to the assassination.',
  taxCollected: '{actor, select, you {You collect} other {{actor} collects}} Tax (+{amount, plural, one {# coin} other {# coins}}).',
  foreignAidTaken: '{actor, select, you {You take} other {{actor} takes}} Foreign Aid (+{amount, plural, one {# coin} other {# coins}}).',
  stealResolved: '{actor, select, you {You steal} other {{actor} steals}} {amount, plural, one {# coin} other {# coins}} from {target}.',
  exchangeDraw: '{actor, select, you {You draw} other {{actor} draws}} cards for exchange.',
  exchangeDeckEmpty: '{actor, select, you {You draw} other {{actor} draws}} no cards. The deck is empty.',
  exchangeComplete: '{actor, select, you {You complete} other {{actor} completes}} the exchange.',
  convertSelf: '{actor, select, you {You convert} other {{actor} converts}} to {faction} ({amount, plural, one {# coin} other {# coins}} to Treasury Reserve).',
  convertOther: '{actor, select, you {You convert} other {{actor} converts}} {target} to {faction} ({amount, plural, one {# coin} other {# coins}} to Treasury Reserve).',
  embezzleClaim: '{actor, select, you {You claim} other {{actor} claims}} no {character} to Embezzle the Treasury Reserve ({amount, plural, one {# coin} other {# coins}}).',
  embezzleChallenge: "{challenger, select, you {You challenge} other {{challenger} challenges}} {challenged, select, you {your} other {{challenged}'s}} claim to have no {character}.",
  embezzleChallengeSucceeded: '{challenged, select, you {You have} other {{challenged} has}} {character} and must lose a card. The Embezzle fails.',
  embezzleChallengeFailed: '{challenged, select, you {You show every hidden card and have} other {{challenged} shows every hidden card and has}} no {character}, so those cards are replaced. {challenger, select, you {You} other {{challenger}}} must lose a card and the Embezzle goes ahead.',
  embezzled: '{actor, select, you {You embezzle} other {{actor} embezzles}} the Treasury Reserve.',
  examineAsk: '{actor, select, you {You ask} other {{actor} asks}} {target} for a card to examine.',
  examineShown: '{target, select, you {You show} other {{target} shows}} {actor} a card.',
  examineForceSwap: '{actor, select, you {You force} other {{actor} forces}} {target} to swap a card.',
  examineSwapDeckEmpty: "{actor, select, you {You} other {{actor}}} can't force a swap with an empty deck. The card goes back.",
  examineReturn: "{actor, select, you {You return} other {{actor} returns}} {target, select, you {your} other {{target}'s}} card.",

  // ── How a player param reads when it is the reader, mid-sentence ──
  you: 'you',
  /** Shown for a player id the client cannot name (should not happen). */
  unknownPlayer: 'a player',

  // ── Log chrome ──
  empty: 'Game starting',
  latest: 'Latest',
  openFull: 'Open the full game log',
  tabLog: 'Log',
  tabChat: 'Chat',
  unreadMany: '9+',
  bluff: 'bluff',
  honest: 'honest',
  explain: 'Explain',

  // ── Practice explanations, by event type ──
  'explain.game_start': 'The server shuffled the deck and dealt 2 hidden cards to each player. Each player sees only their own.',
  'explain.turn_start': 'Only the active player can choose an action. Everyone else waits for challenges, blocks, or the next turn.',
  'explain.income': "Income can't be challenged or blocked.",
  'explain.declare_action': 'This action claims no character. Only actions that claim a character can be challenged.',
  'explain.claim_action': '{actor, select, you {You are} other {{actor} is}} claiming {character} for {action}. Other players can challenge before it resolves.',
  'explain.claim_action_plain': '{actor, select, you {You are} other {{actor} is}} claiming {character}. Other players can challenge before it resolves.',
  'explain.challenge': "A challenge checks whether the claimed character is in that player's hidden hand.",
  'explain.challenge_fail': 'The challenged player had the claimed card. The challenger loses a card, and the shown card is replaced from the deck.',
  'explain.challenge_success': "The challenged player didn't have the claimed card, so they lose a card.",
  'explain.block': 'A block is a claim. The blocker may be bluffing, and the block can be challenged.',
  'explain.block_unchallenged': 'No one challenged the block before the timer ended, so the block stands and the action is stopped.',
  'explain.block_challenge_fail': 'The blocker had the claimed card. The challenger loses a card and the action stays blocked.',
  'explain.block_challenge_success': 'The blocker was bluffing. They lose a card and the original action goes ahead.',
  'explain.coup': "A Coup costs 7 coins and can't be blocked or challenged. The target always loses a card.",
  'explain.assassination': 'An assassination resolves after the challenge and Contessa block windows. If no one stops it, the target loses a card.',
  'explain.influence_loss': 'A revealed card is out for the rest of the game. A player with no hidden cards is eliminated.',
  'explain.exchange': 'Exchange draws cards from the deck. The player chooses which cards to keep and returns the rest.',
  'explain.action_resolve': "No one stopped {actor, select, you {your} other {{actor}'s}} {character} claim in the challenge and block windows, so the action resolved.",
  'explain.action_resolve_plain': 'No one stopped the action in its challenge and block windows, so it resolved.',
  'explain.elimination': 'That player has no hidden cards left and is out. They can keep watching the game.',
  'explain.win': 'Only one player has hidden cards left, so the game is over.',
  'explain.bot_replace': 'A bot took over for a player who left, disconnected or went idle, so the game can continue.',
  'explain.convert': 'Convert changes faction. Self-convert costs 1 coin; converting someone else costs 2 coins. The coins go to the reserve.',
  'explain.faction_change': 'Faction restrictions affect Coup, Assassinate, Steal, Examine, and Foreign Aid blocks unless all alive players share a faction.',
  'explain.embezzle': 'Embezzle takes the whole reserve. The player claims to have no Duke, so a challenger wins only if the player has Duke. Otherwise the player shows every hidden card and replaces them from the deck.',
  'explain.examine': 'Examine claims Inquisitor. The target chooses a hidden card to show before the examiner decides whether to force a swap.',
  'explain.examine_decision': 'The Inquisitor either returned the card unchanged or forced it to be swapped with the deck.',
  'explain.targeted': 'Targeted actions can be limited by coins, factions, and whether the target is still alive.',
} satisfies Record<LogMessageKey, string> & Record<string, string>;

export default log;
