import type { NamespaceTranslation } from '../../schema';

/** zh-Hans `stats`: the stats modal. */
const stats: NamespaceTranslation<'stats'> = {
  title: '我的战绩',
  tabOverview: '总览',
  tabAwards: '奖项',
  tabHistory: '历史',

  empty: '还没有玩过任何对局。',
  emptyHint: '打完一局就会开始记录战绩。练习局不计入。',

  reset: '重置战绩',
  resetWarning: '这会删除你的全部战绩，且无法撤销。',
  resetConfirm: '确认',

  gamesPlayed: '对局数',
  gamesWon: '胜局数',
  winRate: '胜率',
  winStreak: '连胜',
  winStreakValue: '{current}（最高 {best}）',
  challengesMade: '发起质疑',
  challengesWon: '质疑成功',
  challengesWonValue: '{won}（{accuracy}）',
  blocksMade: '阻挡次数',
  successfulBluffs: '成功诈唬',
  timesCaught: '被识破次数',
  coups: '政变',
  assassinations: '暗杀',
  firstEliminated: '首个出局',
  totalTurns: '总回合数',
  favoriteAction: '最常用行动',
  noValue: '-',

  awardsEmpty: '打完对局就能获得奖项。',
  awardCount: '×{count}',
  'awardCriterion.pantsOnFire': '诈唬被识破次数最多',
  'awardCriterion.honestAbe': '最常被证明清白，从未露馅',
  'awardCriterion.inquisitor': '发起质疑最多',
  'awardCriterion.eagleEye': '质疑命中率最高',
  'awardCriterion.wall': '阻挡次数最多',
  'awardCriterion.smoothOperator': '声称多次，从未露馅',
  'awardCriterion.coupMachine': '发动政变最多',
  'awardCriterion.silentAssassin': '暗杀次数最多',
  'awardCriterion.boldStrategy': '质疑失败次数最多',
  'awardCriterion.quickExit': '第一个出局',

  historyWonShort: '胜',
  historyLostShort: '负',
  historyWon: '胜',
  historyLost: '负',
  historyPlayers: '{count, plural, other {# 名玩家}}',
  historyTurns: '{count, plural, other {# 回合}}',
  historyChallenges: '质疑：{made} 次（成功 {won} 次）',
  historyBlocks: '阻挡：{count} 次',
  historyCoups: '政变：{count} 次',
  historyAssassinations: '暗杀：{count} 次',
  historyAwards: '奖项：{awards}',
  listSeparator: '、',
};

export default stats;
