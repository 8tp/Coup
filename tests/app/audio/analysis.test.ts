/**
 * The spectral half of the mix gate runs on a hand-rolled FFT, and a hand-rolled
 * FFT that is wrong produces a confident, plausible, wrong answer — which is the
 * one failure mode the whole measured-mix exercise exists to avoid. So it is
 * checked against signals whose spectrum is known before the fact.
 *
 * Level analysis (peak / RMS / short-term RMS) is exercised in mix.test.ts
 * against the recorded render; this file covers only the pure DSP.
 */
import { describe, expect, it } from 'vitest';
import {
  LOW_BAND_HZ,
  OCTAVE_CENTRES,
  fftInPlace,
  spectrumOf,
} from './analysis';

const SR = 48000;

/** A steady sine, N samples, at `hz`. */
function sine(hz: number, n: number, amp = 0.5): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  return out;
}

describe('fftInPlace', () => {
  it('puts a bin-centred sinusoid in exactly that bin', () => {
    const n = 1024;
    const bin = 64;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = Math.cos((2 * Math.PI * bin * i) / n);
    fftInPlace(re, im);
    const mag = (k: number) => Math.hypot(re[k], im[k]);
    expect(mag(bin)).toBeCloseTo(n / 2, 6);
    // Everything else is numerical dust.
    for (let k = 0; k < n / 2; k++) {
      if (k === bin) continue;
      expect(mag(k)).toBeLessThan(1e-8);
    }
  });

  it('transforms a delta into a flat magnitude spectrum', () => {
    const n = 256;
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    re[0] = 1;
    fftInPlace(re, im);
    for (let k = 0; k < n; k++) expect(Math.hypot(re[k], im[k])).toBeCloseTo(1, 9);
  });

  it('is linear', () => {
    const n = 64;
    const mk = (f: (i: number) => number) => {
      const re = new Float64Array(n);
      const im = new Float64Array(n);
      for (let i = 0; i < n; i++) re[i] = f(i);
      fftInPlace(re, im);
      return { re, im };
    };
    const a = (i: number) => Math.sin(i);
    const b = (i: number) => Math.cos(i * 0.3);
    const A = mk(a);
    const B = mk(b);
    const S = mk(i => a(i) + 2 * b(i));
    for (let k = 0; k < n; k++) {
      expect(S.re[k]).toBeCloseTo(A.re[k] + 2 * B.re[k], 9);
      expect(S.im[k]).toBeCloseTo(A.im[k] + 2 * B.im[k], 9);
    }
  });
});

describe('spectrumOf', () => {
  it('lands a pure tone in its own octave band and nowhere else', () => {
    const s = spectrumOf([sine(1000, SR / 2)], SR);
    const kHz = OCTAVE_CENTRES.indexOf(1000);
    expect(s.bandsDb[kHz]).toBeGreaterThan(-0.1);
    for (let i = 0; i < s.bandsDb.length; i++) {
      if (i === kHz) continue;
      expect(s.bandsDb[i], `band ${OCTAVE_CENTRES[i]}Hz`).toBeLessThan(-40);
    }
    expect(s.centroidHz).toBeCloseTo(1000, -1);
  });

  it('reports the centroid between two equal tones', () => {
    const a = sine(400, SR / 2);
    const b = sine(1600, SR / 2);
    const mix = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) mix[i] = a[i] + b[i];
    // Equal amplitudes → equal power → the power-weighted mean is the
    // ARITHMETIC mean, not the geometric one. 1000, not 800.
    expect(spectrumOf([mix], SR).centroidHz).toBeCloseTo(1000, -1);
  });

  it('is a shape measurement, not a level measurement', () => {
    const loud = spectrumOf([sine(500, SR / 2, 0.8)], SR);
    const quiet = spectrumOf([sine(500, SR / 2, 0.008)], SR);
    // Bands 100dB down are float32 quantisation dust and do move; every band
    // that describes the sound is identical across a 40dB level change.
    for (let i = 0; i < loud.bandsDb.length; i++) {
      if (loud.bandsDb[i] < -60 && quiet.bandsDb[i] < -60) continue;
      expect(loud.bandsDb[i], `band ${OCTAVE_CENTRES[i]}Hz`).toBeCloseTo(quiet.bandsDb[i], 1);
    }
    expect(loud.centroidHz).toBeCloseTo(quiet.centroidHz, 1);
  });

  it('counts only what is under LOW_BAND_HZ as low', () => {
    expect(spectrumOf([sine(60, SR / 2)], SR).lowDb).toBeGreaterThan(-0.1);
    expect(spectrumOf([sine(LOW_BAND_HZ * 4, SR / 2)], SR).lowDb).toBeLessThan(-40);
  });

  it('returns silence rather than NaN for an empty render', () => {
    const s = spectrumOf([new Float32Array(1024)], SR);
    expect(s.lowDb).toBe(-Infinity);
    expect(s.centroidHz).toBe(0);
    expect(s.bandsDb.every(v => v === -Infinity)).toBe(true);
  });
});
