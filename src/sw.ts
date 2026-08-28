/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// HTML navigations — network first, fall back to cache
registerRoute(
  new NavigationRoute(new NetworkFirst({ cacheName: "html", networkTimeoutSeconds: 3 }), {
    denylist: [/^\/~oauth/, /^\/api/, /^\/functions/],
  }),
);

// Static assets — cache first
registerRoute(
  ({ request }) => ["image", "font", "style"].includes(request.destination),
  new CacheFirst({
    cacheName: "assets",
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  }),
);

self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Notification click — focus or open the app, route by tag/data
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tag = event.notification.tag || "";
  const data = (event.notification.data || {}) as { url?: string };
  const targetPath =
    data.url ||
    (tag === "message" || tag === "group_message"
      ? "/chats"
      : tag === "post_reply" || tag === "mention"
        ? "/"
        : "/");

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) {
            try { await client.navigate(targetPath); } catch { /* ignore */ }
          }
          return;
        }
      }
      await self.clients.openWindow(targetPath);
    })(),
  );
});
