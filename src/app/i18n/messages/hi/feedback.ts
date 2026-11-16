import type { NamespaceTranslation } from '../../schema';

/** hi `feedback`. */
const feedback: NamespaceTranslation<'feedback'> = {
  title: 'फ़ीडबैक भेजें',
  kindLabel: 'किस बारे में',
  'kind.bug': 'बग',
  'kind.idea': 'आइडिया',
  'kind.other': 'कुछ और',
  'placeholder.bug': 'बताएँ कि क्या हुआ और क्या होना चाहिए था।',
  'placeholder.idea': 'बताएँ कि क्या बदलें या क्या जोड़ें।',
  'placeholder.other': 'कुछ भी बताएँ।',
  noteLabel: 'आपकी बात',
  privacy: 'आपके नाम या रूम कोड के बिना भेजा जाता है।',
  send: 'भेजें',
  sending: 'भेजा जा रहा है',
  retry: 'फिर से कोशिश करें',
  sent: 'भेज दिया। शुक्रिया।',
  sentDetail: 'यह सीधे डेवलपर तक पहुँचता है।',
  writeAnother: 'एक और लिखें',
  githubInstead: 'इसके बजाय GitHub पर इशू खोलें',
  'error.invalid': 'यह नोट भेजा नहीं जा सका। फिर से कोशिश करें।',
  'error.empty': 'पहले कुछ शब्द लिखें।',
  'error.too_long': '{max} अक्षरों से कम रखें।',
  'error.rate_limited': 'कुछ नोट पहले ही जा चुके हैं। कुछ मिनट बाद फिर कोशिश करें।',
  'error.busy': 'अभी बहुत सारे नोट आ रहे हैं। कुछ मिनट बाद फिर कोशिश करें।',
  'error.server_error': 'भेजा नहीं जा सका। कनेक्शन देखकर फिर कोशिश करें।',
};

export default feedback;
