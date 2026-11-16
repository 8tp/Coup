import type { NamespaceTranslation } from '../../schema';

/** hi `stats`. */
const stats: NamespaceTranslation<'stats'> = {
  title: 'मेरे आँकड़े',
  tabOverview: 'झलक',
  tabAwards: 'अवॉर्ड',
  tabHistory: 'पिछले गेम',

  empty: 'अभी तक कोई गेम नहीं खेला गया।',
  emptyHint: 'आँकड़े गिनने के लिए एक गेम पूरा करें। प्रैक्टिस गेम नहीं गिने जाते।',

  reset: 'आँकड़े रीसेट करें',
  resetWarning: 'इससे आपके सारे आँकड़े मिट जाएँगे। यह वापस नहीं होगा।',
  resetConfirm: 'मिटाएँ',

  gamesPlayed: 'खेले गए गेम',
  gamesWon: 'जीते गए गेम',
  winRate: 'जीत दर',
  winStreak: 'लगातार जीत',
  winStreakValue: '{current} (रिकॉर्ड {best})',
  challengesMade: 'किए गए चैलेंज',
  challengesWon: 'जीते गए चैलेंज',
  challengesWonValue: '{won} ({accuracy})',
  blocksMade: 'किए गए ब्लॉक',
  successfulBluffs: 'कामयाब ब्लफ़',
  timesCaught: 'पकड़े गए ब्लफ़',
  coups: 'तख़्तापलट',
  assassinations: 'हत्याएँ',
  firstEliminated: 'सबसे पहले बाहर',
  totalTurns: 'कुल बारियाँ',
  favoriteAction: 'पसंदीदा चाल',
  noValue: '-',

  awardsEmpty: 'अवॉर्ड पाने के लिए गेम पूरे करें।',
  awardCount: '×{count}',
  'awardCriterion.pantsOnFire': 'सबसे ज़्यादा बार ब्लफ़ पकड़ा गया',
  'awardCriterion.honestAbe': 'सबसे ज़्यादा बार सच साबित, ब्लफ़ कभी नहीं पकड़ा गया',
  'awardCriterion.inquisitor': 'सबसे ज़्यादा चैलेंज किए',
  'awardCriterion.eagleEye': 'सबसे सटीक चैलेंज',
  'awardCriterion.wall': 'सबसे ज़्यादा ब्लॉक',
  'awardCriterion.smoothOperator': 'ढेरों दावे, एक भी नहीं पकड़ा गया',
  'awardCriterion.coupMachine': 'सबसे ज़्यादा तख़्तापलट',
  'awardCriterion.silentAssassin': 'सबसे ज़्यादा हत्याएँ',
  'awardCriterion.boldStrategy': 'सबसे ज़्यादा चैलेंज उल्टे पड़े',
  'awardCriterion.quickExit': 'सबसे पहले बाहर',

  historyWonShort: 'जीत',
  historyLostShort: 'हार',
  historyWon: 'जीत',
  historyLost: 'हार',
  historyPlayers: '{count, plural, one {# खिलाड़ी} other {# खिलाड़ी}}',
  historyTurns: '{count, plural, one {# बारी} other {# बारियाँ}}',
  historyChallenges: 'चैलेंज: {made} ({won, plural, one {# जीता} other {# जीते}})',
  historyBlocks: 'ब्लॉक: {count}',
  historyCoups: 'तख़्तापलट: {count}',
  historyAssassinations: 'हत्याएँ: {count}',
  historyAwards: 'अवॉर्ड: {awards}',
  listSeparator: ', ',
};

export default stats;
