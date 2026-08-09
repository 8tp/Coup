# COUP ONLINE — ART DIRECTION: "THE MINISTRY"

Ratified 2026-08-08 as Phase 0 of `docs/GAME-FEEL-PLAN.md`. **This document is binding.**
Where it and `docs/ASSETS.md` disagree, this document wins; ASSETS.md remains authoritative
on *how assets are produced* (Midjourney parameters, crop geometry, encoding, cache-busting),
not on what the game looks like. Provenance: the v2/v3 Midjourney system in `docs/ASSETS.md`;
`tailwind.config.ts:10-21`; `src/app/globals.css`; collisions and counts measured in this
repository on 2026-08-08 and cited inline. Contrast ratios use the WCAG 2.x
relative-luminance formula; the arithmetic is shown.

---

## 0. The thesis

**Screen-printed civic propaganda, lying on the council table of a blackened-teal palace.**

Every object is a *printed thing* — gouache and ink pushed through a screen onto card stock
that has been handled. Every surface it lies on is *architecture* — oxblood enamel, aged
brass routing, blackened teal composite. Objects are printed; furniture is built. Printed
things curl, catch light on their edge, and cast a shadow. Built things do not float, do not
glow, and are cut *into* the table rather than laid on top of it.

The thesis exists so ambiguous decisions have a right answer instead of a preference. When
something is uncertain, ask: **is that how screen-printed paper, enamelled metal, or brass
behaves?** A drop shadow under a card: yes, paper does that. A 16px amber glow around a
button (`globals.css:60`): no — nothing in this world emits light. A 1px grey stroke around
a panel: no — the palace does not draw outlines, it mills grooves.

Two load-bearing corollaries:

1. **The cards do not change with the table.** Card art is fixed raster (`docs/ASSETS.md`),
   so anything the UI paints onto or around a card must be a *material* the card could
   physically carry (a printed band, a foil hairline, a stamped hatch) — never a UI state
   colour bled over the art.
2. **There is one light source and it is dim.** The background is already darkened by
   `linear-gradient(rgba(5,9,10,0.58), rgba(5,9,10,0.70))` (`globals.css:16`). Nothing on
   top of it may be brighter than paper in that room.

---

## 1. Colour and material are two independent channels

**This is the single most important section, because Coup's worst structural collision is
already shipping.**

Coup needs two disjoint colour vocabularies and currently gives them the same 360°:
**categorical** — six characters plus two Reformation factions, eight categories — and
**semantic** — challenge, block, danger/target, your-turn, eliminated, illegal, affordable,
at least seven states. Fifteen meanings do not fit in a hue wheel with usable separation,
and the current build proves it.

### 1.1 Measured collisions in the build today

Hues are HSV, taken from the literal hex values in the source.

| # | Collision | Values | Separation |
|---|---|---|---|
| **1** | **Contessa is literally the danger colour** | Contessa `border-red-500` = `#ef4444` (`CardFace.tsx:15`); target-selection ring `ring-2 ring-red-500` = `#ef4444` (`PlayerSeat.tsx:84`) | **0°, identical hex.** A Contessa in your hand and "you are about to be couped" are rendered in the same pixel value |
| **2** | **Captain vs the Loyalist faction** | Captain `border-blue-500` = `#3b82f6` (217°) (`CardFace.tsx:13`); Loyalist `border-l-blue-400` = `#60a5fa` (213°) (`PlayerSeat.tsx:68-77`, `GameTable.tsx:259`) | **4°.** Both appear on a `.card-container` seat at once |
| **3** | **Contessa vs the Reformist faction** | Contessa `#ef4444` (0°, S72); Reformist `border-l-red-400` = `#f87171` (0°, S54) | **0° hue, 18 points of saturation.** The only channel separating "she holds a Contessa" from "he is a Reformist" is saturation |
| 4 | **The Inquisitor is the same hue as the room** | Inquisitor `border-teal-500` = `#14b8a6` (173°); ground `#090d0e` (192°, S36) | 19°. The character disappears into the table it sits on |
| 5 | **The Assassin has no colour at all** | Assassin `border-gray-500` = `#6b7280` (220°, **S16**), which is also `.btn-secondary`'s `border-gray-600`, `.card-container`'s `border-gray-700`, and every disabled control | Achromatic. "Assassin" and "inert chrome" are the same treatment |
| 6 | **Duke has three different purples** | `tailwind.config.ts:15` `coup.duke: #9b59b6`; `CardFace.tsx:11` `purple-500 #a855f7`; `DukeIcon.tsx` hardcodes both `#9b59b6` *and* `#c084fc` | Three values for one character across three files |
| 7 | **Three brasses** | `coup.accent #d6a12a` (165 uses), `coup.gold #f2c744` (4 uses), `rgb(251,191,36)` = amber-400 baked into `.card-action-label` (`globals.css:146`) and every icon file (27 uses) | Three golds, no rule for which is which |

Two structural facts behind the table:

