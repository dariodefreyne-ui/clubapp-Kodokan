// src/scripts/migreerTrainingenUren.js
// Eenmalig uitvoeren: vult startTijd en eindTijd in op trainingen die deze
// velden missen, door ze over te nemen van de bijhorende groep.
// Idempotent: trainingen die al beide velden hebben worden overgeslagen.
// Trainingen waarvan de groep geen uren heeft worden ook overgeslagen.
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

const BATCH_SIZE = 400;

export async function migreerTrainingenUren() {
  // 1. Laad alle groepen en indexeer op id
  const groepenSnap = await getDocs(collection(db, 'groepen'));
  const groepen = {};
  groepenSnap.docs.forEach(d => { groepen[d.id] = d.data(); });

  // 2. Laad alle trainingen
  const trainingenSnap = await getDocs(collection(db, 'trainingen'));

  // 3. Filter: trainingen zonder startTijd/eindTijd waarvan de groep wel uren heeft
  const teUpdaten = [];
  for (const d of trainingenSnap.docs) {
    const t = d.data();
    if (t.startTijd && t.eindTijd) continue; // al ingevuld
    const groep = groepen[t.groepId];
    if (!groep?.startTijd || !groep?.eindTijd) continue; // groep heeft geen uren
    teUpdaten.push({ ref: doc(db, 'trainingen', d.id), startTijd: groep.startTijd, eindTijd: groep.eindTijd });
  }

  if (teUpdaten.length === 0) return { bijgewerkt: 0, totaal: trainingenSnap.size };

  // 4. Schrijf in batches (Firestore max 500 per batch)
  for (let i = 0; i < teUpdaten.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    teUpdaten.slice(i, i + BATCH_SIZE).forEach(({ ref, startTijd, eindTijd }) => {
      batch.update(ref, { startTijd, eindTijd });
    });
    await batch.commit();
  }

  return { bijgewerkt: teUpdaten.length, totaal: trainingenSnap.size };
}
