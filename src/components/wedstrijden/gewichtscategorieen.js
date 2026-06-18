// src/components/wedstrijden/gewichtscategorieen.js
// Officiële leeftijds- en wedstrijdsystemen (Judo Vlaanderen, reglement 2026).
//
// U9/U11/U13 vechten in poules (meestal 4, uitzonderlijk 2/3/5) op basis van
// gewicht — geen vaste gewichtscategorieën, dus geen lijst nodig.
// U15 en ouder vechten in een boom/stamboom (of Braziliaans systeem) binnen
// een vaste gewichtscategorie. U18, U21 en 21+ delen dezelfde indeling.

export const POULE_CATEGORIEEN = ['U9', 'U11', 'U13'];

export function isPouleSysteem(categorie) {
  return POULE_CATEGORIEEN.includes(categorie);
}

// Officiële gewichtscategorieën 2026 — '-' = onder, '+' = boven de hoogste klasse.
export const GEWICHTSKLASSEN = {
  U15: {
    M: ['-46kg', '-50kg', '-55kg', '-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '+90kg'],
    V: ['-40kg', '-44kg', '-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '+70kg'],
  },
  // U18, U21 en 21+ (Senior) gebruiken dezelfde indeling.
  DEFAULT: {
    M: ['-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '-100kg', '+100kg'],
    V: ['-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '-78kg', '+78kg'],
  },
};

export function gewichtsklassenVoor(categorie, geslacht) {
  const tabel = categorie === 'U15' ? GEWICHTSKLASSEN.U15 : GEWICHTSKLASSEN.DEFAULT;
  return tabel[geslacht] || [];
}

// Vat een opgeslagen resultaat samen tot kerncijfers, voor gebruik in lijsten,
// export en rapporten — telt enkel partijen met een ingevuld winst/verlies.
export function samenvatResultaat(resultaat) {
  const partijen = resultaat?.partijen || [];
  const winst   = partijen.filter(p => p.resultaat === 'winst').length;
  const verlies = partijen.filter(p => p.resultaat === 'verlies').length;
  return {
    winst,
    verlies,
    totaal: winst + verlies,
    eindplaats: resultaat?.eindplaats || null,
    ingevuld: !!resultaat && (winst + verlies > 0 || !!resultaat.eindplaats),
  };
}
