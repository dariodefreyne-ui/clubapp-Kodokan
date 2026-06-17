// src/scripts/koppelOudeLidNaam.js
// Eenmalige actie: wedstrijd-inschrijvingen bewaren soms enkel een tekstnaam
// (judokaNaam) voor een lid, zonder memberId — bv. bij oudere/handmatige
// inschrijvingen of wanneer vindUniekLid() de naam niet ondubbelzinnig kon
// koppelen. Na een naamswijziging in ledenbeheer matcht die oude tekstnaam
// niet meer, waardoor Rapporten/Wedstrijden de deelnemer als een apart
// (verouderd) persoon blijven tonen. Dit script koppelt die losse
// tekstnaam-vermeldingen aan het juiste lid-document.
import { collection, getDocs, doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { normNaam } from '../components/uitbetalingen/uitbetalingHelpers';

const BATCH_SIZE = 400;

export async function koppelOudeLidNaam(oudeNaam, huidigeNaam) {
  const oudeNorm = normNaam(oudeNaam);
  const huidigeNorm = normNaam(huidigeNaam);
  if (!oudeNorm || !huidigeNorm) throw new Error('Oude en huidige naam zijn verplicht.');

  const membersSnap = await getDocs(collection(db, 'members'));
  const doel = membersSnap.docs.find(d => normNaam(d.data().naam || d.data().name) === huidigeNorm);
  if (!doel) throw new Error(`Geen lid gevonden met naam "${huidigeNaam}".`);
  const doelId = doel.id;
  const doelNaam = doel.data().naam || doel.data().name;

  const inschrijvingenSnap = await getDocs(collection(db, 'inschrijvingen'));
  const updates = [];
  inschrijvingenSnap.docs.forEach(d => {
    const data = d.data();
    if (data.memberId) return; // al gekoppeld, niet aanraken
    if (normNaam(data.judokaNaam) !== oudeNorm) return;
    updates.push({ ref: doc(db, 'inschrijvingen', d.id), data: { memberId: doelId, judokaNaam: doelNaam } });
  });

  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    updates.slice(i, i + BATCH_SIZE).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
  }

  return { bijgewerkt: updates.length };
}
