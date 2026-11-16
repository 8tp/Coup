import type { NamespaceTranslation } from '../../schema';

/** hi `settings`. */
const settings: NamespaceTranslation<'settings'> = {
  title: 'सेटिंग्स',
  soundEffects: 'साउंड इफ़ेक्ट',
  music: 'म्यूज़िक',
  musicVolume: 'म्यूज़िक की आवाज़',
  musicVolumeBalanced: 'संतुलित',
  musicVolumeDb: '{db} dB',
  haptics: 'वाइब्रेशन',
  reducedMotion: 'कम एनिमेशन',
  textSize: 'टेक्स्ट का साइज़',
  textSizeNormal: 'सामान्य',
  textSizeLarge: 'बड़ा',
  textSizeXl: 'बहुत बड़ा',
  language: 'भाषा',
  languageAuto: 'डिवाइस की भाषा',
  languageInProgress: 'अनुवाद अभी अधूरा है',
  learning: 'सीखें',
  tutorial: 'नए खिलाड़ियों के लिए ट्यूटोरियल',
  coachedBots: 'कोच के साथ · {count, plural, one {# बॉट} other {# बॉट}}',
  help: 'मदद और सुझाव',
  feedbackOpen: 'बग या आइडिया बताएँ',
  githubIssue: 'GitHub पर इशू खोलें',
};

export default settings;
