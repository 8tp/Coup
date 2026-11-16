import type { NamespaceTranslation } from '../../schema';

/** vi `game`. */
const game: NamespaceTranslation<'game'> = {
  // ── Header ──
  roomCodeTitle: 'Mã phòng',
  turn: 'Lượt {turn}',
  watching: '{count, plural, other {# người xem}}',
  logAndChat: 'Nhật ký và trò chuyện',
  logAndChatUnread: 'Nhật ký và trò chuyện, {count, plural, other {# tin chưa đọc}}',
  unreadMany: '9+',
  muteSound: 'Tắt hiệu ứng âm thanh',
  unmuteSound: 'Bật hiệu ứng âm thanh',
  settings: 'Cài đặt',
  howToPlay: 'Cách chơi',

  // ── Banners and loading ──
  spectating: 'Đang xem',
  stopSpectating: 'Rời',
  reconnecting: 'Đang kết nối lại với máy chủ…',
  connecting: 'Đang kết nối…',
  dealing: 'Đang chia bài…',
  newGameFailed: 'Không bắt đầu được ván',

  // ── Browser tab title ──
  'title.plain': 'Coup {room}',
  'title.status': '{status} | Coup {room}',
  'title.watching': 'Đang xem',
  'title.eliminated': 'Bị loại',
  'title.yourTurn': 'Lượt của bạn',
  'title.blockOrChallenge': 'Chặn hoặc thách thức',
  'title.challengeOrPass': 'Thách thức hoặc bỏ qua',
  'title.blockOrAllow': 'Chặn hoặc cho qua',
  'title.challengeBlock': 'Thách thức lượt chặn',
  'title.loseCard': 'Mất một lá',
  'title.keepCards': 'Chọn lá để giữ',
  'title.showCard': 'Cho xem một lá',
  'title.examineCard': 'Tra xét lá bài',

  // ── The log drawer ──
  drawerTitle: 'Nhật ký & trò chuyện',
  closeLog: 'Đóng nhật ký',
  mutePlayers: 'Tắt tiếng người chơi',
  muted: 'Đã tắt tiếng',
  chatOn: 'Hiện tin nhắn và biểu cảm',

  // ── Objects on the felt ──
  deck: 'Chồng bài {count}',
  treasury: 'Ngân khố {count}',
  reserve: 'Dự trữ {count}',
  fallen: 'Đã lật {count}',
  flightStrike: 'Đâm',
  'fx.caughtBluffing': 'Lộ bịp',
  'fx.lostCard': 'Mất lá',
  'fx.blocked': 'Bị chặn',
  'fx.eliminated': 'Bị loại',

  // ── Your hand ──
  yourMove: 'Tới lượt bạn',
  yourHand: 'Bài của bạn',
  eliminated: 'Bị loại',

  // ── Seats ──
  'seat.choose': 'Chọn {name}',
  'seat.refused': '{name}: {reason}',
  'seat.bot': 'BOT',
  // Initials, the usual Vietnamese way to shorten a name: Bảo hoàng, Cải cách.
  'seat.faction.Loyalist': 'BH',
  'seat.faction.Reformist': 'CC',
  'seat.mute': 'Ẩn tin nhắn và biểu cảm của {name}',
  'seat.muteShort': 'Tắt tiếng {name}',
  'seat.unmute': 'Bật tiếng {name}',

  // ── The phase line over the felt ──
  'phase.yourTurn': 'Lượt của bạn: chọn một hành động',
  'phase.theirTurn': 'Lượt của {name}',
  'phase.claimBlockOrChallenge': '{actor} tuyên bố có {character}: chặn hoặc thách thức',
  'phase.claimChallengeOrPass': '{actor} tuyên bố có {character}: thách thức hoặc bỏ qua',
  'phase.claimNoChallengeOrPass': '{actor} tuyên bố không có {character}: thách thức hoặc bỏ qua',
  'phase.aCharacter': 'một nhân vật',
  'phase.waitingChallenge': '{count, plural, =0 {Đang chờ người chơi thách thức hoặc bỏ qua} other {Đang chờ {names} thách thức hoặc bỏ qua}}',
  'phase.targetingYou': '{actor} đang nhắm vào bạn: chặn hoặc cho qua',
  'phase.usesBlockOrAllow': '{actor} dùng {action}: chặn hoặc cho qua',
  'phase.waitingBlock': '{count, plural, =0 {Đang chờ người chơi chặn hoặc cho qua} other {Đang chờ {names} chặn hoặc cho qua}}',
  'phase.blockChallengeOrPass': '{blocker} chặn bằng {character}: thách thức hoặc bỏ qua',
  'phase.chooseLoss': 'Chọn lá bài sẽ mất',
  'phase.choosingLoss': '{name} đang chọn lá bài sẽ mất',
  'phase.chooseToShow': 'Chọn một lá cho {examiner} xem',
  'phase.chooseToShowInquisitor': 'Chọn một lá cho {character} xem',
  'phase.choosingToShow': '{target} đang chọn một lá cho {examiner} tra xét',
  'phase.examineDecision': 'Trả lại lá bài hoặc buộc đổi',
  'phase.examining': '{name} đang tra xét một lá',
  'phase.chooseKeep': 'Chọn các lá để giữ',
  'phase.choosingKeep': '{name} đang chọn lá để giữ',
  'phase.someoneChoosingKeep': 'Một người chơi đang chọn lá để giữ',
  'phase.gameOver': 'Hết ván',

  // ── The claim plaque ──
  'plaque.you': 'Bạn',
  'plaque.as': 'bằng {character}',
  'plaque.claimsNo': 'không có {character}',
  'plaque.on': '{target, select, you {nhắm vào bạn} other {nhắm vào {target}}}',
  'plaque.asOn': '{target, select, you {bằng {character} · nhắm vào bạn} other {bằng {character} · nhắm vào {target}}}',
  'plaque.claimsNoOn': '{target, select, you {không có {character} · nhắm vào bạn} other {không có {character} · nhắm vào {target}}}',
  'plaque.blocks': 'Chặn',

  // ── The action bar ──
  'actionDesc.Income': '+{count, plural, other {# xu}} (không bị chặn)',
  'actionDesc.ForeignAid': '+{count, plural, other {# xu}} (có thể bị chặn)',
  'actionDesc.Tax': '+{count, plural, other {# xu}} (tuyên bố {character})',
  'actionDesc.Steal': 'Lấy {count, plural, other {# xu}} (tuyên bố {character})',
  'actionDesc.Assassinate': 'Trả {cost} xu, họ mất 1 lá (tuyên bố {character})',
  'actionDesc.Exchange': 'Rút {count}, trả {count} (tuyên bố {character})',
  'actionDesc.Coup': 'Trả {cost} xu, họ mất 1 lá (không bị chặn)',
  'actionDesc.Examine': 'Xem 1 lá (tuyên bố {character})',
  'actionDesc.Convert': 'Đổi phe ({self} hoặc {other} xu)',
  'actionDesc.Embezzle': 'Lấy {count, plural, other {# xu}} trong quỹ (tuyên bố không có {character})',
  'actionDesc.EmbezzleEmpty': 'Quỹ dự trữ đang trống',
  chooseTarget: 'Chọn người để {action, select, Coup {Đảo chính} Assassinate {Ám sát} Steal {Cướp} Examine {Tra xét} other {{action}}}',
  chooseConvert: 'Chọn người để Cải đạo',
  convertSelf: 'Bản thân ({count, plural, other {# xu}})',
  convertOther: '{name} ({count, plural, other {# xu}})',
  targetRow: '{name} ({count, plural, other {# xu}})',
  mustCoup: '{count, plural, other {Bạn có # xu nên phải Đảo chính}}',
  mustCoupHint: 'Chọn người sẽ mất một lá',
  coupTarget: 'Đảo chính {name}',
  nobodyToTarget: 'Không còn ai khác để nhắm vào.',

  // ── Refusals ──
  'refusal.pending': 'Bạn đã chọn hành động rồi.',
  'refusal.sameFaction': 'Cùng phe. Hãy Cải đạo trước, hoặc chờ tới khi mọi người cùng một phe.',
  'refusal.noCoinsToSteal': '{name} không có xu nào để cướp.',
  'refusal.nobodyHasCoins': 'Không ai có xu để cướp.',
  'refusal.nobodyLeft': 'Không còn ai khác để {action, select, Coup {Đảo chính} Assassinate {Ám sát} Steal {Cướp} Examine {Tra xét} other {{action}}}.',
  'refusal.reserveEmpty': 'Quỹ dự trữ đang trống nên không có gì để Biển thủ.',
  'refusal.needCoinsCoup': 'Bạn cần {cost, plural, other {# xu}} để Đảo chính. Bạn đang có {have}.',
  'refusal.needCoinsAssassinate': 'Bạn cần {cost, plural, other {# xu}} để Ám sát. Bạn đang có {have}.',
  'refusal.needCoinsConvertSelf': 'Bạn cần {cost, plural, other {# xu}} để tự Cải đạo. Bạn đang có {have}.',
  'refusal.needCoinsConvertOther': 'Bạn cần {cost, plural, other {# xu}} để Cải đạo {name}. Bạn đang có {have}.',

  // ── Knocked out ──
  'watch.label': 'Bạn đang xem',
  'watch.title': 'Đang xem',
  'watch.body': 'Bạn đã bị loại. Xem nốt ván, hoặc rời đi lúc nào tùy bạn.',
  'watch.newGame': 'Ván mới',
  'watch.leave': 'Rời bàn',

  // ── Cards ──
  'card.hidden': 'Lá ảnh hưởng đang úp',
  'card.influence': 'Lá ảnh hưởng {character}',
  'card.influenceSelected': 'Lá ảnh hưởng {character}, đã chọn',
  'card.revealed': 'Lá ảnh hưởng {character} đã lật',
  'cardAction.Duke': 'Thu thuế',
  'cardAction.Assassin': 'Ám sát',
  'cardAction.Captain': 'Cướp',
  'cardAction.Ambassador': 'Đổi bài',
  'cardAction.Contessa': 'Chặn',
  'cardAction.Inquisitor': 'Tra xét',
  'cardAbility.Duke': 'Thu thuế: Lấy 3 xu. Chặn Viện trợ.',
  'cardAbility.Assassin': 'Ám sát: Trả 3 xu. Mục tiêu mất một lá.',
  'cardAbility.Captain': 'Cướp: Lấy 2 xu của mục tiêu. Chặn Cướp.',
  'cardAbility.Ambassador': 'Đổi bài: Rút 2, trả lại 2. Chặn Cướp.',
  'cardAbility.Contessa': 'Chặn Ám sát.',
  'cardAbility.Inquisitor': 'Đổi bài: Rút 1, trả lại 1. Tra xét: Xem một lá của đối thủ. Chặn Cướp.',

  // ── Reactions ──
  reactionPicker: 'Gửi biểu cảm',
  reactionLine: '{emoji} {label}',
  'reaction.gg': 'GG',
  'reaction.nice_bluff': 'Bịp đỉnh',
  // "Smells fishy": the everyday way to say something is suspicious.
  'reaction.sus': 'Có mùi',
  // Slang for bitter after losing.
  'reaction.salty': 'Cay',
  'reaction.wow': 'Ghê',
  'reaction.lol': 'Haha',
  // Slang: "it's all over", said when someone is done for.
  'reaction.rip': 'Toang',
  'reaction.no_way': 'Vô lý',
  'reaction.big_brain': 'Não to',
  'reaction.sweat': 'Run quá',
  'reaction.eyes': 'Soi đấy',
  // Mocks someone arguing their way out of a loss.
  'reaction.cope': 'Cãi cố',

  // ── Chat ──
  // A pun: "bàn" is both "table" and "to discuss".
  tableTalk: 'Bàn tán',
  tableTalkLabel: 'Trò chuyện tại bàn',
  chatEmpty: 'Chưa có tin nhắn nào.',
  chatPlaceholder: 'Nhắn cả bàn',
  chatInputLabel: 'Tin nhắn',
  chatSend: 'Gửi',
  chatSpeaker: '{name}:',
  quickPhrasesLabel: 'Tin nhắn nhanh',
  'phrase.nice_bluff': 'Bịp hay đấy',
  'phrase.have_it': 'Mình có lá đó',
  'phrase.liar': 'Bịp rồi!',
  'phrase.well_played': 'Chơi hay',
};

export default game;
