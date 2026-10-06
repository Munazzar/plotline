// Plotline offline cache: serve the app shell from cache, refresh it in the background.
const CACHE = 'plotline-v1.22.2';
const SHELL = ['./', './index.html', './bench.js', './lists.js', './manifest.webmanifest', './icon-192.png', './icon-512.png',
  './fonts/big-shoulders-display-latin-600-normal.woff2', './fonts/big-shoulders-display-latin-700-normal.woff2', './fonts/big-shoulders-display-latin-800-normal.woff2',
  './fonts/figtree-latin-400-normal.woff2', './fonts/figtree-latin-500-normal.woff2', './fonts/figtree-latin-600-normal.woff2', './fonts/figtree-latin-700-normal.woff2',
  './fonts/martian-mono-latin-400-normal.woff2', './fonts/martian-mono-latin-500-normal.woff2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('plotline-v') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // Insights: keep the open-source search/LLM libraries from jsDelivr for offline use (model files are cached by the libraries themselves).
  if (e.request.method === 'GET' && u.host === 'cdn.jsdelivr.net') { e.respondWith(caches.open('lib-cdn').then(async c => (await c.match(e.request)) || fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }))); return; }
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
