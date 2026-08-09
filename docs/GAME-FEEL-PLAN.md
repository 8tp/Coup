# Game Feel Plan — Coup Online

Written 2026-08-08, after auditing Coup's current state against the juice/audio/motion
work in `~/chudopoly`.

**Verdict: not at parity.** Coup's *art* is ahead of chudopoly's (which has zero raster
assets by design). Everything downstream of the art — type, motion, impact feedback,
mix discipline, haptics — is between 0% and 40% of where chudopoly sits.

The important finding is that chudopoly's advantage is **not more effects**. It is that
every number in it is a measurement with the measurement written next to it, and every
rule has a stated reason. Copying its effects list without that discipline reproduces the
decoration and not the feel.

---

## 0. Scorecard

| Dimension | Coup | chudopoly | Note |
|---|---|---|---|
| Raster art / assets | **8** | 4 | Coup wins. chudopoly self-reports "custom visuals: 1, target ≥16" |
| Typography | 2 | 8 | Coup has *no* font system. Zero `next/font`, zero `@font-face` |
| Table presence / layout | 3 | 8 | Coup desktop is a phone column in a 1456px viewport |
| Motion system | 3 | 9 | Coup has scattered CSS keyframes; chudopoly has one clock + one transform contract |
| Impact FX | **0** | 9 | Coup has no particles, no shake, no flash, no floating text |
| Sound design | 4 | 9 | Good bones (bus, ducking, 3 mastered tracks), thin execution |
| Mix discipline | 2 | 9 | Coup's mix is *inverted* on the moments that matter (see §4) |
| Haptics | 2 | 8 | Coup only buzzes on your own taps |
| Input feel | 3 | 9 | No press pose, no refusal language |
| Measurement / gates | 1 | 9 | chudopoly can assert "loss is louder than shuffle" as a test |

---

## 1. The three systems Coup does not have at all

Everything else on this list is a refinement. These are absences.

1. **A type system.** The Midjourney wordmark is a rich display face; the UI beneath it is
   `system-ui`. That mismatch is the loudest thing on screen and the cheapest thing to fix.
2. **An impact layer.** No particles, no screen shake, no flash, no floating numbers. Every
   dramatic beat in Coup currently resolves as a text change.
3. **A measurement culture.** No way to assert that the influence-loss sting is louder than
   the coin sound, so it silently isn't (§4).

---

## Phase 0 — Write the law

**Half a day. Do this first; everything else checks against it.**

Create `ART-DIRECTION.md` as a binding document, the way chudopoly does. Coup already has
the raw material scattered across `docs/ASSETS.md` and the Midjourney prompt log — it just
isn't stated as rules with reasons.

It must state:

- **The thesis.** chudopoly's is "real printed cards on a real airfield apron… is that how
  paper, concrete, or paint behaves?" — a sentence you can check ambiguous decisions
  against. Coup's is somewhere near *screen-printed civic propaganda in a blackened-teal
  palace*. Write the actual sentence.
- **Colour vs material as two independent channels.** This is Coup's single worst
  structural collision and it is already live: five characters need categorical colour, and
  challenge/block/danger/your-turn need semantic colour, and they are currently fighting
  over the same 360°. Resolution: characters own **colour + a distinct glyph silhouette**;
  challenge/block/danger own a **material** (a ring outside the object, a hazard stripe, an
  ink slab) that no character can ever wear.
- **A motion budget.** chudopoly's is "two world-stopping moments, one physical system
  underneath." Coup's two should be **influence revealed/lost** and **victory**. Everything
  else — income, tax, exchange, convert — is the same flight engine with different arcs.
- **Two shadow languages.** Paper casts a soft drop shadow; painted chrome gets a hard
  offset with zero blur that collapses on `:active`. Never mix them.
- **A ship gate.** Remove the logo — does it still look like this specific game? Grayscale
  the table — is hierarchy still readable? Both themes ≥4.5:1 on every text token.

