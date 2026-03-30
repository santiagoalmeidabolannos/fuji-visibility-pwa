/* ─────────────────────────────────────────────
   Fuji Visibility PWA — sw.js
   Cache strategy:
     • App shell (HTML/CSS/JS/icons/manifest) → cache-first
     • API (/visibility)                      → network-first, cache fallback
     • widget-data.json                       → served from in-memory store
───────────────────────────────────────────── */

const SHELL_CACHE  = 'fuji-shell-v4';
const API_CACHE    = 'fuji-api-v4';
const API_URL      = 'https://fuji-visibility-api.onrender.com/visibility';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/icon-apple.svg',
];

// In-memory widget data (populated via postMessage from app.js)
let widgetData = null;

// ── Install: pre-cache app shell ──────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: remove old caches ───────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: routing ────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Widget data — serve from memory or placeholder
  if (url.pathname === '/widget-data.json') {
    event.respondWith(serveWidgetData());
    return;
  }

  // API — network-first with cache fallback
  if (request.url.startsWith(API_URL)) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // App shell assets — cache-first
  if (
    url.origin === self.location.origin ||
    SHELL_ASSETS.includes(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
});

// ── Strategy: cache-first ─────────────────────
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // No cache hit and network failed — return a generic offline page
    return new Response('<h1>Offline</h1>', {
      headers: { 'Content-Type': 'text/html' },
      status: 503,
    });
  }
}

// ── Strategy: network-first ───────────────────
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    return new Response(JSON.stringify({ error: 'offline', forecast: [] }), {
      headers: { 'Content-Type': 'application/json' },
      status: 503,
    });
  }
}

// ── Widget data endpoint ──────────────────────
function serveWidgetData() {
  const body = widgetData
    ? JSON.stringify(widgetData)
    : JSON.stringify({ north_morning: null, south_morning: null, updated: null });

  return Promise.resolve(
    new Response(body, {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  );
}

// ── Message: STORE_WIDGET_DATA from app.js ────
self.addEventListener('message', event => {
  if (event.data?.type === 'STORE_WIDGET_DATA') {
    widgetData = event.data.payload;
  }
});
