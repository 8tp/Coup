# Audio production

All recorded audio is a development-time asset generated with ElevenLabs. The app never
calls ElevenLabs, and the API key lives only in the local `ELEVENLABS_API_KEY` environment
variable. Levels are not set here — every file is normalised (peak for effects, LUFS for
music) and its level in the mix is measured and gated; see [AUDIO-MIX.md](AUDIO-MIX.md).

Load the key without putting it on a command line or in a file in the repo:

```sh
npx tsx --env-file="$HOME/.config/elevenlabs/env" scripts/generate-sfx.ts credits
```

`--env-file` puts it in `process.env` for that process only. Never put a real key in a
committed `.env`, browser code, issue comments, build arguments, or generated metadata.

Raw candidates go to `artifacts/` (gitignored). Only mastered picks are committed.

## Sound effects — `public/audio/sfx/`

Generated 2026-10-01 with `POST /v1/sound-generation` (`mp3_44100_128`), 3–4 candidates per
prompt and a second (or third) prompt "take" where the first take's analysis said it was
wrong for the job. The prompts, the picks and the reason for each pick are data in
`scripts/generate-sfx.ts`:

```sh
npx tsx --env-file=… scripts/generate-sfx.ts generate coinsGained --take 2 --n 4
npx tsx scripts/generate-sfx.ts analyze coinsGained   # onset, rise, crest, octave shape, envelope
npx tsx scripts/generate-sfx.ts master                # PICKS → public/audio/sfx/*.mp3
npx tsx scripts/render-audio-mix.ts solve --apply     # re-solve HERO_CLIPS gains (AUDIO-MIX.md)
```

**How a candidate was chosen, without listening.** `analyze` prints, per candidate: the
lead-in before the onset, the rise from onset to peak (a cue fired on an animation's
landing callback needs its impact at t≈0 — several "card lands" takes peaked 130–210 ms
late and were rejected), active length, crest, noise floor, octave-band shape, centroid,
and a 20 ms-per-glyph envelope that shows how many events a clip contains and where (a
"two raps" prompt that came back as one; a reveal take with 600 ms of dead air between
the card and the chord). Spectral fit was judged against the cue's role — e.g. the first
coin take centred at 10–12 kHz (a jingle, and exactly the band an opponent's 5.2 kHz
lowpass removes) and was replaced by a heavier take centred at 2.7–3.9 kHz; the first
`block` takes centred at 44–79 Hz, which no phone plays, so the pick is layered with a
palm slap.

**Mastering** (`master`): sum the pick's layers (some cues are two takes, or two slices
of one take with dead air cut out), trim to 2 ms before the onset, cut the tail at
−50 dB or a hard cap, highpass (40 Hz minimum; more where a cue's weight must clear the
music or the "no chest" rule applies), cap the crest with an iterated lookahead limiter
checked on the encoded file, fade, peak-normalise to −2 dBFS, encode **96 kbps mono MP3**.
All 26 files total 145 KB; the largest is `playerEliminated.mp3` at 18.4 KB.

| cue | file(s) | what it is |
|---|---|---|
| `playerEliminated` | playerEliminated.mp3 | one low bronze bell, 1.5 s |
| `influenceLoss` | influenceLoss.mp3 | card slammed face-up with a low thud, then torn |
| `challengeRevealFail` | challengeRevealFail.mp3 | card slap over a sinking timpani hit |
| `block` | block.mp3 | heavy wooden thud + palm slap |
| `coup` | coup.mp3 | brass seal stamped into wax on oak |
| `challengeRevealSuccess` | challengeRevealSuccess.mp3 | card snapped face-up + plucked harp chord |
| `assassinationAlert` | assassinationAlert.mp3 | dagger drawn from a leather sheath |
| `exchange` | exchange.mp3 | cards drawn and swapped, short riffle |
| `coinsGained` | coinsGained-1/2.mp3 | heavy brass tokens set on a stack (round-robin) |
| `coinsLost` | coinsLost-1/2.mp3 | a stack knocked over and slid away (round-robin) |
| `actionDeclared` | actionDeclared-1/2/3.mp3 | a card slapped down on felt (round-robin) |
| `cardShuffle` | cardShuffle-1/2/3.mp3 | a card landing on felt (round-robin) |
| `cardDeal` | cardDeal.mp3 | **new** — four cards dealt; fires once, on the opening state of a game |
| `yourTurn` | yourTurn.mp3 | one small brass desk bell |
| `challengeWindow` | challengeWindow.mp3 | a brass signet ring rapped on wood |
| `blockOpportunity` | blockOpportunity.mp3 | two brass latch clicks |
| `timerWarning` | timerWarning.mp3 | one wooden clock tick |
| `denied` | denied.mp3 | one dull knock on a padded door |
| `chatMessage` | chatMessage.mp3 | a folded paper note tapped down |
| `reaction` | reaction.mp3 | a light paper-fan flutter |

