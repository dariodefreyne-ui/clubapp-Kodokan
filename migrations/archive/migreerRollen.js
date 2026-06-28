// src/scripts/migreerRollen.js
// Eenmalig migratieScript: zet alle users met rol 'beheerder' om naar 'bestuurslid'
// Na uitvoering kan dit bestand worden gearchiveerd.
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase';

export async function migreerBeheerderNaarBestuurslid() {
  const snap = await getDocs(
    query(collection(db, 'users'), where('rol', '==', 'beheerder'))
  );

  if (snap.empty) {
    return { gemigreerd: 0, bericht: 'Geen gebruikers met rol beheerder gevonden.' };
  }

  const beloftes = snap.docs.map(d =>
    updateDoc(doc(db, 'users', d.id), { rol: 'bestuurslid' })
  );

  await Promise.all(beloftes);

  return {
    gemigreerd: snap.docs.length,
    bericht: `${snap.docs.length} gebruiker(s) omgezet naar bestuurslid.`,
  };
}
