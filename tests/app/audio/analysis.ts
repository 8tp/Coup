/**
 * Level analysis for the offline audio render. Pure functions over sample data:
 * no Web Audio, no DOM, so the same code runs in the browser harness (bundled
 * by esbuild) and under vitest.
 *
 * PEAK ALONE IS MISLEADING. A mastered stinger and a 60ms synth blip can share a
 * peak and be 12dB apart in perceived loudness, because the blip is one
 * transient and the stinger is a second of sustained energy. chudopoly's gate
 * shipped a peak-vs-peak comparison that read PASS on a build whose owner could
 * not hear the music; the fix there was to stop comparing peaks. So every cue
 * here is reported as BOTH a true peak and an RMS taken over the cue's own
 * active window — the second number is the one that tracks what a player hears,
 * and the tier ordering is asserted on it as well as on the peak.
 */

/** dBFS for a linear magnitude. Silence is −Infinity, and that is intentional. */
export function toDbfs(magnitude: number): number {
  return magnitude > 0 ? 20 * Math.log10(magnitude) : -Infinity;
}

/** Largest absolute sample across all channels. */
export function peakOf(channels: readonly Float32Array[]): number {
  let peak = 0;
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) {
      const a = Math.abs(ch[i]);
      if (a > peak) peak = a;
    }
  }
  return peak;
}

/**
 * The cue's own active window: [first, last) sample indices whose magnitude
 * clears `floorDb` below the cue's peak, on any channel.
 *
 * A fixed render length would make RMS a function of how much trailing silence
 * the harness happened to render, which is a measurement of the harness. −45dB
 * below peak is low enough to include a stinger's ring-out and high enough to
 * exclude the noise floor of a bandpassed burst.
 */
export function activeWindow(
  channels: readonly Float32Array[],
  floorDb = -45,
): { start: number; end: number } {
  const peak = peakOf(channels);
  if (peak <= 0) return { start: 0, end: 0 };
  const threshold = peak * Math.pow(10, floorDb / 20);
  const n = channels[0]?.length ?? 0;
  let start = -1;
  let end = 0;
  for (let i = 0; i < n; i++) {
    let loud = false;
    for (const ch of channels) {
      if (Math.abs(ch[i]) >= threshold) { loud = true; break; }
    }
    if (loud) {
      if (start < 0) start = i;
      end = i + 1;
    }
  }
  return start < 0 ? { start: 0, end: 0 } : { start, end };
}

/**
 * RMS over a sample range, summed across channels and divided by the channel
 * count — so a mono-in-stereo cue and a hard-panned one are compared on the
 * same scale rather than the panned one reading 3dB quiet.
 */
export function rmsOf(
  channels: readonly Float32Array[],
  start: number,
  end: number,
): number {
  const span = end - start;
  if (span <= 0 || channels.length === 0) return 0;
  let sum = 0;
  for (const ch of channels) {
    for (let i = start; i < end; i++) sum += ch[i] * ch[i];
  }
  return Math.sqrt(sum / (span * channels.length));
}

/** Window for the short-term loudness figure. See `shortTermRms`. */
export const SHORT_TERM_MS = 300;

/**
 * The loudest `windowMs` sliding-window RMS in the render.
 *
 * ── WHY THIS EXISTS ALONGSIDE ACTIVE-WINDOW RMS ─────────────────────────────
 * Active-window RMS is a function of how long the cue rings. A 6-second
 * mastered stinger with a reverb tail and a 60ms square blip can be equally
 * loud where it counts and read 10dB apart, because the stinger's average is
 * dragged down by five seconds of decay the blip does not have. That makes
 * active-window RMS unusable for comparing cues of different LENGTHS, which is
 * exactly what a tier ordering does.
 *
 * A fixed 300ms window is duration-independent: it asks "at its loudest, how
 * much energy does this cue put into the room over the time a listener
 * integrates?" — which is the number the tier rule is actually about. The tier
 * gate runs on this and on true peak. Active-window RMS stays in the record
 * because it is what shows a cue is all transient or all sustain.
 */
export function shortTermRms(
  channels: readonly Float32Array[],
  sampleRate: number,
  windowMs = SHORT_TERM_MS,
): number {
  const n = channels[0]?.length ?? 0;
  const chCount = channels.length;
  if (n === 0 || chCount === 0) return 0;
  const w = Math.min(n, Math.max(1, Math.round((windowMs / 1000) * sampleRate)));

  // Prefix sums of the per-sample cross-channel square sum: O(n) rather than
  // O(n·w), which matters at 9s × 48kHz × 22 cues.
  const prefix = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const ch of channels) s += ch[i] * ch[i];
    prefix[i + 1] = prefix[i] + s;
  }
  let best = 0;
  for (let i = 0; i + w <= n; i++) {
    const mean = (prefix[i + w] - prefix[i]) / (w * chCount);
    if (mean > best) best = mean;
  }
  return Math.sqrt(best);
}

/* ── spectrum ─────────────────────────────────────────────────────────────── */

