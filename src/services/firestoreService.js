/**
 * firestoreService.js — Kodokan Clubapp
 *
 * Centrale data-laag voor alle Firestore-operaties.
 * Componenten importeren functies uit dit bestand.
 * Ze importeren NOOIT rechtstreeks uit 'firebase/firestore'.
 *
 * Collecties in gebruik:
 *   users, lesgevers, groepen, trainingen, technieken,
 *   instellingen, settings, notificationTokens,
 *   trainerReminderTriggers, products, mail,
 *   events, members
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
  query,
  orderBy,
  where,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── USERS ───────────────────────────────────────────────────────────────────

export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

export async function updateUserRol(uid, nieuweRol) {
  await setDoc(doc(db, 'users', uid), { rol: nieuweRol }, { merge: true });
}

// ─── LESGEVERS ────────────────────────────────────────────────────────────────

export async function getAllLesgevers() {
  const snap = await getDocs(collection(db, 'lesgevers'));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.naam.localeCompare(b.naam));
}

export async function setLesgever(id, data) {
  await setDoc(doc(db, 'lesgevers', id), data);
}

export async function updateLesgever(id, veld, waarde) {
  await setDoc(doc(db, 'lesgevers', id), { [veld]: waarde }, { merge: true });
}

// ─── GROEPEN ─────────────────────────────────────────────────────────────────

export async function getAllGroepen() {
  const snap = await getDocs(collection(db, 'groepen'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateGroepDuur(groepId, duurMinuten) {
  await setDoc(doc(db, 'groepen', groepId), { duurMinuten }, { merge: true });
}

export async function updateGroepCategorieen(groepId, categorieen) {
  await setDoc(doc(db, 'groepen', groepId), { categorieen }, { merge: true });
}

// ─── TECHNIEKEN ───────────────────────────────────────────────────────────────

export async function getAllTechnieken() {
  const snap = await getDocs(collection(db, 'technieken'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── TRAININGEN ───────────────────────────────────────────────────────────────

export async function getTrainingenBySeizoenEnGroep(seizoen, groepId) {
  const q = query(
    collection(db, 'trainingen'),
    where('seizoen', '==', seizoen),
    where('groepId', '==', groepId)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteTrainingMetTechnieken(trainingId) {
  const techSnap = await getDocs(
    collection(db, 'trainingen', trainingId, 'technieken')
  );
  for (const d of techSnap.docs) await deleteDoc(d.ref);
  await deleteDoc(doc(db, 'trainingen', trainingId));
}

export function subscribeTrainingenBySeizoen(seizoen, groepId, callback) {
  const q = query(
    collection(db, 'trainingen'),
    where('seizoen', '==', seizoen),
    orderBy('datum', 'asc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

// ─── INSTELLINGEN ─────────────────────────────────────────────────────────────

export async function getPaginaRollen() {
  const snap = await getDoc(doc(db, 'instellingen', 'paginaRollen'));
  return snap.exists() ? snap.data() : null;
}

export async function setPaginaRollen(config) {
  await setDoc(doc(db, 'instellingen', 'paginaRollen'), config);
}

export async function getMeldingInstellingen() {
  const snap = await getDoc(doc(db, 'instellingen', 'meldingen'));
  return snap.exists() ? snap.data() : null;
}

export async function setMeldingInstellingen(data) {
  await setDoc(doc(db, 'instellingen', 'meldingen'), data, { merge: true });
}

// ─── CLUB SETTINGS ────────────────────────────────────────────────────────────

export async function getClubSettings() {
  const snap = await getDoc(doc(db, 'settings', 'club'));
  return snap.exists() ? snap.data() : null;
}

export async function setClubSettings(data) {
  await setDoc(
    doc(db, 'settings', 'club'),
    { ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── NOTIFICATION TOKENS ──────────────────────────────────────────────────────

export async function getNotificationTokens() {
  const snap = await getDocs(
    query(collection(db, 'notificationTokens'), orderBy('updatedAt', 'desc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deactiveerNotificationToken(tokenId) {
  await setDoc(
    doc(db, 'notificationTokens', tokenId),
    { active: false, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// ─── TRAINER REMINDERS ────────────────────────────────────────────────────────

export async function addTrainerReminderTrigger(data) {
  await addDoc(collection(db, 'trainerReminderTriggers'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// ─── MAIL ────────────────────────────────────────────────────────────────────

export async function sendMail(mailData) {
  await addDoc(collection(db, 'mail'), mailData);
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

export async function getAllProducts() {
  const snap = await getDocs(collection(db, 'products'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── EVENTS (Examens) ─────────────────────────────────────────────────────────

export function subscribeEvents(callback) {
  const q = query(collection(db, 'events'), orderBy('date', 'desc'));
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addEvent(data) {
  return await addDoc(collection(db, 'events'), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

export function subscribeEventRegistrations(eventId, callback) {
  const q = query(
    collection(db, 'events', eventId, 'registrations'),
    orderBy('createdAt')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeEventDocuments(eventId, callback) {
  const q = query(
    collection(db, 'events', eventId, 'documents'),
    orderBy('uploadedAt', 'desc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addRegistration(eventId, data) {
  await addDoc(collection(db, 'events', eventId, 'registrations'), data);
}

export async function updateRegistration(eventId, registrationId, data) {
  await updateDoc(
    doc(db, 'events', eventId, 'registrations', registrationId),
    data
  );
}

export async function addEventDocument(eventId, data) {
  await addDoc(collection(db, 'events', eventId, 'documents'), data);
}

export async function getMembers() {
  const snap = await getDocs(collection(db, 'members'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateMember(memberId, data) {
  await updateDoc(doc(db, 'members', memberId), data);
}
