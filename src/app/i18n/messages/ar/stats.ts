import type { NamespaceTranslation } from '../../schema';

/** ar `stats`. */
const stats: NamespaceTranslation<'stats'> = {
  title: 'إحصاءاتي',
  tabOverview: 'نظرة عامة',
  tabAwards: 'الألقاب',
  tabHistory: 'آخر الألعاب',

  empty: 'لا ألعاب بعد.',
  emptyHint: 'تبدأ الإحصاءات بعد إنهاء أول لعبة. ألعاب التدريب لا تُحتسب.',

  reset: 'مسح الإحصاءات',
  resetWarning: 'سيُحذف كل ما في إحصاءاتك، ولا يمكن التراجع عن ذلك.',
  resetConfirm: 'تأكيد',

  gamesPlayed: 'الألعاب',
  gamesWon: 'مرات الفوز',
  winRate: 'نسبة الفوز',
  winStreak: 'سلسلة الفوز',
  winStreakValue: '{current} (الأفضل {best})',
  challengesMade: 'التحديات',
  challengesWon: 'تحديات ناجحة',
  challengesWonValue: '{won} ({accuracy})',
  blocksMade: 'عمليات الصد',
  successfulBluffs: 'خدع ناجحة',
  timesCaught: 'مرات الانكشاف',
  coups: 'الانقلابات',
  assassinations: 'الاغتيالات',
  firstEliminated: 'أول الخارجين',
  totalTurns: 'مجموع الأدوار',
  favoriteAction: 'الحركة المفضلة',
  noValue: '-',

  awardsEmpty: 'تُكسب الألقاب بإنهاء الألعاب.',
  awardCount: '×{count}',
  'awardCriterion.pantsOnFire': 'أكثر من انكشفت خدعته',
  'awardCriterion.honestAbe': 'أكثر من ثبت صدقه، بلا انكشاف',
  'awardCriterion.inquisitor': 'أكثر التحديات',
  'awardCriterion.eagleEye': 'أدق التحديات',
  'awardCriterion.wall': 'أكثر عمليات الصد',
  'awardCriterion.smoothOperator': 'ادعاءات كثيرة بلا انكشاف',
  'awardCriterion.coupMachine': 'أكثر الانقلابات',
  'awardCriterion.silentAssassin': 'أكثر الاغتيالات',
  'awardCriterion.boldStrategy': 'أكثر التحديات الخاسرة',
  'awardCriterion.quickExit': 'أول من خرج من اللعبة',

  historyWonShort: 'ف',
  historyLostShort: 'خ',
  historyWon: 'فوز',
  historyLost: 'خسارة',
  historyPlayers: '{count, plural, zero {# لاعب} one {لاعب واحد} two {لاعبان} few {# لاعبين} many {# لاعبًا} other {# لاعب}}',
  historyTurns: '{count, plural, zero {# دور} one {دور واحد} two {دوران} few {# أدوار} many {# دورًا} other {# دور}}',
  historyChallenges: 'التحديات: {made} (الناجحة {won})',
  historyBlocks: 'عمليات الصد: {count}',
  historyCoups: 'الانقلابات: {count}',
  historyAssassinations: 'الاغتيالات: {count}',
  historyAwards: 'الألقاب: {awards}',
  listSeparator: '، ',
};

export default stats;
