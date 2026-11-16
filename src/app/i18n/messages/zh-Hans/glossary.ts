import type { NamespaceTranslation } from '../../schema';

/**
 * zh-Hans `glossary`: the game's nouns. Keep in step with
 * docs/i18n-glossary/zh-Hans.md. Character and action names follow the
 * mainland Chinese edition of Coup (政变) as players discuss it.
 */
const glossary: NamespaceTranslation<'glossary'> = {
  'character.Duke': '公爵',
  'character.Assassin': '刺客',
  'character.Captain': '队长',
  'character.Ambassador': '大使',
  'character.Contessa': '伯爵夫人',
  'character.Inquisitor': '宗教裁判官',

  'action.Income': '收入',
  'action.ForeignAid': '外援',
  'action.Coup': '政变',
  'action.Tax': '征税',
  'action.Assassinate': '暗杀',
  'action.Steal': '勒索',
  'action.Exchange': '交换',
  'action.Convert': '改宗',
  'action.Embezzle': '贪污',
  'action.Examine': '审查',

  'mode.Classic': '经典',
  'mode.Reformation': '宗教改革',

  'faction.Loyalist': '保皇派',
  'faction.Reformist': '改革派',

  'phase.AwaitingAction': '选择行动',
  'phase.AwaitingActionChallenge': '质疑阶段',
  'phase.AwaitingBlock': '阻挡阶段',
  'phase.AwaitingBlockChallenge': '质疑阻挡阶段',
  'phase.AwaitingInfluenceLoss': '失去一张牌',
  'phase.AwaitingExchange': '交换中',
  'phase.AwaitingExamineSelection': '选择出示的牌',
  'phase.AwaitingExamineDecision': '审查中',
  'phase.ActionResolved': '已结算',
  'phase.GameOver': '游戏结束',

  'term.influence': '影响力',
  'term.card': '牌',
  'term.claim': '声称',
  'term.bluff': '诈唬',
  'term.challenge': '质疑',
  'term.block': '阻挡',
  'term.coin': '{count, plural, other {# 枚金币}}',
  'term.reserve': '储备金',
  'term.faction': '阵营',
};

export default glossary;
