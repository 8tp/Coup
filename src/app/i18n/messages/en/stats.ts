/**
 * The stats modal opened from the home screen (`components/stats/`): this
 * device's lifetime numbers, awards earned and recent games. Award names
 * come from `gameover.awardTitle.*`.
 */
const stats = {
  title: 'My Stats',
  // Tabs along the top.
  tabOverview: 'Overview',
  tabAwards: 'Awards',
  tabHistory: 'History',

  empty: 'No games played yet.',
  emptyHint: "Finish a game to start tracking stats. Practice games don't count.",

  /** A small link at the bottom; asks for confirmation first. */
  reset: 'Reset Stats',
  resetWarning: "This deletes all your stats. You can't undo it.",
  /** Button beside the warning above: deletes the stats. */
  resetConfirm: 'Confirm',

  // ── Overview: label over a number, two tiles to a row ──
  gamesPlayed: 'Games Played',
  gamesWon: 'Games Won',
  winRate: 'Win Rate',
  /** Games won in a row: the current run. */
  winStreak: 'Win Streak',
  /** The value under "Win Streak": the current run, then the longest ever. */
  winStreakValue: '{current} (best {best})',
  challengesMade: 'Challenges Made',
  challengesWon: 'Challenges Won',
  /** The value under "Challenges Won": the count, then the share of challenges made that were won. */
  challengesWonValue: '{won} ({accuracy})',
  blocksMade: 'Blocks Made',
  /** Bluffs nobody caught. */
  successfulBluffs: 'Successful Bluffs',
  /** Times caught bluffing. */
  timesCaught: 'Times Caught',
  coups: 'Coups',
  assassinations: 'Assassinations',
  /** Games where this player was knocked out first. */
  firstEliminated: 'First Eliminated',
  totalTurns: 'Total Turns',
  /** The action this player chose most often. */
  favoriteAction: 'Favorite Action',
  /** A value that does not exist yet (no challenges made, no actions taken). */
  noValue: '-',

  // ── Awards: every award, earned ones lit with a count ──
  awardsEmpty: 'Finish games to earn awards.',
  /** Badge on an earned award: how many times it was earned. */
  awardCount: 'x{count}',
  // What earns each award, under its name (gameover.awardTitle.*).
  'awardCriterion.pantsOnFire': 'Most times caught bluffing',
  'awardCriterion.honestAbe': 'Most times proven honest, never caught',
  'awardCriterion.inquisitor': 'Most challenges made',
  'awardCriterion.eagleEye': 'Best challenge accuracy',
  'awardCriterion.wall': 'Most blocks made',
  'awardCriterion.smoothOperator': 'Many claims, never caught',
  'awardCriterion.coupMachine': 'Most coups launched',
  'awardCriterion.silentAssassin': 'Most assassinations',
  'awardCriterion.boldStrategy': 'Most challenges backfired',
  'awardCriterion.quickExit': 'First player eliminated',

  // ── History: one row per recent game ──
  /** One-letter badge for a game won. Screen readers hear `historyWon` instead. */
  historyWonShort: 'W',
  /** One-letter badge for a game lost. Screen readers hear `historyLost` instead. */
  historyLostShort: 'L',
  historyWon: 'Won',
  historyLost: 'Lost',
  historyPlayers: '{count, plural, one {# player} other {# players}}',
  historyTurns: '{count, plural, one {# turn} other {# turns}}',
  // Details when a row is opened.
  historyChallenges: 'Challenges: {made} ({won} won)',
  historyBlocks: 'Blocks: {count}',
  historyCoups: 'Coups: {count}',
  historyAssassinations: 'Assassinations: {count}',
  /** `awards` is a list of award names. */
  historyAwards: 'Awards: {awards}',
  /** Separates the award names in the list above. */
  listSeparator: ', ',
} satisfies Record<string, string>;

export default stats;
