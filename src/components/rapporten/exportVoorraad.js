// src/components/rapporten/exportVoorraad.js
// Excel-voorraadrapport voor bestuur en boekhouding.
// Tabbladen: Dashboard · Voorraad · Tweedehands
// Berekende kolommen zijn Excel-formules (met voorberekend resultaat), zodat de
// boekhouder prijzen of stock kan aanpassen en alles automatisch herrekent.

import {
  maakWorkbook, voegSheetHeaderToe, styleTotaalRow, downloadWorkbook, bestandsnaam,
  zetPrintInstellingen, EURO_FMT, PCT_FMT, DATUM_FMT, HEADER_FILL, HEADER_FONT, TOTAAL_FILL,
} from './exportHelpers';
import { berekenVoorraadRapport, LAGE_STOCK_DREMPEL } from './voorraadRapport';

const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const ROOD = fill('FFFECACA');
const ORANJE = fill('FFFED7AA');
const GROEN = fill('FFBBF7D0');
const GRIJS_TEKST = { color: { argb: 'FF94A3B8' }, italic: true };

const f = (formula, result) => ({ formula, result });

function titelRij(ws, rij, tekst, grootte = 12) {
  const c = ws.getCell(`A${rij}`);
  c.value = tekst;
  c.font = { bold: true, size: grootte, color: { argb: 'FF1E3A8A' } };
}

function koprij(ws, rij, titels) {
  titels.forEach((t, i) => {
    const c = ws.getRow(rij).getCell(i + 1);
    c.value = t;
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { horizontal: i === 0 ? 'left' : 'right' };
  });
}

// ── Tabblad Voorraad ────────────────────────────────────────────────────────
function bouwVoorraad(ws, rapport) {
  voegSheetHeaderToe(
    ws,
    [28, 26, 30, 14, 9, 8, 13, 13, 14, 14, 12, 10, 14, 14].map(width => ({ width })),
    ['Categorie', 'Product', 'Variant', 'Staat', 'Actief', 'Stock', 'Verkoopprijs', 'Aankoopprijs',
     'Voorraadwaarde', 'Verkoopwaarde', 'Marge/stuk', 'Marge %', 'Totale marge', 'Status'],
  );
  const { rijen } = rapport;
  rijen.forEach((x, i) => {
    const r = i + 2;
    const row = ws.addRow([
      x.categorieLabel, x.naam, x.variant,
      x.tweedehands ? 'Tweedehands' : 'Nieuw',
      x.actief ? 'Ja' : 'Nee',
      x.stock, x.prijs, x.aankoop,
      f(`F${r}*H${r}`, x.voorraadwaarde),
      f(`F${r}*G${r}`, x.verkoopwaarde),
      f(`G${r}-H${r}`, x.margePerStuk),
      f(`IF(G${r}>0,K${r}/G${r},"")`, x.margePct ?? ''),
      f(`F${r}*K${r}`, x.margeTotaal),
      f(`IF(E${r}="Nee","INACTIEF",IF(F${r}<=0,"UITVERKOCHT",IF(F${r}<${LAGE_STOCK_DREMPEL},"LAAG","OK")))`, x.status),
    ]);
    [7, 8, 9, 10, 11, 13].forEach(c => { row.getCell(c).numFmt = EURO_FMT; });
    row.getCell(12).numFmt = PCT_FMT;
    row.getCell(5).alignment = { horizontal: 'center' };
    row.getCell(14).alignment = { horizontal: 'center' };
  });

  const laatste = rijen.length + 1;
  if (rijen.length === 0) return laatste;

  const tot = ws.addRow([]);
  const t = tot.number;
  const som = (col, val) => f(`SUMIFS(${col}2:${col}${laatste},E2:E${laatste},"Ja")`, val);
  tot.getCell(1).value = 'Totaal (enkel actieve producten)';
  tot.getCell(6).value = som('F', rapport.actief.stuks);
  tot.getCell(9).value = som('I', rapport.actief.voorraadwaarde);
  tot.getCell(10).value = som('J', rapport.actief.verkoopwaarde);
  tot.getCell(13).value = som('M', rapport.actief.marge);
  [9, 10, 13].forEach(c => { tot.getCell(c).numFmt = EURO_FMT; });
  styleTotaalRow(tot);

  ws.autoFilter = `A1:N${laatste}`;
  const kleur = (tekst, vul, tekstKleur) => ({
    type: 'expression', formulae: [`$N2="${tekst}"`], priority: 0,
    style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: vul } }, font: { bold: true, color: { argb: tekstKleur } } },
  });
  ws.addConditionalFormatting({
    ref: `N2:N${laatste}`,
    rules: [
      { ...kleur('UITVERKOCHT', 'FFFECACA', 'FF991B1B'), priority: 1 },
      { ...kleur('LAAG', 'FFFED7AA', 'FF9A3412'), priority: 2 },
      { ...kleur('OK', 'FFBBF7D0', 'FF166534'), priority: 3 },
    ],
  });
  ws.addConditionalFormatting({
    ref: `A2:M${laatste}`,
    rules: [{
      type: 'expression', formulae: ['$E2="Nee"'], priority: 4,
      style: { font: { italic: true, color: { argb: 'FF94A3B8' } } },
    }],
  });
  zetPrintInstellingen(ws);
  return laatste;
}

