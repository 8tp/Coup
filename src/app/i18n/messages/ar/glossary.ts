import type { NamespaceTranslation } from '../../schema';

/** ar `glossary`. Kept in step with docs/i18n-glossary/ar.md. */
const glossary: NamespaceTranslation<'glossary'> = {
  'character.Duke': 'الدوق',
  'character.Assassin': 'القاتل',
  'character.Captain': 'القبطان',
  'character.Ambassador': 'السفير',
  'character.Contessa': 'الكونتيسة',
  'character.Inquisitor': 'المحقق',

  'action.Income': 'الدخل',
  'action.ForeignAid': 'المساعدة الخارجية',
  'action.Coup': 'الانقلاب',
  'action.Tax': 'الضريبة',
  'action.Assassinate': 'الاغتيال',
  'action.Steal': 'السرقة',
  'action.Exchange': 'التبادل',
  'action.Convert': 'التحويل',
  'action.Embezzle': 'الاختلاس',
  'action.Examine': 'الفحص',

  'mode.Classic': 'الكلاسيكي',
  'mode.Reformation': 'الإصلاح',

  'faction.Loyalist': 'أهل الولاء',
  'faction.Reformist': 'أهل الإصلاح',

  'phase.AwaitingAction': 'اختيار حركة',
  'phase.AwaitingActionChallenge': 'فرصة التحدي',
  'phase.AwaitingBlock': 'فرصة الصد',
  'phase.AwaitingBlockChallenge': 'فرصة تحدي الصد',
  'phase.AwaitingInfluenceLoss': 'خسارة ورقة',
  'phase.AwaitingExchange': 'التبادل جارٍ',
  'phase.AwaitingExamineSelection': 'اختيار ورقة للعرض',
  'phase.AwaitingExamineDecision': 'الفحص جارٍ',
  'phase.ActionResolved': 'نُفذت الحركة',
  'phase.GameOver': 'انتهت اللعبة',

  'term.influence': 'النفوذ',
  'term.card': 'ورقة',
  'term.claim': 'ادعاء',
  'term.bluff': 'خدعة',
  'term.challenge': 'تحدٍّ',
  'term.block': 'صد',
  'term.coin': '{count, plural, zero {# عملة} one {عملة واحدة} two {عملتان} few {# عملات} many {# عملة} other {# عملة}}',
  'term.reserve': 'احتياطي الخزينة',
  'term.faction': 'فصيل',
};

export default glossary;
