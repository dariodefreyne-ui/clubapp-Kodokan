import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                          // ← nog in te vullen
  authDomain: "kodokan-merchtem---eetfestijn.firebaseapp.com",
  projectId: "kodokan-merchtem---eetfestijn",
  storageBucket: "kodokan-merchtem---eetfestijn.appspot.com",
  messagingSenderId: "778826456831",
  appId: "YOUR_APP_ID",                            // ← nog in te vullen
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { app, db, storage, auth };
