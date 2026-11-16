import type { NamespaceTranslation } from '../../schema';

/**
 * vi `glossary`. Keep in step with docs/i18n-glossary/vi.md.
 * Characters and actions use Vietnamese names, the glosses Vietnamese rule
 * write-ups already pair with the English card names.
 */
const glossary: NamespaceTranslation<'glossary'> = {
  'character.Duke': 'Công tước',
  'character.Assassin': 'Sát thủ',
  'character.Captain': 'Thuyền trưởng',
  'character.Ambassador': 'Đại sứ',
  'character.Contessa': 'Nữ bá tước',
  'character.Inquisitor': 'Phán quan',

  'action.Income': 'Thu nhập',
  'action.ForeignAid': 'Viện trợ',
  'action.Coup': 'Đảo chính',
  'action.Tax': 'Thu thuế',
  'action.Assassinate': 'Ám sát',
  'action.Steal': 'Cướp',
  'action.Exchange': 'Đổi bài',
  'action.Convert': 'Cải đạo',
  'action.Embezzle': 'Biển thủ',
  'action.Examine': 'Tra xét',

  'mode.Classic': 'Cổ điển',
  'mode.Reformation': 'Cải cách',

  'faction.Loyalist': 'Bảo hoàng',
  'faction.Reformist': 'Cải cách',

  'phase.AwaitingAction': 'Đang chọn hành động',
  'phase.AwaitingActionChallenge': 'Lúc thách thức',
  'phase.AwaitingBlock': 'Lúc chặn',
  'phase.AwaitingBlockChallenge': 'Lúc thách thức lượt chặn',
  'phase.AwaitingInfluenceLoss': 'Đang mất một lá',
  'phase.AwaitingExchange': 'Đang đổi bài',
  'phase.AwaitingExamineSelection': 'Đang chọn lá để cho xem',
  'phase.AwaitingExamineDecision': 'Đang tra xét',
  'phase.ActionResolved': 'Đã xong',
  'phase.GameOver': 'Hết ván',

  'term.influence': 'ảnh hưởng',
  'term.card': 'lá bài',
  'term.claim': 'tuyên bố',
  'term.bluff': 'bịp',
  'term.challenge': 'thách thức',
  'term.block': 'chặn',
  'term.coin': '{count, plural, other {# xu}}',
  'term.reserve': 'Quỹ dự trữ',
  'term.faction': 'phe',
};

export default glossary;
