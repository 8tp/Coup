// v5: the ElevenLabs sound bank (public/audio/sfx/) and the three looping
// music beds (public/audio/music/). Bumping the name is what evicts v4 —
// including the old single bed, velvet-court.mp3, which nothing plays now.
const CACHE_NAME = 'coup-assets-v6';
const ASSET_URLS = [
  '/icons/icon-192-v2.png',
  '/icons/icon-512-v2.png',
  '/icons/icon-maskable-512-v2.png',
  '/apple-touch-icon-v2.png',
  '/assets/backgrounds/menu-chamber-wide-v1.webp',
  '/assets/backgrounds/menu-chamber-tall-v1.webp',
  '/assets/brand/coup-wordmark-v3.webp',
  '/assets/cards/back-v3.webp',
  '/assets/cards/focus/back-v3.webp',
  '/assets/cards/duke-v3.webp',
  '/assets/cards/assassin-v3.webp',
  '/assets/cards/captain-v3.webp',
  '/assets/cards/ambassador-v3.webp',
  '/assets/cards/contessa-v3.webp',
  '/assets/cards/inquisitor-v3.webp',
  '/assets/cards/focus/duke-v3.webp',
  '/assets/cards/focus/assassin-v3.webp',
  '/assets/cards/focus/captain-v3.webp',
  '/assets/cards/focus/ambassador-v4.webp',
  '/assets/cards/focus/contessa-v4.webp',
  '/assets/cards/focus/inquisitor-v3.webp',
  '/audio/court-crowned.mp3',
  '/audio/plot-unraveled.mp3',
  '/audio/music/lobby-antechamber.mp3',
  '/audio/music/table-velvet-court.mp3',
  '/audio/music/endgame-last-favour.mp3',
  '/audio/sfx/actionDeclared-1.mp3',
  '/audio/sfx/actionDeclared-2.mp3',
  '/audio/sfx/actionDeclared-3.mp3',
  '/audio/sfx/assassinationAlert.mp3',
  '/audio/sfx/block.mp3',
  '/audio/sfx/blockOpportunity.mp3',
  '/audio/sfx/cardDeal.mp3',
  '/audio/sfx/cardShuffle-1.mp3',
  '/audio/sfx/cardShuffle-2.mp3',
  '/audio/sfx/cardShuffle-3.mp3',
  '/audio/sfx/challengeRevealFail.mp3',
  '/audio/sfx/challengeRevealSuccess.mp3',
  '/audio/sfx/challengeWindow.mp3',
  '/audio/sfx/chatMessage.mp3',
  '/audio/sfx/coinsGained-1.mp3',
  '/audio/sfx/coinsGained-2.mp3',
  '/audio/sfx/coinsLost-1.mp3',
  '/audio/sfx/coinsLost-2.mp3',
  '/audio/sfx/coup.mp3',
  '/audio/sfx/denied.mp3',
  '/audio/sfx/exchange.mp3',
  '/audio/sfx/influenceLoss.mp3',
  '/audio/sfx/playerEliminated.mp3',
  '/audio/sfx/reaction.mp3',
  '/audio/sfx/timerWarning.mp3',
  '/audio/sfx/yourTurn.mp3',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSET_URLS))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/audio/') && !url.pathname.startsWith('/icons/') && !url.pathname.startsWith('/apple-touch-icon')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
    }),
  );
});
