# Optimal Bot Simulation Findings

**Date:** 2026-02-28
**Config:** 50 games, 5 players, all optimal personality
**Bots:** R2-D2, HAL 9000, WALL-E, Terminator, GLaDOS

---

## Summary Stats

| Metric | Value |
|--------|-------|
| Games completed | 50/50 |
| Avg game length | 22.8 turns |
| Min / Max turns | 11 / 41 |
| Avg challenges/game | 7.1 |
| Challenge success rate | 51.0% |
| Avg blocks/game | 5.1 |
| Avg eliminations/game | 4.2 |

### Win Rates

| Bot | Wins | Rate |
|-----|------|------|
| Terminator | 12 | 24.0% |
| GLaDOS | 11 | 22.0% |
| WALL-E | 11 | 22.0% |
| R2-D2 | 9 | 18.0% |
| HAL 9000 | 7 | 14.0% |

### Avg Actions per Game

| Action | Avg/Game |
|--------|----------|
| Tax | 7.8 |
| Steal | 5.2 |
| Income | 3.2 |
| Exchange | 2.7 |
| Assassinate | 1.8 |
| Coup | 1.2 |
| Foreign Aid | 0.8 |

---

## Bluffing Behavior

### Action Claims: Honest vs Bluff

| Action | Claimed Char | Total | Honest | Bluff | Bluff Rate |
|--------|-------------|-------|--------|-------|------------|
| Tax | Duke | 391 | 205 (52.4%) | 186 (47.6%) | 47.6% |
| Steal | Captain | 262 | 165 (63.0%) | 97 (37.0%) | 37.0% |
| Assassinate | Assassin | 91 | 43 (47.3%) | 48 (52.7%) | 52.7% |
| Exchange | Ambassador | 133 | 76 (57.1%) | 57 (42.9%) | 42.9% |

**Top hands when bluffing each action:**

- **Bluff Tax:** [Captain] x41, [Contessa] x23, [Assassin + Contessa] x16
- **Bluff Steal:** [Contessa + Duke] x12, [Ambassador + Assassin] x11, [Contessa] x10
- **Bluff Assassinate:** [Captain] x12, [Contessa] x8, [Ambassador] x7
- **Bluff Exchange:** [Contessa] x10, [Captain] x9, [Assassin + Contessa] x8

### Block Claims: Honest vs Bluff

| Block Char | Total | Honest | Bluff | Bluff Rate |
|-----------|-------|--------|-------|------------|
| Duke | 16 | 11 | 5 | 31.3% |
| Captain | 128 | 67 | 61 | 47.7% |
| Ambassador | 55 | 31 | 24 | 43.6% |
| Contessa | 55 | 15 | 40 | **72.7%** |

**Contessa vs Assassination detail:**
- Honest Contessa blocks: 15
- Bluff Contessa blocks: 40 (72.7% bluff rate)
- Top hands when bluffing Contessa: [Duke] x12, [Captain] x6, [Ambassador + Assassin] x5, [Assassin + Captain] x3, [Duke + Duke] x2

---

## Challenge Behavior

| Metric | Value |
|--------|-------|
| Total challenge opportunities | 2,665 |
| Challenges issued | 353 |
| Challenges passed | 2,312 |
| Challenge rate | 13.2% |
| Challenges with 1 influence | 101 |
| Challenges with 2 influences | 252 |

**Top hands when issuing challenges:**

| Hand | Count |
|------|-------|
| Captain + Duke | 35 |
| Contessa + Duke | 33 |
| Duke | 30 |
| Captain | 28 |
| Duke + Duke | 26 |
| Ambassador + Duke | 24 |
| Captain + Contessa | 18 |
| Ambassador + Captain | 18 |

Duke holders challenge most frequently. Holding the Duke makes an opponent's Duke claim more suspect, and losing a challenge when you have a Duke is less costly (Duke is expendable compared to Captain in the endgame).

---

## Influence Loss Choices

### Cards Sacrificed (when forced to lose influence)

| Card | Count | Rate |
|------|-------|------|
| Assassin | 76 | 25.3% |
| Contessa | 70 | 23.3% |
| Ambassador | 67 | 22.3% |
| Duke | 44 | 14.7% |
| Captain | 43 | 14.3% |

### Keep vs Sacrifice Decisions (2 cards in hand)

