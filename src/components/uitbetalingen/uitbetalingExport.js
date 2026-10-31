// src/components/uitbetalingen/uitbetalingExport.js
// Excel-exports van de Uitbetalingen-pagina. Pure functies: data erin, bestand eruit.
// Gebruikt de gedeelde helpers van de Rapporten-exports (exceljs wordt lazy geladen).
import {
  maakWorkbook, downloadWorkbook, styleHeaderRow, TOTAAL_FILL, EURO_FMT, zetPrintInstellingen,
} from '../rapporten/exportHelpers';
import { afrekeningNaam, bestandsDeel, formatDagKort, formatDatumLeesbaar, afrond2 } from './uitbetalingHelpers';

const DUN    = { style: 'thin',   color: { argb: 'FFCBD5E1' } };
const MIDDEL = { style: 'medium', color: { argb: 'FF1E293B' } };
const RAND   = { top: DUN, left: DUN, bottom: DUN, right: DUN };
const ZEBRA  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ─── Trainingen: Lesgever | Type | Uren | €/u | Totaal € | datums… ────────────────
export async function exporteerTrainingenXlsx({ rijen, datums, periode }) {
  const naam = afrekeningNaam(periode?.naam);
  const wb = await maakWorkbook();
  const ws = wb.addWorksheet('Uitbetaling');
  const kop = ['Lesgever', 'Type', 'Uren', '€/u', 'Totaal €', ...datums.map(formatDagKort)];
  const aantalKol = kop.length;
  ws.addRow(kop);

  const celTekst = (c) => `${c.groepen.join(' + ') || 'Training'} (${afrond2(c.uren)}u)`;
  rijen.forEach((r, i) => {
    const nr = i + 2;
    ws.addRow([
      r.naam, r.typeLabel, r.uren,
      r.tarief > 0 ? r.tarief : '',
      r.bedrag != null ? { formula: `C${nr}*D${nr}`, result: r.bedrag } : '',
      ...datums.map(d => (r.cellen[d] ? celTekst(r.cellen[d]) : '')),
    ]);
  });

  if (rijen.length > 0) {
    const eerste = 2, laatste = rijen.length + 1;
    const somUren   = afrond2(rijen.reduce((s, r) => s + r.uren, 0));
    const somBedrag = afrond2(rijen.reduce((s, r) => s + (r.bedrag || 0), 0));
    const totRij = ws.addRow([
      'TOTAAL', '',
      { formula: `SUM(C${eerste}:C${laatste})`, result: somUren }, '',
      { formula: `SUM(E${eerste}:E${laatste})`, result: somBedrag },
      ...datums.map(d => afrond2(rijen.reduce((s, r) => s + (r.cellen[d]?.uren || 0), 0)) || ''),
    ]);
    totRij.eachCell({ includeEmpty: true }, c => { c.font = { bold: true }; c.fill = TOTAAL_FILL; });
  }

  // Opmaak
  styleHeaderRow(ws.getRow(1));
  const laatsteRij = ws.rowCount;
  for (let r = 1; r <= laatsteRij; r++) {
    for (let c = 1; c <= aantalKol; c++) {
      const cel = ws.getCell(r, c);
      cel.border = {
        ...RAND,
        ...(r === 1 ? { bottom: MIDDEL } : {}),
        ...(rijen.length > 0 && r === laatsteRij ? { top: MIDDEL } : {}),
        ...(c === 5 ? { right: MIDDEL } : {}), // scheiding totalen | datums
      };
      if (r === 1) cel.alignment = { horizontal: c <= 2 ? 'left' : 'center', vertical: 'middle', wrapText: true };
      else if (c > 5) cel.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      else if (c >= 3) cel.alignment = { horizontal: 'right', vertical: 'middle' };
      else cel.alignment = { vertical: 'middle' };
      if (r > 1 && (c === 4 || c === 5)) cel.numFmt = EURO_FMT;
    }
  }
  const naamBreedte = rijen.reduce((m, r) => Math.max(m, r.naam.length), 8);
  const breedtes = [clamp(naamBreedte + 3, 18, 36), 11, 8, 11, 13];
  datums.forEach((d, i) => {
    const langste = rijen.reduce((m, r) => Math.max(m, r.cellen[d] ? celTekst(r.cellen[d]).length : 0), 8);
    breedtes.push(clamp(langste + 2, 13, 22));
  });
  breedtes.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
  zetPrintInstellingen(ws);

  await downloadWorkbook(wb, `uitbetaling_${bestandsDeel(naam)}.xlsx`);
}

