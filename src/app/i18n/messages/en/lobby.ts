/**
 * The lobby (`src/app/lobby/`, `components/lobby/`: `AddBotModal`,
 * `QRShareModal`). Player names and bot names are never translated; they
 * arrive as `{name}` and render isolated (`<bdi>`).
 *
 * `<fig>` marks figures set in the figure face; keep the tag around the
 * same numbers.
 */
const lobby = {
  leaveRoom: 'Leave room',
  howToPlay: 'How to play',
  shareRoom: 'Share room',

  /** Small label over the room code. `visibility` is "public" or "private". */
  codeLabel: 'Room code · {visibility, select, public {public} other {private}}',
  copyCodeLabel: 'Copy room code {code}',
  codeCopied: 'Room code copied',
  linkCopied: 'Invite link copied',
  copyFailed: 'Copy failed. Select the code, or tap Share for a QR code.',
  /** Under the room code. "Join room" is the home screen button (home.joinRoom); use the same words. */
  codeHint: 'Friends enter this code under Join room.',
  copyCode: 'Copy code',
  copyInviteLink: 'Copy invite link',

  players: 'Players',
  lastWinner: 'Last game winner',
  /** The reader's own row in the player list. */
  nameYou: '{name} (you)',
  /** Tag on the host's row. Short. */
  host: 'Host',
  /** Tag on a bot's row: "Bot", then its play style (lobby.personality.*). Short. */
  botTag: 'Bot · {personality}',
  /** Tag on a connected person's row: they are in the lobby now. Short. */
  here: 'Here',
  reconnecting: 'Reconnecting…',
  /** Games this player has won in this room. Title case in English to match the other tags. */
  wins: '{count, plural, one {<fig>#</fig> Win} other {<fig>#</fig> Wins}}',
  removeBot: 'Remove bot',
  removePlayer: 'Remove player',
  removeNamed: 'Remove {name}',
  removeSpectator: 'Remove spectator',
  removeSpectatorNamed: 'Remove spectator {name}',
  /** Button: open the Add a bot dialog. */
  addBot: '+ Add bot',
  /** Button: add this many bots at once. */
  fillSeats: 'Fill seats (+{count})',
  /** Heading over the list of spectators. */
  watching: 'Watching ({count})',

  roomSettings: 'Room settings',
  /** Heading over the room settings. */
  tableRules: 'Table rules',
  publicRoom: 'Public room',
  publicRoomOn: 'Listed in Open tables. Anyone can join.',
  publicRoomOff: 'Only people with the code can join.',
  visibility: 'Visibility',
  public: 'Public',
  private: 'Private',
  gameMode: 'Game mode',
  /** Switch label. `{character}` is the Inquisitor's name from the glossary. */
  useInquisitor: 'Use the {character}',
  /** `{character}` is the Ambassador's name from the glossary. */
  useInquisitorSub: 'Replaces the {character}',
  yes: 'Yes',
  no: 'No',
  /** Slider: how long players have to challenge or block. */
  challengeWindow: 'Challenge & block window',
  turnTimer: 'Turn timer',
  /** Small hint under the turn timer slider: what the timer covers. */
  turnTimerHint: 'actions, exchanges, losses',
  botThinking: 'Bot thinking time',

  chat: 'Chat',

  startGame: 'Start game · {count, plural, one {# player} other {# players}}',
  startWithBots: 'Start with bots · {count, plural, one {# player} other {# players}}',
  addingBots: 'Adding bots…',
  needPlayersButton: 'Need {count}+ players',
  needMorePlayers: 'Need {count, plural, one {# more player} other {# more players}}',
  tooManyPlayers: 'Too many players',
  startWhenReady: 'Start when everyone has joined',
  waitingForHost: 'Waiting for the host to start…',
  inviteOrBots: 'Invite friends with the code above, or start now against bots.',

  // Add a bot (components/lobby/AddBotModal.tsx)
  addBotTitle: 'Add a bot',
  botName: 'Name',
  /** Button next to the bot name field: pick a random name. */
  randomName: 'Random',
  randomNameLabel: 'Pick a random name',
  personality: 'Personality',
  /** Bot play styles, on buttons in a two-column grid and in lobby.botTag. Keep them to one word. */
  'personality.random': 'Random',
  'personality.aggressive': 'Aggressive',
  'personality.conservative': 'Conservative',
  'personality.vengeful': 'Vengeful',
  'personality.deceptive': 'Deceptive',
  'personality.analytical': 'Analytical',
  'personality.optimal': 'Optimal',
  'personalityDescription.random': 'Plays one of the six styles below, picked at random and kept hidden.',
  'personalityDescription.aggressive': 'Bluffs often and favors attacks.',
  'personalityDescription.conservative': 'Plays honest and rarely bluffs.',
  'personalityDescription.vengeful': 'Retaliates against whoever attacked it.',
  'personalityDescription.deceptive': 'Bluffs the most and avoids challenges.',
  'personalityDescription.analytical': 'Challenges when the revealed cards point to a bluff.',
  'personalityDescription.optimal': 'Counts revealed cards and bluffs selectively.',
  adding: 'Adding…',
  /** Button: add the bot and close the dialog. */
  addBotSubmit: 'Add bot',

  // Share (components/lobby/QRShareModal.tsx)
  /** Button text right after the link was copied. */
  copied: 'Copied',
  copyLink: 'Copy link',
  copyLinkFailed: 'Copy failed. Select the link above.',
} satisfies Record<string, string>;

export default lobby;
