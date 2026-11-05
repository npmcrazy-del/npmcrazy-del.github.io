// Offline-first: always open instantly from the saved copy (no network needed).
// When online, the new version is downloaded quietly in the background and
// is used the NEXT time the app is opened.
const CACHE = 'netsim-v2';
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Download a fresh copy and save it, only if the server answered OK (never save a 404 page)
async function refresh(cache, url, key) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (res && res.ok) await cache.put(key || url, res.clone());
  } catch (err) { /* offline: ignore */ }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  // Opening the app / any page: serve the saved index.html immediately
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const saved = await cache.match('./index.html', { ignoreSearch: true });
      if (saved) {
        e.waitUntil(refresh(cache, './index.html'));
        return saved;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return Response.error();
      }
    })());
    return;
  }

  // Other files (icons, manifest): saved copy first, update quietly in the background
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(req, { ignoreSearch: true });
    if (saved) {
      e.waitUntil(refresh(cache, req));
      return saved;
    }
    try {
      const res = await fetch(req);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
