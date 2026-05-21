// src/notifications/firebaseMessaging.js
// Push-registratie en voorkeurenbeheer voor alle rollen en meldingstypes.
//
// Voorkeurenmodel (hybride):
//  - users/{uid}.notificatieVoorkeuren  → primair, per gebruiker
//  - notificationTokens/{token}.alertsOverride → optioneel per toestel
//
// Effectieve regel:
//   override?.[rubriek] !== undefined
//     ? override[rubriek]
//     : voorkeuren[rubriek].actief

import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteField,
} from 'firebase/firestore';
import app, { db } from '../firebase';
import { RUBRIEKEN, standaardVoorkeurenVoorRol } from './notificationCategories';

const VAPID_KEY = import.meta.env.VITE_VAPID_KEY;

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'web';
}

// Re-export voor componenten (DRY: één bron voor labels)
export { RUBRIEKEN, rubriekenVoorRol, standaardVoorkeurenVoorRol } from './notificationCategories';

// ─── BROWSER CONTROLE ────────────────────────────────────────────────────────

export async function browserOndersteuntPush() {
  if (!('Notification' in window)) return false;
  if (!('serviceWorker' in navigator)) return false;
  return await isSupported();
}

// ─── FCM TOKEN OPHALEN ───────────────────────────────────────────────────────

async function getFcmToken() {
  if (!VAPID_KEY) {
    throw new Error('VAPID_KEY ontbreekt — controleer VITE_VAPID_KEY in .env.local.');
  }
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
 * Initialiseert tegelijk de gebruikersvoorkeuren met defaults voor zijn rol
 * als die nog niet bestaan.
 *
 * @param {object} profiel - { uid, naam, email, rol }
 * @returns {string} FCM token
 */
export async function registreerPushToken(profiel) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) throw new Error('Pushmeldingen worden niet ondersteund door deze browser.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Pushmeldingen zijn niet toegestaan.');

  const token = await getFcmToken();
  const tokenRef = doc(db, 'notificationTokens', token);
  const tokenSnap = await getDoc(tokenRef);
  const bestaand = tokenSnap.exists() ? tokenSnap.data() : null;

  await setDoc(tokenRef, {
    uid:      profiel?.uid   || null,
    naam:     profiel?.naam  || null,
    email:    profiel?.email || null,
    rol:      profiel?.rol   || 'lid',
    token,
    active:   true,
    platform: detectPlatform(),
    device:   navigator.userAgent.substring(0, 100),
    // alertsOverride wordt enkel ingevuld als gebruiker per-toestel afwijkt.
    // Standaard volgt token de account-voorkeuren.
    updatedAt: serverTimestamp(),
    ...(!bestaand ? { createdAt: serverTimestamp() } : {}),
  }, { merge: true });

  // Initialiseer voorkeuren op de gebruiker als ze nog niet bestaan
  if (profiel?.uid) {
    await initialiseerVoorkeurenIndienNodig(profiel.uid, profiel.rol);
  }

  return token;
}

/**
 * Deactiveer push voor dit toestel. Behoudt alertsOverride voor toekomstige
 * heractivering.
 */
export async function deactiveerPushToken() {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return;

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
    if (!token) return;

    await setDoc(doc(db, 'notificationTokens', token), {
      active:    false,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch {
    // Stil falen — token kan al verlopen zijn
  }
}

/**
 * Controleer of dit profiel een actief push-token heeft.
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

// ─── VOORKEUREN OP USER-NIVEAU ───────────────────────────────────────────────

/**
 * Laad de notificatieVoorkeuren van een gebruiker uit Firestore.
 * Initialiseert defaults als geen voorkeuren bestaan.
 */
export async function laadVoorkeuren(uid, rol = 'lid') {
  if (!uid) return standaardVoorkeurenVoorRol(rol);

  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const bestaand = snap.exists() ? snap.data().notificatieVoorkeuren : null;

  if (bestaand && Object.keys(bestaand).length > 0) {
    // Vul aan met defaults voor rubrieken die ondertussen toegevoegd zijn
    const defaults = standaardVoorkeurenVoorRol(rol);
    return { ...defaults, ...bestaand };
  }

  return standaardVoorkeurenVoorRol(rol);
}

/**
 * Schrijf de volledige voorkeuren-object weg.
 */
export async function slaVoorkeurenOp(uid, voorkeuren) {
  if (!uid) return;
  await updateDoc(doc(db, 'users', uid), {
    notificatieVoorkeuren: voorkeuren,
    voorkeurenBijgewerktOp: serverTimestamp(),
  });
}

async function initialiseerVoorkeurenIndienNodig(uid, rol) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const bestaand = snap.exists() ? snap.data().notificatieVoorkeuren : null;
  if (bestaand && Object.keys(bestaand).length > 0) return;

  const defaults = standaardVoorkeurenVoorRol(rol || 'lid');
  await setDoc(userRef, {
    notificatieVoorkeuren: defaults,
    voorkeurenBijgewerktOp: serverTimestamp(),
  }, { merge: true });
}

// ─── OVERRIDE OP TOKEN-NIVEAU ────────────────────────────────────────────────

/**
 * Laad de per-toestel overrides voor het huidige FCM-token.
 */
export async function laadTokenOverride() {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return {};

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
    if (!token) return {};
    const snap = await getDoc(doc(db, 'notificationTokens', token));
    return snap.exists() ? (snap.data().alertsOverride || {}) : {};
  } catch {
    return {};
  }
}

/**
 * Zet een per-toestel override voor één rubriek.
 *   waarde = true|false → expliciete override
 *   waarde = null       → override verwijderen, volgt voortaan account
 */
export async function zetTokenOverride(rubriek, waarde) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: VAPID_KEY }).catch(() => null);
  if (!token) return;

  const tokenRef = doc(db, 'notificationTokens', token);

  if (waarde === null || waarde === undefined) {
    await updateDoc(tokenRef, {
      [`alertsOverride.${rubriek}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(tokenRef, {
      alertsOverride: { [rubriek]: !!waarde },
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }
}

/**
 * Bereken effectief aan/uit per rubriek (voor UI weergave).
 *   {[rubriek]: { actief: bool, bron: 'account'|'apparaat' }}
 */
export function bereckenEffectief(voorkeuren = {}, override = {}) {
  const resultaat = {};
  for (const rubriek of Object.keys(RUBRIEKEN)) {
    if (override[rubriek] !== undefined) {
      resultaat[rubriek] = { actief: !!override[rubriek], bron: 'apparaat' };
    } else {
      resultaat[rubriek] = { actief: voorkeuren[rubriek]?.actief !== false, bron: 'account' };
    }
  }
  return resultaat;
}

// ─── VOORGROND MELDINGEN ─────────────────────────────────────────────────────

export async function registreerVoorgrondMeldingen(onMelding) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return () => {};

  const messaging = getMessaging(app);
  return onMessage(messaging, payload => {
    if (typeof onMelding === 'function') onMelding(payload);
  });
}

