// src/components/rapporten/winkelOmzet.js
// Omzet en marge per product, berekend uit de verkopen zelf (niet uit de huidige productprijs).
// Zo blijven oude verkopen op hun oude prijs staan, ook als de prijs later wijzigt.
//
//  - Omzet  = som van prijs × aantal per verkocht item (prijs wordt bij de verkoop bewaard)
//  - Kost   = aantal × aankoopprijs die bij de verkoop werd bewaard (`aankoopprijs`).
//             Oudere verkopen hebben dat veld niet: daarvoor wordt de HUIDIGE aankoopprijs gebruikt
//             (en geteld in `kostGeschat`), tot de bestaande verkopen eventueel worden bijgewerkt.
//  - Geannuleerde verkopen tellen niet mee.

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
const r2 = v => Math.round((v + Number.EPSILON) * 100) / 100;

export function berekenWinkelOmzet(products = [], sales = []) {
  const perProduct = new Map(products.map(p => [p.id, { verkocht: 0, omzet: 0, kost: 0, kostGeschat: 0 }]));
  const totaal = { verkocht: 0, omzet: 0, kost: 0, kostGeschat: 0 };
  const huidigeKost = new Map(products.map(p => [p.id, num(p.costPrice)]));

  sales.forEach(sale => {
    if (sale.geannuleerd) return;
    (sale.items || []).forEach(item => {
      const qty = num(item.qty);
      const omzet = num(item.prijs) * qty;
      const heeftSnapshot = typeof item.aankoopprijs === 'number' && Number.isFinite(item.aankoopprijs);
      const eenheidskost = heeftSnapshot ? item.aankoopprijs : (huidigeKost.get(item.productId) ?? 0);
      const kost = eenheidskost * qty;

      totaal.verkocht += qty; totaal.omzet += omzet; totaal.kost += kost;
      if (!heeftSnapshot) totaal.kostGeschat += qty;

      const rij = perProduct.get(item.productId);
      if (rij) {
        rij.verkocht += qty; rij.omzet += omzet; rij.kost += kost;
        if (!heeftSnapshot) rij.kostGeschat += qty;
      }
    });
  });

  const verrijkt = products.map(p => {
    const r = perProduct.get(p.id);
    return {
      ...p,
      verkocht: r.verkocht,
      omzet: r2(r.omzet),
      marge: r2(r.omzet - r.kost),
      kostGeschat: r.kostGeschat,
      // De teller op het product (soldCount) moet gelijk zijn aan de som van de verkopen.
      telAfwijking: r.verkocht !== num(p.soldCount),
    };
  });

  return {
    products: verrijkt,
    totalRevenue: r2(totaal.omzet),
    totalCost: r2(totaal.kost),
    margin: r2(totaal.omzet - totaal.kost),
    kostGeschatStuks: totaal.kostGeschat,
    afwijkendeTelling: verrijkt.filter(p => p.telAfwijking).length,
  };
}
