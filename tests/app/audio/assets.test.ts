/**
 * Every audio URL the engine can request exists and is sized for its job.
 * Sound effects are small and precached by the service worker; music is large
 * and deliberately NOT precached — the engine fetches the piece it is about to
 * play and prefetches the next, and the service worker caches each at runtime.
 * Plain file checks — the levels are mix.test.ts's job.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { heroClips, MUSIC_POOLS, MUSIC_STATES } from '@/app/audio/SoundEngine';

const PUBLIC = path.resolve(__dirname, '../../../public');
const sw = readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');

const clipUrls = Object.values(heroClips()).flatMap(clips => (clips ?? []).map(c => c.url));
const pieces = MUSIC_STATES.flatMap(state => MUSIC_POOLS[state].map(p => ({ state, ...p })));
const pieceUrls = pieces.map(p => p.url);

describe('audio assets — sound effects', () => {
  it.each(clipUrls)('%s exists and is precached', (url) => {
    expect(existsSync(path.join(PUBLIC, url)), `${url} missing from public/`).toBe(true);
    expect(sw.includes(`'${url}'`), `${url} not in public/sw.js ASSET_URLS`).toBe(true);
  });

  it('every sound-effect clip stays under 60KB', () => {
    for (const url of clipUrls.filter(u => u.startsWith('/audio/sfx/'))) {
      expect(statSync(path.join(PUBLIC, url)).size, url).toBeLessThan(60 * 1024);
    }
  });

  it('the service worker cache name moved past the looping-bed bank', () => {
    const version = Number(sw.match(/coup-assets-v(\d+)/)?.[1]);
    expect(version).toBeGreaterThanOrEqual(7);
  });

  it('no precached audio URL points at a file that is gone', () => {
    for (const m of sw.matchAll(/'(\/audio\/[^']+)'/g)) {
      expect(existsSync(path.join(PUBLIC, m[1])), m[1]).toBe(true);
    }
  });

  it('the service worker still caches /audio/ at runtime (which is how music gets cached)', () => {
    expect(sw).toMatch(/url\.pathname\.startsWith\('\/audio\/'\)/);
  });
});

describe('audio assets — the score', () => {
  it.each(pieceUrls)('%s exists and is NOT precached', (url) => {
    expect(existsSync(path.join(PUBLIC, url)), `${url} missing from public/`).toBe(true);
    expect(sw.includes(`'${url}'`), `${url} is in public/sw.js ASSET_URLS — music is fetched on demand`).toBe(false);
  });

  it('nothing under /audio/music/ is precached', () => {
    expect(sw).not.toMatch(/'\/audio\/music\//);
  });

  it('every in-game state has a pool of at least two pieces; the lobby has two', () => {
    for (const state of MUSIC_STATES) {
      expect(MUSIC_POOLS[state].length, state).toBeGreaterThanOrEqual(2);
    }
  });

  it('no piece is in two pools, and every file in public/audio/music is in a pool', () => {
    expect(new Set(pieceUrls).size).toBe(pieceUrls.length);
    const onDisk = readdirSync(path.join(PUBLIC, 'audio/music')).filter(f => f.endsWith('.mp3')).map(f => `/audio/music/${f}`);
    expect(onDisk.sort()).toEqual([...pieceUrls].sort());
  });

  it('every piece is through-composed (95–185s) with its points in order', () => {
    for (const p of pieces) {
      expect(p.durationS, p.url).toBeGreaterThanOrEqual(95);
      expect(p.durationS, p.url).toBeLessThanOrEqual(185);
      expect(p.leadInS, p.url).toBeGreaterThanOrEqual(0);
      expect(p.leadInS, p.url).toBeLessThanOrEqual(p.entryS);
      // A state change enters the body and stays a minute before the next piece.
      expect(p.handoffS - p.entryS, p.url).toBeGreaterThanOrEqual(60);
      // The outgoing tail the handoff fades over is real, and inside the file.
      expect(p.durationS - p.handoffS, p.url).toBeGreaterThanOrEqual(4);
    }
  });

  it('every piece is a sensibly sized MP3 (≤2.5MB, ~112kbps)', () => {
    for (const p of pieces) {
      const bytes = statSync(path.join(PUBLIC, p.url)).size;
      expect(bytes, p.url).toBeLessThan(2.5 * 1024 * 1024);
      const kbps = (bytes * 8) / p.durationS / 1000;
      expect(kbps, p.url).toBeGreaterThan(90);
      expect(kbps, p.url).toBeLessThan(125);
    }
  });

  it('the old looping beds are out of the playback path', () => {
    for (const url of pieceUrls) expect(url).not.toMatch(/velvet-court|table-|endgame-|lobby-antechamber\.mp3/);
  });
});
