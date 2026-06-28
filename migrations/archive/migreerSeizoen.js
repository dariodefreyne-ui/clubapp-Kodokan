// src/scripts/migreerSeizoen.js
// Eenmalig uitvoeren om seizoen-veld toe te voegen aan bestaande trainingen.
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { bepaalSeizoen } from '../components/trainingen/seizoenHelpers';

export async function migreerSeizoen() {
  const snap = await getDocs(collection(db, 'trainingen'));
  let count = 0;
  for (const d of snap.docs) {
    const data = d.data();
    if (!data.seizoen && data.datum) {
      await updateDoc(doc(db, 'trainingen', d.id), {
        seizoen: bepaalSeizoen(data.datum),
      });
      count++;
    }
  }
  console.log(`Migratie klaar: ${count} trainingen bijgewerkt`);
  return count;
}
