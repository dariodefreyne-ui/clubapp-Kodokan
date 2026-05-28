import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

export const CAT_RANGORDE = ['U9','U11','U13','U14','U15','U16','U18','U21+'];

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

export function berekenCategorie(geboortejaar, tornooidatum, doelgroep = null) {
  const ruw = berekenRuweCategorie(geboortejaar, tornooidatum);
  if (!ruw) return { cat: '—', buiten: false };
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
