// src/utils/ledenXlsx.js
// Excel (.xlsx) lezen/schrijven voor ledenimport en -export. De rijen hebben
// exact dezelfde vorm als bij CSV, zodat verwerkRij() ongewijzigd blijft.
// exceljs wordt dynamisch geladen (zit al in het project, niet in de hoofdbundle).

import { normaliseerHeader, isoNaarNl } from './ledenImport';
import { maakWorkbook, voegSheetHeaderToe } from '../components/rapporten/exportHelpers';

export const MAX_XLSX_BYTES = 5 * 1024 * 1024;
export const MAX_XLSX_RIJEN = 5000;

const pad = (n) => String(n).padStart(2, '0');

// Eén cel → tekst, zoals Papa dat voor CSV zou leveren.
export function celNaarTekst(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return `${pad(v.getUTCDate())}/${pad(v.getUTCMonth() + 1)}/${v.getUTCFullYear()}`;
  }
  if (typeof v === 'boolean') return v ? 'ja' : 'nee';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(t => t.text || '').join('');
    if ('result' in v) return celNaarTekst(v.result);       // formule
    if (typeof v.text === 'string') return v.text;           // hyperlink
    if (v.text && typeof v.text === 'object') return celNaarTekst(v.text);
    if ('error' in v) return '';
  }
  return String(v);
}

// Geeft { rijen, startRij } terug. rijen = [{ Header: waarde }], startRij = het
// Excel-rijnummer van de eerste datarij (voor correcte foutmeldingen).
export async function leesXlsxRijen(buffer) {
  if (buffer.byteLength > MAX_XLSX_BYTES) throw new Error('Het Excel-bestand is groter dan 5 MB.');
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    throw new Error('Dit is geen geldig .xlsx-bestand (oudere .xls wordt niet ondersteund).');
  }
  const ws = wb.getWorksheet('Leden') || wb.worksheets[0];
  if (!ws) throw new Error('Het Excel-bestand bevat geen werkblad.');
  if (ws.rowCount > MAX_XLSX_RIJEN + 1) throw new Error(`Maximaal ${MAX_XLSX_RIJEN} rijen per import.`);

  let headerRij = 0;
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    const heeftWaarde = ws.getRow(r).values.some(x => celNaarTekst(x).trim() !== '');
    if (heeftWaarde) { headerRij = r; break; }
  }
  if (!headerRij) throw new Error('Geen koptekstrij gevonden.');

  // Eerste kolom met een bepaalde (genormaliseerde) header wint; zo kan een extra
  // "Kyu"-kolom een bewerkte "Gordel"-kolom nooit overschrijven.
  const headers = [];
  const gezien = new Set();
  ws.getRow(headerRij).values.forEach((cel, col) => {
    const h = normaliseerHeader(celNaarTekst(cel).trim());
    if (h && !gezien.has(h)) { gezien.add(h); headers[col] = h; }
  });
  if (!headers.some(Boolean)) throw new Error('Geen geldige kolomnamen gevonden.');

  const rijen = [];
  for (let r = headerRij + 1; r <= ws.rowCount; r++) {
    const waarden = ws.getRow(r).values;
    const obj = {};
    let leeg = true;
    headers.forEach((h, col) => {
      if (!h) return;
      const t = celNaarTekst(waarden[col]);
      if (t.trim() !== '') leeg = false;
      obj[h] = t;
    });
    if (!leeg) rijen.push(obj);
  }
  return { rijen, startRij: headerRij + 1 };
}

const TEKST_KOLOMMEN = new Set(['LidID', 'Telefoon', 'Lidnummer', 'Vergunningsnummer', 'NoodcontactTelefoon']);
const DATUM_KOLOMMEN = new Set(['Geboortedatum', 'BijdrageVervaldatum']);
const INFO_KOLOMMEN = new Set(['LidID', 'Naam', 'Kyu', 'Categorie']); // niet bedoeld om te bewerken
const BREEDTE = { LidID: 22, Voornaam: 16, Achternaam: 20, Naam: 22, Geboortedatum: 14, Email: 26, Groepen: 22, MedischeInfo: 24 };

function naarDatum(nl) {
  const mt = String(nl || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return mt ? new Date(Date.UTC(+mt[3], +mt[2] - 1, +mt[1])) : null;
}

// rijen = resultaat van bouwExportRijen(); zelfde kolommen als de CSV-export.
export async function maakLedenWorkbook(rijen) {
  const wb = await maakWorkbook();
  const ws = wb.addWorksheet('Leden');
  const kolommen = rijen.length ? Object.keys(rijen[0]) : ['LidID', 'Voornaam', 'Achternaam'];
  voegSheetHeaderToe(ws, kolommen.map(k => ({ key: k, width: BREEDTE[k] || 16 })), kolommen);

  rijen.forEach(rij => {
    const excelRij = ws.addRow(kolommen.map(k => {
      if (DATUM_KOLOMMEN.has(k)) return naarDatum(rij[k]) || rij[k] || null;
      return rij[k] ?? '';
    }));
    kolommen.forEach((k, i) => {
      const cel = excelRij.getCell(i + 1);
      if (TEKST_KOLOMMEN.has(k)) { cel.numFmt = '@'; cel.value = String(rij[k] ?? ''); }
      if (DATUM_KOLOMMEN.has(k) && cel.value instanceof Date) cel.numFmt = 'dd/mm/yyyy';
      if (INFO_KOLOMMEN.has(k)) cel.font = { color: { argb: 'FF808080' } };
    });
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: kolommen.length } };

  const uitleg = wb.addWorksheet('Uitleg');
  uitleg.getColumn(1).width = 100;
  [
    'Aanpassen en terug importeren:',
    '• Bewerk de kolommen op blad "Leden" en importeer het bestand via Ledenbeheer > Importeren (modus "Aanvullen en bijwerken").',
    '• LidID (grijs) niet wijzigen of wissen: daarmee wordt elke rij exact aan het juiste lid gekoppeld.',
    '• Naam, Kyu en Categorie (grijs) zijn enkel informatief. Wijzig Voornaam/Achternaam en Gordel.',
    '• Een lege cel wist nooit bestaande gegevens.',
    '• Datums als dd/mm/jjjj. Ja/nee-velden: ja of nee.',
  ].forEach(t => uitleg.addRow([t]));
  uitleg.getRow(1).font = { bold: true };
  return wb;
}
