/**
 * The landing pages: `<title>`, meta description, Open Graph and manifest
 * text, the "About" section under the menu (`components/home/SeoContent.tsx`,
 * also the source of the page's JSON-LD) and the language switcher and
 * suggestion (`components/home/LanguageSwitcher.tsx`). Every language that is
 * ready gets its own page (`/pt-br`, `/es`, `/ar`, `/zh-hans`, `/vi`, `/hi`)
 * built from this namespace; English is `/`.
 *
 * FOR TRANSLATORS. This namespace is written for search, so write it natively:
 * think of what a player in your language types into Google or Bing to find a
 * way to play Coup in a browser, and write the title and description a page
 * answering that search would have. Do not translate the English word for
 * word. Keep the facts (free, no account, 2 to 6 players, friends or bots, in
 * the browser), drop anything that reads like an advert, and follow
 * docs/VOICE.md: plain sentences, no slogans, no exclamation marks.
 *
 * What searchers are likely to type (unverified starting points; check them
 * against your own market, e.g. Google Trends and the search box suggestions):
 *
 *   pt-BR  "coup online", "jogar coup online", "coup jogo de cartas",
 *          "coup online grátis", "coup com amigos"
 *   es     "coup online", "jugar coup online", "coup juego de cartas",
 *          "coup online gratis", "coup con amigos"
 *   ar     the Latin name with Arabic around it: "لعبة coup", "كوب اون لاين",
 *          "لعبة كوب اونلاين"; many players write "coup" in Latin letters
 *   zh-Hans the Chinese edition's name "政变" with "桌游" (board game) or
 *          "在线" (online): "政变桌游", "政变 在线玩", plus plain "coup 桌游"
 *   vi     "coup online", "chơi coup online", "bài coup", "board game coup"
 *   hi     mostly Latin script or Hinglish: "coup game online", "coup card
 *          game", "coup kaise khele"; some Devanagari: "कू कार्ड गेम"
 *
 * The game's name. Keep "Coup" (in Latin letters) somewhere in the title in
 * every language: it is the word most searches contain, and the product name
 * "Coup Online" is never translated. Where the game has a local published
 * name (Chinese editions are sold as 政变), use it beside "Coup", not instead.
 *
 * Character and action names come from the glossary in docs/I18N.md. That
 * glossary is still empty at the time of writing, so it lists no local
 * published names yet; when it does, use exactly those names here, since
 * searchers type the names printed on their own copy of the game.
 */
const seo = {
  /**
   * The page title in search results and the browser tab. At most about 60
   * characters. Lead with the words people search for (see the list above),
   * keep "Coup" in Latin letters.
   */
  title: 'Coup Online: play the card game free with friends or bots',
  /**
   * The snippet under the title in search results. About 150 characters.
   * Say what the page lets you do, in the words a searcher would use.
   */
  description: 'Play the bluffing card game Coup online with friends or bots. Claim characters, challenge bluffs and steal coins, 2 to 6 players.',
  /** Title when the page is shared in chats and social posts. Short; usually just the product name. */
  ogTitle: 'Coup Online',
  /** Alt text of the share image (the game's banner). */
  ogImageAlt: 'Coup Online, a multiplayer bluffing card game',
  /** The installed app's description (web app manifest). One sentence. */
  manifestDescription: 'Real-time multiplayer Coup. Bluff and challenge friends or bots, no account needed.',

  /** Heading of the section under the menu. "Coup Online" stays as is. */
  aboutHeading: 'About Coup Online',
  /** First paragraph: what the game is. Answer the search "what is Coup" in your language. */
  aboutIntro: "Coup Online is a free web version of Coup, the card game of bluffing and deduction for {min, number} to {max, number} players. Each player starts with 2 face-down character cards, called influence, and 2 coins. You can claim any character, whether you hold that card or not. Lose both cards and you're out. The last player with a card wins.",
  roundHeading: 'How a turn works',
  /** Use the glossary's names for Income, Foreign Aid, Duke, Tax, Captain, Steal and Coup. */
  roundBody: "On your turn you take one action. Income and Foreign Aid give you coins. A character action, like the Duke's Tax or the Captain's Steal, is a claim that you hold that card. Any player can challenge a claim: if it was a bluff, the bluffer loses a card, and if it was true, the challenger does. Some actions can be blocked by claiming the right character, and a block can be challenged too. For {coupCost, number} coins you can launch a Coup, which costs any player a card and cannot be blocked. With {forcedCoup, number} coins you must.",
  freeHeading: 'Free, with no account',
  freeBody: 'Coup Online is free to play. There is no sign-up: type a name and play. It runs in the browser on phones, tablets and computers, and you can add it to your home screen like an app.',
  faqHeading: 'Questions',
  /**
   * The questions are written as players search them, so phrase each one the
   * way someone in your language would type it. Keep each answer's facts.
   */
  faqFriendsQ: 'Can I play Coup online with friends?',
  faqFriendsA: 'Yes. Create a room and share its 4-letter code or the invite link. Friends join from their own phone or computer, with no account.',
  faqBotsQ: 'Can I play Coup against bots?',
  faqBotsA: "Yes. Play vs Bots starts a game against {bots, plural, one {# computer player} other {# computer players}} straight away. You can also add bots to a room with friends and pick each one's playing style.",
  faqPhoneQ: 'Can I play on my phone?',
  faqPhoneA: 'Yes. It runs in the browser on Android and iPhone, with nothing to download. Add it to your home screen to open it like an app.',
  faqFreeQ: 'Is Coup Online free?',
  faqFreeA: 'Yes. Every game mode is free, and you never need an account.',
  faqPlayersQ: 'How many players can play?',
  faqPlayersA: '{min, number} to {max, number} players. Bots can fill the empty seats, so you can also play alone.',
  /** Use the glossary's names for Reformation, Loyalist, Reformist, Coup, Assassinate, Steal, Convert, Embezzle, Treasury Reserve, Inquisitor and Ambassador. */
  faqReformationQ: 'What is the Reformation expansion?',
  faqReformationA: 'Reformation splits the table into two factions, Loyalists and Reformists. While both factions are in play, you cannot Coup, Assassinate or Steal from your own side. It adds the Convert and Embezzle actions and the Treasury Reserve, and the Inquisitor can replace the Ambassador. The host turns it on in the lobby.',
  /**
   * The credit and disclaimer. Keep every name exactly as written (they are
   * names, not words) and keep "unofficial" and "not affiliated" explicit.
   */
  credit: 'Coup Online is an unofficial, fan-made adaptation of Coup, a card game designed by Rikki Tahta and published by La Mame Games and Indie Boards & Cards. It is not affiliated with or endorsed by them.',
  /** Label of the list of links to this page in other languages. */
  languages: 'Language',
  /**
   * The suggestion shown on the English page to someone whose browser also
   * lists your language. Written in YOUR language, as an offer to read this
   * page in it: "Leia em português", "Leer en español", "اقرأ بالعربية".
   */
  suggestion: 'Read in English',
  /** The close button of that suggestion (screen readers), in your language too. */
  suggestionDismiss: 'Dismiss',
} satisfies Record<string, string>;

export default seo;