Every cue keeps its synth voice as the fallback when its clip is not decoded.

## Music — `public/audio/music/`

An adaptive score of three seamless loops in one tempo and key family, every bed
normalised to **−20 LUFS integrated**. `MUSIC_GAIN` went 0.18 → 0.243: the single bed
that shipped before was mastered to −17.4 LUFS, so 2.6 dB down in the file and 2.6 dB up
in the gain leaves the bed exactly where players had it — what changed is that all
three beds sit at that level.

| bed | file | source | loop | key / tempo | LUFS / LRA / TP | size |
|---|---|---|---|---|---|---|
| `lobby` | lobby-antechamber.mp3 | `lobby-antechamber` take 2 (Music v2, 66 s) | 40.004 s = 14 bars | D minor (r 0.86) / 84.00 BPM | −20.0 / 1.6 LU / −7.1 dBTP | 644 KB |
| `table` | table-velvet-court.mp3 | the shipped `velvet-court.mp3` (Aug 2026) | 57.151 s = 20 bars | A minor (r 0.80) / 84.00 BPM | −20.0 / 0.6 LU / −6.9 dBTP | 918 KB |
| `endgame` | endgame-last-favour.mp3 | `endgame-last-favour` take 2 (Music v2, 66 s) | 54.285 s = 19 bars | A minor (r 0.79) / 84.00 BPM | −20.0 / 1.9 LU / −1.9 dBTP | 873 KB |

Key is a Krumhansl–Kessler fit over a whole-track chroma; tempo is the peak of a 32-beat
onset-autocorrelation comb, which landed on exactly 84.00 for all three (and for the
discarded candidates). Both are printed by `npx tsx scripts/generate-music.ts analyze <file…>`.

**Why these.** Two candidates per new slot.

