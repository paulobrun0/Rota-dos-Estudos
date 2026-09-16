import { precacheAndRoute } from "workbox-precaching";

// injectManifest (unlike generateSW) doesn't auto-add these: without them, a
// newly-installed SW sits "waiting" until every open tab of the app is fully
// closed, so anyone who keeps the PWA open never gets the update. skipWaiting
// lets the new worker activate right away instead of waiting for old tabs to
// go away, and clients.claim hands it control of those already-open tabs
// immediately, so the next reload — not a full app restart — is enough.
self.skipWaiting();
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", (event) => {
  let data = { title: "Rota dos Estudos", body: "Você tem novidades no seu plano." };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // non-JSON payload — fall back to the default text above
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "daily-reminder",
    }),
  );
});

// Focuses an already-open tab if there is one, instead of always opening a
// new one — a notification tap should feel like switching back to the app,
// not spawning a duplicate.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    }),
  );
});
