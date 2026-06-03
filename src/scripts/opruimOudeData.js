// Opruim-script voor oude seizoensdata in Firestore.
// Verwijdert trainingen (incl. subcollecties), auditLogs en inschrijvingen
// die ouder zijn dan de ingestelde grens.
//
// Gebruik: roep op via de browser-console of een admin-knop met dryRun=true
// om eerst te controleren wat verwijderd zou worden.
//
// Voorbeeld:
//   import { opruimOudeData } from './scripts/opruimOudeData';
//   await opruimOudeData({ dryRun: true });   // preview
//   await opruimOudeData({ dryRun: false });  // echte verwijdering

import {
  collection, collectionGroup, getDocs, query, where,
  writeBatch, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { huidigSeizoenStartJaar, seizoenBereikVanJaar } from '../utils/seizoenUtils';

const BATCH_MAX = 450;

async function commitBatch(batch, teller) {
  if (teller === 0) return;
  await batch.commit();
}

/**
 * Verwijdert alle documenten in een snapshot in batches van BATCH_MAX.
 * @returns aantal verwijderde documenten
 */
async function verwijderSnap(snap, dryRun, label) {
  const totaal = snap.size;
  if (totaal === 0) {
    console.log(`[opruim] ${label}: 0 gevonden, niets te doen.`);
    return 0;
  }
  if (dryRun) {
    console.log(`[opruim] DRY-RUN ${label}: ${totaal} documenten zouden verwijderd worden.`);
    return totaal;
  }
  let batch = writeBatch(db);
  let inBatch = 0;
  let verwijderd = 0;
  for (const d of snap.docs) {
    batch.delete(d.ref);
    inBatch++;
    verwijderd++;
    if (inBatch >= BATCH_MAX) {
      await batch.commit();
      batch = writeBatch(db);
      inBatch = 0;
    }
  }
  await commitBatch(batch, inBatch);
  console.log(`[opruim] ${label}: ${verwijderd} documenten verwijderd.`);
  return verwijderd;
}

/**
 * Opruimen van oude seizoensdata.
 *
 * @param {object} opties
 * @param {boolean} opties.dryRun         - true = preview, false = echt verwijderen
 * @param {number}  opties.bewarenSeizoen - aantal volledige seizoenen bewaren (default: 3)
 *
 * Voorbeeld: behoud huidig + 2 voorgaande seizoenen → bewarenSeizoen: 3
 * Alles van vóór die grens wordt verwijderd.
 */
export async function opruimOudeData({ dryRun = true, bewarenSeizoen = 3 } = {}) {
  const huidig = huidigSeizoenStartJaar();
  const grensJaar = huidig - bewarenSeizoen;
  const grensBereik = seizoenBereikVanJaar(grensJaar);
  const grensDatum = grensBereik.start; // bijv. "2022-09-01"

  console.log(`[opruim] ${dryRun ? 'DRY-RUN' : 'LIVE'} — verwijder data vóór ${grensDatum} (bewaart ${bewarenSeizoen} seizoenen + huidig)`);
  console.log(`[opruim] Huidig seizoen: ${huidig}-${huidig + 1}, grens: voor ${grensJaar}-${grensJaar + 1}`);

  let totaalVerwijderd = 0;

  // ── 1. Trainingen ─────────────────────────────────────────────────────────
  const oudeTrainingen = await getDocs(
    query(collection(db, 'trainingen'), where('datum', '<', grensDatum))
  );

  if (!dryRun) {
    // Verwijder eerst de subcollecties (technieken) van elke oude training
    let subVerwijderd = 0;
    for (const t of oudeTrainingen.docs) {
      const techSnap = await getDocs(collection(db, 'trainingen', t.id, 'technieken'));
      if (techSnap.size > 0) {
        let batch = writeBatch(db);
        let inBatch = 0;
        for (const td of techSnap.docs) {
          batch.delete(td.ref);
          inBatch++;
          subVerwijderd++;
          if (inBatch >= BATCH_MAX) {
            await batch.commit();
            batch = writeBatch(db);
            inBatch = 0;
          }
        }
        await commitBatch(batch, inBatch);
      }
    }
    if (subVerwijderd > 0) console.log(`[opruim] trainingen/technieken subcollecties: ${subVerwijderd} verwijderd.`);
  } else {
    console.log(`[opruim] DRY-RUN trainingen/{id}/technieken: subcollecties worden niet geteld in dry-run.`);
  }

  totaalVerwijderd += await verwijderSnap(oudeTrainingen, dryRun, 'trainingen (oud)');

  // ── 2. Attendance subcollecties ───────────────────────────────────────────
  // attendance is een subcollectie van members: members/{id}/attendance/{trainingId}
  // We verwijderen attendance-records met date < grensDatum
  const oudeAttendance = await getDocs(
    query(collectionGroup(db, 'attendance'), where('date', '<', grensDatum))
  );
  totaalVerwijderd += await verwijderSnap(oudeAttendance, dryRun, 'attendance (oud)');

  // ── 3. auditLogs ──────────────────────────────────────────────────────────
  // Bewaar 12 maanden aan audit-logs (los van seizoengrens).
  // auditLogs slaan tijdstip op als Firestore Timestamp via serverTimestamp().
  const auditGrens = new Date();
  auditGrens.setFullYear(auditGrens.getFullYear() - 1);
  const auditGrensTs = Timestamp.fromDate(auditGrens);
  const oudeAuditLogs = await getDocs(
    query(collection(db, 'auditLogs'), where('tijdstip', '<', auditGrensTs))
  );
  totaalVerwijderd += await verwijderSnap(oudeAuditLogs, dryRun, 'auditLogs (>12 maanden oud)');

  // ── 4. Inschrijvingen ─────────────────────────────────────────────────────
  const oudeInschrijvingen = await getDocs(
    query(collection(db, 'inschrijvingen'), where('eventDatum', '<', grensDatum))
  );
  totaalVerwijderd += await verwijderSnap(oudeInschrijvingen, dryRun, 'inschrijvingen (oud)');

  // ── 5. Samenvatting ───────────────────────────────────────────────────────
  console.log(`[opruim] ${dryRun ? 'DRY-RUN klaar' : 'Klaar'} — ${dryRun ? 'te verwijderen' : 'verwijderd'}: ${totaalVerwijderd} documenten`);
  return { totaalVerwijderd, dryRun, grensDatum };
}
