// src/utils/auditDiff.js
// Pure helpers om auditLogs (voor/na-snapshots) leesbaar te maken. Gedeeld door
// Beheer > Logboek en de Historiek-tab in LidDetail.

// Vergelijk voor/na en geef array van { veld, oud, nieuw } changes terug.
export function bepaalDiff(voor, na) {
  if (!voor) return Object.entries(na || {}).map(([k, v]) => ({ veld: k, oud: undefined, nieuw: v }));
  if (!na) return Object.entries(voor).map(([k, v]) => ({ veld: k, oud: v, nieuw: undefined }));
  const keys = new Set([...Object.keys(voor), ...Object.keys(na)]);
  const wijzigingen = [];
  keys.forEach(k => {
    if (k === 'updatedAt' || k === 'bijgewerkt') return; // ruis filteren
    const o = voor[k];
    const n = na[k];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      wijzigingen.push({ veld: k, oud: o, nieuw: n });
    }
  });
  return wijzigingen;
}

export function formatWaarde(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'ja' : 'nee';
  if (Array.isArray(v)) return v.length ? v.join(', ') : '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// Technische velden die voor een beheerder geen betekenis hebben.
const TECHNISCH = new Set([
  'updatedAt', 'updatedBy', 'bijgewerkt', 'zoekPrefixes', 'naamLower',
  'aangemaaktOp', 'aangemaaktDoor', 'linkedUserId',
]);

export const LID_VELD_LABELS = {
  naam: 'Naam', voornaam: 'Voornaam', achternaam: 'Achternaam',
  geboortedatum: 'Geboortedatum', email: 'E-mail', telefoon: 'Telefoon',
  lidnummer: 'Lidnummer', gordel: 'Gordel', vergunningsnummer: 'Vergunningsnr.',
  ingeschrevenJaar: 'Ingeschreven in', groepen: 'Groepen', actief: 'Actief',
  noodcontactNaam: 'Noodcontact', noodcontactTelefoon: 'Noodcontact tel.',
  fotoUrl: 'Foto',
};

// Wijzigingen voor één lid, zonder technische ruis. Bij 'aanmaken'/'verwijderen'
// geven we geen veldlijst (die zou het hele document herhalen).
export function lidWijzigingen(log) {
  if (!log || log.type !== 'bijwerken') return [];
  return bepaalDiff(log.voor, log.na)
    .filter(w => !TECHNISCH.has(w.veld))
    .map(w => ({ ...w, label: LID_VELD_LABELS[w.veld] || w.veld }));
}
