import type { NamespaceTranslation } from '../../schema';

/** vi `common`. */
const common: NamespaceTranslation<'common'> = {
  done: 'Xong',
  close: 'Đóng',
  cancel: 'Hủy',
  back: 'Quay lại',
  settings: 'Cài đặt',
  dialog: 'Hộp thoại',
  // "s" is the SI symbol for giây; Vietnamese UIs use it in tight spots (timers, slider ends).
  secondsShort: '{seconds}s',
  secondsRemaining: '{seconds, plural, other {Còn # giây}}',
};

export default common;