- The `coup.duke / assassin / captain / ambassador / contessa` tokens in
  `tailwind.config.ts:15-19` are used **zero** times as Tailwind classes. The colours that
  actually ship are raw Tailwind defaults, hand-copied into **five** separate per-character
  palettes: `characterColors` in `CardFace.tsx:10`, `ChallengeRevealOverlay.tsx:8` and
  `ExchangeView.tsx:11`; `characterThemes` in `HowToPlay.tsx:15`; and a fourth set inlined
  per-entry in the `Tutorial.tsx:78` data array. A sixth palette is hardcoded inside the six
  SVGs in `src/app/components/icons/`. There is no single source of truth to fix.
  (`GameOverOverlay.tsx:28` and `AddBotModal.tsx:46` also carry hand-rolled palettes, but
  they key on recap tone and bot personality rather than on character — separate duplication,
  not part of this collision.)
- Those six SVGs use **six different stroke widths** (`0.5`, `1`, `1.5`, `2`, `2.5`, `3`) and mix
  `strokeLinecap="round"`, `strokeLinejoin="round"`, and neither. They are not one line
  language, so they cannot yet carry the categorical load §1.2 assigns them.

### 1.2 The resolution

**Hue-based signalling of *state* is banned.** Characters own colour. Semantics own material.

| Layer | Carries meaning via | Never |
|---|---|---|
| **Characters (6)** | **Glyph silhouette first, colour second.** One distinct 1-bit silhouette per character, plus that character's hue as a solid printed band along one card edge and as the glyph fill | a ring, a glow, a gradient, a full-card saturated border, or any animation |
| **Factions (2)** | **Form, not hue.** The existing `▲ LOY` / `◆ REF` marks (`PlayerSeat.tsx:107`) are correct and are the whole signal; the seat carries a 3px *debossed* rail, not a coloured left border | a coloured tint over the seat |
| **Your turn / selection** | **Brass ring, 2px, stroked *outside* the object** | being a fill; being a pulsing glow (kill `animate-pulse-gold` and `turn-ready-ring`) |
| **Challenge / danger / target** | **Hazard material** — 45° stripes at 8px/2px in crimson, the same repeating gradient already used for revealed cards (`globals.css:343-349`), reused everywhere danger is meant | being a plain coloured chip or a red border |
| **Blocked / refused** | **Ink slab** — a solid `--ink` bar stamped across the object, achromatic | any hue at all |
| **Eliminated** | **Print degradation** — `grayscale(0.6) + opacity(0.5)` plus the hazard hatch, exactly as `.card-face-revealed` does today. Keep it; it is already right | a red X, a skull emoji |
| **Primary action** | **Brass slab**, flat fill, no gradient, no glow | `linear-gradient(...)` + `box-shadow: 0 0 16px` (`globals.css:56,60`) |

**No character may ever wear a semantic material, and no semantic may ever be expressed as a
character hue.** A card is never ringed in crimson to say "targeted" — it gets the hazard
hatch. A seat is never tinted blue to say "Loyalist" — it gets the ◆/▲ mark and a debossed
rail. This is what makes collision #1 survivable: Contessa's rose and danger's crimson can
sit 17° apart without ambiguity, because one is only ever a printed fill inside a card and
the other is only ever a striped material outside one.

**Six glyphs**, one line language, legible 1-bit at 14×14 on a 24px grid — the smallest card
today is `w-11 h-16` = 44×64px (`globals.css:322-324`) and the glyph must survive there:

| Character | Silhouette | Note |
|---|---|---|
| Duke | Fractured crown reduced to three severe planes | Reuses the app-icon motif (`docs/ASSETS.md`, App Icon prompt). Angular, asymmetric, open at the top — see the RULING below for how it stays clear of the winner's crown |
| Assassin | Blunt wedge, point-down, one notch | Must not be a knife-and-drop-shadow cliché |
| Captain | Hooked bar (a grapple), horizontal | Reads as *taking*, matching STEAL |
| Ambassador | Two offset arrows forming an open loop | Reads as *exchange* |
| Contessa | Heraldic shield, flat top, single vertical split | The only closed convex form in the set — findable by shape alone |
| Inquisitor | Eclipse eye | `InquisitorIcon.tsx` is already this; it is the one glyph that survives the rewrite |

**RULING — the crown (2026-08-08).** An earlier draft of this section reserved the crown for
the Duke and sent victory to an eclipse disc. That is overruled. **The crown means the
winner.** 👑-for-victory is one of the strongest conventions in the medium, and spending a
player's first-ever read of the game-over screen on teaching them a bespoke disc buys
internal tidiness at the cost of the one moment that should need no decoding. `CrownGlyph`
therefore stays on `win`, the winning hand, and the game-over header.

The Duke keeps the fractured crown, and the separation is carried by **silhouette, not by
subject** — which is what §1's whole colour-versus-material argument already commits us to:

