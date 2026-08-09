# Audio mix

The levels in `src/app/audio/SoundEngine.ts` are measured, not estimated. This file
records what was measured, how, what the numbers mean, and what is still unmeasured.

Measured on **2026-08-10**, Chrome 151.0.0.0 / macOS, `OfflineAudioContext` 2ch @ 48 kHz.
Committed as data in `tests/app/audio/measurements.ts` and gated by
`tests/app/audio/mix.test.ts`.

## The rule

**Consequence tracks loudness.** Every routine sound sits below every loss.

| tier | what it is | cues |
|---|---|---|
| 0 | the game turned | `gameOverWin` `gameOverLose` `playerEliminated` |
| 1 | you lost | `influenceLoss` `challengeRevealFail` `block` |
| 2 | a play resolved | `coup` `challengeRevealSuccess` `assassinationAlert` `exchange` |
| 3 | cards being handled | `cardShuffle` `actionDeclared` `coinsGained` `coinsLost` |
| 4 | chrome | `timerWarning` `denied` `chatMessage` `reaction` `yourTurn` `blockOpportunity` `challengeWindow` |

The tier of each cue is `MIX_TIER` in `SoundEngine.ts` — data, so a test can catch it
being wrong. The trim is `MIX_DB`, applied in `voiceGain()` and nowhere else.

## What the columns mean

Three numbers per cue, because one is not enough.

- **peak** — true peak dBFS over the whole render. What the ceiling is about.
- **loud** — the loudest 300 ms sliding-window RMS. **This is the ordering axis.**
- **rms** — RMS over the cue's own active window, from the first sample within 45 dB
  of peak to the last. Recorded, not gated.

Peak is not loudness. A 150 ms bandpassed noise swish carries 18.6 dB of crest and a
sustained 300→150 Hz sine carries 7.1 dB, so ranking by peak puts the deck shuffle above
a lost influence that any listener hears as louder. That is the failure chudopoly's audio
gate shipped — a peak-vs-peak assertion reading PASS on a build whose owner could not
hear the music — and it is why the tier ordering here runs on `loud`.

Active-window RMS cannot carry the ordering either: it is a function of how long a cue
rings. `gameOverLose`'s mastered clip measures −26.23 dBFS on active RMS and −17.02 on
`loud`, because 6 seconds of ring-out drags the average down. Its synth fallback, 1.3 s
long, measures −19.42 / −17.01. On active RMS the two look 6.8 dB apart; on `loud` they
are 0.01 dB apart, which is the truth. So `rms` is recorded for shape and `loud` is gated.

## The measured mix

Trim is `MIX_DB`; all levels are dBFS at the graph output, at the shipped trim.
`lim` is how much gain reduction the master compressor + soft clip apply — 0 means the
chain is linear there and `MIX_DB` alone is setting the level.

| tier | cue | trim | peak | loud | rms | lim |
|---|---|---:|---:|---:|---:|---:|
| 0 | `gameOverWin` (clip) | −2.8 | −4.61 | **−17.15** | −20.48 | 1.54 |
| 0 | `gameOverWin` (synth) | −2.8 | −5.63 | **−17.07** | −18.76 | 0.42 |
| 0 | `gameOverLose` (clip) | −5.0 | −7.23 | **−17.02** | −26.23 | 0 |
| 0 | `gameOverLose` (synth) | −5.0 | −8.58 | **−17.01** | −19.42 | 0 |
| 0 | `playerEliminated` | −3.0 | −10.46 | **−17.04** | −18.17 | 0 |
| 1 | `influenceLoss` | −1.9 | −11.86 | **−18.97** | −19.58 | 0 |
| 1 | `challengeRevealFail` | −2.1 | −10.46 | **−18.99** | −21.49 | 0 |
| 1 | `block` | +5.6 | −4.13 | **−21.13** | −18.07 | 2.11 |
| 2 | `exchange` | −4.3 | −10.18 | **−23.05** | −21.99 | 0 |
| 2 | `assassinationAlert` | −2.3 | −12.75 | **−23.00** | −23.74 | 0 |
| 2 | `coup` | −12.9 | −13.08 | **−22.97** | −25.79 | 0 |
| 2 | `challengeRevealSuccess` | −5.6 | −13.80 | **−22.97** | −24.91 | 0 |
| 3 | `coinsGained` | −0.7 | −14.20 | **−24.97** | −21.93 | 0 |
| 3 | `coinsLost` | −0.4 | −14.00 | **−26.42** | −23.39 | 0 |
| 3 | `actionDeclared` | −0.3 | −13.93 | **−29.06** | −23.29 | 0 |
| 3 | `cardShuffle` | +1.2 | −14.01 | **−32.58** | −29.53 | 0 |
| 4 | `timerWarning` | −9.4 | −21.67 | **−34.56** | −27.54 | 0 |
| 4 | `chatMessage` | −7.4 | −22.85 | **−34.57** | −30.56 | 0 |
| 4 | `reaction` | −7.6 | −21.13 | **−34.60** | −28.83 | 0 |
| 4 | `yourTurn` | −15.9 | −25.89 | **−34.60** | −33.79 | 0 |
| 4 | `challengeWindow` | −13.7 | −24.10 | **−34.61** | −34.58 | 0 |
| 4 | `blockOpportunity` | −11.2 | −26.92 | **−34.64** | −33.28 | 0 |
| 4 | `denied` | −12.0 | −21.56 | **−34.64** | −29.32 | 0 |

