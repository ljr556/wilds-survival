/* 荒野求生 · 离线缓存：静态资源 cache-first，页面 network-first（保证更新能生效） */
const CACHE = 'wilds-shell-v4';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './vendor/three.module.js',
  './js/main.js',
  './js/world.js',
  './js/player.js',
  './js/entities.js',
  './js/weather.js',
  './js/ui.js',
  './js/data.js',
  './assets/terrain/grass.png',
  './assets/terrain/dirt.png',
  './assets/terrain/rock.png',
  './assets/terrain/sand.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 页面导航：先网络（拿到最新版），失败时回落到缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  // 其它资源：命中缓存先返回（快），同时后台拉取最新版写回缓存，
  // 这样下次访问就能拿到更新，而不会被缓存钉死。
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      }).catch(() => hit);
      return hit || network;
    }),
  );
});
