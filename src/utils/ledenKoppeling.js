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