---

## Phase 1 — Look

### 1.1 Type — the highest-value single change

Currently: `src/app/layout.tsx` loads no font. Everything is `system-ui`.

Adopt three roles:

- **Display** — headings, the phase banner, player names, the game-over title. Something
  with the wordmark's weight and civic-poster geometry. Load via `next/font/local` so it
  self-hosts and there is no CDN dependency.
- **Body** — `system-ui` is fine here and is one fewer request.
- **Figures** — `ui-monospace` + `font-variant-numeric: tabular-nums` for **coins, deck
  count, treasury, timers, room codes**. chudopoly's note is exactly right: *"this is the
  character."* A coin counter that jitters its width as it ticks 2→10 reads as a webpage;
  one that holds its column reads as an instrument.

Earn hierarchy with size and weight, not tracking. Tracked uppercase micro-labels survive
in exactly one place — the `CAPTAIN / STEAL` plate on the card art.

### 1.2 Kill the emoji

There are roughly 40 distinct system emoji doing functional work: 🔇 🔊 in the header, ✅ ❌
🎭 ⚔ 💀 👑 throughout the action log, 🏆 💀 on the game-over screen, and the full award set.
Apple colour emoji sitting on painterly gouache reads as placeholder art.

Replace with a small inline-SVG glyph set drawn in one line language. Steal chudopoly's
technical-order rule: **exactly two stroke widths at a 2:1 ratio, square corners always
(`miter` joins, `butt` caps), never a gradient or blur, patterns rather than opacity for
tints.** A 45° dot-grid reads as the halftone screen it is imitating; `fill-opacity` just
reads as faded.

Roughly 14 glyphs covers it: challenge, block, pass, coup, assassinate, steal, exchange,
examine, convert, embezzle, coin, skull, crown, deck.

### 1.3 Fix the card frames

`CardFace.tsx` currently rings every card in a saturated Tailwind border —
`border-purple-500`, `border-green-500`, `border-blue-500`, `border-red-500`. Against the
muted art these read as debug outlines, and at 44px they are a third of the card's visual
weight.

Replace with a material treatment: a 1px `--card-edge` hairline inset ~2px from the trim,
plus a colour **band** along one edge carrying the character hue at low saturation. The
card announces which character it is with **art + glyph first, colour second**.

Revealed cards currently get `grayscale(0.6) + opacity(0.5)` plus a red hatch, which is
good. Keep the hatch; make it the hazard material defined in Phase 0 so it matches the
danger language everywhere else.

### 1.4 Make the cards bigger, and build a table

Opponent cards are `w-11 h-16` (44×64). Your hand is `w-14 h-20` (56×80). The best asset in
the project is illegible at that size.

`GameTable.tsx` is `max-w-lg lg:max-w-xl` — a phone column centred in a desktop viewport
with ~65% of the screen unused. And there is no *table*: the deck is 8px of text in the
header, there is no treasury, no discard, no seating.

Desktop should get its own layout, not a widened phone one:

- Seats arranged around a felt, not stacked in a grid of identical rectangles.
- A **physical deck pile** whose height tracks `deckCount`, so cards visibly come off it.
- A **discard area** where revealed influences land and stay.
- A **treasury** — Coup's coin pool is finite and in Reformation there is a literal reserve.
  Both should be objects on the table.

This is the largest single item on the plan and the one that makes every motion item in
Phase 2 possible, because flights need somewhere to fly from.

### 1.5 Texture and depth

The table background is already doing real work. Add:

- A grain layer (`feTurbulence` data URI) at low alpha, and a hairline contact shadow under
  every card — `0 0 0 1px rgba(0,0,0,.16)` hard against the trim. Paper lying on a surface
  has one; it is what separates the sheet from the surface before any value difference does.
