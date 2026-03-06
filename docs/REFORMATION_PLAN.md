# Coup: Reformation Expansion -- Implementation Plan

## Rules Summary

### Factions (Allegiances)
- Each player is either **Loyalist** or **Reformist** (alternating at game start, first player chooses)
- **Targeting restriction**: You CANNOT Coup, Assassinate, Steal, Examine, or block Foreign Aid against a player on your **same** faction
- You **CAN** always challenge anyone regardless of faction
- When **all remaining players share the same faction**, restrictions lift -- free-for-all resumes

### Conversion (new general action, no character claim)
- Pay **1 coin** to change **your own** allegiance (flip your card)
- Pay **2 coins** to change **another player's** allegiance
- Coins go to the **Treasury Reserve** (Almshouse), not the main treasury
- Cannot be challenged or blocked

### Embezzlement (new general action, inverse claim)
- Take **all coins** from the Treasury Reserve
- Can only be done by a player who does **NOT** have Duke
- Challengeable -- if challenged and player **has** Duke, they lose (they lied about not having Duke); if they truly don't have Duke, challenger loses
- This is an **inverse challenge** -- the opposite of normal (you prove you DON'T have a card)

### Inquisitor (replaces Ambassador, optional)
- **Exchange**: Draw **1 card** from deck (not 2 like Ambassador), choose whether to swap with one of your hidden cards, return 1 card to deck
- **Examine**: Look at one of an opponent's face-down cards (opponent chooses which). Either return it, OR force them to draw a new card from deck and return the examined card to deck. Cannot examine same-faction unless all same faction.
- **Blocks Stealing** (same as Ambassador)
- Replaces Ambassador entirely -- Ambassador cards removed from deck, Inquisitor cards added

### Player Count Scaling (future)
- 7-8 players: 4 copies of each character (20-card deck)
- 9-10 players: 5 copies of each character (25-card deck)

---

## Architecture Changes

### Phase 1: Shared Types & Constants (`src/shared/`)

**types.ts:**
- Add `Character.Inquisitor`
- Add `ActionType.Convert`, `ActionType.Embezzle`, `ActionType.Examine`
- Add `Faction` enum (`Loyalist`, `Reformist`)
- Add `GameMode` enum (`Classic`, `Reformation`)
- Add `faction` field to `PlayerState` and `ClientPlayerState`
- Add `treasuryReserve` to `GameState` and `ClientGameState`
- Add `gameMode` to `GameState` and `ClientGameState`
- Add `ExamineState` interface for the examine flow
- Add new `LogEventType` entries (`convert`, `embezzle`, `examine`)
- Add `useInquisitor` to `RoomSettings`
- Add `gameMode` to `RoomSettings`

**constants.ts:**
- Add `ACTION_DEFINITIONS` for Convert, Embezzle, Examine
- Add `ACTION_DISPLAY_NAMES` entries
- Add `CONVERSION_SELF_COST = 1`, `CONVERSION_OTHER_COST = 2`
- Add `CHARACTER_DESCRIPTIONS` for Inquisitor
- Add `INQUISITOR_EXCHANGE_DRAW_COUNT = 1`

**protocol.ts:**
- Add `game:convert`, `game:embezzle`, `game:examine_decision` socket events

### Phase 2: Engine (`src/engine/`)

**Game.ts:**
- Add `treasuryReserve: number` field
- Add `gameMode: GameMode` field
- Add faction assignment in `initialize()` (alternating)
- Add `isFactionRestricted(actorId, targetId)` helper
- Add `allSameFaction()` check

**Deck.ts:**
- Support swapping Ambassador <-> Inquisitor cards based on game mode settings

**Player.ts:**
- Add `faction: Faction` field

**ActionResolver.ts (largest change):**
- Add `declareAction` handling for Convert, Embezzle, Examine
- Add faction validation (reject same-faction targeting)
- Add Embezzlement inverse-challenge flow
- Add Examine phase flow (new `TurnPhase.AwaitingExamineDecision`)
- Modify Exchange to draw 1 card when Inquisitor mode
- Add `resolveExamine()` method

**GameEngine.ts:**
- Add `applySideEffect` cases for: `transfer_to_reserve`, `take_from_reserve`, `change_faction`, `start_examine`
- Wire new socket event handlers

**BotBrain.ts:**
- Add faction-aware targeting (filter valid targets)
- Add conversion decision logic
- Add embezzlement decision logic
- Add examine decision logic (return vs force-swap)
- Add Inquisitor exchange logic (1 card)

**BotController.ts:**
- Schedule bot decisions for new action types and examine phase

### Phase 3: New Turn Phase

| Phase | Purpose |
|-------|---------|
| `AwaitingExamineDecision` | After Inquisitor sees opponent's card -- choose return or force-swap |

Examine flow:
1. Player declares Examine -> `AwaitingActionChallenge`
2. If unchallenged -> server reveals one of target's cards to the Inquisitor only
3. `AwaitingExamineDecision` -- Inquisitor decides: return card or force swap
4. -> `ActionResolved`

### Phase 4: Server (`src/server/`)

**SocketHandler.ts:**
- Add handlers for `game:convert`, `game:embezzle`, `game:examine_decision`
- Add faction validation on all targeted actions

**StateSerializer.ts:**
- Include `faction` on each player
- Include `treasuryReserve` in client state
- For examine: only send the revealed card to the examining player
- Add `gameMode` to client state

**RoomManager.ts:**
- Add `gameMode` and `useInquisitor` to room settings
- Pass through to game initialization

### Phase 5: Client UI (`src/app/`)

**New components:**
- `InquisitorIcon.tsx` -- SVG icon (eye/magnifying glass theme, teal)
- `FactionBadge.tsx` -- Small colored badge for Loyalist (blue) / Reformist (red)
- `TreasuryReserve.tsx` -- Central coin pool display for Almshouse coins
- `ExaminePrompt.tsx` -- Inquisitor sees target's card, chooses Return or Force Swap
- `ConvertPrompt.tsx` -- Choose self-convert or target-convert (if Reformation mode)

**Modified components:**
- `ActionBar.tsx` -- Add Convert/Embezzle buttons, Examine option, grey out same-faction targets
- `GameTable.tsx` -- Show faction badges on player seats, show Treasury Reserve in center
- `PlayerSeat.tsx` -- Render faction indicator (colored border/badge), dim same-faction when targeting
- `ChallengePrompt.tsx` -- Handle inverse challenge text for Embezzlement
- Lobby settings -- Add game mode toggle (Classic / Reformation), Inquisitor toggle
- `HowToPlay.tsx` -- Add Reformation section
- `Tutorial.tsx` -- Add Reformation steps
- `icons/index.ts` -- Export `InquisitorIcon`, add to `CHARACTER_SVG_ICONS`

### Phase 6: New SVG Assets

**InquisitorIcon:** All-seeing eye with magnifying glass
- Outer: Diamond-shaped frame (teal #0d9488 stroke)
- Inner: Large eye with iris detail
- Magnifying glass handle extending from bottom-right
- Color: Teal primary (#0d9488), light teal highlights (#5eead4)
- Animated: iris slowly pulses, magnifying glass has subtle gleam sweep

**FactionBadge SVGs:**
- Loyalist: Blue shield with crown silhouette (#3b82f6)
- Reformist: Red shield with torch/flame silhouette (#ef4444)

**TreasuryReserve icon:** Chest/coffer for the Almshouse
- Wooden chest with gold accent, coin slot on top
- Animated: coins shimmer

### Phase 7: Room Settings

| Setting | Default | Options |
|---------|---------|---------|
| `gameMode` | `'classic'` | `'classic'` / `'reformation'` |
| `useInquisitor` | `false` | `true` / `false` (only in Reformation) |
| Max players | 6 (classic) | Up to 10 (reformation, with deck scaling) |

### Phase 8: Bot AI

| Method | Logic |
|--------|-------|
| `shouldConvert()` | Convert when stuck targeting only same-faction, need to unlock a key target, or strategically isolate an opponent |
| `shouldEmbezzle()` | Embezzle when Treasury Reserve has 3+ coins AND bot doesn't hold Duke (or willing to bluff) |
| `chooseExamineTarget()` | Target the most dangerous opponent (coin leader, suspected bluffer) |
| `examineDecision()` | Force swap if card is strong (Captain/Duke); return if weak |
| Faction-aware targeting | Filter all target selection through `allSameFaction()` gate |

### Phase 9: Testing

| Test Suite | Coverage |
|------------|----------|
| `tests/engine/Reformation.test.ts` | Faction assignment, same-faction blocking, all-same-faction unlock, conversion, treasury reserve |
| `tests/engine/Inquisitor.test.ts` | Exchange (1 card), Examine flow, force-swap, block stealing |
| `tests/engine/Embezzlement.test.ts` | Take from reserve, inverse challenge |
| `tests/engine/FactionTargeting.test.ts` | Cannot coup/assassinate/steal same faction, CAN challenge same faction, restrictions lift when all same |
| Existing tests | Ensure Classic mode still works identically |

---

## Implementation Order

1. Types & Constants -- Foundation for everything
2. Game.ts + Player.ts -- Faction field, treasury reserve, mode flag
3. Deck.ts -- Inquisitor card swap, deck scaling
4. ActionResolver -- Core logic (biggest piece)
5. GameEngine -- Side effect handlers
6. InquisitorIcon.tsx -- New SVG asset
7. FactionBadge + TreasuryReserve -- UI components
8. StateSerializer -- Client state additions
9. SocketHandler -- New event wiring
10. Lobby UI -- Game mode settings
11. Game UI -- ActionBar, prompts, faction display
12. BotBrain -- AI for new mechanics
13. Tests -- Comprehensive coverage
14. Tutorial updates -- Reformation steps
