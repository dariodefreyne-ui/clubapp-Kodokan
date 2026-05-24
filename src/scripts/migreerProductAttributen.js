// Eenmalige migratie: leidt de structurele kenmerken (type/maat/geslacht) af uit
// de bestaande `variant`-tekst en zet ze op elk product waar ze nog ontbreken.
// Idempotent: handmatig gezette velden worden niet overschreven. Gebatcht.
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { productFacetten } from '../components/winkel/productFacets';

export async function migreerProductAttributen() {
  const snap = await getDocs(collection(db, 'products'));
  const totaal = snap.size;
  let bijgewerkt = 0;
  let overgeslagen = 0;

  let batch = writeBatch(db);
  let inBatch = 0;

  for (const d of snap.docs) {
    const p = { id: d.id, ...d.data() };
    const f = productFacetten(p);

    const update = {};
    if (f.type != null && p.type == null) update.type = f.type;
    if (f.maat != null && p.maat == null) update.maat = f.maat;
    if (f.geslacht != null && p.geslacht == null) update.geslacht = f.geslacht;

    if (Object.keys(update).length === 0) { overgeslagen++; continue; }

    batch.update(doc(db, 'products', d.id), update);
    bijgewerkt++;
    inBatch++;
    if (inBatch >= 450) { await batch.commit(); batch = writeBatch(db); inBatch = 0; }
  }

  if (inBatch > 0) await batch.commit();
  return { totaal, bijgewerkt, overgeslagen };
}
