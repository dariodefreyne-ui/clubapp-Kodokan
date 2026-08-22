// src/firebase.js
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
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

// Persistente Firestore-cache (IndexedDB) met multi-tab ondersteuning.
//
// Firebase Auth (hieronder) gebruikt browserLocalPersistence en initialiseert
// volledig onafhankelijk van Firestore — een IndexedDB-probleem hier kan de
// auth-flow dus niet blokkeren of vertragen.
//
// persistentMultipleTabManager voorkomt de "failed-precondition"-fout die
// optreedt wanneer persistentSingleTabManager (het oude gedrag) op meerdere
// open tabbladen/vensters botst.
//
// Bewust GEEN try/catch rond initializeFirestore(): dat vangt geen echte
// IndexedDB-runtimefouten. initializeFirestore() is synchroon en start de
// cache lazy; problemen met het effectief openen van IndexedDB (bv. Safari
// private mode, opslagrestricties) worden pas zichtbaar bij de eerste
// werkelijke read/listen — niet bij deze aanroep. Een try/catch hier zou dus
// een schijnzekerheid geven zonder de fout daadwerkelijk op te vangen, en
// een tweede initializeFirestore()-aanroep op dezelfde app kan bovendien zelf
// een fout geven ("Firestore has already been started").
//
// Runtime-fouten bij het effectief lezen worden al opgevangen op de plek waar
// gelezen wordt (zie bv. de onSnapshot-foutafhandeling in AuthContext en de
// .catch()-fallbacks bij het laden van configuratiedata) — dat blijft de
// juiste plek om degradatie op te vangen, niet hier bij initialisatie.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
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
