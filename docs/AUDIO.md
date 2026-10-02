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

**The adaptive score (2026-10-02).** It replaces three short seamless loops whose table bed —
the one players heard all game — was a 57 s loop with **72 % of its energy below 150 Hz**
(the endgame bed: 90 %). That was the owner's complaint, measured: "a super repetitive bass
track that replays over and over again and it's hard to hear anything else."

What plays now is **six pools of through-composed pieces** (98–149 s each, soft intro,
natural outro, instrumental), one pool per game state, fifteen pieces in all. The engine
plays a piece, hands off to another piece of the same pool near its end, and crossfades
to another pool when the game changes state. No piece repeats until its whole pool has
played, and none plays twice in a row.

### States — `src/app/hooks/useMusicDirector.ts`

`gameMusicCue()` (pure, tested) reads `ClientGameState` from the **local** player's seat:

| state | when | pool |
|---|---|---|
| `lobby` | home and lobby | 2 |
| `court` | ≥3 alive, nobody on their last card, nobody holding ≥7 coins | 4 |
| `tension` | ≥3 alive, and someone alive is on their last card **or** has ≥7 coins (`COUP_COST` — a Coup is on the table) | 2 |
| `duel` | exactly 2 alive — including a game that *started* 1v1, from its first turn | 3 |
| `sudden_death` | 2 alive and both on their last card | 2 |
| `fallen` | the local player is out and the game goes on | 2 |
| `over` | game over: music stops (1.2 s), the win / lose stingers play | — |

Spectators never match a seat (their `myId` is a spectator id), so they hear the
court → tension → duel → sudden-death ladder and never `fallen`.

**Hysteresis** (`settleMusicCue()`, pure, tested): the raw cue is re-read on every state
broadcast, but a change is held until the current cue has played **8 s**
(`MUSIC_MIN_DWELL_MS`) and then re-read — so a coin count bouncing 6 ↔ 7 changes the
music at most once per 8 s, and a held change that has stopped being true never fires.
Latches: once in `duel` the score never returns to `court`/`tension`; once in
`sudden_death` it never returns to `duel`, `court` or `tension`; `fallen` stays `fallen`.
`over` is never held. A new game (another room, or a rematch whose turn counter
restarted) drops the latches.

### Playback — `SoundEngine` "the score"

- **Start:** the first piece of the wanted state; the lobby from the top of its piece (the
  soft intro is the welcome), an in-game state from the piece's `entryS`, so a page
  reloaded into a duel sounds like a duel. `musicGain` fades in over 0.9 s.
- **Handoff within a pool:** 20 s (`MUSIC_PREFETCH_S`) before the playing piece's
  `handoffS`, the next piece is drawn from the pool's shuffle bag, fetched and decoded,
  then **scheduled on the audio clock** to start exactly at the handoff (a bar line of the
  outgoing piece, just after its final cadence) from its own `leadInS` — a bar ~8 s before
  its body arrives — fading in over 4 s (sin) while the outgoing piece fades over its
  remaining tail (≤ 8 s, cos). Main-thread timers only *prepare* (prefetch) and *promote*
  (bookkeeping); a throttled background tab delays bookkeeping, never a fade. If a prefetch
  fails the piece plays out to its natural end and `onended` starts another.
- **State change:** equal-power crossfade, **3 s**, into a piece of the new pool at its
  `entryS` — the bar where its body has arrived — so a change into tension sounds like
  tension rather than like a soft intro. Different states are not beat-matched (they have
  different tempos); within a state the handoff lands on the outgoing piece's bar line.
  A change that lands while another is loading supersedes it; a change *back* to what is
  playing cancels it and re-arms the handoff.
- **Pools of one** still work: the bag deals the same piece again, so it hands off into
  its own lead-in — a loop with a crossfade.
- **Lazy loading:** only the sounding piece is fetched; the next is prefetched ~20 s
  ahead. Music is **not** precached by the service worker (`public/sw.js` v7); its
  runtime cache-first handler for `/audio/` caches each piece on first fetch. Pieces are
  decoded at **32 kHz** (`MUSIC_DECODE_RATE`) into a dedicated `OfflineAudioContext` —
  a 150 s piece is 38 MB of float32 instead of 58 MB at 48 kHz, and up to three can be
  resident during a handoff. Decoded buffers not sounding or queued are evicted.
