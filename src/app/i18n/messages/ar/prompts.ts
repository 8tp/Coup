import type { NamespaceTranslation } from '../../schema';

/** ar `prompts`. */
const prompts: NamespaceTranslation<'prompts'> = {
  // ── Buttons ──
  challenge: 'تحدٍّ',
  pass: 'تمرير',
  blockWith: 'صد بصفة {character}',
  dontBlock: 'عدم الصد',
  bluffHint: 'إن شككت في أنه يخادع فالتحدي متاح. وإن كان صادقًا، خسرت ورقة.',

  // ── Challenge window ──
  declaredBlock: '<b>{blocker}</b> سيصد بصفة {character} عند تنفيذ {action}.',
  youClaimed: 'ادّعيت <c>{character}</c> لتنفيذ {action}',
  youClaimedOn: 'ادّعيت <c>{character}</c> لتنفيذ {action} ضد <b>{target}</b>',
  youClaimedNo: 'ادّعيت <c>أن لا {character} معك</c> لتنفيذ {action}',
  waitingChallenge: '{count, plural, =0 {بانتظار اللاعبين: تحدٍّ أو تمرير.} other {بانتظار {names}: تحدٍّ أو تمرير.}}',
  youWillBlock: 'صدك جاهز بصفة <c>{character}</c> عند تنفيذ {action}.',
  waitingFor: '{count, plural, =0 {بانتظار اللاعبين.} other {بانتظار {names}.}}',
  passedCanBlock: 'مرّرت التحدي، وما زال بإمكانك الصد.',
  passedWaiting: '{count, plural, =0 {مرّرت. بانتظار اللاعبين.} other {مرّرت. بانتظار {names}.}}',
  claim: '{actor} يدّعي {character} لتنفيذ {action}',
  claimOn: '{actor} يدّعي {character} لتنفيذ {action} ضد {target}',
  claimStealFrom: '{actor} يدّعي {character} لتنفيذ {action} من {target}',
  claimAtYou: '{actor} يدّعي {character} لتنفيذ {action} ضدك',
  claimStealFromYou: '{actor} يدّعي {character} لتنفيذ {action} منك',
  claimNo: '{actor} يدّعي أن لا {character} معه لتنفيذ {action}',
  embezzleHint: 'إن ظننت أن معه {character} فالتحدي متاح. وإن لم يكن معه، خسرت ورقة.',
  'blockHint.Assassinate': '{count, plural, one {عليك الصد بصفة {who} أو خسارة ورقة. يمكنك ادعاء {who} دون امتلاك الورقة.} two {عليك الصد بصفة {who} أو خسارة ورقة. يمكنك ادعاء أيٍّ منهما دون امتلاك الورقة.} other {عليك الصد بصفة {who} أو خسارة ورقة. يمكنك ادعاء أيٍّ منها دون امتلاك الورقة.}}',
  'blockHint.Steal': '{count, plural, one {الصد بصفة {who} يحمي عملاتك. يمكنك ادعاء {who} دون امتلاك الورقة.} two {الصد بصفة {who} يحمي عملاتك. يمكنك ادعاء أيٍّ منهما دون امتلاك الورقة.} other {الصد بصفة {who} يحمي عملاتك. يمكنك ادعاء أيٍّ منها دون امتلاك الورقة.}}',
  'blockHint.other': '{count, plural, one {الصد بصفة {who} يوقف الحركة. يمكنك ادعاء {who} دون امتلاك الورقة.} two {الصد بصفة {who} يوقف الحركة. يمكنك ادعاء أيٍّ منهما دون امتلاك الورقة.} other {الصد بصفة {who} يوقف الحركة. يمكنك ادعاء أيٍّ منها دون امتلاك الورقة.}}',

  // ── Block window ──
  yourActionUnless: 'تُنفَّذ حركتك ({action}) ما لم يصدها <b>{target}</b>.',
  yourActionUnlessAnyone: 'تُنفَّذ حركتك ({action}) ما لم يصدها أحد.',
  usesOn: '<b>{actor}</b> يستخدم {action} ضد <b>{target}</b>.',
  waitingTarget: 'بانتظار <b>{target}</b>: صد أو سماح.',
  sameFactionForeignAid: 'لا يمكنك صد {action} عن <b>{actor}</b>. أنتما في الفصيل نفسه، والفصيلان ما زالا في اللعبة.',
  blockPassed: 'مرّرت.',
  blockPassedWaiting: 'مرّرت. بانتظار {names}.',
  assassinating: '{actor} يغتالك',
  assassinatingHint: 'عليك الصد بصفة {character} أو خسارة ورقة. يمكنك ادعاء {character} دون امتلاك الورقة.',
  stealing: '{actor} يسرق {count, plural, zero {# من عملاتك} one {عملتك} two {عملتين من عملاتك} few {# من عملاتك} many {# من عملاتك} other {# من عملاتك}}',
  stealingHint: 'الصد بصفة {blockers} يحمي {count, plural, zero {# من عملاتك} one {عملتك} two {عملتيك} few {# من عملاتك} many {# من عملاتك} other {# من عملاتك}}. يمكنك ادعاء أيٍّ منهما دون امتلاك الورقة.',
  foreignAid: '{actor} يأخذ {action} ({count, plural, zero {+# عملة} one {+عملة} two {+عملتان} few {+# عملات} many {+# عملة} other {+# عملة}})',
  foreignAidHint: 'ادعاء {character} يمنعه من أخذ {count, plural, zero {# عملة} one {عملة واحدة} two {عملتين} few {# عملات} many {# عملة} other {# عملة}}. يمكنك ادعاء {character} دون امتلاك الورقة.',
  uses: '{actor} يستخدم {action}',
  canBlock: 'يمكنك صد هذه الحركة.',

  // ── Block challenge window ──
  youClaimedBlock: 'ادّعيت <c>{character}</c> للصد.',
  acceptedWaiting: '{count, plural, =0 {قبلت الصد. بانتظار اللاعبين.} other {قبلت الصد. بانتظار {names}.}}',
  blockClaim: '{blocker} يدّعي <c>{character}</c> لصد {action}',
  blockClaimPlain: '{blocker} يدّعي <c>{character}</c> للصد',

  // ── Losing a card ──
  'loss.coup': 'تعرّضت لانقلاب',
  'loss.assassination': 'تعرّضت للاغتيال',
  'loss.challenge_lost': 'خسرت التحدي',
  'loss.challenge_failed_defense': 'انكشفت خدعتك',
  'loss.embezzle_failed': 'انكشف أن معك {character}',
  'loss.default': 'عليك التخلي عن ورقة',
  tapToLose: 'لمسة على ورقة تكفي للتخلي عنها، فتنقلب مكشوفة.',
  mustChoose: 'على <b>{name}</b> التخلي عن ورقة.',
  'lossWatch.coup': 'انقلاب',
  'lossWatch.assassination': 'اغتيال',
  'lossWatch.challenge_lost': 'تحدٍّ خاسر',
  'lossWatch.challenge_failed_defense': 'خدعة مكشوفة',
  'lossWatch.embezzle_failed': 'اختلاس فاشل',
  'lossWatch.default': 'خسارة ورقة',

  // ── Exchange ──
  exchangeInProgress: 'التبادل جارٍ',
  exchangeTitle: '{action} بصفة {character}',
  exchangeHint: '{count, plural, zero {عليك اختيار # ورقة تبقى معك. البقية تعود إلى الرزمة.} one {عليك اختيار ورقة واحدة تبقى معك. البقية تعود إلى الرزمة.} two {عليك اختيار ورقتين تبقيان معك. البقية تعود إلى الرزمة.} few {عليك اختيار # أوراق تبقى معك. البقية تعود إلى الرزمة.} many {عليك اختيار # ورقة تبقى معك. البقية تعود إلى الرزمة.} other {عليك اختيار # ورقة تبقى معك. البقية تعود إلى الرزمة.}}',
  keepSelected: 'الاحتفاظ بالمحدد ({selected}/{total})',

  // ── Examine ──
  examinedCard: 'ورقة {name}',
  forceSwapHint: 'فرض التبديل يرسلها إلى الرزمة، ويسحب صاحبها ورقة جديدة.',
  examineReturn: 'إعادة',
  forceSwap: 'فرض التبديل',
  showTo: 'عليك عرض ورقة على {name}',
  showToInquisitor: 'عليك عرض ورقة على {character}',
  showHint: 'لا يراها إلا الفاحص، وله أن يعيدها أو يفرض عليك تبديلها بورقة جديدة.',

  // ── Challenge reveal ──
  'reveal.skip': 'تخطي الكشف',
  'reveal.newCard': 'نفوذ مخفي جديد',
  'reveal.showsAllNo': '{name} يكشف كل أوراقه: <c>لا {character}</c>',
  'reveal.reveals': '{name} يكشف <c>{character}</c>',
  'reveal.doesNotHave': 'ليس مع {name} <c>{character}</c>',
  'reveal.challengeFails': 'فشل التحدي',
  'reveal.caught': 'انكشفت الخدعة',
  'reveal.mustLose': 'على {name} خسارة ورقة',
  'reveal.swap': '{count, plural, one {تعود الورقة إلى الرزمة، وتُسحب ورقة بدلًا منها.} two {تعود الورقتان إلى الرزمة، وتُسحب ورقتان بدلًا منهما.} other {تعود الأوراق المكشوفة إلى الرزمة، وتُسحب أوراق بدلًا منها.}}',
};

export default prompts;
