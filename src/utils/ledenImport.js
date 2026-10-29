// src/utils/ledenImport.js
// Pure logica voor CSV/Excel-import en -export van leden (geen Firebase-imports,
// dus eenvoudig te testen). Gebruikt door CsvImportModal en Ledenbeheer.

import { naamSleutel } from './ledenKoppeling';

// LidID = Firestore-document-id: de betrouwbaarste matchsleutel bij een
// export → bewerken in Excel → opnieuw importeren.
export const IMPORT_KOLOMMEN = [
  'LidID', 'Voornaam', 'Achternaam', 'Geboortedatum', 'Email', 'Telefoon', 'Lidnummer',
  'Gordel', 'Vergunningsnummer', 'IngeschrevenJaar', 'Groepen', 'MedischeInfo',
  'NoodcontactNaam', 'NoodcontactTelefoon', 'BijdrageBetaald', 'BijdrageVervaldatum', 'Actief',
];

const HEADER_ALIAS = (() => {
  const sleutel = (h) => String(h).toLowerCase().replace(/[\s_\-]/g, '');
  const map = {};
  [...IMPORT_KOLOMMEN, 'Naam'].forEach(k => { map[sleutel(k)] = k; });
  map[sleutel('Familienaam')] = 'Achternaam';
  map[sleutel('Kyu')] = 'Gordel';
  return { sleutel, map };
})();

export function normaliseerHeader(h) {
  const k = HEADER_ALIAS.sleutel(String(h || '').replace(/^\uFEFF/, ''));
  return HEADER_ALIAS.map[k] || String(h || '').replace(/^\uFEFF/, '').trim();
}