- Zero `border: 1px solid` on table furniture. Panels are **debossed into** the surface
  (`inset 0 2px 3px rgba(0,0,0,.25), inset 0 -1px 0 rgba(255,255,255,.06)`), not outlined.
  Coup currently has ~9 rounded-rect-plus-1px-border panels per screen, which is the single
  clearest "this is a web app, not a table" tell.

---

## Phase 2 — Motion

### 2.1 One clock, one transform contract

Replace the scattered CSS keyframes in `globals.css` and `tailwind.config.ts` with a single
rAF loop and a fixed transform contract:

```
translate(var(--fx), var(--fy)) rotate(var(--tilt)) scale(var(--fs))
```

Translate outermost is load-bearing: adding `dx` to `--fx` moves the card's centroid by
exactly `dx` whatever its tilt or scale, which is what makes a measured FLIP exact rather
than approximately exact. Clamp `dt` to `[0, 1/20]` so a backgrounded tab doesn't teleport
a card. Quantise writes (0.1px / 0.1deg / 0.001 scale) and skip unchanged ones, so a settled
card costs zero writes per frame.

### 2.2 Easing — take these numbers directly

```js
const BACK = 0.9;          // position/rotation easeOutBack — 2.99% overshoot
const SCALE_BACK = 0.55;   // scale easeOutBack — 1.03%, free squash and stretch
```

chudopoly's finding: the classic `1.70158` back constant put a card 19px past its slot and
read as a bounce, not a landing. That constant overshoots **exactly 10%**, which is where the
19px comes from — 10% of a 190px travel. `BACK = 0.9` overshoots 2.99% and `SCALE_BACK = 0.55`
overshoots 1.03%. (Both figures were re-derived here: `peak = 1 + kv² − (k+1)v³` at
`v* = 2k/3(k+1)`. An earlier draft of this plan said 4.5% for `BACK`, carried over from the
research notes; it is 2.99%. The constants are unchanged — only the annotation was wrong.)
And putting `easeOutBack` on the **scale** axis costs
nothing and gives every landing a direction — a card growing (deck 26px → hand 62px)
overshoots and settles, a card shrinking (hand → a small slot) undershoots and springs open.
That is squash-and-stretch for one changed easing function.

### 2.3 Hitstop — best ratio of feel to code in the whole plan

```js
const HITSTOP_MS = 45;
const HITSTOP_MIN_GAP_MS = 200;
const CONTACT = 1 - BACK / (1 + BACK);   // 0.5263 — where easeOutBack crosses 1
```

Freeze the **whole** animation list, not just the landing card — that is the difference
between a card pausing and the table taking a hit. Subtract `HITSTOP_MS` from the flight's
duration at launch so it pays for itself and the timing budget is untouched. `MIN_GAP`
exists so a multi-card exchange is one heavy landing with the rest riding in behind it,
rather than five freezes reading as jank.

Arm it on: a revealed influence landing face-up, a coup card landing, a challenge resolving.

### 2.4 The press mechanic

Coup's buttons have `active:scale-95`; cards have nothing at all. Cards are the thing a
player touches most.

```css
@property --press-s { syntax: '<number>'; inherits: false; initial-value: 1; }
@property --press-y { syntax: '<length>'; inherits: false; initial-value: 0px; }

.card.is-pressed { --press-s: .955; --press-y: 2px;
  transition: --press-s 80ms cubic-bezier(.3,.8,.4,1), --press-y 80ms cubic-bezier(.3,.8,.4,1); }

@keyframes card-unpress {
  0%   { --press-s: .955; --press-y: 2px; }
  46%  { --press-s: 1.028; --press-y: -3px; }
  100% { --press-s: 1;     --press-y: 0px; }
}
.card.is-unpressing { animation: card-unpress 190ms cubic-bezier(.33,0,.2,1) both; }
```

Three things to keep: the press goes **down** (a card that gets smaller can never be clipped
by an `overflow:hidden` hand container); the release overshoot is stated explicitly rather
than derived from a back-out easing (a spring-back scales its overshoot by the delta, and
0.045 of delta produces a 0.4px pop that is arithmetically present and perceptually absent);
and each state declares its own timing mechanism, because a shared `transition` sits above
`animation` in the cascade and will silently delete the release keyframes.

