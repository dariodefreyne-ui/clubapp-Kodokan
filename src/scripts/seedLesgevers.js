// src/scripts/seedLesgevers.js
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const LESGEVERS = [
  'Brent De Rijs',
  'Carl Roels',
  'Dario De Freyne',
  'Dirk Vandevoort',
  'Eddy Raeymaekers',
  'Jo Biesemans',
  'Jurgen Roels',
  'Liesbeth Biesemans',
  'Lisa-Marie Vandroogenbroeck',
  'Luc Raeymaekers',
  'Marc Robberechts',
  'Mathias Keirens',
  'Sofie Michiels',
  'Stef Dewandeler',
  'Wout Huysman',
];

export async function seedLesgevers() {
  const snap = await getDocs(collection(db, 'lesgevers'));
  if (snap.size >= LESGEVERS.length) {
    console.log('Lesgevers al aanwezig, seed overgeslagen');
    return;
  }
  for (const naam of LESGEVERS) {
    const id = naam.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await setDoc(doc(db, 'lesgevers', id), {
      naam,
      actief: true,
      aangemaakt: new Date().toISOString(),
    });
  }
  console.log(`${LESGEVERS.length} lesgevers aangemaakt`);
}
