// Utmost service worker — VERSION is bumped by deploy.ps1 on every deploy.
const VERSION = '20261030-155950';
const SHELL = 'utmost-shell-' + VERSION;
const FONTS = 'utmost-fonts-v1';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './data/en.json', './data/ko.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('utmost-') && ![SHELL, FONTS].includes(k)).map(k => caches.delete(k))))  // 같은 주소의 다른 앱 저장공간은 건드리지 않음
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

const isFont = u => u.hostname.includes('fonts.g') || (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('pretendard'));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (isFont(u)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const c = res.clone(); caches.open(FONTS).then(x => x.put(req, c)); return res; })));
    return;
  }
  if (u.origin !== location.origin) return;
  // network-first for same-origin; fall back to cache when offline
  e.respondWith(fetch(req).then(res => {
    if (res.ok) { const c = res.clone(); caches.open(SHELL).then(x => x.put(req, c)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
