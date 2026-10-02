/**
 * ── THE MIX GATE ────────────────────────────────────────────────────────────
 *
 * Plain vitest. No Web Audio, no jsdom, no AudioContext — this file asserts the
 * RECORDED offline-render measurements in `measurements.ts` against the trim and
 * tier tables in `SoundEngine.ts`. The render itself happens in a real browser
 * (see docs/AUDIO-MIX.md); this is the part that runs on every commit.
 *
 * What makes it a gate rather than a snapshot: `MEASURED_TRIM_DB` pins the trims
 * the levels were taken at. Edit MIX_DB without re-rendering and the first test
 * fails; re-render and the ordering tests judge the new numbers. There is no
 * path where a trim changes and nothing checks the result.
 *
 * The ordering runs on 300ms loudness, not on peak. Ranking cues by peak is the
 * mistake this whole exercise exists to undo: a 150ms noise swish carries 18dB
 * of crest and a sustained sine carries 7dB, so peak puts the swish above a
 * lost influence that is plainly louder to a listener. Peak is still gated —
 * against the soft-clip ceiling, and for the headline rule that no routine cue
 * may stab above any loss.
 */
import { describe, expect, it } from 'vitest';
import {
  HERO_CLIP_GAIN,
  MIX_TIER_OF,
  MIX_TRIM_DB,
  VOICE_TAIL_S,
  softClipCeiling,
  type MixTier,
  type SoundId,
} from '@/app/audio/SoundEngine';
import {
  MEASURED,
  MEASURED_AT,
  MEASURED_BEDS,
  MEASURED_MASKING,
  MEASURED_CLIP_CONTRAST,
  MEASURED_CLIP_PAIRS,
  MEASURED_CONTRAST,
  MEASURED_HERO_CLIP,
  MEASURED_HERO_CLIP_GAIN,
  MEASURED_PAIRS,
  MEASURED_PEAK_DBFS,
  MEASURED_ST_RMS_DBFS,
  MEASURED_TRIM_DB,
  SOFT_CLIP_CEILING_DBFS,
  shippedLevels,
  type ClipLevels,
} from './measurements';

/** Minimum gap between adjacent tiers, in dB. Below this it is a coin-flip. */
const TIER_MARGIN_DB = 1.5;

/** Minimum gap between the quietest loss and the loudest routine cue, on peak. */
const STAB_MARGIN_DB = 1.5;

/**
 * Clip and fallback must land this close on loudness. Was 1.5dB when only the
 * two stingers had clips; every clip is now SOLVED onto its fallback (the
 * harness iterates to <0.05dB), so anything wider than this is a gain that was
 * not re-solved.
 */
const HERO_PARITY_DB = 0.25;

/**
 * How much gain reduction a single cue may take before it is the LIMITER, not
 * MIX_DB, setting its level. 3dB is generous; the shipped worst is 2.11dB.
 */
const MAX_LIMITER_DB = 3;

/** And for two cues landing in the same beat. */
const MAX_PAIR_LIMITER_DB = 3;

const IDS = Object.keys(MIX_TRIM_DB) as SoundId[];
const TIERS: MixTier[] = [0, 1, 2, 3, 4];

function idsInTier(tier: MixTier): SoundId[] {
  return IDS.filter(id => MIX_TIER_OF[id] === tier);
}

describe('audio mix — the measurements are current', () => {
  it(`MIX_DB has not moved since the render on ${MEASURED_AT}`, () => {
    // If this fails, MIX_DB was edited without re-running the offline render.
    // Every level in measurements.ts now describes a mix nobody hears.
    // Fix: re-render (docs/AUDIO-MIX.md) and paste the new table.
    expect(MIX_TRIM_DB).toEqual(MEASURED_TRIM_DB);
  });

  it('the hero-clip gains have not moved since the render', () => {
    expect(HERO_CLIP_GAIN).toEqual(MEASURED_HERO_CLIP_GAIN);
  });

  it('every cue has a trim, a tier and a measurement', () => {
    for (const id of IDS) {
      expect(MIX_TIER_OF[id], `${id} has no tier`).toBeTypeOf('number');
      expect(MEASURED[id], `${id} has no measurement`).toBeDefined();
    }
    expect(Object.keys(MEASURED).sort()).toEqual([...IDS].sort());
  });

  it('every tier has at least one cue in it', () => {
    for (const tier of TIERS) expect(idsInTier(tier).length).toBeGreaterThan(0);
  });
});

