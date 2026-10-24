const CACHE_NAME = 'union-app-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './firebase-config.js',
  './images/logo.png',
  './images/building.jpg',
  './images/icon-192.png',
  './images/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* الصفحة والسكربتات: النسخة الجديدة من النت الأول (عشان التحديثات تظهر فوراً)، والكاش لو أوفلاين.
   الصور والملفات التانية: من الكاش بسرعة وتتحدث في الخلفية. */
function isCore(req){
  const u = new URL(req.url);
  return req.mode === 'navigate' ||
    (u.origin === self.location.origin && /\.(html|js|json)$/.test(u.pathname)) ||
    (u.origin === self.location.origin && u.pathname.endsWith('/'));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (isCore(req)) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then((m) => m || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
