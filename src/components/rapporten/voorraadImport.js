// src/components/rapporten/voorraadImport.js
// Pure import-logica voor het voorraadrapport (geen Firebase, geen React).
//   1. leesImportWorkbook  -> leest en valideert het Excel-bestand
//   2. berekenImportVerschillen -> vergelijkt met de actuele producten (3-weg: peilwaarde / Excel / app)
//   3. maakSchrijfPlan -> bepaalt wat er effectief weggeschreven wordt
// Enkel Stock, Verkoopprijs, Aankoopprijs en Actief worden ingelezen. Nieuwe of verwijderde rijen
// worden nooit verwerkt.

import {
  FORMAAT_VERSIE, SHEET_NIEUW, SHEET_TWEEDEHANDS, SHEET_META, KOP, VELD_LABELS, FIRESTORE_VELD, META_LABELS,
} from './voorraadFormaat';

export const OPVALLEND_PRIJS_PCT = 0.5;       // prijswijziging > 50% = opvallend
export const OPVALLEND_STOCK_VERSCHIL = 25;   // stockwijziging > 25 stuks = opvallend
export const OUD_BESTAND_DAGEN = 7;

const VELDEN = ['stock', 'prijs', 'aankoop', 'actief'];

// ── Cel-helpers ─────────────────────────────────────────────────────────────
function celWaarde(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object' && !(v instanceof Date)) {
    if ('error' in v) return { fout: String(v.error) };
    if ('result' in v) return celWaarde(v.result);
    if ('richText' in v) return v.richText.map(t => t.text).join('');
    if ('text' in v) return String(v.text);
    return null;
  }
  return v;
}

