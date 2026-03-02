# CLAUDE.md -- AI Assistant Context for Coup Online

This file provides context to help AI assistants (like Claude Code) work effectively on this codebase.

---

## Project Overview

Coup Online is a real-time multiplayer web adaptation of the card game Coup (2-6 players). Players bluff, challenge, and block to eliminate opponents' influences. The project is a full-stack TypeScript application with a server-authoritative architecture.

**Stack:** Next.js 15 (App Router) + Express + Socket.io + Zustand + Tailwind CSS + Vitest

---

## Running the Project

```bash
# Install dependencies
npm install

# Start the development server (Express + Next.js + Socket.io, all in one process)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Production build
npm run build

# Start production server
npm start
```

The dev server runs at `http://localhost:3000`. To test multiplayer, open multiple browser tabs.

---

## Key Architecture Decisions

### Server-Authoritative

All game logic runs on the server. Clients send intents (`game:action`, `game:challenge`, etc.) and receive filtered state. The client never computes game outcomes. This prevents cheating and ensures consistency.

### Engine Is Pure Logic

The `src/engine/` directory contains the core game rules with **no I/O, no timers, no Socket.io**. The `ActionResolver` is essentially a pure function: given the current game state and a player action, it returns a `ResolverResult` containing:

- `newPhase` -- the next turn phase
- Updated pending action/block/challenge/exchange/influence-loss state
- `sideEffects[]` -- a list of effects to apply (give coins, reveal card, advance turn, set timer, log, etc.)

The `GameEngine` orchestrates: it calls the resolver, then applies side effects to the mutable `Game` object. This separation makes the rules easy to test without mocking timers or sockets.

### State Serialization

The server holds full `GameState` (including the deck and all hidden cards). Before sending to a client, `StateSerializer.serializeForPlayer()` filters it into `ClientGameState`:

- Opponents' unrevealed cards become `{ character: null, revealed: false }`
- The deck array becomes just a count (`deckCount`)
- Exchange state is only sent to the player who is exchanging

### State Machine Phase Flow

The turn progresses through these phases (defined in `TurnPhase` enum):

1. `AwaitingAction` -- current player picks an action
2. `AwaitingActionChallenge` -- other players may challenge the claim
3. `AwaitingBlock` -- eligible players may block
4. `AwaitingBlockChallenge` -- original actor may challenge the block
5. `AwaitingInfluenceLoss` -- a player must choose a card to reveal
6. `AwaitingExchange` -- Ambassador player picks cards to keep
7. `ActionResolved` -- turn ends, advance to next player
8. `GameOver` -- winner determined

Not every turn visits every phase. Income resolves immediately. Coup skips to InfluenceLoss. The `ActionResolver` determines the path.

---

## Important File Locations