- Ducking is unchanged (`duckMusic()`, tier 0–1 and `coup`).

### The pieces

All 15 were generated with Music v2 (`music_v2`, `force_instrumental`) on 2026-10-02.
Prompts are data in `scripts/generate-music.ts` (`SCORE`): one brief per piece (mood,
meter, tempo, key, which instrument leads) plus two shared tails — a FORM (through-composed,
a soft intro on a named instrument, two or three contrasting sections, a natural quiet
outro, no abrupt ending) and the MIX RULES (no bass ostinato, no sub-bass/synth
bass/808/booming drums, low strings only as rare sustained notes, an uncluttered 1–4 kHz
band, no lead synths/electric guitar/crash cymbals/constant hi-hats; not EDM, not an epic
trailer, not lo-fi hip hop, not horror). Every brief sits in the Ministry's palette — a
dark, decadent palace chamber ensemble — and within a pool no two pieces share a lead
instrument. The score spans 72–112 BPM in 4/4, 3/4 (minuet, waltz) and 6/8.

```sh
npx tsx --env-file="$HOME/.config/elevenlabs/env" scripts/generate-music.ts credits
npx tsx --env-file="$HOME/.config/elevenlabs/env" scripts/generate-music.ts generate court-whispering-gallery [--take 2]
npx tsx scripts/generate-music.ts analyze-candidates [id…]   # → artifacts/music-candidates-analysis.json
npx tsx scripts/generate-music.ts master all                 # PIECE_MASTERS → public/audio/music/, artifacts/pieces.json
npx tsx scripts/render-audio-mix.ts                          # re-measure; AUDIO-MIX.md
```

| state | file | take | length | BPM | key (fit) | LUFS / LRA / dBTP | <150 Hz file → after bus EQ | 1–4 kHz (bus) | entry / lead-in / handoff (s) | size |
|---|---|---|---:|---:|---|---|---:|---:|---|---:|
| `lobby` | lobby-antechamber-waltz.mp3 | t1 | 117.8 s | 80 | E major (r 0.68) | −20 / 10.3 / −4.8 | 1.2 % → 0.6 % | 8.2 % | 0 / 0 / 105.8 | 1611 KB |
| `lobby` | lobby-petitioners-bench.mp3 | t2 | 109.1 s | 72 | G minor (r 0.86) | −20 / 7.2 / −1.9 | 0.9 % → 0.3 % | 0.3 % | 0 / 0 / 104.0 | 1492 KB |
| `court` | court-whispering-gallery.mp3 | t1 | 142.9 s | 92 | D major (r 0.75) | −20 / 13.3 / −1.9 | 9.0 % → 5.9 % | 1.7 % | 4.0 / 0 / 116.4 | 1955 KB |
| `court` | court-ministry-minuet.mp3 | t1 | 148.5 s | 95 | E minor (r 0.73) | −20 / 2.7 / −7.2 | 1.1 % → 0.6 % | 11.1 % | 1.3 / 0 / 143.4 | 2031 KB |
| `court` | court-ledger-and-quill.mp3 | t2 | 138.6 s | 100 | A minor (r 0.77) | −20 / 19.0 / −2.3 | 11.8 % → 3.9 % | 15.1 % | 13.2 / 3.6 / 116.4 | 1896 KB |
| `court` | court-velvet-procession.mp3 | t1 | 133.7 s | 76 | C minor (r 0.87) | −20 / 17.4 / −4.6 | 0.9 % → 0.6 % | 12.3 % | 16.6 / 7.2 / 127.2 | 1829 KB |
| `tension` | tension-counting-house.mp3 | t1 | 122.6 s | 104 | B minor (r 0.71) | −20 / 18.1 / −5.9 | 0.1 % → 0 % | 15.6 % | 27.7 / 18.5 / 110.8 | 1678 KB |
| `tension` | tension-quiet-knife.mp3 | t1 | 108.5 s | 96 | A♭ major (r 0.74) | −20 / 2.2 / −5.7 | 0.2 % → 0.1 % | 36.8 % | 0 / 0 / 99.8 | 1484 KB |
| `duel` | duel-two-chairs-remain.mp3 | t1 | 116.7 s | 108 | D minor (r 0.76) | −18.5 / 4.1 / −2.1 | 27.0 % → 12.6 % | 3.9 % | 6.2 / 0 / 104.0 | 1596 KB |
| `duel` | duel-audience-of-one.mp3 | t1 | 108.6 s | 112 | D major (r 0.91) | −18.5 / 4.7 / −3.5 | 23.9 % → 11.4 % | 16.6 % | 0 / 0 / 102.4 | 1485 KB |
| `duel` | duel-crossed-signets.mp3 | t1 | 112.2 s | 104 | C minor (r 0.78) | −18.5 / 13.1 / −2.9 | 0.5 % → 0.3 % | 8.5 % | 18.4 / 10.4 / 102.7 | 1535 KB |
| `sudden_death` | sudden-death-one-card-each.mp3 | t1 | 108.4 s | 112 | E minor (r 0.72) | −18.5 / 15.3 / −1.5 | 35.5 % → 16.3 % | 11.9 % | 10.3 / 1.7 / 102.4 | 1482 KB |
| `sudden_death` | sudden-death-final-wager.mp3 | t1 | 98.7 s | 108 | D minor (r 0.75) | −18.5 / 21.5 / −1.5 | 23.4 % → 9.7 % | 11.7 % | 8.2 / 0 / 81.5 | 1350 KB |
| `fallen` | fallen-from-the-gallery.mp3 | t1 | 109.3 s | 72 | A minor (r 0.88) | −20 / 8.9 / −6.3 | 0 % → 0 % | 0.7 % | 0 / 0 / 101.2 | 1496 KB |
| `fallen` | fallen-after-the-verdict.mp3 | t1 | 102.6 s | 76 | A major (r 0.60) | −20 / 13.3 / −2.3 | 1.9 % → 1.1 % | 7.6 % | 9.2 / 0 / 96.9 | 1404 KB |

