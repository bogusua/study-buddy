const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `study-buddy-${CACHE_VERSION}`;

const CACHE_FILES = [
  '/',
  '/index.html',
  '/style.css',
  '/site.webmanifest',
  '/js/app.js',
  '/js/gemini.js',
  '/js/nano.js',
  '/js/quiz.js',
  '/js/settings.js',
  '/js/stats.js',
  '/js/storage.js',
  '/js/ui.js',
  '/subjects/math.json',
  '/subjects/ukrainian.json',
  '/icons/icon48.png',
  '/icons/icon128.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES))
  );
  // Не активуємось автоматично — чекаємо явного skipWaiting від користувача
});

self.addEventListener('activate', e => {
  // Видаляємо кеші старих версій
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', e => {
  // Gemini API — завжди мережа (офлайн обробляється в app.js)
  if (e.request.url.includes('generativelanguage.googleapis.com')) return;

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