| | Winner | Duke |
|---|---|---|
| Form | Closed, symmetric, resting on a solid base | Open-topped, asymmetric, three severe planes, no base |
| Register | Heraldic — a whole object | Technical-order — a fracture diagram of one |
| Where it appears | Game-over header at 56px; the win log row | Card face and character strip, never above 24px |

Those never share a size or a surface, so the collision the earlier draft feared cannot
occur in practice. **The constraint this ruling creates:** whoever draws the Duke silhouette
must check it against `CrownGlyph` at 16px side by side, on the proof sheet, before it lands.
If they read as the same mark at that size, the Duke's is wrong and gets redrawn — not the
winner's.

Drawing rules, from the technical-order idiom the wordmark already implies: **exactly two
stroke widths at a 2:1 ratio** (thick for object lines only); **square corners always**
(`miter` joins, `butt` caps); **never a gradient, blur, or soft shadow**; **patterns rather
than opacity for tints** — a 45° dot-grid reads as the halftone screen a screen-print
actually is, where `fill-opacity` just reads as faded. This replaces the five-stroke-width,
mixed-cap situation measured above.

---

## 2. Tokens

One palette, defined once in `tailwind.config.ts`, consumed by name. The five duplicated
per-character palettes and the sixth hardcoded across `src/app/components/icons/` (§1.1) are
deleted and replaced by references to these tokens.

### 2.1 Ground and structure

| Token | Hex | Purpose | Status |
|---|---|---|---|
| `--ground` | `#090D0E` | Body, deepest table | existing `coup.bg` — keep |
| `--ground-deep` | `#05090A` | Wells, the deck recess, inside a deboss | already in use as the gradient overlay (`globals.css:16`), promote to a token |
| `--surface` | `#17231F` | The felt; the plane most UI sits on | existing `coup.surface` — keep |
| `--raised` | `#22302B` | Seats, prompts, anything a step above the felt | existing `coup.card` — keep |
| `--line` | `#33443E` | The *only* hairline value, used for card-edge trim and deboss highlights — never as a panel outline (§3.1) | new |
| `--ink` | `#F1EBDE` | All primary text. Bone, not white — white is a flashlight in this room | new; replaces bare `text-white` |
| `--ink-mute` | `#9FADA6` | Secondary text | new; replaces `text-gray-400` / `text-gray-500` |
| `--brass` | `#D6A12A` | Your turn, primary slabs, focus ring | existing `coup.accent` — keep |
| `--brass-lit` | `#F2C744` | Coin figures and the treasury only | existing `coup.gold` — keep, but scope it |
| `--crimson` | `#F27366` | The danger *stripe* colour, and only that | new; replaces `red-500`/`red-400` as a semantic |
| `--oxblood` | `#5F141C` | Perimeter enamel, matching the table art | already in use as `rgba(95,20,28,…)` (`globals.css:15`), promote |

Note the deletion: `--brass-lit` is scoped to figures, so the third gold (`amber-400`,
`rgb(251,191,36)`, `globals.css:146` plus 27 icon sites) goes entirely. Three golds become
two with an explicit division of labour.

### 2.2 The six character hues

Every one is **lower saturation than what ships today.** The current set (`purple-500` S66,
`blue-500` S76, `green-500` S83, `red-500` S72, `teal-500` S89) sits at Tailwind-default
saturation, which is why §3.5 reads as debug outlines against painterly gouache.

| Character | Hex | HSV | vs today |
|---|---|---|---|
| Duke | `#B48AD0` | 276°, S34 | was `#a855f7` S66 |
| Assassin | `#8D9BA6` | 206°, S15 | was `#6b7280` S16 — **the fix here is the glyph, not the hue**; the Assassin stays cold steel and is identified by silhouette (see §2.4) |
| Captain | `#5FA5D6` | 205°, S56 | was `#3b82f6` S76 |
| Ambassador | `#A9BE5E` | 73°, S51 | was `#22c55e` S83. Chartreuse, not green — matches the art (`docs/ASSETS.md`: "Chartreuse and amber") |
| Contessa | `#E07B90` | 348°, S45 | was `#ef4444` S72. Rose-crimson, pulled off pure red to open a gap against `--crimson` |
| Inquisitor | `#5AC0C6` | 183°, S55 | was `#14b8a6` S89 |

### 2.3 Contrast, computed

Computed with the WCAG 2.x formula. Worked example for `--ink` on `--ground`:

```
#F1EBDE → sRGB (241,235,222) → linear (0.87965, 0.83078, 0.73050)
L1 = 0.2126(0.87965) + 0.7152(0.83078) + 0.0722(0.73050) = 0.83393
#090D0E → sRGB (9,13,14)     → linear (0.00273, 0.00402, 0.00439)
L2 = 0.2126(0.00273) + 0.7152(0.00402) + 0.0722(0.00439) = 0.00377
ratio = (0.83393 + 0.05) / (0.00377 + 0.05) = 0.88393 / 0.05377 = 16.44
```

**Pairs I actually computed** (`--raised` `#22302B` is the worst case, so it is the column
that matters):

