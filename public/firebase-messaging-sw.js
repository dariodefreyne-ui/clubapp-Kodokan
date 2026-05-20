// Service worker voor FCM background messages.
//
// LET OP: Firebase config staat hardcoded omdat een service worker geen toegang
// heeft tot Vite's import.meta.env. De waarden zijn dezelfde publieke keys die
// ook in de gebundelde client zitten — geen extra security-risico.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD9-78Kd-IKK7TDK-iv_Ohc-7ifXwGMKUU',
  authDomain: 'club-app-kodokan-merchtem.firebaseapp.com',
  projectId: 'club-app-kodokan-merchtem',
  storageBucket: 'club-app-kodokan-merchtem.firebasestorage.app',
  messagingSenderId: '477058265166',
  appId: '1:477058265166:web:7e437cfa40f68ada6b131f',
  measurementId: 'G-2442154FKB',
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
