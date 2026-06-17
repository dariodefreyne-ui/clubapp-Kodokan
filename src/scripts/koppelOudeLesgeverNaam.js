// src/scripts/koppelOudeLesgeverNaam.js
// Eenmalige actie: oude trainingen/wedstrijden bewaren soms enkel een tekstnaam
// voor een lesgever (bv. via Excel-import), zonder lesgeverId. Na een naamswijziging
// in ledenbeheer/lesgevers matcht die oude tekstnaam niet meer met de live naam,
// waardoor uitbetalingen/rapporten en de aanwezigheids-toggle in de uitbetalingsmatrix
// de oude naam blijven tonen of niet meer correct aanvinken. Dit script koppelt
// die losse tekstnaam-vermeldingen aan het juiste lesgever-document.
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { normNaam } from '../components/uitbetalingen/uitbetalingHelpers';

const BATCH_SIZE = 400;

export async function koppelOudeLesgeverNaam(oudeNaam, huidigeNaam) {
  const oudeNorm = normNaam(oudeNaam);
  const huidigeNorm = normNaam(huidigeNaam);
  if (!oudeNorm || !huidigeNorm) throw new Error('Oude en huidige naam zijn verplicht.');

  const lesgeversSnap = await getDocs(collection(db, 'lesgevers'));
  const doel = lesgeversSnap.docs.find(d => normNaam(d.data().naam) === huidigeNorm);
  if (!doel) throw new Error(`Geen lesgever gevonden met naam "${huidigeNaam}".`);
  const doelId = doel.id;

  const [trainingenSnap, eventsSnap] = await Promise.all([
    getDocs(collection(db, 'trainingen')),
    getDocs(collection(db, 'events')),
  ]);

  const updates = [];

  trainingenSnap.docs.forEach(d => {
    const lesgevers = d.data().lesgevers || [];
    if (!lesgevers.some(k => normNaam(k) === oudeNorm)) return;
    const nieuw = [...new Set(lesgevers.map(k => normNaam(k) === oudeNorm ? doelId : k))];
    updates.push({ ref: doc(db, 'trainingen', d.id), data: { lesgevers: nieuw } });
  });

  eventsSnap.docs.forEach(d => {
    const begeleiders = d.data().begeleiders || [];
    let changed = false;
    const nieuw = begeleiders.map(b => {
      if (!b.lesgeverId && normNaam(b.naam) === oudeNorm) { changed = true; return { ...b, lesgeverId: doelId, naam: doel.data().naam }; }
      return b;
    });
    if (changed) updates.push({ ref: doc(db, 'events', d.id), data: { begeleiders: nieuw } });
  });

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    updates.slice(i, i + BATCH_SIZE).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
  }

  return { bijgewerkt: updates.length };
}