describe('audio mix — consequence tracks loudness', () => {
  it.each([0, 1, 2, 3] as MixTier[])(
    'tier %i sits at least 1.5dB above the tier below it',
    (upper) => {
      const lower = (upper + 1) as MixTier;
      const quietestAbove = idsInTier(upper)
        .reduce((a, id) => Math.min(a, MEASURED_ST_RMS_DBFS[id]), Infinity);
      const loudestBelow = idsInTier(lower)
        .reduce((a, id) => Math.max(a, MEASURED_ST_RMS_DBFS[id]), -Infinity);
      const margin = quietestAbove - loudestBelow;
      expect(
        margin,
        `tier ${upper} bottoms out at ${quietestAbove.toFixed(2)} dBFS loud and `
        + `tier ${lower} tops out at ${loudestBelow.toFixed(2)} — margin `
        + `${margin.toFixed(2)}dB, need ${TIER_MARGIN_DB}`,
      ).toBeGreaterThanOrEqual(TIER_MARGIN_DB);
    },
  );

  it('the whole ladder is strictly ordered, tier by tier', () => {
    const bottoms = TIERS.map(t => idsInTier(t)
      .reduce((a, id) => Math.min(a, MEASURED_ST_RMS_DBFS[id]), Infinity));
    const tops = TIERS.map(t => idsInTier(t)
      .reduce((a, id) => Math.max(a, MEASURED_ST_RMS_DBFS[id]), -Infinity));
    for (let t = 0; t < TIERS.length - 1; t++) {
      expect(bottoms[t], `tier ${t} bottom vs tier ${t + 1} top`)
        .toBeGreaterThan(tops[t + 1]);
    }
  });

  it('no routine cue is louder than any loss — the named case', () => {
    // The inversion the trims exist to fix, spelled out so it cannot be lost
    // in a refactor of the loop above.
    expect(MEASURED_ST_RMS_DBFS.influenceLoss)
      .toBeGreaterThan(MEASURED_ST_RMS_DBFS.cardShuffle + TIER_MARGIN_DB);
    expect(MEASURED_ST_RMS_DBFS.influenceLoss)
      .toBeGreaterThan(MEASURED_ST_RMS_DBFS.coinsGained + TIER_MARGIN_DB);
    expect(MEASURED_ST_RMS_DBFS.challengeRevealFail)
      .toBeGreaterThan(MEASURED_ST_RMS_DBFS.coinsGained + TIER_MARGIN_DB);
    expect(MEASURED_ST_RMS_DBFS.influenceLoss)
      .toBeGreaterThan(MEASURED_ST_RMS_DBFS.yourTurn + TIER_MARGIN_DB);
    // A refusal is chrome. Losing an influence must stay well above being told
    // "no" — the refusal is the most frequently fired cue in a fumbled turn.
    expect(MEASURED_ST_RMS_DBFS.influenceLoss)
      .toBeGreaterThan(MEASURED_ST_RMS_DBFS.denied + TIER_MARGIN_DB);
    expect(MEASURED_ST_RMS_DBFS.challengeRevealFail)
      .toBeGreaterThan(MEASURED_ST_RMS_DBFS.denied + TIER_MARGIN_DB);
  });

  it('no routine cue STABS above a loss on true peak either', () => {
    const loss = [...idsInTier(0), ...idsInTier(1)];
    const routine = [...idsInTier(3), ...idsInTier(4)];
    const quietestLoss = loss.reduce(
      (a, id) => (MEASURED_PEAK_DBFS[id] < MEASURED_PEAK_DBFS[a] ? id : a), loss[0],
    );
    const hottestRoutine = routine.reduce(
      (a, id) => (MEASURED_PEAK_DBFS[id] > MEASURED_PEAK_DBFS[a] ? id : a), routine[0],
    );
    const margin = MEASURED_PEAK_DBFS[quietestLoss] - MEASURED_PEAK_DBFS[hottestRoutine];
    expect(
      margin,
      `${quietestLoss} peaks at ${MEASURED_PEAK_DBFS[quietestLoss]} dBFS and `
      + `${hottestRoutine} peaks at ${MEASURED_PEAK_DBFS[hottestRoutine]} — `
      + `margin ${margin.toFixed(2)}dB, need ${STAB_MARGIN_DB}`,
    ).toBeGreaterThanOrEqual(STAB_MARGIN_DB);
  });
});