| Foreground | on `--ground` | on `--surface` | on `--raised` |
|---|---|---|---|
| `--ink` `#F1EBDE` | 16.44 | 13.63 | 11.59 |
| `--ink-mute` `#9FADA6` | 8.37 | 6.94 | 5.90 |
| `--brass` `#D6A12A` | 8.36 | 6.93 | 5.89 |
| `--brass-lit` `#F2C744` | 12.11 | 10.05 | 8.54 |
| `--crimson` `#F27366` | 6.90 | 5.72 | 4.86 |
| Duke `#B48AD0` | 6.96 | 5.77 | 4.91 |
| Assassin `#8D9BA6` | 6.85 | 5.69 | 4.83 |
| Captain `#5FA5D6` | 7.29 | 6.05 | 5.14 |
| Ambassador `#A9BE5E` | 9.50 | 7.88 | 6.69 |
| Contessa `#E07B90` | 6.89 | 5.71 | 4.85 |
| Inquisitor `#5AC0C6` | 9.10 | 7.55 | 6.42 |

Every text token clears 4.5:1 on all three grounds. `--ground` on `--brass` (dark text on a
brass slab) is **8.36**.

**What today fails, also computed:** `text-gray-500` `#6b7280` on `.card-container`
(`--raised`) is **2.85:1** — below the 4.5 floor and used in the game header
(`GameTable.tsx:129`) and the public-room list (`page.tsx:354`). `text-gray-500` on
`--ground` is **4.04:1**, also failing. These are the first two fixes.

**Not computed — UNMEASURED:**

- `--line` `#33443E` is **1.34:1** on `--raised` and **1.57:1** on `--surface`. Deliberate
  (a hairline is not text), but it means the §5 deboss carries all the separation.
  **Measure:** the L\* step between every adjacent furniture pair once §5 ships; if a pair's
  field step is 0 L\* and only the stroke separates it, say so in the gate.
- Any token **against the card art itself** — raster, varies per pixel. **Measure:** sample
  the label-plate region of all six `focus/` crops and confirm `--ink` clears 4.5:1 against
  the *lightest* pixel under the plate, not the mean.
- The §1.2 card bands are fills, needing 3:1 against adjacent card stock. Stock value varies
  per portrait; not computed.

### 2.4 Residual hue proximities, stated rather than hidden

- `--crimson` (5°) vs Contessa (348°) = **17°**. Mitigated by material: crimson is only ever
  a 45° stripe or a ring *outside* an object; Contessa is only ever a fill *inside* one,
  carrying the shield glyph. Verify in review.
- Inquisitor (183°) vs Captain (205°) = **22°**, both cool. Mitigated by value and by glyph.
- Assassin (206°, S15) vs Captain (205°, S56) = **1° of hue**. The Assassin is deliberately
  near-achromatic; separation is entirely saturation plus glyph. **This is the weakest pair
  in the system.** If review finds it fails, the Assassin — not the Captain — moves, toward
  the "slate and electric blue" the art already carries (`docs/ASSETS.md`).
- Cyan is **reserved to the Inquisitor** and has no semantic role. The "restrained cyan" of
  `docs/ASSETS.md` survives in the raster art only; no UI state may claim it.

---

## 3. The web-app tells to kill

Each of these is present in the build today, counted or cited. Each has a fix.

1. **Rounded-rect + N-px border panels, ~9 per screen.** `.card-container` is
   `rounded-xl border-2 border-gray-700` (`globals.css:79-82`), used at 7 call sites across
   4 files including every player seat. `.prompt-urgent` / `.prompt-action` / `.prompt-info`
   (`globals.css:565-575`) are three more `rounded-xl border-2` variants, used 28 times.
   Repo-wide, **110** source lines carry both a `rounded-*` and a `border` utility, and there
   are **80** `border-gray-*` utilities. → **Zero `border: 1px solid` on table furniture.** Panels are debossed into the
   felt (§5). The only surviving strokes are the card trim hairline and the focus ring.
2. **A phone column centred in a desktop viewport.** `GameTable.tsx:127` is
   `h-dvh flex flex-col max-w-lg lg:max-w-xl mx-auto` — 512px, or 576px at `lg`. In a 1456px
   window that leaves ~60% of the screen as unused background. → Desktop gets its own layout
   with seats around a felt, a physical deck pile, a discard, and a treasury as objects
   (`GAME-FEEL-PLAN.md` §1.4). Not a widened phone.
3. **System emoji as functional iconography.** **44 distinct pictographic emoji, 75 uses**
   across `src/`, 44 of them in `src/shared/constants.ts` — the 12-entry `REACTIONS` table
   (`constants.ts:110-123`) plus bot emotes — all crossing the wire and rendering as Apple
   colour emoji on painterly gouache. → Replace functional emoji with the §1.2 SVG glyph set.
   Player-chosen *reactions* may stay emoji (a reaction is a person speaking, not the game
   speaking) but must render inside a printed speech plate, not naked on the felt.
