import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import app, { db } from '../firebase';

const VAPID_KEY = 'BHfJZX-L_pwL9Z0-Ce9G4IQD9adYPPTlUwYQ_1RgNIu2SuroElB6-ls9VYg0PYu9Fdmh1meagyUPF40fpNG3ZDg';

export async function browserOndersteuntPush() {
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;
  return await isSupported();
}

export async function vraagStockPushToestemming(profiel) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) {
    throw new Error('Pushmeldingen worden niet ondersteund door deze browser.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Pushmeldingen zijn niet toegestaan.');
  }

  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error('Geen push-token ontvangen.');
  }

  const tokenRef = doc(db, 'notificationTokens', token);
  const tokenSnap = await getDoc(tokenRef);
  const tokenData = tokenSnap.exists() ? tokenSnap.data() : null;

  if (tokenData?.active === true && tokenData?.stockAlerts === true) {
    return token;
  }

  await setDoc(tokenRef, {
    uid: profiel?.uid || null,
    naam: profiel?.naam || null,
    email: profiel?.email || null,
    rol: profiel?.rol || null,
    token,
    stockAlerts: true,
    active: true,
    platform: 'web',
    userAgent: navigator.userAgent,
    device: navigator.userAgent.substring(0, 100),
    updatedAt: serverTimestamp(),
    ...(!tokenSnap.exists() ? { createdAt: serverTimestamp() } : {}),
  }, { merge: true });

  return token;
}

export async function stopStockPushMeldingen(profiel) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);

  if (token) {
    await setDoc(doc(db, 'notificationTokens', token), {
      uid: profiel?.uid || null,
      stockAlerts: false,
      active: false,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

export async function heeftActieveStockPush(profiel) {
  if (!profiel?.uid) return false;

  const q = query(
    collection(db, 'notificationTokens'),
    where('uid', '==', profiel.uid),
    where('stockAlerts', '==', true),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function registreerVoorgrondStockMeldingen(onStockAlert) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return () => {};

  const messaging = getMessaging(app);
  return onMessage(messaging, payload => {
    const data = payload?.data || {};
    if (data.type === 'stock_zero' && typeof onStockAlert === 'function') {
      onStockAlert(payload);
    }
  });
}