describe('audio mix — the ceiling is a property of the graph', () => {
  it('softClipCeiling matches the recorded ceiling', () => {
    const db = 20 * Math.log10(softClipCeiling(0.7));
    expect(db).toBeCloseTo(SOFT_CLIP_CEILING_DBFS, 3);
  });

  it('no cue reaches the soft-clip ceiling', () => {
    for (const id of IDS) {
      expect(MEASURED_PEAK_DBFS[id], `${id} peak`).toBeLessThan(SOFT_CLIP_CEILING_DBFS);
    }
    for (const [id, variants] of Object.entries(MEASURED_HERO_CLIP)) {
      for (const [v, levels] of (variants ?? []).entries()) {
        expect(levels.peakDb, `${id} clip ${v} peak`).toBeLessThan(SOFT_CLIP_CEILING_DBFS);
      }
    }
  });

  it('no cue has its level set by the limiter rather than by MIX_DB', () => {
    for (const id of IDS) {
      expect(MEASURED[id].limiterDb, `${id} gain reduction`)
        .toBeLessThanOrEqual(MAX_LIMITER_DB);
    }
    for (const [id, variants] of Object.entries(MEASURED_HERO_CLIP)) {
      for (const [v, levels] of (variants ?? []).entries()) {
        expect(levels.limiterDb, `${id} clip ${v} gain reduction`)
          .toBeLessThanOrEqual(MAX_LIMITER_DB);
      }
    }
  });

  it('two cues in one beat do not sum into the limiter', () => {
    expect(MEASURED_PAIRS.length).toBeGreaterThan(0);
    for (const pair of MEASURED_PAIRS) {
      expect(pair.peakDb, `${pair.label} peak`).toBeLessThan(SOFT_CLIP_CEILING_DBFS);
      expect(pair.limiterDb, `${pair.label} gain reduction`)
        .toBeLessThanOrEqual(MAX_PAIR_LIMITER_DB);
    }
  });
});

/**
 * ── THE REFUSAL IS NOT A LOSS ───────────────────────────────────────────────
 *
 * Level is only half of "this cue is right". `timerWarning` stood in for a
 * refusal for a whole release at exactly the correct tier-4 weight and entirely
 * the wrong shape, and no assertion in this file could have caught that — every
 * gate above compares dBFS.
 *
 * These run on `MEASURED_CONTRAST`, which is octave-band energy normalised to
 * each cue's own total, so it is a statement about TIMBRE that survives any
 * future retune of the trims.
 */
