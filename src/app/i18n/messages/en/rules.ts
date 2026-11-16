/**
 * How to Play: the rules reference (components/home/HowToPlay.tsx), opened
 * from the home menu, the lobby and the table. Classic rules on the first
 * three tabs, the Reformation expansion on the fourth.
 *
 * Translators: this is where a new player learns the game, so the rules must
 * stay exact. Every game noun is a param filled from the glossary
 * (`{duke}`, `{captain}`, `{coup}`, `{foreignAid}`, `{loyalist}`, `{reserve}`,
 * `{reformation}`...), and every rule number is a param from the game's
 * constants (`{coupCost}` 7, `{forcedCoup}` 10, `{assassinateCost}` 3,
 * `{startingCoins}` 2, `{taxCoins}` 3, `{stealCoins}` 2, `{incomeCoins}` 1,
 * `{foreignAidCoins}` 2, `{exchangeDraw}` 2, `{inquisitorDraw}` 1,
 * `{convertSelfCost}` 1, `{convertOtherCost}` 2, `{minPlayers}` 2,
 * `{maxPlayers}` 6). Keep the params; never type the word or the digit.
 * Action names are sometimes used as verbs ("you can't {coup} a player"):
 * rephrase around the glossary word as your language needs ("use {coup} on").
 * The words influence, claim, challenge, block, bluff and faction are
 * written out: use your glossary term for each (docs/I18N.md, Glossary).
 *
 * Rich-text tags: `<term>` marks a rules word set in white for emphasis;
 * `<loy>` / `<ref>` colour a faction's name or mark blue / red; `<inq>` colours
 * the Inquisitor teal; `<name>` sets an action name in white at the start of
 * its definition; `<link>` is a link. Keep each tag around the same words.
 */
