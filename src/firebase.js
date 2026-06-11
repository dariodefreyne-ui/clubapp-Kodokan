// src/firebase.js
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  memoryLocalCache,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
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

// memoryLocalCache i.p.v. persistentLocalCache: de IndexedDB-initialisatie van
// persistentLocalCache duurde 20+ seconden op iOS PWA bij koud opstarten.
// Voor een app die authenticatie vereist is offline-persistentie niet nodig;
// alle data wordt via onSnapshot geladen zodra de gebruiker online is.
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
});

export const storage = getStorage(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);
export { serverTimestamp };
export default app;
