import type { NamespaceTranslation } from '../../schema';

/** vi `settings`. */
const settings: NamespaceTranslation<'settings'> = {
  title: 'Cài đặt',
  soundEffects: 'Hiệu ứng âm thanh',
  music: 'Nhạc nền',
  musicVolume: 'Âm lượng nhạc',
  musicVolumeBalanced: 'Cân bằng',
  musicVolumeDb: '{db} dB',
  haptics: 'Rung phản hồi',
  reducedMotion: 'Giảm hiệu ứng chuyển động',
  textSize: 'Cỡ chữ',
  textSizeNormal: 'Thường',
  textSizeLarge: 'Lớn',
  textSizeXl: 'Rất lớn',
  language: 'Ngôn ngữ',
  languageAuto: 'Theo thiết bị',
  languageInProgress: 'Đang dịch',
  learning: 'Học chơi',
  tutorial: 'Hướng dẫn cho người mới',
  coachedBots: 'Có hướng dẫn · {count, plural, other {# bot}}',
  help: 'Trợ giúp và góp ý',
  feedbackOpen: 'Báo lỗi hoặc góp ý',
  githubIssue: 'Mở issue trên GitHub',
};

export default settings;
