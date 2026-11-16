import type { NamespaceTranslation } from '../../schema';

/**
 * zh-Hans `tutorial`: both walkthroughs, the practice setup sheet and the
 * practice coach. "影响力" is introduced once (chapter 1); after that the
 * text says "失去一张牌". Messages that say something different for exactly
 * one use `=1`, since Chinese has a single plural category.
 */
const tutorial: NamespaceTranslation<'tutorial'> = {
  // ═══ The stage ═══
  'shell.chapters': '章节',
  'shell.chapterLabel': '第 {index} 章：{label}',
  'shell.chapterStatus': '第 {index} 章，共 {total} 章：{label}',
  'shell.finished': '{title}：已完成',
  'shell.close': '关闭“{title}”',
  'shell.skip': '跳过',
  'shell.next': '下一步',
  'shell.finish': '完成',
  'shell.keys': '← → 切换 · Esc 关闭',

  you: '你',
  youLoyalist: '你 · ▲ {loyalist}',
  youReformist: '你 · ◆ {reformist}',
  coins: '{count, plural, other {# 枚金币}}',
  outStamp: '出局',
  tableGhost: '牌桌',
  'plaque.as': '自称{character}',
  'plaque.asOnYou': '自称{character} · 对你',
  'plaque.blocks': '阻挡',
  'plaque.noDuke': '自称没有{duke}',
  tryAgain: '再试一次',
  startOver: '从头开始',

  // ═══ How Coup works ═══
  'basics.title': 'Coup《政变》怎么玩',
  'chapter.goal': '目标',
  'chapter.turn': '回合',
  'chapter.claims': '声称',
  'chapter.challenge': '质疑',
  'chapter.blocks': '阻挡',
  'chapter.coins': '金币',
  'chapter.finish': '准备好了',

  // ── 1. The goal ──
  'goal.title': '两张牌都失去，你就出局',
  'goal.lede': '你开局有两张暗牌和 {startingCoins, plural, other {# 枚金币}}。这两张牌就是你的影响力。最后一个还有暗牌的玩家获胜。',
  'goal.dealt.note': '只有你能看自己的牌。',
  'goal.dealt.cta': '看看你的牌',
  'goal.peeked.note': '其他人只看到两张牌背。',
  'goal.peeked.cta': '失去一张牌',
  'goal.lostOne.note': '失去的牌会翻开给全桌看。你还剩一张，所以还在局中。',
  'goal.lostOne.cta': '再失去一张',
  'goal.out.note': '两张牌都翻开了，你出局了。',
  'goal.out.cta': '重新发牌',

  // ── 2. Your turn ──
  'turn.title': '每回合执行一个行动',
  'turn.lede': '{income}、{foreignAid}和{coup}谁都能用。另外四个各属于一个角色，想用就要声称有那个角色。',
  'turn.prompt': '点一个行动。',
  'turn.anyone': '谁都能用',
  'turn.claimGroup': '声称角色',
  'turn.gain': '+{amount, plural, other {# 枚金币}}',
  'turn.pay': '付 {amount}',
  'turn.refused': '{action}要花 {cost} 枚金币，你只有 {coins, plural, other {# 枚}}。',
  'turn.result.income': '{income}：+{incomeCoins, plural, other {# 枚金币}}。谁也拦不住。',
  'turn.result.foreign-aid': '{foreignAid}：+{foreignAidCoins, plural, other {# 枚金币}}，除非有人用{duke}阻挡。',
  'turn.result.coup': '{coup}：支付 {coupCost} 枚金币，选一位玩家失去一张牌。',
  'turn.result.tax': '{tax}：你声称有{duke}，拿 {taxCoins, plural, other {# 枚金币}}。',
  'turn.result.steal': '{steal}：你声称有{captain}，从另一位玩家那里拿 {stealCoins, plural, other {# 枚金币}}。',
  'turn.result.assassinate': '{assassinate}：你声称有{assassin}，支付 {assassinateCost} 枚金币，选一位玩家失去一张牌。',
  'turn.result.exchange': '{exchange}：你声称有{ambassador}，抽 {exchangeDraw, plural, other {# 张牌}}，再任选 {exchangeDraw} 张放回。',

  // ── 3. Claims ──
  'claims.title': '没有的角色也可以声称',
  'claims.lede': '没人能看到你的牌，所以声称只是你的一句话。你手里是{captain}和{contessa}。声称有{duke}来{tax}。',
  'claims.prompt': '你手里没有{duke}。照样声称。',
  'claims.done': '没人质疑，诈唬成功，{taxCoins, plural, other {# 枚金币}}归你了。',
  'claims.button': '声称{duke} · {tax} +{taxCoins}',

  // ── 4. Challenge ──
  'challenge.title': '不信就质疑',
  'challenge.lede': '任何人都可以质疑一次声称。如果声称者真有这张牌，质疑者失去一张牌；如果没有，声称者失去一张牌。',
  'challenge.bluffPrompt': '{player} 声称有{duke}来{tax}。质疑，或者放过。',
  'challenge.truthPrompt': '{player} 又声称有{duke}。这次也质疑。',
  'challenge.passed': '{player} 拿走了 {taxCoins, plural, other {# 枚金币}}。你永远不会知道那是不是诈唬。',
  'challenge.flipping': '{player} 翻开一张牌…',
  'challenge.caughtBluff': '没有{duke}。{player} 在诈唬，失去一张牌。',
  'challenge.wasTrue': '{player} 真有{duke}，所以你失去一张牌。{player} 把{duke}洗回牌堆，再抽一张新牌。',
  'challenge.challenge': '质疑',
  'challenge.letGo': '放过',
  'challenge.nextRound': '这次是真的',

  // ── 5. Blocks ──
  'blocks.title': '阻挡能拦下行动',
  'blocks.lede': '质疑是说对方的声称是假的。阻挡则是直接拦下行动：你声称有克制它的角色。',
  'blocks.count': '威胁 <fig>{index}</fig>/<fig>{total}</fig>',
  'blocks.ask.ForeignAid': '{player} 拿{foreignAid}。点能阻挡它的角色。',
  'blocks.ask.Steal': '{player} 勒索你 {stealCoins, plural, other {# 枚金币}}。点一个能阻挡它的角色。',
  'blocks.ask.Assassinate': '{player} 要暗杀你。点能阻挡它的角色。',
  'blocks.result.ForeignAid': '挡下了。任何玩家都可以声称有{duke}来阻止{foreignAid}。',
  'blocks.result.Steal': '挡下了。{captain}和{ambassador}都能阻止{steal}。',
  'blocks.result.Assassinate': '挡下了。只有{contessa}能阻止暗杀。阻挡也是声称，所以 {player} 可以质疑。',
  'blocks.miss': '{character}不能阻挡{action}。换一个试试。',
  'blocks.choices': '阻挡角色',
  'blocks.next': '下一个威胁',

  // ── 6. Coins ──
  'coins.title': '{coup}要花 {coupCost} 枚金币。有 {forcedCoup} 枚时必须{coup}。',
  'coins.lede': '{coup}不能被阻挡或质疑，目标一定会失去一张牌。如果回合开始时你有 {forcedCoup, plural, other {# 枚或更多金币}}，{coup}就是你唯一能做的行动。',
  'coins.collect': '你有 {coins, plural, other {# 枚金币}}。攒到 {coupCost} 枚，然后{coup}。',
  'coins.ready': '你现在可以{coup}了。继续攒，看看到 {forcedCoup} 枚会怎样。',
  'coins.forced': '{coins, plural, other {# 枚金币}}。{coup}是你唯一的选择。',
  'coins.couped': '{coup}。{player} 失去一张牌。',
  'coins.refusal.must-coup': '有 {forcedCoup} 枚金币时必须{coup}。',
  'coins.refusal.short': '{coup}要花 {coupCost} 枚。你还差 {short, plural, other {# 枚金币}}。',
  'coins.meter': '{coins, plural, other {# 枚金币}}，共 {forcedCoup} 枚',
  'coins.markCoup': '{coupCost} · {coup}',
  'coins.markMust': '{forcedCoup} · 必须',
  'coins.income': '{income} +{incomeCoins}',
  'coins.tax': '{tax} +{taxCoins}',
  'coins.purse': '你：{coins, plural, other {<fig>#</fig> 枚金币}}',

  // ── Finish ──
  'finish.title': '角色一览',
  'finish.lede': '任何时候你都可以声称其中任何一个。只有被人质疑时，你手里的真牌才重要。',
  'finish.list': '六个角色',
  'ref.Duke.does': '{tax}：拿 {taxCoins, plural, other {# 枚金币}}',
  'ref.Duke.blocks': '阻挡{foreignAid}',
  'ref.Assassin.does': '{assassinate}：付 {assassinateCost} 枚，一位玩家失去一张牌',
  'ref.Assassin.blocks': '不能阻挡任何行动',
  'ref.Captain.does': '{steal}：拿 {stealCoins, plural, other {# 枚金币}}',
  'ref.Captain.blocks': '阻挡{steal}',
  'ref.Ambassador.does': '{exchange}：抽 {exchangeDraw} 张，放回 {exchangeDraw} 张',
  'ref.Ambassador.blocks': '阻挡{steal}',
  'ref.Contessa.does': '没有专属行动',
  'ref.Contessa.blocks': '阻挡暗杀',
  'ref.Inquisitor.does': '{exchange}或{examine}',
  'ref.Inquisitor.blocks': '阻挡{steal}',
  'finish.general': '谁都可以用{income}（+{incomeCoins}）、{foreignAid}（+{foreignAidCoins}）或{coup}（{coupCost, plural, other {# 枚金币}}）。',
  'finish.playGuided': '来一局引导对局',

  // ═══ The Reformation walkthrough ═══
  'reform.title': '{reformation}分步讲解',
  'reform.chapter.factions': '阵营',

  'reform.factions.title': '只能以另一阵营为目标',
  'reform.factions.lede': '每个人要么是{loyalist} ▲，要么是{reformist} ◆。{coup}、{assassinate}、{steal}和{examine}只能以另一阵营为目标。一旦剩下的玩家都在同一阵营，任何人都可以以任何人为目标。',
  'reform.factions.prompt': '你是{loyalist} ▲。点一位你可以作为目标的玩家。',
  'reform.factions.right': '{player} 是{reformist}，可以作为你的目标。',
  'reform.factions.wrong': '{player} 和你一样是{loyalist}，所以你不能以 {player} 为目标。',
  'reform.factions.sameFaction': '同阵营',

  'reform.convert.title': '{convert}可以换阵营',
  'reform.convert.lede': '支付 {convertSelfCost, plural, other {# 枚金币}}换自己的阵营，或支付 {convertOtherCost} 枚换另一位玩家的阵营。这个行动不能被质疑或阻挡。金币存入储备金。',
  'reform.convert.prompt': '只剩两位玩家：你是{loyalist}，{player} 是{reformist}。',
  'reform.convert.done': '你现在是{reformist}了。所有人都在同一阵营，任何人都可以以任何人为目标。',
  'reform.convert.button': '给自己{convert} · {convertSelfCost, plural, other {# 枚金币}}',

  'reform.embezzle.title': '{embezzle}拿走全部储备金',
  'reform.embezzle.lede': '{embezzle}时，你要声称自己没有{duke}。质疑的判定是反过来的：只有你确实有{duke}，质疑者才赢。',
  'reform.embezzle.prompt': '你手里是{captain}和{inquisitor}，没有{duke}。',
  'reform.embezzle.done': '{player} 质疑了，而你确实没有{duke}，所以 {player} 失去一张牌。你换两张新牌，并拿走 {coins, plural, other {# 枚金币}}。',
  'reform.embezzle.button': '{embezzle} {coins, plural, other {# 枚金币}}',
  'reform.reserve': '储备金',
  'reform.reserveLabel': '{reserve}：{coins, plural, other {# 枚金币}}',

  'reform.examine.title': '{examine}能看一张牌',
  'reform.examine.lede': '{examine}要声称有{inquisitor}。目标从自己的牌里挑一张给你看。然后你把它还回去，或者让对方把它和牌堆里的一张牌交换。',
  'reform.examine.prompt': '你有{inquisitor}。{examine} {player}。',
  'reform.examine.shown': '{player} 给你看了一张{duke}。归还，或者强制换牌。',
  'reform.examine.returned': '{player} 留着{duke}，而只有你知道。',
  'reform.examine.swapped': '{duke}进了牌堆，{player} 抽了一张新牌。对方失去了{duke}，但你也不知道对方现在有什么了。',
  'reform.examine.button': '{examine} {player}',
  'reform.examine.return': '归还',
  'reform.examine.swap': '强制换牌',

  'reform.recap.title': '{reformation}改变了什么',
  'reform.recap.lede': '声称、质疑和阻挡与基础版相同。',
  'reform.recap.factions': '只能以另一阵营为目标，直到剩下的人都在同一阵营。',
  'reform.recap.convert': '支付 {convertSelfCost} 枚换自己的阵营，或支付 {convertOtherCost} 枚换别人的阵营。金币存入储备金。',
  'reform.recap.embezzle': '声称自己没有{duke}，拿走全部储备金。',
  'reform.recap.examine': '看一位玩家的一张牌，然后归还或强制换牌。',
  'reform.recap.practice': '想边玩边看提示，就在主菜单打开“练习”，选择{reformation}。',

  // ═══ Practice vs Bots ═══
  'setup.title': '人机练习',
  'setup.lede': '和人机打一局私人对局，教练会提示关键之处。',
  'setup.close': '关闭练习设置',
  'setup.opponents': '对手',
  'setup.style': '人机风格',
  'setup.style.gentle': '温和',
  'setup.style.sharp': '精明',
  'setup.style.ruthless': '无情',
  'setup.blurb.gentle': '很少诈唬，很少质疑。适合第一局。',
  'setup.blurb.sharp': '会记牌，对不上的声称就质疑。',
  'setup.blurb.ruthless': '有利可图就诈唬，专盯领先者。',
  'setup.rules': '规则',
  'setup.hint.classic': '基础版。新手从这里开始。',
  'setup.hint.reformation': '阵营、{convert}、{embezzle}和{inquisitor}。',
  'setup.hint.reformationSolo': '至少要有 {count} 名对手，阵营才有意义。',
  'setup.coach': '教练提示',
  'setup.coachOn': '提示框会指出下一步该做什么',
  'setup.coachOff': '不显示提示',
  'setup.start': '开始练习',
  'setup.starting': '发牌中…',
  'setup.summary': '{style, select, gentle {{count, plural, other {# 名温和对手}}} sharp {{count, plural, other {# 名精明对手}}} ruthless {{count, plural, other {# 名无情对手}}} other {{count, plural, other {# 名对手}}}} · {mode}',

  // ═══ The practice coach ═══
  'coach.region': '练习教练',
  'coach.tag': '教练',
  'coach.gotIt': '知道了',
  'coach.hide': '隐藏提示',
  'coach.rules': '查看规则',
  'coach.someone': '人机',
  'coach.blockerFallback': '所示角色',

  'coach.coins': '{count, plural, other {# 枚金币}}',

  'coach.chooseInfluence.label': '失去一张牌',
  'coach.chooseInfluence.title': '放弃你最用不上的那张牌',
  'coach.chooseInfluence.body': '这张牌会翻开给所有人看。留下能支撑你接下来声称和阻挡的那张。',

  'coach.exchange.title': '留下你声称过的角色',
  'coach.exchange.body': '手里有这些牌，再次声称就安全了。如果还没声称过什么，就留用途最多的牌。其余的放回牌堆。',

  'coach.examineSelection.label': '被审查',
  'coach.examineSelection.title': '给对方看哪张牌由你决定',
  'coach.examineSelection.body': '出示一张被换掉你也最不心疼的牌。只有审查者会知道它是什么。',

  'coach.examineDecision.title': '你看到了对方的一张牌',
  'coach.examineDecision.body': '还回去，你就知道对方手里有什么。强制换牌，这张牌会进牌堆，但你也就摸不清对方的手牌了。',

  'coach.firstTargeted.label': '你是目标',
  'coach.firstTargeted.title': '{actor} 以你为目标',
  'coach.firstTargeted.Steal': '{action}会拿走你 {stealCoins, plural, other {# 枚金币}}。{claimed, select, no {不信对方的声称就质疑。} other {不信对方有{character}就质疑。}}{blockable, select, no {} other {或者现在用{blockers}阻挡。}}',
  'coach.firstTargeted.Assassinate': '{action}会让你失去一张牌。{claimed, select, no {不信对方的声称就质疑。} other {不信对方有{character}就质疑。}}{blockable, select, no {} other {或者现在用{blockers}阻挡。}}',
  'coach.firstTargeted.Examine': '{action}能让对方看你的一张牌。{claimed, select, no {不信对方的声称就质疑。} other {不信对方有{character}就质疑。}}{blockable, select, no {} other {或者现在用{blockers}阻挡。}}',
  'coach.firstTargeted.other': '{action}冲着你来了。{claimed, select, no {不信对方的声称就质疑。} other {不信对方有{character}就质疑。}}{blockable, select, no {} other {或者现在用{blockers}阻挡。}}',

  'coach.blockOrChallenge.label': '要阻挡吗',
  'coach.blockOrChallenge.title': '你可以阻挡这次{action}',
  'coach.blockOrChallenge.body': '声称有{blockers}就能拦下它，没有这张牌也行。{claimed, select, no {也可以质疑对方的声称。} other {也可以质疑对方的{character}。}}质疑失败要失去一张牌。',

  'coach.challengeClaim.label': '要质疑吗',
  'coach.challengeClaim.title': '{claimed, select, no {{actor} 声称有某个角色} other {{actor} 声称有{character}}}',
  'coach.challengeClaim.body': '{claimed, select, no {觉得对方没有那张牌就质疑。} other {觉得对方没有{character}就质疑。}}如果对方有，你失去一张牌，所以放过往往更稳妥。',
  'coach.challengeEmbezzle.title': '{actor} 声称自己没有{duke}',
  'coach.challengeEmbezzle.body': '只有觉得对方有{duke}时才质疑。如果对方没有，你失去一张牌。',

  'coach.challengeBlock.label': '被阻挡',
  'coach.challengeBlock.title': '阻挡也是一种声称',
  'coach.challengeBlock.body': '{blocker} 声称有{character}来阻挡。只有你愿意赌上一张牌认定它是假的，才去质疑。',

  'coach.firstBlock.label': '你的第一次阻挡',
  'coach.firstBlock.title': '你可以阻挡这次{action}',
  'coach.firstBlock.body': '声称有{blockers}就能拦下它，即使你没有这张牌。对方可以质疑你的阻挡，诈唬被识破要失去一张牌。',
  'coach.makeBlock.label': '要阻挡吗',
  'coach.makeBlock.title': '你可以阻挡{action}',
  'coach.makeBlock.body': '阻挡就是声称有{blockers}。可以诈唬，但对方可以质疑。',

  'coach.mustCoup.title': '有 {forcedCoup} 枚金币时必须{coup}',
  'coach.mustCoup.body': '{coup}是你唯一的选择。挑最让你担心的对手。这个行动不能被阻挡或质疑。',

  'coach.coupReady.title': '你可以{coup}了',
  'coach.coupReady.body': '支付 {coupCost} 枚，任选一位对手失去一张牌。这个行动不能被阻挡或质疑。你也可以继续攒，但到 {forcedCoup} 枚就必须发动了。',

  'coach.freeForAll.label': '同一阵营',
  'coach.freeForAll.title': '只剩一个阵营，谁都能当目标',
  'coach.freeForAll.body': '{coup}、{assassinate}、{steal}和{examine}可以以任何人为目标，直到有人{convert}让牌桌再次分裂。',

  'coach.factions.label': '阵营',
  'coach.factions.title': '以另一阵营为目标',
  'coach.factions.body': '你的阵营限制了你能对谁{coup}、{assassinate}、{steal}或{examine}。质疑不受阵营限制。只要两个阵营都还在场，就只有另一阵营的玩家能阻挡你的{foreignAid}。',

  'coach.embezzle.label': '储备金 {count} 枚',
  'coach.embezzle.title': '{embezzle}拿走储备金',
  'coach.embezzle.holdsDuke': '{embezzle}要声称你没有{duke}，可你手里有。被质疑时，你暗藏的{duke}会让质疑成功。只有储备金值一张牌时才这样诈唬。',
  'coach.embezzle.noDuke': '{embezzle}要声称你没有{duke}。你确实没有，所以谁质疑谁就失去一张牌。',

  'coach.convert.title': '{convert}可以换阵营',
  'coach.convert.body': '支付 {convertSelfCost, plural, other {# 枚金币}}换自己的阵营，或支付 {convertOtherCost} 枚换另一位玩家的阵营。这个行动不能被质疑或阻挡，金币存入储备金，留给{embezzle}。',

  'coach.yourMove.label': '轮到你',
  'coach.opening.title': '拿{income}，或者声称一个角色',
  'coach.opening.body': '{income}稳拿。角色行动收益更高，你可以声称任何角色，但任何声称都可能被质疑。',
  'coach.repeat.title': '继续声称你用过的角色',
  'coach.repeat.body': '再次声称同一个角色更可信。换成新角色容易招来质疑。',
};

export default tutorial;
