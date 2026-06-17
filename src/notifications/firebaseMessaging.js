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
  writeBatch,
} from 'firebase/firestore';
import app, { db } from '../firebase';
import { RUBRIEKEN, standaardVoorkeurenVoorRol } from './notificationCategories';
import { CLUB_STORAGE_PREFIX } from '../config/appConfig';

const VAPID_KEY = import.meta.env.VITE_VAPID_KEY;
const HANDMATIG_UIT_KEY = `${CLUB_STORAGE_PREFIX}_push_handmatig_uit`;

// Onthoudt of de gebruiker pushmeldingen zelf via Instellingen heeft
// uitgezet. Zonder dit zou het zelfherstel in App.jsx (dat bij elke
// login/app-herstart automatisch herregistreert zolang de OS-permissie
// 'granted' is) een bewuste keuze van de gebruiker meteen weer ongedaan
// maken bij de volgende app-start.
export function isPushHandmatigUitgeschakeld() {
  try {
    return localStorage.getItem(HANDMATIG_UIT_KEY) === '1';
  } catch {
    return false;
  }
}

export function zetPushHandmatigUitgeschakeld(uit) {
  try {
    if (uit) localStorage.setItem(HANDMATIG_UIT_KEY, '1');
    else localStorage.removeItem(HANDMATIG_UIT_KEY);
  } catch {
    // localStorage niet beschikbaar — geen blokkerend probleem
  }
}

// Lazy initialisatie — voorkomt dat firebase/messaging opgestart wordt voor
// gebruikers die nooit push-permissie geven.
let _messaging = null;
function getMessagingInstance() {
  if (!_messaging) _messaging = getMessaging(app);
  return _messaging;
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
  // Gebruik de al door main.jsx geregistreerde SW (/sw.js) via serviceWorker.ready.
  // Geen dubbele registratie nodig — strikt vereist omdat er slechts één SW is.
  const registration = await navigator.serviceWorker.ready;
  const messaging = getMessagingInstance();
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

  // Deactiveer andere actieve tokens van dezelfde gebruiker zodat er nooit
  // meerdere actieve tokens per persoon zijn (voorkomt dubbele push-meldingen).
  if (profiel?.uid) {
    try {
      const oudeTokens = await getDocs(query(
        collection(db, 'notificationTokens'),
        where('uid', '==', profiel.uid),
        where('active', '==', true)
      ));
      const batch = writeBatch(db);
      let heeftWijzigingen = false;
      oudeTokens.forEach(d => {
        if (d.id !== token) {
          batch.update(d.ref, { active: false, updatedAt: serverTimestamp() });
          heeftWijzigingen = true;
        }
      });
      if (heeftWijzigingen) await batch.commit();
    } catch {
      // Stil falen — deduplicatie is best-effort, niet kritiek
    }
  }

  await setDoc(tokenRef, {
    uid:      profiel?.uid   || null,
    naam:     profiel?.naam  || null,
    email:    profiel?.email || null,
    rol:      profiel?.rol   || 'lid',
    token,
    active:   true,
    platform: 'web',
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
 *
 * @param {string} uid - Vereist door de Firestore-rules: als dit token nog
 *   geen document heeft (bv. na een VAPID-key-wissel waarbij een nieuw token
 *   is uitgegeven), behandelt Firestore deze setDoc als een create, en die
 *   regel vereist een matchende uid — zonder uid hier krijg je "Missing or
 *   insufficient permissions".
 */
export async function deactiveerPushToken(uid) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) return;

  const token = await getFcmToken().catch(() => null);
  if (!token) return;

  await setDoc(doc(db, 'notificationTokens', token), {
    uid:       uid || null,
    active:    false,
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Deactiveer ook eventuele andere actieve tokens van deze gebruiker.
  // Zonder dit kan een verweesd token van vóór een VAPID-key-rotatie/PWA-
  // herinstallatie actief blijven staan, waardoor heeftActievePushToken() bij
  // het volgende paginabezoek alsnog 'aan' rapporteert — precies het toestel
  // dat je net had uitgezet lijkt dan zichzelf weer aan te zetten.
  if (uid) {
    try {
      const overige = await getDocs(query(
        collection(db, 'notificationTokens'),
        where('uid', '==', uid),
        where('active', '==', true)
      ));
      const batch = writeBatch(db);
      let heeftWijzigingen = false;
      overige.forEach(d => {
        if (d.id !== token) {
          batch.update(d.ref, { active: false, updatedAt: serverTimestamp() });
          heeftWijzigingen = true;
        }
      });
      if (heeftWijzigingen) await batch.commit();
    } catch {
      // Best-effort opruiming — niet kritiek voor de hoofdactie
    }
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

  const token = await getFcmToken().catch(() => null);
  if (!token) return {};
  const snap = await getDoc(doc(db, 'notificationTokens', token));
  return snap.exists() ? (snap.data().alertsOverride || {}) : {};
}

/**
 * Zet een per-toestel override voor één rubriek.
 *   waarde = true|false → expliciete override
 *   waarde = null       → override verwijderen, volgt voortaan account
 *
 * @param {string} uid - Vereist door de Firestore-rules, zie deactiveerPushToken().
 */
export async function zetTokenOverride(rubriek, waarde, uid) {
  const ondersteund = await browserOndersteuntPush();
  if (!ondersteund) throw new Error('Pushmeldingen worden niet ondersteund door deze browser.');

  const token = await getFcmToken();

  const tokenRef = doc(db, 'notificationTokens', token);
  const snap = await getDoc(tokenRef);

  if (waarde === null || waarde === undefined) {
    if (!snap.exists()) return; // niets te verwijderen
    await updateDoc(tokenRef, {
      [`alertsOverride.${rubriek}`]: deleteField(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(tokenRef, {
      uid:            snap.exists() ? snap.data().uid : (uid || null),
      alertsOverride: { [rubriek]: !!waarde },
      updatedAt:      serverTimestamp(),
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

  const messaging = getMessagingInstance();
  return onMessage(messaging, payload => {
    if (typeof onMelding === 'function') onMelding(payload);
  });
}

