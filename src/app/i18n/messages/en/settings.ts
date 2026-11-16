/** The Settings modal (`components/settings/SettingsModal.tsx`). */
const settings = {
  title: 'Settings',
  soundEffects: 'Sound effects',
  music: 'Music',
  musicVolume: 'Music volume',
  musicVolumeBalanced: 'Balanced',
  /** `{db}` arrives signed and formatted, for example "+3" or "-6". */
  musicVolumeDb: '{db} dB',
  haptics: 'Haptic feedback',
  reducedMotion: 'Reduced animation',
  textSize: 'Text size',
  textSizeNormal: 'Normal',
  textSizeLarge: 'Large',
  textSizeXl: 'Extra large',
  language: 'Language',
  languageAuto: 'Match my device',
  languageInProgress: 'Translation in progress',
  learning: 'Learning',
  tutorial: 'New player tutorial',
  coachedBots: 'Coached · {count, plural, one {# bot} other {# bots}}',
  help: 'Help and feedback',
  reportBug: 'Report a bug',
  sendFeedback: 'Send feedback',
} satisfies Record<string, string>;

export default settings;