4. **No typeface at all.** `src/app/layout.tsx` loads no font: zero `next/font`, zero
   `@font-face`. The Midjourney wordmark is a heavy slab display face in crimson with brass
   edges (`docs/ASSETS.md`, Title Banner); everything under it is `system-ui`. This is the
   loudest mismatch on screen. → §4.
5. **Saturated per-character card borders that read as debug outlines.** `.card-face` is
   `border-2` (`globals.css:84-86`) plus a `::before` hairline inset 3px
   (`globals.css:92-100`). On the small card (44×64px = 2816px²): the 2px border consumes
   2816 − (40×60) = **416px², 14.8% of the card**; the `::before` ring adds
   (38×58) − (36×56) = **188px², 6.7%**. **21.4% of the smallest card's pixels are frame**,
   in `purple-500`/`blue-500`/`red-500`. → §1.2: a hairline trim in `--line` plus a
   low-saturation printed band on one edge; the art and the glyph identify the card.
6. **A black gradient plate eating half the card.** `.card-face-sm .card-label-plate` is
   `padding: 12px 2px 3px` over a 6.6px name and a 7px action label with a 1px gap
   (`globals.css:168-178`) — ≈29.6px of a 64px card, **46% of the card height** under a
   `rgba(0,0,0,0.94)` wash. The best asset in the project is half-covered by a scrim to make
   6.6px text legible. → Make the card bigger (`GAME-FEEL-PLAN.md` §1.4) so the plate can
   shrink, and make it a *printed strip*, not a gradient wash.
7. **Glow as personality.** `globals.css:60` `box-shadow: 0 0 16px rgba(251,191,36,0.3)` on
   button hover; `:651-652` `turnReadyGlow`; `:631` `box-shadow: 0 0 16px currentColor`;
   `pulse-gold` in `tailwind.config.ts:48-51`. → Nothing in this world emits light (§0).
   Your-turn is a 2px brass ring *outside* the seat, static.
8. **Gradient chrome.** `.btn-primary` carries
   `background-image: linear-gradient(to bottom, rgba(255,255,255,0.1), transparent)`
   (`globals.css:56`); 11 `bg-gradient-to-*` sites repo-wide. → Flat slabs with a hard offset
   shadow (§5).
9. **52 `rounded-full` pills.** Pills are a web chrome idiom; a council table has plates,
   chips and stamps. → Coins and the treasury stay circles, because coins are circles.
   Everything else — badges, tabs, status — becomes a stamped plate at 2px radius.
10. **Refusal by greying out.** 19 `disabled={…}` bindings and 5 `disabled:opacity-50` rules,
    with the reason hidden in a `title=` attribute (26 sites; `ActionBar.tsx:344-351` builds
    a `disabledReason` string and puts it in a tooltip). A tooltip does not exist on touch.
    → Keep controls live and refuse out loud: a cue, a shake, a haptic, and a sentence
    (`GAME-FEEL-PLAN.md` §6.1).
11. **A full-screen modal disconnected from the table.** `ChallengeRevealOverlay.tsx` floats
    a card in `bg-black/70` on a hardcoded 1500/2500/3500ms timeline (`:49-63`). The most
    dramatic moment in the game happens nowhere. → The card flies from the accused player's
    seat; the replacement flies from the deck pile.
12. **`backdrop-blur` as depth.** 2 sites, including `.practice-coach` (`globals.css:614`).
    Frosted glass is an OS idiom, not a material this world contains. → Opaque printed panels.

---

## 4. Type

Three roles. No more.

| Role | Used for | Stack | Treatment |
|---|---|---|---|
| **Display** | The phase banner, player names, game-over title, action names on the ActionBar | A heavy slab or condensed geometric face with the wordmark's civic-poster weight, self-hosted via `next/font/local` — **no CDN dependency**, because the app is offline-capable (`public/sw.js`) and a font that fails to load is a visible identity failure, not a graceful degradation | 2.5–4× body, weight 700–900, tracking **−0.02em** |
| **Body** | Rules text, chat, the action log, prompts | `system-ui, -apple-system, "Segoe UI", Roboto` | 400–600, sentence case. One fewer request; correct for reading |
| **Figures** | **Coins, deck count, treasury reserve, timers, room codes** | `ui-monospace, "SF Mono", "Cascadia Mono", Menlo` + `font-variant-numeric: tabular-nums` | This is the character |

**Earn hierarchy with size and weight, never tracking.** Tracking is what you reach for when
the type scale is too flat to carry the hierarchy; today that is 11 `tracking-*` and 20
`uppercase` utilities doing the work a 2.5× size step should do. Fix the scale, delete the
tracking. **The one exception** is the `CAPTAIN` / `STEAL` plate on card art
(`CardArtwork.tsx:12-19`, `.card-character-label` / `.card-action-label`) — tracked uppercase
survives there because it is not UI, it is *printed on the card*, the way a real card's role
strip is set. It is the app's only tracked caps.

