// src/utils/techniekMatching.js
// Gedeelde fuzzy-matching logica voor techniek-namen, gebruikt door:
// - ExcelUpload.jsx (trainingsimport: ruwe naam → databank-entry)
// - Technieken.jsx (databank-import: hernoeming detecteren i.p.v. duplicaat)
// - useRapportenData.js (Rapporten: oude snapshots zonder techniekId alsnog canoniseren)

export const JAPANSE_SYNONIEMEN = {
  'seoi': 'seo', 'seio': 'seo', 'shio': 'shiho',
  'katame': 'gatame', 'goruma': 'guruma', 'geruma': 'guruma',
  'sasai': 'sasae', 'ippon seo': 'ippon seoi', 'gesa': 'kesa', 'tomo': 'tomoe', 'tsuri komi': 'tsurikomi',
};

export function normaliseerTechniek(s) {
  let n = String(s || '').toLowerCase().replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [fout, correct] of Object.entries(JAPANSE_SYNONIEMEN)) {
    n = n.replace(new RegExp('\\b' + fout + '\\b', 'g'), correct);
  }
  return n;
}

// Zoekt de best passende databank-entry voor een ruwe/foutieve techniek-naam.
// databank: array van { techniek, type, ... }. Optioneel filteren op zelfde type.
export function matchTechniek(naam, databank, { type } = {}) {
  if (!naam) return null;
  const kandidaten = type ? databank.filter(t => t.type === type) : databank;
  const b = normaliseerTechniek(naam);
  const bWoorden = new Set(b.split(' '));
  for (const t of kandidaten) {
    if (normaliseerTechniek(t.techniek) === b) return t;
  }
  for (const t of kandidaten) {
    const aWoorden = new Set(normaliseerTechniek(t.techniek).split(' '));
    if (aWoorden.size >= 2 && [...aWoorden].every(w => bWoorden.has(w))) return t;
  }
  for (const t of kandidaten) {
    const aWoorden = new Set(normaliseerTechniek(t.techniek).split(' '));
    if (bWoorden.size >= 2 && [...bWoorden].every(w => aWoorden.has(w))) return t;
  }
  return null;
}
