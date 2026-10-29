// Centrale lid-koppeling: één plek voor het matchen van een persoon aan een lid
// uit ledenbeheer. Elke inschrijvings-/registratieflow (wedstrijden, mail-import,
// backfill en toekomstige evenement-inschrijvingen) hoort dit te gebruiken, zodat
// koppelingen overal op dezelfde, betrouwbare manier gelegd worden.

export const normaliseerNaam = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Bouw zoek-prefixes voor een naam: elk woord (voornaam, achternaam, ...) levert
// al zijn prefixes (vanaf 2 tekens). Hiermee kan je met één Firestore
// array-contains-query op het begin van eender welk naamwoord zoeken.
export function bouwZoekPrefixes(naam) {
  const woorden = String(naam || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const set = new Set();
  for (const w of woorden) {
    if (w.length === 1) { set.add(w); continue; }
    for (let i = 2; i <= w.length; i++) set.add(w.slice(0, i));
  }
  return [...set];
}

export function jaarUitGeboortedatum(d) {
  if (!d) return null;
  const jaar = new Date(d).getFullYear();
  return Number.isFinite(jaar) ? jaar : null;
}

// Vind exact één actief lid dat op naam matcht. Bij meerdere naamgenoten wordt
// geprobeerd te ontdubbelen op geboortejaar. Geeft null terug bij geen of een
// dubbelzinnige match — dan wordt er bewust NIET gekoppeld (vrij veld).
export function vindUniekLid(naam, geboortejaar, leden) {
  const genaam = normaliseerNaam(naam);
  if (!genaam || !Array.isArray(leden)) return null;

  const treffers = leden.filter(m => normaliseerNaam(m.naam || m.name) === genaam);
  if (treffers.length === 1) return treffers[0];
  if (treffers.length === 0) return null;

  if (geboortejaar) {
    const exact = treffers.filter(m => jaarUitGeboortedatum(m.geboortedatum) === Number(geboortejaar));
    if (exact.length === 1) return exact[0];
  }
  return null; // dubbelzinnig → niet koppelen
}

// Bouw de lid-velden voor een inschrijving op basis van een gekozen/gevonden lid.
export function lidVeldenVoorInschrijving(member) {
  return {
    memberId: member.id,
    judokaNaam: member.naam || member.name || '',
    geboortejaar: jaarUitGeboortedatum(member.geboortedatum),
  };
}

// ── Naamvelden (voornaam / achternaam) ──────────────────────────────────────
// `naam` blijft het legacy-veld (nooit automatisch herschreven). Nieuwe velden
// `voornaam` en `achternaam` staan er los naast. Alles hieronder is pure logica.

const zonderAccenten = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Volgorde-onafhankelijke sleutel: "Kintaert Oscar" en "Oscar Kintaert" geven
// dezelfde sleutel. Gebruikt voor matching bij import (samen met geboortedatum).
export function naamSleutel(naam) {
  return zonderAccenten(naam).toLowerCase().split(/\s+/).filter(Boolean).sort().join(' ');
}

// Weergavenaam: "Voornaam Achternaam" als gesplitst, anders de legacy naam.
export function lidWeergaveNaam(m) {
  const v = String(m?.voornaam || '').trim();
  const a = String(m?.achternaam || '').trim();
  if (v && a) return `${v} ${a}`;
  return String(m?.naam || m?.name || '').trim();
}

// Voor exports met aparte kolommen. Ongesplitste leden: de legacy naam staat
// volledig in `achternaam` (volgorde is onbekend, dus we raden niet).
export function lidNaamDelen(m) {
  const v = String(m?.voornaam || '').trim();
  const a = String(m?.achternaam || '').trim();
  if (v && a) return { voornaam: v, achternaam: a };
  return { voornaam: '', achternaam: String(m?.naam || m?.name || '').trim() };
}

// Zoekt woord-voor-woord, volgorde-onafhankelijk: "Oscar Kintaert" vindt ook een
// lid met legacy-naam "Kintaert Oscar". Zonder term: altijd true.
export function lidMatchtZoekterm(m, term) {
  const woorden = zonderAccenten(term).toLowerCase().split(/\s+/).filter(Boolean);
  if (woorden.length === 0) return true;
  const hooi = zonderAccenten(`${lidWeergaveNaam(m)} ${m?.naam || ''}`).toLowerCase();
  return woorden.every(w => hooi.includes(w));
}

// Sorteersleutel: "achternaam voornaam" als gesplitst, anders legacy naam.
export function lidSorteerSleutel(m) {
  const v = String(m?.voornaam || '').trim();
  const a = String(m?.achternaam || '').trim();
  return v && a ? `${a} ${v}` : String(m?.naam || m?.name || '').trim();
}

export function vergelijkLeden(a, b) {
  return lidSorteerSleutel(a).localeCompare(lidSorteerSleutel(b), 'nl', { sensitivity: 'base' });
}

// Splitst een volledige naam in één stap. Het laatste/eerste woord wordt de
// voornaam; de rest is de achternaam (tussenvoegsels zoals "Van de" blijven zo
// bij de achternaam). Samengestelde voornamen moeten manueel gecorrigeerd worden.
export function splitsNaam(naam, volgorde) {
  const t = String(naam || '').trim().split(/\s+/).filter(Boolean);
  if (t.length === 0) return { voornaam: '', achternaam: '' };
  if (t.length === 1) return { voornaam: '', achternaam: t[0] };
  if (volgorde === 'achternaam-eerst') {
    return { voornaam: t[t.length - 1], achternaam: t.slice(0, -1).join(' ') };
  }
  return { voornaam: t[0], achternaam: t.slice(1).join(' ') };
}

// Probeert de volgorde af te leiden uit bekende voornamen (leden die al gesplitst
// zijn) en uit herhaling: een achternaam komt vaak voor bij broers/zussen, een
// voornaam zelden. Geeft null terug als het niet zeker is.
export function detecteerVolgorde(naam, bekendeVoornamen, eersteFreq = new Map(), laatsteFreq = new Map()) {
  const t = String(naam || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (t.length < 2) return null;
  const eerste = t[0];
  const laatste = t[t.length - 1];
  const eersteBekend = bekendeVoornamen.has(eerste);
  const laatsteBekend = bekendeVoornamen.has(laatste);
  if (eersteBekend && !laatsteBekend) return 'voornaam-eerst';
  if (laatsteBekend && !eersteBekend) return 'achternaam-eerst';
  const eerstHerhaald = (eersteFreq.get(eerste) || 0) >= 2;
  const laatstHerhaald = (laatsteFreq.get(laatste) || 0) >= 2;
  if (eerstHerhaald && !laatstHerhaald) return 'achternaam-eerst';
  if (laatstHerhaald && !eerstHerhaald) return 'voornaam-eerst';
  return null;
}