**Figures are monospace with `tabular-nums`, and the reason is mechanical.** In a
proportional face `1` is narrower than `8`, so a coin counter ticking 2 → 10 → 7 changes its
own width on every update and nudges everything beside it. That reflow reads as a webpage
recalculating; a counter that holds its column while the digits change reads as an instrument
with a value in it. **Current state: `tabular-nums` appears 0 times.** `font-mono` appears 6
times — room codes (`page.tsx:354,395`, `GameTable.tsx:130`) and lobby timer settings — and
on **none** of the figures that change during play: `player.coins` (`PlayerSeat.tsx:136`),
`deckCount` (`GameTable.tsx:137`), `treasuryReserve` (`GameTable.tsx:140`), the turn timer.
Exactly the wrong four.

---

## 5. Depth — two shadow languages

Paper casts a shadow. Enamelled metal does not; it takes a hard offset when it moves. **Never
mix them**, because mixing them is what makes a UI read as "everything is a floating div."

**Paper — cards, and only cards.** A soft multi-layer drop plus a hard 1px contact hairline:

```css
--shadow-paper:
  0 0 0 1px rgba(0,0,0,.16),      /* contact hairline — hard, no blur */
  0 1px 1px rgba(0,0,0,.20),
  0 3px 6px rgba(0,0,0,.16),
  0 10px 24px rgba(0,0,0,.12);
```

The contact hairline is the load-bearing layer, not the soft ones. A sheet lying on a surface
has a hard dark line where it meets that surface, and that line separates sheet from table
*before any value difference does*. Coup's cards currently have the inverse — an inner
highlight, `box-shadow: inset 0 1px 2px rgba(255,255,255,0.08)` (`globals.css:89`) — which
lights the card from inside and reads as a button. In flight, scale offset and blur ~2.5× and
drop the hairline; a card in the air has no contact.

**Chrome — pressables, and only pressables.** Hard offset, **zero blur**, collapsing on press:

```css
--shadow-chrome: 3px 3px 0 var(--ground-deep);
/* :active { transform: translate(3px, 3px); box-shadow: 0 0 0 var(--ground-deep); } */
```

Zero blur is the point: a blurred offset is a soft shadow pretending to be hard and reads as
neither. The collapse is the whole press mechanic — the object travels exactly the offset
distance so the shadow vanishes into the surface, which is what pressing a physical key looks
like. Coup currently has `active:scale-95` at 4 sites and nothing at all on cards, which are
the thing a player touches most. **Offset shadows appear only on pressables, only as a press
mechanic** — never on cards, panels, or decoration.

**Table furniture is debossed, never outlined.** The felt is milled, not drawn on:

```css
--deboss:
  inset 0 2px 3px rgba(0,0,0,.25),
  inset 0 -1px 0 rgba(255,255,255,.06);
```

This replaces every `rounded-xl border-2 border-gray-700` in §3.1. The 1px light line on the
*bottom* inside edge is the physics: a groove cut into a surface lit from above is dark at the
top and catches light at the bottom. Reverse it and the panel pops out instead of sinking in.

**Corner radius: 6px on cards, 2px on furniture and plates, 0 on stripes and rails.** Not
12px — that is an app card; not 0 on cards — that is a spreadsheet cell. Coup is currently
`rounded-xl` (12px) on nearly everything.

---

## 6. Motion budget

**Two world-stopping moments, one physical system underneath.**

Coup's two are:

1. **An influence revealed and lost.** The only irreversible thing that happens in this game.
2. **Victory.**

Everything else is the same flight engine with different parameters. There is no third
signature moment; if one appears, one of these two must give it up, because the reason these
two land is that nothing else has spent the attention.

The engine is one rAF clock and one transform contract
(`translate(--fx,--fy) rotate(--tilt) scale(--fs)`, translate outermost). Verbs differ only
in arc, spin, duration and delay — and they must differ, or a Steal feels like a Tax and the
player learns nothing from watching the table.

| Verb | Arc | Spin | Duration | Signature |
|---|---|---|---|---|
| **Deal / draw** | low, 14 | ±3° | 260ms, 64ms stagger | Comes off the deck pile, grows into the hand; `easeOutBack` on scale gives it a settle |
| **Take (Income, Tax, Foreign Aid, Embezzle)** | 18 | ±4° | 300ms | Deliberately plain. Coins travel from the treasury to the seat; the card does not move |
| **Strike (Coup, Assassinate)** | Coup: 0 (straight, fast). Assassinate: lunges **34%** of the way at the target and stops | 5° | 300ms | 34% is as far as a card can travel before it reads as a second flight rather than a threat. Coup arms hitstop; the target's seat takes the shake |
| **Take-from (Steal)** | 22, hero lift | ±6° | 340ms after a **120ms delay** | The delay is the tell — a theft you can see coming |
| **Swap (Exchange, Convert, Examine force-swap)** | mirrored **±34°** with a 60ms offset | ±8° | 380ms | Two cards passing each other, not one blur crossing the felt |
| **Refuse (Challenge, Block)** | the challenged card comes in fast; the loser's card is **shoved back** −0.22 | −9° | 280ms | Block is the same shove cut dead, no tail |
| **Fall (influence lost)** | 22 | ±26° tumble | 420ms | Lands face-up in the discard and **stays there** |