const tekst = v => {
  const w = celWaarde(v);
  if (w === null || typeof w === 'object') return '';
  return String(w).trim();
};
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// 12 | "12" | "12,50" | "€ 12,50" | "1.234,50" -> getal ; anders null
function naarGetal(v) {
  const w = celWaarde(v);
  if (typeof w === 'number') return Number.isFinite(w) ? w : null;
  if (typeof w !== 'string') return null;
  let s = w.replace(/[€\s]/g, '');
  if (!s) return null;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function naarActief(v) {
  const w = celWaarde(v);
  if (typeof w === 'boolean') return w;
  const s = norm(w);
  if (['ja', 'j', 'yes', 'true', '1'].includes(s)) return true;
  if (['nee', 'n', 'no', 'false', '0'].includes(s)) return false;
  return null;
}

// ── 1. Bestand lezen ────────────────────────────────────────────────────────
function leesMeta(wb) {
  const ws = wb.getWorksheet(SHEET_META);
  if (!ws) return { fout: 'Dit bestand komt niet uit het voorraadrapport van de app (verborgen tabblad ontbreekt). Exporteer opnieuw en pas dat bestand aan.' };

  const kv = {};
  let kopRij = null;
  for (let r = 1; r <= Math.min(ws.rowCount, 12); r++) {
    const a = tekst(ws.getRow(r).getCell(1).value);
    if (a === 'ID') { kopRij = r; break; }
    if (a) kv[a] = ws.getRow(r).getCell(2).value;
  }
  if (!kopRij) return { fout: 'Verborgen tabblad is beschadigd (kopregel ontbreekt). Exporteer opnieuw.' };

  const versie = naarGetal(kv[META_LABELS.versie]);
  if (versie !== FORMAAT_VERSIE) return { fout: `Onbekende bestandsversie (${versie ?? '?'}). Exporteer opnieuw met de huidige app.` };

  const exportOpRuw = celWaarde(kv[META_LABELS.exportOp]);
  const exportOp = exportOpRuw ? new Date(exportOpRuw) : null;

  const baseline = new Map();
  for (let r = kopRij + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const id = tekst(row.getCell(1).value);
    if (!id) continue;
    baseline.set(id, {
      naam: tekst(row.getCell(2).value),
      variant: tekst(row.getCell(3).value),
      stock: naarGetal(row.getCell(4).value),
      prijs: naarGetal(row.getCell(5).value),
      aankoop: naarGetal(row.getCell(6).value),
      actief: naarActief(row.getCell(7).value),
      tabblad: tekst(row.getCell(8).value),
    });
  }
  return { exportOp: exportOp && !isNaN(exportOp) ? exportOp : null, baseline };
}

function zoekKolommen(ws) {
  const gevonden = {};
  ws.getRow(1).eachCell({ includeEmpty: false }, (cell, col) => {
    gevonden[norm(tekst(cell.value))] = col;
  });
  const kol = {};
  const ontbrekend = [];
  ['product', 'variant', 'actief', 'stock', 'prijs', 'aankoop', 'id'].forEach(k => {
    const c = gevonden[norm(KOP[k])];
    if (c) kol[k] = c; else ontbrekend.push(KOP[k]);
  });
  return { kol, ontbrekend };
}

export function leesImportWorkbook(wb) {
  const resultaat = { algemeneFouten: [], waarschuwingen: [], meta: null, rijen: [], nieuweRijen: [] };

  const meta = leesMeta(wb);
  if (meta.fout) { resultaat.algemeneFouten.push(meta.fout); return resultaat; }
  resultaat.meta = meta;

  const sheets = [SHEET_NIEUW, SHEET_TWEEDEHANDS]
    .map(naam => ({ naam, ws: wb.getWorksheet(naam) }))
    .filter(s => s.ws);
  if (!sheets.length) {
    resultaat.algemeneFouten.push(`Geen tabblad "${SHEET_NIEUW}" of "${SHEET_TWEEDEHANDS}" gevonden. Hernoem tabbladen niet.`);
    return resultaat;
  }

  const gezien = new Map(); // id -> aantal
  for (const { naam: sheet, ws } of sheets) {
    const { kol, ontbrekend } = zoekKolommen(ws);
    if (ontbrekend.length) {
      resultaat.algemeneFouten.push(`Tabblad "${sheet}": kolom(men) ontbreken: ${ontbrekend.join(', ')}. Verwijder of hernoem geen kolommen.`);
      continue;
    }
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const id = tekst(row.getCell(kol.id).value);
      const product = tekst(row.getCell(kol.product).value);
      const variant = tekst(row.getCell(kol.variant).value);

      if (!id) {
        // Lege rij, totaalrij of notitie: stilzwijgend negeren. Rij met naam maar zonder ID = nieuwe rij.
        if (product || variant) resultaat.nieuweRijen.push({ sheet, rij: r, naam: [product, variant].filter(Boolean).join(' ') });
        continue;
      }

      const fouten = [];
      const stock = naarGetal(row.getCell(kol.stock).value);
      const prijs = naarGetal(row.getCell(kol.prijs).value);
      const aankoop = naarGetal(row.getCell(kol.aankoop).value);
      const actief = naarActief(row.getCell(kol.actief).value);

      if (stock === null) fouten.push('Stock is leeg of geen getal.');
      else if (!Number.isInteger(stock) || stock < 0) fouten.push(`Stock moet een geheel getal ≥ 0 zijn (nu: ${stock}).`);
      if (prijs === null) fouten.push('Verkoopprijs is leeg of geen getal.');
      else if (prijs < 0) fouten.push('Verkoopprijs mag niet negatief zijn.');
      if (aankoop === null) fouten.push('Aankoopprijs is leeg of geen getal.');
      else if (aankoop < 0) fouten.push('Aankoopprijs mag niet negatief zijn.');
      if (actief === null) fouten.push('Actief moet "Ja" of "Nee" zijn.');

      const peil = meta.baseline.get(id);
      if (!peil) {
        fouten.push('Onbekend ID: dit product zat niet in de export.');
      } else {
        if (norm(peil.naam) !== norm(product) || norm(peil.variant) !== norm(variant)) {
          fouten.push(`Product/variant komt niet overeen met het ID (verwacht: ${peil.naam} ${peil.variant}). Is er gesorteerd zonder de verborgen ID-kolom, of is de naam gewijzigd?`);
        }
        if (peil.tabblad && peil.tabblad !== sheet) fouten.push(`Rij staat op het verkeerde tabblad (hoort op "${peil.tabblad}").`);
      }
      gezien.set(id, (gezien.get(id) || 0) + 1);

      resultaat.rijen.push({
        sheet, rij: r, id, naam: product, variant,
        stock, prijs: prijs === null ? null : Math.round(prijs * 100) / 100,
        aankoop: aankoop === null ? null : Math.round(aankoop * 100) / 100,
        actief, fouten,
      });
    }
  }

  resultaat.rijen.forEach(x => {
    if (gezien.get(x.id) > 1) x.fouten.push('Dit ID komt meerdere keren voor in het bestand.');
  });

  if (meta.exportOp) {
    const dagen = Math.floor((Date.now() - meta.exportOp.getTime()) / 86400000);
    resultaat.leeftijdDagen = dagen;
  }
  return resultaat;
}

