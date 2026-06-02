// winkelData.js — Gedeelde constanten voor alle Winkel-componenten
// Geen React-imports nodig — pure JavaScript module

export const CATS = ['judogi', 'gordel', 'sportzak', 'hoodie', 'tshirt'];

export const CAT_LABELS = {
  judogi:   'Judogi',
  gordel:   'Gordel',
  sportzak: 'Sportzak',
  hoodie:   'Pull',
  tshirt:   'T-shirt',
};

// Zet productCategorieen uit configCache om naar cats-array + catLabels-map.
// Valt terug op de hardcoded CATS/CAT_LABELS wanneer Firestore nog geen data heeft.
export function getCatsFromConfig(productCategorieen) {
  if (Array.isArray(productCategorieen) && productCategorieen.length > 0) {
    const cats = productCategorieen.map(c => c.id);
    const catLabels = Object.fromEntries(productCategorieen.map(c => [c.id, c.label]));
    return { cats, catLabels };
  }
  return { cats: CATS, catLabels: CAT_LABELS };
}

export const TABS = ['kassa', 'stock', 'producten', 'schulden', 'overzicht'];

export const TAB_LABELS = {
  kassa:     'Kassa',
  stock:     'Stock',
  producten: 'Producten',
  schulden:  'Schulden',
  overzicht: 'Overzicht',
};

export function fmtBedrag(n) {
  const val = Number(n) || 0;
  return val % 1 === 0 ? `€${Math.round(val)}` : `€${val.toFixed(2)}`;
}

// Deterministisch product-ID op basis van eigenschappen
// Gebruikt door StockTab.seedProducten() om duplicaten te vermijden
export function maakProductId(p) {
  const slug = [
    p.category,
    p.name,
    p.variant,
    p.tweedehands ? '2h' : 'nieuw',
  ]
    .join('__')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '-');
  return slug;
}

const _MATEN = ['100', '110', '120', '130', '140', '150', '155', '160', '165', '170', '180', '190'];