Tier boundaries on `loud`, quietest-above minus loudest-below:

| boundary | margin |
|---|---:|
| 0 / 1 | 1.82 dB |
| 1 / 2 | 1.84 dB |
| 2 / 3 | 1.92 dB |
| 3 / 4 | 1.98 dB |

`denied` (added 2026-08-10) is the only new row. The whole bank was re-rendered
with it and every other figure came back byte-identical, so the boundaries are
unchanged. It was deliberately solved onto the **floor** of tier 4 rather than
into the middle: tier 4 tops out at `timerWarning`, −34.56, and the 3/4 margin
is only 1.98 dB, so a new chrome cue landing anywhere above `timerWarning`
would have eaten the boundary. At −12.0 it sits level with `blockOpportunity`
and the margin is exactly what it was. **No other trim moved.**

`denied` is played from `ActionBar.tsx` through a single `DENIED_SOUND`
constant, which pointed at `timerWarning` while no refusal voice existed.

On peak, the headline rule holds too: the quietest loss (`influenceLoss`, −11.86) stabs
2.07 dB above the hottest routine cue (`actionDeclared`, −13.93).

## The ceiling

The soft clip is a `WaveShaper`, and a `WaveShaper` clamps its input to [−1, 1] before the
table lookup, so its output cannot exceed `curve[last]` = `0.7 + 0.3·tanh(1)` = 0.92848 =
**−0.645 dBFS**. That is a property of the graph, not a mixing opinion. The render
confirms the arithmetic.

The hottest single cue is `gameOverWin`'s mastered clip at −4.61 dBFS — **3.97 dB of
headroom**. The hottest realistic two-cue beat is `exchange` + `cardShuffle` at −6.92 dBFS.
Nothing is close to the ceiling and nothing is being levelled by the limiter: the worst
single-cue gain reduction is 2.11 dB (`block`) and the worst pair is 0.04 dB.

## Two cues in one beat

Beats a real game produces, rendered as one summed pass:

| beat | peak | loud | lim |
|---|---:|---:|---:|
| `challengeRevealFail` + `cardShuffle` @400 ms | −10.46 | −18.88 | 0 |
| `challengeRevealFail` + `influenceLoss` @120 ms | −6.79 | −16.10 | 0.04 |
| `influenceLoss` + `playerEliminated` @150 ms | −7.71 | −15.63 | 0.01 |
| `coup` + `influenceLoss` @250 ms | −10.30 | −18.71 | 0 |
| `exchange` + `cardShuffle` @0 ms | −6.92 | −22.58 | 0.02 |
| `cardShuffle` ×2 @90 ms (multi-card exchange) | −14.01 | −29.74 | 0 |
| `coinsGained` + `actionDeclared` @60 ms | −10.25 | −23.53 | 0 |
| `denied` ×2 @90 ms (double-tap on a refused control) | −21.56 | −31.63 | 0 |

The double-tap is the tightest a real one can be: `RATE_DEFAULT` drops a repeat
inside 80 ms, and 90 ms is still inside `FLAM_WINDOW`, so live the second tap
arrives at `FLAM_DB[1]` = −2.5 dB. The render gives both taps full gain, which
makes that row an upper bound rather than a picture — and even so its peak is
identical to one tap (−21.56), because at 90 ms the two do not overlap at all.

None of them sums into the limiter. Before the retune, `influenceLoss` + `playerEliminated`
took 6.81 dB of gain reduction and `challengeRevealFail` + `influenceLoss` took 6.26 dB —
the compressor, not the mix, was deciding how loud an elimination landed.

## Timbre, not level

Level is only half of "this cue is right", and the gate above only measures level.
`timerWarning` stood in for a refusal for a whole release at exactly the correct
tier-4 weight and entirely the wrong shape — right number, wrong sound — and no
assertion here could have caught it.

So `MEASURED_CONTRAST` records octave-band energy **normalised to each cue's own
total**. These figures say nothing about how loud a cue is and everything about
what it sounds like; they survive a retune of the trims. Bands are the ISO octave
centres; `low` is everything under 160 Hz; `centroid` is the power-weighted mean
frequency.

