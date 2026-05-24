const CACHE = "business-vision-v3";
const ASSETS = ["./", "./index.html", "./styles.css", "./data.js", "./app.js", "./manifest.webmanifest"];
self.addEventListener("install", (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener("activate", (event) => event.waitUntil(
  caches.keys().then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", (event) => {
  if (event.request.method === "GET") {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
  }
});
