// src/utils/datumUtils.js
// Centrale datumformatering voor de hele app. Weergave altijd dd/mm/yyyy.
// Firestore-opslag en <input type="date"> gebruiken intern ISO (yyyy-mm-dd).

/**
 * Formatteer datum naar dd/mm/yyyy.
 * Accepteert: Date-object, ISO-string (yyyy-mm-dd), Firestore Timestamp.
 */
export function formatDatum(waarde) {
  if (!waarde) return '';
  let d;
  if (waarde?.toDate) {
    d = waarde.toDate();
  } else if (waarde instanceof Date) {
    d = waarde;
  } else {
    d = new Date(waarde);
  }
  if (isNaN(d.getTime())) return String(waarde);
  const dag = String(d.getDate()).padStart(2, '0');
  const maand = String(d.getMonth() + 1).padStart(2, '0');
  const jaar = d.getFullYear();
  return `${dag}/${maand}/${jaar}`;
}

/**
 * Formatteer datum + tijd naar dd/mm/yyyy HH:mm.
 */
export function formatDatumTijd(waarde) {
  if (!waarde) return '';
  let d;
  if (waarde?.toDate) {
    d = waarde.toDate();
  } else if (waarde instanceof Date) {
    d = waarde;
  } else {
    d = new Date(waarde);
  }
  if (isNaN(d.getTime())) return String(waarde);
  const dag = String(d.getDate()).padStart(2, '0');
  const maand = String(d.getMonth() + 1).padStart(2, '0');
  const jaar = d.getFullYear();
  const uur = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dag}/${maand}/${jaar} ${uur}:${min}`;
}

/**
 * Parseer dd/mm/yyyy naar ISO-string yyyy-mm-dd (voor Firestore-opslag).
 * Geeft lege string terug bij ongeldige input.
 */
export function datumNaarIso(str) {
  if (!str) return '';
  const match = String(str).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return str;
  const [, d, m, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/**
 * Zet ISO-string yyyy-mm-dd om naar dd/mm/yyyy (voor weergave van opgeslagen data).
 */
export function isoNaarDatum(iso) {
  if (!iso) return '';
  const match = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return iso;
  return `${match[3]}/${match[2]}/${match[1]}`;
}
