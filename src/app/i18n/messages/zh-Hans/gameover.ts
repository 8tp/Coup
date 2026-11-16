import type { NamespaceTranslation } from '../../schema';

/**
 * zh-Hans `gameover`. A player param that is the reader renders as "你";
 * `you` selects are kept only to drop the spaces that surround a Latin name.
 */
const gameover: NamespaceTranslation<'gameover'> = {
  // ── Title ──
  titleYouWin: '你赢了',
  titleWins: '{name} 赢了',
  titleNobodyWins: '没有赢家',

  winDefault: '其他人都出局了。',
  winNoClaims: '你在自己的回合里一次角色都没声称就赢了。',
  winCaughtBluffing: '{count, plural, other {你的诈唬被识破了 # 次，还是赢了。}}',
  winChallengesWon: '你赢了 {count, plural, other {# 次质疑}}。',
  winProvenHonest: '你被质疑了 {count, plural, other {# 次}}，每次都真有那张牌。',
  winAssassinations: '你靠 {count, plural, other {# 次暗杀}}赢下了这局。',
  winCoups: '你靠 {count, plural, other {# 次政变}}赢下了这局。',
  winBlocks: '你阻挡了 {count, plural, other {# 次行动}}。',
  winClaimsNeverCaught: '你声称了 {count, plural, other {# 次}}，一次都没被识破。',

  loseSpectator: '感谢观战。',
  loseFirstOut: '你是第一个出局的玩家。',
  loseCaughtBluffing: '{count, plural, other {你的诈唬被识破了 # 次。}}',
  loseChallengesLost: '你输了 {count, plural, other {# 次质疑}}。',
  loseNoClaims: '你在自己的回合里一次角色都没声称过。',
  loseChallengesWon: '你赢了 {count, plural, other {# 次质疑}}。',
  loseBlocks: '你阻挡了 {count, plural, other {# 次行动}}。',
  loseLandedCoups: '你成功发动了 {coups, plural, other {# 次政变}}。',
  loseLandedAssassinations: '你成功完成了 {assassinations, plural, other {# 次暗杀}}。',
  loseLandedBoth: '你成功发动了 {coups, plural, other {# 次政变}}和 {assassinations, plural, other {# 次暗杀}}。',
  loseOutPlace: '{place, plural, other {你是第 # 个出局的玩家。}}',
  loseOut: '你出局了。',

  // ── Final hands ──
  handsHeading: '最终手牌',
  lostCard: '已失去的牌',
  youName: '你',
  handWinner: '<sr>赢家：</sr>{name}',
  handCoinsLeft: '{count, plural, other {剩 # 枚金币}}',
  handOutOnTurn: '第 {turn} 回合出局',
  handWins: '{count, plural, other {# 胜}}',

  // ── How it went ──
  recapHeading: '对局回顾',
  you: '你',
  someone: '某人',

  finishCoup: '{actor, select, you {你} other {{actor} }}在第 {turn} 回合对{loser, select, you {你} other { {loser} }}发动政变，结束了游戏。',
  finishAssassination: '{actor, select, you {你} other {{actor} }}在第 {turn} 回合暗杀了{loser, select, you {你} other { {loser} }}，结束了游戏。',
  finishCaughtBluffing: '{actor, select, you {你} other {{actor} }}在第 {turn} 回合识破了{loser, select, you {你} other { {loser} }}的诈唬，结束了游戏。',
  finishCaughtBlockBluff: '{actor, select, you {你} other {{actor} }}在第 {turn} 回合识破了{loser, select, you {你} other { {loser} }}的诈唬阻挡，结束了游戏。',
  finishChallengeFailed: '{actor, select, you {你} other {{actor} }}在第 {turn} 回合结束了游戏：{loser, select, you {你} other {{loser} }}发起质疑，而{actor, select, you {你} other { {actor} }}真有{character}。',
  finishBlockChallengeFailed: '{actor, select, you {你} other {{actor} }}在第 {turn} 回合结束了游戏：{loser, select, you {你} other {{loser} }}质疑了阻挡，而{actor, select, you {你} other { {actor} }}真有{character}。',
  finishChallengeLost: '{actor, select, you {你} other {{actor} }}在第 {turn} 回合结束了游戏，{loser, select, you {你} other { {loser} }}输掉了一次质疑。',
  finishLastCard: '{player, select, you {你} other {{player} }}在第 {turn} 回合失去了最后一张牌。',
  finishLasted: '这局游戏持续了 {turns, plural, other {# 个回合}}。',

  bluffsHonestOne: '唯一的一次声称是真的。',
  bluffsHonestAll: '全部 {claims, plural, other {# 次声称}}都是真的。',
  bluffsOneCaught: '{claims, plural, other {# 次声称}}中有 1 次是诈唬，被识破了。',
  bluffsOneGotAway: '{claims, plural, other {# 次声称}}中有 1 次是诈唬，没被识破。',
  bluffsMany: '{claims, plural, other {# 次声称}}中有 {bluffs} 次是诈唬。{outcome, select, none {一次都没被识破。} all {全部被识破。} other {{caught, plural, other {# 次被识破。}}}}',
  bluffsManyLeader: '{claims, plural, other {# 次声称}}中有 {bluffs} 次是诈唬。{outcome, select, none {一次都没被识破。} all {全部被识破。} other {{caught, plural, other {# 次被识破。}}}}{leader, select, you {你} other {{leader} }}诈唬最多，共 {leaderBluffs, plural, other {# 次}}。',

  challengesOnlyWon: '唯一的一次质疑由{winner, select, you {你} other { {winner} }}发起，并且成功了。',
  challengesOnlyFailed: '唯一的一次质疑失败了。',
  challengesAllFailed: '全部 {made, plural, other {# 次质疑}}都失败了。',
  challengesWon: '{made, plural, other {# 次质疑}}中成功了 {won} 次。',
  challengesWonLeaderAll: '{made, plural, other {# 次质疑}}中成功了 {won} 次，全部出自{best, select, you {你} other { {best} }}之手。',
  challengesWonLeaderSome: '{made, plural, other {# 次质疑}}中成功了 {won} 次，其中 {bestWon} 次出自{best, select, you {你} other { {best} }}之手。',

  // ── Awards ──
  awardsHeading: '奖项',
  'awardTitle.pantsOnFire': '露馅王',
  'awardLine.pantsOnFire': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，诈唬被识破 {count, plural, other {# 次}}',
  'awardTitle.honestAbe': '老实人',
  'awardLine.honestAbe': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，{count, plural, other {# 次}}被证明清白，从未被识破',
  'awardTitle.inquisitor': '杠精',
  'awardLine.inquisitor': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，发起 {count, plural, other {# 次质疑}}',
  'awardTitle.eagleEye': '火眼金睛',
  'awardLine.eagleEye': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，质疑命中 {won}/{made}',
  'awardTitle.wall': '铜墙铁壁',
  'awardLine.wall': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，阻挡 {count, plural, other {# 次}}',
  'awardTitle.smoothOperator': '影帝',
  'awardLine.smoothOperator': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，声称 {count, plural, other {# 次}}，从未被识破',
  'awardTitle.coupMachine': '政变狂魔',
  'awardLine.coupMachine': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，发动 {count, plural, other {# 次政变}}',
  'awardTitle.silentAssassin': '无影刺客',
  'awardLine.silentAssassin': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，暗杀 {count, plural, other {# 次}}',
  'awardTitle.boldStrategy': '勇气可嘉',
  'awardLine.boldStrategy': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，质疑失败 {count, plural, other {# 次}}',
  'awardTitle.quickExit': '一轮游',
  'awardLine.quickExit': '{player, select, you {<who>你</who>} other {<who>{player}</who>}}，第一个出局',

  // ── More details ──
  moreLabel: '这局游戏的更多信息',
  showBluffs: '查看诈唬',
  hideBluffs: '收起诈唬',
  showLog: '查看完整记录',
  hideLog: '收起记录',
  copyRecap: '复制战报',
  downloadLog: '下载记录',
  recapCopied: '战报已复制',
  copyFailed: '这里无法复制，请改为下载记录。',

  bluffRowAllHonest: '{claims, plural, other {声称 # 次}}，全部属实',
  bluffRowClaims: '{claims, plural, other {声称 # 次}}',
  bluffRowBluffs: '{count, plural, other {诈唬 # 次}}',
  bluffRowCaught: '被识破 {count} 次',
  bluffRowGotAway: '蒙混过关 {count} 次',

  exportTitle: 'Coup Online 战报，房间 {room}',
  exportWinner: '赢家：{name}',
  exportWinnerUnknown: '赢家：未知',
  exportTurns: '回合数：{count}',
  exportMode: '模式：{mode}',
  exportModeInquisitor: '模式：{mode}（使用{inquisitor}）',
  exportTableHeading: '最终牌桌：',
  exportPlayer: '- {name}：{status}，{coins, plural, other {# 枚金币}}，{cards}',
  exportPlayerFaction: '- {name}：{status}，{coins, plural, other {# 枚金币}}，{faction}，{cards}',
  exportStatusWinner: '赢家',
  exportStatusAlive: '存活',
  exportStatusOut: '出局',
  exportCardRevealed: '{character}（已翻开）',
  exportCardHidden: '{character}（暗牌）',
  exportCardUnknown: '暗牌',
  exportListSeparator: '、',
  exportLogHeading: '最终记录：',
  exportLogLine: '[回合 {turn}] {line}',

  // ── Footer ──
  playAgain: '再来一局',
  leave: '离开',
  backHome: '返回首页',
  spectating: '观战中',
  waitingForHost: '等待房主发起再来一局',
  feedback: '报告问题或提建议',
};

export default gameover;