### 2.5 Per-verb signatures

Coup's actions are currently all the same non-event. Give each a gesture:

| Action | Treatment |
|---|---|
| Assassinate | The action card **lunges 34%** of the way at its target, `dur 300, spin 5°`. 34% is as far as a card can lunge before it reads as a second flight rather than a threat |
| Coup | Slam. Straight, fast, `arc 0`, hitstop armed, the target's seat takes the shake |
| Steal | `delay 120ms` before it leaves — a theft you can see coming — then `speed 1.12`, hero lift |
| Exchange | **Mirrored arcs ±34° with a 60ms offset** so it reads as two cards passing each other, not one blur crossing the felt |
| Challenge | The challenged card comes in fast; the challenger's card is **shoved back** `-0.22`, `dur 280, spin -9°` |
| Block | Same shove, cut dead — no tail |
| Influence loss | Tumble to the discard, `spin ±26°, arc 22` |
| Income / Tax | Deliberately plain. Most beats get nothing |

### 2.6 Fix the challenge reveal overlay

`ChallengeRevealOverlay.tsx` is a full-screen `bg-black/70` with a card floating in the
void, on a hardcoded 1500/2500/3500ms timeline. It is the most dramatic moment in Coup and
it is spatially disconnected from the table.

The card should fly **from the accused player's seat**, land at centre with hitstop, and the
replacement should fly **to their seat from the deck pile**. Same beats, real geography.

### 2.7 Prompts should transition

`ActionBar`, `ChallengePrompt`, `BlockPrompt` et al. hard-swap. `.action-choice-enter`
already exists with a stagger var — apply it consistently and add an exit.

### 2.8 Reduced motion — collapse, never delete

`globals.css` currently sets `animation-duration: 0.01ms` globally under
`html.reduce-motion`, which is the right instinct. The rule to hold once Phase 3 exists is
chudopoly's: **motion collapses to fades; sound and haptics stay.** A player who asked for
less motion must not also be the one player with no evidence that anything happened. Flights
become a ≤120ms opacity fade *that still fires its landing cue in the same tick* — do not
hang the sound off the back of a cosmetic ramp.

---

## Phase 3 — Impact FX

Coup has none of this. Build it as `src/app/fx/`, lazily — importing it should cost two
array pushes, and no canvas, node, listener or clock subscriber should exist until the
first effect fires.

### 3.1 Write the tuning table before the code

chudopoly's `fx/index.js` opens with the entire cue→effect map as a comment table. Do the
same. A first draft for Coup:

```
event                     condition        particles                        flash    trauma  haptic
card_landed               yours            5–7 dots ø7 + contact ring       —        .16     land 10ms
card_landed               anyone else's    contact ring only, α.22          —        0       —
challenge_won             you won it       ring 12→52 brass + 6 dots        —        .20     —
challenge_lost            AGAINST YOU      flare ø62 + ring 10→86 crimson   red .30  .30     targeted
influence_lost            yours            12 crimson dots + "LOST" float   red .30  .34     targeted
influence_lost            anyone else's    6 grey puffs                     —        0       —
coup_landed               against you      flare + ring, crimson            red .38  .45     targeted
assassinate_blocked       involving you    4-arm spark cross + "BLOCKED!"   steel.16 .30     targeted
coins_changed             yours            —  (float only: +N brass / −N crimson)   0        —
player_eliminated         any              14 grey settle puffs             —        .22     —
game_over                 you won          380 confetti 3.2s + 130 at +1.5s gold .30 .60     win
game_over                 someone else     150 confetti, 2.6s               gold .12 .26     —
```

Two rules carry this table:

