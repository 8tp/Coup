import type { NamespaceTranslation } from '../../schema';

/**
 * ar `log`. Lines are in the past tense, verb first for other players
 * (masculine as the grammatical default, since a name's gender is unknown);
 * the reader's own lines use the second person past or "لديك / عليك", which
 * are written the same for anyone.
 */
const log: NamespaceTranslation<'log'> = {
  // ── Event lines ──
  gameStarted: 'بدأت اللعبة. {actor, select, you {الدور الأول لك.} other {الدور الأول من نصيب {actor}.}}',
  turnStart: '{actor, select, you {دورك.} other {دور {actor}.}}',
  eliminated: '{actor, select, you {خرجت من اللعبة.} other {خرج {actor} من اللعبة.}}',
  win: '{actor, select, you {فزت باللعبة.} other {فاز {actor} باللعبة.}}',
  botReplacedIdle: '{actor, select, you {طال غيابك، فأخذ بوت مقعدك.} other {طال غياب {actor}، فأخذ بوت مقعده.}}',
  botReplacedLeft: '{actor, select, you {غادرت، فأخذ بوت مقعدك.} other {غادر {actor}، فأخذ بوت مقعده.}}',
  botReplacedDisconnected: 'أخذ بوت {actor, select, you {مقعدك} other {مقعد {actor}}}.',
  income: '{actor, select, you {أخذت} other {أخذ {actor}}} الدخل ({amount, plural, zero {+# عملة} one {+عملة واحدة} two {+عملتان} few {+# عملات} many {+# عملة} other {+# عملة}}).',
  coup: '{actor, select, you {نفذت} other {نفذ {actor}}} انقلابًا {target, select, you {ضدك} other {ضد {target}}}.',
  claimAction: '{actor, select, you {ادّعيت} other {ادّعى {actor}}} {character} لتنفيذ {action}.',
  claimActionTargeting: '{actor, select, you {ادّعيت} other {ادّعى {actor}}} {character} لتنفيذ {action} {target, select, you {ضدك} other {ضد {target}}}.',
  declareAction: '{actor, select, you {أعلنت} other {أعلن {actor}}} {action}.',
  challenge: '{challenger, select, you {تحدّيت ادعاء {challenged} بصفة {character}.} other {{challenged, select, you {تحدّى {challenger} ادعاءك بصفة {character}.} other {تحدّى {challenger} ادعاء {challenged} بصفة {character}.}}}}',
  challengeFailed: '{challenged, select, you {لديك {character}.} other {لدى {challenged} {character}.}} {challenger, select, you {عليك خسارة ورقة.} other {على {challenger} خسارة ورقة.}}',
  challengeSucceeded: '{challenged, select, you {ليس معك {character}، وعليك خسارة ورقة.} other {ليس مع {challenged} {character}، وعليه خسارة ورقة.}}',
  block: '{blocker, select, you {صددت} other {صد {blocker}}} بصفة {character}.',
  blockChallenge: '{challenger, select, you {تحدّيت صد {blocker} بصفة {character}.} other {{blocker, select, you {تحدّى {challenger} صدك بصفة {character}.} other {تحدّى {challenger} صد {blocker} بصفة {character}.}}}}',
  blockChallengeFailed: '{blocker, select, you {لديك {character}، فالصد قائم.} other {لدى {blocker} {character}، فالصد قائم.}} {challenger, select, you {عليك خسارة ورقة.} other {على {challenger} خسارة ورقة.}}',
  blockChallengeSucceeded: '{blocker, select, you {ليس معك {character}، وعليك خسارة ورقة.} other {ليس مع {blocker} {character}، وعليه خسارة ورقة.}} فشل الصد وتُنفَّذ الحركة.',
  blockStands: 'لم يتحدَّ أحد الصد. صُدّت الحركة.',
  influenceLost: '{actor, select, you {خسرت} other {خسر {actor}}} {character}.',
  assassinationLoss: '{target, select, you {خسرت} other {خسر {target}}} ورقة بالاغتيال.',
  assassinationPending: '{target, select, you {عليك} other {على {target}}} خسارة ورقة بالاغتيال.',
  taxCollected: '{actor, select, you {جمعت} other {جمع {actor}}} الضريبة ({amount, plural, zero {+# عملة} one {+عملة واحدة} two {+عملتان} few {+# عملات} many {+# عملة} other {+# عملة}}).',
  foreignAidTaken: '{actor, select, you {أخذت} other {أخذ {actor}}} المساعدة الخارجية ({amount, plural, zero {+# عملة} one {+عملة واحدة} two {+عملتان} few {+# عملات} many {+# عملة} other {+# عملة}}).',
  stealResolved: '{actor, select, you {سرقت} other {سرق {actor}}} {amount, plural, zero {# عملة} one {عملة واحدة} two {عملتين} few {# عملات} many {# عملة} other {# عملة}} {target, select, you {منك} other {من {target}}}.',
  exchangeDraw: '{actor, select, you {سحبت} other {سحب {actor}}} أوراقًا للتبادل.',
  exchangeDeckEmpty: '{actor, select, you {حاولت السحب} other {حاول {actor} السحب}}، لكن الرزمة فارغة.',
  exchangeComplete: '{actor, select, you {أتممت} other {أتم {actor}}} التبادل.',
  convertSelf: '{actor, select, you {انتقلت} other {انتقل {actor}}} إلى {faction} ({amount, plural, zero {# عملة} one {عملة واحدة} two {عملتان} few {# عملات} many {# عملة} other {# عملة}} إلى احتياطي الخزينة).',
  convertOther: '{actor, select, you {نقلت {target} إلى {faction}} other {{target, select, you {نقلك {actor} إلى {faction}} other {نقل {actor} اللاعب {target} إلى {faction}}}}} ({amount, plural, zero {# عملة} one {عملة واحدة} two {عملتان} few {# عملات} many {# عملة} other {# عملة}} إلى احتياطي الخزينة).',
  embezzleClaim: '{actor, select, you {ادّعيت أن لا {character} معك} other {ادّعى {actor} أن لا {character} معه}} لاختلاس احتياطي الخزينة ({amount, plural, zero {# عملة} one {عملة واحدة} two {عملتان} few {# عملات} many {# عملة} other {# عملة}}).',
  embezzleChallenge: '{challenger, select, you {تحدّيت ادعاء {challenged} أن لا {character} معه.} other {{challenged, select, you {تحدّى {challenger} ادعاءك أن لا {character} معك.} other {تحدّى {challenger} ادعاء {challenged} أن لا {character} معه.}}}}',
  embezzleChallengeSucceeded: '{challenged, select, you {معك {character}، وعليك خسارة ورقة.} other {مع {challenged} {character}، وعليه خسارة ورقة.}} فشل الاختلاس.',
  embezzleChallengeFailed: '{challenged, select, you {كشفت كل أوراقك المخفية ولا {character} معك} other {كشف {challenged} كل أوراقه المخفية ولا {character} معه}}، فتُستبدل تلك الأوراق. {challenger, select, you {عليك} other {على {challenger}}} خسارة ورقة، ويُنفَّذ الاختلاس.',
  embezzled: '{actor, select, you {اختلست} other {اختلس {actor}}} احتياطي الخزينة.',
  examineAsk: '{actor, select, you {طلبت من {target}} other {{target, select, you {طلب منك {actor}} other {طلب {actor} من {target}}}}} ورقة ليفحصها.',
  examineShown: '{target, select, you {عرضت على {actor}} other {{actor, select, you {عرض عليك {target}} other {عرض {target} على {actor}}}}} ورقة.',
  examineForceSwap: '{actor, select, you {أجبرت {target}} other {{target, select, you {أجبرك {actor}} other {أجبر {actor} اللاعب {target}}}}} على تبديل ورقة.',
  examineSwapDeckEmpty: '{actor, select, you {تعذّر عليك} other {تعذّر على {actor}}} فرض التبديل لأن الرزمة فارغة. تعود الورقة.',
  examineReturn: '{actor, select, you {أعدت ورقة {target}.} other {{target, select, you {أعاد {actor} ورقتك.} other {أعاد {actor} ورقة {target}.}}}}',

  // ── The reader, mid-sentence ──
  you: 'أنت',
  unknownPlayer: 'لاعب',

  // ── Log chrome ──
  empty: 'تبدأ اللعبة',
  latest: 'الأحدث',
  openFull: 'فتح سجل اللعبة كاملًا',
  tabLog: 'السجل',
  tabChat: 'الدردشة',
  unreadMany: '9+',
  bluff: 'خدعة',
  honest: 'صادق',
  explain: 'شرح',

  // ── Practice explanations ──
  'explain.game_start': 'خلط الخادم الرزمة ووزّع ورقتين مخفيتين على كل لاعب. لا يرى كل لاعب إلا أوراقه.',
  'explain.turn_start': 'يختار الحركة صاحب الدور وحده. وينتظر الباقون التحدي أو الصد أو الدور التالي.',
  'explain.income': 'لا يمكن تحدي الدخل ولا صده.',
  'explain.declare_action': 'هذه الحركة لا تدّعي أي شخصية. وحدها الحركات التي تدّعي شخصية يمكن تحديها.',
  'explain.claim_action': '{actor, select, you {ادّعيت} other {ادّعى {actor}}} {character} لتنفيذ {action}. يمكن لبقية اللاعبين التحدي قبل التنفيذ.',
  'explain.claim_action_plain': '{actor, select, you {ادّعيت} other {ادّعى {actor}}} {character}. يمكن لبقية اللاعبين التحدي قبل التنفيذ.',
  'explain.challenge': 'التحدي يكشف هل الشخصية المدّعاة بين أوراق ذلك اللاعب المخفية.',
  'explain.challenge_fail': 'كانت الورقة المدّعاة مع اللاعب. يخسر المتحدي ورقة، وتُستبدل الورقة المكشوفة بأخرى من الرزمة.',
  'explain.challenge_success': 'لم تكن الورقة المدّعاة مع اللاعب، فخسر ورقة.',
  'explain.block': 'الصد ادعاء أيضًا. قد يكون صاحبه يخادع، ويمكن تحدي الصد.',
  'explain.block_unchallenged': 'لم يتحدَّ أحد الصد قبل انتهاء الوقت، فبقي الصد قائمًا وتوقفت الحركة.',
  'explain.block_challenge_fail': 'كانت الورقة المدّعاة مع صاحب الصد. خسر المتحدي ورقة، وبقيت الحركة مصدودة.',
  'explain.block_challenge_success': 'كان صاحب الصد يخادع. خسر ورقة، ونُفذت الحركة الأصلية.',
  'explain.coup': 'كلفة الانقلاب 7 عملات، ولا يمكن صده ولا تحديه. الهدف يخسر ورقة دائمًا.',
  'explain.assassination': 'يُنفَّذ الاغتيال بعد فرصة التحدي وفرصة صد الكونتيسة. إن لم يوقفه أحد، خسر الهدف ورقة.',
  'explain.influence_loss': 'الورقة المكشوفة تبقى خارج اللعب حتى النهاية. ومن لم تبقَ له ورقة مخفية خرج من اللعبة.',
  'explain.exchange': 'التبادل يسحب أوراقًا من الرزمة. يختار اللاعب ما يحتفظ به ويعيد الباقي.',
  'explain.action_resolve': '{actor, select, you {ادّعيت {character} ولم يوقفك أحد} other {ادّعى {actor} {character} ولم يوقفه أحد}} في فرصتي التحدي والصد، فنُفذت الحركة.',
  'explain.action_resolve_plain': 'لم يوقف أحد الحركة في فرصتي التحدي والصد، فنُفذت.',
  'explain.elimination': 'لم تبقَ لهذا اللاعب أوراق مخفية، فخرج من اللعبة. ويمكنه مواصلة المشاهدة.',
  'explain.win': 'لم تبقَ أوراق مخفية إلا مع لاعب واحد، فانتهت اللعبة.',
  'explain.bot_replace': 'أخذ بوت مكان لاعب غادر أو انقطع اتصاله أو طال غيابه، لتستمر اللعبة.',
  'explain.convert': 'التحويل يغيّر الفصيل. تحويل فصيلك يكلف عملة واحدة، وتحويل لاعب آخر يكلف عملتين. وتذهب العملات إلى الاحتياطي.',
  'explain.faction_change': 'قيود الفصائل تشمل الانقلاب والاغتيال والسرقة والفحص وصد المساعدة الخارجية، ما لم يكن كل اللاعبين الباقين في فصيل واحد.',
  'explain.embezzle': 'الاختلاس يأخذ الاحتياطي كله. يدّعي اللاعب أن الدوق ليس معه، فلا يفوز المتحدي إلا إن كان الدوق معه. وإلا كشف اللاعب كل أوراقه المخفية واستبدلها من الرزمة.',
  'explain.examine': 'الفحص يتطلب ادعاء المحقق. يختار الهدف ورقة مخفية يعرضها، ثم يقرر الفاحص هل يفرض التبديل.',
  'explain.examine_decision': 'أعاد المحقق الورقة كما هي، أو فرض تبديلها بورقة من الرزمة.',
  'explain.targeted': 'الحركات الموجهة إلى لاعب تقيّدها العملات والفصائل وبقاء الهدف في اللعبة.',
};

export default log;
