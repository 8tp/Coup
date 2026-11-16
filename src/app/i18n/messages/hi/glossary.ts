import type { NamespaceTranslation } from '../../schema';

/**
 * hi `glossary`. The decisions behind every word are in
 * docs/i18n-glossary/hi.md; keep the two in step.
 */
const glossary: NamespaceTranslation<'glossary'> = {
  'character.Duke': 'ड्यूक',
  'character.Assassin': 'क़ातिल',
  'character.Captain': 'कप्तान',
  'character.Ambassador': 'राजदूत',
  'character.Contessa': 'कॉन्टेसा',
  'character.Inquisitor': 'जासूस',

  'action.Income': 'आमदनी',
  'action.ForeignAid': 'विदेशी मदद',
  'action.Coup': 'तख़्तापलट',
  'action.Tax': 'टैक्स',
  'action.Assassinate': 'हत्या',
  'action.Steal': 'चोरी',
  'action.Exchange': 'अदला-बदली',
  'action.Convert': 'दल-बदल',
  'action.Embezzle': 'ग़बन',
  'action.Examine': 'जाँच',

  'mode.Classic': 'क्लासिक',
  'mode.Reformation': 'रिफ़ॉर्मेशन',

  'faction.Loyalist': 'वफ़ादार',
  'faction.Reformist': 'सुधारक',

  'phase.AwaitingAction': 'चाल चुनी जा रही है',
  'phase.AwaitingActionChallenge': 'चैलेंज का मौक़ा',
  'phase.AwaitingBlock': 'ब्लॉक का मौक़ा',
  'phase.AwaitingBlockChallenge': 'ब्लॉक पर चैलेंज का मौक़ा',
  'phase.AwaitingInfluenceLoss': 'कार्ड खोया जा रहा है',
  'phase.AwaitingExchange': 'अदला-बदली जारी',
  'phase.AwaitingExamineSelection': 'दिखाने को कार्ड चुना जा रहा है',
  'phase.AwaitingExamineDecision': 'जाँच जारी',
  'phase.ActionResolved': 'चाल पूरी',
  'phase.GameOver': 'गेम ख़त्म',

  'term.influence': 'प्रभाव',
  'term.card': 'कार्ड',
  'term.claim': 'दावा',
  'term.bluff': 'ब्लफ़',
  'term.challenge': 'चैलेंज',
  'term.block': 'ब्लॉक',
  'term.coin': '{count, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}}',
  'term.reserve': 'रिज़र्व',
  'term.faction': 'गुट',
};

export default glossary;
