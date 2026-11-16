import type { InfluenceLossRequest } from '@/shared/types';

type LossReason = InfluenceLossRequest['reason'];

/**
 * The prompts that ask a player to answer something: challenge, block,
 * block challenge, losing a card, exchange, examine, and the challenge
 * reveal overlay.
 *
 * Tags: `<b>` sets a player's name in bold, `<c>` highlights a claimed
 * character. Player names (`{actor}`, `{target}`, `{name}`, `{names}`...)
 * are never translated. `{character}` and `{action}` are the glossary's
 * names. `{names}` is a list of players ("Ana, Ben, and Cy"), built in the
 * reader's language.
 */
const prompts = {
  // ── Buttons ──
  challenge: 'Challenge',
  pass: 'Pass',
  // Button: claim a character to block the action. {character} is its name.
  blockWith: 'Block with {character}',
  dontBlock: "Don't block",
  bluffHint: "Challenge if you think they're bluffing. If they aren't, you lose a card.",

  // ── Challenge window ──
  // Seen by everyone except the blocker: the target already said they will block.
  declaredBlock: '<b>{blocker}</b> will block with {character} if the {action} goes ahead.',
  youClaimed: 'You claimed <c>{character}</c> to {action}',
  youClaimedOn: 'You claimed <c>{character}</c> to {action} on <b>{target}</b>',
  // Embezzle is a claim to hold no Duke. {character} is Duke.
  youClaimedNo: 'You claimed <c>no {character}</c> to {action}',
  waitingChallenge: '{count, plural, =0 {Waiting for players to challenge or pass.} other {Waiting for {names} to challenge or pass.}}',
  youWillBlock: "You'll block with <c>{character}</c> if the {action} goes ahead.",
  waitingFor: '{count, plural, =0 {Waiting for players.} other {Waiting for {names}.}}',
  passedCanBlock: 'You passed on the challenge. You can still block.',
  passedWaiting: '{count, plural, =0 {You passed. Waiting for players.} other {You passed. Waiting for {names}.}}',
  claim: '{actor} claims {character} to {action}',
  claimOn: '{actor} claims {character} to {action} {target}',
  claimStealFrom: '{actor} claims {character} to {action} from {target}',
  claimAtYou: '{actor} claims {character} to {action} you',
  claimStealFromYou: '{actor} claims {character} to {action} from you',
  claimNo: '{actor} claims no {character} to {action}',
  embezzleHint: "Challenge if you think they have a {character}. If they don't, you lose a card.",
  // What blocking saves you from. {who} is one or two character names ("Captain or Ambassador"); {count} is how many.
  'blockHint.Assassinate': '{count, plural, one {Block with {who} or lose a card. You can claim {who} without holding one.} other {Block with {who} or lose a card. You can claim either without holding one.}}',
  'blockHint.Steal': '{count, plural, one {Block with {who} to keep your coins. You can claim {who} without holding it.} other {Block with {who} to keep your coins. You can claim either without holding it.}}',
  'blockHint.other': '{count, plural, one {Block with {who} to stop it. You can claim {who} without holding it.} other {Block with {who} to stop it. You can claim either without holding it.}}',

  // ── Block window ──
  yourActionUnless: 'Your {action} goes ahead unless <b>{target}</b> blocks it.',
  yourActionUnlessAnyone: 'Your {action} goes ahead unless someone blocks it.',
  usesOn: '<b>{actor}</b> uses {action} on <b>{target}</b>.',
  waitingTarget: 'Waiting for <b>{target}</b> to block or allow.',
  sameFactionForeignAid: "You can't block <b>{actor}</b>'s {action}. You share a faction, and both factions are still in the game.",
  blockPassed: 'You passed.',
  blockPassedWaiting: 'You passed. Waiting for {names}.',
  assassinating: '{actor} is assassinating you',
  assassinatingHint: 'Block with {character} or lose a card. You can claim {character} without holding one.',
  // {count} is how many of your coins the Steal takes (1 or 2).
  stealing: '{actor} is stealing {count, plural, one {your coin} other {# of your coins}}',
  // {blockers} is the two characters that block a Steal ("Captain or Ambassador").
  stealingHint: 'Block with {blockers} to keep {count, plural, one {your coin} other {# of your coins}}. You can claim either without holding it.',
  foreignAid: '{actor} is taking {action} (+{count, plural, one {# coin} other {# coins}})',
  foreignAidHint: 'Claim {character} to stop them taking {count, plural, one {# coin} other {# coins}}. You can claim {character} without holding one.',
  uses: '{actor} uses {action}',
  canBlock: 'You can block it.',

  // ── Block challenge window ──
  youClaimedBlock: 'You claimed <c>{character}</c> to block.',
  acceptedWaiting: '{count, plural, =0 {You accepted the block. Waiting for players.} other {You accepted the block. Waiting for {names}.}}',
  blockClaim: '{blocker} claims <c>{character}</c> to block the {action}',
  blockClaimPlain: '{blocker} claims <c>{character}</c> to block',

  // ── Losing a card ──
  // Heading when you must lose a card, by why.
  'loss.coup': 'You were Couped',
  'loss.assassination': 'You were assassinated',
  'loss.challenge_lost': 'You lost the challenge',
  'loss.challenge_failed_defense': 'You were caught bluffing',
  // Embezzle claims no Duke; a challenge found one. {character} is Duke.
  'loss.embezzle_failed': 'You were caught holding a {character}',
  'loss.default': 'Choose a card to lose',
  tapToLose: 'Tap a card to lose it. It turns face up.',
  mustChoose: '<b>{name}</b> must choose a card to lose.',
  // Small caption under "X must choose a card to lose": why. Short noun phrases.
  'lossWatch.coup': 'Coup',
  'lossWatch.assassination': 'Assassination',
  'lossWatch.challenge_lost': 'Lost challenge',
  'lossWatch.challenge_failed_defense': 'Caught bluffing',
  'lossWatch.embezzle_failed': 'Failed Embezzle',
  'lossWatch.default': 'Must lose a card',

  // ── Exchange ──
  exchangeInProgress: 'Exchange in progress',
  // Heading of the exchange prompt, for example "Ambassador Exchange". {character} and {action} are glossary names.
  exchangeTitle: '{character} {action}',
  exchangeHint: 'Tap {count, plural, one {# card} other {# cards}} to keep. The rest go back to the deck.',
  // Button: confirm the cards you picked. {selected} of {total} picked so far.
  keepSelected: 'Keep selected ({selected}/{total})',

  // ── Examine (Reformation, with the Inquisitor) ──
  examinedCard: "{name}'s card",
  forceSwapHint: 'Force Swap sends it to the deck and they draw a new card.',
  // Button: give the examined card back unchanged.
  examineReturn: 'Return',
  // Button: send the examined card to the deck; its owner draws a new one.
  forceSwap: 'Force Swap',
  showTo: 'Choose a card to show {name}',
  // Fallback when the examining player is unknown. {character} is Inquisitor.
  showToInquisitor: 'Choose a card to show the {character}',
  showHint: 'Only the examiner sees it. They can return it or force you to swap it for a new card.',

  // ── Challenge reveal (full-screen, a few seconds) ──
  // Screen-reader label: tapping the overlay skips it.
  'reveal.skip': 'Skip the reveal',
  'reveal.newCard': 'New hidden influence',
  // Embezzle challenged and the player had no Duke. {character} is Duke.
  'reveal.showsAllNo': '{name} shows every card and has <c>no {character}</c>',
  'reveal.reveals': '{name} reveals <c>{character}</c>',
  'reveal.doesNotHave': "{name} doesn't have <c>{character}</c>",
  'reveal.challengeFails': 'Challenge fails',
  'reveal.caught': 'Caught bluffing',
  'reveal.mustLose': '{name} must lose a card',
  'reveal.swap': '{count, plural, one {The card goes back into the deck. A replacement is drawn.} other {The shown cards go back into the deck. Replacements are drawn.}}',
} satisfies Record<`loss.${LossReason}` | `lossWatch.${LossReason}`, string> & Record<string, string>;

export default prompts;
