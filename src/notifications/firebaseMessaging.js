// src/notifications/firebaseMessaging.js
// Universele push-registratie voor alle rollen en meldingstypes.
// Vervangt de vroegere stock-only implementatie.

import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import app, { db } from '../firebase';

const VAPID_KEY = import.meta.env.VITE_VAPID_KEY;

// Standaard alerts per rol — wat staat aan bij eerste registratie
const STANDAARD_ALERTS = {
  admin: {
    trainingen:          true,
    wedstrijden:         true,
    inschrijvingen:      true,
    examens:             true,
    graad:               true,
    trainerHerinnering:  true,
    stock:               true,
    clubBerichten:       true,
  },
  bestuurslid: {
    trainingen:          true,
    wedstrijden:         true,
    inschrijvingen:      true,
    examens:             true,
    graad:               true,
    trainerHerinnering:  true,
    stock:               true,
    clubBerichten:       true,
  },
  trainer: {
    trainingen:          true,
    wedstrijden:         true,
    inschrijvingen:      true,
    examens:             true,
    graad:               true,
    trainerHerinnering:  true,
    stock:               false,
    clubBerichten:       true,
  },
  lid: {
    trainingen:          true,
    wedstrijden:         true,
    inschrijvingen:      false,
    examens:             false,
    graad:               true,
    trainerHerinnering:  false,
    stock:               false,
    clubBerichten:       true,
  },
};

// Welke alerts zichtbaar zijn per rol in de UI
export const ALERTS_VOOR_ROL = {
  admin:       ['trainingen', 'wedstrijden', 'inschrijvingen', 'examens', 'graad', 'trainerHerinnering', 'stock', 'clubBerichten'],
  bestuurslid: ['trainingen', 'wedstrijden', 'inschrijvingen', 'examens', 'graad', 'trainerHerinnering', 'stock', 'clubBerichten'],
  trainer:     ['trainingen', 'wedstrijden', 'inschrijvingen', 'examens', 'graad', 'trainerHerinnering', 'clubBerichten'],
  lid:         ['trainingen', 'wedstrijden', 'graad', 'clubBerichten'],
};

export const ALERT_LABELS = {
  trainingen:         'Trainingen',
  wedstrijden:        'Wedstrijden',
  inschrijvingen:     'Inschrijvingen',
  examens:            'Examens',
  graad:              'Graad toegekend',
  trainerHerinnering: 'Trainer herinnering',
  stock:              'Stockmeldingen',
  clubBerichten:      'Clubberichten',
};

export const ALERT_SUBLABELS = {
  trainingen:         'Annulaties en verplaatsingen van trainingen',
  wedstrijden:        'Nieuwe tornooien, annulaties en wijzigingen',
  inschrijvingen:     'Nieuwe en bevestigde inschrijvingen',
  examens:            'Geplande examens en uitnodigingen',
  graad:              'Wanneer een judoka een nieuwe gordel behaalt',
  trainerHerinnering: 'Trainingen zonder ingevulde lesgever',
  stock:              'Producten op 0 of lage voorraad',
  clubBerichten:      'Algemene mededelingen van de club',
};

// ─── BROWSER CONTROLE ────────────────────────────────────────────────────────

export async function browserOndersteuntPush() {
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;
  return await isSupported();
}

// ─── FCM TOKEN OPHALEN ───────────────────────────────────────────────────────

async function getFcmToken() {
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error('Geen push-token ontvangen.');
  return token;
}

// ─── HOOFD-FUNCTIES ──────────────────────────────────────────────────────────

/**
 * Vraag toestemming, haal FCM token op en sla op in Firestore.
 * Bij eerste registratie: gebruik standaard alerts voor de rol.
 * Bij herregistratie: merge — overschrijf enkel de meegeleverde alerts.
 *
 * @param {object} profiel - { uid, naam, email, rol }
 * @param {object|null} alerts - optioneel: specifieke alerts om op te slaan
 * @returns {string} FCM token
 */
