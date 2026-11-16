import type { NamespaceTranslation } from '../../schema';

/** hi `home`. */
const home: NamespaceTranslation<'home'> = {
  srTitle: 'Coup Online: मुफ़्त मल्टीप्लेयर ब्लफ़िंग कार्ड गेम',
  tagline: 'ब्लफ़ का कार्ड गेम, ऑनलाइन, दोस्तों या बॉट्स के साथ।',
  presenceOnline: '<fig>{count}</fig> ऑनलाइन',
  presenceGames: '{count, plural, one {<fig>#</fig> गेम चल रहा है} other {<fig>#</fig> गेम चल रहे हैं}}',
  myStats: 'मेरे आँकड़े',

  playSection: 'खेलें',
  nameLabel: 'आपका नाम',
  playVsBots: 'बॉट्स से खेलें',
  playVsBotsSub: 'अभी शुरू · {count, plural, one {# विरोधी} other {# विरोधी}}',
  dealing: 'कार्ड बँट रहे हैं…',
  createRoom: 'रूम बनाएँ',
  joinRoom: 'रूम में जुड़ें',
  publicRoom: 'पब्लिक रूम',
  publicRoomOn: 'इसी स्क्रीन पर दिखेगा। कोई भी जुड़ सकता है।',
  publicRoomOff: 'सिर्फ़ कोड वाले लोग जुड़ सकते हैं।',
  creating: 'रूम बन रहा है…',
  createAndInvite: 'बनाएँ और बुलाएँ',
  codePlaceholder: 'कोड',
  roomCode: 'रूम कोड',
  joining: 'रूम खुल रहा है…',
  join: 'जुड़ें',

  learnTitle: 'खेलना सीखें',
  learnSub: 'गाइडेड गेम, ट्यूटोरियल या नियम',

  openTables: 'खुली टेबल',
  watchLive: 'लाइव देखें',
  browseAll: 'सब देखें',
  noPublicTables: 'अभी कोई पब्लिक टेबल नहीं है।',
  roomName: '{host} की टेबल',
  roomPlayers: '<fig>{seats}</fig> खिलाड़ी',
  roomPlayersBetweenGames: '<fig>{seats}</fig> खिलाड़ी · दो गेम के बीच',
  roomPlayersWatching: '<fig>{seats}</fig> खिलाड़ी · {watching} दर्शक',
  roomFull: 'भरा है',
  watch: 'देखें',

  footer: '{min}–{max} खिलाड़ी · मुफ़्त · साइन-अप नहीं',
  source: 'सोर्स',
  sourceLabel: 'GitHub पर सोर्स कोड देखें',

  defaultSpectatorName: 'दर्शक',
  defaultPlayerName: 'खिलाड़ी',

  guidedGame: 'गाइडेड गेम खेलें',
  guidedGameSub: 'आप बनाम 1 आसान बॉट। कोच बताता है कि आगे क्या करना है।',
  tutorial: 'ट्यूटोरियल शुरू करें',
  // {count} is the number of lessons (6 today); wording assumes several lessons.
  tutorialSub: '{count} छोटे पाठ। हर चाल एक छोटी टेबल पर आज़माकर देखें।',
  rules: 'नियम पढ़ें',
  rulesSub: 'किरदार, चालें, चैलेंज और ब्लॉक। रिफ़ॉर्मेशन भी।',
  practiceFoot: 'ज़्यादा बॉट्स, दूसरे नियम या बिना कोच',
  practiceSetup: 'प्रैक्टिस सेट करें',

  installTitle: 'Coup इंस्टॉल करें',
  installBody: 'जल्दी खुलता है, और सेव की हुई गेम फ़ाइलें कमज़ोर Wi-Fi पर भी लोड हो जाती हैं।',
  install: 'इंस्टॉल',
  installDismiss: 'इंस्टॉल का सुझाव बंद करें',
};

export default home;
