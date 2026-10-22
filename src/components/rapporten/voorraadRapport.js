// src/components/rapporten/voorraadRapport.js
// Pure berekeningen voor het voorraadrapport (geen React, geen Firebase).
// Eén bron van waarheid voor de Excel-export; later ook bruikbaar voor de schermen,
// zodat export en app nooit uiteen kunnen lopen.

import { CATS, CAT_LABELS } from '../winkel/winkelData';
import { sorteerProducten } from '../winkel/productFacets';

// Stock strikt onder deze waarde (en > 0) = "LAAG".
export const LAGE_STOCK_DREMPEL = 3;

export const STAAT_LABELS = {
  goed: 'Goed',
  redelijk: 'Redelijk',
  'te-herstellen': 'Te herstellen',
};

const num = v => Number(v) || 0;
const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

export function bepaalStatus(stock, actief) {
  if (!actief) return 'INACTIEF';
  if (stock <= 0) return 'UITVERKOCHT';
  if (stock < LAGE_STOCK_DREMPEL) return 'LAAG';
  return 'OK';
}

// Firestore Timestamp | Date | null  ->  Date | null
export function naarDatum(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  return null;
}

function maakRij(p, catLabels) {
  const actief = p.active !== false;
  const tweedehands = p.tweedehands === true;
  const stock = num(p.stock);
  const prijs = num(p.price);
  const aankoop = num(p.costPrice);
  const margePerStuk = r2(prijs - aankoop);
  const staatRuw = p.laatsteOntvangstStaat ?? p.staat ?? null;
  return {
    id: p.id,
    categorie: p.category,
    categorieLabel: catLabels[p.category] || p.category || 'Overig',
    naam: p.name || '',
    variant: p.variant || '',
    tweedehands,
    actief,
    stock,
    prijs,
    aankoop,
    voorraadwaarde: r2(stock * aankoop),
    verkoopwaarde: r2(stock * prijs),
    margePerStuk,
    margePct: prijs > 0 ? margePerStuk / prijs : null,
    margeTotaal: r2(stock * margePerStuk),
    status: bepaalStatus(stock, actief),
    // Tweedehands: per variant bewaren we enkel de LAATSTE ontvangst.
    herkomst: p.laatsteOntvangstHerkomst ?? p.herkomst ?? '',
    staat: staatRuw ? (STAAT_LABELS[staatRuw] || staatRuw) : '',
    opmerking: p.laatsteOntvangstOpmerking ?? p.opmerking ?? '',
    ontvangenOp: naarDatum(p.laatsteOntvangstOp) || naarDatum(p.ontvangenOp),
  };
}

function totalen(rijen) {
  return {
    producten: rijen.length,
    stuks: rijen.reduce((s, r) => s + r.stock, 0),
    voorraadwaarde: r2(rijen.reduce((s, r) => s + r.voorraadwaarde, 0)),
    verkoopwaarde: r2(rijen.reduce((s, r) => s + r.verkoopwaarde, 0)),
    marge: r2(rijen.reduce((s, r) => s + r.margeTotaal, 0)),
    uitverkocht: rijen.filter(r => r.status === 'UITVERKOCHT').length,
    laag: rijen.filter(r => r.status === 'LAAG').length,
  };
}

function groepeerOpCategorie(rijen, itemTekst) {
  const map = new Map();
  rijen.forEach(r => {
    if (!map.has(r.categorieLabel)) map.set(r.categorieLabel, []);
    map.get(r.categorieLabel).push(itemTekst(r));
  });
  return [...map.entries()].map(([categorieLabel, items]) => ({ categorieLabel, items }));
}

const basisNaam = r => (r.variant || r.naam) + (r.tweedehands ? ' (2e hands)' : '');

export function berekenVoorraadRapport(products = [], { cats = CATS, catLabels = CAT_LABELS } = {}) {
  const gesorteerd = sorteerProducten(products, cats);
  const rijen = gesorteerd.map(p => maakRij(p, catLabels));
  const actieve = rijen.filter(r => r.actief);
  const inactieve = rijen.filter(r => !r.actief);

  // Categorieën in de volgorde van de app; onbekende categorieën achteraan.
  const catSleutels = [...cats, ...new Set(rijen.map(r => r.categorie).filter(c => !cats.includes(c)))];
  const perCategorie = catSleutels
    .map(key => {
      const set = actieve.filter(r => r.categorie === key);
      return { key, label: catLabels[key] || key, ...totalen(set) };
    })
    .filter(c => c.producten > 0);

  return {
    rijen,
    actief: totalen(actieve),
    nieuw: totalen(actieve.filter(r => !r.tweedehands)),
    tweedehands: totalen(actieve.filter(r => r.tweedehands)),
    perCategorie,
    inactief: { producten: inactieve.length, stuks: inactieve.reduce((s, r) => s + r.stock, 0) },
    opvolging: {
      uitverkocht: groepeerOpCategorie(actieve.filter(r => r.status === 'UITVERKOCHT'), basisNaam),
      laag: groepeerOpCategorie(actieve.filter(r => r.status === 'LAAG'), r => `${basisNaam(r)}: ${r.stock}`),
    },
    // Aandachtspunten: cijfers kunnen onvolledig zijn als prijzen ontbreken.
    controle: {
      // Tweedehands mag gratis (geschonken) binnenkomen, dus enkel nieuwe producten tellen mee.
      zonderAankoopprijs: actieve.filter(r => !r.tweedehands && r.stock > 0 && r.aankoop <= 0).length,
      zonderVerkoopprijs: actieve.filter(r => r.stock > 0 && r.prijs <= 0).length,
      negatieveStock: actieve.filter(r => r.stock < 0).length,
    },
    tweedehandsRijen: rijen.filter(r => r.tweedehands && r.stock > 0),
  };
}
