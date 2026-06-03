// Eenmalige migratie: zet het zoekveld `naamLower` (lowercase naam) op elk lid,
// zodat de prefix-zoek (zoekLedenOpNaam) werkt. Idempotent en gebatcht.
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { bouwZoekPrefixes } from '../utils/ledenKoppeling';

export async function migreerLedenZoekveld() {
  const snap = await getDocs(collection(db, 'members'));
  const totaal = snap.size;
  let bijgewerkt = 0;
  let overgeslagen = 0;

  let batch = writeBatch(db);
  let inBatch = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const naamRaw = String(data.naam || data.name || '');
    const naamLower = naamRaw.trim().toLowerCase();
    if (!naamLower) { overgeslagen++; continue; }
    // Al up-to-date? (naamLower + zoekPrefixes aanwezig)
    if (data.naamLower === naamLower && Array.isArray(data.zoekPrefixes) && data.zoekPrefixes.length) {
      overgeslagen++; continue;
    }
    batch.update(doc(db, 'members', d.id), { naamLower, zoekPrefixes: bouwZoekPrefixes(naamRaw) });
    bijgewerkt++;
    inBatch++;
    if (inBatch >= 450) { await batch.commit(); batch = writeBatch(db); inBatch = 0; }
  }

  if (inBatch > 0) await batch.commit();
  return { totaal, bijgewerkt, overgeslagen };
}
