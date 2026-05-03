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
  const title = payload.notification?.title || 'Stockmelding';
  const options = {
    body: payload.notification?.body || 'Een product is uit stock.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: payload.data || {},
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow('/winkel'));
});
