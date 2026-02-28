<h1 align="center">Coup Online</h1>

<p align="center">
  A real-time multiplayer web adaptation of the classic bluffing card game.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white" alt="Node.js 18+">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs" alt="Next.js 15">
  <img src="https://img.shields.io/badge/Socket.io-realtime-010101?logo=socketdotio" alt="Socket.io">
  <img src="https://img.shields.io/github/license/8tp/Coup" alt="MIT License">
</p>

---

Play Coup with 2–6 friends from any device — no app install, no accounts. Create a room, share the code, and start bluffing. The server enforces every rule so nobody can cheat, and the mobile-first UI keeps the game moving with timed challenge and block windows.

<!-- ![Coup Online screenshot](docs/screenshot.png) -->

## Features

### Multiplayer
- **Real-time WebSocket gameplay** — instant action broadcasts via Socket.io
- **Server-authoritative** — all game logic runs server-side; clients never see hidden cards
- **Room codes** — 6-character codes for easy sharing, no accounts required
- **Reconnection** — drop and rejoin mid-game without losing your seat
- **Auto-cleanup** — stale rooms expire after 24 hours

### Game Rules
- **Complete 2012 base game** — Income, Foreign Aid, Tax, Steal, Assassinate, Exchange, Coup
- **Full challenge system** — any player can call a bluff; failed challenges cost an influence
- **Block and counter-block** — Duke blocks Foreign Aid, Contessa blocks Assassination, Captain/Ambassador block Steal
- **Forced Coup** — 10+ coins means you must Coup
- **Timed responses** — 15-second windows for challenges and blocks keep the pace up

### Interface
- **Mobile-first** — portrait-optimized touch UI with 48px+ tap targets
- **Dark theme** — character-colored cards with role icons
- **Phase status banner** — always shows what's happening and what you need to do
- **Urgency-coded prompts** — red for threats (assassination), gold for decisions, gray for waiting
- **Action log** — scrollable history of every action, challenge, and block

## Requirements

- Node.js 18+ (LTS recommended)

## Getting Started

```sh
git clone https://github.com/8tp/Coup.git
cd Coup
npm install
npm run dev
```

The server starts at [http://localhost:3000](http://localhost:3000). Open it in multiple browser tabs to test multiplayer.

### How to Play

1. Click **Create Room** and enter your name
2. Share the 6-character room code with friends
3. Friends click **Join Room** and enter the code
4. The host clicks **Start Game** once 2–6 players have joined
5. Bluff, challenge, and eliminate your way to victory

## Game Rules

### Characters (3 copies each)

| Character | Action | Effect | Blocks |
|-----------|--------|--------|--------|
| **Duke** | Tax | +3 coins | Foreign Aid |
| **Assassin** | Assassinate | Pay 3, target loses influence | — |
| **Captain** | Steal | Take 2 coins from target | Steal |
| **Ambassador** | Exchange | Draw 2 from deck, return 2 | Steal |
| **Contessa** | — | — | Assassination |

### General Actions

| Action | Effect |
|--------|--------|
| **Income** | +1 coin (safe — cannot be challenged or blocked) |
| **Foreign Aid** | +2 coins (blockable by Duke) |
| **Coup** | Pay 7 coins, target loses influence (unblockable, unchallengeable) |

### Core Mechanics

- **Bluffing** — claim any character action whether you hold that card or not
- **Challenging** — call someone's bluff. If they were honest, you lose an influence. If they lied, they lose one and the action is cancelled
- **Blocking** — certain characters counter certain actions. Blocks can themselves be challenged
- **Elimination** — lose both influences and you're out. Last player standing wins

## Architecture

The server is the single source of truth. Clients send intents (e.g. "play Tax") and receive filtered state — they can only see their own hidden cards and public information.

```
Client A                     Server                      Client B
   |                           |                            |
   |-- game:action (Tax) ----->|                            |
   |                           |-- ActionResolver (pure)    |
   |                           |-- Apply side effects       |
   |<-- game:state (filtered)--|-- game:state (filtered) -->|
```

The `ActionResolver` is a pure state machine: `(state, input) → (newPhase, sideEffects[])`. The `GameEngine` applies side effects (mutate coins, reveal cards, set timers) and broadcasts per-player views through `StateSerializer`.

### Turn Phase Flow

```
AwaitingAction
  ├─ Income ───────────────────────────> resolve ──> next turn
  ├─ Coup ─────────────────────────────> AwaitingInfluenceLoss ──> next turn
  ├─ Tax / Steal / Assassinate / Exchange
  │   └─> AwaitingActionChallenge
  │         ├─ Challenge ──> resolve
  │         └─ All Pass ──> AwaitingBlock (if blockable) or resolve
  └─ ForeignAid
      └─> AwaitingBlock
            ├─ Block ──> AwaitingBlockChallenge
            └─ All Pass ──> resolve
```

## Project Structure

```
Coup/
├── server.ts                       # Express + Socket.io + Next.js entry point
├── src/
│   ├── shared/                     # Shared types, constants, protocol
│   │   ├── types.ts                # All TypeScript interfaces and enums
│   │   ├── constants.ts            # Game rules and action definitions
│   │   └── protocol.ts            # Socket.io event contracts
│   │
│   ├── engine/                     # Pure game logic (no I/O)
│   │   ├── GameEngine.ts           # Orchestrator: timers, state, broadcasts
│   │   ├── ActionResolver.ts       # State machine: phase transitions + side effects
│   │   ├── Game.ts                 # Game state: players, deck, turns, treasury
│   │   ├── Player.ts              # Player model: influences, coins
│   │   └── Deck.ts                # Card deck: shuffle, draw, return
│   │
│   ├── server/                     # Networking and room management
│   │   ├── RoomManager.ts          # Room CRUD, player tracking, TTL cleanup
│   │   ├── SocketHandler.ts        # Routes socket events to engine
│   │   └── StateSerializer.ts     # Per-player state filtering
│   │
│   └── app/                        # Next.js App Router (client UI)
│       ├── page.tsx                # Home: create/join room
│       ├── lobby/[roomCode]/       # Lobby: player list, start game
│       ├── game/[roomCode]/        # Game view
│       ├── hooks/useSocket.ts      # Socket.io client with auto-reconnect
│       ├── stores/gameStore.ts     # Zustand store
│       └── components/             # GameTable, ActionBar, prompts, cards
```

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (Express + Next.js + Socket.io) |
| `npm run build` | Build for production |
| `npm start` | Run production build |
| `npm test` | Run test suite (196 tests across 7 files) |
| `npm run test:watch` | Run tests in watch mode |

```sh
# Run all tests
npm test

# Watch mode during development
npm run test:watch
```

## Deployment

This project requires persistent WebSocket connections. **Vercel will not work** — use a platform that supports long-lived server processes.

### Recommended Platforms

- **[Railway](https://railway.app/)** — Git-based deploys, free tier available
- **[Render](https://render.com/)** — Web Service type with WebSocket support
- **[Fly.io](https://fly.io/)** — container-based, globally distributed

Set the build command to `npm run build` and the start command to `npm start`. The `PORT` environment variable is read automatically.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — see the LICENSE file for details.

## Acknowledgments

- **Coup** is a card game designed by Rikki Tahta, published by La Mame Games and Indie Boards & Cards
- This is a fan-made digital adaptation for personal and educational use
