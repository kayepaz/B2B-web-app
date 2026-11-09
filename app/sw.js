// Service worker: makes the app work offline.
//
// - The app's files and data are downloaded when the service worker installs.
// - App files and data are fetched "network first": the latest version is used
//   when online, and the saved copy when offline or the network is too slow.
// - Product images are saved as they're viewed ("cache first"). An image
//   that was never viewed shows a placeholder while offline.
//
// The deploy workflow replaces 'dev' below with the commit ID, so each
// release installs fresh copies and removes the old ones.

const VERSION = 'dev';
const APP_CACHE = `app-${VERSION}`;
const IMAGE_CACHE = `images-${VERSION}`;
const NETWORK_TIMEOUT_MS = 4000;

// Every file the app needs to start and run offline.
// tools/check_offline_files.py fails the build if one is missing here.
const APP_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'images/placeholder.svg',
  'images/reorder.svg',
  'css/styles.css',
  'js/api.js',
  'js/app.js',
  'js/barcode.js',
  'js/cart.js',
  'js/data.js',
  'js/db.js',
  'js/dom.js',
  'js/format.js',
  'js/orders.js',
  'js/pwa.js',
  'js/scanner.js',
  'js/scanview.js',
  'js/search.js',
  'js/session.js',
  'js/views.js',
  'data/index.json',
  'data/categories.json',
  'data/products.json',
  'data/companies.json',
  'data/customers.json',
];

const PLACEHOLDER = 'images/placeholder.svg';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      // 'reload' skips the browser's HTTP cache so we save fresh copies.
      .then((cache) => cache.addAll(APP_FILES.map((file) => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name !== APP_CACHE && name !== IMAGE_CACHE)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle this app's own GET requests; everything else goes straight
  // to the network as normal.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.href.startsWith(self.registration.scope)) return;

  if (url.pathname.includes('/images/products/')) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Network timeout')), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await withTimeout(fetch(request), NETWORK_TIMEOUT_MS);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
    // Page loads (e.g. a bookmarked link) fall back to the app itself.
    if (request.mode === 'navigate') {
      const app = await cache.match('index.html');
      if (app) return app;
    }
    return new Response('Offline and not saved.', { status: 503, statusText: 'Offline' });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const saved = await cache.match(request);
  if (saved) return saved;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const placeholder = await caches.match(PLACEHOLDER);
    return placeholder ?? new Response('', { status: 503, statusText: 'Offline' });
  }
}
