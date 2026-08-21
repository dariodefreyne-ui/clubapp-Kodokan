// src/firebase.js
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { initializeAuth, browserLocalPersistence } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
  measurementId: import.meta.env.VITE_FB_MEASUREMENT_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

const appCheckKey = import.meta.env.VITE_APPCHECK_KEY;
if (appCheckKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.DEV) {
  console.warn('[AppCheck] Geen VITE_APPCHECK_KEY gevonden — AppCheck uitgeschakeld in dev');
}

// Gebruik bewust GEEN persistente Firestore-cache (IndexedDB).
//
// De app moet online kunnen werken en hoeft niet volledig offline te functioneren.
// Persistente Firestore-cache kan op sommige browsers/PWA's blijven hangen of een
// oude lokale toestand meenemen naar een nieuwe sessie. Dat was vooral zichtbaar
// als: normale browser/PWA = login timeout, incognito = onmiddellijk goed.
//
// De standaard Firestore-cache is memory-only: elke pagina/sessie start schoon,
// terwijl Firebase Auth wél lokaal persistent blijft via localStorage hieronder.
export const db = initializeFirestore(app);

export const storage = getStorage(app);
// Firebase v10 gebruikt standaard IndexedDB voor auth-persistentie, wat op iOS PWA
// 20+ seconden kan duren bij koud opstarten. browserLocalPersistence (localStorage)
// is synchroon en onmiddellijk beschikbaar — onAuthStateChanged vuurt daardoor
// binnen milliseconden i.p.v. tientallen seconden.
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
});
export const messaging = getMessaging(app);
export { serverTimestamp };
export default app;
