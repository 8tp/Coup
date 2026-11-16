import type { NamespaceTranslation } from '../../schema';

/** ar `common`. */
const common: NamespaceTranslation<'common'> = {
  done: 'تم',
  close: 'إغلاق',
  cancel: 'إلغاء',
  back: 'رجوع',
  settings: 'الإعدادات',
  dialog: 'نافذة حوار',
  /** Wrapped in a right-to-left isolate (U+2067 … U+2069) so "15 ث" reads number-first even inside the left-to-right `.figure` box. */
  secondsShort: '⁧{seconds} ث⁩',
  secondsRemaining: '{seconds, plural, zero {انتهى الوقت} one {بقيت ثانية واحدة} two {بقيت ثانيتان} few {بقيت # ثوانٍ} many {بقيت # ثانية} other {بقيت # ثانية}}',
};

export default common;