describe('audio mix — denied cannot be mistaken for a loss', () => {
  const denied = MEASURED_CONTRAST.denied;
  const influenceLoss = MEASURED_CONTRAST.influenceLoss;
  const challengeRevealFail = MEASURED_CONTRAST.challengeRevealFail;
  const timerWarning = MEASURED_CONTRAST.timerWarning;

  it('is chrome: tier 4, non-priority, and quieter than every tier 0–2 cue', () => {
    expect(MIX_TIER_OF.denied).toBe(4);
    const consequential = IDS.filter(id => MIX_TIER_OF[id] <= 2);
    for (const id of consequential) {
      expect(
        MEASURED_ST_RMS_DBFS[id],
        `denied (${MEASURED_ST_RMS_DBFS.denied}) must sit under ${id}`,
      ).toBeGreaterThan(MEASURED_ST_RMS_DBFS.denied + TIER_MARGIN_DB);
    }
  });

  it('is over before either loss cue is a third done', () => {
    // 88ms against 346 and 715. A refusal that lingers reads as damage done.
    expect(denied.activeMs).toBeLessThan(influenceLoss.activeMs / 3);
    expect(denied.activeMs).toBeLessThan(challengeRevealFail.activeMs / 3);
  });

  it('is a buzz, not a tone — influenceLoss is one octave band, denied is three', () => {
    // influenceLoss is a bare sine: everything in one band, the runner-up 32dB
    // down. denied is a filtered square and spreads. Two objects, not one
    // object at two pitches.
    const spread = (c: { bandsDb: readonly number[] }): number => {
      const sorted = [...c.bandsDb].sort((a, b) => b - a);
      return sorted[0] - sorted[2];
    };
    expect(spread(influenceLoss)).toBeGreaterThan(60);
    expect(spread(denied)).toBeLessThan(20);
  });

  it('has no chest — challengeRevealFail is bass, denied is mid', () => {
    // challengeRevealFail puts essentially all of itself under 160Hz.
    expect(challengeRevealFail.lowDb).toBeGreaterThan(-3);
    // denied puts ~1%, and its centroid is an octave and a half higher.
    expect(denied.lowDb).toBeLessThan(challengeRevealFail.lowDb - 12);
    expect(denied.centroidHz).toBeGreaterThan(challengeRevealFail.centroidHz * 2);
  });

  it('is closed, unlike the timerWarning it replaces', () => {
    // The 1400→760Hz lowpass over the two squares. A muted buzzer behind a
    // door, not the alarm in the room that was standing in for it.
    expect(timerWarning.centroidHz).toBeGreaterThan(1200);
    expect(denied.centroidHz).toBeLessThan(timerWarning.centroidHz / 3);
  });

  it('a double-tap does not stab into the limiter', () => {
    // The player taps a refused control twice. RATE_DEFAULT drops anything
    // inside 80ms, so 90ms is the tightest real beat; the render gives both
    // taps full gain where the live second one is flammed to −2.5dB.
    const pair = MEASURED_PAIRS.find(p => p.label === 'denied x2 @90ms');
    expect(pair, 'denied x2 not in MEASURED_PAIRS').toBeDefined();
    if (!pair) return;
    expect(pair.limiterDb).toBeLessThanOrEqual(MAX_PAIR_LIMITER_DB);
    expect(pair.peakDb).toBeLessThan(SOFT_CLIP_CEILING_DBFS);
    // And it is still under every loss on loudness even summed.
    expect(pair.stRmsDb).toBeLessThan(MEASURED_ST_RMS_DBFS.influenceLoss);
  });
});

describe('audio mix — the fallback matches the clip it replaces', () => {
  it.each(Object.keys(MEASURED_HERO_CLIP) as SoundId[])(
    `%s: every mastered variant and the synth fallback land within ${HERO_PARITY_DB}dB`,
    (id) => {
      const variants = MEASURED_HERO_CLIP[id];
      expect(variants?.length, `${id} has no clip measurement`).toBeGreaterThan(0);
      for (const [v, clip] of (variants ?? []).entries()) {
        const delta = Math.abs(clip.stRmsDb - MEASURED[id].stRmsDb);
        expect(
          delta,
          `${id} variant ${v}: clip ${clip.stRmsDb} dBFS loud vs fallback ${MEASURED[id].stRmsDb} — `
          + `${delta.toFixed(2)}dB apart. A fallback at a different level from the `
          + 'clip is a bug nobody notices until the fetch fails.',
        ).toBeLessThanOrEqual(HERO_PARITY_DB);
      }
    },
  );

  it('every hero clip variant in the engine has a recorded measurement', () => {
    for (const [id, gains] of Object.entries(HERO_CLIP_GAIN) as [SoundId, readonly number[]][]) {
      expect(MEASURED_HERO_CLIP[id]?.length, `${id}: ${gains.length} variants, measured `
        + `${MEASURED_HERO_CLIP[id]?.length ?? 0}`).toBe(gains.length);
    }
    expect(Object.keys(MEASURED_HERO_CLIP).sort()).toEqual(Object.keys(HERO_CLIP_GAIN).sort());
  });

  it('the voice budget covers every routine clip for as long as it sounds', () => {
    // VOICE.tail is how long a voice holds its budget slot. A coin clip that
    // rings 420ms on a 200ms tail lets the budget admit voices the graph is
    // still playing. The two mastered stingers are exempt: priority voices
    // only meet the runaway cap.
    for (const [id, variants] of Object.entries(MEASURED_HERO_CLIP) as [SoundId, readonly ClipLevels[]][]) {
      if (id === 'gameOverWin' || id === 'gameOverLose') continue;
      const longest = Math.max(...variants.map(v => v.activeMs));
      expect(VOICE_TAIL_S[id] * 1000, `${id}: tail ${VOICE_TAIL_S[id]}s vs clip ${longest}ms`)
        .toBeGreaterThanOrEqual(longest);
    }
  });
});

