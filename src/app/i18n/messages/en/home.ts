/**
 * The home screen (`src/app/page.tsx`, `components/home/LearnSheet.tsx`) and
 * the install prompt (`components/pwa/`), which only shows there.
 *
 * `<fig>` marks figures (counts, seat ratios) set in the figure face; keep
 * the tag around the same numbers.
 */
const home = {
  /** Hidden page heading for screen readers and search engines. "Coup Online" is the product name, never translated. */
  srTitle: 'Coup Online: a free multiplayer bluffing card game',
  tagline: 'The bluffing card game, online with friends or bots.',
  /** Live counter at the top of the screen: people connected right now. */
  presenceOnline: '<fig>{count}</fig> online',
  presenceGames: '{count, plural, one {<fig>#</fig> game in play} other {<fig>#</fig> games in play}}',
  myStats: 'My stats',

  /** Screen-reader name of the panel with the name field and the play buttons. */
  playSection: 'Play',
  nameLabel: 'Your name',
  /** The main button: start a game against bots at once. Keep it short. */
  playVsBots: 'Play vs Bots',
  playVsBotsSub: 'Starts now · {count, plural, one {# opponent} other {# opponents}}',
  /** Shown on a button while the game is being set up (cards being dealt). */
  dealing: 'Dealing…',
  /** Button that opens the create-room options. Verb phrase. */
  createRoom: 'Create room',
  /** Button that opens the room-code field. Verb phrase. Also named in lobby.codeHint. */
  joinRoom: 'Join room',
  publicRoom: 'Public room',
  publicRoomOn: 'Listed on this screen. Anyone can join.',
  publicRoomOff: 'Only people with the code can join.',
  creating: 'Creating…',
  createAndInvite: 'Create and invite',
  /** Placeholder in the 4-letter room code field. Room codes are always Latin capitals; keep this very short. */
  codePlaceholder: 'CODE',
  roomCode: 'Room code',
  joining: 'Joining…',
  /** Button: join this room. */
  join: 'Join',

  learnTitle: 'Learn to play',
  learnSub: 'A guided game, a tutorial or the rules',

  /** Heading over public rooms that are waiting for players. */
  openTables: 'Open tables',
  /** Heading over public games in progress that anyone can watch. */
  watchLive: 'Watch live',
  browseAll: 'Browse all',
  noPublicTables: 'No public tables right now.',
  /** A public room in the list, named after its host. */
  roomName: "{host}'s table",
  /** `{seats}` is players over seats, for example "5/6". */
  roomPlayers: '<fig>{seats}</fig> players',
  roomPlayersBetweenGames: '<fig>{seats}</fig> players · between games',
  roomPlayersWatching: '<fig>{seats}</fig> players · {watching} watching',
  /** Button on a room with no free seat. */
  roomFull: 'Full',
  /** Button: watch a game in progress as a spectator. */
  watch: 'Watch',

  footer: '{min}–{max} players · free · no sign-up',
  /** Footer link to the code repository. */
  source: 'Source',
  sourceLabel: 'View source on GitHub',

  /** Name used when someone watches a game without typing a name. Sent to the server: letters only, 20 characters at most. */
  defaultSpectatorName: 'Spectator',
  /** Name used for a practice game started without a name. Letters only, 20 characters at most. */
  defaultPlayerName: 'Player',

  // Learn to play sheet (components/home/LearnSheet.tsx)
  guidedGame: 'Play a guided game',
  guidedGameSub: 'You against 1 gentle bot. A coach points at what to do next.',
  tutorial: 'Take the tutorial',
  tutorialSub: '6 short lessons. You try each move on a small table.',
  rules: 'Read the rules',
  rulesSub: 'Characters, actions, challenges and blocks. Reformation too.',
  practiceFoot: 'More bots, other rules, or no coach',
  practiceSetup: 'Set up practice',

  // Install prompt (components/pwa/PWAInstallPrompt.tsx). "Coup" is the product name.
  installTitle: 'Install Coup',
  installBody: 'Opens faster, and cached game assets load on weak Wi-Fi.',
  /** Button: install the app. Very short. */
  install: 'Install',
  installDismiss: 'Dismiss install prompt',
} satisfies Record<string, string>;

export default home;
