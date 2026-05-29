// TEMPLATE — wordt tijdens de build omgezet naar public/firebase-messaging-sw.js
// door scripts/generateMessagingSw.mjs (zie prebuild/predev in package.json).
//
// De __FB_*__ placeholders worden ingevuld vanuit de VITE_FB_* env-variabelen
// (lokaal uit .env.local, in CI uit secrets.ENV_LOCAL). Zo staan er geen
// hardcoded sleutels meer in de repo en worden ze net als de rest van de client
// via CI/CD in het artifact "gebakken". De gegenereerde firebase-messaging-sw.js
// staat in .gitignore.
//
// LET OP: een service worker heeft geen toegang tot import.meta.env, vandaar de
// substitutie tijdens de build.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '__FB_API_KEY__',
  authDomain: '__FB_AUTH_DOMAIN__',
  projectId: '__FB_PROJECT_ID__',
  storageBucket: '__FB_STORAGE_BUCKET__',
  messagingSenderId: '__FB_MESSAGING_SENDER_ID__',
  appId: '__FB_APP_ID__',
  measurementId: '__FB_MEASUREMENT_ID__',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const notif = payload.notification || {};
  const data = payload.data || {};
  const title = notif.title || 'Kodokan';
  const options = {
    body: notif.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: data.type || data.rubriek || 'kodokan',
    data,
  };
  self.registration.showNotification(title, options);
});

// Bij klik op notificatie: focus een bestaand venster als die er is, anders open een nieuwe.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      // Match op origin (URL kan met of zonder trailing slash zijn)
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
