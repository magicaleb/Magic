const CACHE_NAME = 'hangman-pwa-v2.4.0';
const APP_SHELL = [
  './hangman.html',
  './hangman.html?v=2.4.0',
  './hangman.css?v=2.4.0',
  './hangman-ux.css?v=2.4.0',
  './hangman-settings.css?v=2.4.0',
  './hangman-core.js?v=2.4.0',
  './hangman-efficient.js?v=2.4.0',
  './hangman-performance.js?v=2.4.0',
  './hangman.js?v=2.4.0',
  './hangman-lab.js?v=2.4.0',
  './hangman-ux.js?v=2.4.0',
  './hangman-settings.js?v=2.4.0',
  './hangman-manifest.json',
  './icon-192.png',
  './icon-512.png'
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put('./hangman.html', copy));
      return response;
    }).catch(() => caches.match('./hangman.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => {
    const network = fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => cached);
    return cached || network;
  }));
});
