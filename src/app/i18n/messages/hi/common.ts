import type { NamespaceTranslation } from '../../schema';

/** hi `common`. Register: आप, polite imperatives in -ें (docs/i18n-glossary/hi.md). */
const common: NamespaceTranslation<'common'> = {
  done: 'हो गया',
  close: 'बंद करें',
  cancel: 'रद्द करें',
  back: 'वापस',
  settings: 'सेटिंग्स',
  dialog: 'डायलॉग',
  secondsShort: '{seconds} सेकंड',
  secondsRemaining: '{seconds, plural, one {# सेकंड बाक़ी} other {# सेकंड बाक़ी}}',
};

export default common;
