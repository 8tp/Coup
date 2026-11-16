import type { NamespaceTranslation } from '../../schema';

/** ar `home`. */
const home: NamespaceTranslation<'home'> = {
  srTitle: 'Coup Online: لعبة ورق جماعية مجانية قائمة على الخداع',
  tagline: 'لعبة الورق والخداع، أونلاين مع أصدقائك أو ضد البوتات.',
  presenceOnline: 'متصل الآن: <fig>{count}</fig>',
  presenceGames: '{count, plural, zero {لا مباريات جارية} one {مباراة واحدة جارية} two {مباراتان جاريتان} few {<fig>#</fig> مباريات جارية} many {<fig>#</fig> مباراة جارية} other {<fig>#</fig> مباراة جارية}}',
  myStats: 'إحصاءاتي',

  playSection: 'اللعب',
  nameLabel: 'اسمك',
  playVsBots: 'اللعب ضد البوتات',
  playVsBotsSub: 'تبدأ فورًا · {count, plural, zero {# خصم} one {خصم واحد} two {خصمان} few {# خصوم} many {# خصمًا} other {# خصم}}',
  dealing: 'جارٍ التوزيع…',
  createRoom: 'إنشاء غرفة',
  joinRoom: 'دخول غرفة',
  publicRoom: 'غرفة عامة',
  publicRoomOn: 'تظهر على هذه الشاشة، ويمكن لأي أحد الانضمام.',
  publicRoomOff: 'الانضمام لمن معه الرمز فقط.',
  creating: 'جارٍ الإنشاء…',
  createAndInvite: 'إنشاء ودعوة',
  codePlaceholder: 'الرمز',
  roomCode: 'رمز الغرفة',
  joining: 'جارٍ الانضمام…',
  join: 'انضمام',

  learnTitle: 'تعلّم اللعب',
  learnSub: 'لعبة بإرشاد، أو دروس، أو القواعد',

  openTables: 'طاولات مفتوحة',
  watchLive: 'مشاهدة مباشرة',
  browseAll: 'عرض الكل',
  noPublicTables: 'لا توجد طاولات عامة الآن.',
  roomName: 'طاولة {host}',
  roomPlayers: 'اللاعبون <fig>{seats}</fig>',
  roomPlayersBetweenGames: 'اللاعبون <fig>{seats}</fig> · بين جولتين',
  roomPlayersWatching: 'اللاعبون <fig>{seats}</fig> · المشاهدون {watching}',
  roomFull: 'ممتلئة',
  watch: 'مشاهدة',

  footer: 'من {min} إلى {max} لاعبين · مجانية · بلا تسجيل',
  source: 'المصدر',
  sourceLabel: 'عرض الشيفرة المصدرية على GitHub',

  defaultSpectatorName: 'متفرج',
  defaultPlayerName: 'لاعب',

  guidedGame: 'لعبة مع مدرّب',
  guidedGameSub: 'أنت ضد بوت لطيف واحد، ومدرّب يشير إلى خطوتك التالية.',
  tutorial: 'الدروس',
  // {count} is the number of lessons (6 today); wording assumes several lessons.
  tutorialSub: '{count} دروس قصيرة، في كل منها تجربة للحركة على طاولة صغيرة.',
  rules: 'قراءة القواعد',
  rulesSub: 'الشخصيات والحركات والتحدي والصد، وتوسعة الإصلاح أيضًا.',
  practiceFoot: 'بوتات أكثر، أو قواعد أخرى، أو بلا مدرّب',
  practiceSetup: 'إعداد التدريب',

  installTitle: 'تثبيت Coup',
  installBody: 'تفتح أسرع، وتُحمَّل ملفات اللعبة المحفوظة حتى مع ضعف الواي فاي.',
  install: 'تثبيت',
  installDismiss: 'إخفاء اقتراح التثبيت',
};

export default home;