- **Restraint is load-bearing.** Most beats get nothing. Your card landing sparks;
  everyone else's does not. Opponents' turns are quiet, and Coup's three loud moments — a
  challenge resolved against you, losing an influence, the win — stay loud *because nothing
  else has spent the attention.*
- **Red only for the victim.** An assassination aimed at you gets the flash and the shake;
  the same assassination aimed at someone else gets a small neutral ring. A table where
  every attack flashes red teaches the player nothing; a table where only theirs do is one
  they can read out of the corner of their eye.

### 3.2 Particles — one canvas, pooled

A win throws ~380 confetti. As DOM that is 380 nodes laid out, painted and composited every
frame on top of the existing card nodes; on a 390×844 DPR3 phone that is the frame budget
gone. One canvas is one composited layer whose cost is fill-rate, which is the thing a phone
GPU has spare.

- `CAP = 600` preallocated struct-of-arrays (`Float32Array`), zero allocation in
  update/draw, death by swap-with-last, spawn on a full pool **dropped not queued**.
- `DPR_CAP = 2`, `getContext('2d', { alpha: true, desynchronized: true })`.
- Sprite atlas drawn once into offscreen canvases. Five kinds: dot, glint, puff, ring,
  confetti.
- **Dots need a plateau core, not a gaussian** — chudopoly measured that with a gaussian
  shoulder the visible core of an 8px dot was ~2px and the burst simply did not exist
  against a textured background. Coup's table art is at least as busy.
- **Rings are a stroked annulus, two strokes not one** — a wide band at 45% alpha carrying
  the energy plus a 1.6px filament at full alpha carrying the edge. A soft radial smear
  vanishes against any busy surface.
- Two draw passes (`source-over` for confetti/puffs, `lighter` for dots/glints/rings), not
  per-particle composite toggling — that cost 0.9ms/frame at 380 pieces.

### 3.3 Screen shake — trauma model

```js
const DECAY = 1.5;         // trauma/s
const CAP = 0.75;
const MAX_X = 15, MAX_Y = 11, MAX_R = 1.1;   // at trauma 1
const FREQ = 26;           // Hz — below ~18 reads as a wobble, above ~34 as noise
const MIN_TRAUMA = 0.141;  // sqrt(0.30/15) — refuse anything below the write quantisation
const LAND_CEILING = 0.34; // routine landings must never out-shake the win
```

Displacement is **trauma²**, so a small trauma is genuinely small — that is the difference
between juice and nausea. Three decorrelated noise channels with phase offsets `+0/+31.3/
+77.1`; equal seeds put x and y on the same line and it reads as a single diagonal.

Apply it to the **table container only** — not the viewport, not the whole game screen. In
Coup the phase banner, the action bar and your hand are siblings of the table, and shaking
them makes a challenge prompt unreadable at the exact moment you have to answer it.

Remove the transform entirely at trauma 0 rather than setting `none`, so at rest the
stacking tree is identical to a build without FX.

### 3.4 Flash plate

One full-viewport div on `mix-blend-mode: screen`. A crimson wash at 0.3 alpha over the dark
teal table is a grey wash; `screen` keeps the table's own value structure and only lifts it.
Radial gradients re-centred on the epicentre of the beat. Envelope: attack in the first 8%,
then a **squared** release — an instant-on flash on a 60Hz panel is one frame of white and
reads as a dropped frame.

Under reduced motion the flash **stays** at 55% strength and 1.6× duration. It is
opacity-only, so it reads as a light coming up rather than a hit.

### 3.5 Floating text

Coup already has `CoinChangeBurst`, which is a decent start but is scoped inside a seat and
gets clipped. Promote it to a real floater layer (DOM, not canvas — it is real text at real
sizes and must stay crisp on DPR3):

- `RISE = 46px` over `LIFE = 0.9s`, eased `1-(1-u)³`.
- **The fade holds for the first 45%** then falls on `^1.4`. The number has to be *read*,
  and a linear fade over 900ms is legible for about 300ms of it.
