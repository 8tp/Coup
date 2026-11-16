import type { NamespaceTranslation } from '../../schema';

/**
 * zh-Hans `rules`. The game is sold in Chinese as 《政变》, which is also the
 * name of the Coup action: the game's name always takes book-title marks,
 * the action never does.
 */
const rules: NamespaceTranslation<'rules'> = {
  title: '玩法说明',

  'tab.overview': '概览',
  'tab.characters': '角色',
  'tab.rules': '行动与规则',

  'overview.whatIsHeading': '游戏简介：Coup《政变》',
  'overview.whatIs': 'Coup《政变》是一款 {minPlayers}–{maxPlayers} 人的诈唬卡牌游戏。每人开局有两张暗牌，称为影响力，另有 {startingCoins, plural, other {# 枚金币}}。最后一个还有暗牌的玩家获胜。',
  'overview.goalHeading': '目标',
  'overview.goal': '让其他人都失去影响力。每失去一点影响力，就把一张牌翻开。两张都翻开，你就出局了。',
  'overview.flowHeading': '基本流程',
  'overview.flow1': '轮到你时，执行一个行动。有些行动需要声称某个角色。',
  'overview.flow2': '其他任何玩家都可以<term>质疑</term>你的声称。如果你在诈唬，你失去一点影响力；如果没有，质疑者失去一点。',
  'overview.flow3': '有些行动可以被<term>阻挡</term>：声称有克制它的角色即可。行动方可以质疑这次阻挡。',
  'overview.flow4': '如果没人质疑或阻挡，行动就生效。',
  'overview.bluffHeading': '诈唬',
  'overview.bluff': '不管手里是什么牌，你都可以声称任何角色。只有被人质疑而你又确实在撒谎时，声称才会让你付出代价。',
  'overview.creditsHeading': '关于原版游戏',
  'overview.credits': 'Coup《政变》是由 <term>{designer}</term> 设计的卡牌游戏，2012 年由 <term>{publisher1}</term> 和 <term>{publisher2}</term> 首次出版。本网站是玩家自制的改编版本。如果你喜欢，请<link>购买实体版游戏</link>支持原作者。',

  'character.Duke': '{tax}：拿 {taxCoins, plural, other {# 枚金币}}。可阻挡{foreignAid}。',
  'character.Assassin': '{assassinate}：支付 {assassinateCost, plural, other {# 枚金币}}，目标失去一张牌。',
  'character.Captain': '{steal}：从目标那里拿 {stealCoins, plural, other {# 枚金币}}。可阻挡{steal}。',
  'character.Ambassador': '{exchange}：抽 {exchangeDraw} 张，放回 {exchangeDraw} 张。可阻挡{steal}。',
  'character.Contessa': '可阻挡暗杀。',
  'character.Inquisitor': '{exchange}：抽 {inquisitorDraw} 张，放回 {inquisitorDraw} 张。{examine}：查看对手的一张牌。可阻挡{steal}。',

  actionsHeading: '行动',
  'table.action': '行动',
  'table.cost': '花费',
  'table.effect': '效果',
  'table.claims': '声称',
  'table.blockedBy': '阻挡者',
  'effect.gain': '+{amount, plural, other {# 枚金币}}',
  'effect.loseInfluence': '目标失去影响力',
  'effect.steal': '从目标那里拿 {stealCoins, plural, other {# 枚金币}}',
  'effect.exchange': '抽 {exchangeDraw} 张，留下想要的',
  'table.pair': '{first}、{second}',
  challengeHeading: '质疑',
  challenge: '任何玩家都可以质疑一次声称，无论它是为了行动还是阻挡。如果声称者真有这张牌，就亮出来，把它洗回牌堆再抽一张新牌，质疑者失去一点影响力。如果没有，声称者失去一点影响力。',
  blockHeading: '阻挡',
  block: '有些行动可以通过声称克制它的角色来阻挡。阻挡也是一种声称，所以可以被质疑，你也可以用它诈唬。',
  forcedHeading: '强制{coup}',
  forced: '如果回合开始时你有 {forcedCoup, plural, other {# 枚或更多金币}}，就必须发动{coup}。',

  'reformation.whatIsHeading': '{reformation}扩展简介',
  'reformation.whatIs': '{reformation}是一个扩展，加入了阵营、三个新行动（{convert}、{embezzle}和{examine}）以及<inq>{inquisitor}</inq>。开局前在房间设置里开启。',
  'reformation.quickStartHeading': '快速上手',
  'reformation.quick1': '选目标前先看阵营标记：<loy>{loyalistMark}</loy> 和 <ref>{reformistMark}</ref>。',
  'reformation.quick2': '用{convert}解除目标限制、救下盟友，或者把金币存进储备金。',
  'reformation.quick3': '只有当储备金值得冒被质疑的风险时，才去{embezzle}。',
  'reformation.quick4': '使用{inquisitor}时，{exchange}只抽 {inquisitorDraw, plural, other {# 张牌}}而不是 {exchangeDraw} 张，{examine}可以让你看一位玩家的一张牌。',
  markLoyalist: '▲ 保',
  markReformist: '◆ 改',
  'reformation.openWalkthrough': '打开分步讲解',
  'reformation.factionsHeading': '阵营',
  'reformation.factions': '每位玩家都属于<loy>▲ {loyalist}</loy>或<ref>◆ {reformist}</ref>。你不能对同阵营的玩家发动{coup}、{assassinate}、{steal}或{examine}。一旦剩下的玩家都在同一阵营，任何人都可以以任何人为目标。只要两个阵营都还在场，就只有另一阵营的玩家能阻挡你的{foreignAid}。',
  'reformation.newActionsHeading': '新行动',
  'reformation.convert': '<name>{convert}：</name>支付 {convertSelfCost, plural, other {# 枚金币}}换自己的阵营，或支付 {convertOtherCost, plural, other {# 枚金币}}换另一位玩家的阵营。金币存入{reserve}。这个行动不能被质疑或阻挡。',
  'reformation.embezzle': '<name>{embezzle}：</name>声称自己没有{duke}，拿走{reserve}里的全部金币。质疑的判定是反过来的：如果你确实有{duke}，质疑者获胜。',
  'reformation.examine': '<inq>{examine}：</inq>声称有{inquisitor}。目标从自己的暗牌中挑一张给你看。然后你把它还回去，或者让对方把它和牌堆里随机一张牌交换。',
  'reformation.inquisitor': '开启后替换{ambassador}。{inquisitor}可以{exchange}（抽 {inquisitorDraw, plural, other {# 张牌}}，而不是 {exchangeDraw} 张），可以{examine}其他玩家的一张牌，也能像{captain}一样阻挡{steal}。',
  'reformation.reserve': '和国库分开存放的一堆金币。{convert}的费用存进来，{embezzle}会把它们全部拿走。',
};

export default rules;
