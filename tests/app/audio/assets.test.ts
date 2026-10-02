/**
 * Every audio URL the engine can request exists, is small, and is precached by
 * the service worker under a cache name that changed when the bank did. Plain
 * file checks — the levels are mix.test.ts's job.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { heroClips, MUSIC_BEDS } from '@/app/audio/SoundEngine';

const PUBLIC = path.resolve(__dirname, '../../../public');
const sw = readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');

const clipUrls = Object.values(heroClips()).flatMap(clips => (clips ?? []).map(c => c.url));
const bedUrls = Object.values(MUSIC_BEDS).map(b => b.url);

describe('audio assets', () => {
  it.each([...clipUrls, ...bedUrls])('%s exists and is precached', (url) => {
    expect(existsSync(path.join(PUBLIC, url)), `${url} missing from public/`).toBe(true);
    expect(sw.includes(`'${url}'`), `${url} not in public/sw.js ASSET_URLS`).toBe(true);
  });

  it('every sound-effect clip stays under 60KB', () => {
    for (const url of clipUrls.filter(u => u.startsWith('/audio/sfx/'))) {
      expect(statSync(path.join(PUBLIC, url)).size, url).toBeLessThan(60 * 1024);
    }
  });

  it('the service worker cache name moved past the pre-ElevenLabs bank', () => {
    const version = Number(sw.match(/coup-assets-v(\d+)/)?.[1]);
    expect(version).toBeGreaterThanOrEqual(5);
  });

  it('no precached audio URL points at a file that is gone', () => {
    for (const m of sw.matchAll(/'(\/audio\/[^']+)'/g)) {
      expect(existsSync(path.join(PUBLIC, m[1])), m[1]).toBe(true);
    }
  });

  it('every bed loops over a region inside its file, a whole number of 84-BPM bars long', () => {
    for (const [track, bed] of Object.entries(MUSIC_BEDS)) {
      expect(bed.loopStart, track).toBeGreaterThan(0);
      const bars = (bed.loopEnd - bed.loopStart) / (240 / bed.bpm);
      expect(Math.abs(bars - Math.round(bars)), `${track}: ${bars.toFixed(3)} bars`).toBeLessThan(0.01);
    }
  });
});
