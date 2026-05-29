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
  limit,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { COLLECTIONS } from '../config/appConfig';
import { bouwZoekPrefixes } from '../utils/ledenKoppeling';

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

// ─── AANWEZIGHEID ────────────────────────────────────────────────────────────
// Aanwezigheid wordt opgeslagen als members/{lidId}/attendance/{trainingId}.
// Doc bestaat = aanwezig (consistent met de telling in Rapporten via snap.size).

export async function registreerAanwezigheid(memberId, training) {
  const trainingId = training.id;
  await setDoc(doc(db, COLLECTIONS.MEMBERS, memberId, 'attendance', trainingId), {
    date: training.datum,
    trainingId,
    trainingGroup: training.groepNaam || training.groepId || '',
    aanwezig: true,
    geregistreerdOp: serverTimestamp(),
    geregistreerdDoor: currentUid(),
  });
}

export async function verwijderAanwezigheid(memberId, trainingId) {
  await deleteDoc(doc(db, COLLECTIONS.MEMBERS, memberId, 'attendance', trainingId));
}

// Haal aanwezigheidsstatus van een set leden voor één training op.
// Returns Set van memberIds die aanwezig zijn.
export async function getAanwezigeLeden(memberIds, trainingId) {
  const checks = memberIds.map(async (mid) => {
    const snap = await getDoc(doc(db, COLLECTIONS.MEMBERS, mid, 'attendance', trainingId));
    return snap.exists() ? mid : null;
  });
  const resultaten = await Promise.all(checks);
  return new Set(resultaten.filter(Boolean));
}


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

