import type { Character, Faction, RefusalKey } from '@/shared/types';
import type { QuickPhraseId, ReactionId } from '@/shared/constants';

/**
 * The game table: the header, banners, the felt and its objects, seats, your
 * hand, the phase line over the felt, the claim plaque, the action bar and its
 * refusals, the knocked-out panel, card labels, the turn timer, reactions and
 * chat. The prompts that ask you to answer a claim are in `prompts`.
 *
 * Player names arrive as `{name}`, `{actor}`, `{target}` and similar, already
 * isolated for direction; never translate them. Game nouns (characters,
 * actions, factions) arrive as params from the glossary, so a message names
 * them with `{character}` or `{action}` rather than typing them.
 */
const game = {
  // ── Header ──
  // Tooltip on the room code at the top left of the table.
  roomCodeTitle: 'Room code',
  // Header: which turn of the game this is. {turn} is a number.
  turn: 'Turn {turn}',
  // Header: how many spectators are watching the game.
  watching: '{count, plural, one {# watching} other {# watching}}',
  // Header button and drawer label: opens the game log and the chat.
  logAndChat: 'Game log and chat',
  logAndChatUnread: 'Game log and chat, {count, plural, one {# unread} other {# unread}}',
  // Unread badge on a small round button: more than 9 unread lines.
  unreadMany: '9+',
  muteSound: 'Mute sound effects',
  unmuteSound: 'Unmute sound effects',
  settings: 'Settings',
  howToPlay: 'How to play',

  // ── Banners and loading ──
  // Banner across the top while you watch a game you are not playing in.
  spectating: 'Spectating',
  // Button on the spectating banner: stop watching and go back to the menu.
  stopSpectating: 'Leave',
  reconnecting: 'Reconnecting to server…',
  // Shown while the table loads.
  connecting: 'Connecting…',
  // Shown while a new game is being set up (button and loading screen).
  dealing: 'Dealing…',
  newGameFailed: 'Could not start a game',

  // ── Browser tab title ──
  // The tab title. "Coup" is the game's name and stays as it is. {room} is the room code.
  'title.plain': 'Coup {room}',
  // The tab title with what the game needs from you first, for example "Your turn | Coup ABCD".
  'title.status': '{status} | Coup {room}',
  'title.watching': 'Watching',
  'title.eliminated': 'Eliminated',
  'title.yourTurn': 'Your turn',
  'title.blockOrChallenge': 'Block or challenge',
  'title.challengeOrPass': 'Challenge or pass',
  'title.blockOrAllow': 'Block or allow',
  'title.challengeBlock': 'Challenge the block',
  'title.loseCard': 'Lose a card',
  'title.keepCards': 'Choose cards to keep',
  'title.showCard': 'Show a card',
  'title.examineCard': 'Examine card',

  // ── The log drawer ──
  // Heading of the side drawer that holds the game log and the chat.
  drawerTitle: 'Log & chat',
  closeLog: 'Close log',
  // Expandable list in the drawer: per-player switches to hide chat and reactions.
  mutePlayers: 'Mute players',
  // State of a player's mute switch: their chat and reactions are hidden.
  muted: 'Muted',
  // State of a player's mute switch: their chat and reactions show.
  chatOn: 'Chat & reactions on',

  // ── Objects on the felt ──
  // Label under the deck pile. {count} is how many cards are left in it.
  deck: 'Deck {count}',
  // Label under the bank's coin pile. {count} is coins.
  treasury: 'Treasury {count}',
  // Label under the Treasury Reserve's coin pile (Reformation). {count} is coins.
  reserve: 'Reserve {count}',
  // Label under the pile of cards players have lost. {count} is cards.
  fallen: 'Fallen {count}',
  // Printed on the small card thrown across the table during an assassination. Short, one word.
  flightStrike: 'Strike',
  // Big words that float up from a seat for a moment. Two words at most.
  'fx.caughtBluffing': 'Caught bluffing',
  'fx.lostCard': 'Lost a card',
  'fx.blocked': 'Blocked',
  'fx.eliminated': 'Eliminated',

  // ── Your hand ──
  // Label beside your cards on your turn.
  yourMove: 'Your move',
  // Label beside your cards when it is not your turn.
  yourHand: 'Your hand',
  // Label beside your cards once you are out of the game.
  eliminated: 'Eliminated',

  // ── Seats ──
  // Screen-reader label on a seat you can pick as a target.
  'seat.choose': 'Choose {name}',
  // Screen-reader label on a seat you cannot pick: the player's name, then why.
  'seat.refused': '{name}: {reason}',
  // Tag on a computer player's seat. Very short.
  'seat.bot': 'BOT',
  // Faction tag on a seat (Reformation): three-letter abbreviation of Loyalist.
  'seat.faction.Loyalist': 'LOY',
  // Faction tag on a seat (Reformation): three-letter abbreviation of Reformist.
  'seat.faction.Reformist': 'REF',
  'seat.mute': 'Mute chat and reactions from {name}',
  // Tooltip on the small mute button on a seat.
  'seat.muteShort': 'Mute {name}',
  'seat.unmute': 'Unmute {name}',

  // ── The phase line over the felt ──
  'phase.yourTurn': 'Your turn: choose an action',
  'phase.theirTurn': "{name}'s turn",
  'phase.claimBlockOrChallenge': '{actor} claims {character}: block or challenge',
  'phase.claimChallengeOrPass': '{actor} claims {character}: challenge or pass',
  // Embezzle is a claim to hold no Duke. {character} is Duke.
  'phase.claimNoChallengeOrPass': '{actor} claims no {character}: challenge or pass',
  // Fallback when the claimed character is unknown, used as {character} above.
  'phase.aCharacter': 'a character',
  // {names} is a list of players; with no names left it reads "players".
  'phase.waitingChallenge': '{count, plural, =0 {Waiting for players to challenge or pass} other {Waiting for {names} to challenge or pass}}',
  'phase.targetingYou': '{actor} is targeting you: block or allow',
  'phase.usesBlockOrAllow': '{actor} uses {action}: block or allow',
  'phase.waitingBlock': '{count, plural, =0 {Waiting for players to block or allow} other {Waiting for {names} to block or allow}}',
  'phase.blockChallengeOrPass': '{blocker} blocks with {character}: challenge or pass',
  'phase.chooseLoss': 'Choose a card to lose',
  'phase.choosingLoss': '{name} is choosing a card to lose',
  'phase.chooseToShow': 'Choose a card to show {examiner}',
  // Fallback when the examining player is unknown. {character} is Inquisitor.
  'phase.chooseToShowInquisitor': 'Choose a card to show the {character}',
  'phase.choosingToShow': '{target} is choosing a card for {examiner} to examine',
  'phase.examineDecision': 'Return the card or force a swap',
  'phase.examining': '{name} is examining a card',
  'phase.chooseKeep': 'Choose the cards to keep',
  'phase.choosingKeep': '{name} is choosing cards to keep',
  'phase.someoneChoosingKeep': 'A player is choosing cards to keep',
  'phase.gameOver': 'Game over',

  // ── The claim plaque in the middle of the felt ──
  // Who is acting, on the plaque, when it is you.
  'plaque.you': 'You',
  // Second line of the plaque: the character claimed. {character} is a character name.
  'plaque.as': 'as {character}',
  // Second line of the plaque for Embezzle, a claim to hold no Duke.
  'plaque.claimsNo': 'claims no {character}',
  // Second line of the plaque: who the action is aimed at. "You" when it is the reader.
  'plaque.on': '{target, select, you {on You} other {on {target}}}',
  'plaque.asOn': '{target, select, you {as {character} · on You} other {as {character} · on {target}}}',
  'plaque.claimsNoOn': '{target, select, you {claims no {character} · on You} other {claims no {character} · on {target}}}',
  // Headline of the second plaque that lands on a blocked action. Short, one word.
  'plaque.blocks': 'Blocks',

  // ── The action bar (your turn) ──
  // Small line under each action button. Keep these short: two columns of buttons on a phone.
  'actionDesc.Income': '+{count, plural, one {# coin} other {# coins}} (no block)',
  'actionDesc.ForeignAid': '+{count, plural, one {# coin} other {# coins}} (blockable)',
  'actionDesc.Tax': '+{count, plural, one {# coin} other {# coins}} (claim {character})',
  'actionDesc.Steal': 'Take {count, plural, one {# coin} other {# coins}} (claim {character})',
  'actionDesc.Assassinate': 'Pay {cost}, they lose a card (claim {character})',
  'actionDesc.Exchange': 'Draw {count}, put back {count} (claim {character})',
  'actionDesc.Coup': 'Pay {cost}, they lose a card (no block)',
  'actionDesc.Examine': 'Look at a card (claim {character})',
  'actionDesc.Convert': 'Switch a faction ({self} or {other} coins)',
  'actionDesc.Embezzle': 'Take {count, plural, one {# coin} other {# coins}} from the reserve (claim no {character})',
  'actionDesc.EmbezzleEmpty': 'The reserve is empty',
  // Heading over the list of players to pick from. The verb is the action's own.
  chooseTarget: 'Choose who to {action, select, Coup {Coup} Assassinate {Assassinate} Steal {Steal from} Examine {Examine} other {{action}}}',
  chooseConvert: 'Choose who to Convert',
  // Button: Convert your own faction. {count} is the cost in coins.
  convertSelf: 'Yourself ({count, plural, one {# coin} other {# coins}})',
  // Button: Convert another player. {count} is the cost in coins.
  convertOther: '{name} ({count, plural, one {# coin} other {# coins}})',
  // A row in the target list: the player and how many coins they have.
  targetRow: '{name} ({count, plural, one {# coin} other {# coins}})',
  // With 10 or more coins a Coup is required.
  mustCoup: '{count, plural, one {You have # coin, so you must Coup} other {You have # coins, so you must Coup}}',
  mustCoupHint: 'Choose who loses a card',
  // Button in the forced Coup list.
  coupTarget: 'Coup {name}',
  nobodyToTarget: 'Nobody else is left to target.',

  // ── Refusals: why a button or a seat cannot be chosen (shown under it and announced) ──
  'refusal.pending': 'You already chose an action.',
  'refusal.sameFaction': 'Same faction. Convert first, or wait until everyone is in one faction.',
  'refusal.noCoinsToSteal': '{name} has no coins to steal.',
  'refusal.nobodyHasCoins': 'Nobody has coins to steal.',
  'refusal.nobodyLeft': 'Nobody else is left to {action, select, Coup {Coup} Assassinate {Assassinate} Steal {Steal} Examine {Examine} other {{action}}}.',
  'refusal.reserveEmpty': "The reserve is empty, so there's nothing to Embezzle.",
  'refusal.needCoinsCoup': 'You need {cost, plural, one {# coin} other {# coins}} to Coup. You have {have}.',
  'refusal.needCoinsAssassinate': 'You need {cost, plural, one {# coin} other {# coins}} to Assassinate. You have {have}.',
  'refusal.needCoinsConvertSelf': 'You need {cost, plural, one {# coin} other {# coins}} to Convert yourself. You have {have}.',
  'refusal.needCoinsConvertOther': 'You need {cost, plural, one {# coin} other {# coins}} to Convert {name}. You have {have}.',

  // ── Knocked out (the panel in place of your actions) ──
  'watch.label': 'You are watching',
  // Heading of the panel shown once you are out of the game.
  'watch.title': 'Watching',
  'watch.body': "You're eliminated. Watch the rest of the game, or leave whenever you like.",
  // Button: start a fresh game against bots.
  'watch.newGame': 'New game',
  'watch.leave': 'Leave table',

  // ── Cards ──
  // Screen-reader text for a face-down card.
  'card.hidden': 'Hidden influence',
  'card.influence': '{character} influence',
  'card.influenceSelected': '{character} influence, selected',
  'card.revealed': 'Revealed {character} influence',
  // Printed on the card under the character's name: what the card does, one short word or two, set in capitals where the script has them. Must fit a card 44px wide.
  'cardAction.Duke': 'Tax',
  'cardAction.Assassin': 'Kill',
  'cardAction.Captain': 'Steal',
  'cardAction.Ambassador': 'Exchange',
  'cardAction.Contessa': 'Block',
  'cardAction.Inquisitor': 'Examine',
  // A character's abilities, shown when you tap a card to look at it.
  'cardAbility.Duke': 'Tax: Take 3 coins. Blocks Foreign Aid.',
  'cardAbility.Assassin': 'Assassinate: Pay 3 coins. The target loses a card.',
  'cardAbility.Captain': 'Steal: Take 2 coins from target. Blocks Steal.',
  'cardAbility.Ambassador': 'Exchange: Draw 2, return 2. Blocks Steal.',
  'cardAbility.Contessa': 'Blocks Assassination.',
  'cardAbility.Inquisitor': "Exchange: Draw 1, return 1. Examine: Look at an opponent's card. Blocks Steal.",

  // ── The turn timer ──
  // Seconds left, beside the timer bar. Very short.
  timerShort: '{seconds}s',
  timerLabel: '{seconds, plural, one {# second remaining} other {# seconds remaining}}',

  // ── Reactions ──
  reactionPicker: 'Send a reaction',
  // A reaction as a chat line: the emoji, then its name.
  reactionLine: '{emoji} {label}',
  // Reaction names: shown under the emoji in the picker and in a bubble over a seat. Very short.
  'reaction.gg': 'GG',
  'reaction.nice_bluff': 'Nice bluff',
  // Slang: "suspicious".
  'reaction.sus': 'Sus',
  // Slang: bitter about losing.
  'reaction.salty': 'Salty',
  'reaction.wow': 'Wow',
  'reaction.lol': 'LOL',
  // "Rest in peace", said of a player who just lost.
  'reaction.rip': 'RIP',
  'reaction.no_way': 'No way',
  // Slang: a clever play.
  'reaction.big_brain': 'Big brain',
  // Nervous.
  'reaction.sweat': 'Sweating',
  'reaction.eyes': 'Watching you',
  // Slang: mocking someone who is making excuses.
  'reaction.cope': 'Cope',

  // ── Chat ──
  // Heading of the chat panel beside your hand on a desktop.
  tableTalk: 'Table talk',
  tableTalkLabel: 'Table chat',
  chatEmpty: 'No messages yet.',
  chatPlaceholder: 'Message the table',
  chatInputLabel: 'Chat message',
  // Button that sends a chat message.
  chatSend: 'Send',
  // Who said a chat line, before the line itself.
  chatSpeaker: '{name}:',
  quickPhrasesLabel: 'Quick messages',
  // One-tap chat lines. Each reader sees them in their own language.
  'phrase.nice_bluff': 'Nice bluff',
  // Claiming to hold the card in question.
  'phrase.have_it': 'I have it',
  'phrase.liar': 'Liar!',
  'phrase.well_played': 'Well played',
} satisfies Record<
  | `seat.faction.${Faction}`
  | `refusal.${RefusalKey}`
  | `cardAction.${Character}`
  | `cardAbility.${Character}`
  | `reaction.${ReactionId}`
  | `phrase.${QuickPhraseId}`,
  string
> & Record<string, string>;

export default game;