// ─── Wedstrijdkosten: één blok per wedstrijd, wedstrijd+datum samengevoegd ─────
// rijen: [{eventId,eventNaam,datum,naam,km,inkom}], lijst: totalen per begeleider.
export async function exporteerWedstrijdkostenXlsx({ rijen, lijst, kmTarief, periode }) {
  const naam = afrekeningNaam(periode?.naam);
  const wb = await maakWorkbook();
  const ws = wb.addWorksheet('Wedstrijdkosten');

  ws.addRow([`Onkosten wedstrijden ${naam}`]);
  ws.mergeCells('A1:G1');
  ws.getCell('A1').font = { bold: true, size: 14 };
  ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 26;

  ws.addRow(['Naam wedstrijd', 'Datum', 'Coach', 'Inkom', 'Km', 'Km-vergoeding', 'Totaal']);
  styleHeaderRow(ws.getRow(2));
  ws.getRow(2).eachCell(c => { c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; });

  // Chronologisch, rijen van dezelfde wedstrijd blijven samen
  const gesorteerd = [...rijen].sort((a, b) => a.datum.localeCompare(b.datum) || a.eventId.localeCompare(b.eventId));
  const blokken = [];
  for (const r of gesorteerd) {
    const vorig = blokken[blokken.length - 1];
    if (vorig && vorig.eventId === r.eventId) vorig.rijen.push(r);
    else blokken.push({ eventId: r.eventId, naam: r.eventNaam, datum: r.datum, rijen: [r] });
  }

  const eersteDetail = 3;
  blokken.forEach((blok, bi) => {
    const start = ws.rowCount + 1;
    blok.rijen.forEach((r, ri) => {
      const nr = ws.rowCount + 1;
      ws.addRow([
        ri === 0 ? blok.naam : '',
        ri === 0 ? formatDatumLeesbaar(blok.datum) : '',
        r.naam,
        r.inkom,
        r.km,
        kmTarief > 0 ? afrond2(r.km * kmTarief) : '',
        { formula: `SUM(D${nr},F${nr})`, result: afrond2(r.inkom + (kmTarief > 0 ? r.km * kmTarief : 0)) },
      ]);
    });
    const einde = ws.rowCount;
    if (einde > start) { ws.mergeCells(start, 1, einde, 1); ws.mergeCells(start, 2, einde, 2); }
    for (let r = start; r <= einde; r++) {
      for (let c = 1; c <= 7; c++) {
        const cel = ws.getCell(r, c);
        if (bi % 2 === 1) cel.fill = ZEBRA;
        cel.border = { ...RAND, ...(r === einde ? { bottom: { style: 'thin', color: { argb: 'FF64748B' } } } : {}) };
      }
    }
  });
  const laatsteDetail = ws.rowCount;

  // Totalen per coach (SUMIF, zodat handmatige correcties in Excel doorrekenen) + algemeen
  ws.addRow([]);
  const bereik = (kol) => `${kol}$${eersteDetail}:${kol}$${laatsteDetail}`;
  const totaalRijen = [];
  for (const b of lijst) {
    const nr = ws.rowCount + 1;
    const kmB = kmTarief > 0 ? afrond2(b.kmBedrag) : '';
    ws.addRow([
      'Totaal:', '', b.naam,
      { formula: `SUMIF($C$${eersteDetail}:$C$${laatsteDetail},C${nr},${bereik('D')})`, result: afrond2(b.inkom) },
      { formula: `SUMIF($C$${eersteDetail}:$C$${laatsteDetail},C${nr},${bereik('E')})`, result: afrond2(b.km) },
      { formula: `SUMIF($C$${eersteDetail}:$C$${laatsteDetail},C${nr},${bereik('F')})`, result: kmB === '' ? 0 : kmB },
      { formula: `SUMIF($C$${eersteDetail}:$C$${laatsteDetail},C${nr},${bereik('G')})`, result: afrond2(b.kmBedrag + b.inkom) },
    ]);
    totaalRijen.push(nr);
  }
  const alg = {
    inkom: lijst.reduce((s, b) => s + b.inkom, 0), km: lijst.reduce((s, b) => s + b.km, 0),
    kmB: lijst.reduce((s, b) => s + b.kmBedrag, 0),
  };
  const algNr = ws.rowCount + 1;
  ws.addRow([
    'Totaal:', '', 'Algemeen',
    { formula: `SUM(D${eersteDetail}:D${laatsteDetail})`, result: afrond2(alg.inkom) },
    { formula: `SUM(E${eersteDetail}:E${laatsteDetail})`, result: afrond2(alg.km) },
    { formula: `SUM(F${eersteDetail}:F${laatsteDetail})`, result: kmTarief > 0 ? afrond2(alg.kmB) : 0 },
    { formula: `SUM(G${eersteDetail}:G${laatsteDetail})`, result: afrond2(alg.kmB + alg.inkom) },
  ]);
  totaalRijen.push(algNr);
  for (const nr of totaalRijen) {
    for (let c = 1; c <= 7; c++) {
      const cel = ws.getCell(nr, c);
      cel.font = { bold: true }; cel.fill = TOTAAL_FILL;
      cel.border = { ...RAND, ...(nr === algNr ? { top: MIDDEL, bottom: MIDDEL } : {}) };
    }
  }

  // Opmaak: eurokolommen, uitlijning, breedtes, titels herhalen bij afdrukken
  for (let r = 3; r <= ws.rowCount; r++) {
    for (const c of [4, 6, 7]) ws.getCell(r, c).numFmt = EURO_FMT;
    ws.getCell(r, 1).alignment = { vertical: 'middle', wrapText: true };
    ws.getCell(r, 2).alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getCell(r, 3).alignment = { vertical: 'middle' };
  }
  const langsteWedstrijd = blokken.reduce((m, b) => Math.max(m, b.naam.length), 14);
  const langsteCoach = rijen.reduce((m, r) => Math.max(m, r.naam.length), 8);
  [clamp(langsteWedstrijd + 2, 24, 42), 12, clamp(langsteCoach + 3, 16, 32), 11, 8, 15, 12]
    .forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 2 }];
  zetPrintInstellingen(ws, { herhaalRij: 2 });

  await downloadWorkbook(wb, `wedstrijdkosten_${bestandsDeel(naam)}.xlsx`);
}
