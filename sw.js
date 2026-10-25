/* غيّر رقم النسخة مع كل تحديث (أو شغّل: sh scripts/bump-sw.sh) —
   ده اللي بيخلي المتصفح يستبدل الـ Service Worker ويمسح الكاش القديم ويظهر شريط "فيه تحديث". */
const CACHE_NAME = 'union-app-202610251325';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './firebase-config.js',
  './css/style.css',
  './js/01-core.js',
  './js/02-polls.js',
  './js/03-dashboard-profile.js',
  './js/04-media.js',
  './js/05-student-nav.js',
  './js/06-home.js',
  './js/07-activities.js',
  './js/08-community.js',
  './js/09-news.js',
  './js/10-profile-ranking.js',
  './js/11-admin.js',
  './js/12-notifications.js',
  './js/14-students-insights.js',
  './js/13-init.js',
  './images/logo.png',
  './images/building.jpg',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/apple-touch-icon.png',
  './images/favicon-32.png'
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

/* الصفحة والسكربتات والستايل: النسخة الجديدة من النت الأول (عشان التحديثات تظهر فوراً)، والكاش لو أوفلاين.
   الصور والملفات التانية: من الكاش بسرعة وتتحدث في الخلفية. */
function isCore(req){
  const u = new URL(req.url);
  return req.mode === 'navigate' ||
    (u.origin === self.location.origin && /\.(html|js|css|json)$/.test(u.pathname)) ||
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

/* ===== الإشعارات ===== */
/* استقبال push (جاهز لـ FCM / Web Push لما يتوصل سيرفر يبعت) */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (_) { d = { body: event.data && event.data.text() }; }
  const n = d.notification || d;
  event.waitUntil(self.registration.showNotification(n.title || 'اتحاد التمريض', {
    body: n.body || '',
    icon: 'images/icon-192.png',
    badge: 'images/icon-192.png',
    dir: 'rtl', lang: 'ar',
    tag: n.tag,
    data: { url: (d.data && d.data.url) || n.url || './' }
  }));
});

/* الضغط على الإشعار: لو التطبيق مفتوح نركّز عليه ونفتح الصفحة، وإلا نفتح نافذة جديدة */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.postMessage({ type: 'nu-open', url });
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