export const DEFAULT_PRODUCTS = [
  // ── Judogi nieuw — volledig pak (12 maten) ────────────────────────────────
  ..._MATEN.map(m => ({
    name: 'Judogi', category: 'judogi', variant: `Maat ${m} — volledig`,
    price: 0, costPrice: 0, tweedehands: false,
    stock: m === '110' ? 3 : m === '120' ? 2 : m === '130' ? 1 : m === '140' ? 1 : 0,
    soldCount: 0, active: true,
  })),
  // ── Judogi nieuw — enkel broek (12 maten) ────────────────────────────────
  ..._MATEN.map(m => ({
    name: 'Judogi', category: 'judogi', variant: `Maat ${m} — broek`,
    price: 0, costPrice: 0, tweedehands: false, stock: 0, soldCount: 0, active: true,
  })),
  // ── Judogi nieuw — enkel vest (12 maten) ─────────────────────────────────
  ..._MATEN.map(m => ({
    name: 'Judogi', category: 'judogi', variant: `Maat ${m} — vest`,
    price: 0, costPrice: 0, tweedehands: false, stock: 0, soldCount: 0, active: true,
  })),
  // ── Judogi tweedehands — volledig pak (12 maten) ──────────────────────────
  ..._MATEN.map(m => ({
    name: 'Judogi', category: 'judogi', variant: `Maat ${m} — volledig`,
    price: 0, costPrice: 0, tweedehands: true,
    stock: m === '110' ? 4 : m === '130' ? 1 : m === '160' ? 2 : m === '165' ? 1 : m === '170' ? 1 : 0,
    soldCount: 0, active: true,
  })),
  // ── Gordels ───────────────────────────────────────────────────────────────
  { name: 'Gordel', category: 'gordel', variant: 'Wit (6e kyu)',    price: 0, costPrice: 0, stock: 5, soldCount: 0, active: true, tweedehands: false },
  { name: 'Gordel', category: 'gordel', variant: 'Geel (5e kyu)',   price: 0, costPrice: 0, stock: 5, soldCount: 0, active: true, tweedehands: false },
  { name: 'Gordel', category: 'gordel', variant: 'Oranje (4e kyu)', price: 0, costPrice: 0, stock: 3, soldCount: 0, active: true, tweedehands: false },
  { name: 'Gordel', category: 'gordel', variant: 'Groen (3e kyu)',  price: 0, costPrice: 0, stock: 3, soldCount: 0, active: true, tweedehands: false },
  { name: 'Gordel', category: 'gordel', variant: 'Blauw (2e kyu)',  price: 0, costPrice: 0, stock: 3, soldCount: 0, active: true, tweedehands: false },
  { name: 'Gordel', category: 'gordel', variant: 'Bruin (1e kyu)',  price: 0, costPrice: 0, stock: 3, soldCount: 0, active: true, tweedehands: false },
  { name: 'Gordel', category: 'gordel', variant: 'Zwart (1e dan)',  price: 0, costPrice: 0, stock: 3, soldCount: 0, active: true, tweedehands: false },
  // ── Sportzakken ───────────────────────────────────────────────────────────
  { name: 'Sportzak', category: 'sportzak', variant: 'Klein', price: 0, costPrice: 0, stock: 5, soldCount: 0, active: true, tweedehands: false },
  { name: 'Sportzak', category: 'sportzak', variant: 'Groot', price: 0, costPrice: 0, stock: 4, soldCount: 0, active: true, tweedehands: false },
  // ── Pulls nieuw ───────────────────────────────────────────────────────────
  { name: 'Pull', category: 'hoodie', variant: 'Kinderen 9/11',  price: 0, costPrice: 0, stock: 1, soldCount: 0, active: true, tweedehands: false },
  { name: 'Pull', category: 'hoodie', variant: 'Kinderen 12/13', price: 0, costPrice: 0, stock: 4, soldCount: 0, active: true, tweedehands: false },
  { name: 'Pull', category: 'hoodie', variant: 'XS',             price: 0, costPrice: 0, stock: 3, soldCount: 0, active: true, tweedehands: false },
  { name: 'Pull', category: 'hoodie', variant: 'S',              price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: false },
  { name: 'Pull', category: 'hoodie', variant: 'M',              price: 0, costPrice: 0, stock: 1, soldCount: 0, active: true, tweedehands: false },
  { name: 'Pull', category: 'hoodie', variant: 'L',              price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: false },
  { name: 'Pull', category: 'hoodie', variant: 'XL',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: false },
  // ── Pulls tweedehands ─────────────────────────────────────────────────────
  { name: 'Pull', category: 'hoodie', variant: 'Kinderen 9/11',  price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'Pull', category: 'hoodie', variant: 'Kinderen 12/13', price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'Pull', category: 'hoodie', variant: 'XS',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'Pull', category: 'hoodie', variant: 'S',              price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'Pull', category: 'hoodie', variant: 'M',              price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'Pull', category: 'hoodie', variant: 'L',              price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'Pull', category: 'hoodie', variant: 'XL',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  // ── T-shirts nieuw ────────────────────────────────────────────────────────
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames S',             price: 0, costPrice: 0, stock: 7,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames M',             price: 0, costPrice: 0, stock: 12, soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames L',             price: 0, costPrice: 0, stock: 13, soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames XL',            price: 0, costPrice: 0, stock: 6,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren S',             price: 0, costPrice: 0, stock: 7,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren M',             price: 0, costPrice: 0, stock: 6,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren L',             price: 0, costPrice: 0, stock: 8,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren XL',            price: 0, costPrice: 0, stock: 2,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen S (5/6)',    price: 0, costPrice: 0, stock: 10, soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen M (7/8)',    price: 0, costPrice: 0, stock: 10, soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen L (9/11)',   price: 0, costPrice: 0, stock: 8,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen XL (12/14)', price: 0, costPrice: 0, stock: 1,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Ladies Only S',       price: 0, costPrice: 0, stock: 1,  soldCount: 0, active: true, tweedehands: false },
  { name: 'T-shirt', category: 'tshirt', variant: 'Ladies Only M',       price: 0, costPrice: 0, stock: 2,  soldCount: 0, active: true, tweedehands: false },
  // ── T-shirts tweedehands ──────────────────────────────────────────────────
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames S',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames M',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames L',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Dames XL',            price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren S',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren M',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren L',             price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Heren XL',            price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen S (5/6)',    price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen M (7/8)',    price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen L (9/11)',   price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
  { name: 'T-shirt', category: 'tshirt', variant: 'Kinderen XL (12/14)', price: 0, costPrice: 0, stock: 0, soldCount: 0, active: true, tweedehands: true },
];
