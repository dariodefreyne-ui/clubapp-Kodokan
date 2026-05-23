// Eenmalige backfill: koppel bestaande inschrijvingen (zonder memberId) aan een
// lid uit ledenbeheer wanneer er een ondubbelzinnige match is op naam
// (+ geboortejaar indien gekend). Vult tegelijk een ontbrekend geboortejaar in
// vanuit het lid. Dubbelzinnige of onbekende namen blijven ongekoppeld (vrij veld).
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getMembers } from '../services/firestoreService';
import { vindUniekLid, jaarUitGeboortedatum } from '../utils/ledenKoppeling';

export async function koppelInschrijvingenAanLeden() {
  const leden = (await getMembers()).filter(m => m.actief !== false && m.active !== false);
  const snap = await getDocs(collection(db, 'inschrijvingen'));

  let gekoppeld = 0;
  let overgeslagen = 0;
  const totaal = snap.size;

  let batch = writeBatch(db);
  let inBatch = 0;

  for (const d of snap.docs) {
    const ins = d.data();
    if (ins.memberId) { overgeslagen++; continue; }

    const lid = vindUniekLid(ins.judokaNaam, ins.geboortejaar, leden);
    if (!lid) { overgeslagen++; continue; }

    const update = { memberId: lid.id };
    if (!ins.geboortejaar) {
      const jaar = jaarUitGeboortedatum(lid.geboortedatum);
      if (jaar) update.geboortejaar = jaar;
    }

    batch.update(doc(db, 'inschrijvingen', d.id), update);
    gekoppeld++;
    inBatch++;

    // Firestore-batch limiet is 500 operaties
    if (inBatch >= 450) {
      await batch.commit();
      batch = writeBatch(db);
      inBatch = 0;
    }
  }

  if (inBatch > 0) await batch.commit();

  return { totaal, gekoppeld, overgeslagen };
}
