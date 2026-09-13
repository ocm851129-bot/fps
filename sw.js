const CACHE = 'triad-mobile-v15';
const ASSETS = ['./mass-arena.js','./mass-arena.css','./weapons.js','./account.html','./account.css','./vendor/account.js','./hero.html',"./royale.html",'./career.js','./maps.js','./online-config.js','./vendor/online.js','./view3d.js','./tactical.css','./vendor/three.module.js','./vendor/three.core.js','./index.html','./style.css','./mobile.css','./game.js','./touch.js','./pwa.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('triad-mobile-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && ASSETS.some(asset => new URL(asset, self.registration.scope).href === event.request.url)) {
      const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    if (event.request.mode === 'navigate') return caches.match(new URL('./index.html', self.registration.scope));
    return Response.error();
  }));
});

