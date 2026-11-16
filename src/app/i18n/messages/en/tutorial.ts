/**
 * Everything that teaches by doing: the "How Coup works" walkthrough
 * (components/tutorial/Tutorial.tsx, six chapters and a reference card), the
 * Reformation walkthrough (ReformationTutorial.tsx, four chapters and a
 * recap), the stage both play on (onboarding/OnboardingShell.tsx), the
 * Practice vs Bots setup sheet (onboarding/PracticeSetupSheet.tsx) and the
 * practice coach callouts (game/PracticeCoach.tsx, utils/practiceCoach.ts).
 *
 * Translators, read first:
 * - Each chapter has a title (one line, the rule it teaches), a lede (two or
 *   three sentences under it), a demonstration on a miniature table, and a
 *   note: one line of feedback on what the player just did. On a phone the
 *   note and the buttons share the screen with the cards, so keep notes and
 *   button labels as short as the English allows.
 * - Game nouns and rule numbers are params from the glossary and the game's
 *   constants (`{duke}`, `{coup}`, `{foreignAid}`, `{loyalist}`, `{reserve}`;
 *   `{coupCost}` 7, `{forcedCoup}` 10, `{assassinateCost}` 3, `{taxCoins}` 3,
 *   `{stealCoins}` 2, `{incomeCoins}` 1, `{foreignAidCoins}` 2,
 *   `{startingCoins}` 2, `{exchangeDraw}` 2, `{inquisitorDraw}` 1,
 *   `{convertSelfCost}` 1, `{convertOtherCost}` 2). Keep them; never type the
 *   word or the digit. Action names sometimes stand as verbs ("{examine}
 *   {player}"): phrase around the glossary word as your language needs.
 * - `{player}` is a player's name in the demonstration (Alex, Morgan, Tutor
 *   Bot), never translated. `{actor}` / `{blocker}` in the coach are real
 *   players' names.
 * - The words influence, claim, challenge, block, bluff and faction are
 *   written out: use your glossary term (docs/I18N.md, Glossary). Per
 *   docs/VOICE.md, "influence" is introduced once (chapter 1) and after that
 *   the tutorial and the coach say "lose a card".
 * - `<fig>` wraps a number set as a figure (always left to right).
 */