23.8 MB in all, 112 kbps stereo. Key is a Krumhansl–Kessler fit over a whole-track chroma
(an r under ~0.75 is a weak fit — modal or ambiguous); BPM is the onset-comb pulse folded
onto the prompt's octave; the low-end shares are the harness's (decoded as the engine
decodes, then through the chain), the rest is `scripts/generate-music.ts master`. LRA is
over the whole file including intro and outro; these are pieces, not beds, and several
build. For comparison the old table bed: 57 s loop, 72 % under 150 Hz, 0.1 % in 1–4 kHz.

### How the takes were chosen, without listening

Nineteen generations for fifteen pieces: thirteen first takes, a second take for four
slots whose first take measured wrong, and two late pieces (`duel-crossed-signets`,
`sudden-death-final-wager`) so every in-game state has a pool of at least two.
`npx tsx scripts/generate-music.ts analyze-candidates` prints, per candidate: length, key
and fit, tempo, integrated loudness and LRA, true peak, **energy share below 150 Hz** and
**in 1–4 kHz**, how long the intro takes to reach the body (integrated − 6 LU, short-term),
how long the outro is, the short-term level one second before the end relative to
integrated (an abrupt ending sits near 0 LU), and a short-term level every 10 s. The picks
and the reason for each are data (`PIECE_MASTERS`):

- **ledger-and-quill — take 2.** Take 1 put **43 %** of its energy in 1–4 kHz — the cue
  band — and climbed 13 LU to an abrupt ending (−11.8 LU one second out). Take 2: 12.7 %,
  a steady −19…−24 LUFS short-term body, a 28 s natural outro.
- **petitioners-bench — take 2.** Take 1 swung ±4 LU every ten seconds (LRA 20.5); take 2
  holds LRA 7.2.
- **one-card-each — take 1.** Both takes carry ~42 % under 150 Hz in the file (mid-pitched
  taiko — the bus EQ halves it). Take 1 is in E minor as asked (take 2 read D major, r 0.82)
  and its body arrives at ~11 s where take 2 builds for 31 s, so a state change into it
  lands at once. Its mid-piece drop (to ~−30 LUFS for ~20 s) is the "waves of rising
  tension" the prompt asked for.
