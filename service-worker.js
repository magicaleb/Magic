const CACHE_NAME = 'magic-pwa-v5';
const LEGACY_CACHES = new Set(['magic-wallpaper-v4']);
const APP_SHELL = [
  './',
  './index.html',
  './hangman.html',
  './hangman.css',
  './hangman.js',
  './hangman-manifest.json',
  './icon-192.png',
  './icon-512.png',
  './styles.css',
  './app.js',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(APP_SHELL.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName !== CACHE_NAME && (LEGACY_CACHES.has(cacheName) || cacheName.startsWith('magic-pwa-')))
        .map((cacheName) => caches.delete(cacheName))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request)) ||
          (url.pathname.endsWith('/hangman.html') ? await caches.match('./hangman.html') : await caches.match('./index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreSearch: true });
    const networkPromise = fetch(request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => null);

    return cached || (await networkPromise) || Response.error();
  })());
});
