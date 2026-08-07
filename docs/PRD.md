# Product Requirements Document: Coup Online

**Project Name:** Coup Online
**Version:** 1.0 release candidate
**Last Updated:** April 2026
**Primary Users:** Friend groups playing Coup remotely or locally, often on mobile devices.
**Primary Focus:** Fast no-account multiplayer with server-authoritative rules, mobile-first interaction, bots, and optional Reformation mechanics.

## 1. Product Overview

Coup Online is a real-time web adaptation of the 2012 bluffing card game Coup. Players create or join a room, receive two hidden influence cards, and use claims, bluffs, challenges, blocks, and coins to eliminate every other player.

The app is designed for low-friction play:

- No accounts or app install required
- 4-letter room codes and QR/share links
- 2-6 player games with optional computer players
- Public room browser for open lobbies and live spectator games
- First-time practice path against a bot
- Server-authoritative rules so hidden information never depends on the client
- Mobile-first interface with desktop responsive layouts

## 2. Current Implemented Scope

### Multiplayer

- Real-time gameplay over Socket.io.
- Rooms are hosted by the first player and can be private or public.
- Public rooms appear in the home screen browser.
- In-progress public games can be watched as a spectator.
- Hosts can remove lobby players or spectators before the game starts.
- Players can reconnect with a signed session token stored client-side.
- Disconnected in-game human players are replaced by an optimal bot after 60 seconds.
- Rooms expire after 24 hours; abandoned in-progress rooms with no connected human players are cleaned up after 120 seconds.

### Game Modes

- **Classic**: Base Coup actions and characters.
- **Reformation**: Optional lobby mode that adds factions, Convert, Embezzle, Treasury Reserve, and optional Inquisitor.
- **Inquisitor toggle**: In Reformation mode, the host can replace Ambassador with Inquisitor before game start.

### Bots

- Host can add 1-5 bots before the game starts.
- Bot personalities: Random, Aggressive, Conservative, Vengeful, Deceptive, Analytical, Optimal.
- Bots use the same `GameEngine` API as human players.
- Bot behavior includes card counting from public information, bluff persistence, demonstrated-claim tracking, faction-aware targeting, and endgame tactics.
- Bots emit context-aware reactions with personality-specific emotiveness and meanness.

### Table Experience

- Configurable action response timer: 10-60 seconds.
- Configurable turn timer: 15-90 seconds for action choice, exchange, influence loss, and examine decisions.
- Bot minimum reaction delay can be adjusted when bots are present.
- Room chat works in lobby and game.
- Emoji reactions are visible to all room participants and are also mirrored into chat history.
- Players can locally mute another player's chat messages and reactions.
- Sound, haptic, reduced-animation, and text-size settings are available from home, lobby, and game screens.
- The app includes an install prompt and production service worker caching for core visual assets.
- Local player stats, award counts, and match history are persisted in `localStorage`.
- Game over includes winner/loser flavor text, staged winning-hand/table-truth reveal, recap cards, post-game awards, truth reveal, full log access, copy/download recap export, and rematch flow.

## 3. Rules Requirements

### Base Game Components

- 3 copies each of Duke, Assassin, Captain, Ambassador, and Contessa.
- 2 hidden influence cards per player.
- 2 starting coins per player.
- Last player with at least one unrevealed influence wins.

### Base Actions

| Action | Cost | Effect | Claim | Blocked By |
|--------|------|--------|-------|------------|
| Income | 0 | Gain 1 coin | None | None |
| Foreign Aid | 0 | Gain 2 coins | None | Duke |
| Coup | 7 | Target loses influence | None | None |
| Tax | 0 | Gain 3 coins | Duke | None |
| Assassinate | 3 | Target loses influence | Assassin | Contessa |
| Steal | 0 | Take up to 2 coins from target | Captain | Captain, Ambassador, or Inquisitor |
| Exchange | 0 | Draw cards, choose cards to keep | Ambassador or Inquisitor | None |

### Required Edge Cases

- At 10+ coins, a player must Coup.
- Stealing from a player with fewer than 2 coins takes only what they have.
- A successful challenge cancels the action or block being challenged.
- A failed challenge causes the challenger to lose influence and lets the truthful player replace the revealed card.
- Assassination cost remains spent when the assassination is blocked, matching the implemented rule comments in `ActionResolver`.
- Exchange with one remaining influence still preserves the correct number of hidden cards.
- Game over reveals all hidden cards to all clients.

### Reformation Rules

