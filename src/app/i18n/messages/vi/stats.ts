import type { NamespaceTranslation } from '../../schema';

/** vi `stats`. */
const stats: NamespaceTranslation<'stats'> = {
  title: 'Thành tích',
  tabOverview: 'Tổng quan',
  tabAwards: 'Danh hiệu',
  tabHistory: 'Lịch sử',

  empty: 'Chưa chơi ván nào.',
  emptyHint: 'Chơi hết một ván để bắt đầu ghi thành tích. Ván luyện tập không được tính.',

  reset: 'Xóa thành tích',
  resetWarning: 'Toàn bộ thành tích sẽ bị xóa. Không thể hoàn tác.',
  resetConfirm: 'Xác nhận',

  gamesPlayed: 'Số ván đã chơi',
  gamesWon: 'Số ván thắng',
  winRate: 'Tỉ lệ thắng',
  winStreak: 'Chuỗi thắng',
  winStreakValue: '{current} (cao nhất {best})',
  challengesMade: 'Lần thách thức',
  challengesWon: 'Thách thức thắng',
  challengesWonValue: '{won} ({accuracy})',
  blocksMade: 'Lần chặn',
  successfulBluffs: 'Bịp trót lọt',
  timesCaught: 'Lần bị lộ bịp',
  coups: 'Đảo chính',
  assassinations: 'Ám sát',
  firstEliminated: 'Bị loại đầu tiên',
  totalTurns: 'Tổng số lượt',
  favoriteAction: 'Hành động hay dùng',
  noValue: '-',

  awardsEmpty: 'Chơi hết các ván để nhận danh hiệu.',
  awardCount: 'x{count}',
  'awardCriterion.pantsOnFire': 'Bị lộ bịp nhiều nhất',
  'awardCriterion.honestAbe': 'Bị nghi oan nhiều nhất, chưa lộ bịp',
  'awardCriterion.inquisitor': 'Thách thức nhiều nhất',
  'awardCriterion.eagleEye': 'Thách thức chính xác nhất',
  'awardCriterion.wall': 'Chặn nhiều nhất',
  'awardCriterion.smoothOperator': 'Tuyên bố nhiều, chưa từng lộ bịp',
  'awardCriterion.coupMachine': 'Đảo chính nhiều nhất',
  'awardCriterion.silentAssassin': 'Ám sát nhiều nhất',
  'awardCriterion.boldStrategy': 'Thua thách thức nhiều nhất',
  'awardCriterion.quickExit': 'Người đầu tiên bị loại',

  // T for thắng (won), B for bại (lost).
  historyWonShort: 'T',
  historyLostShort: 'B',
  historyWon: 'Thắng',
  historyLost: 'Thua',
  historyPlayers: '{count, plural, other {# người chơi}}',
  historyTurns: '{count, plural, other {# lượt}}',
  historyChallenges: 'Thách thức: {made} (thắng {won})',
  historyBlocks: 'Chặn: {count}',
  historyCoups: 'Đảo chính: {count}',
  historyAssassinations: 'Ám sát: {count}',
  historyAwards: 'Danh hiệu: {awards}',
  listSeparator: ', ',
};

export default stats;
