import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { bouwVoorraadWorkbook } from './exportVoorraad';
import { leesImportWorkbook, berekenImportVerschillen, maakSchrijfPlan } from './voorraadImport';
import { SHEET_NIEUW, SHEET_TWEEDEHANDS, SHEET_META } from './voorraadFormaat';

const NU = new Date('2026-10-23T10:00:00Z');
const P = (o) => ({ category: 'tshirt', name: 'T-shirt', variant: 'M', stock: 5, price: 15, costPrice: 8, soldCount: 0, ...o });

const basis = () => [
  P({ id: 'a', variant: 'S', stock: 5, price: 15, costPrice: 8 }),
  P({ id: 'b', variant: 'M', stock: 2, price: 15, costPrice: 8, soldCount: 10 }),
  P({ id: 'c', variant: 'L', stock: 0, price: 15, costPrice: 8 }),
  P({ id: 'd', variant: 'M', tweedehands: true, stock: 1, price: 10, costPrice: 0, herkomst: 'Lid' }),
];

// Maakt een bestand zoals de app het exporteert, laat de test het aanpassen (zoals Excel dat zou doen)
// en herlaadt het vanaf schijf-bytes.
async function bestand(products, wijzig) {
  const { wb } = await bouwVoorraadWorkbook(products, { nu: NU, exporteur: 'Test' }, new ExcelJS.Workbook());
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new ExcelJS.Workbook();
  await wb2.xlsx.load(buf);
  wijzig?.(wb2);
  return wb2;
}

function zoekRij(ws, id) {
  let idKol = null;
  ws.getRow(1).eachCell((c, i) => { if (String(c.value).startsWith('ID')) idKol = i; });
  for (let r = 2; r <= ws.rowCount; r++) if (ws.getRow(r).getCell(idKol).value === id) return ws.getRow(r);
  throw new Error('rij niet gevonden ' + id);
}
const vandaag = (gelezen, app) => berekenImportVerschillen(gelezen, app, { nu: NU });

describe('export klaar voor import', () => {
  it('verbergt ID-kolom en meta-tabblad en neemt ID in filterbereik', async () => {
    const wb = await bestand(basis());
    expect(wb.getWorksheet(SHEET_META).state).toBe('hidden');
    const ws = wb.getWorksheet(SHEET_NIEUW);
    expect(ws.getColumn(14).hidden).toBe(true);
    expect(String(ws.autoFilter)).toMatch(/^A1:N\d+$/); // filterbereik omvat de ID-kolom (N)
    expect(String(wb.getWorksheet(SHEET_TWEEDEHANDS).autoFilter)).toMatch(/^A1:R\d+$/);
  });
});

describe('ongewijzigd bestand', () => {
  it('geeft 0 wijzigingen, geen fouten', async () => {
    const wb = await bestand(basis());
    const g = leesImportWorkbook(wb);
    expect(g.algemeneFouten).toEqual([]);
    expect(g.rijen).toHaveLength(4);
    const v = vandaag(g, basis());
    expect(v.samenvatting).toMatchObject({ wijzigingen: 0, conflicten: 0, fouten: 0, ongewijzigd: 4 });
  });
});

describe('wijzigingen', () => {
  it('detecteert aangepaste stock, prijs, aankoop en actief (ook op tweedehands)', async () => {
    const wb = await bestand(basis(), w => {
      const n = w.getWorksheet(SHEET_NIEUW);
      zoekRij(n, 'a').getCell(5).value = 9;        // stock
      zoekRij(n, 'c').getCell(6).value = 18;       // prijs
      zoekRij(n, 'c').getCell(7).value = 9.5;      // aankoop
      zoekRij(n, 'c').getCell(4).value = 'Nee';    // actief
      zoekRij(w.getWorksheet(SHEET_TWEEDEHANDS), 'd').getCell(5).value = 4;
    });
    const v = vandaag(leesImportWorkbook(wb), basis());
    expect(v.samenvatting).toMatchObject({ wijzigingen: 3, conflicten: 0, fouten: 0 });
    const plan = maakSchrijfPlan(v);
    expect(plan.updates).toHaveLength(3);
    expect(plan.updates.find(u => u.id === 'c').velden).toEqual({ price: 18, costPrice: 9.5, active: false });
    expect(plan.updates.find(u => u.id === 'a').voor).toEqual({ stock: 5 });
  });

  it('begrijpt tekst met komma en euroteken', async () => {
    const wb = await bestand(basis(), w => { zoekRij(w.getWorksheet(SHEET_NIEUW), 'a').getCell(6).value = '€ 17,50'; });
    const v = vandaag(leesImportWorkbook(wb), basis());
    expect(v.rijen.find(r => r.id === 'a').wijzigingen[0]).toMatchObject({ veld: 'prijs', naar: 17.5 });
  });
});