// Geeft ISO (YYYY-MM-DD), null bij leeg, undefined bij ongeldig.
export function parseDatum(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  let d, m, y;
  let mt = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (mt) { [, d, m, y] = mt; } else {
    mt = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (!mt) return undefined;
    [, y, m, d] = mt;
  }
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  if (dt.getUTCFullYear() !== +y || dt.getUTCMonth() !== +m - 1 || dt.getUTCDate() !== +d) return undefined;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isoNaarNl(iso) {
  const mt = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return mt ? `${mt[3]}/${mt[2]}/${mt[1]}` : String(iso || '');
}

// Gordel als code ("geel"), label ("Geel (5e kyu)"), kyu ("5", "5e kyu", "kyu 5")
// of dan ("1e dan"). Geeft de gordelcode, null bij leeg, undefined bij ongeldig.
export function parseGordel(waarde, { opties = [], labels = {}, kyuMap = {} } = {}) {
  const v = String(waarde ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!v) return null;
  if (opties.includes(v)) return v;
  for (const c of opties) {
    const l = String(labels[c] || '').toLowerCase();
    if (l && (l === v || l.replace(/\s*\(.*\)\s*$/, '') === v)) return c;
  }
  const kyuNaarCode = (n) => opties.find(c => String(kyuMap[c]) === String(n));
  let mt = v.match(/^(\d)\s*(?:e|de|ste)?\s*kyu$/) || v.match(/^kyu\s*(\d)$/) || v.match(/\((\d)\s*(?:e|de|ste)?\s*kyu\)/);
  if (mt) return kyuNaarCode(mt[1]);
  if (/^\d$/.test(v)) return kyuNaarCode(v);
  if (/\bdan\b/.test(v)) return kyuNaarCode(0);
  return undefined;
}

// true / false, null bij leeg, undefined bij ongeldig.
export function parseJaNee(waarde) {
  const v = String(waarde ?? '').trim().toLowerCase();
  if (!v) return null;
  if (['ja', 'j', 'true', '1', 'yes'].includes(v)) return true;
  if (['nee', 'n', 'false', '0', 'no'].includes(v)) return false;
  return undefined;
}

export function normaliseerRij(row) {
  const uit = {};
  Object.entries(row || {}).forEach(([k, v]) => { uit[normaliseerHeader(k)] = v; });
  return uit;
}

// Verwerkt één CSV-rij. `parsed` bevat ENKEL ingevulde velden: een lege cel wist
// dus nooit bestaande data (ook niet het gordel/actief/betaald-veld).
export function verwerkRij(rij, { groepNamen = [], gordel = {}, huidigJaar = new Date().getFullYear() } = {}) {
  const r = normaliseerRij(rij);
  const errors = [];
  const waarschuwingen = [];
  const t = (k) => String(r[k] ?? '').trim().replace(/\s+/g, ' ');

  const voornaam = t('Voornaam');
  const achternaam = t('Achternaam');
  const naamKol = t('Naam');
  let naam = '';
  if (voornaam && achternaam) naam = `${voornaam} ${achternaam}`;
  else if (voornaam || achternaam) errors.push('Voornaam én Achternaam zijn beide nodig');
  else if (naamKol) { naam = naamKol; waarschuwingen.push('Naam niet gesplitst'); }
  else errors.push('Naam is verplicht');

  const email = t('Email').toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Ongeldig e-mailadres');

  const geboortedatum = parseDatum(r.Geboortedatum);
  if (geboortedatum === undefined) errors.push(`Ongeldige geboortedatum "${t('Geboortedatum')}" (gebruik DD/MM/JJJJ)`);
  else if (geboortedatum && (+geboortedatum.slice(0, 4) < 1900 || +geboortedatum.slice(0, 4) > huidigJaar)) errors.push('Onwaarschijnlijk geboortejaar');

  const vervaldatum = parseDatum(r.BijdrageVervaldatum);
  if (vervaldatum === undefined) errors.push(`Ongeldige vervaldatum "${t('BijdrageVervaldatum')}" (gebruik DD/MM/JJJJ)`);

  const gordelCode = parseGordel(r.Gordel, gordel);
  if (gordelCode === undefined) errors.push(`Onbekende gordel "${t('Gordel')}" (kies uit: ${(gordel.opties || []).join(', ')} — of een kyu, bv. 5e kyu)`);

  const jaarTxt = t('IngeschrevenJaar');
  const jaar = jaarTxt ? Number(jaarTxt) : null;
  if (jaarTxt && (!Number.isInteger(jaar) || jaar < 1900 || jaar > huidigJaar + 1)) errors.push('Ongeldig ingeschreven jaar');

  const betaald = parseJaNee(r.BijdrageBetaald);
  if (betaald === undefined) errors.push('BijdrageBetaald: gebruik "ja" of "nee"');
  const actief = parseJaNee(r.Actief);
  if (actief === undefined) errors.push('Actief: gebruik "ja" of "nee"');

  const groepen = t('Groepen') ? t('Groepen').split(';').map(g => g.trim()).filter(Boolean) : [];
  const onbekend = groepen.filter(g => !groepNamen.includes(g));
  if (onbekend.length) errors.push(`Onbekende groep(en): ${onbekend.join(', ')}`);

  const parsed = {};
  const zet = (k, v) => {
    if (v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) return;
    parsed[k] = v;
  };
  zet('lidId', t('LidID'));
  if (voornaam && achternaam) { zet('voornaam', voornaam); zet('achternaam', achternaam); }
  zet('naam', naam);
  zet('geboortedatum', geboortedatum);
  zet('email', email);
  zet('telefoon', t('Telefoon'));
  zet('lidnummer', t('Lidnummer'));
  zet('gordel', gordelCode);
  zet('vergunningsnummer', t('Vergunningsnummer'));
  zet('ingeschrevenJaar', jaar);
  zet('groepen', groepen);
  zet('medischeInfo', t('MedischeInfo'));
  zet('noodcontactNaam', t('NoodcontactNaam'));
  zet('noodcontactTelefoon', t('NoodcontactTelefoon'));
  zet('bijdrageBetaald', betaald);
  zet('bijdrageVervaldatum', vervaldatum);
  zet('actief', actief);

  return { errors, waarschuwingen, parsed: errors.length ? null : parsed, weergaveNaam: naam || naamKol };
}

// Sleutel om dubbele rijen binnen één bestand te detecteren.
export function rijSleutel(parsed) {
  if (!parsed) return null;
  if (parsed.lidId) return `id:${parsed.lidId}`;
  if (parsed.vergunningsnummer) return `vg:${parsed.vergunningsnummer}`;
  if (parsed.naam && parsed.geboortedatum) return `nm:${naamSleutel(parsed.naam)}|${parsed.geboortedatum}`;
  return null;
}

// Export-rijen met exact dezelfde kolommen als de import (round-trip in Excel).
// `categorieVan(lid)` en `kyuMap` zijn enkel informatief (worden bij import genegeerd).
export function bouwExportRijen(leden, { categorieVan = () => '', kyuMap = {} } = {}) {
  return leden.map(m => ({
    LidID: m.id || '',
    Voornaam: m.voornaam || '',
    Achternaam: m.achternaam || '',
    Naam: m.naam || '',
    Geboortedatum: isoNaarNl(m.geboortedatum),
    Email: m.email || '',
    Telefoon: m.telefoon || '',
    Lidnummer: m.lidnummer || '',
    Gordel: m.gordel || '',
    Kyu: kyuMap[m.gordel] ?? '',
    Vergunningsnummer: m.vergunningsnummer || '',
    IngeschrevenJaar: m.ingeschrevenJaar || '',
    Groepen: Array.isArray(m.groepen) ? m.groepen.join('; ') : '',
    MedischeInfo: m.medischeInfo || '',
    NoodcontactNaam: m.noodcontactNaam || '',
    NoodcontactTelefoon: m.noodcontactTelefoon || '',
    BijdrageBetaald: m.bijdrageBetaald ? 'ja' : 'nee',
    BijdrageVervaldatum: isoNaarNl(m.bijdrageVervaldatum),
    Actief: m.actief !== false ? 'ja' : 'nee',
    Categorie: categorieVan(m) || '',
  }));
}
