<p align="center">
  <img src="public/coup-logo.png" alt="Coup Online" width="400">
</p>

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
- **Computer players** — add 1–5 AI opponents with 3 difficulty tiers (Easy, Medium, Hard)
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
- **Dark theme** — compact icon-only cards with character-colored borders and hover tooltips
- **Live activity stats** — players online and games in progress shown on the home page
- **Phase status banner** — always shows what's happening and what you need to do
- **Urgency-coded prompts** — red for threats (assassination), gold for decisions, gray for waiting
- **Action log** — scrollable history of every action, challenge, and block
- **Contextual game over screen** — winners and losers get personalized flavor text based on how they actually played (e.g. "You read them like an open book" for winning via challenges, "That one bluff cost you everything" for getting caught). Up to 4 post-game awards highlight standout moments like Pants on Fire (most bluffs caught), Eagle Eye (best challenge accuracy), Smooth Operator (many claims, never caught), and more

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
4. Optionally, the host can click **Add Computer Player** to fill seats with AI opponents
5. The host clicks **Start Game** once 2–6 players have joined
6. Bluff, challenge, and eliminate your way to victory

### Computer Players

The host can add AI opponents from the lobby. Each bot has a difficulty level:

| Difficulty | Bluffing | Challenges | Targeting | Strategy |
|------------|----------|------------|-----------|----------|
| **Easy** | Never bluffs | Never challenges | Random | Plays honestly — only uses cards it holds |
| **Medium** | ~20% chance | ~10% base (boosted when holding claimed card or targeted) | 50% targets leader | Static card rankings, endgame-aware coup timing |
| **Hard** | Selective — tuned to match real winner behavior | Card counting — 100% when all copies revealed | Always targets highest-coin player | See details below |

Bot strategies were tuned by analyzing **689,000+ real games** from the [treason](https://github.com/octachrome/treason) online Coup server, comparing winner-only action patterns against our simulated bot behavior across 5 rounds of iterative tuning. See [Bot Strategy Deep Dive](docs/BOT-STRATEGY.md) for the full methodology.

**Hard bot strategy:**
- **Card counting** — tracks publicly revealed cards to calculate challenge probabilities. Challenges at 100% when all copies of a claimed character are accounted for (revealed + held), and scales down with less information
- **Selective bluffing** — bluffs only ~12% of actions, matching real winner behavior. Bluff probability drops by 60% at 1 influence (elimination risk) and avoids bluffing characters with 2+ copies revealed
- **Bluff persistence** — establishes a "bluff identity" by tracking unchallenged character claims. Strongly prefers re-claiming the same character (3.5x weight boost) over switching, matching real winner behavior where winners persist with successful bluffs ~30-50% of the time
- **Weighted action selection** — context-aware weights: Duke/Tax favored early, Captain/Steal dominant in 1v1 (weight 8), assassination preferred over coup against 1-influence targets to save coins
- **Honest Contessa** — blocks assassination with Contessa only 25%/15% of the time without holding it. Real winners hold the card 96% of the time they block — bluffing Contessa is a losing strategy
- **Hail-mary challenges** — when targeted at 1 influence, challenges more aggressively since a failed challenge costs what would be lost anyway. In 1v1, always challenges if letting the action through means the opponent reaches 7 coins
- **3P1L endgame** — in 3-player all-1-life scenarios, the coin leader uses anti-tempo strategy (Income/Exchange over Tax, lets Foreign Aid through) to avoid becoming the obvious coup target, while the underdog delays couping to accumulate
- **Dynamic card values** — context-aware rankings for exchange and influence loss decisions. Captain is highest value in 1v1, Duke strongest early, Ambassador valuable for hand improvement with 3+ players, Contessa value scales with assassination threat
- **Demonstrated character tracking** — remembers opponents' successful blocks and unchallenged claims to avoid actions that will be blocked again
- **Block challenges** — uses card counting on blocks too, with higher aggression when the blocked action cost coins (e.g., assassination)

Bots make decisions with realistic randomized delays (1.5–3.5s for actions, 0.8–2s for reactions) and follow all the same rules as human players — they never peek at hidden cards or the deck.

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
├── docs/                           # Project documentation
│   ├── BOT-STRATEGY.md             # AI strategy research and tuning methodology
│   ├── CONTRIBUTING.md             # Contribution guidelines
│   └── PRD.md                      # Product requirements document
├── tests/                          # Test suite
│   ├── engine/                     # Engine unit tests
│   └── server/                     # Server unit tests
├── src/
│   ├── shared/                     # Shared types, constants, protocol
│   │   ├── types.ts                # All TypeScript interfaces and enums
│   │   ├── constants.ts            # Game rules and action definitions
│   │   └── protocol.ts            # Socket.io event contracts
│   │
│   ├── engine/                     # Pure game logic (no I/O)
│   │   ├── GameEngine.ts           # Orchestrator: timers, state, broadcasts
│   │   ├── ActionResolver.ts       # State machine: phase transitions + side effects
│   │   ├── BotBrain.ts             # AI decision logic: difficulty-tiered choices
│   │   ├── Game.ts                 # Game state: players, deck, turns, treasury
│   │   ├── Player.ts              # Player model: influences, coins
│   │   └── Deck.ts                # Card deck: shuffle, draw, return
│   │
│   ├── server/                     # Networking and room management
│   │   ├── RoomManager.ts          # Room CRUD, player tracking, TTL cleanup
│   │   ├── SocketHandler.ts        # Routes socket events to engine
│   │   ├── BotController.ts        # Bot timing/execution: delays + engine calls
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
| `npm test` | Run test suite (346 tests across 10 files) |
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

Contributions are welcome! Please see [CONTRIBUTING.md](docs/CONTRIBUTING.md) for guidelines.

## License

[MIT](LICENSE) — see the LICENSE file for details.

## Acknowledgments

- **Coup** is a card game designed by [Rikki Tahta](https://en.wikipedia.org/wiki/Coup_(card_game)), originally published in 2012 by **La Mame Games** and **[Indie Boards & Cards](https://indieboardsandcards.com/our-games/coup/)**
- This is a fan-made digital adaptation for personal and educational use — it is not affiliated with or endorsed by the original creators
- If you enjoy the game, please support the creators by [purchasing the physical game](https://www.amazon.com/Indie-Boards-and-Cards-COU1IBC/dp/B00GDI4HX4)
