// productFacets.js — Centrale logica voor de gestructureerde productkenmerken
// (type / maat / geslacht) en de stapsgewijze kassa-drilldown.
//
// Producten dragen idealiter de structurele velden `type`, `maat`, `geslacht`
// (naast het bestaande `variant`, `tweedehands`). Voor producten die die velden
// nog niet hebben, vallen we terug op het uitlezen van de `variant`-tekst, zodat
// alles blijft werken vóór en na de migratie.

const JUDOGI_MATEN = ['100','110','120','130','140','150','155','160','165','170','180','190'];
const KLEDIJ_MAAT_VOLGORDE = ['XS','S','M','L','XL','XXL'];
const GORDEL_KLEUREN = ['wit','geel','oranje','groen','blauw','bruin','zwart'];

const GORDEL_LABEL = {
  wit: 'Wit (6e kyu)', geel: 'Geel (5e kyu)', oranje: 'Oranje (4e kyu)',
  groen: 'Groen (3e kyu)', blauw: 'Blauw (2e kyu)', bruin: 'Bruin (1e kyu)',
  zwart: 'Zwart (1e dan)',
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ── Facetten afleiden uit een product ────────────────────────────────────────
export function productFacetten(product = {}) {
  const category = product.category;
  const v = String(product.variant || '');
  const low = v.toLowerCase();

  let type = product.type || null;
  let maat = product.maat || null;
  let geslacht = product.geslacht || null;

  if (category === 'judogi') {
    if (!type) type = low.includes('broek') ? 'broek' : low.includes('vest') ? 'vest' : 'pak';
    if (!maat) { const m = v.match(/(\d{2,3})/); maat = m ? m[1] : null; }
    geslacht = null;
  } else if (category === 'tshirt' || category === 'hoodie') {
    if (!geslacht) {
      if (low.includes('ladies only') || low.includes('dames')) geslacht = 'dames';
      else if (low.includes('heren')) geslacht = 'heren';
      else if (low.includes('kinderen') || low.includes('kind')) geslacht = 'kinderen';
      else geslacht = 'uniseks';
    }
    if (!type) type = (category === 'tshirt' && low.includes('ladies only')) ? 'ladies-only' : 'standaard';
    if (!maat) {
      maat = v.replace(/dames|heren|kinderen|ladies only/ig, '').trim() || null;
    }
  } else if (category === 'gordel') {
    if (!type) type = GORDEL_KLEUREN.find(k => low.includes(k)) || null;
  } else if (category === 'sportzak') {
    if (!type) type = low.includes('groot') ? 'groot' : 'klein';
  }

  return { category, type, maat, geslacht, tweedehands: !!product.tweedehands };
}

// ── Weergavestring opbouwen uit structurele velden ───────────────────────────
export function bouwVariantTekst(category, { type, maat, geslacht } = {}) {
  if (category === 'judogi') {
    const t = type === 'pak' ? 'volledig' : type;
    return `Maat ${maat || ''} — ${t || 'volledig'}`.trim();
  }
  if (category === 'tshirt') {
    if (type === 'ladies-only') return `Ladies Only ${maat || ''}`.trim();
    if (geslacht && geslacht !== 'uniseks') return `${cap(geslacht)} ${maat || ''}`.trim();
    return (maat || '').trim();
  }
  if (category === 'hoodie') {
    if (geslacht && geslacht !== 'uniseks') return `${cap(geslacht)} ${maat || ''}`.trim();
    return (maat || '').trim();
  }
  if (category === 'gordel') return GORDEL_LABEL[type] || cap(type) || '';
  if (category === 'sportzak') return type === 'groot' ? 'Groot' : 'Klein';
  return '';
}

// ── Drilldown-stappen per categorie ──────────────────────────────────────────
export function stappenVoor(category) {
  if (category === 'judogi') return ['type', 'maat'];
  if (category === 'tshirt' || category === 'hoodie') return ['groep', 'maat'];
  if (category === 'gordel') return ['kleur'];
  if (category === 'sportzak') return ['type'];
  return ['variant']; // fallback: platte lijst op variant
}

// "groep" combineert geslacht + ladies-only (apart t-shirt-type)
function groepVan(category, f) {
  if (category === 'tshirt' && f.type === 'ladies-only') return 'ladies-only';
  return f.geslacht || 'uniseks';
}

function waardeVanStap(category, stap, f) {
  if (stap === 'groep') return groepVan(category, f);
  if (stap === 'type') return f.type;
  if (stap === 'maat') return f.maat;
  if (stap === 'kleur') return f.type;
  if (stap === 'variant') return f.maat || f.type || null;
  return null;
}

// ── Labels en sorteervolgorde per stap ───────────────────────────────────────
const GROEP_LABEL = { heren: 'Heren', dames: 'Dames', kinderen: 'Kinderen', uniseks: 'Uniseks', 'ladies-only': 'Ladies Only' };
const GROEP_VOLGORDE = ['heren', 'dames', 'kinderen', 'ladies-only', 'uniseks'];
const TYPE_LABEL = { pak: 'Pak', broek: 'Broek', vest: 'Vest', klein: 'Klein', groot: 'Groot' };
const TYPE_VOLGORDE = ['pak', 'broek', 'vest', 'klein', 'groot'];

export function labelVoor(category, stap, waarde) {
  if (stap === 'groep') return GROEP_LABEL[waarde] || cap(waarde);
  if (stap === 'kleur') return GORDEL_LABEL[waarde] || cap(waarde);
  if (stap === 'type') return TYPE_LABEL[waarde] || cap(waarde);
  return waarde; // maat / variant: tonen zoals ze zijn
}

function sorteerIndex(category, stap, waarde) {
  if (stap === 'maat') {
    if (category === 'judogi') { const i = JUDOGI_MATEN.indexOf(String(waarde)); return i >= 0 ? i : 999; }
    const eerste = String(waarde).trim().split(/[\s(]/)[0].toUpperCase();
    const i = KLEDIJ_MAAT_VOLGORDE.indexOf(eerste);
    return i >= 0 ? i : 500 + String(waarde).localeCompare('');
  }
  if (stap === 'groep') { const i = GROEP_VOLGORDE.indexOf(waarde); return i >= 0 ? i : 999; }
  if (stap === 'type') { const i = TYPE_VOLGORDE.indexOf(waarde); return i >= 0 ? i : 999; }
  if (stap === 'kleur') { const i = GORDEL_KLEUREN.indexOf(waarde); return i >= 0 ? i : 999; }
  return 0;
}

// Voorbeeld-"product" om het juiste icoon te tonen voor een keuze-tegel.
export function iconProductVoor(category, stap, waarde) {
  if (stap === 'groep') return { category, variant: waarde === 'ladies-only' ? 'Ladies Only' : '' };
  if (stap === 'kleur') return { category: 'gordel', variant: waarde };
  if (stap === 'type') return { category, variant: waarde };
  return { category, variant: String(waarde || '') };
}

// Alleen verkoopbare producten (voorraad + prijs).
function verkoopbaar(p) {
  return p.active !== false && (p.stock || 0) > 0 && (p.price || 0) > 0;
}

function matchtGekozen(category, f, gekozen) {
  for (const [stap, waarde] of Object.entries(gekozen)) {
    if (waarde == null) continue;
    if (stap === 'tweedehands') { if (f.tweedehands !== waarde) return false; continue; }
    if (waardeVanStap(category, stap, f) !== waarde) return false;
  }
  return true;
}

// ── Keuze-opties voor de huidige stap ────────────────────────────────────────
// Geeft [{ waarde, label, aantal, prijsVan, voorbeeld }], enkel met voorraad,
// rekening houdend met eerder gemaakte keuzes.
export function opties(category, stap, gekozen, producten) {
  const map = new Map();
  for (const p of producten) {
    if (p.category !== category || !verkoopbaar(p)) continue;
    const f = productFacetten(p);
    if (!matchtGekozen(category, f, gekozen)) continue;
    const waarde = waardeVanStap(category, stap, f);
    if (waarde == null || waarde === '') continue;
    if (!map.has(waarde)) map.set(waarde, { waarde, aantal: 0, prijzen: [], voorbeeld: p });
    const o = map.get(waarde);
    o.aantal += (p.stock || 0);
    o.prijzen.push(p.price || 0);
  }
  return [...map.values()]
    .map(o => ({
      waarde: o.waarde,
      label: labelVoor(category, stap, o.waarde),
      aantal: o.aantal,
      prijsVan: Math.min(...o.prijzen),
      voorbeeld: o.voorbeeld,
    }))
    .sort((a, b) => sorteerIndex(category, stap, a.waarde) - sorteerIndex(category, stap, b.waarde));
}

// ── Bladproducten: alle producten die aan de volledige keuze voldoen ─────────
// (nieuw én tweedehands) — de kassa beslist of de tweedehands-stap nodig is.
export function bladProducten(category, gekozen, producten) {
  const zonderTweedehands = { ...gekozen };
  delete zonderTweedehands.tweedehands;
  return producten.filter(p => {
    if (p.category !== category || !verkoopbaar(p)) return false;
    return matchtGekozen(category, productFacetten(p), zonderTweedehands);
  });
}
