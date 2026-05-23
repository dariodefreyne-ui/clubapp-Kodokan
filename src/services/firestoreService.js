/**
 * firestoreService.js — Kodokan Clubapp
 * Centrale data-laag voor Firestore-operaties.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS } from '../config/appConfig';

function currentUid() {
  return auth.currentUser?.uid ?? null;
}

// ─── AUDIT WRAPPERS ──────────────────────────────────────────────────────────
// Wrappers rond updateDoc/setDoc die automatisch updatedAt + updatedBy toevoegen.
// Gebruik in plaats van rauwe Firestore-calls voor automatische audit-coverage.

/**
 * Update een document met automatische updatedAt/updatedBy.
 * @param {DocumentReference} ref - Firestore document reference
 * @param {object} data - velden om bij te werken (mag updatedAt/updatedBy NIET bevatten)
 */
export async function updateMetAudit(ref, data) {
  return updateDoc(ref, { ...data, updatedAt: serverTimestamp(), updatedBy: currentUid() });
}

/**
 * setDoc met merge en automatische updatedAt/updatedBy.
 */
export async function setMetAudit(ref, data, options = { merge: true }) {
  return setDoc(ref, { ...data, updatedAt: serverTimestamp(), updatedBy: currentUid() }, options);
}

// ─── USERS ───────────────────────────────────────────────────────────────────
export async function getAllUsers() {
  const snap = await getDocs(collection(db, COLLECTIONS.USERS));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function updateUserRol(uid, nieuweRol) {
  await setDoc(doc(db, COLLECTIONS.USERS, uid), {
    rol: nieuweRol,
    bijgewerkt: serverTimestamp(),
    updatedBy: currentUid(),
  }, { merge: true });
}

// ─── LESGEVERS ────────────────────────────────────────────────────────────────
export async function getAllLesgevers() {
  const snap = await getDocs(collection(db, COLLECTIONS.LESGEVERS));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.naam.localeCompare(b.naam));
}

export async function setLesgever(id, data) {
  await setDoc(doc(db, COLLECTIONS.LESGEVERS, id), data, { merge: true });
}

export async function updateLesgever(id, veld, waarde) {
  await setDoc(doc(db, COLLECTIONS.LESGEVERS, id), { [veld]: waarde, bijgewerkt: serverTimestamp() }, { merge: true });
}

