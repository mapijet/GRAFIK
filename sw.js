// Service worker — Salon PLAY / Generator grafiku
// HTML: network-first (po deployu na GitHubie widać nową wersję)
// Reszta (ikony, vendor): cache-first (szybko + offline)
//
// Przy KAŻDEJ większej publikacji HTML podbij CACHE_NAME (v3, v4, …),
// żeby przeglądarka wyrzuciła stary cache.

const CACHE_NAME = 'grafik-play-v3';

const ASSETS = [
  './',
  './GRAFIK.html',
  './manifest.json',
  './vendor/xlsx.min.js',
  './vendor/html2canvas.min.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS).catch((err) => {
        // Nie blokuj instalacji, gdy któregoś pliku brakuje na serwerze
        console.warn('[sw] cache.addAll partial fail:', err);
      })
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  if (accept.includes('text/html')) return true;
  try {
    const path = new URL(request.url).pathname;
    return path.endsWith('.html') || path.endsWith('/');
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // HTML / nawigacja: najpierw sieć, potem cache (offline)
  if (isHtmlRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy);
              // Zapisz też pod stałą nazwą pliku — na wypadek różnych URL-i startowych
              try {
                const u = new URL(request.url);
                if (u.pathname.endsWith('/') || u.pathname === '') {
                  cache.put(new Request('./GRAFIK.html'), response.clone());
                }
              } catch (_) { /* ignore */ }
            }).catch(() => {});
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              caches.match('./GRAFIK.html') ||
              caches.match('./')
          )
        )
    );
    return;
  }

  // Statyczne assety: cache-first, potem sieć
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
