const CACHE = 'chefbybirth-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/about.html',
  '/menu.html',
  '/order.html',
  '/how-it-works.html',
  '/hours.html',
  '/contact.html',
  '/kenkey.html',
  '/gallery.html',
  '/catering.html',
  '/reviews.html',
  '/faq.html',
  '/track.html',
  '/css/styles.css',
  '/js/customer.js',
  '/js/layout.js',
  '/config.js',
  '/assets/hero-kenkey.png',
  '/manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((res) => {
        if (res.ok && ASSETS.some((a) => url.pathname === a || url.pathname.endsWith(a))) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
    )
  );
});