| Kept | Sacrificed | Count |
|------|-----------|-------|
| Captain | Contessa | 26 |
| Duke | Contessa | 20 |
| Captain | Ambassador | 20 |
| Contessa | Assassin | 18 |
| Duke | Assassin | 16 |
| Captain | Captain | 14 |
| Ambassador | Ambassador | 14 |
| Captain | Assassin | 13 |
| Duke | Ambassador | 13 |
| Captain | Duke | 13 |

Captain and Duke are overwhelmingly the cards bots fight to keep. Contessa and Assassin are sacrificed most willingly.

---

## Exchange Behavior

| Metric | Value |
|--------|-------|
| Total exchanges | 107 |
| Hand changed after exchange | 64 (59.8%) |

### Cards Kept vs Returned

| Card | Kept | Returned |
|------|------|----------|
| Captain | 59 | 7 |
| Duke | 52 | 13 |
| Ambassador | 33 | 68 |
| Contessa | 15 | 59 |
| Assassin | 12 | 67 |

Captain is kept 89.4% of the time when available (59 kept / 66 seen). Duke is kept 80.0%. Ambassador, Contessa, and Assassin are dumped at high rates, consistent with the dynamic card valuation.

---

## Winner Analysis

### Cards Winners Held (unrevealed) at Game End

| Card | Count |
|------|-------|
| Captain | 19 |
| Duke | 15 |
| Ambassador | 11 |
| Assassin | 9 |
| Contessa | 7 |

### Starting Cards: Winners vs Losers

| Card | Dealt to Winners (50 games) | Dealt to Losers (200 player-games) |
|------|----------------------------|-----------------------------------|
| Duke | 31 (0.62/winner) | 72 (0.36/loser) |
| Captain | 22 (0.44/winner) | 85 (0.43/loser) |
| Ambassador | 20 (0.40/winner) | 80 (0.40/loser) |
| Contessa | 17 (0.34/winner) | 79 (0.40/loser) |
| Assassin | 10 (0.20/winner) | 84 (0.42/loser) |

**Starting with Duke gives a significant advantage.** Winners were dealt Duke at 0.62/player vs 0.36/player for losers — a 72% higher rate. Starting with Assassin correlates with losing (0.20 vs 0.42).

---

## Targeting Patterns

### By Action Type

| Action | Most Targeted | Least Targeted |
|--------|--------------|----------------|
| Assassinate | HAL 9000 (25) | WALL-E (14) |
| Coup | WALL-E (18) | R2-D2 (9), HAL 9000 (9) |
| Steal | R2-D2 (57), WALL-E (57) | Terminator (48) |

### Overall Most Targeted

| Bot | Times Targeted |
|-----|---------------|
| WALL-E | 89 |
| R2-D2 | 87 |
| HAL 9000 | 85 |
| GLaDOS | 78 |
| Terminator | 76 |

Terminator was targeted least (76) and won the most (12). Being targeted less correlates with winning, as expected from the "target highest coins" strategy — bots who accumulate quietly survive longer.

---

---

# Comparison: Our Bots vs Treason Database