// Browser: File -> resultaat
export async function leesImportBestand(file) {
  const { maakWorkbook } = await import('./exportHelpers');
  const wb = await maakWorkbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return leesImportWorkbook(wb);
}

// ── 2. Vergelijken met de app ───────────────────────────────────────────────
const gelijk = (veld, a, b) => {
  if (veld === 'actief') return a === b;
  if (veld === 'stock') return Number(a) === Number(b);
  return Math.abs(Number(a) - Number(b)) < 0.005;
};

function huidigeWaarden(p) {
  return {
    stock: Number(p.stock) || 0,
    prijs: Number(p.price) || 0,
    aankoop: Number(p.costPrice) || 0,
    actief: p.active !== false,
  };
}

function isOpvallend(veld, van, naar) {
  if (veld === 'prijs' || veld === 'aankoop') {
    if (van > 0 && naar === 0) return true;
    return van > 0 && Math.abs(naar - van) / van > OPVALLEND_PRIJS_PCT;
  }
  if (veld === 'stock') return Math.abs(naar - van) > OPVALLEND_STOCK_VERSCHIL;
  return false;
}

export function berekenImportVerschillen(gelezen, huidigeProducten = [], { nu = new Date() } = {}) {
  const uit = {
    algemeneFouten: [...gelezen.algemeneFouten],
    waarschuwingen: [],
    rijen: [],
    samenvatting: null,
  };
  if (uit.algemeneFouten.length) return uit;

  const app = new Map(huidigeProducten.map(p => [p.id, p]));
  const baseline = gelezen.meta.baseline;

  gelezen.rijen.forEach(x => {
    const rij = {
      id: x.id, sheet: x.sheet, rij: x.rij, naam: x.naam, variant: x.variant,
      status: 'ongewijzigd', wijzigingen: [], conflicten: [], fouten: [...x.fouten],
      opvallend: [], raaktHistoriek: false, soldCount: 0,
    };
    const p = app.get(x.id);
    if (!p && !rij.fouten.length) rij.fouten.push('Product bestaat niet meer in de app.');

    if (p && !rij.fouten.length) {
      const peil = baseline.get(x.id);
      const nu_ = huidigeWaarden(p);
      rij.soldCount = Number(p.soldCount) || 0;
      VELDEN.forEach(veld => {
        const excel = x[veld];
        const basis = peil[veld];
        const huidig = nu_[veld];
        if (gelijk(veld, excel, basis)) return;              // niet aangepast in Excel
        if (gelijk(veld, huidig, excel)) return;             // app heeft al dezelfde waarde
        if (gelijk(veld, huidig, basis)) {                   // app ongewijzigd sinds export
          rij.wijzigingen.push({ veld, van: huidig, naar: excel });
          if (isOpvallend(veld, huidig, excel)) rij.opvallend.push(veld);
        } else {                                             // iemand anders wijzigde ondertussen
          rij.conflicten.push({ veld, peil: basis, huidig, excel });
        }
      });
      const raakt = [...rij.wijzigingen, ...rij.conflicten].some(w => w.veld === 'prijs' || w.veld === 'aankoop');
      rij.raaktHistoriek = raakt && rij.soldCount > 0;
    }

    rij.status = rij.fouten.length ? 'fout'
      : rij.conflicten.length ? 'conflict'
      : rij.wijzigingen.length ? 'wijziging' : 'ongewijzigd';
    uit.rijen.push(rij);
  });

  const teller = status => uit.rijen.filter(r => r.status === status).length;
  const inBestand = new Set(gelezen.rijen.map(r => r.id));
  uit.samenvatting = {
    totaalRijen: uit.rijen.length,
    wijzigingen: teller('wijziging'),
    conflicten: teller('conflict'),
    fouten: teller('fout'),
    ongewijzigd: teller('ongewijzigd'),
    perVeld: VELDEN.reduce((o, v) => ({ ...o, [v]: uit.rijen.filter(r => r.wijzigingen.some(w => w.veld === v)).length }), {}),
    opvallend: uit.rijen.filter(r => r.opvallend.length).length,
    raaktHistoriek: uit.rijen.filter(r => r.raaktHistoriek).length,
    nieuweRijenGenegeerd: gelezen.nieuweRijen.length,
    nietInBestand: huidigeProducten.filter(p => !inBestand.has(p.id)).length,
  };

  const s = uit.samenvatting;
  if (s.raaktHistoriek) {
    uit.waarschuwingen.push(`${s.raaktHistoriek} product(en) met prijswijziging hebben al verkopen. In het rapport Winkel worden omzet en marge berekend als huidige prijs × aantal verkocht, dus die cijfers veranderen ook voor het verleden.`);
  }
  if (s.opvallend) uit.waarschuwingen.push(`${s.opvallend} opvallende wijziging(en) (prijs > ${OPVALLEND_PRIJS_PCT * 100}% of stock > ${OPVALLEND_STOCK_VERSCHIL} stuks): controleer op typfouten.`);
  if (s.nieuweRijenGenegeerd) uit.waarschuwingen.push(`${s.nieuweRijenGenegeerd} rij(en) zonder ID genegeerd. Nieuwe producten voeg je toe in de app.`);
  if (s.nietInBestand) uit.waarschuwingen.push(`${s.nietInBestand} product(en) in de app staan niet in dit bestand (bv. later aangemaakt) en blijven ongewijzigd.`);
  const dagen = gelezen.meta.exportOp ? Math.floor((nu.getTime() - gelezen.meta.exportOp.getTime()) / 86400000) : null;
  if (dagen !== null && dagen > OUD_BESTAND_DAGEN) {
    uit.waarschuwingen.push(`Dit bestand is ${dagen} dagen oud. Verkopen sindsdien kunnen conflicten veroorzaken.`);
  }
  return uit;
}