// ── Tabblad Tweedehands ─────────────────────────────────────────────────────
function bouwTweedehands(ws, rapport) {
  voegSheetHeaderToe(
    ws,
    [24, 28, 8, 13, 13, 22, 16, 36, 16, 9].map(width => ({ width })),
    ['Product', 'Variant', 'Stock', 'Verkoopprijs', 'Aankoopprijs', 'Herkomst', 'Staat', 'Opmerking', 'Laatst ontvangen', 'Actief'],
  );
  rapport.tweedehandsRijen.forEach(x => {
    const row = ws.addRow([
      x.naam, x.variant, x.stock, x.prijs, x.aankoop,
      x.herkomst, x.staat, x.opmerking, x.ontvangenOp, x.actief ? 'Ja' : 'Nee',
    ]);
    row.getCell(4).numFmt = EURO_FMT;
    row.getCell(5).numFmt = EURO_FMT;
    row.getCell(9).numFmt = DATUM_FMT;
    row.getCell(8).alignment = { wrapText: true, vertical: 'top' };
    row.getCell(10).alignment = { horizontal: 'center' };
    if (!x.actief) row.eachCell(c => { c.font = GRIJS_TEKST; });
  });
  const n = rapport.tweedehandsRijen.length;
  if (n === 0) {
    ws.addRow(['Geen tweedehands artikelen in stock.']);
  } else {
    ws.autoFilter = `A1:J${n + 1}`;
    ws.addRow([]);
    const nota = ws.addRow(['Enkel tweedehands met stock > 0. Herkomst, staat en opmerking tonen de laatste ontvangst per variant.']);
    nota.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  }
  zetPrintInstellingen(ws);
}