/**
 * In-place iterative radix-2 Cooley-Tukey FFT. `re`/`im` must be the same
 * power-of-two length.
 *
 * Hand-rolled rather than pulled in, because this file is imported by both the
 * esbuild-bundled browser harness and vitest, and a dependency that exists only
 * to compare two cues' spectra is a dependency the app now ships a resolution
 * for. It is thirty lines.
 */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n <= 1) return;
  // bit reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k];
        const ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr;
        im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr;
        im[i + k + len / 2] = ui - vi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/**
 * Octave-band centres, ISO. The bottom two are the ones that matter here:
 * `influenceLoss` and `challengeRevealFail` both live down there and `denied`
 * deliberately does not.
 */
export const OCTAVE_CENTRES = [63, 125, 250, 500, 1000, 2000, 4000, 8000] as const;

/** Everything below this is "chest". A refusal must not have any. */
export const LOW_BAND_HZ = 160;

export interface Spectrum {
  /** Energy per octave band, dB relative to the cue's TOTAL energy. */
  bandsDb: number[];
  /** Energy below LOW_BAND_HZ, dB relative to total. The confusion axis. */
  lowDb: number;
  /** Power-weighted mean frequency, Hz. */
  centroidHz: number;
}

/**
 * Octave-band energy over the cue's active window, normalised to the cue's own
 * total energy — so this describes SHAPE, not level. Two cues at the same trim
 * and two cues 20dB apart give the same answer here, which is the point: the
 * tier table already gates level, and this gates timbre.
 *
 * Summed across channels, Hann-windowed, zero-padded to a power of two.
 */
export function spectrumOf(
  channels: readonly Float32Array[],
  sampleRate: number,
  floorDb = -45,
): Spectrum {
  const { start, end } = activeWindow(channels, floorDb);
  const span = end - start;
  if (span <= 0) return { bandsDb: OCTAVE_CENTRES.map(() => -Infinity), lowDb: -Infinity, centroidHz: 0 };
  let n = 1;
  while (n < span) n <<= 1;
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < span; i++) {
    let s = 0;
    for (const ch of channels) s += ch[start + i];
    // Hann, so a truncated cue does not smear its own edges across the bands.
    re[i] = s * 0.5 * (1 - Math.cos((2 * Math.PI * i) / (span - 1 || 1)));
  }
  fftInPlace(re, im);

  const half = n >> 1;
  const power = new Float64Array(half);
  let total = 0;
  for (let k = 0; k < half; k++) {
    power[k] = re[k] * re[k] + im[k] * im[k];
    total += power[k];
  }
  const hzPerBin = sampleRate / n;
  const sumRange = (loHz: number, hiHz: number): number => {
    let s = 0;
    const k0 = Math.max(0, Math.ceil(loHz / hzPerBin));
    const k1 = Math.min(half - 1, Math.floor(hiHz / hzPerBin));
    for (let k = k0; k <= k1; k++) s += power[k];
    return s;
  };
  const rel = (v: number): number => (total > 0 && v > 0 ? round2(10 * Math.log10(v / total)) : -Infinity);

  let weighted = 0;
  for (let k = 1; k < half; k++) weighted += power[k] * k * hzPerBin;

  return {
    bandsDb: OCTAVE_CENTRES.map(c => rel(sumRange(c / Math.SQRT2, c * Math.SQRT2))),
    lowDb: rel(sumRange(0, LOW_BAND_HZ)),
    centroidHz: total > 0 ? round2(weighted / total) : 0,
  };
}

export interface CueMeasurement {
  /** True peak, dBFS. */
  peakDb: number;
  /** RMS over the active window, dBFS. Duration-dependent — see shortTermRms. */
  rmsDb: number;
  /** Loudest 300ms sliding-window RMS, dBFS. The tier-ordering loudness axis. */
  stRmsDb: number;
  /** Active window length in milliseconds — the window `rmsDb` was taken over. */
  activeMs: number;
  /** When the true peak occurs, ms from render start. */
  peakMs: number;
}

/** Peak, active-window RMS, short-term RMS and window length for one render. */
export function measure(
  channels: readonly Float32Array[],
  sampleRate: number,
  floorDb = -45,
): CueMeasurement {
  const peak = peakOf(channels);
  const { start, end } = activeWindow(channels, floorDb);
  let peakIndex = 0;
  outer: for (let i = 0; i < (channels[0]?.length ?? 0); i++) {
    for (const ch of channels) {
      if (Math.abs(ch[i]) >= peak) { peakIndex = i; break outer; }
    }
  }
  return {
    peakMs: round2((peakIndex / sampleRate) * 1000),
    peakDb: round2(toDbfs(peak)),
    rmsDb: round2(toDbfs(rmsOf(channels, start, end))),
    stRmsDb: round2(toDbfs(shortTermRms(channels, sampleRate))),
    activeMs: round2(((end - start) / sampleRate) * 1000),
  };
}

function round2(v: number): number {
  return Number.isFinite(v) ? Math.round(v * 100) / 100 : v;
}