- *Table: kept velvet-court.* Velvet Court II (a D-minor re-prompt) came back with 6.7 LU
  of loudness range and a weak key fit (r 0.5); velvet-court holds 0.6 LU and puts almost
  nothing above 1 kHz (1–4 kHz is −31.8 dB of its energy), which leaves the most room for
  card and coin cues of any bed. But its loop was broken: 68.0 s is 95.2 beats — not a
  whole number, so every pass of the loop slipped the beat grid by a fifth of a beat — and
  the wrap measured a **44× click** (second difference vs the loop's own p99.9). It is
  re-looped from itself below. (Velvet Court II's second candidate was never generated.)
- *Endgame: take 2.* A minor at 84 BPM — the table bed's own key and tempo, so the
  crossfade into it reads as the same score tightening. 1.9 LU steady. Take 1 sat in a
  D major/minor ambiguity (r 0.70) and drifted ~5 LU louder across its length.
- *Lobby: take 2.* D minor, the iv of the table's A minor, so lobby → table is a near-key
  crossfade; its last 45 s hold −19/−20 LUFS short-term. Take 1 (D major) swung ±3 LU every
  few seconds and drifted 2 LU louder. **Cost:** take 2 spends its first 20 s building, so
  its loop is 14 bars (40 s) rather than the ~60 s asked for.

**The loop method** (`npx tsx scripts/generate-music.ts master <bed>`, GAME-FEEL-PLAN §4.8):

1. Skip the intro handle; snap the loop start to the strongest onset within a beat.
2. Search the loop end across whole-bar lengths (±1/8 beat, ±2 bars) for the point whose
   next 3 s best match the 3 s after the start — onset-envelope correlation and
   log-spectrum distance — then refine to the sample by cross-correlating the low-passed
   waveforms (±8 ms) so the bass is in phase where the copies overlap.
3. The loop is `audio[S, E)` with its first 4 beats rewritten as an equal-power crossfade
   from `audio[E…]` into `audio[S…]`. Played on repeat, the sample after the loop's last is
   `audio[E]` — the true continuation — and the return to the head happens across the
   first bar, never at a cut.
4. **Wrap padding.** MP3 here is gapless (the LAME header carries delay and padding, and
   Chrome's `decodeAudioData` honours it — decoded lengths are exact), but gapless is not
   seamless: the first and last frames decode without their real neighbours, which put a
   2–6× click at the wrap of two of four candidates. So each file is
   `[last 4096 samples][loop][first 4096 samples]` and the engine loops between
   `loopStart` and `loopEnd` (`MUSIC_BEDS` in `SoundEngine.ts`). The codec's edge effects
   land in padding that is never played after the first pass.
5. Measure the seam on the encoded file as a decoder returns it, looping exactly as the
   engine does: the largest second difference within ±10 ms of the wrap against the loop's
   p99.9, compared with the same figure in the pre-encode PCM (which across the wrap is the
   source itself, uninterrupted).

| bed | wrap click (decoded) | same window in the source | crossfade flux / p95 | head/tail match |
|---|---:|---:|---:|---:|
| lobby | 0.31× | 0.28× | 0.94 | 0.93 |
| table | 0.50× | 0.32× | 0.95 | 0.70 |
| endgame | 0.06× | 0.06× | 0.89 | 0.86 |

Below 1× means the wrap is no sharper than the loop's ordinary content; the decoded and
source columns agreeing means encoding added nothing at the seam. A crossfade-flux ratio
near 1 means the overlapped bar has no more onsets than the rest of the loop (no
doubled-attack flam). The old velvet-court wrap measured 28× decoded.

**At runtime** (`SoundEngine.setMusicTrack`, wired by `src/app/hooks/useMusicDirector.ts`):
home and lobby ask for `lobby`, the game page for `table`, `endgame` when two players are
left (or, in a game that started with two, when the first influence falls), and game over
stops the music for the stingers. Switching beds is a 2 s equal-power crossfade on the
audio clock, and the incoming bed starts at the outgoing bed's **beat phase** — all three
are 84 BPM and every loop region starts on an onset, so the two grids stay together
through the fade. At most two decoded beds are kept (~25–35 MB of float32 each).

## Endgame stingers

Generated with Music v2 on 2026-08-07; prompts in `scripts/generate-music.ts`. Unchanged.

- `court-crowned.mp3`: victory, SHA-256 `01471265720a40455e9047474d595ca7cda824d5e2028d38ffe5e5bdbbdfd27f`
- `plot-unraveled.mp3`: defeat, SHA-256 `f1b5b6f729154d3cf6160c997dcdced39b9df8ecff4f98f62570397e489b8797`

`public/audio/velvet-court.mp3` (SHA-256 `1b30e5a8…bfa99`) is no longer played or
precached; it stays because it is the source the `table` bed is mastered from.

## Credits

The 2026-10-01 pass used **5,421 credits** (account `character_count` 10,189 → 15,610):
111 sound-effect generations (~790 credits, ~7 each at 0.5–2.2 s) and five Music v2
generations (2 × lobby, 2 × endgame, 1 × table; 360 s in all, ~4,630 credits, roughly
800 per minute of music).

Terms recorded at generation: <https://elevenlabs.io/music-api-terms>.
