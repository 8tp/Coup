import type { NamespaceTranslation } from '../../schema';

/** vi `prompts`. */
const prompts: NamespaceTranslation<'prompts'> = {
  // ── Buttons ──
  challenge: 'Thách thức',
  pass: 'Bỏ qua',
  blockWith: 'Chặn bằng {character}',
  dontBlock: 'Không chặn',
  bluffHint: 'Thách thức nếu bạn nghĩ họ đang bịp. Nếu họ không bịp, bạn mất một lá.',

  // ── Challenge window ──
  declaredBlock: '<b>{blocker}</b> sẽ chặn bằng {character} nếu {action} được tiến hành.',
  youClaimed: 'Bạn tuyên bố có <c>{character}</c> để {action}',
  youClaimedOn: 'Bạn tuyên bố có <c>{character}</c> để {action} <b>{target}</b>',
  youClaimedNo: 'Bạn tuyên bố <c>không có {character}</c> để {action}',
  waitingChallenge: '{count, plural, =0 {Đang chờ người chơi thách thức hoặc bỏ qua.} other {Đang chờ {names} thách thức hoặc bỏ qua.}}',
  youWillBlock: 'Bạn sẽ chặn bằng <c>{character}</c> nếu {action} được tiến hành.',
  waitingFor: '{count, plural, =0 {Đang chờ người chơi.} other {Đang chờ {names}.}}',
  passedCanBlock: 'Bạn đã bỏ qua lượt thách thức. Bạn vẫn có thể chặn.',
  passedWaiting: '{count, plural, =0 {Bạn đã bỏ qua. Đang chờ người chơi.} other {Bạn đã bỏ qua. Đang chờ {names}.}}',
  claim: '{actor} tuyên bố có {character} để {action}',
  claimOn: '{actor} tuyên bố có {character} để {action} {target}',
  claimStealFrom: '{actor} tuyên bố có {character} để {action} của {target}',
  claimAtYou: '{actor} tuyên bố có {character} để {action} bạn',
  claimStealFromYou: '{actor} tuyên bố có {character} để {action} của bạn',
  claimNo: '{actor} tuyên bố không có {character} để {action}',
  embezzleHint: 'Thách thức nếu bạn nghĩ họ có {character}. Nếu họ không có, bạn mất một lá.',
  'blockHint.Assassinate': '{count, plural, =1 {Chặn bằng {who} hoặc mất một lá. Bạn được tuyên bố có {who} dù không giữ lá đó.} other {Chặn bằng {who} hoặc mất một lá. Bạn được tuyên bố có một trong hai dù không giữ lá nào.}}',
  'blockHint.Steal': '{count, plural, =1 {Chặn bằng {who} để giữ xu. Bạn được tuyên bố có {who} dù không giữ lá đó.} other {Chặn bằng {who} để giữ xu. Bạn được tuyên bố có một trong hai dù không giữ lá nào.}}',
  'blockHint.other': '{count, plural, =1 {Chặn bằng {who} để ngăn hành động này. Bạn được tuyên bố có {who} dù không giữ lá đó.} other {Chặn bằng {who} để ngăn hành động này. Bạn được tuyên bố có một trong hai dù không giữ lá nào.}}',

  // ── Block window ──
  yourActionUnless: '{action} của bạn sẽ diễn ra trừ khi <b>{target}</b> chặn.',
  yourActionUnlessAnyone: '{action} của bạn sẽ diễn ra trừ khi có người chặn.',
  usesOn: '<b>{actor}</b> dùng {action} lên <b>{target}</b>.',
  waitingTarget: 'Đang chờ <b>{target}</b> chặn hoặc cho qua.',
  sameFactionForeignAid: 'Bạn không thể chặn {action} của <b>{actor}</b>. Hai bạn cùng phe, và cả hai phe vẫn còn trong ván.',
  blockPassed: 'Bạn đã bỏ qua.',
  blockPassedWaiting: 'Bạn đã bỏ qua. Đang chờ {names}.',
  assassinating: '{actor} đang ám sát bạn',
  assassinatingHint: 'Chặn bằng {character} hoặc mất một lá. Bạn được tuyên bố có {character} dù không giữ lá đó.',
  stealing: '{actor} đang cướp {count, plural, other {# xu của bạn}}',
  stealingHint: 'Chặn bằng {blockers} để giữ {count, plural, other {# xu}}. Bạn được tuyên bố có một trong hai dù không giữ lá nào.',
  foreignAid: '{actor} đang nhận {action} (+{count, plural, other {# xu}})',
  foreignAidHint: 'Tuyên bố có {character} để không cho họ lấy {count, plural, other {# xu}}. Bạn được tuyên bố có {character} dù không giữ lá đó.',
  uses: '{actor} dùng {action}',
  canBlock: 'Bạn có thể chặn.',

  // ── Block challenge window ──
  youClaimedBlock: 'Bạn tuyên bố có <c>{character}</c> để chặn.',
  acceptedWaiting: '{count, plural, =0 {Bạn chấp nhận lượt chặn. Đang chờ người chơi.} other {Bạn chấp nhận lượt chặn. Đang chờ {names}.}}',
  blockClaim: '{blocker} tuyên bố có <c>{character}</c> để chặn {action}',
  blockClaimPlain: '{blocker} tuyên bố có <c>{character}</c> để chặn',

  // ── Losing a card ──
  'loss.coup': 'Bạn bị Đảo chính',
  'loss.assassination': 'Bạn bị ám sát',
  'loss.challenge_lost': 'Bạn thua lượt thách thức',
  'loss.challenge_failed_defense': 'Bạn bị lộ bịp',
  'loss.embezzle_failed': 'Bạn bị phát hiện có {character}',
  'loss.default': 'Chọn lá bài sẽ mất',
  tapToLose: 'Chạm vào một lá để bỏ nó. Lá đó sẽ lật ngửa.',
  mustChoose: '<b>{name}</b> phải chọn một lá để mất.',
  'lossWatch.coup': 'Đảo chính',
  'lossWatch.assassination': 'Ám sát',
  'lossWatch.challenge_lost': 'Thua thách thức',
  'lossWatch.challenge_failed_defense': 'Lộ bịp',
  'lossWatch.embezzle_failed': 'Biển thủ thất bại',
  'lossWatch.default': 'Phải mất một lá',

  // ── Exchange ──
  exchangeInProgress: 'Đang đổi bài',
  // Vietnamese puts the action first: "Đổi bài · Đại sứ".
  exchangeTitle: '{action} · {character}',
  exchangeHint: 'Chạm {count, plural, other {# lá}} để giữ. Số còn lại trả về chồng bài.',
  keepSelected: 'Giữ các lá đã chọn ({selected}/{total})',

  // ── Examine ──
  examinedCard: 'Lá bài của {name}',
  forceSwapHint: 'Buộc đổi sẽ đưa lá này vào chồng bài và họ rút một lá mới.',
  examineReturn: 'Trả lại',
  forceSwap: 'Buộc đổi',
  showTo: 'Chọn một lá cho {name} xem',
  showToInquisitor: 'Chọn một lá cho {character} xem',
  showHint: 'Chỉ người tra xét thấy lá này. Họ có thể trả lại, hoặc buộc bạn đổi lấy một lá mới.',

  // ── Challenge reveal ──
  'reveal.skip': 'Bỏ qua phần lật bài',
  'reveal.newCard': 'Lá ảnh hưởng mới đang úp',
  'reveal.showsAllNo': '{name} lật mọi lá và <c>không có {character}</c>',
  'reveal.reveals': '{name} lật ra <c>{character}</c>',
  'reveal.doesNotHave': '{name} không có <c>{character}</c>',
  'reveal.challengeFails': 'Thách thức thất bại',
  'reveal.caught': 'Lộ bịp',
  'reveal.mustLose': '{name} phải mất một lá',
  'reveal.swap': '{count, plural, =1 {Lá vừa lật được trộn lại vào chồng bài, rồi rút một lá thay thế.} other {Các lá vừa lật được trộn lại vào chồng bài, rồi rút các lá thay thế.}}',
};

export default prompts;
