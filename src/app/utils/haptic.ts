// utils/haptic.ts -- the haptic vocabulary and the three rules that keep it
// from becoming noise.
//
//   RULE 1: never more than one pattern per event. Enforced structurally --
//   every call goes through fireHaptic(), which sends at most one pattern.
//
//   RULE 2: a 300ms floor between vibrations. A multi-card beat (a challenge
//   reveal, a double influence loss) is several events inside ~350ms; without
//   the floor that is several motor spin-ups the phone renders as one long
//   rattle, and the iOS actuator ignores the tail anyway.
//
//   RULE 3: the floor is PRIORITY-AWARE. chudopoly measured a flat 300ms
//   first-one-wins gate and the vocabulary collapsed to a single pattern:
//
//     live 150s 4-player game, 16 haptics fired, ALL of them `land` (10ms).
//     Zero targeted, zero setComplete, zero finalApproach -- across 7 set
//     completions and 3 steals.
//
//   The cheap tick always arrived first and ate everything that was earned.
//   So: a HIGHER-priority pattern beats the floor and REPLACES whatever is
//   still playing (navigator.vibrate() replaces, it does not queue). An
//   equal-or-lower one inside the window is dropped. The floor is then
//   re-armed from the winner, so a win pattern cannot be cut off by a tap.

/** Names in the vocabulary. */
export type HapticName =
  | 'pickup'
  | 'land'
  | 'denied'
  | 'confirm'
  | 'targeted'
  | 'goodThing'
  | 'influenceLost'
  | 'win';

export type HapticPattern = number | number[];

/**
 * The vocabulary. Durations are ms; arrays are on/off/on... runs.
 *
 *   pickup         6  -- the press. The shortest thing an actuator renders, and
 *                        the most frequent event in the game. Priority 0 so the
 *                        floor drops it behind absolutely everything.
 *   land          10  -- a tick, not a buzz. A tap that did something.
 *   denied        12  -- a refusal.
 *   targeted   30/40/30 -- two knocks: something is being done TO you.
 *   goodThing  20/30/20 -- deliberately THE SAME SHAPE as `targeted`, just
 *                        tighter, so a good beat and a bad beat stay
 *                        distinguishable through a pocket without the player
 *                        having to look at the screen.
 *   influenceLost 50/70/50/70 -- heavier and longer: you actually lost something.
 *   win        40/60/40/60/200 -- a roll into a long resolve.
 */
export const HAPTICS: Readonly<Record<HapticName, HapticPattern>> = Object.freeze({
  pickup: 6,
  land: 10,
  denied: 12,
  confirm: [30, 40, 30],
  targeted: [30, 40, 30],
  goodThing: [20, 30, 20],
  influenceLost: [50, 70, 50, 70],
  win: [40, 60, 40, 60, 200],
});

/**
 * What may interrupt what. The ladder is "how much of the game this beat is
 * worth", not "how loud": losing an influence outranks the tap that lost it,
 * and nothing outranks the win.
 */
export const HAPTIC_PRIORITY: Readonly<Record<HapticName, number>> = Object.freeze({
  pickup: 0,
  land: 0,
  denied: 1,
  // `confirm` shares `targeted`'s PATTERN but not its priority, and the split is
  // load-bearing. Pattern is how it feels; priority is how much of the game the
  // beat is worth -- and a tap is worth nothing, it is an acknowledgement. Ranking
  // your own confirm tap at `targeted`'s level reintroduces the exact bug the
  // ladder exists to prevent, one rung up: tapping "Challenge!" arms the floor at
  // priority 2, and against local bots the reveal can land inside 300ms, so the
  // earned `targeted` for losing that challenge is dropped by the tap that caused
  // it. Priority 1 keeps the weight in the hand and out of the ladder.
  confirm: 1,
  targeted: 2,
  goodThing: 3,
  influenceLost: 4,
  win: 5,
});

const FLOOR_MS = 300;

const supportsHaptic =
  typeof window === 'undefined'
    ? false
    : window.matchMedia('(pointer: coarse)').matches;

let _hapticEnabled =
  typeof window === 'undefined'
    ? true
    : localStorage.getItem('coup_haptic_enabled') !== 'false';

let lastAt = -1e9;
let lastPriority = 0;
let firedCount = 0;
let droppedCount = 0;
const byPattern: Record<string, number> = {};

export function setHapticEnabled(enabled: boolean): void {
  _hapticEnabled = enabled;
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * iOS Safari has no navigator.vibrate, but clicking a hidden `<input switch>`
 * produces the system switch haptic. Note that this fallback CANNOT express a
 * pattern -- it fires exactly once regardless of the pattern's shape, so a
 * `win` roll and a `land` tick feel identical on those devices.
 */
function _fallbackTap(): void {
  try {
    if (!supportsHaptic) return;

    const labelEl = document.createElement('label');
    labelEl.ariaHidden = 'true';
    labelEl.style.display = 'none';

    const inputEl = document.createElement('input');
    inputEl.type = 'checkbox';
    inputEl.setAttribute('switch', '');
    labelEl.appendChild(inputEl);

    document.head.appendChild(labelEl);
    labelEl.click();
    document.head.removeChild(labelEl);
  } catch {
    // do nothing
  }
}

/**
 * The single gate every haptic passes through. Applies the priority-aware
 * floor, then sends exactly one pattern.
 *
 * @returns true if the pattern went out, false if the floor dropped it.
 */
export function fireHaptic(name: HapticName, patternOverride?: HapticPattern): boolean {
  if (!_hapticEnabled) return false;

  const priority = HAPTIC_PRIORITY[name];
  const t = now();

  // Priority-aware floor: only a strictly higher priority may interrupt.
  if (t - lastAt < FLOOR_MS && priority <= lastPriority) {
    droppedCount++;
    return false;
  }

  lastAt = t;
  lastPriority = priority;
  firedCount++;
  byPattern[name] = (byPattern[name] ?? 0) + 1;

  const pattern = patternOverride ?? HAPTICS[name];

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
      return true;
    }
  } catch {
    // Safari throws rather than reporting absence; fall through to the tap.
  }

  _fallbackTap();
  return true;
}

/**
 * Legacy entry point, kept for the ~24 existing tap call sites. Maps onto
 * `land` -- a tick acknowledging your own press. A caller-supplied pattern is
 * still honoured, but at `land` priority: it is still just a tap.
 */
export function haptic(pattern?: HapticPattern): void {
  fireHaptic('land', pattern);
}

/**
 * Legacy entry point for confirm taps (Challenge!, Coup, choosing which influence
 * to lose). Maps onto `confirm` -- `targeted`'s pattern at a tap's priority.
 */
export function hapticHeavy(): void {
  fireHaptic('confirm');
}

/** Stats for later gating -- "did the vocabulary actually survive a real game?" */
export function hapticStats(): { fired: number; dropped: number; byPattern: Record<string, number> } {
  return { fired: firedCount, dropped: droppedCount, byPattern: { ...byPattern } };
}

/** Test hook: clears the floor and the counters. */
export function __resetHaptics(): void {
  lastAt = -1e9;
  lastPriority = 0;
  firedCount = 0;
  droppedCount = 0;
  for (const key of Object.keys(byPattern)) delete byPattern[key];
}
