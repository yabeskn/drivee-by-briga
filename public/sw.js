// ─────────────────────────────────────────────────────────────
// sw.js — Service Worker (Offline-First) untuk Briga EV PWA
//
// Strategi caching:
//   1. App Shell  → Cache First (HTML, CSS, JS, fonts, icons)
//   2. API calls  → Network First dengan fallback ke antrian offline
//   3. Google Fonts → Stale While Revalidate
//   4. Leaflet tiles → Cache First dengan TTL
// ─────────────────────────────────────────────────────────────

const CACHE_VERSION = 'briga-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const FONT_CACHE = `${CACHE_VERSION}-fonts`;
const TILE_CACHE = `${CACHE_VERSION}-tiles`;
const API_CACHE = `${CACHE_VERSION}-api`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/offline.html',
];

// ── Install: precache app shell ──────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// ── Activate: cleanup old caches ─────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// ── Fetch: routing strategy ──────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // 1. Google Fonts → Stale While Revalidate
  if (url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // 2. Leaflet tiles → Cache First with TTL
  if (url.origin.includes('basemaps.cartocdn.com') || url.origin.includes('tile.')) {
    event.respondWith(cacheFirstWithTTL(request, TILE_CACHE, 7 * 24 * 60 * 60 * 1000));
    return;
  }

  // 3. API calls → Network First with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithOfflineQueue(request));
    return;
  }

  // 4. App Shell → Cache First
  event.respondWith(cacheFirst(request, STATIC_CACHE));
});

// ── Cache Strategies ─────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Fallback to offline page for navigations
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    throw new Error('Network unavailable');
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || fetchPromise;
}

async function cacheFirstWithTTL(request, cacheName, ttlMs) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) {
    const dateHeader = cached.headers.get('sw-fetched-at');
    if (dateHeader) {
      const age = Date.now() - parseInt(dateHeader, 10);
      if (age < ttlMs) return cached;
    }
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const headers = new Headers(response.headers);
      headers.set('sw-fetched-at', Date.now().toString());
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, modifiedResponse);
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

async function networkFirstWithOfflineQueue(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Try cache first
    const cache = await caches.open(API_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    // Return offline response for API calls
    return new Response(
      JSON.stringify({
        status: 'OFFLINE',
        message: 'No internet connection. Data will be synced when back online.',
        timestamp: Date.now(),
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// ── Background Sync ──────────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-trip-data') {
    event.waitUntil(syncTripData());
  }
});

async function syncTripData() {
  // This will be called when the browser comes back online
  // The actual sync logic is handled by the app via offline-sync.ts
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_TRIP_DATA' });
  });
}

// ── Push Notifications (for future use) ──────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Briga EV', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  );
});

// ── Message from client ──────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
