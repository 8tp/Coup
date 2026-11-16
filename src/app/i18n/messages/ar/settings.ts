import type { NamespaceTranslation } from '../../schema';

/** ar `settings`. */
const settings: NamespaceTranslation<'settings'> = {
  title: 'الإعدادات',
  soundEffects: 'المؤثرات الصوتية',
  music: 'الموسيقى',
  musicVolume: 'مستوى الموسيقى',
  musicVolumeBalanced: 'متوازن',
  musicVolumeDb: '{db} dB',
  haptics: 'الاهتزاز',
  reducedMotion: 'تقليل الحركة',
  textSize: 'حجم النص',
  textSizeNormal: 'عادي',
  textSizeLarge: 'كبير',
  textSizeXl: 'كبير جدًا',
  language: 'اللغة',
  languageAuto: 'لغة الجهاز',
  languageInProgress: 'الترجمة قيد الإعداد',
  learning: 'التعلّم',
  tutorial: 'شرح للاعبين الجدد',
  coachedBots: 'مع مدرّب · {count, plural, zero {# بوت} one {بوت واحد} two {بوتان} few {# بوتات} many {# بوتًا} other {# بوت}}',
  help: 'المساعدة والملاحظات',
  feedbackOpen: 'الإبلاغ عن خطأ أو اقتراح فكرة',
  githubIssue: 'فتح بلاغ على GitHub',
};

export default settings;