- **Keep-out band** between the phase banner's bottom and your hand's top. A `−3` that lands
  on the coin counter it is describing is worse than no float at all.
- **Anti-collision stacking** at 44px on Y / 120px on X — Coup pays multiple players in one
  beat during a Coup or an Embezzle.
- Measure the node's half-width rather than assuming it. Coup's shouts — `CAUGHT BLUFFING!`,
  `BLOCKED!` — are long, anchored on a seat, and centred with `translateX(-50%)`.
- Suppress entirely while the game-over overlay is up.

### 3.6 The two-channel hold

Cues know *where* (a card landed at x,y). Events know *who* (you were the victim). A
`challenge_resolved` cue cannot know direction, so hold the beat for exactly one event
dispatched in the same synchronous task; if none arrives, the neutral form plays on the next
tick. Coup's `useSoundEffects.ts` already diffs game state for the event side — the cue side
is what's missing.

---

## Phase 4 — Sound

`SoundEngine.ts` has genuinely good bones: a real master/sfx/music bus, gain ramping,
music ducking, buffer caching, mobile unlock, and three mastered ElevenLabs tracks. What it
lacks is discipline.

### 4.1 The mix is inverted — fix this first

Current gains, straight from the source:

| Sound | Peak gain | Duration |
|---|---|---|
| `influenceLoss` | **0.15** | 0.35s, one sine 300→150Hz |
| `coinsGained` | 0.10 | 0.15s |
| `cardShuffle` | 0.12 | 0.15s noise burst |
| `timerWarning` | 0.12 | 0.06s |

**Losing an influence — the only irreversible thing that happens in Coup — is 2dB louder
than shuffling the deck and 3.5dB louder than a coin tick.** This is exactly the inversion
chudopoly found and fixed. Adopt the five-tier rule:

```
tier 0  the game turned      gameOverWin  gameOverLose  playerEliminated
tier 1  you lost             influenceLoss  challengeRevealFail  block(against you)
tier 2  a play resolved      coup  challengeRevealSuccess  assassinationAlert  exchange
tier 3  cards being handled  cardShuffle  actionDeclared  coinsGained  coinsLost
tier 4  chrome               timerWarning  chatMessage  reaction  yourTurn
```

Every routine sound must sit below every loss. Apply the trims in **one place** — a
`MIX_DB` table read by `play()` — so a future offline render and the live mix cannot
disagree.

### 4.2 Add a compressor and a soft clip

The bus is currently `sfxGain → masterGain → destination` with no protection. Add:

```js
comp: { threshold: -14, knee: 6, ratio: 12, attack: 0.004, release: 0.16 }
softClip: softClipCurve(2048, 0.7), oversample: 'none'
```

The soft clip is the point: a `WaveShaper` clamps its input to [-1,1] before table lookup,
so output cannot exceed `0.7 + 0.3·tanh(1) ≈ 0.933` = **−0.6 dBFS**. "No clipping" becomes
an invariant of the graph rather than a mixing opinion. `oversample` must stay `'none'` —
oversampling filters ring, and ringing overshoots the table maximum.

### 4.3 Randomise, or it fatigues

Every sound in `sounds` is byte-identical every time it fires. Coup plays `coinsGained` and
`actionDeclared` dozens of times a game.

- Seeded pitch jitter of ±2–3% on the fundamental.
- **Noise slices from a shared buffer at a random offset** rather than a fresh buffer per
  call. This is what stops five dealt cards sounding like one click repeated, and it is
  free — Coup currently allocates and fills a new `AudioBuffer` on every `noiseBurst`, which
  is both louder-sounding and more expensive.

### 4.4 Mine vs theirs

One function, the only place the treatment lives:

```
mine   → unity gain, centred, unfiltered
theirs → -6dB, pan ±0.34 (seeded per player), detune 0.994 (≈ -10 cents), lowpass 5.2kHz
```