/**
 * ── THE SHIPPED LADDER ──────────────────────────────────────────────────────
 *
 * The tests above order the SYNTH bank, which since 2026-10-01 is what plays
 * only when a fetch fails. What a player hears is the clips. Parity (above)
 * keeps each clip within HERO_PARITY_DB of its fallback on loudness, but a
 * clip's PEAK is its own — a recorded coin clink carries far more crest than a
 * sine — so the headline rules are asserted again on the ladder as shipped:
 * every variant of every hero cue, and the synth voice for anything without
 * one.
 */
describe('audio mix — the shipped ladder (clips) holds the same rules', () => {
  const shippedSt = (id: SoundId): number[] => shippedLevels(id).map(l => l.stRmsDb);
  const shippedPeak = (id: SoundId): number[] => shippedLevels(id).map(l => l.peakDb);

  it.each([0, 1, 2, 3] as MixTier[])(
    'tier %i sits at least 1.5dB above the tier below it, as shipped',
    (upper) => {
      const lower = (upper + 1) as MixTier;
      const quietestAbove = Math.min(...idsInTier(upper).flatMap(shippedSt));
      const loudestBelow = Math.max(...idsInTier(lower).flatMap(shippedSt));
      expect(
        quietestAbove - loudestBelow,
        `shipped tier ${upper} bottoms at ${quietestAbove} and tier ${lower} tops at ${loudestBelow}`,
      ).toBeGreaterThanOrEqual(TIER_MARGIN_DB);
    },
  );

  it('no routine clip STABS above a loss on true peak', () => {
    const quietestLoss = Math.min(...[...idsInTier(0), ...idsInTier(1)].flatMap(shippedPeak));
    const hottestRoutine = Math.max(...[...idsInTier(3), ...idsInTier(4)].flatMap(shippedPeak));
    expect(
      quietestLoss - hottestRoutine,
      `quietest loss peaks at ${quietestLoss} dBFS, hottest routine at ${hottestRoutine}`,
    ).toBeGreaterThanOrEqual(STAB_MARGIN_DB);
  });

  it('the beats a game produces, as clips, do not sum into the limiter', () => {
    expect(MEASURED_CLIP_PAIRS.length).toBe(MEASURED_PAIRS.length);
    for (const pair of MEASURED_CLIP_PAIRS) {
      expect(pair.peakDb, `${pair.label} peak`).toBeLessThan(SOFT_CLIP_CEILING_DBFS);
      expect(pair.limiterDb, `${pair.label} gain reduction`).toBeLessThanOrEqual(MAX_PAIR_LIMITER_DB);
    }
    const tap = MEASURED_CLIP_PAIRS.find(p => p.label === 'denied x2 @90ms');
    expect(tap, 'denied x2 not in MEASURED_CLIP_PAIRS').toBeDefined();
    expect(tap?.stRmsDb ?? 0).toBeLessThan(Math.min(...shippedSt('influenceLoss')));
  });
});

/**
 * The refusal-is-not-a-loss contrast, on the clips. `influenceLoss`'s clip is a
 * card slammed and torn, not a bare sine, so the synth-only "one octave band"
 * test does not transfer — but every separation that is about the OBJECT
 * rather than the synthesis method does, and is asserted here.
 */
