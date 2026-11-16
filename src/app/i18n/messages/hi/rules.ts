import type { NamespaceTranslation } from '../../schema';

/**
 * hi `rules`. "face-down" is छिपा, "face-up" is खुला. A character "counters"
 * an action: काटता है, the card-table verb.
 */
const rules: NamespaceTranslation<'rules'> = {
  title: 'कैसे खेलें',

  'tab.overview': 'झलक',
  'tab.characters': 'किरदार',
  'tab.rules': 'चालें और नियम',

  'overview.whatIsHeading': 'Coup क्या है?',
  'overview.whatIs': 'Coup, {minPlayers} से {maxPlayers} खिलाड़ियों का ब्लफ़ वाला गेम है। हर खिलाड़ी को शुरू में दो छिपे कार्ड मिलते हैं, जिन्हें प्रभाव कहते हैं, और {startingCoins, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}}। आख़िर तक जिसके पास छिपा कार्ड बचे, वही जीतता है।',
  'overview.goalHeading': 'लक्ष्य',
  'overview.goal': 'बाक़ी सबका प्रभाव ख़त्म करें। प्रभाव खोने पर अपना एक कार्ड खोलना पड़ता है। दोनों गए, तो आप बाहर।',
  'overview.flowHeading': 'खेल कैसे चलता है',
  'overview.flow1': 'अपनी बारी पर एक चाल चलें। कुछ चालों में किसी किरदार का दावा होता है।',
  'overview.flow2': 'कोई भी दूसरा खिलाड़ी दावे को <term>चैलेंज</term> कर सकता है। दावा ब्लफ़ निकला तो आपका एक प्रभाव जाएगा। सच निकला तो चैलेंज करने वाले का।',
  'overview.flow3': 'कुछ चालें उस किरदार का दावा करके <term>ब्लॉक</term> की जा सकती हैं जो उन्हें काटता है। चाल चलने वाला ब्लॉक को चैलेंज कर सकता है।',
  'overview.flow4': 'अगर कोई चैलेंज या ब्लॉक न करे, तो चाल पूरी होती है।',
  'overview.bluffHeading': 'ब्लफ़',
  'overview.bluff': 'आपके पास कुछ भी हो, किसी भी किरदार का दावा किया जा सकता है। दावा तभी महँगा पड़ता है जब कोई चैलेंज करे और वह झूठा निकले।',
  'overview.creditsHeading': 'असली गेम के बारे में',
  'overview.credits': 'Coup एक कार्ड गेम है जिसे <term>{designer}</term> ने डिज़ाइन किया और 2012 में <term>{publisher1}</term> और <term>{publisher2}</term> ने पहली बार प्रकाशित किया। यह फ़ैन्स का बनाया रूपांतरण है। पसंद आए तो <link>असली गेम ख़रीदकर</link> इसके रचनाकारों का साथ दें।',

  'character.Duke': '{tax}: {taxCoins, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}} लें। {foreignAid} ब्लॉक करता है।',
  'character.Assassin': '{assassinate}: {assassinateCost, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}} दें। निशाने का एक कार्ड जाता है।',
  'character.Captain': '{steal}: निशाने से {stealCoins, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}} लें। {steal} ब्लॉक करता है।',
  'character.Ambassador': '{exchange}: {exchangeDraw} उठाएँ, {exchangeDraw} लौटाएँ। {steal} ब्लॉक करता है।',
  'character.Contessa': 'हत्या ब्लॉक करती है।',
  'character.Inquisitor': '{exchange}: {inquisitorDraw} उठाएँ, {inquisitorDraw} लौटाएँ। {examine}: किसी विरोधी का एक कार्ड देखें। {steal} ब्लॉक करता है।',

  'actionsHeading': 'चालें',
  'table.action': 'चाल',
  'table.cost': 'क़ीमत',
  'table.effect': 'असर',
  'table.claims': 'दावा',
  'table.blockedBy': 'कौन ब्लॉक करे',
  'effect.gain': '+{amount, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}}',
  'effect.loseInfluence': 'निशाने का प्रभाव जाता है',
  'effect.steal': 'निशाने से {stealCoins, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}} लें',
  'effect.exchange': '{exchangeDraw} उठाएँ, जो चाहें रखें',
  'table.pair': '{first}, {second}',
  'challengeHeading': 'चैलेंज',
  'challenge': 'कोई भी खिलाड़ी किसी भी दावे को चैलेंज कर सकता है, चाहे वह चाल के लिए हो या ब्लॉक के लिए। अगर दावा करने वाले के पास कार्ड है, तो वह उसे दिखाकर डेक में फेंटता है और नया कार्ड उठाता है, और चैलेंज करने वाले का एक प्रभाव जाता है। अगर नहीं है, तो दावा करने वाले का एक प्रभाव जाता है।',
  'blockHeading': 'ब्लॉक',
  'block': 'कुछ चालें उन्हें काटने वाले किरदार का दावा करके ब्लॉक की जा सकती हैं। ब्लॉक भी एक दावा है, इसलिए उस पर चैलेंज हो सकता है, और ब्लॉक में ब्लफ़ भी चल सकता है।',
  'forcedHeading': 'ज़रूरी {coup}',
  'forced': 'अगर बारी की शुरुआत में आपके पास {forcedCoup, plural, one {# या ज़्यादा सिक्के} other {# या ज़्यादा सिक्के}} हैं, तो {coup} करना ही होगा।',

  'reformation.whatIsHeading': '{reformation} क्या है?',
  'reformation.whatIs': '{reformation} एक एक्सपेंशन है, जो गुट, तीन चालें ({convert}, {embezzle} और {examine}) और <inq>{inquisitor}</inq> जोड़ता है। गेम शुरू होने से पहले लॉबी की सेटिंग्स में इसे चालू करें।',
  'reformation.quickStartHeading': 'फटाफट समझें',
  'reformation.quick1': 'निशाना चुनने से पहले गुट के निशान देखें: <loy>{loyalistMark}</loy> और <ref>{reformistMark}</ref>।',
  'reformation.quick2': '{convert} से निशाने की पाबंदी हटाएँ, किसी साथी को बचाएँ, या रिज़र्व में सिक्के डालें।',
  'reformation.quick3': '{embezzle} तभी करें, जब रिज़र्व इतना भरा हो कि चैलेंज का जोखिम लेना बनता हो।',
  'reformation.quick4': '{inquisitor} वाले गेम में {exchange} पर {exchangeDraw} की जगह {inquisitorDraw, plural, one {# कार्ड} other {# कार्ड}} उठता है, और {examine} से किसी खिलाड़ी का एक कार्ड देखा जा सकता है।',
  markLoyalist: '▲ वफ़ा',
  markReformist: '◆ सुधार',
  'reformation.openWalkthrough': 'गाइड खोलें',
  'reformation.factionsHeading': 'गुट',
  'reformation.factions': 'हर खिलाड़ी या तो <loy>▲ {loyalist}</loy> है या <ref>◆ {reformist}</ref>। अपने ही गुट के खिलाड़ी पर {coup}, {assassinate}, {steal} या {examine} की चाल नहीं चली जा सकती। जब बचे हुए सारे खिलाड़ी एक ही गुट में हों, तो कोई भी किसी को भी निशाना बना सकता है। जब तक दोनों गुट बचे हैं, आपकी {foreignAid} सिर्फ़ दूसरा गुट ब्लॉक कर सकता है।',
  'reformation.newActionsHeading': 'नई चालें',
  'reformation.convert': '<name>{convert}:</name> अपना गुट बदलने के लिए {convertSelfCost, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}} दें, या किसी और का गुट बदलने के लिए {convertOtherCost, plural, =0 {# सिक्के} one {# सिक्का} other {# सिक्के}}। सिक्के {reserve} में जाते हैं। इस पर न चैलेंज होता है, न ब्लॉक।',
  'reformation.embezzle': '<name>{embezzle}:</name> यह दावा करके कि आपके पास {duke} नहीं है, {reserve} के सारे सिक्के ले लें। यहाँ चैलेंज उल्टा चलता है: आपके पास {duke} निकला, तो चैलेंज करने वाला जीतता है।',
  'reformation.examine': '<inq>{examine}:</inq> {inquisitor} का दावा करें। निशाना अपने छिपे कार्डों में से एक आपको दिखाता है। फिर आप उसे लौटाएँ, या डेक के किसी रैंडम कार्ड से बदलवाएँ।',
  'reformation.inquisitor': 'यह चालू होने पर {ambassador} की जगह लेता है। {inquisitor} {exchange} कर सकता है ({exchangeDraw} की जगह {inquisitorDraw, plural, one {# कार्ड} other {# कार्ड}} उठाकर), किसी दूसरे खिलाड़ी के कार्ड की {examine} कर सकता है, और {captain} की तरह {steal} ब्लॉक कर सकता है।',
  'reformation.reserve': 'ख़ज़ाने से अलग रखे सिक्कों का ढेर। {convert} के पैसे इसमें जाते हैं, और {embezzle} इन्हें पूरा निकाल लेता है।',
};

export default rules;
