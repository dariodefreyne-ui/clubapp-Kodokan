// Eenmalige migratie: zet het zoekveld `naamLower` (lowercase naam) op elk lid,
// zodat de prefix-zoek (zoekLedenOpNaam) werkt. Idempotent en gebatcht.
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';

export async function migreerLedenZoekveld() {
  const snap = await getDocs(collection(db, 'members'));
  const totaal = snap.size;
  let bijgewerkt = 0;
  let overgeslagen = 0;

  let batch = writeBatch(db);
  let inBatch = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const gewenst = String(data.naam || data.name || '').trim().toLowerCase();
    if (!gewenst || data.naamLower === gewenst) { overgeslagen++; continue; }

    batch.update(doc(db, 'members', d.id), { naamLower: gewenst });
    bijgewerkt++;
    inBatch++;
    if (inBatch >= 450) { await batch.commit(); batch = writeBatch(db); inBatch = 0; }
  }

  if (inBatch > 0) await batch.commit();
  return { totaal, bijgewerkt, overgeslagen };
}
