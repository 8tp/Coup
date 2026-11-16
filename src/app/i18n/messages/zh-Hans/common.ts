import type { NamespaceTranslation } from '../../schema';

/** zh-Hans `common`. Glossary and conventions: docs/i18n-glossary/zh-Hans.md. */
const common: NamespaceTranslation<'common'> = {
  done: '完成',
  close: '关闭',
  cancel: '取消',
  back: '返回',
  settings: '设置',
  dialog: '对话框',
  secondsShort: '{seconds}秒',
  secondsRemaining: '{seconds, plural, other {还剩 # 秒}}',
};

export default common;