- **after-the-verdict — take 1.** LRA 13.4 against 18.2, and ~70 s of body against take 2's
  ~50 s (take 2 sinks to −42 LUFS by 80 s). Take 1 opens on ~10 s of near-silence, which the
  body-relative trim removes.
- Single takes were accepted on: low-end share (all but the duel/sudden-death pieces under
  12 % before the EQ), presence share, a natural decay at the end (`audience-of-one` is the
  one that stops mid-phrase, −15.5 LU one second out — it gets a 7 s synthetic fade), and no
  long stretch of silence inside the body. `tension-quiet-knife` puts 37 % of its energy in
  1–4 kHz (alto flute, harpsichord); it was kept because it is the steadiest tension piece
  (LRA 2.2) and the masking gate — which is what that band share is a proxy for — passes
  over it with 9+ dB to spare.

### Mastering — `npx tsx scripts/generate-music.ts master all`

Per piece: trim head and tail where the 100 ms RMS is more than 40 dB under the body (the
median 1 s RMS); raised-cosine fade-in (2.5 s if the first 2 s are already within 6 dB of
the body, else a 60 ms de-click) and fade-out (7 s if the last 3 s are still within 6 dB of
the body — an abrupt end — else 1.2 s, so the last sample is a true zero); 35 Hz high-pass;
normalise to the state's integrated loudness (**−20 LUFS**; `duel` and `sudden_death`
**−18.5**, 1.5 LU hotter — `MUSIC_LUFS`) in two passes; a −1.5 dBFS limiter (two takes came
back at −0.7 / −0.9 dBTP once levelled); 112 kbps stereo MP3. Then, measured on the encoded
file as a decoder returns it: clicks at both edges (largest second difference in the first /
last 20 ms against the piece's own p99.9 — **0.00–0.01× for every piece**; first and last
samples ≤ 6e-6), and the three bar-grid points the engine uses (onset-comb downbeat at the
measured tempo): `handoffS` (first bar ≥ 2 s after the body ends, never later than 5 s —
7 s for an abrupt take — before the end), `entryS` (the bar where the body has arrived) and
`leadInS` (a bar ~8 s before that). The picks' JSON lands in `artifacts/pieces.json`; the
`MUSIC_POOLS` table in `SoundEngine.ts` is pasted from it.

### Levels — see [AUDIO-MIX.md](AUDIO-MIX.md#cue-over-music)

A music-bus EQ (high-pass 110 Hz, −5 dB low shelf at 220 Hz, −3 dB dip at 3 kHz) on the
music path only, and `MUSIC_GAIN` **solved** 0.243 → 0.052 against the cue ladder: every
cue clears every in-match piece's loud moments in its own octave.

The old beds (`lobby-antechamber`, `table-velvet-court`, `endgame-last-favour`) and the
`velvet-court.mp3` they were mastered from are deleted; nothing referenced them. They, and
the loop-mastering code that built them, are in git history (`efcabc4`).

## Endgame stingers

Generated with Music v2 on 2026-08-07; prompts in `scripts/generate-music.ts`. Unchanged.

- `court-crowned.mp3`: victory, SHA-256 `01471265720a40455e9047474d595ca7cda824d5e2028d38ffe5e5bdbbdfd27f`
- `plot-unraveled.mp3`: defeat, SHA-256 `f1b5b6f729154d3cf6160c997dcdced39b9df8ecff4f98f62570397e489b8797`

`public/audio/velvet-court.mp3` (SHA-256 `1b30e5a8…bfa99`), the original single bed, is
deleted with the beds mastered from it (2026-10-02).

## Credits

The 2026-10-01 pass used **5,421 credits** (account `character_count` 10,189 → 15,610):
111 sound-effect generations (~790 credits, ~7 each at 0.5–2.2 s) and five Music v2
generations (2 × lobby, 2 × endgame, 1 × table; 360 s in all, ~4,630 credits, roughly
800 per minute of music).

The 2026-10-02 adaptive score used **28,813 credits** (`character_count` 17,346 → 46,159):
nineteen Music v2 generations, 2,325 s requested in all — about 745 credits per minute of
music. The budget was 30,000.

Terms recorded at generation: <https://elevenlabs.io/music-api-terms>.
