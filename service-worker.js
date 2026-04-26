const CACHE_NAME = "spendsoul-shell-20260426-3";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./style.css?v=20260426-17",
  "./app.js?v=20260426-19",
  "./config.js?v=20260426-2",
  "./manifest.webmanifest",
  "./icons/spendsoul-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html"))));
});
