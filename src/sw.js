// src/sw.js — gecombineerde Workbox + Firebase Cloud Messaging service worker
//
// Aanpak: Optie A — ES module-imports verwerkt door VitePWA injectManifest.
// VitePWA bundelt dit bestand via Vite/Rollup en injecteert self.__WB_MANIFEST
// met de actuele precache-manifest. import.meta.env.VITE_FB_* wordt tijdens de
// build vervangen door de echte waarden — geen handmatige template-substitutie.
//
// Vervangt:
//   - public/firebase-messaging-sw.js (gegenereerd door generateMessagingSw.mjs)
//   - de VitePWA generateSW-worker (automatisch gegenereerde sw.js)

import { precacheAndRoute, createHandlerBoundToURL, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { StaleWhileRevalidate, CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// Neem onmiddellijk de controle over alle clients (geen wachttijd op old SW).
self.skipWaiting();
clientsClaim();

// ─── PRECACHING ───────────────────────────────────────────────────────────────
// self.__WB_MANIFEST wordt tijdens de build ingevuld door VitePWA met de
// hashes van alle gebundelde app-shell-bestanden.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── NAVIGATIE FALLBACK ───────────────────────────────────────────────────────
// Stuurt alle navigatieverzoeken naar de precached index.html zodat React Router
// offline werkt en directe URL-navigatie niet breekt.
registerRoute(
  new NavigationRoute(
    createHandlerBoundToURL('/index.html'),
    {
      denylist: [
        /^\/api/,
        /^\/__\//,       // Firebase Auth helper URLs
        /^\/favicon\.ico$/,
      ],
    }
  )
);

// ─── RUNTIME CACHING ─────────────────────────────────────────────────────────

// Firebase Storage (logo, uploads) — kort cachen, revalidate op achtergrond
registerRoute(
  ({ url }) => url.origin === 'https://firebasestorage.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'firebase-storage',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Firestore en Firebase Auth API-calls nooit cachen (real-time data)
registerRoute(
  ({ url }) => url.origin === 'https://firestore.googleapis.com',
  new NetworkOnly()
);

// Overige externe requests: network-first, fallback naar cache
registerRoute(
  ({ url }) => url.protocol === 'https:',
  new NetworkFirst({
    cacheName: 'external-resources',
    networkTimeoutSeconds: 10,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// ─── FIREBASE CLOUD MESSAGING ─────────────────────────────────────────────────
// import.meta.env-waarden worden tijdens de Vite-build ingevuld.
// firebase/messaging/sw is de SW-specifieke variant zonder browser-only API's.

const firebaseApp = initializeApp({
  apiKey:            import.meta.env.VITE_FB_API_KEY,
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FB_APP_ID,
  measurementId:     import.meta.env.VITE_FB_MEASUREMENT_ID,
});

const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, payload => {
  // Op iOS/Safari handelt het OS de notificatie al af via APNs wanneer
  // een notification-blok aanwezig is in de FCM payload. Een tweede
  // showNotification() aanroep resulteert dan in een dubbele melding.
  // Als notification aanwezig is: OS doet het — SW doet niets.
  if (payload.notification) return;

  // Enkel voor data-only pushes (geen notification-blok) toont de SW
  // zelf een notificatie, zodat ook die zichtbaar zijn op alle platformen.
  const data = payload.data || {};
  const title = data.title || data.titel || import.meta.env.VITE_CLUB_NAAM_KORT || 'Club';
  const options = {
    body: data.body || data.bericht || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.type || data.rubriek || import.meta.env.VITE_CLUB_STORAGE_PREFIX || 'club',
    renotify: false,
    data,
  };
  self.registration.showNotification(title, options);
});

// ─── NOTIFICATIE-KLIK ─────────────────────────────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      try {
        const u = new URL(client.url);
        const origin = u.origin;
        if (targetUrl.startsWith('/')) {
          if (client.focus) {
            await client.focus();
            if (client.navigate) {
              await client.navigate(origin + targetUrl);
            } else {
              client.postMessage({ type: 'navigate', url: targetUrl });
            }
            return;
          }
        }
      } catch {
        // ignore
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(targetUrl);
    }
  })());
});