// ── 3. Wat wordt effectief geschreven ───────────────────────────────────────
// Conflicten worden standaard overgeslagen; `forceer` bevat sleutels "id:veld" die de gebruiker
// bewust wil overschrijven. Bij elke fout wordt er niets geschreven (alles of niets).
export function maakSchrijfPlan(verschillen, { forceer = new Set() } = {}) {
  if (verschillen.algemeneFouten.length || verschillen.rijen.some(r => r.status === 'fout')) {
    return { geblokkeerd: true, reden: 'Los eerst de fouten op.', updates: [], overgeslagenConflicten: 0 };
  }
  let overgeslagen = 0;
  const updates = [];
  verschillen.rijen.forEach(r => {
    const velden = {};
    const voor = {};
    const na = {};
    const pas = (veld, van, naar) => {
      velden[FIRESTORE_VELD[veld]] = naar;
      voor[FIRESTORE_VELD[veld]] = van;
      na[FIRESTORE_VELD[veld]] = naar;
    };
    r.wijzigingen.forEach(w => pas(w.veld, w.van, w.naar));
    r.conflicten.forEach(c => {
      if (forceer.has(`${r.id}:${c.veld}`)) pas(c.veld, c.huidig, c.excel);
      else overgeslagen++;
    });
    if (Object.keys(velden).length) {
      updates.push({ id: r.id, naam: r.naam, variant: r.variant, velden, voor, na });
    }
  });
  return { geblokkeerd: false, updates, overgeslagenConflicten: overgeslagen };
}

export { VELD_LABELS };
