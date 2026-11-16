import type { NamespaceTranslation } from '../../schema';

/**
 * zh-Hans `prompts`. Chinese has one plural category, so a message that says
 * something different for exactly one uses `=1`, not `one`.
 */
const prompts: NamespaceTranslation<'prompts'> = {
  // ── Buttons ──
  challenge: '质疑',
  pass: '放过',
  blockWith: '用{character}阻挡',
  dontBlock: '不阻挡',
  bluffHint: '觉得对方在诈唬就质疑。如果对方没诈唬，你失去一张牌。',

  // ── Challenge window ──
  declaredBlock: '如果{action}继续，<b>{blocker}</b> 会用{character}阻挡。',
  youClaimed: '你声称有<c>{character}</c>来{action}',
  youClaimedOn: '你声称有<c>{character}</c>，对 <b>{target}</b> 发动{action}',
  youClaimedNo: '你声称<c>没有{character}</c>来{action}',
  waitingChallenge: '{count, plural, =0 {等待玩家质疑或放过。} other {等待 {names} 质疑或放过。}}',
  youWillBlock: '如果{action}继续，你会用<c>{character}</c>阻挡。',
  waitingFor: '{count, plural, =0 {等待其他玩家。} other {等待 {names}。}}',
  passedCanBlock: '你放过了质疑，仍然可以阻挡。',
  passedWaiting: '{count, plural, =0 {你放过了。等待其他玩家。} other {你放过了。等待 {names}。}}',
  claim: '{actor} 声称有{character}，要{action}',
  claimOn: '{actor} 声称有{character}，要{action} {target}',
  claimStealFrom: '{actor} 声称有{character}，要{action} {target}',
  claimAtYou: '{actor} 声称有{character}，要{action}你',
  claimStealFromYou: '{actor} 声称有{character}，要{action}你',
  claimNo: '{actor} 声称没有{character}，要{action}',
  embezzleHint: '觉得对方有{character}就质疑。如果对方没有，你失去一张牌。',
  'blockHint.Assassinate': '{count, plural, =1 {用{who}阻挡，否则失去一张牌。没有{who}也可以声称有。} other {用{who}阻挡，否则失去一张牌。没有这些牌也可以声称其中任意一个。}}',
  'blockHint.Steal': '{count, plural, =1 {用{who}阻挡，保住你的金币。没有{who}也可以声称有。} other {用{who}阻挡，保住你的金币。没有这些牌也可以声称其中任意一个。}}',
  'blockHint.other': '{count, plural, =1 {用{who}阻挡来拦下它。没有{who}也可以声称有。} other {用{who}阻挡来拦下它。没有这些牌也可以声称其中任意一个。}}',

  // ── Block window ──
  yourActionUnless: '除非 <b>{target}</b> 阻挡，否则你的{action}会生效。',
  yourActionUnlessAnyone: '除非有人阻挡，否则你的{action}会生效。',
  usesOn: '<b>{actor}</b> 对 <b>{target}</b> 发动{action}。',
  waitingTarget: '等待 <b>{target}</b> 阻挡或放行。',
  sameFactionForeignAid: '你不能阻挡 <b>{actor}</b> 的{action}。你们同一阵营，而两个阵营都还在场。',
  blockPassed: '你放过了。',
  blockPassedWaiting: '你放过了。等待 {names}。',
  assassinating: '{actor} 要暗杀你',
  assassinatingHint: '用{character}阻挡，否则失去一张牌。没有{character}也可以声称有。',
  stealing: '{actor} 要勒索你 {count, plural, other {# 枚金币}}',
  stealingHint: '用{blockers}阻挡，保住你的 {count, plural, other {# 枚金币}}。没有这些牌也可以声称其中任意一个。',
  foreignAid: '{actor} 要拿{action}（+{count, plural, other {# 枚金币}}）',
  foreignAidHint: '声称有{character}，阻止对方拿 {count, plural, other {# 枚金币}}。没有{character}也可以声称有。',
  uses: '{actor} 发动{action}',
  canBlock: '你可以阻挡。',

  // ── Block challenge window ──
  youClaimedBlock: '你声称有<c>{character}</c>来阻挡。',
  acceptedWaiting: '{count, plural, =0 {你接受了阻挡。等待其他玩家。} other {你接受了阻挡。等待 {names}。}}',
  blockClaim: '{blocker} 声称有<c>{character}</c>，阻挡{action}',
  blockClaimPlain: '{blocker} 声称有<c>{character}</c>来阻挡',

  // ── Losing a card ──
  'loss.coup': '你遭到了政变',
  'loss.assassination': '你被暗杀了',
  'loss.challenge_lost': '你输掉了质疑',
  'loss.challenge_failed_defense': '你的诈唬被识破了',
  'loss.embezzle_failed': '你被查出有{character}',
  'loss.default': '选择一张牌失去',
  tapToLose: '点一张牌来失去它，这张牌会翻开。',
  mustChoose: '<b>{name}</b> 必须选择失去一张牌。',
  'lossWatch.coup': '政变',
  'lossWatch.assassination': '暗杀',
  'lossWatch.challenge_lost': '质疑失败',
  'lossWatch.challenge_failed_defense': '诈唬被识破',
  'lossWatch.embezzle_failed': '贪污失败',
  'lossWatch.default': '必须失去一张牌',

  // ── Exchange ──
  exchangeInProgress: '正在交换',
  exchangeTitle: '{character}{action}',
  exchangeHint: '点选 {count, plural, other {# 张牌}}留下，其余的放回牌堆。',
  keepSelected: '留下所选（{selected}/{total}）',

  // ── Examine ──
  examinedCard: '{name} 的牌',
  forceSwapHint: '强制换牌会把这张牌放回牌堆，对方再抽一张新牌。',
  examineReturn: '归还',
  forceSwap: '强制换牌',
  showTo: '选择一张牌给 {name} 看',
  showToInquisitor: '选择一张牌给{character}看',
  showHint: '只有审查者能看到。对方可以归还，或者强制你换一张新牌。',

  // ── Challenge reveal ──
  'reveal.skip': '跳过揭晓',
  'reveal.newCard': '新的暗牌',
  'reveal.showsAllNo': '{name} 亮出所有牌，<c>没有{character}</c>',
  'reveal.reveals': '{name} 亮出了<c>{character}</c>',
  'reveal.doesNotHave': '{name} 没有<c>{character}</c>',
  'reveal.challengeFails': '质疑失败',
  'reveal.caught': '诈唬被识破',
  'reveal.mustLose': '{name} 必须失去一张牌',
  'reveal.swap': '{count, plural, =1 {这张牌洗回牌堆，补抽一张新牌。} other {亮出的牌洗回牌堆，补抽新牌。}}',
};

export default prompts;