// ── Tabblad Dashboard ───────────────────────────────────────────────────────
function bouwDashboard(ws, rapport, { peildatum, exporteur, laatsteRij }) {
  [34, 17, 17, 17, 17, 17].forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  const R = col => `Voorraad!$${col}$2:$${col}$${laatsteRij}`;
  const heeftData = laatsteRij >= 2 && rapport.rijen.length > 0;

  titelRij(ws, 1, 'Judoclub Kodokan Merchtem — Voorraadrapport', 16);
  ws.getCell('A2').value = `Peildatum: ${peildatum}${exporteur ? `  ·  Opgesteld door: ${exporteur}` : ''}`;
  ws.getCell('A2').font = { color: { argb: 'FF64748B' } };
  ws.getCell('A3').value = 'Waardering aan aankoopprijs. Verkoopwaarde en marge zijn potentieel (volledige uitverkoop aan huidige prijs).';
  ws.getCell('A3').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  // Controle
  let rij = 5;
  titelRij(ws, rij++, 'Controle van de gegevens');
  const c = rapport.controle;
  const meldingen = [];
  if (c.zonderAankoopprijs) meldingen.push(`${c.zonderAankoopprijs} nieuwe product(en) met stock maar zonder aankoopprijs: voorraadwaarde is onderschat.`);
  if (c.zonderVerkoopprijs) meldingen.push(`${c.zonderVerkoopprijs} product(en) met stock maar zonder verkoopprijs: verkoopwaarde en marge zijn onderschat.`);
  if (c.negatieveStock) meldingen.push(`${c.negatieveStock} product(en) met negatieve stock: controleer de stockmutaties.`);
  if (rapport.inactief.producten) meldingen.push(`${rapport.inactief.producten} inactief(e) product(en) (${rapport.inactief.stuks} stuks) staan op het tabblad Voorraad maar tellen niet mee in dit overzicht.`);
  if (!meldingen.length) meldingen.push('✔ Geen aandachtspunten gevonden.');
  meldingen.forEach(m => {
    ws.mergeCells(`A${rij}:F${rij}`);
    const cel = ws.getCell(`A${rij}`);
    cel.value = m;
    const ernstig = !m.startsWith('✔') && !m.includes('inactief');
    cel.fill = m.startsWith('✔') ? GROEN : ernstig ? ROOD : fill('FFF1F5F9');
    cel.alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(rij).height = m.length > 95 ? 32 : 18;
    rij++;
  });

  // KPI's
  rij++;
  titelRij(ws, rij++, 'Kerncijfers (actieve producten)');
  koprij(ws, rij++, ['Indicator', 'Nieuw', 'Tweedehands', 'Totaal']);
  const kpis = [
    ['Aantal producten (varianten)', 'producten', n => `COUNTIFS(${R('E')},"Ja",${R('D')},"${n}")`, null],
    ['Stuks in stock', 'stuks', n => `SUMIFS(${R('F')},${R('E')},"Ja",${R('D')},"${n}")`, null],
    ['Voorraadwaarde (aankoop)', 'voorraadwaarde', n => `SUMIFS(${R('I')},${R('E')},"Ja",${R('D')},"${n}")`, EURO_FMT],
    ['Potentiële verkoopwaarde', 'verkoopwaarde', n => `SUMIFS(${R('J')},${R('E')},"Ja",${R('D')},"${n}")`, EURO_FMT],
    ['Potentiële marge', 'marge', n => `SUMIFS(${R('M')},${R('E')},"Ja",${R('D')},"${n}")`, EURO_FMT],
    ['Uitverkochte artikelen', 'uitverkocht', n => `COUNTIFS(${R('N')},"UITVERKOCHT",${R('D')},"${n}")`, null],
    [`Lage voorraad (< ${LAGE_STOCK_DREMPEL})`, 'laag', n => `COUNTIFS(${R('N')},"LAAG",${R('D')},"${n}")`, null],
  ];
  kpis.forEach(([label, key, formule, fmt]) => {
    const r = rij++;
    ws.getCell(`A${r}`).value = label;
    const nieuw = rapport.nieuw[key];
    const tweede = rapport.tweedehands[key];
    ws.getCell(`B${r}`).value = heeftData ? f(formule('Nieuw'), nieuw) : nieuw;
    ws.getCell(`C${r}`).value = heeftData ? f(formule('Tweedehands'), tweede) : tweede;
    ws.getCell(`D${r}`).value = f(`B${r}+C${r}`, nieuw + tweede);
    ['B', 'C', 'D'].forEach(col => { if (fmt) ws.getCell(`${col}${r}`).numFmt = fmt; });
    ws.getCell(`D${r}`).font = { bold: true };
  });

  // Per categorie
  rij++;
  titelRij(ws, rij++, 'Per categorie (actieve producten)');
  koprij(ws, rij++, ['Categorie', 'Producten', 'Stuks', 'Voorraadwaarde', 'Verkoopwaarde', 'Potentiële marge']);
  const startCat = rij;
  rapport.perCategorie.forEach(cat => {
    const r = rij++;
    const crit = `${R('A')},$A${r},${R('E')},"Ja"`;
    ws.getCell(`A${r}`).value = cat.label;
    ws.getCell(`B${r}`).value = heeftData ? f(`COUNTIFS(${crit})`, cat.producten) : cat.producten;
    ws.getCell(`C${r}`).value = heeftData ? f(`SUMIFS(${R('F')},${crit})`, cat.stuks) : cat.stuks;
    ws.getCell(`D${r}`).value = heeftData ? f(`SUMIFS(${R('I')},${crit})`, cat.voorraadwaarde) : cat.voorraadwaarde;
    ws.getCell(`E${r}`).value = heeftData ? f(`SUMIFS(${R('J')},${crit})`, cat.verkoopwaarde) : cat.verkoopwaarde;
    ws.getCell(`F${r}`).value = heeftData ? f(`SUMIFS(${R('M')},${crit})`, cat.marge) : cat.marge;
    ['D', 'E', 'F'].forEach(col => { ws.getCell(`${col}${r}`).numFmt = EURO_FMT; });
  });
  if (rapport.perCategorie.length) {
    const r = rij++;
    const eind = r - 1;
    const tot = ws.getRow(r);
    tot.getCell(1).value = 'Totaal';
    ['B', 'C', 'D', 'E', 'F'].forEach((col, i) => {
      const key = ['producten', 'stuks', 'voorraadwaarde', 'verkoopwaarde', 'marge'][i];
      tot.getCell(col).value = f(`SUM(${col}${startCat}:${col}${eind})`, rapport.actief[key]);
      if (i >= 2) tot.getCell(col).numFmt = EURO_FMT;
    });
    styleTotaalRow(tot);
  }

  // Opvolging
  rij++;
  titelRij(ws, rij++, `Opvolging (stock < ${LAGE_STOCK_DREMPEL})`);
  const groepen = [
    ...rapport.opvolging.uitverkocht.map(g => ({ ...g, status: 'UITVERKOCHT', vul: ROOD })),
    ...rapport.opvolging.laag.map(g => ({ ...g, status: 'LAAG', vul: ORANJE })),
  ];
  if (!groepen.length) {
    ws.getCell(`A${rij}`).value = '✔ Geen uitverkochte of bijna uitverkochte artikelen.';
  }
  groepen.forEach(g => {
    ws.mergeCells(`B${rij}:F${rij}`);
    const a = ws.getCell(`A${rij}`);
    a.value = `${g.status} · ${g.categorieLabel} (${g.items.length})`;
    a.fill = g.vul;
    a.font = { bold: true };
    a.alignment = { vertical: 'top', wrapText: true };
    const b = ws.getCell(`B${rij}`);
    b.value = g.items.join(', ');
    b.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(rij).height = Math.max(18, Math.ceil(b.value.length / 80) * 15 + 3);
    rij++;
  });

  ws.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

// ── Publieke API ────────────────────────────────────────────────────────────
// Los van de download, zodat het in tests/node kan draaien.
export async function bouwVoorraadWorkbook(products, { cats, catLabels, exporteur, nu = new Date() } = {}, wbInput) {
  const rapport = berekenVoorraadRapport(products, { ...(cats && { cats }), ...(catLabels && { catLabels }) });
  const wb = wbInput || await maakWorkbook();
  wb.creator = 'Clubapp Kodokan';
  wb.created = nu;

  const dash = wb.addWorksheet('Dashboard', { properties: { tabColor: { argb: 'FF1E3A8A' } } });
  const voorraad = wb.addWorksheet('Voorraad');
  const tweedehands = wb.addWorksheet('Tweedehands');

  const laatsteRij = bouwVoorraad(voorraad, rapport);
  bouwTweedehands(tweedehands, rapport);
  const peildatum = nu.toLocaleString('nl-BE', { dateStyle: 'long', timeStyle: 'short' });
  bouwDashboard(dash, rapport, { peildatum, exporteur, laatsteRij });
  return { wb, rapport };
}

export async function exportVoorraad(products, opties = {}) {
  const nu = new Date();
  const { wb } = await bouwVoorraadWorkbook(products, { ...opties, nu });
  const iso = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
  await downloadWorkbook(wb, bestandsnaam('voorraad', iso));
}