describe('audio mix — the denied clip cannot be mistaken for a loss clip', () => {
  const denied = MEASURED_CLIP_CONTRAST.denied;
  const influenceLoss = MEASURED_CLIP_CONTRAST.influenceLoss;
  const challengeRevealFail = MEASURED_CLIP_CONTRAST.challengeRevealFail;
  const timerWarning = MEASURED_CLIP_CONTRAST.timerWarning;

  it('every contrast cue has a clip measurement', () => {
    for (const c of [denied, influenceLoss, challengeRevealFail, timerWarning]) expect(c).toBeDefined();
  });

  it('is over before either loss clip is a third done', () => {
    expect(denied.activeMs).toBeLessThan(influenceLoss.activeMs / 3);
    expect(denied.activeMs).toBeLessThan(challengeRevealFail.activeMs / 3);
  });

  it('has no chest — the caught bluff is bass, the refusal is mid', () => {
    expect(challengeRevealFail.lowDb).toBeGreaterThan(-3);
    expect(denied.lowDb).toBeLessThan(challengeRevealFail.lowDb - 12);
    expect(denied.centroidHz).toBeGreaterThan(challengeRevealFail.centroidHz * 2);
  });

  it('is a dull knock, not the torn card — a different region of the spectrum', () => {
    // influenceLoss is paper: its weight is above 2kHz. denied is a padded
    // knock behind a 240Hz highpass: its weight is 250–500Hz.
    expect(influenceLoss.centroidHz).toBeGreaterThan(denied.centroidHz * 4);
  });

  it('is closed, unlike the timerWarning tick', () => {
    expect(timerWarning.centroidHz).toBeGreaterThan(1200);
    expect(denied.centroidHz).toBeLessThan(timerWarning.centroidHz / 3);
  });
});

/**
 * ── CUE OVER BED ────────────────────────────────────────────────────────────
 *
 * Measured for the first time on 2026-10-01. Broadband, the table bed sits at
 * −26.4 dBFS on the cues' 300ms axis — above every tier-3 and tier-4 cue —
 * because velvet-court is almost all bass. That number is the wrong question.
 * What decides whether a cue is heard over a bed is the cue's OWN loudest
 * octave against the bed's level in that octave, which is what
 * MEASURED_MASKING records (chudopoly's rule: a card sound clears every
 * in-match bed in its own loudest octave).
 *
 * The thresholds are what the shipped bank clears with room to notice a
 * regression, not chudopoly's 6dB: `denied`'s loudest octave is 500Hz and a
 * tier-4 cue cannot be made louder without collapsing the 3/4 boundary, so it
 * clears the table bed by 3.1dB. Ducking is not counted — the consequence
 * cues (tier 0–1, coup) dip the bed a further 3–6dB live.
 */
describe('audio mix — every cue clears the bed it plays over, in its own octave', () => {
  const IN_MATCH = ['table', 'endgame'] as const;
  const ROUTINE_MIN_DB = 4;
  const CHROME_MIN_DB = 2.5;

  it('every bed has been measured', () => {
    for (const bed of ['lobby', 'table', 'endgame']) expect(MEASURED_BEDS[bed], bed).toBeDefined();
    expect(Object.keys(MEASURED_MASKING).sort()).toEqual([...IDS].sort());
  });

  it.each(IDS)('%s clears both in-match beds', (id) => {
    const m = MEASURED_MASKING[id];
    const need = MIX_TIER_OF[id] === 4 ? CHROME_MIN_DB : ROUTINE_MIN_DB;
    for (const bed of IN_MATCH) {
      expect(m.margins[bed], `${id} @${m.octaveHz}Hz vs ${bed}: ${m.margins[bed]}dB`)
        .toBeGreaterThanOrEqual(need);
    }
  });

  it('a chat message clears the lobby bed — the one cue the lobby plays', () => {
    expect(MEASURED_MASKING.chatMessage.margins.lobby).toBeGreaterThanOrEqual(CHROME_MIN_DB);
  });
});