// ─── GROEPEN ─────────────────────────────────────────────────────────────────
export async function getAllGroepen() {
  const snap = await getDocs(collection(db, COLLECTIONS.GROEPEN));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateGroepDuur(groepId, duurMinuten) {
  await setDoc(doc(db, COLLECTIONS.GROEPEN, groepId), { duurMinuten, bijgewerkt: serverTimestamp() }, { merge: true });
}

export async function updateGroepCategorieen(groepId, categorieen) {
  await setDoc(doc(db, COLLECTIONS.GROEPEN, groepId), { categorieen, bijgewerkt: serverTimestamp() }, { merge: true });
}

// Bereken duur in minuten uit HH:MM start en eind. Retourneert null bij ongeldige input.
export function berekenDuurMinuten(startTijd, eindTijd) {
  if (!startTijd || !eindTijd) return null;
  const [sh, sm] = startTijd.split(':').map(Number);
  const [eh, em] = eindTijd.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return null;
  const startMin = sh * 60 + sm;
  const eindMin = eh * 60 + em;
  const diff = eindMin - startMin;
  return diff > 0 ? diff : null;
}

// Format minuten naar leesbare string. 60 -> '1u', 90 -> '1u30min', 45 -> '45min'.
export function formatDuur(duurMinuten) {
  if (!duurMinuten || duurMinuten <= 0) return '';
  if (duurMinuten >= 60) {
    const u = Math.floor(duurMinuten / 60);
    const m = duurMinuten % 60;
    return m ? `${u}u${m}min` : `${u}u`;
  }
  return `${duurMinuten}min`;
}

// Update groep met klokuren en herberekende duur. Retourneert false bij ongeldige input.
export async function updateGroepTijden(groepId, startTijd, eindTijd) {
  const duur = berekenDuurMinuten(startTijd, eindTijd);
  if (duur === null) return false;
  await setDoc(doc(db, COLLECTIONS.GROEPEN, groepId), {
    startTijd, eindTijd, duurMinuten: duur, bijgewerkt: serverTimestamp(),
  }, { merge: true });
  return true;
}

// ─── TECHNIEKEN ───────────────────────────────────────────────────────────────
export async function getAllTechnieken() {
  const snap = await getDocs(collection(db, COLLECTIONS.TECHNIEKEN));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── TRAININGEN ───────────────────────────────────────────────────────────────
export async function getTrainingenBySeizoenEnGroep(seizoen, groepId) {
  const q = query(
    collection(db, COLLECTIONS.TRAININGEN),
    where('seizoen', '==', seizoen),
    where('groepId', '==', groepId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteTrainingMetTechnieken(trainingId) {
  const techSnap = await getDocs(collection(db, COLLECTIONS.TRAININGEN, trainingId, 'technieken'));
  for (const d of techSnap.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, COLLECTIONS.TRAININGEN, trainingId));
}

export function subscribeTrainingenBySeizoen(seizoen, groepId, callback) {
  const constraints = [where('seizoen', '==', seizoen)];
  if (groepId) constraints.push(where('groepId', '==', groepId));
  constraints.push(orderBy('datum', 'asc'));
  const q = query(collection(db, COLLECTIONS.TRAININGEN), ...constraints);
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── INSTELLINGEN ─────────────────────────────────────────────────────────────
export async function getPaginaRollen() {
  const snap = await getDoc(doc(db, COLLECTIONS.INSTELLINGEN, 'paginaRollen'));
  return snap.exists() ? snap.data() : null;
}

export async function setPaginaRollen(config) {
  await setDoc(doc(db, COLLECTIONS.INSTELLINGEN, 'paginaRollen'), config, { merge: true });
}

export async function getMeldingInstellingen() {
  const snap = await getDoc(doc(db, COLLECTIONS.INSTELLINGEN, 'meldingen'));
  return snap.exists() ? snap.data() : null;
}

export async function setMeldingInstellingen(data) {
  await setDoc(doc(db, COLLECTIONS.INSTELLINGEN, 'meldingen'), data, { merge: true });
}

// ─── CLUB SETTINGS ────────────────────────────────────────────────────────────
export async function getClubSettings() {
  const snap = await getDoc(doc(db, COLLECTIONS.SETTINGS, 'club'));
  return snap.exists() ? snap.data() : null;
}

export async function setClubSettings(data) {
  await setDoc(doc(db, COLLECTIONS.SETTINGS, 'club'), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── GEEN-TRAINING MARKERS ───────────────────────────────────────────────────

export const DEFAULT_GEEN_TRAINING_MARKERS = [
  'geen training',
  'prov. training',
  'provinciale training',
  'judoweekend',
  'tornooi',
  'vakantie',
  'sporthal gesloten',
  'ceremonie',
];

export function normaliseerGeenTrainingMarkers(bronLijst) {
  const opgeschoond = Array.from(
    new Map(
      (Array.isArray(bronLijst) ? bronLijst : [])
        .map(x => String(x || '').trim())
        .filter(Boolean)
        .map(x => [x.toLowerCase(), x])
    ).values()
  );
  return opgeschoond.length ? opgeschoond : DEFAULT_GEEN_TRAINING_MARKERS;
}

export function markersUitSettings(settings) {
  const centraleMarkers = Array.isArray(settings?.trainingGeenTrainingMarkers)
    ? settings.trainingGeenTrainingMarkers
    : [];
  const legacyMarkers = [
    settings?.geenTrainingMarker,
    settings?.geenTrainingTekst,
    settings?.geenTrainingMarkers,
    settings?.trainerReminder?.uitsluitZin,
  ].filter(Boolean);
  return normaliseerGeenTrainingMarkers([...centraleMarkers, ...legacyMarkers]);
}

export function isGeenTrainingTekst(tekst, markers) {
  if (!tekst) return false;
  const l = String(tekst).toLowerCase().trim();
  return normaliseerGeenTrainingMarkers(markers).some(m =>
    l.includes(String(m || '').toLowerCase())
  );
}

export async function laadGeenTrainingMarkers() {
  const settings = await getClubSettings();
  return markersUitSettings(settings || {});
}

// ─── NOTIFICATION TOKENS ──────────────────────────────────────────────────────
export async function getNotificationTokens() {
  const snap = await getDocs(query(collection(db, COLLECTIONS.NOTIFICATION_TOKENS), orderBy('updatedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deactiveerNotificationToken(tokenId) {
  await setDoc(doc(db, COLLECTIONS.NOTIFICATION_TOKENS, tokenId), { active: false, updatedAt: serverTimestamp() }, { merge: true });
}

// ─── TRAINER REMINDERS ────────────────────────────────────────────────────────
export async function addTrainerReminderTrigger(data) {
  await addDoc(collection(db, COLLECTIONS.TRAINER_REMINDER_TRIGGERS), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// ─── MAIL ────────────────────────────────────────────────────────────────────
export async function sendMail(mailData) {
  await addDoc(collection(db, COLLECTIONS.MAIL), mailData);
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────
export async function getAllProducts() {
  const snap = await getDocs(collection(db, COLLECTIONS.PRODUCTS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── EVENTS (Examens) ─────────────────────────────────────────────────────────
export function subscribeEvents(callback) {
  const q = query(collection(db, COLLECTIONS.EVENTS), orderBy('date', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addEvent(data) {
  return await addDoc(collection(db, COLLECTIONS.EVENTS), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export function subscribeEventRegistrations(eventId, callback) {
  const q = query(collection(db, COLLECTIONS.EVENTS, eventId, 'registrations'), orderBy('createdAt'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeEventDocuments(eventId, callback) {
  const q = query(collection(db, COLLECTIONS.EVENTS, eventId, 'documents'), orderBy('uploadedAt', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addRegistration(eventId, data) {
  await addDoc(collection(db, COLLECTIONS.EVENTS, eventId, 'registrations'), data);
}

export async function updateRegistration(eventId, registrationId, data) {
  await updateDoc(doc(db, COLLECTIONS.EVENTS, eventId, 'registrations', registrationId), data);
}

export async function addEventDocument(eventId, data) {
  await addDoc(collection(db, COLLECTIONS.EVENTS, eventId, 'documents'), data);
}

export async function getMembers() {
  const snap = await getDocs(collection(db, COLLECTIONS.MEMBERS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getMemberById(memberId) {
  const snap = await getDoc(doc(db, COLLECTIONS.MEMBERS, memberId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function updateMember(memberId, data) {
  await updateDoc(doc(db, COLLECTIONS.MEMBERS, memberId), {
    ...data,
    updatedAt: serverTimestamp(),
    updatedBy: currentUid(),
  });
}

export async function updateMemberProfile(memberId, editableFields) {
  const allowed = ['email', 'telefoon', 'medischeInfo', 'noodcontactNaam', 'noodcontactTelefoon'];
  const filtered = Object.fromEntries(
    Object.entries(editableFields).filter(([k]) => allowed.includes(k))
  );
  await updateDoc(doc(db, COLLECTIONS.MEMBERS, memberId), { ...filtered, updatedAt: serverTimestamp(), updatedBy: currentUid() });
}

// Importeert leden atomair via writeBatch (max 499 per batch).
// Geeft een array van gegenereerde document-IDs terug.
export async function bulkImportMembers(membersArray, onProgress) {
  const BATCH_SIZE = 499;
  const ids = [];
  const uid = currentUid();

  for (let i = 0; i < membersArray.length; i += BATCH_SIZE) {
    const chunk = membersArray.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    const refs = chunk.map(() => doc(collection(db, COLLECTIONS.MEMBERS)));

    refs.forEach((ref, j) => {
      batch.set(ref, {
        ...chunk[j],
        aangemaaktOp: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: uid,
      });
    });

    await batch.commit();
    refs.forEach(ref => ids.push(ref.id));
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, membersArray.length), membersArray.length);
  }

  return ids;
}

export async function getUserByEmail(email) {
  if (!email) return null;
  const q = query(collection(db, COLLECTIONS.USERS), where('email', '==', email.trim().toLowerCase()));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() };
}

export async function linkUserToMember(uid, memberId) {
  await setDoc(doc(db, COLLECTIONS.USERS, uid), { linkedMemberId: memberId, bijgewerkt: serverTimestamp(), updatedBy: currentUid() }, { merge: true });
}

// ─── CONFIGUREERBARE LIJSTEN (categorieen, gordels, lesgeverTypes, ...) ──────
// Generieke CRUD voor config-collecties die via Beheer > Instellingen beheerd worden.

export async function getConfigLijst(collectienaam) {
  try {
    const q = query(collection(db, collectienaam), orderBy('volgorde', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, collectienaam));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
}

export function subscribeConfigLijst(collectienaam, callback) {
  const q = query(collection(db, collectienaam), orderBy('volgorde', 'asc'));
  const unsub = onSnapshot(q, snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
    () => {
      // Fallback zonder orderBy als de index nog niet bestaat
      onSnapshot(collection(db, collectienaam),
        snap => callback(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  );
  return unsub;
}

export async function setConfigItem(collectienaam, id, data) {
  const ref = id
    ? doc(db, collectienaam, id)
    : doc(collection(db, collectienaam));
  await setDoc(ref, { ...data, updatedAt: serverTimestamp(), updatedBy: currentUid() }, { merge: true });
  return ref.id;
}

export async function deleteConfigItem(collectienaam, id) {
  await deleteDoc(doc(db, collectienaam, id));
}

// Bulk-seed: schrijf een array defaults naar een config-collectie als die nog leeg is.
// Returns aantal toegevoegde docs (0 als collectie al gevuld was).
export async function seedConfigLijst(collectienaam, defaults) {
  const bestaand = await getDocs(collection(db, collectienaam));
  if (!bestaand.empty) return 0;
  const uid = currentUid();
  const batch = writeBatch(db);
  defaults.forEach(item => {
    const ref = doc(collection(db, collectienaam));
    batch.set(ref, { ...item, updatedAt: serverTimestamp(), updatedBy: uid });
  });
  await batch.commit();
  return defaults.length;
}

// ─── PUSH TRIGGERS ───────────────────────────────────────────────────────────
export async function addPushTrigger(type, payload) {
  await addDoc(collection(db, COLLECTIONS.PUSH_TRIGGERS), {
    type,
    payload: payload || {},
    aangemaakt: serverTimestamp(),
    verwerkt: false,
  });
}
