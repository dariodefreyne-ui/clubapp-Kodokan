// src/components/rapporten/exportVoorraad.js
// Excel-voorraadrapport voor bestuur en boekhouding.
// Tabbladen: Dashboard · Voorraad nieuw · Voorraad tweedehands
// Berekende kolommen zijn Excel-formules (met voorberekend resultaat), zodat de
// boekhouder prijzen of stock kan aanpassen en alles automatisch herrekent.

import {
  maakWorkbook, voegSheetHeaderToe, styleTotaalRow, downloadWorkbook, bestandsnaam,
  zetPrintInstellingen, EURO_FMT, PCT_FMT, DATUM_FMT, HEADER_FILL, HEADER_FONT,
} from './exportHelpers';
import { berekenVoorraadRapport, LAGE_STOCK_DREMPEL } from './voorraadRapport';

import {
  FORMAAT_VERSIE, SHEET_NIEUW, SHEET_TWEEDEHANDS, SHEET_META, KOP, META_LABELS, META_KOP,
} from './voorraadFormaat';

export { SHEET_NIEUW, SHEET_TWEEDEHANDS };

const fill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const ROOD = fill('FFFECACA');
const ORANJE = fill('FFFED7AA');
const GROEN = fill('FFBBF7D0');
const LICHTBLAUW = fill('FFDBEAFE');
const LICHTGRIJS = fill('FFF1F5F9');
const INVOER_FILL = fill('FFFEF08A');
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

// ── Voorraad-tabbladen (nieuw en tweedehands delen kolommen A–M) ────────────
// A Categorie · B Product · C Variant · D Actief · E Stock · F Verkoopprijs ·
// G Aankoopprijs · H Voorraadwaarde · I Verkoopwaarde · J Marge/stuk · K Marge % ·
// L Totale marge · M Status   (tweedehands: N Herkomst · O Staat · P Opmerking · Q Laatst ontvangen)
function bouwVoorraadSheet(ws, rijen, tot, { tweedehands }) {
  const basisBreedte = [28, 26, 30, 9, 8, 13, 13, 15, 15, 12, 10, 14, 14];
  const basisTitels = ['Categorie', 'Product', 'Variant', 'Actief', 'Stock', 'Verkoopprijs', 'Aankoopprijs',
    'Voorraadwaarde', 'Verkoopwaarde', 'Marge/stuk', 'Marge %', 'Totale marge', 'Status'];
  const breedte = tweedehands ? [...basisBreedte, 22, 16, 36, 16] : basisBreedte;
  const titels = tweedehands ? [...basisTitels, 'Herkomst', 'Staat', 'Opmerking', 'Laatst ontvangen'] : basisTitels;
  // Verborgen ID-kolom helemaal achteraan; ze zit in het filterbereik zodat sorteren de ID's meeneemt.
  const idKol = titels.length + 1;
  const laatsteKol = ws.getColumn(idKol).letter;
  voegSheetHeaderToe(ws, [...breedte, 14].map(width => ({ width })), [...titels, KOP.id]);
  ws.getColumn(idKol).hidden = true;
  // Invoerkolommen (komen terug in de import) herkenbaar maken: Actief, Stock, Verkoopprijs, Aankoopprijs
  [4, 5, 6, 7].forEach(c => {
    const cel = ws.getRow(1).getCell(c);
    cel.fill = INVOER_FILL;
    cel.font = { bold: true, color: { argb: 'FF713F12' } };
  });

  rijen.forEach((x, i) => {
    const r = i + 2;
    const waarden = [
      x.categorieLabel, x.naam, x.variant,
      x.actief ? 'Ja' : 'Nee',
      x.stock, x.prijs, x.aankoop,
      f(`E${r}*G${r}`, x.voorraadwaarde),
      f(`E${r}*F${r}`, x.verkoopwaarde),
      f(`F${r}-G${r}`, x.margePerStuk),
      f(`IF(F${r}>0,J${r}/F${r},"")`, x.margePct ?? ''),
      f(`E${r}*J${r}`, x.margeTotaal),
      f(`IF(D${r}="Nee","INACTIEF",IF(E${r}<=0,"UITVERKOCHT",IF(E${r}<${LAGE_STOCK_DREMPEL},"LAAG","OK")))`, x.status),
    ];
    if (tweedehands) waarden.push(x.herkomst, x.staat, x.opmerking, x.ontvangenOp);
    waarden.push(x.id);
    const row = ws.addRow(waarden);
    const regel = (extra) => ({ allowBlank: false, showErrorMessage: true, errorStyle: 'stop', errorTitle: 'Ongeldige waarde', ...extra });
    row.getCell(4).dataValidation = regel({ type: 'list', formulae: ['"Ja,Nee"'], error: 'Kies Ja of Nee.' });
    row.getCell(5).dataValidation = regel({ type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], error: 'Geef een geheel getal van 0 of meer.' });
    row.getCell(6).dataValidation = regel({ type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], error: 'Geef een bedrag van 0 of meer.' });
    row.getCell(7).dataValidation = regel({ type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], error: 'Geef een bedrag van 0 of meer.' });
    [6, 7, 8, 9, 10, 12].forEach(c => { row.getCell(c).numFmt = EURO_FMT; });
    row.getCell(11).numFmt = PCT_FMT;
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(13).alignment = { horizontal: 'center' };
    if (tweedehands) {
      row.getCell(16).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(17).numFmt = DATUM_FMT;
    }
  });

  const laatste = rijen.length + 1;
  if (rijen.length === 0) {
    ws.addRow([tweedehands ? 'Geen tweedehands artikelen aangemaakt.' : 'Geen producten gevonden.']);
    return laatste;
  }

  const totRij = ws.addRow([]);
  const som = (col, val) => f(`SUMIFS(${col}2:${col}${laatste},D2:D${laatste},"Ja")`, val);
  totRij.getCell(1).value = 'Totaal (enkel actieve producten)';
  totRij.getCell(5).value = som('E', tot.stuks);
  totRij.getCell(8).value = som('H', tot.voorraadwaarde);
  totRij.getCell(9).value = som('I', tot.verkoopwaarde);
  totRij.getCell(12).value = som('L', tot.marge);
  [8, 9, 12].forEach(c => { totRij.getCell(c).numFmt = EURO_FMT; });
  styleTotaalRow(totRij);

  if (tweedehands) {
    ws.addRow([]);
    const nota = ws.addRow(['Herkomst, staat, opmerking en datum tonen de laatste ontvangst per variant.']);
    nota.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  ws.autoFilter = `A1:${laatsteKol}${laatste}`;
  const statusRegel = (tekst, vul, tekstKleur, priority) => ({
    type: 'expression', formulae: [`$M2="${tekst}"`], priority,
    style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: vul } }, font: { bold: true, color: { argb: tekstKleur } } },
  });
  ws.addConditionalFormatting({
    ref: `M2:M${laatste}`,
    rules: [
      statusRegel('UITVERKOCHT', 'FFFECACA', 'FF991B1B', 1),
      statusRegel('LAAG', 'FFFED7AA', 'FF9A3412', 2),
      statusRegel('OK', 'FFBBF7D0', 'FF166534', 3),
    ],
  });
  ws.addConditionalFormatting({
    ref: `A2:L${laatste}`,
    rules: [{ type: 'expression', formulae: ['$D2="Nee"'], priority: 4, style: { font: GRIJS_TEKST } }],
  });
  zetPrintInstellingen(ws);
  return laatste;
}

