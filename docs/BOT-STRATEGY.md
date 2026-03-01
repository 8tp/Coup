# Bot Strategy: How We Built the AI

This document covers the research, data analysis, and iterative tuning process behind the AI opponents in Coup Online. The goal was to create bots that play strategically and feel human — not by guessing at good play, but by studying what actually wins in hundreds of thousands of real games.

---

## Table of Contents

1. [Starting Point](#starting-point)
2. [Research: Studying Real-World Coup Strategy](#research-studying-real-world-coup-strategy)
3. [The Treason Dataset: 689,000+ Real Games](#the-treason-dataset-689000-real-games)
4. [Building the Simulation Pipeline](#building-the-simulation-pipeline)
5. [Key Findings: Bots vs Real Winners](#key-findings-bots-vs-real-winners)
6. [Tuning Iterations](#tuning-iterations)
7. [Early & Mid Game Analysis](#early--mid-game-analysis)
8. [Endgame Analysis](#endgame-analysis)
9. [Final Bot Behavior Summary](#final-bot-behavior-summary)

---

## Starting Point

The initial bot implementation used reasonable-sounding heuristics: bluff frequently to keep opponents guessing, challenge aggressively, always bluff Contessa when assassinated (since there's "nothing to lose"). The three difficulty tiers (Easy, Medium, Hard) were differentiated by whether they bluffed at all, how often they challenged, and whether they used card counting.

This produced bots that were functional but felt "off" — they bluffed too much, challenged too aggressively, and made strategically questionable decisions in the endgame. The question was: how should a *good* Coup player actually behave?

---

## Research: Studying Real-World Coup Strategy

We started by searching for existing analysis of Coup strategy. Most online guides offer qualitative advice ("don't bluff too early," "Duke is the strongest character"), but we wanted quantitative data: what do winners actually do differently from losers?

Key strategy concepts we identified through research:

- **Honest play wins more than bluffing** — contrary to the game's reputation as a "bluffing game," the best players bluff selectively, not constantly
- **Card counting is essential** — tracking revealed cards to calculate the probability that a claim is genuine
- **Captain/Steal is the strongest endgame action** — a 4-coin swing (+2 to you, -2 to opponent) dominates 1v1
- **Contessa is more valuable to hold than to bluff** — real winners have Contessa when they block assassination ~96% of the time
- **The 3-player-1-life (3P1L) scenario** has unique dynamics — the coin leader becomes the biggest target, creating counter-intuitive incentives to play slowly

The most valuable resource we found was the [treason](https://github.com/octachrome/treason) project — an open-source Coup implementation with a public database of over 689,000 games played by real humans on their online server.

---

## The Treason Dataset: 689,000+ Real Games

The treason project stores games in a binary event-sourced format: Base64-encoded with nibble-based event encoding. We built a parser (`scripts/analyze-treason.ts`) to decode these records and extract meaningful statistics.

### Dataset Characteristics

- **689,542 total games** across all player counts
- Filtered to **5-player games** for our primary analysis (matching our default bot lobby)
- Extracted **winner-only** actions as a cleaner signal than all-player averages — we wanted to know what the *surviving player* did, not what the average player did

### What We Extracted

For each game, we decoded:
- Every action taken (Income, Foreign Aid, Tax, Steal, Assassinate, Exchange, Coup)
- Every challenge (who challenged, whether it succeeded)
- Every block (who blocked, with what character, whether it was challenged)
- Which characters each player held at each point
- Whether each action was a bluff (claimed character not in hand)

We then built comparison scripts (`scripts/analyze-winners.ts`) that computed per-game averages for winners specifically:

| Metric | What it tells us |
|--------|-----------------|
| Action distribution | How often winners use each action |
| Bluff rate per action | What percentage of each action type is a bluff |
| Challenge rate and success rate | How selective winners are about challenging |
| Block frequency and honesty | How often winners block and whether they hold the card |
| Card holdings at victory | Which characters winners are holding when they win |
| Coup timing | At what coin count winners choose to coup |

---

## Building the Simulation Pipeline

To compare our bots against real players, we built a headless simulation system that runs bot-only games without the network layer:

### How It Works

1. **Bypass `BotController`** — the controller uses `setTimeout` for realistic delays, which would make bulk simulation take hours. Instead, we call `BotBrain.decide()` directly in a synchronous loop
2. **Run through `GameEngine`** — decisions are executed through the same engine API as real games, ensuring identical rule enforcement
3. **Capture decision records** — each bot decision is logged with full context (hand, coins, alive count, whether it was a bluff)
4. **Save JSON logs** — one file per game with complete action history for post-hoc analysis

The simulation script (`scripts/simulate.ts`) supports configurable parameters:

```bash
npm run simulate -- --games 50 --players 5 --difficulty hard
```

Each run produces per-game result lines and a summary table with win rates, action distributions, challenge success rates, and average game length.

### Decision Records

Every bot decision is captured as a `DecisionRecord` with:
- The bot's hidden hand at decision time
- Coin count
- Number of alive players (`aliveCount`) — critical for endgame analysis
- What decision was made (action, challenge, block, exchange, influence loss)
- Whether the action was a bluff (claimed character not in hand)

---

## Key Findings: Bots vs Real Winners

The comparison between our initial hard bots and treason winners revealed significant gaps:

### Bluffing: Way Too Much

| Action | Our Bots (bluff %) | Treason Winners (bluff %) |
|--------|-------------------|--------------------------|
| Tax | 42% | 15% |
| Steal | 36% | 9% |
| Assassinate | 31% | 13% |
| Overall | ~35% | ~12% |

Our bots were bluffing 3x more than real winners. Winners play honestly the vast majority of the time — they bluff strategically, not habitually.

### Contessa: The Biggest Surprise

Our hard bots were configured to "almost always" bluff Contessa when assassinated (95% at 2 influences, 65% at 1). The data showed:

| Metric | Our Bots | Treason Winners |
|--------|---------|-----------------|
| Contessa block when assassinated | ~90% | ~20% |
| Of those blocks, actually holding Contessa | ~30% | ~96% |

Winners almost never bluff Contessa. When they block assassination, they genuinely have the card. This makes sense: bluffing Contessa at 1 influence means a failed challenge eliminates you, and at 2 influences you still lose a card. The risk-reward is poor.

### Challenges: Too Aggressive

| Metric | Our Bots | Treason Winners |
|--------|---------|-----------------|
| Challenge frequency | ~15-20% | ~5-8% |
| Challenge success rate | ~45% | ~76% |

Our bots challenged roughly twice as often but succeeded less than half the time. Winners are far more selective — they challenge when they have information (card counting, holding the claimed card), resulting in a much higher success rate.

### Card Holdings at Victory

| Character | Our Bot Winners (hold %) | Treason Winners (hold %) |
|-----------|------------------------|--------------------------|
| Captain | 28% | 32% |
| Duke | 31% | 25% |
| Contessa | 11.5% | 20.4% |
| Ambassador | 8% | 14% |
| Assassin | 21.5% | 8.6% |

Our bots undervalued Contessa and Ambassador while overvaluing Assassin. Winners hold Contessa for defense and Ambassador for hand improvement far more than our card value rankings suggested.

---

## Tuning Iterations

Based on these findings, we made several rounds of adjustments:

### Round 1: Reduce Bluffing Across the Board

**Hard bot action bluff weights:**
- Tax bluff: `4` → `1.5` (multiplied by bluffMod at 1 influence)
- Steal bluff: `3` → `1.0` (1v1: `5` → `2.0`)
- Assassinate bluff: `3` → `1.0`

**Hard bot bluff-block rates:**
- Contessa vs assassination: `95%/65%` → `25%/15%`
- General target block: `60%/35%` → `15%/10%`
- Duke Foreign Aid block: `30%` → `8%`

**Medium bot bluffs:**
- Action bluff gates: `30%` → `20%`
- Contessa bluff: `50%` → `30%`
- Target block bluff: `20%` → `12%`
- Duke FA bluff: `10%` → `5%`

### Round 2: Fix Card Valuations

Updated `dynamicCardValue()` to match winner card holding patterns:
- Captain: `6` → `5` (still top-tier but not excessively dominant)
- Assassin: `4` → `3` (winners sacrifice Assassin readily)
- Ambassador: `2` → `3` (winners protect Ambassador more)
- Contessa: base `2` → `3`, +2 when opponents have assassination coins, -1 in 1v1

### Round 3: Challenge Selectivity

Reduced challenge rates to match the "selective but accurate" pattern of real winners:
- Hard bot base challenge: `0.10` → `0.05`
- Hard bot 1-copy-held: `0.40` → `0.30`
- Hard bot block challenge base: `0.10` → `0.05`
- Hard bot block challenge cost incentive: `0.30` → `0.15`
- Medium bot action challenge base: `20%` → `10%`
- Medium bot block challenge base: `15%` → `10%`

### Round 4: Endgame Fixes (Discovered via Simulation)

After running fresh simulations with the tuned bots, endgame analysis revealed three new issues:

1. **Assassinate bluff spike** — reducing Tax/Steal bluff weights made Assassinate bluffs relatively more attractive, especially with the `targetBonus` applied to bluffs. Fixed by removing `targetBonus` from bluff assassinations entirely.

2. **Income over-representation in endgame** — with bluff weights reduced, Income's static weight of `1` became the path of least resistance. Fixed by reducing Income weight to `0.5` when 3 or fewer players remain.

3. **Contessa over-correction** — setting Contessa base value to 4 (with +2 for assassination threat = 6) made bots hoard Contessa in 1v1 at 32.5% vs treason's 22.3%. Fixed by reducing base to 3 and adding a -1 adjustment in 1v1.

### Round 5: Bluff Persistence & Early/Mid Game Alignment

Analyzing early/mid game patterns against treason revealed two major gaps:

**1. No bluff persistence** — when a bot bluffed a character and wasn't challenged, it had no memory of that successful bluff. On the next turn it would randomly pick a new action, often switching characters or going honest. Treason data showed winners persist with their bluffed character 30-50% of the time (Duke specifically at ~52%). Our bots only persisted 14% of the time.

**2. Action distribution misalignment** — bots stole too much early (28% vs treason's 14%), underused Exchange (13% vs 22%), and underused Income (8% vs 14%).

**Bluff persistence system:**
- New `getBluffIdentity()` method scans the action log for the bot's own unchallenged character claims (both actions and blocks)
- Tracks an "established" identity (most recent successful bluff) and a set of "burnt" characters (caught bluffing)
- `persistBoost` (3.5x) multiplies the weight of actions using the established character
- `switchPenalty` (0.3x) reduces weight of bluffing a *different* character when an identity exists — only in early/mid game (4+ alive) since endgame requires flexibility
- Burnt characters are never bluffed again — opponents already know the bot doesn't have them

**1v1 bluff caution adjustment:**
- `bluffMod` at 1 influence changed from 0.4 to 0.7 in 1v1 — passivity is worse than bluffing when both players are at 1 influence

**Endgame Income/FA rebalancing:**
- Income weight: 0.5 in 1v1, 1.5 early game, 1 at 3-alive — prevents passive play in endgame
- 3P1L Foreign Aid boost for non-leaders (weight 2.5) — treason winners use FA at 19% in 3P1L since it gains coins without claiming a character
- Early game honest Steal reduced from 5 to 3.5 (too dominant vs treason's 14%)
- Early game honest Exchange boosted from 3 to 4 (treason winners use Exchange at 22%)

**Results after Round 5:**

| Metric | Before | After | Treason |
|--------|--------|-------|---------|
| Duke bluff persistence | 31% | 52% | ~52% |
| Character switch rate | 20% | 8% | 7-11% |
| 1v1 Tax share | 17% | 24% | 24.5% |
| 1v1 Income share | 31% | 14% | 11.4% |
| 3P1L Coup rate | 11% | 12% | 11.3% |
| 3P1L FA share | 5% | 20% | 18.9% |

---

## Early & Mid Game Analysis

We built a dedicated early/mid game comparison tool (`scripts/analyze-earlymid.ts`) that splits both simulated and treason data into early game (turns 1-5) and mid game (turns 6-15):

### Early Game (Turns 1-5)

| Action | Our Bots | Treason Winners |
|--------|---------|-----------------|
| Tax | 37% | 46% |
| Steal | 24% | 14% |
| Income | 18% | 14% |
| Exchange | 18% | 22% |
| Foreign Aid | 2% | 3% |

Tax is the dominant opener in both datasets. Our bots still steal more than real winners, likely because bot-vs-bot games have different steal/block dynamics. Exchange and Income alignment improved significantly after Round 5.

### Mid Game (Turns 6-15)

| Action | Our Bots | Treason Winners |
|--------|---------|-----------------|
| Tax | 28% | 31% |
| Steal | 22% | 16% |
| Income | 21% | 15% |
| Exchange | 12% | 13% |
| Assassinate | 8% | 11% |
| Coup | 3% | 10% |
| Foreign Aid | 1% | 5% |

Mid game shifts toward elimination actions (Assassinate, Coup) in both datasets. The coup rate gap is partly structural — in all-hard-bot games, aggressive play keeps coin counts lower, so fewer bots reach 7 coins compared to human games with mixed skill levels.

### Bluff Persistence in Practice

After implementing the persistence system, Duke bluff persistence rose from 31% to 52% — matching the treason target. The mechanism works by:

1. **Scanning the action log** for the bot's own unchallenged character claims
2. **Checking current hand** — if the bot doesn't hold the claimed character, it was a bluff
3. **Boosting future claims** of the same character by 3.5x weight
4. **Penalizing character switches** by 0.3x weight (early/mid game only)
5. **Tracking burnt characters** — never re-bluff a character you were caught on

This creates natural "identities" where a bot that successfully bluffs Duke on turn 1 will continue claiming Duke for Tax throughout the game, just like skilled human players do.

---

## Endgame Analysis

We built a dedicated endgame comparison tool (`scripts/analyze-endgame.ts`) that filters both our simulated data and the treason dataset to specific endgame scenarios:

### 1v1 (Head-to-Head)

| Metric | Our Bots (tuned) | Treason Winners |
|--------|-----------------|-----------------|
| Tax share | 24% | 24.5% |
| Steal share | 18% | 15% |
| Income share | 14% | 11% |
| Assassinate share | 14% | 11% |
| Coup rate | 8% | 19% |
| Cards: Captain | 28% | 22% |
| Cards: Duke | 18% | 24% |

Captain/Steal dominance in 1v1 is confirmed in both datasets. Tax alignment improved to near-perfect after the bluff persistence changes. The 1v1 guaranteed-coup logic (coup when both players have 1 influence) ensures bots don't waste turns when a coup is a guaranteed win. The coup rate gap is structural — bot-vs-bot games are more competitive, keeping coin counts lower than mixed-skill human games.

### 3-Player, 1-Life Each (3P1L)

This is the most strategically interesting endgame scenario. The coin leader faces a dilemma: couping immediately makes them the next target of the survivor, but waiting risks the runner-up reaching 7 coins.

Our bots implement:
- **Leader with 7+ coins:** Coup immediately (85% of the time) — delay only helps opponents
- **Leader below 7:** Anti-tempo strategy — Income/Exchange over Tax, let Foreign Aid through to avoid becoming the obvious threat
- **Non-leaders:** Use Foreign Aid more (weight 2.5) since it gains coins without a character claim — treason winners use FA at 19% in 3P1L
- **Underdog:** Delay couping to accumulate carefully (70% chance to skip coup even at 7 coins)

| Metric | Our Bots | Treason Winners |
|--------|---------|-----------------|
| Coup rate | 12% | 11.3% |
| Foreign Aid share | 20% | 18.9% |
| Income share | 21% | 24.4% |

### Coup Timing

| Coin Count at Coup | Our Bots | Treason Winners |
|--------------------|---------|-----------------|
| Exactly 7 | 43% | 44% |
| 8 | 33% | 32% |
| Average coins | 7.9 | 8.1 |

Both datasets show a strong preference for couping at exactly 7 coins rather than accumulating further — sitting above 7 without couping is wasted potential.

### Desperation Challenges

In 1v1 at 1 influence, if letting the opponent's action through would give them 7+ coins (guaranteed coup next turn) and the bot can't win on its own next turn, the bot challenges regardless of card-counting odds. This is the "Hail Mary" — a failed challenge costs what would be lost anyway, but a successful challenge buys another turn.

---

## Final Bot Behavior Summary

### Easy
- Plays honestly — only uses actions for cards it holds
- Never bluffs or challenges
- Random targeting and card choices
- Designed to lose gracefully and be forgiving for new players

### Medium
- **Bluffs selectively** — 20% chance for Tax/Steal, 15% for Assassinate, 25% for Exchange
- **Challenges at 10% base** — boosted when holding the claimed card (+15%) or targeted (+10%)
- **Never challenges assassination with 2 influences** — too risky
- **Bluff-blocks occasionally** — 30% Contessa vs assassination, 12% other target blocks
- **Static card rankings** — Duke > Captain > Assassin = Contessa > Ambassador
- **Endgame awareness** — increased coup probability (80% vs 65%) and reduced Income weight when 3 or fewer players remain
- 50% chance to target the coin leader

### Hard
- **Weighted action selection** — context-aware weights, not fixed priorities
- **Card counting** — tracks all revealed cards to calculate challenge probabilities
- **Bluff persistence** — tracks "established identity" (a character successfully bluffed without being caught) and strongly prefers re-claiming it (3.5x boost). Penalizes switching to a different bluff character (0.3x) in early/mid game. Burnt characters (caught bluffing) are never re-bluffed
- **Bluffs rarely** — Tax at weight 1.5, Steal at 1.0, Assassinate at 1.0. bluffMod of 0.4 at 1 influence (0.7 in 1v1 to avoid excessive passivity)
- **Challenges selectively** — 5% base, scaling up with card counting. 100% when all copies accounted for
- **Contessa blocks honestly** — 25%/15% bluff rate instead of the original 95%/65%
- **Dynamic card values** — Captain dominant in 1v1, Duke strongest early, Ambassador valuable for hand improvement, Contessa scales with assassination threat
- **Endgame-aware weights** — Income weight drops to 0.5 in 1v1 (prevents passivity), FA boosted for non-leaders in 3P1L (2.5 floor), Tax bluff weight 3 in 1v1
- **3P1L anti-tempo** — coin leader slows down to avoid becoming the target
- **Desperation challenges** — in 1v1, challenges when letting the action through means certain loss
- **Demonstrated character tracking** — remembers which opponents have shown which characters through successful blocks and unchallenged claims, avoiding repeatedly blocked actions
- Always targets the highest-coin player

---

## Methodology Notes

### Why Winner-Only Analysis?

Analyzing all players' actions includes a lot of noise — losing strategies are mixed in with winning ones. By filtering to only the surviving player's decisions, we get a cleaner signal of what actually correlates with winning.

This has a subtle bias: winners played more turns (they survived longer), so their per-game action counts are higher. We normalized to per-game averages to account for this.

### Why 5-Player Games?

The treason dataset contains games of all sizes (2-6 players). We filtered to 5-player games because:
- It's the most common lobby size in our game
- It has the richest strategic dynamics (enough players for meaningful bluffs and alliances)
- The dataset had the most games at this player count

### Simulation Limitations

Bot-vs-bot games have a fundamental limitation: bots play against other bots with the same strategies. Real games feature diverse opponents with different skill levels and styles. Our simulations primarily validate that the tuned parameters produce *internally consistent* behavior — the treason comparison validates that this behavior *matches real winners*.

### Iterative Process

The tuning was not a one-shot process. Each round of changes was validated through simulation, and simulation results revealed secondary effects (like the Assassinate bluff spike after reducing Tax/Steal bluffs) that required additional adjustments. The final parameters represent five rounds of tuning with simulation validation after each.
