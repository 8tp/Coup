import type { NamespaceTranslation } from '../../schema';

/** vi `gameover`. */
const gameover: NamespaceTranslation<'gameover'> = {
  // ── Title and the line under it ──
  titleYouWin: 'Bạn thắng',
  titleWins: '{name} thắng',
  titleNobodyWins: 'Không ai thắng',

  winDefault: 'Những người khác đều đã bị loại.',
  winNoClaims: 'Bạn thắng mà không tuyên bố nhân vật nào trong lượt của mình.',
  winCaughtBluffing: '{count, plural, =1 {Bạn bị lộ bịp một lần mà vẫn thắng.} other {Bạn bị lộ bịp # lần mà vẫn thắng.}}',
  winChallengesWon: 'Bạn thắng {count, plural, other {# lượt thách thức}}.',
  winProvenHonest: 'Bạn bị thách thức {count, plural, other {# lần}} và lần nào cũng có đúng lá.',
  winAssassinations: 'Bạn thắng với {count, plural, other {# vụ ám sát}}.',
  winCoups: 'Bạn thắng với {count, plural, other {# lần Đảo chính}}.',
  winBlocks: 'Bạn đã chặn {count, plural, other {# hành động}}.',
  winClaimsNeverCaught: 'Bạn tuyên bố {count, plural, other {# lần}} mà chưa bị lộ lần nào.',

  loseSpectator: 'Cảm ơn bạn đã xem.',
  loseFirstOut: 'Bạn là người bị loại đầu tiên.',
  loseCaughtBluffing: '{count, plural, =1 {Bạn bị lộ bịp một lần.} other {Bạn bị lộ bịp # lần.}}',
  loseChallengesLost: 'Bạn thua {count, plural, other {# lượt thách thức}}.',
  loseNoClaims: 'Bạn chưa tuyên bố nhân vật nào trong lượt của mình.',
  loseChallengesWon: 'Bạn thắng {count, plural, other {# lượt thách thức}}.',
  loseBlocks: 'Bạn đã chặn {count, plural, other {# hành động}}.',
  loseLandedCoups: 'Bạn Đảo chính thành công {coups, plural, other {# lần}}.',
  loseLandedAssassinations: 'Bạn ám sát thành công {assassinations, plural, other {# lần}}.',
  loseLandedBoth: 'Bạn Đảo chính thành công {coups, plural, other {# lần}} và ám sát thành công {assassinations, plural, other {# lần}}.',
  loseOutPlace: '{place, plural, other {Bạn là người thứ # bị loại.}}',
  loseOut: 'Bạn đã bị loại.',

  // ── Final hands ──
  handsHeading: 'Bài cuối ván',
  lostCard: 'Lá đã mất',
  youName: 'Bạn',
  handWinner: '<sr>Người thắng: </sr>{name}',
  handCoinsLeft: '{count, plural, other {Còn # xu}}',
  handOutOnTurn: 'Bị loại ở lượt {turn}',
  handWins: '{count, plural, other {Thắng # ván}}',

  // ── How it went ──
  recapHeading: 'Diễn biến ván',
  you: 'bạn',
  someone: 'Ai đó',

  finishCoup: '{actor, select, you {Bạn} other {{actor}}} kết thúc ván ở lượt {turn} bằng một cú Đảo chính vào {loser}.',
  finishAssassination: '{actor, select, you {Bạn} other {{actor}}} kết thúc ván ở lượt {turn} bằng việc ám sát {loser}.',
  finishCaughtBluffing: '{actor, select, you {Bạn} other {{actor}}} kết thúc ván ở lượt {turn} bằng việc lật tẩy cú bịp của {loser}.',
  finishCaughtBlockBluff: '{actor, select, you {Bạn} other {{actor}}} kết thúc ván ở lượt {turn} bằng việc lật tẩy lượt chặn bịp của {loser}.',
  finishChallengeFailed: '{actor, select, you {Bạn} other {{actor}}} kết thúc ván ở lượt {turn}: {loser} thách thức và {actor} có {character}.',
  finishBlockChallengeFailed: '{actor, select, you {Bạn} other {{actor}}} kết thúc ván ở lượt {turn}: {loser} thách thức lượt chặn và {actor} có {character}.',
  finishChallengeLost: '{actor, select, you {Bạn} other {{actor}}} kết thúc ván ở lượt {turn} khi {loser} thua một lượt thách thức.',
  finishLastCard: '{player, select, you {Bạn} other {{player}}} mất lá cuối cùng ở lượt {turn}.',
  finishLasted: 'Ván kéo dài {turns, plural, other {# lượt}}.',

  bluffsHonestOne: 'Lời tuyên bố duy nhất là thật.',
  bluffsHonestAll: 'Cả {claims, plural, other {# lời tuyên bố}} đều là thật.',
  bluffsOneCaught: '1 trong {claims, plural, other {# lời tuyên bố}} là bịp. Cú bịp đó đã bị lật tẩy.',
  bluffsOneGotAway: '1 trong {claims, plural, other {# lời tuyên bố}} là bịp. Cú bịp đó đã trót lọt.',
  bluffsMany: '{bluffs} trong {claims, plural, other {# lời tuyên bố}} là bịp. {outcome, select, none {Không cú nào bị lật tẩy.} all {Tất cả đều bị lật tẩy.} other {{caught, plural, other {# cú bị lật tẩy.}}}}',
  bluffsManyLeader: '{bluffs} trong {claims, plural, other {# lời tuyên bố}} là bịp. {outcome, select, none {Không cú nào bị lật tẩy.} all {Tất cả đều bị lật tẩy.} other {{caught, plural, other {# cú bị lật tẩy.}}}} {leader, select, you {Bạn} other {{leader}}} bịp nhiều nhất, {leaderBluffs, plural, other {# lần}}.',

  challengesOnlyWon: '{winner, select, you {Bạn} other {{winner}}} là người duy nhất thách thức và đã thắng.',
  challengesOnlyFailed: 'Lượt thách thức duy nhất đã thất bại.',
  challengesAllFailed: 'Cả {made, plural, other {# lượt thách thức}} đều thất bại.',
  challengesWon: 'Người thách thức thắng {won} trong {made, plural, other {# lượt thách thức}}.',
  challengesWonLeaderAll: 'Người thách thức thắng {won} trong {made, plural, other {# lượt thách thức}}. {best, select, you {Bạn} other {{best}}} thắng tất cả các lượt đó.',
  challengesWonLeaderSome: 'Người thách thức thắng {won} trong {made, plural, other {# lượt thách thức}}. {best, select, you {Bạn} other {{best}}} thắng {bestWon} lượt.',

  // ── Awards ──
  awardsHeading: 'Danh hiệu',

  // Chú Cuội, the boy in the moon of Vietnamese folklore: "nói dối như Cuội" (to lie like Cuội).
  'awardTitle.pantsOnFire': 'Chú Cuội',
  'awardLine.pantsOnFire': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, bị lộ bịp {count, plural, other {# lần}}',
  // The idiom "thật thà như đếm": honest as counting.
  'awardTitle.honestAbe': 'Thật như đếm',
  'awardLine.honestAbe': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, bị nghi oan {count, plural, other {# lần}}, chưa lộ bịp lần nào',
  // The Inquisitor's card name, as the pun asks.
  'awardTitle.inquisitor': 'Phán quan',
  'awardLine.inquisitor': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, thách thức {count, plural, other {# lần}}',
  // Internet slang: "thánh soi", the saint of spotting things.
  'awardTitle.eagleEye': 'Thánh soi',
  'awardLine.eagleEye': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, thách thức đúng {won}/{made} lần',
  'awardTitle.wall': 'Bức tường',
  'awardLine.wall': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, chặn {count, plural, other {# lần}}',
  // "Cáo già": an old fox, the sly one nobody catches.
  'awardTitle.smoothOperator': 'Cáo già',
  'awardLine.smoothOperator': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, {count, plural, other {# lời tuyên bố}}, chưa từng lộ bịp',
  'awardTitle.coupMachine': 'Vua đảo chính',
  'awardLine.coupMachine': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, Đảo chính {count, plural, other {# lần}}',
  'awardTitle.silentAssassin': 'Thích khách',
  'awardLine.silentAssassin': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, {count, plural, other {# vụ ám sát}}',
  // The proverb "liều ăn nhiều" (the bold eat well), said ironically of challenges that backfired.
  'awardTitle.boldStrategy': 'Liều ăn nhiều',
  'awardLine.boldStrategy': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, thua {count, plural, other {# lượt thách thức}}',
  'awardTitle.quickExit': 'Về sớm',
  'awardLine.quickExit': '{player, select, you {<who>Bạn</who>} other {<who>{player}</who>}}, người đầu tiên bị loại',

  // ── More details ──
  moreLabel: 'Thêm về ván này',
  showBluffs: 'Xem bịp',
  hideBluffs: 'Ẩn bịp',
  showLog: 'Xem nhật ký',
  hideLog: 'Ẩn nhật ký',
  copyRecap: 'Chép tóm tắt',
  downloadLog: 'Tải nhật ký',
  recapCopied: 'Đã chép tóm tắt',
  copyFailed: 'Không chép được ở đây. Hãy tải nhật ký về.',

  bluffRowAllHonest: '{claims, plural, other {# lời tuyên bố}}, đều thật',
  bluffRowClaims: '{claims, plural, other {# lời tuyên bố}}',
  bluffRowBluffs: '{count, plural, other {# lần bịp}}',
  bluffRowCaught: '{count} bị lật tẩy',
  bluffRowGotAway: '{count} trót lọt',

  exportTitle: 'Tóm tắt Coup Online, phòng {room}',
  exportWinner: 'Người thắng: {name}',
  exportWinnerUnknown: 'Người thắng: không rõ',
  exportTurns: 'Số lượt: {count}',
  exportMode: 'Chế độ: {mode}',
  exportModeInquisitor: 'Chế độ: {mode} có {inquisitor}',
  exportTableHeading: 'Bàn cuối ván:',
  exportPlayer: '- {name}: {status}, {coins, plural, other {# xu}}, {cards}',
  exportPlayerFaction: '- {name}: {status}, {coins, plural, other {# xu}}, phe {faction}, {cards}',
  exportStatusWinner: 'thắng',
  exportStatusAlive: 'còn trong ván',
  exportStatusOut: 'bị loại',
  exportCardRevealed: '{character} đã lật',
  exportCardHidden: '{character} đang úp',
  exportCardUnknown: 'lá đang úp',
  exportListSeparator: ', ',
  exportLogHeading: 'Nhật ký:',
  // "L" stands for lượt (turn).
  exportLogLine: '[L{turn}] {line}',

  // ── Footer ──
  playAgain: 'Chơi lại',
  leave: 'Rời phòng',
  backHome: 'Về trang chủ',
  spectating: 'Đang xem',
  waitingForHost: 'Đang chờ chủ phòng mở ván mới',
  feedback: 'Báo lỗi hoặc góp ý',
};

export default gameover;
