// src/utils/firestoreRetry.js
import { runTransaction } from 'firebase/firestore';

// runTransaction() faalt onmiddellijk bij een kortstondig netwerkprobleem —
// in tegenstelling tot gewone writes (setDoc/updateDoc) queuet een transactie
// niet offline, want ze moet eerst de actuele serverstatus lezen (voorraad-
// check bij de kassa bijvoorbeeld).
//
// Dit is bewust GEEN offline-queue voor transacties: dat zou bij meerdere
// gelijktijdige kassa's met elk een eigen (stale) lokale voorraadstand tot
// overselling kunnen leiden. In plaats daarvan: een korte automatische retry
// voor een kortstondige wifi-hik (paar seconden), zodat de kassaploeg niet
// meteen een foutmelding krijgt en zelf op "opnieuw proberen" moet klikken
// voor iets dat vanzelf overgaat.
//
// Enkel *netwerk*-gerelateerde Firestore-foutcodes worden herhaald. Een
// businessfout zoals "onvoldoende stock" (een gewone new Error() zonder
// .code, gegooid vanuit de eigen updateFunction) wordt NOOIT herhaald —
// die moet meteen en duidelijk getoond worden.
const HERHAALBARE_CODES = new Set(['unavailable', 'deadline-exceeded']);

/**
 * @param {import('firebase/firestore').Firestore} db
 * @param {(transaction: import('firebase/firestore').Transaction) => Promise<any>} updateFunction
 * @param {{ pogingen?: number, wachtMs?: number[], onRetry?: (poging: number, err: Error) => void }} [opties]
 */
export async function runTransactionMetRetry(db, updateFunction, opties = {}) {
  const pogingen = opties.pogingen ?? 3;
  const wachtMs = opties.wachtMs ?? [800, 2000];

  let laatsteFout;
  for (let poging = 1; poging <= pogingen; poging++) {
    try {
      return await runTransaction(db, updateFunction);
    } catch (err) {
      laatsteFout = err;
      const herhaalbaar = HERHAALBARE_CODES.has(err?.code);
      const laatstePoging = poging === pogingen;
      if (!herhaalbaar || laatstePoging) throw err;
      opties.onRetry?.(poging, err);
      await new Promise(resolve => setTimeout(resolve, wachtMs[poging - 1] ?? 2000));
    }
  }
  throw laatsteFout;
}
