const CACHE_VERSION = "ksimath-static-v37";
const STATIC_FILES = [
  "/offline.html",
  "/styles.css?v=20260831-2",
  "/app.js?v=20260831-2",
  "/supabase-config.js",
  "/manifest.webmanifest",
  "/assets/logo-horizontal.png",
  "/assets/logo-vertical.png",
  "/assets/icons/icon-192.png",
  "/assets/icons/icon-512.png",
  "/assets/icons/maskable-512.png",
  "/assets/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSupabaseRequest = url.hostname.endsWith(".supabase.co")
    || url.pathname.includes("/rest/v1/")
    || url.pathname.includes("/auth/v1/")
    || url.pathname.includes("/storage/v1/")
    || url.pathname.includes("/functions/v1/");

  if (isSupabaseRequest || url.pathname.startsWith("/.netlify/functions/") || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  const cacheablePath = STATIC_FILES.some((file) => {
    const cachedUrl = new URL(file, self.location.origin);
    return cachedUrl.pathname === url.pathname && cachedUrl.search === url.search;
  });
  if (!cacheablePath) return;

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
