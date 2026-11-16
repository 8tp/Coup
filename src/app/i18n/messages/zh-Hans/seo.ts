import type { NamespaceTranslation } from '../../schema';

/**
 * zh-Hans `seo`: the /zh-hans landing page. Written for how mainland players
 * search (Baidu, WeChat search, Bing CN): the game is known as 《政变》
 * (also sold as 《政变疑云》 and discussed as 政变桌游), and searchers add
 * 在线玩, 网页版, 联机 or 手机版. "Coup" stays in Latin letters in the title
 * and "Coup Online" is the site's name.
 */
const seo: NamespaceTranslation<'seo'> = {
  title: 'Coup Online：《政变》桌游在线玩，免费联机或人机对战',
  description: '免费在线玩诈唬卡牌桌游《政变》（Coup）。打开网页就能和朋友联机或人机对战，2 到 6 人，手机电脑都能玩，无需注册和下载。',
  ogTitle: 'Coup Online《政变》',
  ogImageAlt: 'Coup Online，多人在线诈唬卡牌游戏《政变》',
  manifestDescription: '实时多人《政变》。和朋友或人机互相诈唬、质疑，无需账号。',

  aboutHeading: '关于 Coup Online',
  aboutIntro: 'Coup Online 是诈唬推理卡牌游戏《政变》（Coup，也译作《政变疑云》）的免费网页版，支持 {min, number}–{max, number} 人。每位玩家开局有 2 张背面朝上的角色牌，称为影响力，另有 2 枚金币。不管手里有没有那张牌，你都可以声称自己有任何角色。两张牌都失去就出局，最后一个还有牌的玩家获胜。',
  roundHeading: '一个回合怎么进行',
  roundBody: '轮到你时执行一个行动。收入和外援可以拿金币。角色行动，比如公爵的征税、队长的勒索，就是声称你有那张牌。任何玩家都可以质疑：如果是诈唬，诈唬的人失去一张牌；如果是真的，质疑的人失去一张牌。有些行动可以通过声称对应的角色来阻挡，阻挡同样可以被质疑。攒够 {coupCost, number} 枚金币可以发动政变，让任意一位玩家失去一张牌，且不能被阻挡。有 {forcedCoup, number} 枚金币时必须发动政变。',
  freeHeading: '免费，无需账号',
  freeBody: 'Coup Online 免费玩，不用注册：输入名字就能开始。它在手机、平板和电脑的浏览器里运行，也可以像 App 一样添加到主屏幕。',
  faqHeading: '常见问题',
  faqFriendsQ: '政变桌游能和朋友在线联机玩吗？',
  faqFriendsA: '能。创建一个房间，把 4 个字母的房间码或邀请链接发给朋友。朋友用自己的手机或电脑加入，不需要账号。',
  faqBotsQ: '可以和人机（电脑）玩政变吗？',
  faqBotsA: '可以。点“人机对战”会马上开始一局，对手是 {bots, plural, other {# 个电脑玩家}}。你也可以在和朋友的房间里加入人机，并为每个人机选择打法风格。',
  faqPhoneQ: '手机上能玩吗？',
  faqPhoneA: '能。安卓手机和 iPhone 的浏览器都能直接玩，不用下载。添加到主屏幕后可以像 App 一样打开。',
  faqFreeQ: 'Coup Online 免费吗？',
  faqFreeA: '免费。所有游戏模式都免费，也从不需要账号。',
  faqPlayersQ: '政变桌游几个人玩？',
  faqPlayersA: '{min, number}–{max, number} 人。空位可以用人机补上，所以一个人也能玩。',
  faqReformationQ: '《政变》的宗教改革扩展是什么？',
  faqReformationA: '宗教改革扩展把牌桌分成两个阵营：保皇派和改革派。只要两个阵营都还在场，你就不能对自己阵营的人发动政变、暗杀或勒索。它加入了改宗和贪污两个行动以及储备金，还可以用宗教裁判官替换大使。由房主在房间里开启。',
  credit: 'Coup Online 是玩家自制的非官方改编作品，原作是由 Rikki Tahta 设计、La Mame Games 和 Indie Boards & Cards 出版的卡牌游戏 Coup《政变》。本站与上述各方没有关联，也未获得其认可。',
  languages: '语言',
  suggestion: '查看简体中文版',
  suggestionDismiss: '关闭',
};

export default seo;
