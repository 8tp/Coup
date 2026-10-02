/**
 * anim/ — the motion engine. One clock, one transform contract:
 *
 *     translate(var(--fx), var(--fy)) rotate(var(--tilt)) scale(var(--fs))
 *
 * Pure motion: nothing here imports a component, a store, or the shared game
 * types, and nothing touches `window`/`document` at module scope.
 */

export {
  subscribe,
  unsubscribe,
  now,
  start,
  stop,
  reset as resetClock,
  frameCount,
  subCount,
  isRunning,
  type ClockSubscriber,
  type Unsubscribe,
} from './clock';

export {
  BACK,
  SCALE_BACK,
  clamp01,
  easeOutBack,
  easeOutCubic,
  smoothstep,
  settle,
  hash1,
  hashKey,
} from './easing';

export {
  MS_MIN,
  MS_MAX,
  MS_PER_PX,
  MAX_EVENT_MS,
  HITSTOP_MS,
  HITSTOP_MIN_GAP_MS,
  HITSTOP_FLOOR_MS,
  CONTACT,
  REDUCED_FADE_MS,
  fly,
  punch,
  fade,
  cancel,
  finishAll,
  resetFlights,
  busyUntil,
  liveCount,
  isFlying,
  hitstopCount,
  flightDuration,
  setReducedMotion,
  isReducedMotion,
  getRest,
  setRest,
  clearRest,
  writeRest,
  clearTransform,
  type FlightElement,
  type FlightStyle,
  type FlyOptions,
  type LandCallback,
  type AbortCallback,
  type RestPose,
} from './flight';

export {
  measureFirst,
  invertAndPlay,
  type FlipOptions,
  type FlipResult,
  type FlipSnapshot,
  type MeasurableElement,
  type RectLike,
} from './flip';

/**
 * §6's per-verb table, in the order the table lists it: deal, swap, strike,
 * take-from, refuse, fall. All seven factories are here, not just the two the
 * first wave happened to call — a barrel that exports half a table is a table
 * whose other half reads as unfinished rather than as unused.
 */
export {
  DEAL_ARC,
  DEAL_SPIN,
  DEAL_DUR,
  DEAL_STAGGER_MS,
  DEAL_RISE,
  DEAL_SCALE,
  EXCHANGE_ARC,
  EXCHANGE_SPIN,
  EXCHANGE_DUR,
  EXCHANGE_OFFSET_MS,
  STRIKE_DUR,
  STRIKE_SPIN,
  ASSASSINATE_REACH,
  LUNGE_ENV,
  COUP_ARC,
  STEAL_ARC,
  STEAL_SPIN,
  STEAL_DUR,
  STEAL_DELAY_MS,
  STEAL_SPEED,
  STEAL_LIFT,
  SHOVE_FRACTION,
  SHOVE_SPIN,
  SHOVE_DUR,
  BLOCK_CUT_ENV,
  BLOCK_CUT_DUR,
  CHALLENGE_ARRIVE_ARC,
  CHALLENGE_ARRIVE_SPIN,
  FALL_ARC,
  FALL_SPIN,
  FALL_DUR,
  FLIGHT_TRANSFORM,
  FLIGHT_TRANSFORM_STYLE,
  dealIn,
  exchangeSwap,
  swapSide,
  assassinate,
  coupSlam,
  steal,
  challengeShove,
  blockCut,
  challengeArrive,
  influenceTumble,
  type SwapContext,
  type TravelContext,
  type LungeContext,
  type ShoveContext,
} from './verbs';

export {
  useFlight,
  useIsomorphicLayoutEffect,
  useReducedMotionSync,
  ensureReducedMotionSync,
  ensureHiddenTabSettle,
  type FlightHandle,
} from './useFlight';
