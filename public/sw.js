const CACHE_NAME = 'coup-assets-v2';
const ASSET_URLS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/apple-touch-icon.png',
  '/assets/backgrounds/game-table.webp',
  '/assets/backgrounds/game-table-mobile.webp',
  '/assets/brand/coup-online-banner.png',
  '/assets/cards/back.webp',
  '/assets/cards/focus/back.webp',
  '/assets/cards/duke-v3.webp',
  '/assets/cards/assassin-v3.webp',
  '/assets/cards/captain-v3.webp',
  '/assets/cards/ambassador-v3.webp',
  '/assets/cards/contessa-v3.webp',
  '/assets/cards/inquisitor-v3.webp',
  '/assets/cards/focus/duke-v3.webp',
  '/assets/cards/focus/assassin-v3.webp',
  '/assets/cards/focus/captain-v3.webp',
  '/assets/cards/focus/ambassador-v3.webp',
  '/assets/cards/focus/contessa-v3.webp',
  '/assets/cards/focus/inquisitor-v3.webp',
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
  if (!url.pathname.startsWith('/assets/') && !url.pathname.startsWith('/icons/') && url.pathname !== '/apple-touch-icon.png') return;

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
