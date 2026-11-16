/* Service Worker سبک برای نصب‌پذیری و کار آفلاین «مدیریت گردش کالا»
 * - فقط فایل‌های استاتیک و صفحهٔ اصلی کش می‌شوند (network-first تا در حالت dev به‌روز بماند)
 * - داده‌های کاربر در IndexedDB (Dexie) روی خود گوشی ذخیره می‌شوند و به این کش ربطی ندارند
 */
const VERSION = 'inventory-flow-pwa-v1';
const PRECACHE = ['/', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const pathname = url.pathname;
  const isStatic =
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/';

  if (isStatic) {
    // network-first: نسخهٔ تازه وقتی آنلاین هستیم، کش فقط برای حالت آفلاین
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(VERSION)
            .then((cache) => cache.put(req, copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // ناوبری صفحه: در صورت قطع اینترنت، آخرین نسخهٔ کش‌شدهٔ اپ باز شود
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/')));
  }
});
