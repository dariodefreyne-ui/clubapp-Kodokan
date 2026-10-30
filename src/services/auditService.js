import { collection, getDocs, limit, orderBy, query, startAfter, where } from 'firebase/firestore';
import { db } from '../firebase';

// Leest de bestaande auditLogs (geschreven door de Cloud Function auditLog_members).
// Geen extra writes; kost max `max` reads per pagina en enkel wanneer de tab opent.
// Vereist composite index: collectie ASC, docId ASC, tijdstip DESC.
export async function getLidHistoriek(memberId, { na = null, max = 25 } = {}) {
  const cons = [
    where('collectie', '==', 'members'),
    where('docId', '==', memberId),
    orderBy('tijdstip', 'desc'),
  ];
  if (na) cons.push(startAfter(na));
  cons.push(limit(max));
  const snap = await getDocs(query(collection(db, 'auditLogs'), ...cons));
  return {
    items: snap.docs.map(d => ({ id: d.id, ...d.data() })),
    laatste: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
    meer: snap.docs.length === max,
  };
}