| cue | active | 63 | 125 | 250 | 500 | 1k | 2k | 4k | 8k | low | centroid |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `denied` | 88.1 ms | −29.4 | −16.4 | **−1.0** | −8.8 | −14.2 | −22.7 | −38.3 | −56.1 | −19.0 | 320 Hz |
| `timerWarning` | 59.6 ms | −89.7 | −82.6 | −74.8 | −65.5 | **−0.8** | −10.4 | −14.8 | −14.7 | −82.8 | 1561 Hz |
| `influenceLoss` | 346.5 ms | −113.2 | −32.1 | **0.0** | −82.8 | −107.9 | −104.7 | −101.2 | −94.8 | −51.5 | 237 Hz |
| `challengeRevealFail` | 714.8 ms | **−2.1** | −4.1 | −19.2 | −22.0 | −29.1 | −35.0 | −38.6 | −41.8 | −0.3 | 105 Hz |

Read across, that is four separations and each one is gated:

- **Duration.** 88 ms against 346 and 715 — 3.9× and 8.1× shorter. A refusal that
  lingers reads as damage already done.
- **Buzz vs tone.** `influenceLoss` is a bare sine: one octave band holds
  everything and the runner-up is 32.1 dB down. `denied` is a square behind a
  filter and spreads across three bands within 14.2 dB. A filtered square and a
  pure falling tone are not the same object even at the same pitch.
- **Mid vs bass.** `challengeRevealFail` puts essentially all of itself under
  160 Hz (−0.3 dB of its own total, centroid 105 Hz). `denied` puts ~1 % there
  (−19.0 dB, centroid 320 Hz). No chest, so no dread.
- **Closed vs open.** Against the `timerWarning` it replaces, the 1400→760 Hz
  lowpass drops the centroid from 1561 Hz to 320 Hz — a muted buzzer behind a
  door instead of an alarm in the room.

The FFT behind these is hand-rolled in `tests/app/audio/analysis.ts` (no new
dependency for a mix measurement) and is itself tested against signals whose
spectrum is known in advance, in `tests/app/audio/analysis.test.ts`.

## The mastered stingers and their fallbacks

`HERO_CLIPS` plays a mastered mp3 and falls back to the synth voice when the fetch fails.
Both go through the same head, so `MIX_DB` sets the pair's level and the clip's pre-trim
`gain` sets the clip **relative to its fallback**. Those two gains were solved for from
the render:

| cue | clip loud | synth loud | Δ | clip gain |
|---|---:|---:|---:|---:|
| `gameOverWin` | −17.15 | −17.07 | 0.08 dB | 0.808 (was 0.61) |
| `gameOverLose` | −17.02 | −17.01 | 0.01 dB | 0.557 (was 0.52) |

At the old gains the clips were 2.07 dB and 2.57 dB **quieter** than the fallbacks they
replace. Re-solve them whenever a tier-0 trim moves.

## What was wrong before

The previous trims were derived by summing oscillator gains on paper and were labelled
`UNMEASURED` in the source. Rendered, three of the four tier boundaries were inverted:

| boundary | margin as shipped |
|---|---:|
| 0 / 1 | **−5.64 dB** |
| 1 / 2 | **−7.82 dB** |
| 2 / 3 | +1.42 dB |
| 3 / 4 | **−8.84 dB** |

The worst individual case was `yourTurn` — tier 4 chrome — measuring −22.70 dBFS loud
against `cardShuffle` at −31.28 and `influenceLoss` at −10.09: a HUD prompt 8.6 dB above
the deck and only 12.6 dB under the only irreversible event in the game, where the tier
rule wants at least three boundaries between them. Five cues were also taking 3–5 dB of
limiting, so their level was being set downstream of `MIX_DB` entirely.

## The measurement trap this pass found

**Chrome's `DynamicsCompressorNode` applies an internal makeup gain — +6.5 dB for this
chain's settings — and it is not present at the first sample of a render.** It ramps in
over roughly 300 ms of context time, with or without input. A cue scheduled at t = 4 ms
therefore measures up to 6.5 dB quieter than the identical cue scheduled at t = 1 s, and
partially so *across* the cue, which biases short cues differently from long ones. Two
identical cues 60 ms apart rendered *louder than the arithmetic sum of their individual
peaks*, which is what exposed it.

The live context runs for the whole session, so the settled state is the real one.
`renderSoundOffline()` therefore renders `RENDER_PRE_ROLL_S` = 1.0 s of silence before
every cue. Verified stable: 0.5 s, 1 s and 2 s of pre-roll agree to 0.02 dB. A render
without pre-roll is not a measurement of this mix.

## Regenerating the measurements