- Players are assigned alternating Loyalist/Reformist factions at game start with a randomized starting faction.
- Coup, Assassinate, Steal, and Examine cannot target same-faction players unless all alive players share one faction.
- Challenges and blocks are not faction-restricted.
- Convert pays 1 coin to switch self or 2 coins to switch another player. Coins go to the Treasury Reserve.
- Embezzle takes the Treasury Reserve and uses inverse Duke challenge logic.
- Inquisitor Exchange draws 1 card instead of Ambassador's 2.
- Inquisitor Examine reveals one hidden target card to the examiner, then lets the examiner return it or force a deck swap.

## 4. User Flows

### Create And Play

1. Player enters a name and creates a private or public room.
2. Room code and QR share link are shown in the lobby.
3. Host optionally changes room settings, enables Reformation, toggles Inquisitor, or adds bots.
4. Host starts once 2-6 players are present.
5. Players take turns until one player remains.
6. Host starts a rematch; bots, settings, chat, win counts, and eligible spectators are preserved.

### Practice

1. First-time player opens main menu settings and chooses Classic or Reformation practice.
2. The app creates a private room, configures the selected mode, adds a conservative bot, and starts the game immediately.
3. Player can leave or return home after the game; practice games do not return to a lobby and are not recorded in local stats.

### Join

1. Player enters a name and room code, follows a QR/link, or joins from the public room browser.
2. Server validates the name, room state, capacity, and duplicate-name rules.
3. Player receives a session token for reconnect.

### Spectate

1. Viewer chooses a live public game and clicks Watch.
2. Spectator receives a filtered game state with all unrevealed cards hidden.
3. Spectator can chat/watch but cannot act.
4. On rematch, spectators can be promoted into open player seats if there is room and no name conflict.

## 5. Technical Requirements

### Architecture

- Next.js App Router frontend served by a custom Express server.
- Socket.io handles all real-time room and game traffic.
- Node.js 20.19+ is the supported development/runtime baseline because the current Vite/Vitest toolchain requires it.
- Server owns all game state, deck state, timers, hidden cards, and rule outcomes.
- Clients send intents only.
- `ActionResolver` remains pure rule/state-machine logic and emits side effects as data.
- `GameEngine` applies side effects, mutates `Game`, controls timers, and emits state changes.
- `StateSerializer` filters state per player or spectator before broadcast.

### Persistence

- Room and game state are in memory.
- Chat history is stored per room in memory, capped at 50 messages.
- Player stats are local to each browser via `localStorage`.
- No account system or shared persistent database is currently in scope.

### Security And Validation

- Production CORS rejects cross-origin connections unless `CORS_ORIGIN` is configured.
- Security headers and production CSP are set by the Express server.
- Trust proxy is enabled for proxy deployments.
- Room create/join, bot add, game actions, chat, and reactions are rate-limited.
- Player names and chat messages are sanitized and checked by `ContentFilter`.
- Socket payloads are validated before reaching engine handlers.
- Deck shuffle, room code generation, session tokens, and several server-authoritative random choices use Node crypto APIs.

## 6. Release Readiness Criteria

- `npm test` passes.
- `npm run build` passes.
- Manual smoke test covers at least two browser sessions through create, join, start, action, challenge/block pass, and game over.
- Reformation smoke test covers Convert, Embezzle, and Inquisitor Examine when enabled.
- Public room/spectator smoke test covers browse, watch, and rematch promotion.
- Socket E2E coverage includes create/join/start/action/rematch, live spectators, reconnect, Reformation startup, rematch authorization, and lobby moderation.
- Accessibility smoke review covers dialog semantics, keyboard-accessible cards, focus-visible styling, and non-color faction markers.
- No stale docs claim implemented features are future work.

## 7. Known Gaps And Follow-Ups

- Inquisitor Examine currently picks one of the target's hidden cards server-side when the target has two hidden cards. The physical expansion has the target choose which card is examined; implementing that exactly would require a new target-choice prompt/phase.
- Production CSP still allows `unsafe-inline` and `unsafe-eval` for current Next.js/client requirements. Tightening CSP would require nonce/hash work and verification.
- Rejoin tokens are signed random tokens but are stored in `sessionStorage`, so an XSS would still expose them.
- Socket rate limits are per socket for gameplay events; deployment-level IP or edge rate limiting would still be useful.
- Game rooms are in memory only; server restarts clear active rooms.
- Practice vs Bot supports Classic and Reformation games, the live coach covers expansion-specific decisions, and the rules modal includes an interactive Reformation scenario.

## 8. Out Of Scope For 1.0

- User accounts, friend lists, matchmaking, rankings, or cloud-synced stats.
- Voice/video chat.
- Paid monetization or ads.
- 7-10 player Reformation deck scaling.
- Official publisher affiliation or official artwork.
