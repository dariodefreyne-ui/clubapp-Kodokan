import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_LEEFTIJDSCATEGORIEEN } from '../config/clubdataDefaults';

/**
 * Centrale leeftijdscategorie-logica.
 * Alle bepalingen gebeuren op basis van de Beheer-geconfigureerde tabel
 * (Firestore-collectie 'categorieen': code/vanLeeftijd/totLeeftijd/volgorde) — er zijn
 * geen hardcoded leeftijdsranges. De ranges in Beheer kunnen overlappen (bv. een
 * 19-jarige valt zowel onder U21 als U21+), dus een lid kan op één moment in
 * meerdere categorieën tegelijk vallen.
 */

/** Normaliseert een categorieConfig-array (uit Firestore of een fallback) en sorteert op volgorde. */
function genormaliseerd(categorieenConfig) {
  const bron = (categorieenConfig && categorieenConfig.length > 0) ? categorieenConfig : DEFAULT_LEEFTIJDSCATEGORIEEN;
  return [...bron]
    .filter(c => c && c.code && Number.isFinite(c.vanLeeftijd) && Number.isFinite(c.totLeeftijd))
    .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
}

/** Codes in volgorde (backwards-compat voor plekken die enkel de codes nodig hebben). */
export function catCodes(categorieenConfig) {
  return genormaliseerd(categorieenConfig).map(c => c.code);
}

/** Veteranen-codes ('Veteranen' + V1, V2, ...) — worden apart getoond via VeteranenSelector. */
export function isVetCode(code) {
  return code === 'Veteranen' || /^V\d+$/.test(code || '');
}

/**
 * Hook die de volledige categorie-configuratie laadt uit Firestore (collectie
 * 'categorieen', gesorteerd op volgorde). Valt terug op DEFAULT_LEEFTIJDSCATEGORIEEN
 * als Firestore leeg is of een fout geeft.
 */
export function useCategorieenConfig() {
  const [cats, setCats] = useState(DEFAULT_LEEFTIJDSCATEGORIEEN);
  useEffect(() => {
    getDocs(query(collection(db, 'categorieen'), orderBy('volgorde')))
      .then(snap => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (docs.length > 0) setCats(docs);
      })
      .catch(() => {});
  }, []);
  return cats;
}

/** Backwards-compat: enkel de codes, voor dropdowns die geen volledige config nodig hebben. */
export function useCatRangorde() {
  return catCodes(useCategorieenConfig());
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

/** Leeftijd op een referentiemoment. "jaartal is voldoende" — enkel kalenderjaar telt. */
export function berekenLeeftijd(geboortejaar, referentieJaarOfDatum) {
  if (!geboortejaar) return null;
  const refJaar = typeof referentieJaarOfDatum === 'number'
    ? referentieJaarOfDatum
    : referentieJaarOfDatum ? new Date(referentieJaarOfDatum).getFullYear() : new Date().getFullYear();
  return refJaar - parseInt(geboortejaar, 10);
}

/**
 * Geeft ALLE categorieën terug die overeenkomen met de leeftijd op het referentiemoment
 * (gesorteerd op volgorde). Kan meerdere resultaten geven bij overlappende ranges.
 */
export function berekenCategorieen(geboortejaar, referentieJaarOfDatum, categorieenConfig) {
  const leeftijd = berekenLeeftijd(geboortejaar, referentieJaarOfDatum);
  if (leeftijd == null) return [];
  return genormaliseerd(categorieenConfig).filter(c => leeftijd >= c.vanLeeftijd && leeftijd <= c.totLeeftijd);
}

/** Kiest uit meerdere overlappende categorieën de specifiekste (smalste leeftijdsrange). */
function smalste(categorieen) {
  if (!categorieen || categorieen.length === 0) return null;
  return categorieen.reduce((beste, c) =>
    (c.totLeeftijd - c.vanLeeftijd) < (beste.totLeeftijd - beste.vanLeeftijd) ? c : beste);
}

/** Ruwe (leeftijdsgebaseerde) categoriecode, zonder rekening te houden met doelgroep/veteranen. */
export function berekenRuweCategorie(geboortejaar, referentieJaarOfDatum, categorieenConfig) {
  const matches = berekenCategorieen(geboortejaar, referentieJaarOfDatum, categorieenConfig).filter(c => !isVetCode(c.code));
  return smalste(matches)?.code ?? null;
}

export function parseerToegelatenCategorieen(doelgroep, categorieenConfig) {
  const config = genormaliseerd(categorieenConfig);
  const alleCodes = config.map(c => c.code);
  if (!doelgroep) return null;
  if (Array.isArray(doelgroep)) return doelgroep.length > 0 ? doelgroep : [...alleCodes];
  const d = doelgroep.toUpperCase().replace(/\s/g, '');
  if (d.includes('ALLE') || d === '') return [...alleCodes];
  const toegelaten = new Set();
  config.forEach((c, idx) => {
    const escaped = c.code.replace('+', '\\+');
    if (new RegExp(`(^|[^0-9])${escaped}([^0-9+]|$)`).test(d)) toegelaten.add(c.code);
    // "U15+" of "U18+" e.d. betekent: deze categorie en alles ouder (volgens volgorde),
    // generiek bepaald via de geconfigureerde volgorde — geen hardcoded codes.
    if (!c.code.endsWith('+') && new RegExp(`${escaped}\\+`).test(d)) {
      config.slice(idx).forEach(cc => toegelaten.add(cc.code));
    }
  });
  return toegelaten.size > 0 ? [...toegelaten] : [...alleCodes];
}

export function berekenVeteranenSubcat(geboortejaar, referentieJaarOfDatum, categorieenConfig) {
  if (!geboortejaar) return null;
  const matches = berekenCategorieen(geboortejaar, referentieJaarOfDatum, categorieenConfig)
    .filter(c => /^V\d+$/.test(c.code));
  return smalste(matches);
}

export function berekenCategorie(geboortejaar, tornooidatum, doelgroep = null, categorieenConfig = null) {
  const config = genormaliseerd(categorieenConfig);
  const matches = berekenCategorieen(geboortejaar, tornooidatum, config);
  const doelCodes = parseerDoelgroepArray(doelgroep);

  // Veteranen-tornooi: bereken subcat op basis van leeftijd
  if (doelCodes.includes('Veteranen')) {
    const vetSubcat = berekenVeteranenSubcat(geboortejaar, tornooidatum, config);
    if (vetSubcat) return { cat: vetSubcat.code, buiten: false };
    const ruw = smalste(matches.filter(c => !isVetCode(c.code)))?.code;
    return { cat: ruw ?? '—', buiten: true }; // te jong voor veteranen
  }

  const ruw = smalste(matches.filter(c => !isVetCode(c.code)))?.code;
  if (!ruw) return { cat: '—', buiten: false };

  const toegelaten = parseerToegelatenCategorieen(doelgroep, config);
  if (!toegelaten) return { cat: ruw, buiten: false };
  if (toegelaten.includes(ruw)) return { cat: ruw, buiten: false };

  const codes = config.map(c => c.code);
  const rawIdx = codes.indexOf(ruw);
  for (let i = rawIdx; i < codes.length; i++)
    if (toegelaten.includes(codes[i])) return { cat: codes[i], buiten: false };
  for (let i = rawIdx - 1; i >= 0; i--)
    if (toegelaten.includes(codes[i])) return { cat: codes[i], buiten: true };
  return { cat: ruw, buiten: true };
}