The render happens in a real browser. `OfflineAudioContext` does not exist in Node, and a
Node reimplementation is a different compressor and a different `WaveShaper` — the ceiling
above is a Chrome number.

There is **one graph implementation**. `renderSoundOffline()` is exported from
`SoundEngine.ts` and calls `buildGraph()`, `startVoice()` and `voiceGain()` — the same
three functions the live `play()` path calls. There is no offline-only chain and no
offline-only copy of `MIX_DB`, so the harness cannot measure a mix the player never hears.

```sh
D=$(mktemp -d)
npx esbuild tests/app/audio/harness.entry.ts \
  --bundle --format=esm --target=es2022 --outfile="$D/harness.bundle.js"
cp tests/app/audio/harness.html "$D/"
ln -s "$PWD/public/audio" "$D/audio"     # the mastered stingers
python3 -m http.server 8137 --directory "$D"
```

Open `http://localhost:8137/harness.html`. The page renders on load and prints the JSON
report; it is also on `window.__COUP_REPORT`, and `window.__COUP_AUDIO.probe(id, opts)`
renders a single cue for ad-hoc work. Then:

1. Paste `rows` into `MEASURED` / `MEASURED_HERO_CLIP` in
   `tests/app/audio/measurements.ts`, `pairs` into `MEASURED_PAIRS`, and
   `contrast` into `MEASURED_CONTRAST`.
2. Update `MEASURED_TRIM_DB` and `MEASURED_HERO_CLIP_GAIN` to the values you rendered at,
   and `MEASURED_AT` to today.
3. `npx vitest run tests/app/audio`.

Renders are deterministic — the noise buffers are seeded per graph and the jitter is
rendered at nominal pitch, so two runs agree exactly. Retuning is a loop: change `MIX_DB`,
re-render, read the margins, repeat. Three passes converged here.

`MEASURED_TRIM_DB` is what makes this a gate rather than a snapshot. Change `MIX_DB`
without re-rendering and `mix.test.ts` fails immediately, because every level in the
recorded table now describes a mix nobody hears.

## Still unmeasured

- **The music bed.** `MUSIC_GAIN` (0.18) is untouched and was not rendered. The tier
  ladder is now 17.6 dB tall, and tier 4 sits at −34.6 dBFS loud, so the chrome cues may
  well sit under the bed. Cue-versus-bed is a separate measurement — chudopoly's gate does
  it as "a card sound clears every in-match bed by 6 dB in the cue's own loudest octave",
  and Coup has no equivalent assertion yet.
- **The `theirs` treatment.** Every cue was rendered as `mine`. `THEIRS_DB` (−6) is a flat
  offset on the same head, so it moves the whole ladder together and the ordering survives,
  but the 5.2 kHz lowpass's effect on loudness is not in the table.
- **Pitch jitter** (±2.5 %) — rendered at nominal pitch. `denied` is in
  `JITTERED`, for the same reason `block` is: a refusal a player triggers three
  times in a turn must not read as one click looped.
- **The flam ladder** (`FLAM_DB`) — rendered at run 0 only. The `denied ×2`
  pair renders *both* taps at run 0, so it bounds the real double-tap (whose
  second tap is attenuated 2.5 dB) rather than describing it.
- **Timbre outside the four contrast cues.** `MEASURED_CONTRAST` covers only
  the set where "these must never be confused" is a stated requirement. Nothing
  gates the shape of the other eighteen.
- **Safari and Firefox.** Their compressor makeup gain is not Chrome's, so every absolute
  dBFS figure here is a Chrome figure. The ordering is a property of the trims and should
  survive, but that has not been checked.
- **`softClip` at `oversample: 'none'`** is assumed, not asserted, by the render. The
  ceiling bound depends on it.

## Cues worth re-synthesising

Levels only were changed. Two voices are mis-synthesised for the job their tier gives
them, and were left alone:

- **`block` (tier 1)** is two triangle blips, 50 ms at 1200 Hz and 150 ms at 2400 Hz —
  148 ms of active audio with **13.7 dB of crest**. Giving a tier-1 event tier-1 loudness
  therefore costs +5.6 dB of trim and makes it the second-hottest peak in the bank
  (−4.13 dBFS) and the only cue taking more than 1 dB of limiting. A blocked action is a
  substantial event with a UI-tick voice. It wants a body, not a bigger number.
- **`cardShuffle` (tier 3)** is a 149 ms bandpassed pink burst with **18.6 dB of crest** —
  the highest in the bank. Its peak has to stay under the quietest loss, which pins its
  loudness at −32.58 dBFS, which in turn pins the whole chrome tier below −34.5. Roughly
  4 dB of the ladder's total height is this one cue's crest. A longer, more sustained
  shuffle would let tiers 3 and 4 come up.
