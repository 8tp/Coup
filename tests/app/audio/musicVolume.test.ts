import { describe, expect, it } from 'vitest';
import { MUSIC_VOLUME_DEFAULT, musicVolumeGain } from '@/app/audio/SoundEngine';

describe('musicVolumeGain', () => {
  it('leaves the measured mix untouched at the default', () => {
    expect(musicVolumeGain(MUSIC_VOLUME_DEFAULT)).toBeCloseTo(1, 10);
  });

  it('spans −12 dB to +12 dB and clamps outside 0–100', () => {
    expect(20 * Math.log10(musicVolumeGain(0))).toBeCloseTo(-12, 6);
    expect(20 * Math.log10(musicVolumeGain(100))).toBeCloseTo(12, 6);
    expect(musicVolumeGain(-20)).toBe(musicVolumeGain(0));
    expect(musicVolumeGain(140)).toBe(musicVolumeGain(100));
  });
});