The lowpass is what makes it sit *behind* yours rather than merely quieter. Resolve "mine"
from the event (`actorId | targetId | blockerId | challengerId === myId`), not from a flag
the caller passes — with the override that for `influenceLoss` and `coinsLost`, only the
**victim** is "mine".

Right now Coup mostly solves this by playing nothing at all for bystanders, which leaves the
table silent during opponents' turns. Quiet is correct; silent is not.

### 4.5 Voice budget, rate limits, flam attenuation

- `MAX_VOICES = 32` weighted units, plus a **priority tier that bypasses the cap** — a win
  sting dropped for budget reasons is a bug the player cannot un-hear.
- Rate floors set **under the smallest real animation gap**, not the average one. Once
  Phase 2's stagger table exists, derive them from it.
- **Flam attenuation instead of deletion**: repeats within 190ms play at `[0, −2.5, −4.5,
  −6]` dB. A two-card exchange must read as two cards, not one card at 2× amplitude.

### 4.6 Make defeat the inverse of victory

Coup already ships separate mastered stingers, which is most of the way there. But the synth
fallbacks are both plain arpeggios in the same direction family — `gameOverWin` rises
523/659/784/1047, `gameOverLose` falls 440/370/311. Invert at every joint instead:

| win | lose |
|---|---|
| rising major | falling minor |
| sawtooth, bright | square through a 620Hz lowpass, muted |
| filter opens on each attack | filter closes through each note |
| notes 90ms apart, urgent | notes 150/170/210ms apart, slowing |
| a fifth ringing over the end | the last note **sags a semitone flat** |

The sag is the thing that reads as loss: a held pitch that will not stay up.

### 4.7 Duck on meaning, not activity

`duckMusic()` is currently triggered from a hardcoded `if/else` chain on sound id. Make it
weight-driven: only priority stings dip the bed, at 3–6dB depending on weight, 25ms attack
and 280–600ms release. A coin tick ducking the music once per 100ms is a pumping bed; the
point is that music yields to *meaning*.

### 4.8 Loop the music properly

`velvet-court.mp3` is a 68-second loop with hand-crossfaded handles, which is better than
most. If more tracks land, adopt the method: find the interior loop region by spectral-flux
search, and size the crossfade so `period − xfade` is a **whole number of beats** in the
source. 500ms out is a flam, and a flam is the one artifact a listener names instantly.

And once there is more than one track: **exclude the previous pick**. A fair coin over two
beds plays the same one twice half the time, which *is* "there is only one track." The same
rule applies to Coup's bot emote pool.

---

## Phase 5 — Haptics

`src/app/utils/haptic.ts` has two patterns (`haptic` 50ms, `hapticHeavy` [50,70,50]) and is
called from ~24 files — **all of them on your own tap.** Being assassinated, losing a
challenge, and being eliminated produce nothing.

Build a vocabulary and a priority ladder:

```js
pickup:        6,                    // priority 0
land:          10,                   // priority 0
denied:        12,                   // priority 1
targeted:      [30, 40, 30],         // priority 2 — something is being done TO you
goodThing:     [20, 30, 20],         // priority 3 — same shape, tighter
influenceLost: [50, 70, 50, 70],     // priority 4
win:           [40, 60, 40, 60, 200] // priority 5
```

`targeted` and `goodThing` are the same shape at different tightness deliberately — so a
good beat and a bad beat are distinguishable **through a pocket**.

Then the rule that matters: a 300ms floor that is **priority-aware**. chudopoly's flat
first-one-wins gate collapsed the whole vocabulary — 16 haptics in a 150s game, *all* of
them the 10ms `land`, across 7 set completions and 3 steals, because the cheap tick always
arrived first. A higher-priority pattern must beat the floor and replace what is playing
(`navigator.vibrate` replaces, it does not queue), then re-arm the floor from itself.

Fire on incoming events: targeted by Coup/Assassinate/Steal/Examine, challenge resolved
against you, influence lost, eliminated, game over.