const rules = {
  /** Dialog heading. */
  title: 'How to play',

  // ── Tabs (short: they sit side by side in one scrolling row) ──
  'tab.overview': 'Overview',
  'tab.characters': 'Characters',
  'tab.rules': 'Actions and rules',

  // ── Overview tab ──
  /** Heading. "Coup" is the product name here, not the action: never translate it. */
  'overview.whatIsHeading': 'What is Coup?',
  /** "Coup" at the start is the product name. "influence" is the glossary term, introduced here. */
  'overview.whatIs': 'Coup is a bluffing game for {minPlayers} to {maxPlayers} players. Everyone starts with two face-down cards, called influence, and {startingCoins, plural, one {# coin} other {# coins}}. The last player with a face-down card wins.',
  'overview.goalHeading': 'Goal',
  'overview.goal': "Make everyone else lose their influence. When you lose an influence, you turn one of your cards face-up. Lose both and you're out.",
  'overview.flowHeading': 'Basic flow',
  /** A numbered list of four steps: how one turn goes. */
  'overview.flow1': 'On your turn, take one action. Some actions claim a character.',
  'overview.flow2': "Any other player can <term>challenge</term> a claim. If you were bluffing, you lose an influence. If you weren't, the challenger loses one.",
  'overview.flow3': 'Some actions can be <term>blocked</term> by claiming the character that counters them. The player who acted can challenge the block.',
  'overview.flow4': 'If nobody challenges or blocks, the action happens.',
  'overview.bluffHeading': 'Bluffing',
  'overview.bluff': 'You can claim any character, whatever you hold. A claim only costs you if someone challenges it and you were lying.',
  'overview.creditsHeading': 'About the original game',
  /**
   * Credits. {designer} is Rikki Tahta, {publisher1} La Mame Games and
   * {publisher2} Indie Boards & Cards: names, never translated. <link> links
   * to the physical game in a shop.
   */
  'overview.credits': 'Coup is a card game designed by <term>{designer}</term>, originally published in 2012 by <term>{publisher1}</term> and <term>{publisher2}</term>. This is a fan-made adaptation. If you enjoy it, please support the creators by <link>purchasing the physical game</link>.',

  // ── Characters tab: one line per character, under the character's name ──
  'character.Duke': '{tax}: Take {taxCoins, plural, one {# coin} other {# coins}}. Blocks {foreignAid}.',
  'character.Assassin': '{assassinate}: Pay {assassinateCost, plural, one {# coin} other {# coins}}. The target loses a card.',
  'character.Captain': '{steal}: Take {stealCoins, plural, one {# coin} other {# coins}} from target. Blocks {steal}.',
  'character.Ambassador': '{exchange}: Draw {exchangeDraw}, return {exchangeDraw}. Blocks {steal}.',
  /** "Assassination" is the {assassinate} action as a noun. */
  'character.Contessa': 'Blocks Assassination.',
  'character.Inquisitor': "{exchange}: Draw {inquisitorDraw}, return {inquisitorDraw}. {examine}: Look at an opponent's card. Blocks {steal}.",

  // ── Actions and rules tab ──
  'actionsHeading': 'Actions',
  /** Column headings of the actions table (shown in capitals in English by CSS). */
  'table.action': 'Action',
  'table.cost': 'Cost',
  'table.effect': 'Effect',
  /** Column: the character the action claims. */
  'table.claims': 'Claims',
  /** Column: the characters that can block the action. */
  'table.blockedBy': 'Blocked By',
  /** Actions table, Effect column: coins gained, e.g. "+2 coins". */
  'effect.gain': '+{amount, plural, one {# coin} other {# coins}}',
  /** Actions table, Effect column, for Coup and Assassinate. */
  'effect.loseInfluence': 'Target loses influence',
  'effect.steal': 'Take {stealCoins, plural, one {# coin} other {# coins}} from target',
  'effect.exchange': 'Draw {exchangeDraw}, keep what you want',
  /** Two characters in one table cell, e.g. "Captain, Ambassador". */
  'table.pair': '{first}, {second}',
  'challengeHeading': 'Challenging',
  'challenge': "Any player can challenge a claim, whether it's for an action or a block. If the claimer has the card, they show it, shuffle it into the deck and draw a new one, and the challenger loses an influence. If they don't, the claimer loses an influence.",
  'blockHeading': 'Blocking',
  'block': 'Some actions can be blocked by claiming the character that counters them. A block is a claim, so it can be challenged, and you can bluff it.',
  'forcedHeading': 'Forced {coup}',
  'forced': 'If you start your turn with {forcedCoup, plural, one {# or more coins} other {# or more coins}}, you must {coup}.',

  // ── Reformation tab ──
  'reformation.whatIsHeading': 'What is {reformation}?',
  'reformation.whatIs': '{reformation} is an expansion that adds factions, three actions ({convert}, {embezzle} and {examine}) and the <inq>{inquisitor}</inq>. Turn it on in the lobby settings before the game starts.',
  'reformation.quickStartHeading': 'Quick start',
  /**
   * Quick start, step 1. {loyalistMark} and {reformistMark} are the faction
   * marks printed on each seat at the table (`markLoyalist`, `markReformist`).
   */
  'reformation.quick1': 'Check faction markers before targeting: <loy>{loyalistMark}</loy> and <ref>{reformistMark}</ref>.',
  'reformation.quick2': 'Use {convert} to fix targeting, rescue an ally, or put coins into the reserve.',
  'reformation.quick3': 'Only {embezzle} when the reserve is worth the challenge risk.',
  'reformation.quick4': "With the {inquisitor}, {exchange} draws {inquisitorDraw, plural, one {# card} other {# cards}} instead of {exchangeDraw}, and {examine} shows you a player's card.",
  /**
   * The faction marks on the seats: a triangle or diamond and the first
   * letters of the faction's name. Must match the marks the table prints
   * on each seat (game namespace).
   */
  markLoyalist: '▲ LOY',
  markReformist: '◆ REF',
  /** Button: opens the interactive Reformation walkthrough. */
  'reformation.openWalkthrough': 'Open the walkthrough',
  'reformation.factionsHeading': 'Factions',
  'reformation.factions': "Each player is a <loy>▲ {loyalist}</loy> or a <ref>◆ {reformist}</ref>. You can't {coup}, {assassinate}, {steal} from or {examine} a player in your own faction. Once every player left is in one faction, anyone can target anyone. While both factions remain, only the other faction can block your {foreignAid}.",
  'reformation.newActionsHeading': 'New actions',
  'reformation.convert': "<name>{convert}:</name> pay {convertSelfCost, plural, one {# coin} other {# coins}} to switch your own faction, or {convertOtherCost, plural, one {# coin} other {# coins}} to switch another player's. The coins go to the {reserve}. Nobody can challenge or block it.",
  'reformation.embezzle': "<name>{embezzle}:</name> take every coin in the {reserve} by claiming you don't have a {duke}. A challenge works the other way round: the challenger wins if you do have one.",
  'reformation.examine': '<inq>{examine}:</inq> claim the {inquisitor}. Your target picks one of their face-down cards to show you. Then you return it, or make them swap it for a random card from the deck.',
  /** Under the heading {inquisitor}. "it" is the Inquisitor option in the lobby settings. */
  'reformation.inquisitor': "Replaces the {ambassador} when it's turned on. The {inquisitor} can {exchange} (drawing {inquisitorDraw, plural, one {# card} other {# cards}} instead of {exchangeDraw}), {examine} another player's card, and block {steal} like the {captain}.",
  /** Under the heading {reserve}. "the treasury" is the main coin pool in the middle of the table. */
  'reformation.reserve': 'A pool of coins kept apart from the treasury. {convert} payments go in, and {embezzle} takes them all out.',
} satisfies Record<string, string>;

export default rules;
