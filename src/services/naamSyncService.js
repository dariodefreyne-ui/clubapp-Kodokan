import { collection, collectionGroup, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../config/appConfig';

// Eenmalige kost: 1 read per lid + inschrijving + registratie; 1 write per
// effectief gewijzigd document. Geen extra indexen of rules nodig
// (collection-group read op registrations is al toegelaten).

export async function laadNaamSyncBronnen() {
  const [ledenSnap, insSnap, regSnap] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.MEMBERS)),
    getDocs(collection(db, COLLECTIONS.INSCHRIJVINGEN)),
    getDocs(collectionGroup(db, 'registrations')),
  ]);
  return {
    members: ledenSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    inschrijvingen: insSnap.docs.map(d => ({ path: d.ref.path, ...d.data() })),
    registrations: regSnap.docs.map(d => ({ path: d.ref.path, ...d.data() })),
  };
}

// items: [{ path, patch }]. Batches van max 499.
export async function schrijfPatches(items, onProgress) {
  const BATCH = 499;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = writeBatch(db);
    items.slice(i, i + BATCH).forEach(({ path, patch }) => batch.update(doc(db, path), patch));
    await batch.commit();
    if (onProgress) onProgress(Math.min(i + BATCH, items.length), items.length);
  }
  return items.length;
}
