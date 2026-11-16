import type { NamespaceTranslation } from '../../schema';

/** zh-Hans `home`: the home screen, the Learn sheet and the install prompt. */
const home: NamespaceTranslation<'home'> = {
  srTitle: 'Coup Online：免费的多人诈唬卡牌游戏《政变》',
  tagline: '诈唬卡牌游戏《政变》，和朋友或人机在线玩。',
  presenceOnline: '<fig>{count}</fig> 人在线',
  presenceGames: '{count, plural, other {<fig>#</fig> 局进行中}}',
  myStats: '我的战绩',

  playSection: '开始游戏',
  nameLabel: '你的名字',
  playVsBots: '人机对战',
  playVsBotsSub: '马上开始 · {count, plural, other {# 名对手}}',
  dealing: '发牌中…',
  createRoom: '创建房间',
  joinRoom: '加入房间',
  publicRoom: '公开房间',
  publicRoomOn: '显示在本页列表中，任何人都能加入。',
  publicRoomOff: '只有知道房间码的人才能加入。',
  creating: '创建中…',
  createAndInvite: '创建并邀请',
  codePlaceholder: '房间码',
  roomCode: '房间码',
  joining: '加入中…',
  join: '加入',

  learnTitle: '学习玩法',
  learnSub: '引导对局、教程或规则',

  openTables: '等人的牌桌',
  watchLive: '正在对局',
  browseAll: '查看全部',
  noPublicTables: '现在没有公开牌桌。',
  roomName: '{host} 的牌桌',
  roomPlayers: '<fig>{seats}</fig> 名玩家',
  roomPlayersBetweenGames: '<fig>{seats}</fig> 名玩家 · 局间休息',
  roomPlayersWatching: '<fig>{seats}</fig> 名玩家 · {watching} 人观战',
  roomFull: '已满',
  watch: '观战',

  footer: '{min}–{max} 人 · 免费 · 无需注册',
  source: '源代码',
  sourceLabel: '在 GitHub 上查看源代码',

  defaultSpectatorName: '观众',
  defaultPlayerName: '玩家',

  guidedGame: '来一局引导对局',
  guidedGameSub: '你和 1 个温和的人机对战，教练会提示下一步该做什么。',
  tutorial: '新手教程',
  // {count} is the number of lessons (6 today); wording assumes several lessons.
  tutorialSub: '{count} 节短课，每一步都在小牌桌上亲手试。',
  rules: '查看规则',
  rulesSub: '角色、行动、质疑和阻挡，也包括宗教改革扩展。',
  practiceFoot: '更多人机、其他规则，或者不要教练',
  practiceSetup: '设置练习局',

  installTitle: '安装 Coup',
  installBody: '打开更快，网络差时也能加载已缓存的游戏资源。',
  install: '安装',
  installDismiss: '关闭安装提示',
};

export default home;
