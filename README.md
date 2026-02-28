# Coup Online

**A real-time multiplayer web adaptation of the classic bluffing card game Coup.**

Play with 2-6 friends from any device -- no app install required. Create a room, share the code, and start bluffing.

---

## Screenshots

> Screenshots coming soon. The game features a dark-themed, mobile-first UI with a card table layout, animated coin counters, and contextual action prompts.

---

## Features

- **Real-time multiplayer** -- WebSocket-powered gameplay with instant action broadcasts
- **Server-authoritative** -- all game logic runs on the server; no cheating possible
- **Mobile-first design** -- portrait-optimized touch interface with large tap targets (48px+)
- **Complete Coup rules** -- faithful implementation of the 2012 base game by Rikki Tahta
- **Room codes** -- 6-character codes for easy sharing, no accounts required
- **Reconnection support** -- drop and rejoin mid-game without losing your seat
- **Timed responses** -- 15-second challenge/block windows keep the game moving
- **Action log** -- timestamped history of every action, challenge, and block
- **Auto-cleanup** -- stale rooms expire after 24 hours

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Next.js 15](https://nextjs.org/) (App Router) |
| Language | [TypeScript](https://www.typescriptlang.org/) (strict mode) |
| Real-time | [Socket.io](https://socket.io/) |
| Server | [Express](https://expressjs.com/) + Node.js |
| State (client) | [Zustand](https://zustand-demo.pmnd.rs/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Testing | [Vitest](https://vitest.dev/) |

---

## Getting Started

### Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm** (comes with Node.js)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/coup-online.git
cd coup-online

# Install dependencies
npm install

# Start the development server
npm run dev
```

The server starts at [http://localhost:3000](http://localhost:3000).

### How to Play

1. Open the app and click **Create Room**
2. Enter your name and share the 6-character room code with friends
3. Friends open the same URL, click **Join Room**, and enter the code
4. The host clicks **Start Game** once 2-6 players have joined
5. Play Coup -- bluff, challenge, and eliminate your way to victory

---

## Game Rules Quick Reference

### Characters (3 copies each in the deck)

| Character | Action | Effect | Blocks |
|-----------|--------|--------|--------|
| **Duke** | Tax | +3 coins | Foreign Aid |
| **Assassin** | Assassinate | Pay 3 coins, target loses influence | -- |
| **Captain** | Steal | Take 2 coins from target | Steal |
| **Ambassador** | Exchange | Draw 2 from deck, return 2 | Steal |
| **Contessa** | -- | -- | Assassination |

### General Actions (no character claim needed)

| Action | Effect |
|--------|--------|
| **Income** | +1 coin (cannot be challenged or blocked) |
| **Foreign Aid** | +2 coins (blockable by Duke) |
| **Coup** | Pay 7 coins, target loses influence (unblockable, unchallengeable) |

### Core Mechanics

- **Bluffing** -- you can claim any character action whether you hold that card or not
- **Challenging** -- any player can call your bluff. If you were honest, the challenger loses an influence and you swap your revealed card for a new one. If you were bluffing, you lose an influence and the action is cancelled
- **Blocking** -- certain characters can block certain actions. Blocks can themselves be challenged
- **Forced Coup** -- if you start your turn with 10+ coins, you must Coup
- **Elimination** -- lose both influences and you are out. Last player standing wins

### Turn Flow

```
Player declares action
  --> If challengeable: all players may Challenge or Pass
    --> If challenged: resolve (reveal card or lose influence)
  --> If blockable: eligible players may Block or Pass
    --> If blocked: original actor may Challenge the block or Pass
  --> Action resolves (or is cancelled)
  --> Next player's turn
```

---

## Project Structure

```
coup-online/
├── server.ts                    # Express + Socket.io + Next.js entry point
├── package.json
├── tsconfig.json                # Client TypeScript config
├── tsconfig.server.json         # Server TypeScript config
├── tailwind.config.ts
├── vitest.config.ts
├── next.config.ts
│
└── src/
    ├── shared/                  # Shared between client and server
    │   ├── types.ts             # All TypeScript types and interfaces
    │   ├── constants.ts         # Game constants and action definitions
    │   └── protocol.ts          # Socket.io event type contracts
    │
    ├── engine/                  # Pure game logic (no I/O, no side effects)
    │   ├── GameEngine.ts        # Orchestrator: applies resolver results, manages timers
    │   ├── ActionResolver.ts    # State machine: determines next phase and side effects
    │   ├── Game.ts              # Core game state: players, deck, turn order, treasury
    │   ├── Player.ts            # Player model: influences, coins, alive status
    │   └── Deck.ts              # Card deck: shuffle, draw, return
    │
    ├── server/                  # Server-side networking and room management
    │   ├── RoomManager.ts       # Room lifecycle: create, join, rejoin, leave, cleanup
    │   ├── SocketHandler.ts     # Socket.io event handlers: routes events to engine
    │   └── StateSerializer.ts   # Per-player state filtering (hides opponents' cards)
    │
    └── app/                     # Next.js App Router (client-side UI)
        ├── page.tsx             # Home screen: create/join room
        ├── layout.tsx           # Root layout
        ├── globals.css          # Tailwind base + custom styles
        │
        ├── lobby/
        │   └── [roomCode]/
        │       └── page.tsx     # Lobby: player list, host controls, start game
        │
        ├── game/
        │   └── [roomCode]/
        │       └── page.tsx     # Game view: renders GameTable with live state
        │
        ├── hooks/
        │   └── useSocket.ts     # Socket.io client hook with auto-reconnect
        │
        ├── stores/
        │   └── gameStore.ts     # Zustand store: connection, room, game state
        │
        └── components/
            ├── game/
            │   ├── GameTable.tsx           # Main game layout
            │   ├── PlayerSeat.tsx          # Opponent display (cards, coins)
            │   ├── CardFace.tsx            # Card rendering (face-up/face-down)
            │   ├── ActionBar.tsx           # Action buttons for current player
            │   ├── ChallengePrompt.tsx     # Challenge/Pass UI during action challenge
            │   ├── BlockPrompt.tsx         # Block/Pass UI during block window
            │   ├── BlockChallengePrompt.tsx # Challenge/Pass UI during block challenge
            │   ├── InfluenceLossPrompt.tsx # Card selection when losing influence
            │   ├── ExchangeView.tsx        # Card selection during Ambassador exchange
            │   ├── PhaseStatus.tsx         # Current phase banner
            │   ├── ActionLog.tsx           # Scrollable action history
            │   └── GameOverOverlay.tsx     # Winner announcement
            │
            └── ui/
                ├── Modal.tsx              # Reusable modal component
                └── Timer.tsx              # Countdown timer display
```

---

## Architecture

### Server-Authoritative Model

The server is the single source of truth. Clients never compute game logic -- they send intents (e.g., "I want to play Tax") and receive the resulting state. The `StateSerializer` filters each player's view so they can only see their own hidden cards and public information.

```
Client A                     Server                      Client B
   |                           |                            |
   |-- game:action (Tax) ----->|                            |
   |                           |-- GameEngine.handleAction  |
   |                           |-- ActionResolver.declare   |
   |                           |-- Apply side effects       |
   |<-- game:state (filtered)--|-- game:state (filtered) -->|
```

### State Machine (Turn Phases)

Every turn progresses through a deterministic sequence of phases. The `ActionResolver` is a pure function that takes the current state and a player action, then returns the next phase and a list of side effects.

```
AwaitingAction
  │
  ├─ Income ──────────────────────────────> ActionResolved ──> AwaitingAction (next player)
  ├─ Coup ────────────────────────────────> AwaitingInfluenceLoss ──> ActionResolved
  │
  ├─ Tax / Assassinate / Steal / Exchange
  │   └─> AwaitingActionChallenge
  │         ├─ Challenge ──> resolve ──> (AwaitingBlock | AwaitingInfluenceLoss | ActionResolved)
  │         └─ All Pass ──> (AwaitingBlock | resolve action)
  │
  └─ ForeignAid
      └─> AwaitingBlock
            ├─ Block ──> AwaitingBlockChallenge
            │              ├─ Challenge block ──> resolve
            │              └─ All Pass ──> action blocked, advance turn
            └─ All Pass ──> resolve action

AwaitingExchange ──> (player picks cards) ──> ActionResolved

GameOver ──> (winner announced)
```

### Socket.io Event Protocol

Events are fully typed via `ClientToServerEvents` and `ServerToClientEvents` in `src/shared/protocol.ts`.

**Client to Server:**

| Event | Data | Description |
|-------|------|-------------|
| `room:create` | `{ playerName }` | Create a new room |
| `room:join` | `{ roomCode, playerName }` | Join existing room |
| `room:rejoin` | `{ roomCode, playerId }` | Reconnect to room |
| `room:leave` | -- | Leave current room |
| `game:start` | -- | Host starts the game |
| `game:action` | `{ action, targetId? }` | Declare a game action |
| `game:challenge` | -- | Challenge the current claim |
| `game:pass_challenge` | -- | Pass on challenging |
| `game:block` | `{ character }` | Block with a character claim |
| `game:pass_block` | -- | Pass on blocking |
| `game:challenge_block` | -- | Challenge the block |
| `game:pass_challenge_block` | -- | Pass on challenging the block |
| `game:choose_influence_loss` | `{ influenceIndex }` | Choose which card to reveal |
| `game:choose_exchange` | `{ keepIndices }` | Choose cards to keep in exchange |

**Server to Client:**

| Event | Data | Description |
|-------|------|-------------|
| `room:updated` | `{ players, hostId }` | Room player list changed |
| `room:error` | `{ message }` | Room-related error |
| `game:state` | `ClientGameState` | Full per-player game state update |
| `game:error` | `{ message }` | Game-related error |

### State Serialization

The server holds the complete `GameState` including the deck and all hidden cards. Before sending state to a client, `StateSerializer.serializeForPlayer()` transforms it into a `ClientGameState` that:

- Replaces opponents' unrevealed card characters with `null`
- Replaces the full deck array with just a card count (`deckCount`)
- Only includes exchange card choices for the player currently exchanging
- Preserves all public information (coins, revealed cards, action log, pending actions)

---

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Next.js + Socket.io via tsx) |
| `npm run build` | Build for production (Next.js build + server TypeScript compile) |
| `npm start` | Run production build |
| `npm test` | Run tests once with Vitest |
| `npm run test:watch` | Run tests in watch mode |

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch
```

The test suite uses Vitest. Engine tests validate game rules, challenge resolution, and edge cases without any network dependencies.

---

## Deployment

This project requires a server with persistent WebSocket connections. **Standard Vercel deployments will not work** because Vercel uses serverless functions that cannot maintain WebSocket connections.

### Recommended Platforms

- **[Railway](https://railway.app/)** -- simple Git-based deploys, free tier available
- **[Render](https://render.com/)** -- Web Service type with WebSocket support
- **[Fly.io](https://fly.io/)** -- container-based, globally distributed

### Deploy Steps

1. Push your code to a Git repository
2. Connect the repository to your platform of choice
3. Set the build command to `npm run build`
4. Set the start command to `npm start`
5. Ensure the `PORT` environment variable is configured (most platforms set this automatically)

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Set to `production` for production builds |

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push to your fork
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

## Acknowledgments

- **Coup** is a card game designed by Rikki Tahta, published by La Mame Games and Indie Boards & Cards
- This is a fan-made digital adaptation for personal and educational use