// ── Verborgen tabblad met de peilwaarden (basis voor de import) ─────────────
function bouwMetaSheet(wb, rapport, nu) {
  const ws = wb.addWorksheet(SHEET_META, { state: 'hidden' });
  ws.getCell('A1').value = 'Kodokan voorraadrapport — NIET WIJZIGEN (nodig om dit bestand terug te importeren)';
  ws.getCell('A2').value = META_LABELS.versie;   ws.getCell('B2').value = FORMAAT_VERSIE;
  ws.getCell('A3').value = META_LABELS.exportOp; ws.getCell('B3').value = nu.toISOString();
  ws.getCell('A4').value = META_LABELS.aantal;   ws.getCell('B4').value = rapport.rijen.length;
  META_KOP.forEach((t, i) => { ws.getRow(6).getCell(i + 1).value = t; });
  rapport.rijen.forEach(x => {
    ws.addRow([
      x.id, x.naam, x.variant, x.stock, x.prijs, x.aankoop,
      x.actief ? 'Ja' : 'Nee',
      x.tweedehands ? SHEET_TWEEDEHANDS : SHEET_NIEUW,
    ]);
  });
}

// ── Dashboard ───────────────────────────────────────────────────────────────
function bouwDashboard(ws, rapport, { peildatum, exporteur, laatste }) {
  [34, 17, 17, 17, 17, 17].forEach((width, i) => { ws.getColumn(i + 1).width = width; });
  // Bereik in een voorraad-tabblad; sheetnaam met spaties moet tussen quotes.
  const R = (sheet, col) => `'${sheet}'!$${col}$2:$${col}$${laatste[sheet]}`;
  const heeft = sheet => laatste[sheet] >= 2 && (sheet === SHEET_NIEUW ? rapport.nieuwRijen : rapport.tweedehandsRijen).length > 0;

  titelRij(ws, 1, 'Judoclub Kodokan Merchtem — Voorraadrapport', 16);
  ws.getCell('A2').value = `Peildatum: ${peildatum}${exporteur ? `  ·  Opgesteld door: ${exporteur}` : ''}`;
  ws.getCell('A2').font = { color: { argb: 'FF64748B' } };
  ws.getCell('A3').value = 'Waardering aan aankoopprijs. Verkoopwaarde en marge zijn potentieel (volledige uitverkoop aan huidige prijs). Nieuw en tweedehands worden apart gerapporteerd.';
  ws.getCell('A3').font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  ws.getCell('A4').value = 'Aanpassen en terug importeren: wijzig enkel de gele kolommen (Actief, Stock, Verkoopprijs, Aankoopprijs) op de tabbladen Voorraad. Verwijder geen kolommen en hernoem geen tabbladen.';
  ws.getCell('A4').font = { italic: true, size: 9, color: { argb: 'FF713F12' } };

  // Controle
  let rij = 5;
  titelRij(ws, rij++, 'Controle van de gegevens');
  const c = rapport.controle;
  const meldingen = [];
  if (c.zonderAankoopprijs) meldingen.push({ ernstig: true, tekst: `${c.zonderAankoopprijs} nieuwe product(en) met stock maar zonder aankoopprijs: voorraadwaarde is onderschat.` });
  if (c.zonderVerkoopprijs) meldingen.push({ ernstig: true, tekst: `${c.zonderVerkoopprijs} product(en) met stock maar zonder verkoopprijs: verkoopwaarde en marge zijn onderschat.` });
  if (c.negatieveStock) meldingen.push({ ernstig: true, tekst: `${c.negatieveStock} product(en) met negatieve stock: controleer de stockmutaties.` });
  const ina = rapport.inactief;
  if (ina.nieuw.producten) meldingen.push({ tekst: `Nieuw: ${ina.nieuw.producten} inactief(e) product(en) (${ina.nieuw.stuks} stuks) staan op tabblad "${SHEET_NIEUW}" maar tellen niet mee.` });
  if (ina.tweedehands.producten) meldingen.push({ tekst: `Tweedehands: ${ina.tweedehands.producten} inactief(e) product(en) (${ina.tweedehands.stuks} stuks) staan op tabblad "${SHEET_TWEEDEHANDS}" maar tellen niet mee.` });
  if (!meldingen.length) meldingen.push({ ok: true, tekst: '✔ Geen aandachtspunten gevonden.' });
  meldingen.forEach(m => {
    ws.mergeCells(`A${rij}:F${rij}`);
    const cel = ws.getCell(`A${rij}`);
    cel.value = m.tekst;
    cel.fill = m.ok ? GROEN : m.ernstig ? ROOD : LICHTGRIJS;
    cel.alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(rij).height = m.tekst.length > 95 ? 32 : 18;
    rij++;
  });

  // Kerncijfers
  rij++;
  titelRij(ws, rij++, 'Kerncijfers (actieve producten)');
  koprij(ws, rij++, ['Indicator', 'Nieuw', 'Tweedehands', 'Totaal']);
  const kpis = [
    ['Aantal producten (varianten)', 'producten', s => `COUNTIFS(${R(s, 'D')},"Ja")`, null],
    ['Stuks in stock', 'stuks', s => `SUMIFS(${R(s, 'E')},${R(s, 'D')},"Ja")`, null],
    ['Voorraadwaarde (aankoop)', 'voorraadwaarde', s => `SUMIFS(${R(s, 'H')},${R(s, 'D')},"Ja")`, EURO_FMT],
    ['Potentiële verkoopwaarde', 'verkoopwaarde', s => `SUMIFS(${R(s, 'I')},${R(s, 'D')},"Ja")`, EURO_FMT],
    ['Potentiële marge', 'marge', s => `SUMIFS(${R(s, 'L')},${R(s, 'D')},"Ja")`, EURO_FMT],
    ['Uitverkochte artikelen', 'uitverkocht', s => `COUNTIFS(${R(s, 'M')},"UITVERKOCHT")`, null],
    [`Lage voorraad (< ${LAGE_STOCK_DREMPEL})`, 'laag', s => `COUNTIFS(${R(s, 'M')},"LAAG")`, null],
  ];
  kpis.forEach(([label, key, formule, fmt]) => {
    const r = rij++;
    ws.getCell(`A${r}`).value = label;
    const nieuw = rapport.nieuw[key];
    const tweede = rapport.tweedehands[key];
    ws.getCell(`B${r}`).value = heeft(SHEET_NIEUW) ? f(formule(SHEET_NIEUW), nieuw) : nieuw;
    ws.getCell(`C${r}`).value = heeft(SHEET_TWEEDEHANDS) ? f(formule(SHEET_TWEEDEHANDS), tweede) : tweede;
    ws.getCell(`D${r}`).value = f(`B${r}+C${r}`, nieuw + tweede);
    ['B', 'C', 'D'].forEach(col => { if (fmt) ws.getCell(`${col}${r}`).numFmt = fmt; });
    ws.getCell(`D${r}`).font = { bold: true };
  });

  // Per categorie: apart voor nieuw en tweedehands
  const categorieTabel = (titel, sheet, perCat, tot) => {
    rij++;
    titelRij(ws, rij++, titel);
    koprij(ws, rij++, ['Categorie', 'Producten', 'Stuks', 'Voorraadwaarde', 'Verkoopwaarde', 'Potentiële marge']);
    if (!perCat.length) {
      ws.getCell(`A${rij++}`).value = 'Geen actieve producten.';
      return;
    }
    const start = rij;
    perCat.forEach(cat => {
      const r = rij++;
      const crit = `${R(sheet, 'A')},$A${r},${R(sheet, 'D')},"Ja"`;
      ws.getCell(`A${r}`).value = cat.label;
      ws.getCell(`B${r}`).value = f(`COUNTIFS(${crit})`, cat.producten);
      ws.getCell(`C${r}`).value = f(`SUMIFS(${R(sheet, 'E')},${crit})`, cat.stuks);
      ws.getCell(`D${r}`).value = f(`SUMIFS(${R(sheet, 'H')},${crit})`, cat.voorraadwaarde);
      ws.getCell(`E${r}`).value = f(`SUMIFS(${R(sheet, 'I')},${crit})`, cat.verkoopwaarde);
      ws.getCell(`F${r}`).value = f(`SUMIFS(${R(sheet, 'L')},${crit})`, cat.marge);
      ['D', 'E', 'F'].forEach(col => { ws.getCell(`${col}${r}`).numFmt = EURO_FMT; });
    });
    const r = rij++;
    const totRij = ws.getRow(r);
    totRij.getCell(1).value = 'Totaal';
    ['B', 'C', 'D', 'E', 'F'].forEach((col, i) => {
      const key = ['producten', 'stuks', 'voorraadwaarde', 'verkoopwaarde', 'marge'][i];
      totRij.getCell(col).value = f(`SUM(${col}${start}:${col}${r - 1})`, tot[key]);
      if (i >= 2) totRij.getCell(col).numFmt = EURO_FMT;
    });
    styleTotaalRow(totRij);
  };
  categorieTabel('Per categorie — nieuw', SHEET_NIEUW, rapport.perCategorie.nieuw, rapport.nieuw);
  categorieTabel('Per categorie — tweedehands', SHEET_TWEEDEHANDS, rapport.perCategorie.tweedehands, rapport.tweedehands);

  // Opvolging: apart voor nieuw en tweedehands
  rij++;
  titelRij(ws, rij++, `Opvolging (stock < ${LAGE_STOCK_DREMPEL})`);
  const opvolgingBlok = (label, opv) => {
    ws.mergeCells(`A${rij}:F${rij}`);
    const kop = ws.getCell(`A${rij}`);
    kop.value = label;
    kop.fill = LICHTBLAUW;
    kop.font = { bold: true, color: { argb: 'FF1E3A8A' } };
    rij++;
    const groepen = [
      ...opv.uitverkocht.map(g => ({ ...g, status: 'UITVERKOCHT', vul: ROOD })),
      ...opv.laag.map(g => ({ ...g, status: 'LAAG', vul: ORANJE })),
    ];
    if (!groepen.length) {
      ws.getCell(`A${rij++}`).value = '✔ Geen uitverkochte of bijna uitverkochte artikelen.';
      return;
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
  };
  opvolgingBlok('NIEUW', rapport.opvolging.nieuw);
  rij++;
  opvolgingBlok('TWEEDEHANDS', rapport.opvolging.tweedehands);

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
  const wsNieuw = wb.addWorksheet(SHEET_NIEUW, { properties: { tabColor: { argb: 'FF16A34A' } } });
  const wsTweede = wb.addWorksheet(SHEET_TWEEDEHANDS, { properties: { tabColor: { argb: 'FFEA580C' } } });

  const laatste = {
    [SHEET_NIEUW]: bouwVoorraadSheet(wsNieuw, rapport.nieuwRijen, rapport.nieuw, { tweedehands: false }),
    [SHEET_TWEEDEHANDS]: bouwVoorraadSheet(wsTweede, rapport.tweedehandsRijen, rapport.tweedehands, { tweedehands: true }),
  };
  bouwMetaSheet(wb, rapport, nu);
  const peildatum = nu.toLocaleString('nl-BE', { dateStyle: 'long', timeStyle: 'short' });
  bouwDashboard(dash, rapport, { peildatum, exporteur, laatste });
  return { wb, rapport };
}

export async function exportVoorraad(products, opties = {}) {
  const nu = new Date();
  const { wb } = await bouwVoorraadWorkbook(products, { ...opties, nu });
  const iso = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`;
  await downloadWorkbook(wb, bestandsnaam('voorraad', iso));
}