| File | Purpose |
|------|---------|
| `src/shared/types.ts` | All TypeScript types: GameState, ClientGameState, enums, interfaces |
| `src/shared/constants.ts` | Game constants (costs, timers, player limits) and action definitions |
| `src/shared/protocol.ts` | Socket.io event type contracts (client-to-server and server-to-client) |
| `src/engine/GameEngine.ts` | Orchestrator: connects resolver results to game state mutations |
| `src/engine/ActionResolver.ts` | Pure state machine: all game rule logic and phase transitions |
| `src/engine/Game.ts` | Game model: players, deck, turn order, treasury, action log |
| `src/engine/Player.ts` | Player model: influences, coins, hasCharacter, revealInfluence |
| `src/engine/Deck.ts` | Card deck: shuffle (Fisher-Yates), draw, return, reset |
| `src/engine/BotBrain.ts` | Pure AI decision logic: personality-parameterized action/challenge/block choices with card counting, bluff persistence, and deck memory |
| `src/server/RoomManager.ts` | Room lifecycle: create, join, rejoin, leave, cleanup (24h TTL), chat storage, rematch reset, bot management |
| `src/server/SocketHandler.ts` | Socket.io event routing: validates context, delegates to engine |
| `src/server/StateSerializer.ts` | Per-player state filtering before sending to clients |
| `src/server/BotController.ts` | Bot timing/execution: schedules AI decisions with randomized delays, triggers bot emotes |
| `server.ts` | Entry point: wires Express + Socket.io + Next.js |
| `src/app/page.tsx` | Home screen UI (create/join room) |
| `src/app/hooks/useSocket.ts` | Socket.io client hook with reconnection and session storage |
| `src/app/stores/gameStore.ts` | Zustand store: connection, room, game, chat, sound, reactions, error |
| `src/app/stores/settingsStore.ts` | Zustand store: hapticEnabled, textSize (persisted to localStorage) |
| `src/app/utils/haptic.ts` | Haptic feedback: vibration API with iOS Safari checkbox-switch fallback |
| `src/app/audio/SoundEngine.ts` | Web Audio API synthesizer: 21+ sound types, mute toggle |
| `src/app/components/game/GameTable.tsx` | Main game layout component |
| `src/app/components/chat/ChatPanel.tsx` | Chat message list + text input |
| `src/app/components/game/GameCenterTabs.tsx` | Log/Chat tabbed container with unread indicator |
| `src/app/components/game/GameOverOverlay.tsx` | Game over screen with rematch flow |
| `src/app/components/game/ReactionPicker.tsx` | Emoji reaction selector (12 reactions) |
| `src/app/components/game/ReactionBubble.tsx` | Displays active reaction above a player seat |
| `src/app/components/settings/SettingsModal.tsx` | Settings: sound, haptic feedback, text size, bug report/feedback links |
| `src/app/components/lobby/AddBotModal.tsx` | Modal with name input + personality selector (7 personality buttons) for adding bots |

---

## Common Patterns

### Adding a New Game Action

1. Add the action to `ActionType` enum in `src/shared/types.ts`
2. Add its definition to `ACTION_DEFINITIONS` in `src/shared/constants.ts`
3. Handle it in `ActionResolver.declareAction()` and `ActionResolver.resolveAction()`
4. Add UI for it in `src/app/components/game/ActionBar.tsx`

### Adding a New Socket Event

1. Add the event signature to `ClientToServerEvents` or `ServerToClientEvents` in `src/shared/protocol.ts`
2. Add the handler in `src/server/SocketHandler.ts`
3. Add the client-side emit/listener in `src/app/hooks/useSocket.ts`

### Chat System

Room-scoped chat works in both lobby and in-game. Messages are stored server-side per room (up to `CHAT_MAX_HISTORY`), rate-limited to 1 per second per player, and sent to rejoining players via `chat:history`. In-game, the `GameCenterTabs` component provides Log and Chat tabs with an unread indicator.

### Computer Players (Bots)

The host can add 1–5 AI players from the lobby via `bot:add`. Each bot has a personality (`BotPersonality = 'aggressive' | 'conservative' | 'vengeful' | 'deceptive' | 'analytical' | 'optimal' | 'random'`):