// Zorg dat er een lesgever-record bestaat dat aan dit user-account (uid) hangt.
// Gebruikt bij het toekennen van de rol 'assistent', zodat de assistent meteen
// een lesgeverId heeft (voor trainingen-koppeling en uitbetaling). Idempotent:
// bestaat er al een lesgever met deze uid, dan gebeurt er niets.
export async function ensureLesgeverVoorUser(uid, naam, type) {
  if (!uid) return null;
  const snap = await getDocs(query(collection(db, COLLECTIONS.LESGEVERS), where('uid', '==', uid)));
  if (!snap.empty) return snap.docs[0].id;
  const ref = await addDoc(collection(db, COLLECTIONS.LESGEVERS), {
    naam: naam || '',
    uid,
    type: type || null,
    actief: true,
    aangemaakt: new Date().toISOString(),
  });
  return ref.id;
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

// Markeer of een groep een assistent nodig heeft. Stuurt de reminder "geen
// assistent" enkel voor groepen waar dit aan staat.
export async function updateGroepAssistentNodig(groepId, assistentNodig) {
  await setDoc(doc(db, COLLECTIONS.GROEPEN, groepId), { assistentNodig: !!assistentNodig, bijgewerkt: serverTimestamp() }, { merge: true });
}

// Markeer of een groep de provinciale kalender volgt. Enkel voor zulke groepen
// betekenen labels als "prov. training" of "tornooi" dat er geen gewone training
// is; andere groepen blijven dan gewoon doorgaan.
export async function updateGroepProvincialeKalender(groepId, volgtProvincialeKalender) {
  await setDoc(doc(db, COLLECTIONS.GROEPEN, groepId), { volgtProvincialeKalender: !!volgtProvincialeKalender, bijgewerkt: serverTimestamp() }, { merge: true });
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

// "Harde" markers: deze betekenen voor ELKE groep dat er geen gewone training is.
export const DEFAULT_GEEN_TRAINING_MARKERS = [
  'geen training',
  'vakantie',
  'sporthal gesloten',
  'ceremonie',
];

// "Provinciale" markers: deze betekenen enkel "geen training" voor groepen die de
// provinciale kalender volgen (bv. U13+). Voor andere groepen (bv. Groep 2&3)
// gaat de gewone training gewoon door, ook al staat dit in de opmerking.
export const DEFAULT_PROVINCIALE_MARKERS = [
  'prov. training',
  'provinciale training',
  'judoweekend',
  'tornooi',
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

// Provinciale markers uit settings (met fallback op de defaults).
export function markersProvinciaalUitSettings(settings) {
  const lijst = Array.isArray(settings?.trainingProvincialeMarkers)
    ? settings.trainingProvincialeMarkers.map(x => String(x || '').trim()).filter(Boolean)
    : [];
  const opgeschoond = Array.from(new Map(lijst.map(x => [x.toLowerCase(), x])).values());
  return opgeschoond.length ? opgeschoond : DEFAULT_PROVINCIALE_MARKERS;
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

export async function laadProvincialeMarkers() {
  const settings = await getClubSettings();
  return markersProvinciaalUitSettings(settings || {});
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

// ── Evenement-inschrijvingen ──────────────────────────────────────────────
// Inschrijvingen voor clubevenementen leven in evenementen/{id}/registrations.
// De document-id is het memberId, zodat een lid maar één (idempotente)
// inschrijving heeft en die makkelijk op te halen/te verwijderen is. De
// Firestore-regels laten een gekoppeld lid enkel zijn eigen inschrijving
// beheren; beheer mag voor iedereen in-/uitschrijven.
export function subscribeEvenementRegistrations(evenementId, callback) {
  const ref = collection(db, COLLECTIONS.EVENEMENTEN, evenementId, 'registrations');
  return onSnapshot(ref, snap => {
    const lijst = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => String(a.naam || '').localeCompare(String(b.naam || '')));
    callback(lijst);
  });
}

export async function getEvenementRegistration(evenementId, memberId) {
  const snap = await getDoc(doc(db, COLLECTIONS.EVENEMENTEN, evenementId, 'registrations', memberId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function setEvenementRegistration(evenementId, memberId, data) {
  await setDoc(
    doc(db, COLLECTIONS.EVENEMENTEN, evenementId, 'registrations', memberId),
    { ...data, memberId, ingeschrevenOp: serverTimestamp(), doorUid: currentUid() },
    { merge: true },
  );
}

export async function verwijderEvenementRegistration(evenementId, memberId) {
  await deleteDoc(doc(db, COLLECTIONS.EVENEMENTEN, evenementId, 'registrations', memberId));
}

export async function getMembers() {
  const snap = await getDocs(collection(db, COLLECTIONS.MEMBERS));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Echte prefix-zoek op naam, op ELK naamwoord (voor- én achternaam),
// case-insensitief. Schaalbaar: één geïndexeerde array-contains-query op
// `zoekPrefixes` leest enkel de matchende leden. Bij meerdere woorden wordt op
// het langste woord gequeried en daarna client-side verfijnd op de volledige term.
// Vereist `zoekPrefixes` op leden (gezet bij aanmaken/bewerken + migratie).
export async function zoekLedenOpNaam(term, max = 25) {
  const t = (term || '').trim().toLowerCase();
  if (t.length < 2) return [];
  const woorden = t.split(/\s+/).filter(Boolean);
  const langste = woorden.reduce((a, b) => (b.length > a.length ? b : a), '');
  const q = query(
    collection(db, COLLECTIONS.MEMBERS),
    where('zoekPrefixes', 'array-contains', langste),
    limit(max * 2),
  );
  const snap = await getDocs(q);
  let res = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => m.actief !== false && m.active !== false);
  if (woorden.length > 1) {
    res = res.filter(m => String(m.naamLower || m.naam || '').toLowerCase().includes(t));
  }
  return res
    .sort((a, b) => String(a.naam || '').localeCompare(b.naam || ''))
    .slice(0, max);
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
      const naamRaw = String(chunk[j].naam || chunk[j].name || '');
      batch.set(ref, {
        ...chunk[j],
        naamLower: naamRaw.trim().toLowerCase(),
        zoekPrefixes: bouwZoekPrefixes(naamRaw),
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

// Koppel een lid en een user-account aan elkaar op basis van e-mail. Zet
// linkedUserId op het lid (mag beheerder/trainer) en linkedMemberId op de user
// (lukt enkel voor een admin; anders vult de login-autokoppeling dit later aan).
// Geeft de gekoppelde uid terug, of null als er geen (uniek) account is.
export async function koppelLidEnUserViaEmail(memberId, email) {
  if (!memberId || !email) return null;
  const user = await getUserByEmail(email);
  if (!user) return null;
  try {
    await updateDoc(doc(db, COLLECTIONS.MEMBERS, memberId), {
      linkedUserId: user.uid, updatedAt: serverTimestamp(), updatedBy: currentUid(),
    });
  } catch { /* member-update niet toegestaan voor dit account */ }
  try {
    await linkUserToMember(user.uid, memberId);
  } catch { /* user-doc enkel door admin schrijfbaar — login vult dit later aan */ }
  return user.uid;
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

// --- KALENDER TRIGGERS ---
// Schrijft naar pushTriggers (Pad B). verwerkPushTrigger verwerkt push + mail.
// Het mail-blok bevat de diff en config-sleutel zodat de CF de HTML kan opbouwen.
export async function addKalenderTrigger({ seizoen, seizoenLabel, toegevoegd, bijgewerkt, verwijderd }) {
  await addDoc(collection(db, COLLECTIONS.PUSH_TRIGGERS), {
    type: 'kalender_overzicht',
    payload: {
      seizoenLabel: seizoenLabel || seizoen || '',
      aantalNieuw: String((toegevoegd || []).length),
      aantalVerwijderd: String((verwijderd || []).length),
    },
    mail: {
      templateKey: 'kalender-overzicht',
      configPad: 'wedstrijdMeldingen',
      seizoen: seizoen || '',
      seizoenLabel: seizoenLabel || seizoen || '',
      toegevoegd: toegevoegd || [],
      bijgewerkt: bijgewerkt || [],
      verwijderd: verwijderd || [],
    },
    aangemaakt: serverTimestamp(),
    verwerkt: false,
  });
}