export async function registreerPushToken(profiel, alerts = null) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) throw new Error('Pushmeldingen worden niet ondersteund door deze browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Pushmeldingen zijn niet toegestaan.');

  const token = await getFcmToken();
  const tokenRef = doc(db, 'notificationTokens', token);
  const tokenSnap = await getDoc(tokenRef);
  const bestaand = tokenSnap.exists() ? tokenSnap.data() : null;

  // Bepaal alerts: meegegeven > bestaand in Firestore > standaard voor rol
  const rol = profiel?.rol || 'lid';
  const standaard = STANDAARD_ALERTS[rol] || STANDAARD_ALERTS.lid;
  const teSchrijvenAlerts = alerts || bestaand?.alerts || standaard;

  await setDoc(tokenRef, {
    uid:      profiel?.uid   || null,
    naam:     profiel?.naam  || null,
    email:    profiel?.email || null,
    rol,
    token,
    active:   true,
    platform: 'web',
    device:   navigator.userAgent.substring(0, 100),
    alerts:   teSchrijvenAlerts,
    // Backward compat: stockAlerts veld voor bestaande Cloud Function queries
    stockAlerts: teSchrijvenAlerts.stock === true,
    updatedAt: serverTimestamp(),
    ...(!bestaand ? { createdAt: serverTimestamp() } : {}),
  }, { merge: true });

  return token;
}

/**
 * Deactiveer push voor dit toestel.
 * Zet active: false maar behoudt de alerts-voorkeur.
 *
 * @param {object} profiel - { uid }
 */
export async function deactiveerPushToken(profiel) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return;

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);

    if (token) {
      await setDoc(doc(db, 'notificationTokens', token), {
        uid:        profiel?.uid || null,
        active:     false,
        stockAlerts: false,
        updatedAt:  serverTimestamp(),
      }, { merge: true });
    }
  } catch {
    // Stil falen — token kan al verlopen zijn
  }
}

/**
 * Controleer of dit profiel een actief push-token heeft.
 *
 * @param {string} uid
 * @returns {boolean}
 */
export async function heeftActievePushToken(uid) {
  if (!uid) return false;

  const q = query(
    collection(db, 'notificationTokens'),
    where('uid', '==', uid),
    where('active', '==', true)
  );
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * Laad de huidige alerts-instellingen voor een uid uit Firestore.
 * Geeft null terug als geen actief token gevonden.
 *
 * @param {string} uid
 * @param {string} rol - voor fallback standaard alerts
 * @returns {object|null} alerts object of null
 */
export async function laadPushAlerts(uid, rol = 'lid') {
  if (!uid) return null;

  const q = query(
    collection(db, 'notificationTokens'),
    where('uid', '==', uid),
    where('active', '==', true)
  );
  const snap = await getDocs(q);

  if (snap.empty) return null;

  // Neem het meest recente token (eerste resultaat)
  const data = snap.docs[0].data();
  return data.alerts || STANDAARD_ALERTS[rol] || STANDAARD_ALERTS.lid;
}

/**
 * Update enkel de alerts op alle actieve tokens van een uid.
 * Gebruikt na een toggle in DeviceInstellingen.
 *
 * @param {string} uid
 * @param {object} nieuweAlerts - volledig alerts object
 */
export async function updatePushAlerts(uid, nieuweAlerts) {
  if (!uid) return;

  const q = query(
    collection(db, 'notificationTokens'),
    where('uid', '==', uid),
    where('active', '==', true)
  );
  const snap = await getDocs(q);

  await Promise.all(snap.docs.map(d =>
    setDoc(d.ref, {
      alerts:      nieuweAlerts,
      stockAlerts: nieuweAlerts.stock === true, // backward compat
      updatedAt:   serverTimestamp(),
    }, { merge: true })
  ));
}

// ─── VOORGROND MELDINGEN ─────────────────────────────────────────────────────

/**
 * Luister naar push-berichten terwijl de app open is.
 * Roept callback aan met het volledige payload object.
 *
 * @param {function} onMelding - callback(payload)
 * @returns {function} unsubscribe functie
 */
export async function registreerVoorgrondMeldingen(onMelding) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return () => {};

  const messaging = getMessaging(app);
  return onMessage(messaging, payload => {
    if (typeof onMelding === 'function') {
      onMelding(payload);
    }
  });
}

// ─── BACKWARD COMPAT EXPORTS ─────────────────────────────────────────────────
// Bewaard zodat bestaande imports in DeviceInstellingen en Winkel niet breken
// totdat die bestanden bijgewerkt worden in stap 2.

export async function vraagStockPushToestemming(profiel) {
  return registreerPushToken(profiel, null);
}

export async function stopStockPushMeldingen(profiel) {
  return deactiveerPushToken(profiel);
}

export async function heeftActieveStockPush(uid) {
  return heeftActievePushToken(uid);
}

export async function registreerVoorgrondStockMeldingen(onStockAlert) {
  return registreerVoorgrondMeldingen(payload => {
    const data = payload?.data || {};
    if (data.type === 'stock_zero' && typeof onStockAlert === 'function') {
      onStockAlert(payload);
    }
  });
}
