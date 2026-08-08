import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_FORMAT = 'mp3_44100_128';
const MODEL_ID = 'music_v2';

const candidates = {
  'velvet-court': {
    title: 'Velvet Court',
    durationMs: 70_000,
    prompt: 'Loop-friendly instrumental background music for a tense social deduction card game in a decadent near-future court. Dark chamber-electronic hybrid at 84 BPM, muted cello ostinato, softly plucked viola, restrained frame drum, subtle analog bass pulse, occasional glass harmonics. Suspicious, elegant, witty, and controlled; not epic, heroic, sentimental, or horror. No vocals and no dominant lead melody. Keep a steady low intensity with no dramatic intro, climax, or final cadence. Leave generous space for UI sound effects. The opening and ending should share compatible harmony, rhythm, texture, and energy for looping.',
  },
  'clockwork-conspiracy': {
    title: 'Clockwork Conspiracy',
    durationMs: 70_000,
    prompt: 'Loop-friendly instrumental underscore for a stylish bluffing and deception card game. 92 BPM, intimate clockwork percussion, pizzicato low strings, muted hand drum, warm analog pulse, sparse dulcimer accents, and a faint breathy woodwind texture. Cunning and playful with restrained tension, like quiet plotting around a royal table. No vocals, no cinematic swells, no dominant melody, no loud impacts, and no resolved ending. Maintain consistent low intensity and leave room for interface sounds. Match the opening and ending harmony, rhythm, and instrumentation so the track can repeat cleanly.',
  },
  'gilded-knives': {
    title: 'Gilded Knives',
    durationMs: 70_000,
    prompt: 'Loop-friendly instrumental ambience for a competitive court intrigue and social deduction game. 78 BPM, dry bowed bass, sparse viola harmonics, soft brushed frame percussion, quiet prepared-piano ticks, and a restrained dark synth bed. Sophisticated, suspicious, and slightly dangerous without becoming ominous or cinematic. No vocals, no memorable lead theme, no trailer drums, no large crescendo, and no final chord. Hold an even background intensity with sonic space for alerts and card sounds. Make the beginning and ending musically compatible for a seamless repeating loop.',
  },
  'court-crowned': {
    title: 'Court Crowned',
    durationMs: 7_000,
    prompt: 'A seven-second instrumental victory stinger for winning an elegant court intrigue card game. Immediate restrained chamber fanfare with a confident cello rise, two crisp viola flourishes, a subtle metallic glint, and a warm final chord. Clever and triumphant rather than heroic or bombastic. No vocals, no drums, no long intro, and no lingering reverb tail. Deliver a clear musical cadence within exactly seven seconds.',
  },
  'plot-unraveled': {
    title: 'Plot Unraveled',
    durationMs: 7_000,
    prompt: 'A seven-second instrumental defeat stinger for losing an elegant bluffing and court intrigue card game. Immediate low viola descent, a dry muted cello answer, one soft prepared-piano tick, and a restrained unresolved final tone. Wry and disappointed, not tragic, frightening, cinematic, or comedic. No vocals, no percussion swell, no long intro, and no lingering reverb tail. Complete the musical gesture within exactly seven seconds.',
  },
} as const;

type CandidateId = keyof typeof candidates;

function isCandidateId(value: string): value is CandidateId {
  return value in candidates;
}

function parseOutputDirectory(args: string[]): string {
  const outputIndex = args.indexOf('--output');
  if (outputIndex === -1) return path.resolve('artifacts/music-candidates');
  const directory = args[outputIndex + 1];
  if (!directory) throw new Error('--output requires a directory');
  return path.resolve(directory);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const candidateId = args[0];

  if (!candidateId || !isCandidateId(candidateId)) {
    console.error(`Choose one candidate: ${Object.keys(candidates).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error('Set ELEVENLABS_API_KEY in the shell running this script. Never expose it to the browser.');
  }

  const candidate = candidates[candidateId];
  const outputDirectory = parseOutputDirectory(args);
  await mkdir(outputDirectory, { recursive: true });

  console.log(`Generating ${candidate.title} (${candidate.durationMs / 1000}s)...`);
  const response = await fetch(`https://api.elevenlabs.io/v1/music?output_format=${OUTPUT_FORMAT}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      prompt: candidate.prompt,
      music_length_ms: candidate.durationMs,
      force_instrumental: true,
      model_id: MODEL_ID,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`ElevenLabs returned ${response.status}: ${detail}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  const audioPath = path.join(outputDirectory, `${candidateId}.mp3`);
  const metadataPath = path.join(outputDirectory, `${candidateId}.json`);
  const generatedAt = new Date().toISOString();

  await Promise.all([
    writeFile(audioPath, audio),
    writeFile(metadataPath, `${JSON.stringify({
      candidateId,
      title: candidate.title,
      prompt: candidate.prompt,
      generatedAt,
      provider: 'ElevenLabs',
      modelId: MODEL_ID,
      outputFormat: OUTPUT_FORMAT,
      durationMs: candidate.durationMs,
      requestId: response.headers.get('request-id') ?? response.headers.get('x-request-id'),
      terms: 'https://elevenlabs.io/music-api-terms',
    }, null, 2)}\n`),
  ]);

  console.log(`Saved ${audioPath}`);
  console.log(`Saved ${metadataPath}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
