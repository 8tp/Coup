import type { NamespaceTranslation } from '../../schema';

/** zh-Hans `settings`. */
const settings: NamespaceTranslation<'settings'> = {
  title: '设置',
  soundEffects: '音效',
  music: '音乐',
  musicVolume: '音乐音量',
  musicVolumeBalanced: '均衡',
  musicVolumeDb: '{db} dB',
  haptics: '振动反馈',
  reducedMotion: '减少动画',
  textSize: '文字大小',
  textSizeNormal: '标准',
  textSizeLarge: '大',
  textSizeXl: '特大',
  language: '语言',
  languageAuto: '跟随设备',
  languageInProgress: '翻译中',
  learning: '学习',
  tutorial: '新手教程',
  coachedBots: '教练陪练 · {count, plural, other {# 个人机}}',
  help: '帮助与反馈',
  feedbackOpen: '报告问题或提建议',
  githubIssue: '在 GitHub 上提交 issue',
};

export default settings;
