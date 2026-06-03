import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const CAT_RANGORDE = ['U9','U11','U13','U14','U15','U16','U18','U21+'];

export const VET_SUBCATS = [
  { code: 'V1', label: '30–34', min: 30, max: 34 },
  { code: 'V2', label: '35–39', min: 35, max: 39 },
  { code: 'V3', label: '40–44', min: 40, max: 44 },
  { code: 'V4', label: '45–49', min: 45, max: 49 },
  { code: 'V5', label: '50–54', min: 50, max: 54 },
  { code: 'V6', label: '55–59', min: 55, max: 59 },
  { code: 'V7', label: '60–64', min: 60, max: 64 },
  { code: 'V8', label: '65–69', min: 65, max: 69 },
  { code: 'V9', label: '70+',   min: 70, max: 999 },
];

/**
 * Hook die leeftijdscategoriecodes laadt uit Firestore (collectie 'categorieen',
 * gesorteerd op volgorde). Valt terug op hardcoded CAT_RANGORDE als Firestore
 * leeg is of een fout geeft.
 */
export function useCatRangorde() {
  const [cats, setCats] = useState(CAT_RANGORDE);
  useEffect(() => {
    getDocs(query(collection(db, 'categorieen'), orderBy('volgorde')))
      .then(snap => {
        const codes = snap.docs.map(d => d.data().code).filter(Boolean);
        if (codes.length > 0) setCats(codes);
      })
      .catch(() => {});
  }, []);
  return cats;
}

/**
 * Leest doelgroep als array van categoriecodes.
 * Ondersteunt zowel het nieuwe formaat (array) als het oude (string 'U11-U13').
 */
export function parseerDoelgroepArray(doelgroep) {
  if (Array.isArray(doelgroep)) return doelgroep;
  if (!doelgroep) return [];
  return doelgroep.split(/[-\/]/).map(s => s.trim()).filter(Boolean);
}

export function berekenRuweCategorie(geboortejaar, tornooidatum) {
  if (!geboortejaar || !tornooidatum) return null;
  const jaar = new Date(tornooidatum).getFullYear();
  const leeftijd = jaar - parseInt(geboortejaar);
  if (leeftijd <= 6)   return null;
  if (leeftijd <= 8)   return 'U9';
  if (leeftijd <= 10)  return 'U11';
  if (leeftijd <= 12)  return 'U13';
  if (leeftijd === 13) return 'U14';
  if (leeftijd === 14) return 'U15';
  if (leeftijd === 15) return 'U16';
  if (leeftijd <= 17)  return 'U18';
  return 'U21+';
}

export function parseerToegelatenCategorieen(doelgroep) {
  if (!doelgroep) return null;
  // Ondersteunt zowel array als string
  const bronCodes = Array.isArray(doelgroep)
    ? doelgroep
    : null;
  if (bronCodes) {
    return bronCodes.length > 0 ? bronCodes : [...CAT_RANGORDE];
  }
  const d = doelgroep.toUpperCase().replace(/\s/g, '');
  if (d.includes('ALLE') || d === '') return [...CAT_RANGORDE];
  const toegelaten = new Set();
  for (const cat of CAT_RANGORDE) {
    const escaped = cat.replace('+', '\\+');
    if (new RegExp(`(^|[^0-9])${escaped}([^0-9+]|$)`).test(d)) toegelaten.add(cat);
  }
  if (/U15[+]/.test(d) || /U15-U21/.test(d) || /U15-U18-U21/.test(d))
    ['U15','U18','U21+'].forEach(c => toegelaten.add(c));
  if (/U18[+]/.test(d) || /U18-U21/.test(d))
    ['U18','U21+'].forEach(c => toegelaten.add(c));
  if (toegelaten.size === 0) return [...CAT_RANGORDE];
  return [...toegelaten];
}

export function berekenVeteranenSubcat(geboortejaar, referentieDatum) {
  if (!geboortejaar) return null;
  const refJaar = referentieDatum ? new Date(referentieDatum).getFullYear() : new Date().getFullYear();
  const leeftijd = refJaar - parseInt(geboortejaar);
  if (leeftijd < 30) return null;
  return VET_SUBCATS.find(s => leeftijd >= s.min && leeftijd <= s.max) || VET_SUBCATS[VET_SUBCATS.length - 1];
}

export function berekenCategorie(geboortejaar, tornooidatum, doelgroep = null) {
  const ruw = berekenRuweCategorie(geboortejaar, tornooidatum);
  if (!ruw) return { cat: '—', buiten: false };

  // Veteranen-tornooi: bereken subcat op basis van leeftijd
  const doelCodes = parseerDoelgroepArray(doelgroep);
  if (doelCodes.includes('Veteranen')) {
    const vetSubcat = berekenVeteranenSubcat(geboortejaar, tornooidatum);
    if (vetSubcat) return { cat: vetSubcat.code, buiten: false };
    return { cat: ruw, buiten: true }; // te jong voor veteranen
  }

  const toegelaten = parseerToegelatenCategorieen(doelgroep);
  if (!toegelaten) return { cat: ruw, buiten: false };
  if (toegelaten.includes(ruw)) return { cat: ruw, buiten: false };
  const rawIdx = CAT_RANGORDE.indexOf(ruw);
  for (let i = rawIdx; i < CAT_RANGORDE.length; i++)
    if (toegelaten.includes(CAT_RANGORDE[i])) return { cat: CAT_RANGORDE[i], buiten: false };
  for (let i = rawIdx - 1; i >= 0; i--)
    if (toegelaten.includes(CAT_RANGORDE[i])) return { cat: CAT_RANGORDE[i], buiten: true };
  return { cat: ruw, buiten: true };
}
