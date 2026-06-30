// Service Worker — Karaoke Panel
// Кешируем только статику; Firebase работает в онлайне

const CACHE_NAME = "karaoke-panel-v1";
const STATIC_ASSETS = [
  "/guest.html",
  "/manifest.json",
  "/icon.svg"
];

// Установка: кешируем статику
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Пробуем закешировать, но не падаем если что-то недоступно
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// Активация: удаляем старые кеши
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first для Firebase, cache-first для статики
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Firebase, iTunes API, DJ-панель — всегда из сети
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("gstatic") ||
    url.hostname.includes("itunes.apple.com") ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.pathname.includes("dj.html")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Статика — cache-first, fallback на сеть
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        // Кешируем успешные GET-ответы
        if (event.request.method === "GET" && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Если офлайн и нет кеша — возвращаем guest.html как fallback
      if (event.request.destination === "document") {
        return caches.match("/guest.html");
      }
    })
  );
});
