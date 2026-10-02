# Audio mix

The levels in `src/app/audio/SoundEngine.ts` are measured, not estimated. This file
records what was measured, how, what the numbers mean, and what is still unmeasured.

Measured on **2026-10-01**, HeadlessChrome 153.0.0.0 / macOS, `OfflineAudioContext`
2ch @ 48 kHz (first pass 2026-08-10 on Chrome 151 — every synth row that existed then
came back identical to 0.01 dB). Committed as data in `tests/app/audio/measurements.ts`
and gated by `tests/app/audio/mix.test.ts`.

**2026-10-02: the music.** The adaptive score replaced the looping beds; the music bus
gained an EQ and `MUSIC_GAIN` was re-solved 0.243 → 0.052 — see
[Cue over music](#cue-over-music). Every effects figure was re-rendered with it and came
back byte-identical: the effects path does not touch the music bus.

**Since 2026-10-01 almost every cue plays a recording.** ElevenLabs sound-generation
clips (`public/audio/sfx/`, `HERO_CLIPS` in `SoundEngine.ts`) cover all 22 cues, with
2–3 round-robin variants on the frequent ones; the synth voices remain as fallbacks.
Each clip's gain is *solved* onto its fallback's loudness, so the synth ladder below is
also the clip ladder — and the clips are gated again on their own, as shipped, because
a recording's peak and spectrum are its own. See [The shipped ladder](#the-shipped-ladder).

## The rule

**Consequence tracks loudness.** Every routine sound sits below every loss.

| tier | what it is | cues |
|---|---|---|
| 0 | the game turned | `gameOverWin` `gameOverLose` `playerEliminated` |
| 1 | you lost | `influenceLoss` `challengeRevealFail` `block` |
| 2 | a play resolved | `coup` `challengeRevealSuccess` `assassinationAlert` `exchange` |
| 3 | cards being handled | `cardShuffle` `cardDeal` `actionDeclared` `coinsGained` `coinsLost` |
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

This table is the **synth bank** — what each cue sounds like when its clip has not
loaded or failed to. It is the reference the clips are solved onto; the clips
themselves are in [the shipped ladder](#the-shipped-ladder).

| tier | cue | trim | peak | loud | rms | lim |
|---|---|---:|---:|---:|---:|---:|
| 0 | `gameOverWin` (clip) | −2.8 | −4.58 | **−17.08** | −20.41 | 1.59 |
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
| 3 | `cardDeal` | +0.7 | −13.66 | **−32.53** | −33.21 | 0 |
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
| 0 / 1 | 1.90 dB |
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

`cardDeal` (added 2026-10-01, the opening deal) went in on the same principle, at
the **floor** of tier 3: +0.7 puts it level with `cardShuffle`, so the 3/4 margin
did not move. Its synth fallback is four pink-noise flicks ~120 ms apart. Again **no
other trim moved** — the clips were solved onto the trims, not the trims onto the
clips.

On peak, the headline rule holds too: the quietest loss (`influenceLoss`, −11.86) stabs
1.80 dB above the hottest routine cue (`cardDeal`, −13.66; it was `actionDeclared`,
−13.93, at 2.07 dB before `cardDeal` existed).

## The shipped ladder

What a player hears when the fetch succeeds: every hero cue as each of its clip
variants, every other cue as its synth. Each clip's pre-trim `gain` in `HERO_CLIPS`
was **solved** in the browser render — render, compare its 300 ms loudness with the
fallback's, correct, repeat (5 passes, converges under 0.05 dB) — so clip and fallback
land on the same `loud`. Parity is now gated at **0.25 dB** (it was 1.5 dB when only the
two stingers had clips and their gains were hand-set).

| tier | cue | file | KB | ms | peak | loud | gain |
|---|---|---|---:|---:|---:|---:|---:|
| 0 | `gameOverWin` | court-crowned.mp3 | 110.7 | 7027 | −4.58 | −17.08 | 0.815 |
| 0 | `gameOverLose` | plot-unraveled.mp3 | 110.7 | 7027 | −7.23 | −17.02 | 0.557 |
| 0 | `playerEliminated` | playerEliminated.mp3 | 18.4 | 1500 | −7.77 | −17.04 | 0.360 |
| 1 | `influenceLoss` | influenceLoss.mp3 | 7.4 | 559 | −6.07 | −18.96 | 0.361 |
| 1 | `challengeRevealFail` | challengeRevealFail.mp3 | 8.6 | 664 | −6.08 | −18.99 | 0.364 |
| 1 | `block` | block.mp3 | 6.2 | 450 | −6.84 | −21.12 | 0.150 |
| 2 | `coup` | coup.mp3 | 6.2 | 460 | −9.09 | −22.97 | 0.989 |
| 2 | `challengeRevealSuccess` | challengeRevealSuccess.mp3 | 6.8 | 510 | −8.52 | −22.97 | 0.446 |
| 2 | `assassinationAlert` | assassinationAlert.mp3 | 6.8 | 505 | −8.59 | −22.99 | 0.328 |
| 2 | `exchange` | exchange.mp3 | 9.2 | 720 | −6.92 | −23.06 | 0.461 |
| 3 | `coinsGained` ×2 | coinsGained-1/2.mp3 | 5.9 / 4.9 | 420 / 350 | −9.89 / −9.90 | −24.95 / −24.96 | 0.200 / 0.201 |
| 3 | `coinsLost` ×2 | coinsLost-1/2.mp3 | 3.1 / 4.0 | 186 / 272 | −10.20 / −9.66 | −26.43 / −26.42 | 0.163 / 0.187 |
| 3 | `actionDeclared` ×3 | actionDeclared-1/2/3.mp3 | 2.5 / 2.2 / 3.7 | 144 / 121 / 260 | −9.71 / −11.08 / −9.86 | −29.08 / −29.04 / −29.05 | 0.176 / 0.159 / 0.196 |
| 3 | `cardDeal` | cardDeal.mp3 | 12.6 | 1000 | −9.91 | −32.51 | 0.149 |
| 3 | `cardShuffle` ×3 | cardShuffle-1/2/3.mp3 | 2.8 / 3.7 / 3.7 | 172 / 241 / 260 | −9.80 / −9.70 / −9.67 | −32.56 / −32.57 / −32.56 | 0.173 / 0.168 / 0.177 |
| 4 | `timerWarning` | timerWarning.mp3 | 2.2 | 120 | −10.74 | −34.56 | 0.536 |
| 4 | `chatMessage` | chatMessage.mp3 | 2.5 | 140 | −10.45 | −34.58 | 0.460 |
| 4 | `yourTurn` | yourTurn.mp3 | 7.7 | 579 | −23.77 | −34.61 | 0.252 |
| 4 | `challengeWindow` | challengeWindow.mp3 | 1.9 | 91 | −10.48 | −34.61 | 0.924 |
| 4 | `reaction` | reaction.mp3 | 4.3 | 300 | −13.91 | −34.61 | 0.303 |
| 4 | `denied` | denied.mp3 | 1.9 | 100 | −9.98 | −34.63 | 0.790 |
| 4 | `blockOpportunity` | blockOpportunity.mp3 | 2.5 | 134 | −10.01 | −34.64 | 0.708 |

All SFX clips together are 145 KB (mono, 96 kbps). Margins as shipped:

| boundary | margin |
|---|---:|
| 0 / 1 | 1.88 dB |
| 1 / 2 | 1.85 dB |
| 2 / 3 | 1.89 dB |
| 3 / 4 | 1.99 dB |
| stab: quietest loss peak (`playerEliminated`, −7.77) − hottest routine peak (`coinsLost` v2, −9.66) | 1.89 dB |

### Crest control — why the routine clips can sit on their tier

A recording's peak is its own. A coin clink or a card slap carries 20–28 dB of crest
(peak over 300 ms loudness) against 7–15 dB for the synth voices, so a clip solved onto
`coinsGained`'s −24.97 loudness would peak around −5 dBFS — **above every loss** — and
the stab rule would fail. `scripts/generate-sfx.ts` therefore caps each clip's crest
(`crestDb`) with a lookahead limiter in mastering, iterated (on a transient-dominated
clip the loudest 300 ms window *is* the transient, so one pass buys back only a
fraction) and checked on the **encoded** file (MP3 rings up to ~2 dB over a limited
transient). The caps are derived from the gate: after the solve, peak = loud + crest,
and every routine peak must sit 1.5 dB under the quietest loss —

| cue | loud | crest cap | resulting peak |
|---|---:|---:|---:|
| `coinsGained` | −24.97 | 15 | ≈ −9.9 |
| `coinsLost` | −26.42 | 16.5 | ≈ −9.9 |
| `actionDeclared` | −29.06 | 19 | ≈ −10 |
| `cardShuffle`, `cardDeal` | −32.5 | 22.5 | ≈ −10 |
| tier 4 | −34.6 | 24.5 | ≈ −10 |

The loss clips are not crest-limited for the gate; their natural crest (9–14 dB) is what
puts the quietest loss peak up at −7.77.

**A measurement trap found on the way:** `shortTermRms()` clamps its 300 ms window to the
buffer, so a 100 ms clip measured *bare* reads 10·log10(3) = 4.8 dB louder than the same
clip in the harness render, which has silence around it. The mastering script zero-pads
to 400 ms before measuring; the crest caps were wrong by exactly that much until it did.

## The ceiling

The soft clip is a `WaveShaper`, and a `WaveShaper` clamps its input to [−1, 1] before the
table lookup, so its output cannot exceed `curve[last]` = `0.7 + 0.3·tanh(1)` = 0.92848 =
**−0.645 dBFS**. That is a property of the graph, not a mixing opinion. The render
confirms the arithmetic.

The hottest single cue is `gameOverWin`'s mastered clip at −4.58 dBFS — **3.94 dB of
headroom**. The hottest realistic two-cue beat is now `influenceLoss` + `playerEliminated`
as clips, at −5.03 dBFS (it was `exchange` + `cardShuffle` at −6.92 with the synth bank).
Nothing is close to the ceiling and nothing is being levelled by the limiter: the worst
single-cue gain reduction is 2.11 dB (`block`'s synth fallback; its clip takes 0.03 dB),
the worst clip 1.59 dB (`gameOverWin`), and the worst pair 0.94 dB.

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
| `cardDeal` + `yourTurn` @300 ms (added 2026-10-01) | −13.66 | −31.95 | 0 |

The double-tap is the tightest a real one can be: `RATE_DEFAULT` drops a repeat
inside 80 ms, and 90 ms is still inside `FLAM_WINDOW`, so live the second tap
arrives at `FLAM_DB[1]` = −2.5 dB. The render gives both taps full gain, which
makes that row an upper bound rather than a picture — and even so its peak is
identical to one tap (−21.56), because at 90 ms the two do not overlap at all.

None of them sums into the limiter. Before the retune, `influenceLoss` + `playerEliminated`
took 6.81 dB of gain reduction and `challengeRevealFail` + `influenceLoss` took 6.26 dB —
the compressor, not the mix, was deciding how loud an elimination landed.

The same beats with every hero cue as its clip (variant 0) — the beats a player
actually hears — are `MEASURED_CLIP_PAIRS`, gated identically:

| beat (clips) | peak | loud | lim |
|---|---:|---:|---:|
| `challengeRevealFail` + `cardShuffle` @400 ms | −6.08 | −18.99 | 0.22 |
| `challengeRevealFail` + `influenceLoss` @120 ms | −5.52 | −18.29 | 0.47 |
| `influenceLoss` + `playerEliminated` @150 ms | −5.03 | −15.38 | 0.94 |
| `coup` + `influenceLoss` @250 ms | −6.07 | −18.96 | 0.22 |
| `exchange` + `cardShuffle` @0 ms | −6.92 | −23.06 | 0.02 |
| `cardShuffle` ×2 @90 ms | −9.80 | −29.53 | 0 |
| `coinsGained` + `actionDeclared` @60 ms | −9.60 | −23.55 | 0 |
| `denied` ×2 @90 ms | −9.98 | −31.62 | 0 |
| `cardDeal` + `yourTurn` @300 ms (new: the deal under the first turn chime) | −9.91 | −31.50 | 0 |

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

**The clips, `MEASURED_CLIP_CONTRAST`.** The four contrast cues all play recordings now:
a dull knock (`denied`), a wooden clock tick (`timerWarning`), a card slammed and torn
(`influenceLoss`), a card slap over a sinking timpani hit (`challengeRevealFail`).

| clip | active | 63 | 125 | 250 | 500 | 1k | 2k | 4k | 8k | low | centroid |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `denied` | 83.1 ms | −30.6 | −18.8 | −6.2 | **−2.5** | −7.4 | −21.1 | −36.7 | −33.2 | −21.0 | 552 Hz |
| `timerWarning` | 89.8 ms | −40.7 | −35.4 | −31.4 | −31.6 | −8.4 | **−1.1** | −14.4 | −14.7 | −35.4 | 1917 Hz |
| `influenceLoss` | 489.6 ms | −22.3 | −12.7 | −17.9 | −22.4 | −15.6 | −8.6 | −7.2 | **−2.9** | −12.3 | 5985 Hz |
| `challengeRevealFail` | 603.3 ms | −21.9 | **−0.6** | −9.6 | −17.5 | −28.6 | −35.6 | −41.5 | −38.9 | −0.6 | 121 Hz |

Every separation that is about the *object* rather than the synthesis method carries
over and is gated on the clips too: the knock is 5.9× / 7.3× shorter than the two losses;
the caught bluff is bass (−0.6 dB under 160 Hz) and the refusal has none (−21.0 dB, 350 Hz
highpass in mastering — the "no chest" rule); the refusal is closed (552 Hz) against the
tick (1917 Hz). The one test that does not transfer is "buzz vs tone" — `influenceLoss`'s
recording is broadband paper, not a sine — so the clip gate asserts instead that it lives
in a different region of the spectrum from the knock (centroid 5985 Hz vs 552 Hz, >4×).

## Hero clips and their fallbacks

`HERO_CLIPS` plays a mastered mp3 and falls back to the synth voice when the clip is not
decoded. Both go through the same head, so `MIX_DB` sets the pair's level and the clip's
pre-trim `gain` sets the clip **relative to its fallback**. Every gain is solved, never
chosen (`npx tsx scripts/render-audio-mix.ts solve --apply`).

Three rules govern which one plays (`SoundEngine.play()`):

- **Decoded → the clip, now.** At `t0`, in the same tick the synth would have started —
  a tactile cue that waited on a promise would land behind its animation. Chrome trims
  the MP3 encoder delay (`mode=clips` measures every decoded clip's lead: 0–2 ms), so a
  clip's onset is its first sample.
- **Not decoded yet → the synth, and start the load**, except tier 0, which waits for its
  recording (the stinger *is* the moment; from the SW cache the wait is milliseconds).
  All clips are preloaded on the first-gesture `unlock()`.
- **Round-robin variants** (coins, the card on the table, the card landing): uniform over
  the others, never the one played last, each variant with its own solved gain. A clip
  plays at the voice's pitch — jitter and the opponent detune — as its playback rate.

The two original stingers were re-solved too: `gameOverWin` 0.808 → 0.815 (the 0.08 dB
it was off by, now 0.01).

## Cue over music

Re-measured **2026-10-02** for the adaptive score (fifteen through-composed pieces in six
state pools — [AUDIO.md](AUDIO.md#music--publicaudiomusic)). `renderMusicOffline()` renders
every piece through the same `buildGraph()` — so through the new music-bus EQ — at
`MUSIC_GAIN`, decoded at 32 kHz exactly as the engine decodes it, over the piece's body
(`entryS` → `handoffS`), on the cues' own 300 ms-RMS axis (`MEASURED_BEDS`).

### What was wrong

The 2026-10-01 figures for the old beds, at `MUSIC_GAIN` 0.243 with no EQ:

| bed | median | p90 | max | peak | <150 Hz |
|---|---:|---:|---:|---:|---:|
| lobby | −28.49 | −27.06 | −25.23 | −13.01 | 6.7 % |
| table | −26.42 | −25.88 | −23.97 | −13.35 | **71.9 %** |
| endgame | −29.37 | −21.74 | −18.82 | −7.96 | **89.8 %** |

The table bed's *median* sat above every tier-3 cue (−24.97 … −32.58) — the music was as
loud as the cards — and almost all of it was bass, a rumble that headphones and good
speakers make the loudest thing in the room. It passed the masking gate only because it
put nothing in the octaves the cues live in (1–4 kHz was −31.8 dB of its energy).

### The music-bus EQ — `MUSIC_EQ`, on the music path only

`musicGain → highpass → low shelf → presence dip → musicDuck → preMaster`

| stage | setting | why |
|---|---|---|
| high-pass | 110 Hz, Q 0.707 (12 dB/oct) | nothing under the card thuds; phones play none of it |
| low shelf | 220 Hz, −5 dB | the chest of the low strings and taiko, down a step |
| peaking | 3 kHz, −3 dB, Q 1 | a small dip where the coin, card and chrome cues put their weight |

Energy share below 150 Hz, file → through the bus (harness, `lowPctFile` → `lowPctBus`):
`sudden-death-one-card-each` 35.5 % → 16.3 %, `duel-two-chairs-remain` 27.0 % → 12.6 %,
`duel-audience-of-one` 23.9 % → 11.4 %, `sudden-death-final-wager` 23.4 % → 9.7 %,
`court-ledger-and-quill` 11.8 % → 3.9 %, `court-whispering-gallery` 9.0 % → 5.9 %; the
other eight are under 2 % before the EQ. Gated: under 20 % for every piece after the EQ, and the EQ never adds.
The EQ settings are gated to the ranges asked for (HP 90–110 Hz, shelf −3…−5 dB, a ≤4 dB
dip at 2.5–3.5 kHz) and pinned to the render (`MEASURED_MUSIC_EQ`).

### The level — `MUSIC_GAIN` 0.243 → 0.052 (−13.4 dB), solved

Through-composed pieces breathe: between a piece's median and its 90th percentile, in a
single octave, there is up to 17 dB. A cue has to clear the music's **loud** moments, not
its average, so the masking gate is **tightened** from "each bed's median octave level"
(right for a 0.6-LU loop) to **each piece's 90th-percentile octave level over ~340 ms
frames**, against **every piece of every in-match pool**. Thresholds unchanged: tier 0–3
≥ 4 dB, tier 4 ≥ 2.5 dB, `chatMessage` ≥ 2.5 dB over both lobby pieces.

`MUSIC_GAIN` is the highest level that passes that, less 0.3 dB. The chain is linear at
these levels (the compressor's threshold is −14 dBFS), so a margin moves dB-for-dB with the
gain and one render solves it. At 0.243 the binding cue, `denied` (a 500 Hz knock at
−37.17 dBFS in its octave), sat **10.5 dB under** `court-whispering-gallery`'s loud moments
(a bassoon at 500 Hz); `chatMessage` (1 kHz) sat 7.9 dB under `court-ledger-and-quill`. The
new pieces put their weight where instruments do — 250 Hz to 2 kHz — which is where the
chrome cues live; the old bed did not, which is why it could sit 13 dB higher and still
pass. With the EQ at its strongest asked-for settings, only level could carry it.

Each piece at the shipped level, over its body:

| state | piece | median | p90 | max | peak |
|---|---|---:|---:|---:|---:|
| `lobby` | lobby-antechamber-waltz | −43.03 | −39.85 | −35.39 | −23.90 |
| `lobby` | lobby-petitioners-bench | −50.10 | −39.46 | −33.50 | −22.01 |
| `court` | court-whispering-gallery | −45.28 | −37.53 | −35.24 | −21.94 |
| `court` | court-ministry-minuet | −43.21 | −41.46 | −38.96 | −27.64 |
| `court` | court-ledger-and-quill | −43.46 | −40.02 | −37.95 | −23.37 |
| `court` | court-velvet-procession | −43.71 | −39.33 | −35.51 | −24.20 |
| `tension` | tension-counting-house | −42.74 | −39.81 | −37.22 | −25.63 |
| `tension` | tension-quiet-knife | −43.80 | −43.43 | −43.04 | −25.34 |
| `duel` | duel-two-chairs-remain | −41.61 | −38.84 | −36.15 | −21.97 |
| `duel` | duel-audience-of-one | −42.37 | −39.95 | −38.39 | −23.96 |
| `duel` | duel-crossed-signets | −40.96 | −38.13 | −35.00 | −22.74 |
| `sudden_death` | sudden-death-one-card-each | −43.56 | −38.58 | −33.78 | −21.42 |
| `sudden_death` | sudden-death-final-wager | −41.86 | −38.60 | −34.61 | −21.87 |
| `fallen` | fallen-from-the-gallery | −49.44 | −38.55 | −35.04 | −26.17 |
| `fallen` | fallen-after-the-verdict | −46.25 | −38.05 | −33.19 | −21.99 |

Every piece's p90 sits at −37.53 or below: **≥ 5.0 dB under the quietest routine
(tier-3) cue** (`cardShuffle` / `cardDeal`, −32.5), and under the whole chrome tier
(−34.6). Gated: p90 ≥ 3 dB under the quietest tier-3 cue, for every piece — the owner's
"the bed must sit under the game", as a number. Duel and sudden death are mastered 1.5 LU
hotter and land ~1.5–2 dB above court on the median; they are held to the same lines.
Ducking is unchanged (tier 0–1 and `coup` dip the music a further 3.1–6 dB live) and is
not counted in any figure here.

### Every cue over the music, in its own octave

Each cue as shipped (clip variant 0), in its own loudest octave, against the **thinnest**
in-match piece in that octave (p90). Full matrix: `MEASURED_MASKING`.

| cue | tier | octave | cue level | margin | thinnest over | need |
|---|---:|---:|---:|---:|---|---:|
| `denied` | 4 | 500 | −37.17 | **2.83** | court-whispering-gallery | 2.5 |
| `chatMessage` | 4 | 1000 | −40.19 | **5.47** | court-ledger-and-quill | 2.5 |
| `challengeWindow` | 4 | 2000 | −39.60 | **9.62** | duel-crossed-signets | 2.5 |
| `yourTurn` | 4 | 1000 | −35.35 | **10.31** | court-ledger-and-quill | 2.5 |
| `timerWarning` | 4 | 2000 | −35.63 | **13.59** | duel-crossed-signets | 2.5 |
| `reaction` | 4 | 4000 | −39.79 | **13.77** | duel-audience-of-one | 2.5 |
| `actionDeclared` | 3 | 2000 | −35.16 | **14.06** | duel-crossed-signets | 4 |
| `cardShuffle` | 3 | 2000 | −34.55 | **14.67** | duel-crossed-signets | 4 |
| `challengeRevealSuccess` | 2 | 500 | −25.17 | **14.83** | court-whispering-gallery | 4 |
| `cardDeal` | 3 | 8000 | −39.45 | **17.60** | duel-audience-of-one | 4 |
| `coup` | 2 | 125 | −25.87 | **19.22** | sudden-death-one-card-each | 4 |
| `coinsLost` | 3 | 2000 | −29.95 | **19.27** | duel-crossed-signets | 4 |
| `gameOverWin` | 0 | 500 | −20.39 | **19.61** | court-whispering-gallery | 4 |
| `playerEliminated` | 0 | 500 | −18.37 | **21.63** | court-whispering-gallery | 4 |
| `blockOpportunity` | 4 | 8000 | −35.39 | **21.66** | duel-audience-of-one | 2.5 |
| `coinsGained` | 3 | 2000 | −25.72 | **23.50** | duel-crossed-signets | 4 |
| `challengeRevealFail` | 1 | 125 | −19.63 | **25.46** | sudden-death-one-card-each | 4 |
| `gameOverLose` | 0 | 125 | −18.01 | **27.08** | sudden-death-one-card-each | 4 |
| `block` | 1 | 63 | −24.11 | **27.99** | sudden-death-one-card-each | 4 |
| `exchange` | 2 | 8000 | −28.07 | **28.98** | duel-audience-of-one | 4 |
| `assassinationAlert` | 2 | 8000 | −25.57 | **31.48** | duel-audience-of-one | 4 |
| `influenceLoss` | 1 | 8000 | −21.87 | **35.18** | duel-audience-of-one | 4 |

`chatMessage` over the lobby pieces: +6.92 dB (waltz), +17.59 dB (petitioners' bench).

Against the old table bed (its median, at 0.243) the thinnest margins were `denied` +3.1,
`block` +5.0 and `coup` +6.0 dB; `block` and `coup` — weight at 63/125 Hz, right where the
old bed lived — now clear the music by 28.0 and 19.2 dB.

**What `MUSIC_GAIN` costs to raise.** `denied` binds with 0.33 dB to spare. Without it the
next binder is `chatMessage` (+2.97 dB of room), then `challengeWindow` (+7.1). A louder
score therefore wants either the tier-4 retune [below](#cues-worth-re-synthesising) (the
chrome tier sits at −34.6 because `cardShuffle`'s crest pinned the ladder) or a quieter
mid-range in the two binding pieces — not a looser gate.

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

**Automated (2026-10-01):** `scripts/render-audio-mix.ts` bundles the harness with
esbuild, serves it next to `public/audio`, opens it in headless Chrome over the DevTools
protocol and saves `window.__COUP_REPORT`. It finds Chrome via `CHROME_PATH`, then
`/Applications/Google Chrome.app`, then the newest Playwright Chromium in
`~/Library/Caches/ms-playwright` (which is what produced these numbers).

```sh
npx tsx scripts/render-audio-mix.ts solve --apply   # re-solve every HERO_CLIPS gain, write them into SoundEngine.ts
npx tsx scripts/render-audio-mix.ts                 # measure → artifacts/audio-mix-report.json,
                                                    # print both ladders + margins, write
                                                    # artifacts/measurements-snippet.txt
npx tsx scripts/render-audio-mix.ts clips           # each decoded clip raw: lead-in, length, crest
npx tsx scripts/render-audio-mix.ts live            # drive the LIVE engine: every cue, the music
                                                    # through every state, a mid-load switch and a switch
                                                    # back, a forced pool handoff, stop; reports errors
```

Then paste the snippet's blocks over the data blocks of `tests/app/audio/measurements.ts`,
set `MEASURED_AT`, and `npx vitest run tests/app/audio`. Two runs agree byte-for-byte.

**By hand**, as originally done:

```sh
D=$(mktemp -d)
npx esbuild tests/app/audio/harness.entry.ts \
  --bundle --format=esm --target=es2022 --outfile="$D/harness.bundle.js"
cp tests/app/audio/harness.html "$D/"
ln -s "$PWD/public/audio" "$D/audio"     # the hero clips and the beds
python3 -m http.server 8137 --directory "$D"
```

Open `http://localhost:8137/harness.html` (`?mode=solve`, `?mode=clips`, `?mode=live` for the
other modes). The page renders on load and prints the JSON report; it is also on
`window.__COUP_REPORT`, and `window.__COUP_AUDIO.probe(id, opts)` renders a single cue for
ad-hoc work.

Renders are deterministic — the noise buffers are seeded per graph and the jitter is
rendered at nominal pitch, so two runs agree exactly. Retuning is a loop: change `MIX_DB`,
re-render, read the margins, repeat. Three passes converged here.

`MEASURED_TRIM_DB` is what makes this a gate rather than a snapshot. Change `MIX_DB`
without re-rendering and `mix.test.ts` fails immediately, because every level in the
recorded table now describes a mix nobody hears.

## Still unmeasured

- ~~The music bed~~ — measured and gated since 2026-10-01; every piece of the adaptive score
  since 2026-10-02, see [Cue over music](#cue-over-music). Rendered over each piece's body
  without ducking; the duck, the 3 s state crossfades and the pool handoffs (two pieces
  overlapping for ≤ 8 s, equal-power — the sum is at most the louder piece's level) are
  not in the figures.
- **Music loudness as a listener hears it.** The score's level is set by masking, not by
  taste: it is the loudest the gate allows. On the K-weighted scale it is ~13 LU under the
  old bed. Whether that reads as "under the game" or as "barely there" on a phone speaker
  is unmeasured — nothing here models one.
- **Perceptual weighting.** The ladder runs on unweighted RMS, and the clips are far more
  varied in spectrum than the synth voices: a 6 kHz card tear and a 120 Hz timpani hit at
  the same `loud` are not equally loud to a listener (K-weighting would put the tear
  roughly 4 dB up and the timpani down). With 1.8–2 dB between tiers, a weighted axis could
  swap some neighbours. Not measured; it would be the next gate worth having.
- **Small speakers.** Nothing models a phone or laptop speaker, which plays little below
  ~200 Hz. `block`, `coup` and `challengeRevealFail` put their weight at 63–125 Hz; each has
  a card/palm transient layered on top in mastering so it still reads there, but how much
  of it reads is unmeasured.
- **Variant spread.** Each round-robin variant is solved onto the same `loud`, but the
  variants are different recordings; how alike they sound is judged from their octave
  shapes and envelopes (scripts/generate-sfx.ts `analyze`), not gated.
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

**2026-10-01:** both now play recordings — `block` a wooden thud with a palm slap on
top (its clip takes 0.03 dB of limiting where the synth took 2.11), `cardShuffle` three
felt-landing variants. Their *synth fallbacks* are unchanged, and so is the ladder they
pin: the clips were solved onto the existing trims rather than the trims re-opened, so
tier 3 and 4 did not come up. That retune is still available, now with recordings that
could carry it.
