// src/firebase.js
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
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
export let appCheck = null;
if (appCheckKey) {
  appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(appCheckKey),
    isTokenAutoRefreshEnabled: true,
  });
} else if (import.meta.env.DEV) {
  console.warn('[AppCheck] Geen VITE_APPCHECK_KEY gevonden — AppCheck uitgeschakeld in dev');
}

// persistentLocalCache met explicit single-tab manager: geeft snelle navigatie
// terug (data meteen uit cache, daarna update van netwerk). De vorige startup-
// vertraging was veroorzaakt door Auth's IndexedDB (nu opgelost via localStorage),
// niet door Firestore's cache. persistentSingleTabManager vermijdt de cross-tab
// lock-contention die de originele 20s-vertraging mee veroorzaakte.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
  }),
});

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