- **Aggressive** — High bluff rates, offensive actions, always targets leader, aggressive challenges
- **Conservative** — Very low bluff rates, prefers safe actions (Income/Foreign Aid), rarely challenges
- **Vengeful** — Retaliates against recent attackers (revenge targeting scans last ~20 log entries), moderate bluff rates
- **Deceptive** — Highest bluff rates across all action types, avoids challenging (doesn't want others to challenge either), high bluff persistence
- **Analytical** — Low-moderate bluffs, high evidence-based challenge rates, strong leader targeting, steeper card value ranking
- **Optimal** — Strategic card counting, selective bluffing, bluff persistence, always targets highest-coin player, uses `dynamicCardValue()` for context-aware card ranking, prefers Steal in 1v1, endgame tactics
- **Random** — Picks one of the 6 concrete personalities at game start (hidden from player)

All bots use the same underlying architecture: card counting, bluff persistence, deck memory, and endgame tactics. The personality parameters (defined in `BOT_PERSONALITIES` in constants.ts, typed as `PersonalityParams` in types.ts) modulate behavior with ~18 behavioral parameters.

The default personality is `'random'` (defined as `DEFAULT_BOT_PERSONALITY` in constants). The lobby UI presents 7 color-coded personality buttons: Random (purple), Aggressive (red), Conservative (green), Vengeful (orange), Deceptive (pink), Analytical (blue), Optimal (yellow).

Bots are server-side only — they use the same `GameEngine` methods as human players but decisions are made by `BotBrain` (pure logic, no I/O) and scheduled by `BotController` (timing layer with randomized delays: 1.5–3.5s for actions, 0.8–2s for reactions). Only one bot acts at a time; each action triggers a state change which cascades to the next bot.

Key behaviors:
- Bots never peek at opponents' hidden cards or the deck (they only use publicly revealed card information for card counting)
- When targeted by an action the bot can block with a card it holds (e.g., Contessa vs Assassination), it passes the challenge phase and blocks instead
- Bots survive rematch (`resetToLobby` preserves them with personality preserved), but a bot can never become host
- State broadcasts skip bots (no socket to send to)
- Personality badges are shown next to the BOT badge in the lobby player list (color-coded per personality). Random bots show "RANDOM" in the lobby (the resolved personality is hidden)
- Bots fire emoji reactions via personality-driven emote system: each bot has `emotiveness` (0–1) and `meanness` (0–1) traits that determine reaction frequency and tone (nice vs mean reactions). Emotes are context-aware (triggered by game events like eliminations, challenges, blocks) and bluff-safe (~15% chance to skip reactions that could leak information about hidden cards)

### Rematch Flow

After a game finishes, the host can click "Play Again" which triggers `game:rematch` → server calls `resetToLobby()` (destroys engine and BotController, clears game state, removes disconnected human players, preserves bots) → broadcasts `game:rematch_to_lobby` → all clients clear game state and redirect to the lobby. Chat history is preserved across rematches.

### Side Effect Pattern

The resolver never mutates game state directly. Instead, it returns side effects like:

```typescript
{ type: 'give_coins', playerId: '...', amount: 3 }
{ type: 'reveal_influence', playerId: '...', influenceIndex: 0 }
{ type: 'log', message: 'Alice collects Tax (+3 coins).' }
{ type: 'advance_turn' }
{ type: 'set_timer', durationMs: 15000 }
```

The `GameEngine.applySideEffect()` method interprets each effect and mutates the `Game` accordingly.

---

## Important Conventions

- **Server is authoritative** -- never add game logic to the client
- **Types live in `src/shared/`** -- do not define game types in engine or server files
- **Engine has no I/O** -- no `setTimeout`, no `socket.emit`, no `console.log` in `ActionResolver`. Timers and logging are expressed as side effects
- **All game constants** are in `src/shared/constants.ts` -- do not hardcode magic numbers
- **Room codes** are 6 characters using `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no ambiguous characters like O/0/I/1)
- **Player IDs** are UUIDs generated server-side
- **State broadcasts** go to every connected human player in the room, each receiving their own filtered view (bots are skipped)
- **Bots use the same engine API** -- `BotBrain` is pure logic (no I/O), `BotController` handles timing. Never add socket or timer logic to `BotBrain`

---

## Testing Tips

- Tests live in the top-level `tests/` directory, mirroring `src/` structure: `tests/engine/` and `tests/server/`
- Test imports use the `@/` path alias (e.g., `import { Game } from '@/engine/Game'`)
- Engine tests should test the `ActionResolver` and `Game` classes directly, without sockets
- Create players and a game programmatically, then call resolver methods and assert on the returned `ResolverResult`
- Use `vitest` -- the config is in `vitest.config.ts`
- Test edge cases: steal from player with 1 coin, exchange with 1 influence, forced coup at 10 coins, challenge on a truthful claim vs. a bluff
