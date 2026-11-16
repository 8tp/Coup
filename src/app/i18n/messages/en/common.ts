/**
 * Words used on many screens. Keep this small: a string belongs here only
 * when it means the same thing everywhere it appears.
 */
const common = {
  done: 'Done',
  close: 'Close',
  cancel: 'Cancel',
  back: 'Back',
  /** Label of the gear button that opens the Settings modal (home, lobby). */
  settings: 'Settings',
  /** Screen-reader name for a dialog that has no visible title. */
  dialog: 'Dialog',
  /** A short duration next to a timer or slider, for example "15s". Keep it short. */
  secondsShort: '{seconds}s',
  /** Screen-reader text for a countdown. */
  secondsRemaining: '{seconds, plural, one {# second remaining} other {# seconds remaining}}',
} satisfies Record<string, string>;

export default common;