**Hitstop** — freeze the whole animation list for 45ms on contact, min 200ms between freezes,
paid for at launch so the timing budget is untouched. Armed on exactly three things: a
revealed influence landing face-up, a Coup card landing, a challenge resolving. Freezing the
whole list rather than the landing card is the difference between a card pausing and the
table taking a hit.

**Restraint is load-bearing, and it is directional.** Your card landing sparks; an opponent's
does not. An assassination aimed at *you* gets the flash and the shake; the same one aimed
elsewhere gets a small neutral ring. A table where every attack flashes red teaches nothing;
a table where only yours do is one you can read out of the corner of your eye.

---

## 7. Reduced motion

**Motion collapses to fades; sound and haptics stay.**

Under `prefers-reduced-motion` or `html.reduce-motion`, every flight becomes an opacity fade
of ≤120ms **that fires its landing cue in the same tick**. Do not hang the sound off the back
of a cosmetic ramp, because the ramp is exactly what was just removed.

The rule this enforces: **reduced motion must never mean reduced information.** A player who
asked for less motion must not become the one player at the table with no evidence anything
happened. Every state change legible through animation in the normal path must be legible
through some other channel in the reduced path — a cue, a haptic, a persistent visual state,
or a log line. Preferably all four.

Two non-obvious consequences:

- **The flash plate stays**, at 55% strength and 1.6× duration. It is opacity-only, so it
  reads as a light coming up rather than a hit. Remove it and you remove the only
  non-auditory signal that a Coup landed on you.
- **The current implementation is a blunt instrument.** `globals.css:547-555` sets
  `animation-duration: 0.01ms !important` on `*`, `*::before`, `*::after`. The instinct is
  right; the mechanism deletes information — a 0.01ms animation still *fires*, so anything
  keyed to `animationend` survives, but anything whose only output was the animation itself
  is gone with no substitute. Replace it with per-effect collapse rules once the motion
  system exists, gated by the Phase 7 test: **every cue that fires in the normal path fires
  in the reduced path, in the same tick.**

---

## 8. Ship gate

Checked against the build on **2026-08-08**. A box may only be ticked with the evidence
attached.

- [ ] **Remove the wordmark — does it still look like this specific game?**
      **No.** Strip `coup-online-banner-v2.webp` and what remains is a dark-teal background
      image behind `system-ui` text in Tailwind default colours. The identity is carried
      entirely by six raster portraits and one banner.
- [ ] **Grayscale the table — is hierarchy readable?**
      **UNMEASURED**, likely marginal: `--surface` `#17231F` and `--raised` `#22302B` differ
      by ~3 L\*, and every panel separation today comes from `border-gray-700`, which
      grayscales to nearly the value of the panels either side of it. **Measure:** screenshot
      mid-game at desktop and mobile, apply `filter: grayscale(1)`, record the L\* step for
      every adjacent furniture pair. Target ≥12 L\*, and no pair separated only by a stroke.
- [ ] **Every text token ≥4.5:1 on every ground it appears on.**
      **Contrast passes; tokenisation does not.** Swept 2026-08-09. Every sub-4.5:1 grey
      text utility in `src/app` is gone except four sites in files owned by a concurrent
      change (`ActionBar.tsx` ×2, `GameTable.tsx` ×1, `PlayerSeat.tsx` ×1).
      Counts (comments stripped): `text-gray-500` **70 → 3**, `text-gray-600` **19 → 1**,
      `text-gray-700` **2 → 0**, all replaced by `text-coup-ink-mute` `#9fada6` (91 uses).
      `.input-field`'s `placeholder-gray-500` → `placeholder-coup-ink-mute`.
      Ratios computed with the §2.3 formula, worst ground first:

      | Pair | before | after |
      |---|---|---|
      | secondary text on `--raised` `#22302b` | `#6b7280` **2.85** | `#9fada6` **5.90** |
      | secondary text on `--surface` `#17231f` | `#6b7280` **3.35** | `#9fada6` **6.94** |
      | secondary text on `--ground` `#090d0e` | `#6b7280` **4.04** | `#9fada6` **8.37** |
      | tertiary text on `--ground` | `#4b5563` **2.58** | `#9fada6` **8.37** |
      | tertiary text on `--raised` | `#4b5563` **1.82** | `#9fada6` **5.90** |
      | footer separators on `--ground` | `#374151` **1.89** | `#9fada6` **8.37** |
      | row text on `bg-gray-800` `#1f2937` (lobby icon buttons) | `#6b7280` **3.04** | `#9fada6` **6.29** |
      | `.input-field` placeholder on `--surface` | `#6b7280` **3.35** | `#9fada6` **6.94** |

      **Audited and deliberately left, because they already pass:** `text-gray-400`
      `#9ca3af` (97 uses) is **5.42** on `--raised`, **6.38** on `--surface`, **7.69** on
      `--ground`; `text-gray-300` `#d1d5db` (65 uses) is **9.34 / 10.99 / 13.25**. They are
      still un-tokenised, so the second half of this gate — "no un-tokenised colour survives
      to be measured" — is **open**: 162 grey text utilities remain that pass contrast but
      are not `--ink` / `--ink-mute`.

      `PracticeCoach`'s four tone grounds lost their stroke and gained 10 points of tint
      opacity in the same pass, so they were recomputed rather than assumed. Composited
      over `--ground` (the coach also carries `backdrop-filter: blur(10px)`, which is not
      modelled — these are the flat-composite numbers):
      gold `#d6a12a` on `#3c1805` **6.79** (was 7.01); blue `#93c5fd` on `#152149` **8.65**
      (8.91); red `#fca5a5` on `#3f0a0a` **8.79** (9.02); green `#6ee7b7` on `#03271f`
      **10.49** (10.80). All four still clear 4.5, as does the body copy on every one of
      them (`#ffffff` ≥15.6, `#d1d5db` ≥10.5). **Still not computed:** any text set over the
      card raster — §2.3 already flags it as UNMEASURED and this sweep did not change it.
      Regression gate: `tests/app/styleBudget.test.ts`.