---

## Phase 6 — Input feel

### 6.1 Refuse out loud

Coup disables buttons and adds a `title`. chudopoly measured that the disabled-button
version produced **zero** refusal sounds in a full game.

Keep controls live and refuse audibly: a `denied` cue, a 320ms shake
(`0/-6/+5/-4/+3/-2/0` px on `cubic-bezier(.36,.07,.19,.97)` — over before the second tap
lands), a 12ms haptic, and **a sentence**. "You need 7 coins to Assassinate" is a sentence;
a greyed button is a shrug. Cards can't shake (their transform is owned by the flight
engine), so cards get a flash instead.

### 6.2 Mark illegal targets, don't just unmark them

During target selection Coup lists valid targets and omits the rest. Reformation makes this
worse — same-faction players simply are not offered, with a line of explanatory text below.

Render every player, and desaturate the ineligible ones to 35% with an explicit
`data-target-illegal` attribute. The illegal half is the half that answers *"why can't I
click there."*

### 6.3 Acknowledge the press within one frame

Paint the press pose and fire the pickup cue synchronously inside `pointerdown`, not on
`click`.

---

## Phase 7 — Gates

The thing that makes all of the above stay true.

- **Offline audio render in Vitest.** Render every sound through the *same* `buildGraph` via
  `OfflineAudioContext` and assert the tier ordering: `influenceLoss` is louder than
  `cardShuffle`; `challengeRevealFail` is louder than `coinsGained`; peak ≤ 0 dBFS; no
  priority voice was ever dropped. One graph implementation, so the test cannot measure a
  mix the player never hears.
- **A cue log.** Under a harness flag, record every cue and haptic instead of playing it.
  Then "every started flight resolves" and "no beat fires two haptics" become assertions
  rather than hopes. chudopoly found 14 unanswered card-slide sounds per game this way.
- **A reduced-motion pass.** Assert that every cue that fires in the normal path also fires
  in the reduced path, in the same tick.

---

## Sequencing

| Phase | Effort | Unlocks |
|---|---|---|
| 0 — Write the law | 0.5 day | Everything checks against it |
| 1.1 Type + 1.2 emoji | 1–2 days | The largest visible change for the least work |
| 4.1 Mix tiers + 4.2 bus | 0.5 day | Fixes an actively wrong thing |
| 5 Haptics | 0.5 day | Cheap, and currently absent where it matters most |
| 1.3 Card frames | 1 day | |
| 2.1–2.4 Motion core | 3–4 days | Prerequisite for hitstop, FX, per-verb work |
| 3 FX layer | 4–5 days | The single biggest absence |
| 1.4 Table layout | 4–5 days | Largest item; makes flights have somewhere to go |
| 2.5–2.7 Per-verb + reveal | 2–3 days | Needs 2.1 and 1.4 |
| 4.3–4.7 Sound depth | 2–3 days | |
| 6 Input feel | 1–2 days | |
| 7 Gates | 2 days | Keeps it all true |

**Do the first four rows in one week.** They are cheap, independent, and together they close
most of the perceived gap.

---

## What NOT to copy from chudopoly

- **Its asset strategy.** chudopoly is zero-binary-assets by policy and its own ship gate
  records "custom visuals: 1, target ≥16" and "grayscale: fails." Coup's generated art is a
  real advantage. Copy the *method*, not the look.
- **Its exact palette.** Blackened teal and crimson enamel is Coup's world; airfield concrete
  and cobalt is chudopoly's. The rule to copy is *colour and material are two independent
  channels*, not the specific hues.
- **Animating the recap numbers.** chudopoly's own rule: *"a number that animates claims it
  just changed; a record being consulted did not."* `GameOverOverlay`'s stats should deal in
  as rows (70ms stagger), but the figures themselves should not count up.
- **Drag-and-drop.** Coup is a tap game. The exponential-smoothing weight recipe is only
  worth porting if cards ever become draggable.
