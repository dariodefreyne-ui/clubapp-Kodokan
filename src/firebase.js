// src/firebase.js
import { initializeApp, getApps } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: "AIzaSyD9-78Kd-IKK7TDK-iv_Ohc-7ifXwGMKUU",
  authDomain: "club-app-kodokan-merchtem.firebaseapp.com",
  projectId: "club-app-kodokan-merchtem",
  storageBucket: "club-app-kodokan-merchtem.firebasestorage.app",
  messagingSenderId: "477058265166",
  appId: "1:477058265166:web:7e437cfa40f68ada6b131f",
  measurementId: "G-2442154FKB"
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const storage = getStorage(app);
export const auth = getAuth(app);
export const messaging = getMessaging(app);
export { serverTimestamp };
export default app;
