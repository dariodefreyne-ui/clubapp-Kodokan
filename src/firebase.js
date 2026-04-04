import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD9-78Kd-IKK7TDK-iv_Ohc-7ifXwGMKUU",
  authDomain: "club-app-kodokan-merchtem.firebaseapp.com",
  projectId: "club-app-kodokan-merchtem",
  storageBucket: "club-app-kodokan-merchtem.firebasestorage.app",
  messagingSenderId: "477058265166",
  appId: "1:477058265166:web:7e437cfa40f68ada6b131f",
  measurementId: "G-2442154FKB"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
