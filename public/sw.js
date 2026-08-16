// Service worker — the only code that runs when the app is closed.
//
// Deliberately tiny and dependency-free. It caches nothing: this app is
// server-rendered and every screen is live data, so an offline cache would
// mostly serve stale itineraries. The one job here is to receive a push and
// show it.
//
// Plain JS in /public rather than a bundled module, because a service worker is
// fetched by the browser at its own URL and must not go through the app's
// bundler or its scope would be wrong.

// Take over as soon as a new version is installed, instead of waiting for every
// tab to close. A reminder arriving through last week's worker is not something
// worth supporting.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);

self.addEventListener("push", (event) => {
  // A push with no readable payload still deserves a notification: on iOS a
  // subscription that shows nothing is treated as a broken app and the
  // permission can be revoked. So fall back rather than return.
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "TripPlan";
  const options = {
    body: payload.body || "יש עדכון בטיול שלך.",
    // PNG, not SVG: several platforms silently show no icon for an SVG here.
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    dir: "rtl",
    lang: "he",
    // Groups repeats of the same reminder instead of stacking them. The server
    // only sends each reminder once, but a retry at the transport layer is out
    // of its hands.
    tag: payload.tag || "tripplan-reminder",
    renotify: false,
    data: { url: payload.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/";

  // Focus an open tab if there is one, rather than opening a second copy of the
  // app next to the one the user already has.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate?.(target);
            return client.focus();
          }
        }
        return self.clients.openWindow(target);
      }),
  );
});