describe('conflicten (verkopen sinds de export)', () => {
  it('markeert conflict als app en Excel beide afwijken van de peilwaarde', async () => {
    const wb = await bestand(basis(), w => { zoekRij(w.getWorksheet(SHEET_NIEUW), 'a').getCell(5).value = 9; });
    const app = basis(); app[0].stock = 3; // er werd 2 verkocht na de export
    const v = vandaag(leesImportWorkbook(wb), app);
    const r = v.rijen.find(x => x.id === 'a');
    expect(r.status).toBe('conflict');
    expect(r.conflicten[0]).toMatchObject({ veld: 'stock', peil: 5, huidig: 3, excel: 9 });
    expect(maakSchrijfPlan(v).updates).toHaveLength(0);
    expect(maakSchrijfPlan(v).overgeslagenConflicten).toBe(1);
    expect(maakSchrijfPlan(v, { forceer: new Set(['a:stock']) }).updates[0].velden).toEqual({ stock: 9 });
  });

  it('laat verkopen ongemoeid als Excel niets aan stock wijzigde', async () => {
    const wb = await bestand(basis(), w => { zoekRij(w.getWorksheet(SHEET_NIEUW), 'a').getCell(6).value = 20; });
    const app = basis(); app[0].stock = 3; // verkocht sinds export, stock niet aangeraakt in Excel
    const r = vandaag(leesImportWorkbook(wb), app).rijen.find(x => x.id === 'a');
    expect(r.status).toBe('wijziging');
    expect(r.wijzigingen.map(w => w.veld)).toEqual(['prijs']);
  });
});

describe('fouten blokkeren de import', () => {
  const met = async (fn) => vandaag(leesImportWorkbook(await bestand(basis(), fn)), basis());

  it('negatieve stock, tekst en kommagetal in stock', async () => {
    const v = await met(w => {
      const n = w.getWorksheet(SHEET_NIEUW);
      zoekRij(n, 'a').getCell(5).value = -1;
      zoekRij(n, 'b').getCell(5).value = 'veel';
      zoekRij(n, 'c').getCell(5).value = 2.5;
    });
    expect(v.samenvatting.fouten).toBe(3);
    const plan = maakSchrijfPlan(v);
    expect(plan.geblokkeerd).toBe(true);
    expect(plan.updates).toEqual([]);
  });

  it('rij die los van haar ID is verplaatst (sorteren zonder ID-kolom)', async () => {
    const v = await met(w => {
      const n = w.getWorksheet(SHEET_NIEUW);
      zoekRij(n, 'a').getCell(3).value = 'XXL'; // variant komt niet meer overeen met het ID
    });
    expect(v.rijen.find(r => r.id === 'a').fouten[0]).toMatch(/komt niet overeen/);
  });

  it('dubbel ID', async () => {
    const v = await met(w => {
      const n = w.getWorksheet(SHEET_NIEUW);
      zoekRij(n, 'b').getCell(14).value = 'a';
    });
    expect(v.rijen.some(r => r.fouten.some(f => /meerdere keren|komt niet overeen/.test(f)))).toBe(true);
  });

  it('product dat in de app bestaat niet meer', async () => {
    const wb = await bestand(basis());
    const v = vandaag(leesImportWorkbook(wb), basis().filter(p => p.id !== 'a'));
    expect(v.rijen.find(r => r.id === 'a').fouten).toContain('Product bestaat niet meer in de app.');
  });

  it('bestand zonder meta-tabblad of met ontbrekende kolom', async () => {
    const zonderMeta = await bestand(basis(), w => w.removeWorksheet(w.getWorksheet(SHEET_META).id));
    expect(leesImportWorkbook(zonderMeta).algemeneFouten[0]).toMatch(/niet uit het voorraadrapport/);
    const zonderKolom = await bestand(basis(), w => { w.getWorksheet(SHEET_NIEUW).getRow(1).getCell(5).value = 'Aantal'; });
    expect(leesImportWorkbook(zonderKolom).algemeneFouten[0]).toMatch(/Stock/);
  });
});

describe('waarschuwingen', () => {
  it('prijswijziging bij product met verkopen raakt de historiek', async () => {
    const wb = await bestand(basis(), w => { zoekRij(w.getWorksheet(SHEET_NIEUW), 'b').getCell(6).value = 16; });
    const v = vandaag(leesImportWorkbook(wb), basis());
    expect(v.rijen.find(r => r.id === 'b')).toMatchObject({ raaktHistoriek: true, soldCount: 10 });
    expect(v.samenvatting.raaktHistoriek).toBe(1);
    expect(v.waarschuwingen.join(' ')).toMatch(/omzet en marge/);
  });

  it('geen historiekwaarschuwing zonder verkopen, wel voor opvallende prijs (typfout)', async () => {
    const wb = await bestand(basis(), w => { zoekRij(w.getWorksheet(SHEET_NIEUW), 'a').getCell(6).value = 150; });
    const v = vandaag(leesImportWorkbook(wb), basis());
    expect(v.samenvatting.raaktHistoriek).toBe(0);
    expect(v.rijen.find(r => r.id === 'a').opvallend).toEqual(['prijs']);
  });

  it('nieuwe rij zonder ID wordt genegeerd; totaalrij telt niet', async () => {
    const wb = await bestand(basis(), w => { w.getWorksheet(SHEET_NIEUW).addRow(['Pull', 'Pull', 'XL', 'Ja', 3, 20, 10]); });
    const g = leesImportWorkbook(wb);
    expect(g.nieuweRijen).toHaveLength(1);
    expect(vandaag(g, basis()).waarschuwingen.join(' ')).toMatch(/zonder ID genegeerd/);
  });

  it('oud bestand', async () => {
    const wb = await bestand(basis());
    const v = berekenImportVerschillen(leesImportWorkbook(wb), basis(), { nu: new Date('2026-11-10T10:00:00Z') });
    expect(v.waarschuwingen.join(' ')).toMatch(/dagen oud/);
  });
});
