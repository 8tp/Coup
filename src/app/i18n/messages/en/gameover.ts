/**
 * The game over screen: `GameOverOverlay.tsx` and `components/game/gameover/`
 * (title, final hands, "How it went", awards, more details, the recap export
 * and the pinned footer). The stats modal reuses the award titles.
 *
 * Players: a `{player}`-style param is a name, or `you` for the reader. Where
 * the reader starts a sentence or stands as a name, the message spells it out
 * in a `you` branch: `{actor, select, you {You ended it} other {{actor} ended it}}`,
 * the same convention as the action log. Add `you` branches wherever your
 * language needs a different verb or word order for "you".
 */
const gameover = {
  // ── Title and the line under it ──
  /** The title when the reader won. The largest heading in the game. */
  titleYouWin: 'You win',
  titleWins: '{name} wins',
  /** Shown only if the server sends no winner (should not happen). */
  titleNobodyWins: 'Nobody wins',

  // One line under the title about the reader's own game. Shown to the winner.
  winDefault: 'Everyone else is out.',
  winNoClaims: 'You won without claiming a character on your turn.',
  /** `count` is 1 or more. */
  winCaughtBluffing: '{count, plural, one {You were caught bluffing once and still won.} other {You were caught bluffing # times and still won.}}',
  /** `count` is 2 or more here and in the lines below with the same shape. */
  winChallengesWon: 'You won {count, plural, one {# challenge} other {# challenges}}.',
  winProvenHonest: 'You were challenged {count, plural, one {# time} other {# times}} and had the card every time.',
  winAssassinations: 'You won with {count, plural, one {# assassination} other {# assassinations}}.',
  winCoups: 'You won with {count, plural, one {# Coup} other {# Coups}}.',
  winBlocks: 'You blocked {count, plural, one {# action} other {# actions}}.',
  /** `count` is 3 or more. */
  winClaimsNeverCaught: 'You made {count, plural, one {# claim} other {# claims}} and were never caught.',

  // The same line for a player who lost.
  /** Under the title for a spectator, if shown. */
  loseSpectator: 'Thanks for watching.',
  loseFirstOut: 'You were the first player out.',
  loseCaughtBluffing: '{count, plural, one {You were caught bluffing once.} other {You were caught bluffing # times.}}',
  loseChallengesLost: 'You lost {count, plural, one {# challenge} other {# challenges}}.',
  loseNoClaims: 'You never claimed a character on your turn.',
  loseChallengesWon: 'You won {count, plural, one {# challenge} other {# challenges}}.',
  loseBlocks: 'You blocked {count, plural, one {# action} other {# actions}}.',
  loseLandedCoups: 'You landed {coups, plural, one {# Coup} other {# Coups}}.',
  loseLandedAssassinations: 'You landed {assassinations, plural, one {# assassination} other {# assassinations}}.',
  loseLandedBoth: 'You landed {coups, plural, one {# Coup} other {# Coups}} and {assassinations, plural, one {# assassination} other {# assassinations}}.',
  /** `place` is 2 to 5: the order in which the reader was knocked out. */
  loseOutPlace: '{place, plural, =2 {You were the 2nd player out.} =3 {You were the 3rd player out.} other {You were the #th player out.}}',
  loseOut: "You're out.",

  // ── Final hands ──
  handsHeading: 'Final hands',
  /** Legend beside the heading: the striped mark on a card means that card was lost. */
  lostCard: 'Lost card',
  /** The reader's own row, in place of their name. */
  youName: 'You',
  /** `<sr>` is read by screen readers only, before the winner's name. */
  handWinner: '<sr>Winner: </sr>{name}',
  /** Under the winner's name. Facts on this line are separated by " · ". */
  handCoinsLeft: '{count, plural, one {# coin left} other {# coins left}}',
  /** Under a knocked-out player's name: the turn they lost their last card. */
  handOutOnTurn: 'Out on turn {turn}',
  /** Games this player has won in this room so far. */
  handWins: '{count, plural, one {# win} other {# wins}}',

  // ── How it went ──
  recapHeading: 'How it went',
  /** The reader inside a sentence, where a name would go. */
  you: 'you',
  /** A player the screen cannot name (should not happen). */
  someone: 'Someone',

  // The move that ended the game. `actor` made it, `loser` lost their last card, `turn` is the turn number.
  finishCoup: '{actor, select, you {You ended it} other {{actor} ended it}} on turn {turn} with a Coup on {loser}.',
  finishAssassination: '{actor, select, you {You ended it} other {{actor} ended it}} on turn {turn} by assassinating {loser}.',
  /** `actor` challenged a claim and `loser` had been bluffing. */
  finishCaughtBluffing: '{actor, select, you {You ended it} other {{actor} ended it}} on turn {turn} by catching {loser} bluffing.',
  /** `actor` challenged a block and `loser` had been bluffing it. */
  finishCaughtBlockBluff: '{actor, select, you {You ended it} other {{actor} ended it}} on turn {turn} by catching {loser} bluffing a block.',
  /** `loser` challenged `actor`'s claim, and `actor` held the character. */
  finishChallengeFailed: '{actor, select, you {You ended it} other {{actor} ended it}} on turn {turn}: {loser} challenged and {actor} had the {character}.',
  /** `loser` challenged `actor`'s block, and `actor` held the character. */
  finishBlockChallengeFailed: '{actor, select, you {You ended it} other {{actor} ended it}} on turn {turn}: {loser} challenged the block and {actor} had the {character}.',
  finishChallengeLost: '{actor, select, you {You ended it} other {{actor} ended it}} on turn {turn} when {loser} lost a challenge.',
  finishLastCard: '{player, select, you {You lost your last card} other {{player} lost their last card}} on turn {turn}.',
  /** Used when the log has no knockout to describe. */
  finishLasted: 'The game lasted {turns, plural, one {# turn} other {# turns}}.',

  // Bluffs across the table. A claim is a character claimed for an action or a block; a bluff is a claim without the card.
  bluffsHonestOne: 'The one claim was honest.',
  /** `claims` is 2 or more. */
  bluffsHonestAll: 'All {claims, plural, one {# claim was} other {# claims were}} honest.',
  /** One bluff in `claims` claims (`claims` can be 1). */
  bluffsOneCaught: '1 of {claims, plural, other {# claims}} was a bluff. It was caught.',
  bluffsOneGotAway: '1 of {claims, plural, other {# claims}} was a bluff. It got away.',
  /**
   * `bluffs` (2 or more) of `claims` claims were bluffs. `outcome` is none,
   * all or some; `caught` is how many were caught.
   */
  bluffsMany: '{bluffs} of {claims, plural, one {# claim} other {# claims}} were bluffs. {outcome, select, none {None were caught.} all {All were caught.} other {{caught, plural, one {# was caught.} other {# were caught.}}}}',
  /** As above, plus the one player who bluffed most (`leaderBluffs`, 2 or more). */
  bluffsManyLeader: '{bluffs} of {claims, plural, one {# claim} other {# claims}} were bluffs. {outcome, select, none {None were caught.} all {All were caught.} other {{caught, plural, one {# was caught.} other {# were caught.}}}} {leader, select, you {You bluffed} other {{leader} bluffed}} the most, {leaderBluffs, plural, one {once} =2 {twice} other {# times}}.',

  // Challenges across the table.
  challengesOnlyWon: '{winner, select, you {You made} other {{winner} made}} the only challenge and won it.',
  challengesOnlyFailed: 'The only challenge failed.',
  /** `made` is 2 or more. */
  challengesAllFailed: 'All {made, plural, one {# challenge} other {# challenges}} failed.',
  /** `won` of `made` challenges succeeded. */
  challengesWon: 'Challengers won {won} of {made, plural, one {# challenge} other {# challenges}}.',
  /** As above, and `best` won every successful challenge. */
  challengesWonLeaderAll: 'Challengers won {won} of {made, plural, one {# challenge} other {# challenges}}. {best, select, you {You won} other {{best} won}} all of them.',
  /** As above, and `best` won the most of them (`bestWon`). */
  challengesWonLeaderSome: 'Challengers won {won} of {made, plural, one {# challenge} other {# challenges}}. {best, select, you {You won} other {{best} won}} {bestWon}.',

  // ── Awards ──
  // Up to four light-hearted awards, one per player. The names are jokes:
  // adapt them so they land in your language rather than translating word
  // for word. Each comment says what the joke is and what earns the award.
  // A line (`awardLine.*`) sits under the award name: the player, a comma,
  // then what they did. `<who>` marks the player and is drawn brighter.
  awardsHeading: 'Awards',

  /** From the playground taunt "Liar, liar, pants on fire". For the player caught bluffing the most (at least once). */
  'awardTitle.pantsOnFire': 'Pants on Fire',
  /** "{count}x" means "{count} times". */
  'awardLine.pantsOnFire': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, caught bluffing {count, plural, other {#x}}',
  /** Nickname of US President Abraham Lincoln, a byword for honesty. For the player most often challenged while holding the card, and never caught bluffing. */
  'awardTitle.honestAbe': 'Honest Abe',
  'awardLine.honestAbe': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, proven honest {count, plural, other {#x}}, never caught',
  /** An inquisitor interrogates everyone; it also echoes the Inquisitor card, so reusing your glossary word for that card keeps the pun. For the player who made the most challenges (at least 2). */
  'awardTitle.inquisitor': 'The Inquisitor',
  'awardLine.inquisitor': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, {count, plural, one {# challenge} other {# challenges}} made',
  /** Someone sharp-sighted who spots everything. For the best challenge accuracy (at least 2 challenges, half or more correct). */
  'awardTitle.eagleEye': 'Eagle Eye',
  /** `won` of `made` challenges were correct. */
  'awardLine.eagleEye': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, {won}/{made} challenges correct',
  /** Nothing gets past a wall. For the player who blocked the most (at least 2 blocks). */
  'awardTitle.wall': 'The Wall',
  'awardLine.wall': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, {count, plural, one {# block} other {# blocks}} made',
  /** A smooth talker who gets away with things (also a Sade song). For the most claims (at least 4) without ever being caught bluffing. */
  'awardTitle.smoothOperator': 'Smooth Operator',
  'awardLine.smoothOperator': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, {count, plural, one {# claim} other {# claims}}, never caught',
  /** A play on "killing machine": a player who keeps launching Coups. For the most Coups (at least 2). */
  'awardTitle.coupMachine': 'Coup Machine',
  'awardLine.coupMachine': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, {count, plural, one {# Coup} other {# Coups}} launched',
  /** An assassin who strikes unseen. For the most assassinations (at least 1). */
  'awardTitle.silentAssassin': 'Silent Assassin',
  'awardLine.silentAssassin': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, {count, plural, one {# assassination} other {# assassinations}}',
  /** Ironic praise for a plan that did not work, from the film Dodgeball ("Bold strategy, Cotton"). For the player whose challenges failed the most (at least 2). */
  'awardTitle.boldStrategy': 'Bold Strategy',
  'awardLine.boldStrategy': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, {count, plural, one {# challenge} other {# challenges}} lost',
  /** Gentle teasing for leaving early. For the first player knocked out. */
  'awardTitle.quickExit': 'Quick Exit',
  'awardLine.quickExit': '{player, select, you {<who>You</who>} other {<who>{player}</who>}}, first player eliminated',

  // ── More details ──
  /** Accessible name of the section holding the buttons below. */
  moreLabel: 'More about this game',
  /** Buttons, two to a row on a phone: keep them short. "Bluffs" is the per-player bluff table. */
  showBluffs: 'Show Bluffs',
  hideBluffs: 'Hide Bluffs',
  showLog: 'Show Full Log',
  hideLog: 'Hide Log',
  /** Copies a plain-text recap of the game to the clipboard. */
  copyRecap: 'Copy Recap',
  /** Saves the same recap as a .txt file. */
  downloadLog: 'Download Log',
  recapCopied: 'Recap copied',
  copyFailed: "Can't copy here. Download the log instead.",

  // One row per player in the bluff table, beside their name. Facts are separated by " · ".
  bluffRowAllHonest: '{claims, plural, one {# claim} other {# claims}}, all honest',
  bluffRowClaims: '{claims, plural, one {# claim} other {# claims}}',
  bluffRowBluffs: '{count, plural, one {# bluff} other {# bluffs}}',
  /** How many of this player's bluffs were challenged and caught. */
  bluffRowCaught: '{count} caught',
  /** How many of this player's bluffs nobody challenged. */
  bluffRowGotAway: '{count} got away',

  // The plain-text recap that Copy Recap and Download Log produce.
  /** First line. `room` is the 4-letter room code. */
  exportTitle: 'Coup Online recap, room {room}',
  exportWinner: 'Winner: {name}',
  exportWinnerUnknown: 'Winner: Unknown',
  exportTurns: 'Turns: {count}',
  exportMode: 'Mode: {mode}',
  /** Reformation played with the Inquisitor card in place of the Ambassador. */
  exportModeInquisitor: 'Mode: {mode} with {inquisitor}',
  exportTableHeading: 'Final table:',
  /** One line per player. `status` is one of the three words below; `cards` is the list of their cards. */
  exportPlayer: '- {name}: {status}, {coins, plural, one {# coin} other {# coins}}, {cards}',
  exportPlayerFaction: '- {name}: {status}, {coins, plural, one {# coin} other {# coins}}, {faction}, {cards}',
  exportStatusWinner: 'winner',
  exportStatusAlive: 'alive',
  exportStatusOut: 'eliminated',
  /** A card that was lost and turned face up. */
  exportCardRevealed: '{character} revealed',
  /** A card still face down at the end. */
  exportCardHidden: '{character} hidden',
  /** A face-down card whose character this player cannot see. */
  exportCardUnknown: 'hidden card',
  /** Separates the cards in a player's list. */
  exportListSeparator: ', ',
  exportLogHeading: 'Final log:',
  /** One log line. `turn` is the turn number, already padded ("05"); "T" stands for turn. */
  exportLogLine: '[T{turn}] {line}',

  // ── Footer ──
  /** The rematch button: returns everyone to the lobby for another game. */
  playAgain: 'Play Again',
  /** Leaves the room for the home screen. */
  leave: 'Leave',
  /** Practice games: the only way out, to the home screen. */
  backHome: 'Back Home',
  /** In place of the rematch button for someone watching. */
  spectating: 'Spectating',
  /** In place of the rematch button for a player who is not the host. */
  waitingForHost: 'Waiting for the host to start a rematch',
  /** A small link that opens the feedback form. */
  feedback: 'Report a bug or idea',
} satisfies Record<string, string>;

export default gameover;