const tutorial = {
  // ═══ The stage (OnboardingShell) ═══

  /** Accessible name of the chapter rail (a row of segments across the top). */
  'shell.chapters': 'Chapters',
  /** Screen-reader name of one rail segment, e.g. "Chapter 2: Your turn". */
  'shell.chapterLabel': 'Chapter {index}: {label}',
  /** Announced when the chapter changes, e.g. "Chapter 2 of 6: Your turn". */
  'shell.chapterStatus': 'Chapter {index} of {total}: {label}',
  /** Announced on the finish screen. {title} is the walkthrough's name. */
  'shell.finished': '{title}: done',
  /** Screen-reader label of the ✕ button. {title} is the walkthrough's name. */
  'shell.close': 'Close {title}',
  /** Footer button on the first chapter: leaves the walkthrough. */
  'shell.skip': 'Skip',
  /** Footer button: to the next chapter. */
  'shell.next': 'Next',
  /** Footer button on the last teaching chapter: to the finish screen. */
  'shell.finish': 'Finish',
  /** Keyboard hint in the footer, desktop only. The arrows are the arrow keys. */
  'shell.keys': '← → to move · Esc to close',

  // ── Pieces shared by both walkthroughs ──

  /** Name plate on your own hand in the demonstrations, and the actor on your claims. Very short. */
  you: 'You',
  /** Name plate on your hand with your faction mark, e.g. "You · ▲ Loyalist". Short. */
  youLoyalist: 'You · ▲ {loyalist}',
  youReformist: 'You · ◆ {reformist}',
  /** Screen-reader label of a coin count. */
  coins: '{count, plural, one {# coin} other {# coins}}',
  /** Stamped across your hand when both cards are lost. One short word. */
  outStamp: 'Out',
  /** Placeholder in the middle of the miniature table before anyone claims. */
  tableGhost: 'The table',
  /** Under a claim on the plaque, e.g. "as Duke". Short. */
  'plaque.as': 'as {character}',
  /** Under a claim aimed at you, e.g. "as Captain · on You". Short. */
  'plaque.asOnYou': 'as {character} · on You',
  /** The plaque of your block. Very short. */
  'plaque.blocks': 'Blocks',
  /** Under the Embezzle plaque: the claim is that you have no Duke. Short. */
  'plaque.noDuke': 'claiming no {duke}',
  tryAgain: 'Try again',
  startOver: 'Start over',

  // ═══ "How Coup works" ═══

  /** The walkthrough's name. "Coup" is the product name. */
  'basics.title': 'How Coup works',
  /** Rail labels, one per chapter. Very short: six share a phone's width. */
  'chapter.goal': 'The goal',
  'chapter.turn': 'Your turn',
  'chapter.claims': 'Claims',
  'chapter.challenge': 'Challenge',
  'chapter.blocks': 'Blocks',
  'chapter.coins': 'Coins',
  'chapter.finish': 'Ready',

  // ── 1. The goal: two hidden cards; lose both and you're out ──
  'goal.title': "Lose both cards and you're out",
  /** Introduces "influence", the glossary term for your face-down cards. */
  'goal.lede': 'You start with two face-down cards and {startingCoins, plural, one {# coin} other {# coins}}. The cards are your influence. The last player with a face-down card wins.',
  /** The demo steps through four states; each has a note and a button. */
  'goal.dealt.note': 'Only you can look at your own cards.',
  'goal.dealt.cta': 'Look at your cards',
  'goal.peeked.note': 'Everyone else sees two card backs.',
  'goal.peeked.cta': 'Lose a card',
  'goal.lostOne.note': "A lost card turns face-up for the whole table. You still have one, so you're still in.",
  'goal.lostOne.cta': 'Lose the other',
  'goal.out.note': "Both cards are face-up. You're out.",
  'goal.out.cta': 'Deal again',

  // ── 2. Your turn: one action; three for anyone, four that claim a character ──
  'turn.title': 'Take one action on your turn',
  'turn.lede': '{income}, {foreignAid} and {coup} are open to anyone. The other four each belong to a character. To use one, you claim that character.',
  'turn.prompt': 'Tap an action.',
  /** Group label over the three general actions. Short. */
  'turn.anyone': 'Anyone can',
  /** Group label over the four character actions. Short. */
  'turn.claimGroup': 'Claim a character',
  /** Small line under a tile's action name: what it pays. Very short. */
  'turn.gain': '+{amount, plural, one {# coin} other {# coins}}',
  /** Small line under the Coup tile. Very short. */
  'turn.pay': 'Pay {amount}',
  /** You tapped an action you can't afford. {action} is its name. */
  'turn.refused': '{action} costs {cost}. You have {coins, plural, one {# coin} other {# coins}}.',
  /** What the tapped action did, in one line. */
  'turn.result.income': '{income}: +{incomeCoins, plural, one {# coin} other {# coins}}. Nobody can stop it.',
  'turn.result.foreign-aid': '{foreignAid}: +{foreignAidCoins, plural, one {# coin} other {# coins}}, unless someone blocks it with a {duke}.',
  'turn.result.coup': '{coup}: pay {coupCost} and pick a player to lose a card.',
  'turn.result.tax': '{tax}: you claim the {duke} and take {taxCoins, plural, one {# coin} other {# coins}}.',
  'turn.result.steal': '{steal}: you claim the {captain} and take {stealCoins, plural, one {# coin} other {# coins}} from another player.',
  'turn.result.assassinate': '{assassinate}: you claim the {assassin}, pay {assassinateCost}, and pick a player to lose a card.',
  'turn.result.exchange': '{exchange}: you claim the {ambassador}, draw {exchangeDraw, plural, one {# card} other {# cards}} and put back any {exchangeDraw}.',

  // ── 3. Claims: you may claim a character you don't hold (a bluff) ──
  'claims.title': "You can claim a character you don't have",
  'claims.lede': 'Nobody can see your cards, so a claim is only your word. Your hand is a {captain} and a {contessa}. Claim the {duke} and take {tax}.',
  'claims.prompt': "There's no {duke} in your hand. Claim it anyway.",
  'claims.done': 'Nobody challenged, so the bluff worked and the {taxCoins, plural, one {# coin is} other {# coins are}} yours.',
  /** Button: claim the Duke to take Tax. Keep it to one line on a phone. */
  'claims.button': 'Claim {duke} · {tax} +{taxCoins}',

  // ── 4. Challenge: call a claim; whoever is wrong loses a card ──
  'challenge.title': "Challenge a claim you don't believe",
  'challenge.lede': 'Anyone can challenge a claim. If the claimer has the card, the challenger loses a card. If not, the claimer does.',
  /** Round one: {player} is bluffing. */
  'challenge.bluffPrompt': '{player} claims the {duke} to take {tax}. Challenge it or let it go.',
  /** Round two: {player} really has the Duke. */
  'challenge.truthPrompt': '{player} claims the {duke} again. Challenge it.',
  /** You let the claim go. */
  'challenge.passed': "{player} takes the {taxCoins, plural, one {# coin} other {# coins}}. You'll never know if it was a bluff.",
  /** Shown for a moment while the card flips. */
  'challenge.flipping': '{player} turns over a card…',
  'challenge.caughtBluff': 'No {duke}. {player} was bluffing and loses a card.',
  'challenge.wasTrue': '{player} had the {duke}, so you lose a card. {player} shuffles the {duke} into the deck and draws a new card.',
  /** Button: challenge the claim. */
  'challenge.challenge': 'Challenge',
  /** Button: don't challenge. */
  'challenge.letGo': 'Let it go',
  /** Button: go on to round two, where the claim is true. */
  'challenge.nextRound': 'Now a true claim',

  // ── 5. Blocks: claim the character that counters an action ──
  'blocks.title': 'Blocking stops an action',
  'blocks.lede': 'A challenge says a claim is a lie. A block stops the action instead: you claim the character that counters it.',
  /** Counter over the demo: "Threat 1 of 3". */
  'blocks.count': 'Threat <fig>{index}</fig> of <fig>{total}</fig>',
  /** Three threats in turn; you tap the character that blocks each. */
  'blocks.ask.ForeignAid': '{player} takes {foreignAid}. Tap the character that blocks it.',
  'blocks.ask.Steal': '{player} steals {stealCoins, plural, one {# of your coins} other {# of your coins}}. Tap a character that blocks it.',
  'blocks.ask.Assassinate': '{player} assassinates you. Tap the character that blocks it.',
  'blocks.result.ForeignAid': 'Blocked. Any player can claim the {duke} to stop {foreignAid}.',
  'blocks.result.Steal': 'Blocked. The {captain} and the {ambassador} both stop {steal}.',
  /** The last threat. "an Assassination" is the {assassinate} action as a noun. */
  'blocks.result.Assassinate': 'Blocked. Only the {contessa} stops an Assassination. A block is a claim too, so {player} can challenge it.',
  /** You tapped a character that can't block this action. */
  'blocks.miss': "{character} can't block {action}. Try another.",
  /** Accessible name of the row of characters to tap. */
  'blocks.choices': 'Blockers',
  'blocks.next': 'Next threat',

  // ── 6. Coins: Coup costs 7; at 10 you must Coup ──
  'coins.title': '{coup} costs {coupCost}. At {forcedCoup} coins you must {coup}.',
  'coins.lede': 'Nobody can block or challenge a {coup}, so the target always loses a card. If you start your turn with {forcedCoup, plural, one {# or more coins} other {# or more coins}}, {coup} is the only action you can take.',
  'coins.collect': 'You have {coins, plural, one {# coin} other {# coins}}. Collect {coupCost}, then {coup}.',
  'coins.ready': 'You can {coup} now. Keep collecting to see what happens at {forcedCoup}.',
  'coins.forced': '{coins, plural, one {# coin} other {# coins}}. {coup} is your only move.',
  'coins.couped': '{coup}. {player} loses a card.',
  /** You tapped Income or Tax at 10 or more coins. */
  'coins.refusal.must-coup': 'At {forcedCoup} coins you must {coup}.',
  /** You tapped Coup without enough coins. */
  'coins.refusal.short': 'A {coup} costs {coupCost}. You need {short, plural, one {# more coin} other {# more coins}}.',
  /** Screen-reader label of the coin meter, e.g. "5 coins of 10". */
  'coins.meter': '{coins, plural, one {# coin} other {# coins}} of {forcedCoup}',
  /** Tick labels on the coin meter. Tiny: they sit above the meter's slots. */
  'coins.markCoup': '{coupCost} · {coup}',
  /** Tick at 10: the point where Coup becomes compulsory. One short word after the number. */
  'coins.markMust': '{forcedCoup} · Must',
  /** Buttons, three in one row on a phone: keep each very short. */
  'coins.income': '{income} +{incomeCoins}',
  'coins.tax': '{tax} +{taxCoins}',
  /** Under the demo: your coin count. */
  'coins.purse': 'You: {coins, plural, one {<fig>#</fig> coin} other {<fig>#</fig> coins}}',

  // ── Finish: the reference card ──
  'finish.title': 'The characters',
  'finish.lede': 'You can claim any of them at any time. Your real cards only matter when someone challenges.',
  /** Accessible name of the list of characters. */
  'finish.list': 'The six characters',
  /** Reference card: what each character does, then what it blocks. Each fits one short line. */
  'ref.Duke.does': '{tax}: take {taxCoins, plural, one {# coin} other {# coins}}',
  'ref.Duke.blocks': 'Blocks {foreignAid}',
  'ref.Assassin.does': '{assassinate}: pay {assassinateCost}, a player loses a card',
  'ref.Assassin.blocks': 'Blocks nothing',
  'ref.Captain.does': '{steal}: take {stealCoins, plural, one {# coin} other {# coins}}',
  'ref.Captain.blocks': 'Blocks {steal}',
  'ref.Ambassador.does': '{exchange}: draw {exchangeDraw}, return {exchangeDraw}',
  'ref.Ambassador.blocks': 'Blocks {steal}',
  /** The Contessa has no action of her own. */
  'ref.Contessa.does': 'No action',
  /** "Assassination" is the {assassinate} action as a noun. */
  'ref.Contessa.blocks': 'Blocks Assassination',
  'ref.Inquisitor.does': '{exchange} or {examine}',
  'ref.Inquisitor.blocks': 'Blocks {steal}',
  'finish.general': 'Anyone can take {income} (+{incomeCoins}), {foreignAid} (+{foreignAidCoins}) or {coup} ({coupCost, plural, one {# coin} other {# coins}}).',
  /** Finish screen button: starts a practice game against a bot with the coach on. */
  'finish.playGuided': 'Play a guided game',

  // ═══ The Reformation walkthrough ═══

  'reform.title': '{reformation} walkthrough',
  /** Rail label for chapter 1; the other three are the action names. Very short. */
  'reform.chapter.factions': 'Factions',

  // ── 1. Factions: you can only target the other faction ──
  'reform.factions.title': 'You can only target the other faction',
  'reform.factions.lede': 'Everyone is a {loyalist} ▲ or a {reformist} ◆. {coup}, {assassinate}, {steal} and {examine} can only target the other faction. Once every player left is in one faction, anyone can target anyone.',
  'reform.factions.prompt': "You're a {loyalist} ▲. Tap a player you can target.",
  'reform.factions.right': '{player} is a {reformist}, so you can target them.',
  'reform.factions.wrong': "{player} is a {loyalist} like you, so you can't target {player}.",
  /** Under a seat you can't target. Very short. */
  'reform.factions.sameFaction': 'Same faction',

  // ── 2. Convert: pay to switch a faction ──
  'reform.convert.title': '{convert} switches a faction',
  'reform.convert.lede': "Pay {convertSelfCost, plural, one {# coin} other {# coins}} to switch your own faction or {convertOtherCost} to switch another player's. Nobody can challenge or block it. The coins go to the reserve.",
  'reform.convert.prompt': 'Two players left: you, a {loyalist}, and {player}, a {reformist}.',
  'reform.convert.done': "You're a {reformist} now. With everyone in one faction, anyone can target anyone.",
  'reform.convert.button': '{convert} yourself · {convertSelfCost, plural, one {# coin} other {# coins}}',

  // ── 3. Embezzle: claim you have no Duke, take the reserve ──
  'reform.embezzle.title': '{embezzle} takes the whole reserve',
  'reform.embezzle.lede': "To {embezzle}, you claim you don't have a {duke}. A challenge works the other way round: the challenger wins only if you do have one.",
  'reform.embezzle.prompt': 'Your hand is a {captain} and an {inquisitor}. No {duke}.',
  'reform.embezzle.done': '{player} challenged and you had no {duke}, so {player} loses a card. You draw two new cards and take the {coins, plural, one {# coin} other {# coins}}.',
  'reform.embezzle.button': '{embezzle} {coins, plural, one {# coin} other {# coins}}',
  /** Label on the reserve's coin pile. One short word. */
  'reform.reserve': 'Reserve',
  /** Screen-reader label of the reserve, e.g. "Treasury Reserve: 4 coins". */
  'reform.reserveLabel': '{reserve}: {coins, plural, one {# coin} other {# coins}}',

  // ── 4. Examine: see one card, then return it or force a swap ──
  'reform.examine.title': '{examine} looks at one card',
  'reform.examine.lede': '{examine} claims the {inquisitor}. Your target picks one of their cards to show you. Then you return it, or make them swap it for a card from the deck.',
  'reform.examine.prompt': 'You have the {inquisitor}. {examine} {player}.',
  'reform.examine.shown': '{player} shows you a {duke}. Return it or force a swap.',
  'reform.examine.returned': '{player} keeps the {duke}, and only you know about it.',
  'reform.examine.swapped': "The {duke} goes into the deck and {player} draws a new card. They lost the {duke}, but now you don't know what they have.",
  /** Button: Examine the bot. */
  'reform.examine.button': '{examine} {player}',
  /** Buttons after seeing the card. Short. */
  'reform.examine.return': 'Return it',
  'reform.examine.swap': 'Force swap',

  // ── Recap ──
  'reform.recap.title': 'What {reformation} changes',
  'reform.recap.lede': 'Claims, challenges and blocks work the same as in the base game.',
  'reform.recap.factions': 'Target the other faction until everyone left is in one.',
  'reform.recap.convert': "Pay {convertSelfCost} to switch your faction or {convertOtherCost} to switch someone else's. The coins go to the reserve.",
  'reform.recap.embezzle': 'Claim you have no {duke} and take the whole reserve.',
  'reform.recap.examine': "See one of a player's cards, then return it or force a swap.",
  /** "Practice" is the main menu's practice button; use the same word as that button. */
  'reform.recap.practice': 'To play it with tips, open Practice on the main menu and pick {reformation}.',

  // ═══ Practice vs Bots: the setup sheet ═══

  'setup.title': 'Practice vs Bots',
  'setup.lede': 'A private game against bots, with a coach that points at what matters.',
  'setup.close': 'Close practice setup',
  /** Setting: how many bots to play against (buttons 1, 2, 3). */
  'setup.opponents': 'Opponents',
  /** Setting: how the bots play. */
  'setup.style': 'Bot style',
  /** Three bot styles, side by side in one row: one short word each. */
  'setup.style.gentle': 'Gentle',
  'setup.style.sharp': 'Sharp',
  'setup.style.ruthless': 'Ruthless',
  'setup.blurb.gentle': 'Rarely bluffs, rarely challenges. Good for a first game.',
  'setup.blurb.sharp': "Counts the cards and calls bluffs that don't add up.",
  'setup.blurb.ruthless': 'Bluffs when it pays and goes after the leader.',
  /** Setting: Classic or Reformation rules. */
  'setup.rules': 'Rules',
  'setup.hint.classic': "The base game. Start here if you're new.",
  'setup.hint.reformation': 'Factions, {convert}, {embezzle} and the {inquisitor}.',
  /** Reformation picked with 1 opponent. */
  'setup.hint.reformationSolo': 'Factions need at least {count} opponents to matter.',
  /** Switch: show the coach callouts during the game. */
  'setup.coach': 'Coach tips',
  'setup.coachOn': 'Callouts point at what to do next',
  'setup.coachOff': 'No tips',
  /** The start button, and its label while the game is being set up. */
  'setup.start': 'Start practice',
  'setup.starting': 'Dealing…',
  /**
   * Small line under the start button, e.g. "1 gentle opponent · Classic".
   * {style} is gentle, sharp or ruthless (the bot styles above); {mode} is
   * the rules' name from the glossary.
   */
  'setup.summary': '{style, select, gentle {{count, plural, one {# gentle opponent} other {# gentle opponents}}} sharp {{count, plural, one {# sharp opponent} other {# sharp opponents}}} ruthless {{count, plural, one {# ruthless opponent} other {# ruthless opponents}}} other {{count, plural, one {# opponent} other {# opponents}}}} · {mode}',

  // ═══ The practice coach ═══
  // A callout during a practice game: a title (one line, large) and a body
  // (one to three short sentences) pointing at the part of the table it is
  // about. About 20rem wide on desktop, a banner on phones. `label` is a
  // short tag for each tip (one to three words; not shown on screen at
  // present). {actor} and {blocker} are players' names.

  'coach.region': 'Practice coach',
  /** Tag in the callout's top corner. One short word. */
  'coach.tag': 'Coach',
  /** Button: dismiss this tip. Very short. */
  'coach.gotIt': 'Got it',
  /** Button: turn the coach off for this game. Very short. */
  'coach.hide': 'Hide tips',
  /** Link: open the rules reference. */
  'coach.rules': 'Check the rules',
  /** Stands in for a player's name the coach can't find (should not happen). */
  'coach.someone': 'The bot',
  /** Stands in for the list of characters that can block, if the coach can't tell (should not happen). */
  'coach.blockerFallback': 'the shown character',

  'coach.coins': '{count, plural, one {# coin} other {# coins}}',

  // You must pick a card to lose.
  'coach.chooseInfluence.label': 'Lose a card',
  'coach.chooseInfluence.title': 'Give up the card you need least',
  'coach.chooseInfluence.body': 'It turns face-up for everyone. Keep the one that backs the claims and blocks you plan to make.',

  // You are choosing which cards to keep in an Exchange.
  'coach.exchange.title': "Keep the characters you've claimed",
  'coach.exchange.body': "Holding them makes those claims safe to repeat. If you haven't claimed anything yet, keep the cards with the most uses. The rest go back into the deck.",

  // Someone is Examining you: you pick which card they see.
  'coach.examineSelection.label': 'Examined',
  'coach.examineSelection.title': 'You choose which card they see',
  'coach.examineSelection.body': "Show the card you'd mind least losing to a swap. Only the examiner learns what it is.",

  // You have Examined someone's card and must return it or force a swap.
  'coach.examineDecision.title': "You've seen one of their cards",
  'coach.examineDecision.body': 'Return it and you know what they hold. Force a swap and the card goes into the deck, but you lose track of their hand.',

  // The first time an action is aimed at you (shown once per game).
  'coach.firstTargeted.label': 'You are the target',
  'coach.firstTargeted.title': '{actor} is targeting you',
  /**
   * {action} is the action aimed at you; {character} the character its actor
   * claims ({claimed} is "no" if, unusually, they claim none); {blockers} the
   * characters that can block it, joined with "or" ({blockable} is "no" when
   * nothing can).
   */
  'coach.firstTargeted.Steal': '{action} takes {stealCoins, plural, one {# of your coins} other {# of your coins}}. {claimed, select, no {Challenge if you doubt their claim.} other {Challenge if you doubt their {character}.}}{blockable, select, no {} other { Or block it now with {blockers}.}}',
  'coach.firstTargeted.Assassinate': '{action} makes you lose a card. {claimed, select, no {Challenge if you doubt their claim.} other {Challenge if you doubt their {character}.}}{blockable, select, no {} other { Or block it now with {blockers}.}}',
  'coach.firstTargeted.Examine': '{action} lets them look at one of your cards. {claimed, select, no {Challenge if you doubt their claim.} other {Challenge if you doubt their {character}.}}{blockable, select, no {} other { Or block it now with {blockers}.}}',
  'coach.firstTargeted.other': '{action} is aimed at you. {claimed, select, no {Challenge if you doubt their claim.} other {Challenge if you doubt their {character}.}}{blockable, select, no {} other { Or block it now with {blockers}.}}',

  // An action aimed at you that you can block, during its challenge window.
  'coach.blockOrChallenge.label': 'Block?',
  'coach.blockOrChallenge.title': 'You can block this {action}',
  'coach.blockOrChallenge.body': 'Claim {blockers} to stop it, even without the card. {claimed, select, no {Or challenge their claim.} other {Or challenge their {character}.}} A lost challenge costs you a card.',

  // Someone claims a character; you may challenge.
  'coach.challengeClaim.label': 'Challenge?',
  'coach.challengeClaim.title': '{claimed, select, no {{actor} claims a character} other {{actor} claims {character}}}',
  'coach.challengeClaim.body': "{claimed, select, no {Challenge if you think they don't have that card.} other {Challenge if you think they don't have {character}.}} If they do, you lose a card, so letting it go is often safer.",
  /** Embezzle is a claim to have no Duke: a challenge wins only if they do have one. */
  'coach.challengeEmbezzle.title': '{actor} claims to have no {duke}',
  'coach.challengeEmbezzle.body': "Challenge only if you think they have a {duke}. If they don't, you lose a card.",

  // Someone blocked your action; you may challenge the block.
  'coach.challengeBlock.label': 'Blocked',
  'coach.challengeBlock.title': 'A block is a claim too',
  'coach.challengeBlock.body': "{blocker} claims {character} to block. Challenge only if you'll risk a card on it being a lie.",

  // The first time you can block (shown once per game), then the plain version.
  'coach.firstBlock.label': 'Your first block',
  'coach.firstBlock.title': 'You can block this {action}',
  'coach.firstBlock.body': "Claim {blockers} to stop it, even if you don't have one. They can challenge your block, and a caught bluff costs you a card.",
  'coach.makeBlock.label': 'Block?',
  'coach.makeBlock.title': 'You can block {action}',
  'coach.makeBlock.body': 'Blocking means claiming {blockers}. You can bluff it, but they can challenge.',

  // Your turn with 10 or more coins: Coup is compulsory.
  'coach.mustCoup.title': 'At {forcedCoup} coins you must {coup}',
  'coach.mustCoup.body': '{coup} is your only move. Pick the opponent who worries you most. Nobody can block or challenge it.',

  // Your turn with 7 or more coins.
  'coach.coupReady.title': 'You can {coup}',
  'coach.coupReady.body': 'Pay {coupCost} and any opponent loses a card. Nobody can block or challenge it. You can keep saving, but at {forcedCoup} you have to.',

  // Reformation: every player left is in one faction.
  'coach.freeForAll.label': 'One faction',
  'coach.freeForAll.title': 'One faction left, so target anyone',
  'coach.freeForAll.body': '{coup}, {assassinate}, {steal} and {examine} can target anyone until a {convert} splits the table again.',

  // Reformation, first turns: explain factions.
  'coach.factions.label': 'Factions',
  'coach.factions.title': 'Target the other faction',
  'coach.factions.body': 'Your faction limits who you can {coup}, {assassinate}, {steal} from or {examine}. Challenges ignore factions. While both factions remain, only the other faction can block your {foreignAid}.',

  // Reformation: there are coins in the reserve.
  'coach.embezzle.label': '{count} in reserve',
  'coach.embezzle.title': '{embezzle} takes the reserve',
  /** You hold a Duke, so Embezzle (a claim to have no Duke) would be a bluff. */
  'coach.embezzle.holdsDuke': '{embezzle} claims you have no {duke}, but you have one. Your hidden {duke} would make a challenge succeed. Bluff only if the reserve is worth a card.',
  'coach.embezzle.noDuke': "{embezzle} claims you have no {duke}. You really don't, so anyone who challenges loses a card.",

  // Reformation: explain Convert.
  'coach.convert.title': '{convert} switches a faction',
  'coach.convert.body': 'Pay {convertSelfCost, plural, one {# coin} other {# coins}} to switch yourself or {convertOtherCost} to switch another player. Nobody can challenge or block it, and the coins go to the reserve for {embezzle}.',

  // Your first turns.
  'coach.yourMove.label': 'Your move',
  'coach.opening.title': 'Take {income} or make a claim',
  'coach.opening.body': '{income} is guaranteed. Character actions pay more, and you can claim any character, but any claim can be challenged.',
  'coach.repeat.title': 'Repeat the character you claimed',
  'coach.repeat.body': 'Claiming the same character again is believable. Switching to a new one invites a challenge.',
} satisfies Record<string, string>;

export default tutorial;
