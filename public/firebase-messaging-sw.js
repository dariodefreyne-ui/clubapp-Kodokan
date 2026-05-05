// firebase-messaging-sw.js
// VitePWA injectManifest: onderstaande regel MOET aanwezig zijn bovenaan.
// VitePWA vervangt deze bij de build door de echte precache lijst.
self.__WB_MANIFEST;

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyD9-78Kd-IKK7TDK-iv_Ohc-7ifXwGMKUU',
  authDomain: 'club-app-kodokan-merchtem.firebaseapp.com',
  projectId: 'club-app-kodokan-merchtem',
  storageBucket: 'club-app-kodokan-merchtem.firebasestorage.app',
  messagingSenderId: '477058265166',
  appId: '1:477058265166:web:7e437cfa40f68ada6b131f',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'Kodokan melding';
  const options = {
    body: payload.notification?.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(clients.openWindow(url));
});