**Treason dataset:** 51,401 five-player original Coup games from [treason.thebrown.net](https://github.com/octachrome/treason) (no expansion/inquisitor games). 61.3% were 1 human + 4 AI, 16.7% were 5 humans, rest mixed. Filtered to games with no disconnects.

---

## Game Length

| Metric | Treason (5P) | Ours |
|--------|-------------|------|
| Avg turns | 29.1 | 22.8 |
| Median turns | 28 | -- |
| Min / Max | 3 / 141 | 11 / 41 |
| Avg duration | 238s | instant |

**Our bots play 22% shorter games.** This is likely because optimal bots are more aggressive — they bluff more, challenge more, and force faster eliminations. Treason games include cautious human players and weaker AI that stall with Income. Our bots almost never take Income when a better option exists.

---

## Action Distribution (avg per game)

| Action | Treason | Ours | Delta | Interpretation |
|--------|---------|------|-------|----------------|
| Tax | 7.2 | 7.8 | +0.6 | Similar — Tax dominates both metas |
| Steal | 4.9 | 5.2 | +0.3 | Similar — Steal is second most popular |
| Income | 5.7 | 3.2 | **-2.5** | Our bots strongly avoid Income |
| Exchange | 3.1 | 2.7 | -0.4 | Similar |
| Assassinate | 2.6 | 1.8 | -0.8 | Fewer assassinations (Contessa bluff-blocks kill the action) |
| Coup | 2.0 | 1.2 | -0.8 | Fewer coups (games end before bots accumulate 7) |
| Foreign Aid | 0.8 | 0.8 | +0.0 | Identically dead in both metas |

**The biggest gap is Income: -2.5/game.** Treason players (especially humans) fall back to Income frequently. Our optimal bots almost always prefer a character-claiming action (Tax, Steal, Exchange) even if it means bluffing. This is a strategic choice — the expected value of a bluffed Tax (+3 coins, ~85% unchallenged) far exceeds Income (+1 coin, 100% safe).

**Assassinate is lower for us (-0.8)** because our Contessa bluff-block rate (72.7%) is much higher than treason's (52.7%), making assassination a less attractive investment.

---

## Challenge Stats

| Metric | Treason | Ours |
|--------|---------|------|
| Challenges/game | 6.5 | 7.1 |
| Success rate | **38.2%** | **51.0%** |

**Our bots' challenges succeed 51% vs treason's 38%.** This is the card-counting advantage — optimal bots only challenge when they have evidence (holding the claimed card themselves, or seeing copies revealed). Treason players (and its AI) challenge more speculatively, catching fewer bluffs.

However, our bots also bluff far more (see below), so the higher success rate also reflects that there are genuinely more bluffs to catch.

---

## Action Bluff Rates

| Action | Treason | Ours | Delta |
|--------|---------|------|-------|
| Tax (Duke) | **19.8%** | **47.6%** | +27.8 |
| Steal (Captain) | **12.4%** | **37.0%** | +24.6 |
| Assassinate (Assassin) | **14.1%** | **52.7%** | +38.6 |
| Exchange (Ambassador) | 53.2% | 42.9% | -10.3 |

**Our bots bluff 2-4x more than treason players on Tax, Steal, and Assassinate.** This is the single biggest behavioral difference.

- **Tax bluff 47.6% vs 19.8%:** Our bots know Duke-Tax is the best action and will claim it without the card nearly half the time. Treason players are much more honest — only 1 in 5 Tax claims is a bluff. This suggests our bots are over-bluffing relative to real play.
- **Steal bluff 37.0% vs 12.4%:** Similar pattern. Our bots bluff Captain for the 4-coin swing even without it.
- **Assassinate bluff 52.7% vs 14.1%:** The most extreme gap. Our bots bluff-assassinate more than they honestly assassinate. Treason players almost never bluff assassination (only 14%). This is a **clear tuning issue** — spending 3 coins on a bluff that fails 51% of the time when challenged is a terrible expected value.
- **Exchange bluff: we're actually lower (-10.3).** Treason players bluff Exchange 53% of the time, more than us. This makes sense — Exchange is the safest bluff in the game (nobody challenges Ambassador claims) and treason players discovered this.

---

## Block Bluff Rates

| Character | Treason | Ours | Delta |
|-----------|---------|------|-------|
| Duke | **45.3%** | 31.3% | -14.0 |
| Captain | 40.6% | 47.7% | +7.1 |
| Ambassador | 30.0% | 43.6% | +13.6 |
| Contessa | **52.7%** | **72.7%** | +20.0 |

- **Contessa bluff-block: 72.7% vs 52.7%.** Both populations bluff Contessa frequently (it's the mathematically correct play), but our bots do it 20% more. Treason's lower rate may reflect human loss aversion — people are afraid to bluff when their life is on the line.
- **Duke block bluff: we're lower (31.3% vs 45.3%).** Treason players bluff-Duke to block Foreign Aid much more. This makes sense — Foreign Aid is equally dead in both metas, so the few times it happens, both sides are likely bluffing.
- **Ambassador/Captain block bluffs: we're higher.** Our bots bluff-block Steal attempts more aggressively.

---

## Winner Card Holdings (unrevealed at game end)

| Card | Treason | Ours |
|------|---------|------|
| Duke | 22.2% | 24.6% |
| Captain | 18.6% | **31.1%** |
| Assassin | 14.4% | 14.8% |
| Ambassador | 21.5% | 18.0% |
| Contessa | **23.4%** | **11.5%** |

**Captain divergence is the biggest finding.** Our winners hold Captain 31.1% of the time vs 18.6% in treason. Our bots' `dynamicCardValue()` correctly identifies Captain as the best endgame card (Steal is dominant in 1v1), and they aggressively trade into it via Exchange. Treason players don't optimize as hard for Captain.

**Contessa divergence is also striking: 23.4% vs 11.5%.** Treason winners hold Contessa much more often. This suggests Contessa is more valuable in human play (where assassination is a real threat that people don't always bluff-block) than in bot play (where assassination is almost always bluff-blocked, making Contessa less necessary).

---

## Cards Sacrificed

| Card | Treason | Ours |
|------|---------|------|
| Duke | 19.5% | 14.7% |
| Captain | **21.8%** | **14.3%** |
| Assassin | 25.5% | 25.3% |
| Ambassador | **14.4%** | **22.3%** |
| Contessa | 18.8% | 23.3% |

**Treason players sacrifice Captain and Duke far more than our bots.** This confirms our bots' card valuation is working — they protect Captain/Duke and dump Ambassador/Contessa/Assassin. Treason players don't differentiate as strongly, sacrificing cards more evenly.

**Ambassador sacrifice is inverted:** Treason players sacrifice Ambassador least (14.4%), while our bots sacrifice it second-most (22.3%). Treason players value Ambassador's steal-blocking ability more than our bots do. This could indicate our bots undervalue Ambassador's defensive utility.

---

## Key Takeaways

### What Our Bots Do Well
1. **Tax/Steal dominance** matches real play — these are correctly identified as the best actions
2. **Card-counting challenges** achieve 51% accuracy vs treason's 38% — the intelligence pays off
3. **Captain-centric endgame** strategy works — winners hold Captain 31% of the time
4. **Foreign Aid avoidance** matches real meta — equally dead in both populations

### What Needs Tuning
1. **Bluff rates are 2-4x too high** across Tax, Steal, and Assassinate. Real players bluff 12-20% of the time; our bots bluff 37-53%. This makes games shorter and more volatile than real play. Reducing `bluffMod` or adding a "reputation" system (track how often you've been caught) would help.
2. **Assassinate bluff (52.7% vs 14.1%) is the worst offender.** Spending 3 coins on a bluff is terrible EV when it fails. Consider adding a coin threshold or reducing the assassination bluff weight significantly.
3. **Income avoidance is too aggressive** (-2.5/game vs treason). Sometimes Income is the right play, especially when all bluff options are risky. The Income weight of 1 may need to increase to 2-3.
4. **Contessa is undervalued.** Winners hold it 23.4% in treason vs 11.5% for us. The `dynamicCardValue()` for Contessa may be too low — it should be boosted when opponents have 3+ coins.
5. **Ambassador is over-sacrificed.** Treason players protect Ambassador (14.4% sacrifice rate) while our bots dump it (22.3%). Ambassador's steal-blocking ability is valuable in practice.

### Where We Match Reality
- Tax and Steal frequency: nearly identical
- Foreign Aid usage: identically dead (0.8/game)
- Assassin sacrifice rate: 25.3% vs 25.5% (virtually identical)
- Challenge frequency per game: 7.1 vs 6.5 (close)
- Block frequency per game: 5.1 vs 4.9 (close)

---

---

# Winner-Only Analysis: Do Winning Strategies Align?

**Rationale:** The treason database is full of casual players and weak AI. Comparing everyone's behavior pollutes the signal. By isolating only the *winners* — the player who survived each game — we get a cleaner picture of what winning Coup actually looks like, and can compare that directly to our optimal bots.

**Datasets:**
- All 5P winners: 47,013 games (63.6% human, 36.4% AI winners)
- Human winners only: 29,882 games
- All-human lobby winners: 7,699 games (5 humans, no AI — the purest signal)

---

## Action Share: What Winners Spend Turns On

| Action | All-Human Lobby Winner | Our Bot | Delta |
|--------|----------------------|---------|-------|
| Tax | 29.6% | 34.4% | +4.8 |
| Steal | 15.3% | **22.9%** | **+7.6** |
| Income | 15.1% | 14.1% | -1.0 |
| Exchange | 11.4% | 11.9% | +0.5 |
| Assassinate | 8.5% | 7.9% | -0.6 |
| Coup | **11.6%** | **5.3%** | **-6.3** |
| Foreign Aid | 7.7% | 3.5% | -4.2 |

**Tax and Exchange: nearly identical.** Both our bots and human winners prioritize Tax as ~30-34% of all actions and Exchange at ~11-12%. The core economy engine is the same.

**Steal is our bots' biggest over-index (+7.6).** Our bots use Steal 22.9% of the time vs 15.3% for human winners. This is the `dynamicCardValue()` Captain-dominance showing — bots aggressively steal because they value the 4-coin swing. Human winners use Steal less, partly because they face more Captain/Ambassador blocks from savvy opponents.

**Coup is the biggest under-index (-6.3).** Human winners coup 11.6% of the time vs our bots at 5.3%. This is because our bot games are shorter (22.8 turns vs ~30+ turns) — bots eliminate each other through challenges and assassinations before reaching coup territory. Human games last longer, and late-game coups become the dominant finisher. This is confirmed by the phase data: winners coup just 0.6% early but 18.3% late.

**Income: essentially identical (-1.0).** This is a major correction from our earlier analysis. When comparing to *all* treason players, Income looked 2.5/game too low. But winners also avoid Income — they take it 15.1% of the time, and our bots take it 14.1%. Winners don't play safe either.

---

## The Bluff Gap: Winners Play Honest

This is the most important finding in the entire analysis.

### Action Bluff Rates

| Action | All-Human Winner | Human Winner | All Winner | Our Bot |
|--------|-----------------|-------------|------------|---------|
| Tax | **15.3%** | 11.6% | 10.4% | **47.6%** |
| Steal | **8.8%** | 7.3% | 7.4% | **37.0%** |
| Assassinate | **13.2%** | 16.9% | 12.8% | **52.7%** |
| Exchange | **16.0%** | 34.7% | 42.6% | **42.9%** |

**Winners barely bluff Tax (15% vs our 48%) and Steal (9% vs our 37%).** This is not because they're passive — they take these actions at high rates. They just *actually have the cards*. The winning strategy is to hold Duke and Captain and use them honestly, not to bluff constantly.

**Assassinate bluff: 13.2% vs our 52.7%.** When human winners assassinate, they have the Assassin 87% of the time. Our bots bluff-assassinate more than they honestly assassinate. This is the single clearest tuning failure.

**Exchange is the one action where winners DO bluff.** All-human lobby winners bluff Exchange 16%, mixed-lobby human winners bluff it 34.7%, and all winners (including AI) bluff it 42.6%. Our bots at 42.9% are actually well-calibrated here. Exchange is the safest bluff in the game — almost nobody challenges Ambassador.

### Block Bluff Rates

| Character | All-Human Winner | Our Bot | Delta |
|-----------|-----------------|---------|-------|
| Duke | **5.5%** | 31.3% | +25.8 |
| Captain | **9.9%** | 47.7% | +37.8 |
| Ambassador | **11.1%** | 43.6% | +32.5 |
| Contessa | **4.3%** | **72.7%** | **+68.4** |

**Winners almost never bluff-block.** When all-human lobby winners block, they have the card 90-96% of the time. Our bots bluff-block 31-73% of the time.

**The Contessa gap is staggering: 4.3% vs 72.7%.** Human winners who block assassination with Contessa actually *have* Contessa 95.7% of the time. Our bots bluff Contessa 72.7% of the time. The "always bluff Contessa" strategy may be mathematically correct in isolation, but in the treason dataset, the winning strategy is to **actually hold Contessa and use it honestly**.

---

## Challenge Behavior: Winners Are Surgical

| Metric | All-Human Winner | Our Bot |
|--------|-----------------|---------|
| Challenges issued/game | 1.01 | ~1.4 |
| Challenge success rate | **76.1%** | **51.0%** |

**Winners challenge less but succeed 76% of the time.** When a human winner challenges, they're right three-quarters of the time. Our bots challenge more frequently but only succeed half the time. Winners are patient — they wait for high-confidence spots.

| Metric | All-Human Winner |
|--------|-----------------|
| Times challenged/game | 2.10 |
| Was honest when challenged | **91.7%** |
| Was bluffing when challenged | 8.3% |

**When winners ARE challenged, they survive 92% of the time.** This is the direct consequence of their low bluff rate. They play honest, get challenged by suspicious opponents, and prove they have the card — causing the challenger to lose an influence. Being challenged is actually *good* for winners because they're almost always telling the truth.

**Our bots have the opposite dynamic.** With bluff rates of 37-53%, getting challenged is often fatal. The "bluff everything and hope they don't challenge" strategy works against weak opponents but would collapse against the kind of players who win games.

---

## Block Challenges: Winners Are Aggressive Callers

| Metric | All-Human Winner |
|--------|-----------------|
| Block challenges issued | 3,383 |
| Success rate | **78.9%** |

When a winner's action gets blocked, they challenge the block and succeed 79% of the time. Winners can smell bluff-blocks and punish them. This is another signal that winners face bluff-heavy opponents and profit from calling them out.

---

## Phase Strategy: How Winners Evolve

| Phase | Top Actions |
|-------|------------|
| **Early** (turns 1-33%) | Tax 42%, Exchange 19%, Income 17%, Steal 15% |
| **Mid** (turns 34-66%) | Tax 30%, Steal 16%, Income 18%, Exchange 13%, Coup 9% |
| **Late** (turns 67-100%) | Tax 24%, Coup 18%, Steal 15%, Income 13%, FA 11% |

**Early game is Tax + Exchange dominated.** Winners establish their economy with Tax (42%) and improve their hand with Exchange (19%). Very few early assassinations (2.6%) or coups (0.6%).

**Mid game introduces Steal and Assassination.** As players accumulate coins, Steal becomes viable and assassination pressure mounts.

**Late game is Tax + Coup.** By the endgame, winners are either Taxing to reach coup threshold or couping to finish opponents. Foreign Aid also spikes to 11% — a desperation play when all other options are too risky.

**Our bots don't have this phase arc** because our games are shorter. But the early-game Tax+Exchange pattern matches our bots' behavior well.

---

## Winner Card Holdings

### Starting Cards

| Card | All-Human Winner | Expected (uniform) |
|------|-----------------|-------------------|
| Duke | **22.5%** | 20.0% |
| Ambassador | 21.5% | 20.0% |
| Contessa | 20.6% | 20.0% |
| Captain | 18.9% | 20.0% |
| Assassin | **16.5%** | 20.0% |

Starting with Duke gives a small edge (+2.5% above expected). Starting with Assassin is the worst (-3.5% below expected). This matches our simulation's finding that Duke is the strongest starting card.

### End Cards

| Card | All-Human Winner | Our Bot |
|------|-----------------|---------|
| Duke | 22.4% | 24.6% |
| Ambassador | 21.0% | 18.0% |
| Contessa | **20.4%** | **11.5%** |
| Captain | 19.4% | **31.1%** |
| Assassin | 16.8% | 14.8% |

**Human winners end with evenly distributed cards.** No single card dominates — the spread is 16.8% to 22.4%. This means human winners succeed with *any* card combination, adapting to what they're dealt.

**Our bots over-concentrate on Captain (31.1% vs 19.4%).** The `dynamicCardValue()` function rates Captain too highly relative to other cards. While Captain IS the best 1v1 card, human winners prove you can win with any card if you play it honestly and challenge well.

**Contessa remains the biggest gap (20.4% vs 11.5%).** Human winners keep Contessa because it protects against assassination — the second most common way to get targeted (31% of attacks). Our bots dump Contessa because they plan to bluff it anyway. But winners who actually hold Contessa get the best of both worlds: genuine protection that opponents can't call.

---

## Revised Conclusions

The winner-only analysis significantly changes our tuning recommendations:

### 1. Bluff Rates Need Dramatic Reduction (Priority: Critical)

Winners bluff Tax at 15%, not 48%. Winners bluff Steal at 9%, not 37%. Winners bluff Assassinate at 13%, not 53%. The winning strategy is **play honest, get challenged, survive, and make the challenger pay**. Our bots should be tuned closer to 15-20% bluff rates for Tax/Steal and under 15% for Assassinate.

### 2. Contessa "Always Bluff" Is Wrong (Priority: High)

Human winners bluff Contessa at 4.3%, not 73%. The theoretically-correct "always bluff Contessa" strategy fails in practice because opponents *do* challenge blocks, and getting caught costs you the game. Winners hold real Contessas and use them honestly. The `dynamicCardValue()` for Contessa should be significantly increased — it's an insurance policy that winners keep.

### 3. Captain Over-Optimization (Priority: Medium)

Our bots end with Captain 31% of the time; human winners end with it 19%. The Captain-centric strategy is too narrow. The `dynamicCardValue()` gap between Captain and other cards is too wide. Winners succeed with any card, suggesting a flatter valuation curve.

### 4. Income Is Fine (Priority: None)

The all-players comparison made Income look too low. But winners use Income at 15.1% vs our 14.1%. We're actually well-calibrated. Winners also avoid Income when possible.

### 5. Coup Rate Will Self-Correct (Priority: None)

Our lower coup rate (-6.3) is a downstream effect of shorter games, not a strategic error. If bluff rates come down, games will last longer, and coups will naturally increase.

### 6. Exchange Bluff Rate Is Correct (Priority: None)

Our 42.9% exchange bluff rate is close to the all-winner rate of 42.6%. Exchange is genuinely the safest bluff and winners exploit it too.
