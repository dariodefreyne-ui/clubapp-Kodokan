// Eenmalige migratie: zet het lesgever-type 'aspirant' om naar 'assistent'.
// - Alle lesgevers met type 'aspirant' krijgen type 'assistent'.
// - Het uurtarief van 'aspirant' wordt gekopieerd naar 'assistent' (bestaand
//   assistent-tarief wordt niet overschreven).
// - Zorgt dat het type 'assistent' in de configlijst (lesgeverTypes) bestaat.
// Het oude type/tarief 'aspirant' blijft staan; verwijder dat desgewenst nadien
// via Beheer. Herlaad de app na de migratie (de type-cache wordt 1× per sessie
// geladen).
import { collection, getDocs, getDoc, doc, setDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export async function migreerAspirantNaarAssistent() {
  // 1. Lesgevers: type 'aspirant' → 'assistent'
  const lesgeversSnap = await getDocs(collection(db, 'lesgevers'));
  let lesgeversOmgezet = 0;
  let batch = writeBatch(db);
  let inBatch = 0;
  for (const d of lesgeversSnap.docs) {
    if (d.data().type === 'aspirant') {
      batch.update(doc(db, 'lesgevers', d.id), { type: 'assistent' });
      lesgeversOmgezet++;
      inBatch++;
      if (inBatch >= 450) { await batch.commit(); batch = writeBatch(db); inBatch = 0; }
    }
  }
  if (inBatch > 0) await batch.commit();

  // 2. Tarief kopiëren (niet overschrijven als assistent al een tarief > 0 heeft)
  let tariefGekopieerd = false;
  const aspirant = await getDoc(doc(db, 'tarieven', 'aspirant'));
  const assistent = await getDoc(doc(db, 'tarieven', 'assistent'));
  const assistentHeeftTarief = assistent.exists() && Number(assistent.data().bedragPerUur) > 0;
  if (aspirant.exists() && !assistentHeeftTarief) {
    await setDoc(doc(db, 'tarieven', 'assistent'), {
      type: 'assistent',
      bedragPerUur: aspirant.data().bedragPerUur || 0,
      bijgewerkt: serverTimestamp(),
    }, { merge: true });
    tariefGekopieerd = true;
  }

  // 3. Zorg dat het type 'assistent' in de configlijst bestaat
  let typeToegevoegd = false;
  const typesSnap = await getDocs(collection(db, 'lesgeverTypes'));
  const heeftAssistent = typesSnap.docs.some(d => d.data().code === 'assistent');
  if (!heeftAssistent) {
    await setDoc(doc(collection(db, 'lesgeverTypes')), {
      code: 'assistent', label: 'Assistent', volgorde: 50, updatedAt: serverTimestamp(),
    });
    typeToegevoegd = true;
  }

  return { lesgeversOmgezet, tariefGekopieerd, typeToegevoegd };
}