- [ ] **Is the hand fully on-screen on a phone?**
      **UNMEASURED.** `GameTable.tsx:127` is `h-dvh … overflow-hidden`, so it cannot scroll —
      anything that does not fit is clipped, not reachable. **Measure:** 390×844 and 375×667
      at 2–6 players with a prompt open; record whether both local cards are fully visible.
- [ ] **Does every state class have a screenshot?**
      **No** — there is no screenshot corpus. Required: six characters × {hidden, known,
      revealed, selected}; the eight `TurnPhase` values; Classic and Reformation; 2/4/6
      players; both text-size settings; and each refusal reason `ActionBar.tsx:344-351`
      can produce.
- [ ] **`prefers-reduced-motion`: motion → fades, sound and haptics stay.**
      **Fails.** `globals.css:547-555` kills animation globally with no substitute, and
      haptics fire only on your own taps (24 call sites, all local).
- [ ] **Zero `border: 1px solid` / `border-2` on table furniture.**
      **Passes for panels; the proxy metric is still open.** Swept 2026-08-09, counts with
      comments stripped: `border-gray-*` **67 → 7**, and source lines carrying both a
      `rounded-*` and a `border` **94 → 59** (110 and 80 when this gate was written).
      Every panel now wears `.panel-sunk` (`globals.css`) — the §5 `--deboss` at the 2px
      furniture radius, composed through `--tw-shadow` so a caller's `ring-*` still lands:
      both modal shells, the game-over recap plates and row wells, the Log/Chat container,
      the stat tiles, the awards grid, the history well, the practice coach, the PWA
      prompt, the error banners and the tutorial callouts. Surviving hairlines (table row
      rules, section dividers) are tokenised to `--line` via `border-coup-line`, which §2.1
      permits: they are hairlines, not panel outlines.

      **The 7 remaining `border-gray-*`, and why:** `.btn-secondary` and `.input-field` in
      `globals.css` are **controls, not table furniture** — §3.1 is about panels and §5
      gives pressables their own hard-offset language, so they keep a stroke until §5 lands
      on them; the other 5 are in `ActionBar.tsx` (1), `GameTable.tsx` (3) and
      `PlayerSeat.tsx` (1), owned by a concurrent change during this sweep.

      **The 59 remaining `rounded-* + border` lines are not panels:** bordered pressables,
      `rounded-full` badge pills (§3.9's fix, not this one), tutorial card mock-ups (§5 puts
      cards at 6px with a paper shadow, and the frame belongs to `CardFace`), and the
      Reformation faction demo plates in `ReformationTutorial.tsx`, which must keep whatever
      language `PlayerSeat` uses or the tutorial stops teaching the shipped game.

      **Open, found during the sweep and not fixed:** the faction rails on the seat
      (`border-l-blue-400` / `border-l-red-400`) and `ring-red-500/30` on the ◆REF badge in
      `PlayerSeat.tsx` are a coloured seat border where a debossed rail belongs — a §1.2
      violation, listed here so it is not lost.
      Regression gate: `tests/app/styleBudget.test.ts`.
- [ ] **One source of truth for character colour.**
      **Fails.** Five duplicated per-character palettes (§1.1) plus a sixth hardcoded across
      the SVGs in `src/app/components/icons/`; `coup.duke`…`coup.contessa`
      (`tailwind.config.ts:15-19`) have **zero** usages.
- [ ] **All changing figures are monospace with `tabular-nums`.**
      **Fails.** `tabular-nums`: 0 usages. `font-mono` is on room codes and lobby settings,
      and on none of coins, deck count, treasury, or timer.
- [ ] **No functional system emoji in the UI.**
      **Fails.** 44 distinct, 75 uses. Player-chosen reactions are exempt (§3.3).
