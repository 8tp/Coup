# Audio production

Background music is generated as a development-time asset. The ElevenLabs API is never called by the app, and its API key must stay in the local `ELEVENLABS_API_KEY` environment variable.

## Selected gameplay loop

`public/audio/velvet-court.mp3` was generated with ElevenLabs Music v2 on August 7, 2026, then mastered into a 68-second loop. It was selected from three candidates because its 0.6 LU loudness range was the most consistent and least likely to compete with gameplay cues.

- Model: `music_v2`
- Source format: 44.1 kHz, 128 kbps MP3
- Final SHA-256: `1b30e5a894bd4b19fa2a6e307d9ed0f19895e0fe647811bcf7bdbec39f1bfa99`
- Processing: remove the first and last two seconds as loop handles, crossfade the original ending into the opening, then encode at 128 kbps
- Terms recorded at generation: <https://elevenlabs.io/music-api-terms>

The source prompt and two alternate prompts live in `scripts/generate-music.ts`. Regenerate a candidate locally with:

```sh
read -s ELEVENLABS_API_KEY
export ELEVENLABS_API_KEY
npm run generate:music -- velvet-court --output /tmp/coup-music-candidates
unset ELEVENLABS_API_KEY
```

## Endgame stingers

The Music v2 source prompts for both stingers are also recorded in the generation script. Each mastered file is about seven seconds and 110 KB.

- `court-crowned.mp3`: victory, SHA-256 `01471265720a40455e9047474d595ca7cda824d5e2028d38ffe5e5bdbbdfd27f`
- `plot-unraveled.mp3`: defeat, SHA-256 `f1b5b6f729154d3cf6160c997dcdced39b9df8ecff4f98f62570397e489b8797`

Never put a real API key in `.env` files that are committed, browser code, issue comments, build arguments, or generated metadata.
