// src/components/wedstrijden/gewichtscategorieen.js
// Officiële leeftijds- en wedstrijdsystemen (Judo Vlaanderen, reglement 2026).
//
// U9/U11/U13 vechten in poules (meestal 4, uitzonderlijk 2/3/5) op basis van
// gewicht — geen vaste gewichtscategorieën, dus geen lijst nodig.
// U15 en ouder vechten in een boom/stamboom (of Braziliaans systeem) binnen
// een vaste gewichtscategorie.

export const POULE_CATEGORIEEN = ['U9', 'U11', 'U13'];

export function isPouleSysteem(categorie) {
  return POULE_CATEGORIEEN.includes(categorie);
}

// Officiële gewichtscategorieën 2026 (Judo Vlaanderen) — '-' = onder, '+' = boven de hoogste klasse.
// U9/U11/U13: geen vaste klassen (poule, max 10% gewichtsverschil).
// U21 en 21+ delen dezelfde indeling (DEFAULT). Toernooi-categorieën: U14 volgt U15,
// U16/U17 volgen U18.
export const GEWICHTSKLASSEN = {
  U15: {
    M: ['-34kg', '-38kg', '-42kg', '-46kg', '-50kg', '-55kg', '-60kg', '-66kg', '+66kg'],
    V: ['-32kg', '-36kg', '-40kg', '-44kg', '-48kg', '-52kg', '-57kg', '-63kg', '+63kg'],
  },
  U18: {
    M: ['-46kg', '-50kg', '-55kg', '-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '+90kg'],
    V: ['-40kg', '-44kg', '-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '+70kg'],
  },
  DEFAULT: {
    M: ['-60kg', '-66kg', '-73kg', '-81kg', '-90kg', '-100kg', '+100kg'],
    V: ['-48kg', '-52kg', '-57kg', '-63kg', '-70kg', '-78kg', '+78kg'],
  },
};

const KLASSEN_VOOR_CATEGORIE = {
  U14: 'U15', U15: 'U15',
  U16: 'U18', U17: 'U18', U18: 'U18',
};

export function gewichtsklassenVoor(categorie, geslacht) {
  const tabel = GEWICHTSKLASSEN[KLASSEN_VOOR_CATEGORIE[categorie]] || GEWICHTSKLASSEN.DEFAULT;
  return tabel[geslacht] || [];
}

// Vat een opgeslagen resultaat samen tot kerncijfers, voor gebruik in lijsten,
// export en rapporten — telt enkel partijen met een ingevuld winst/verlies.
export function samenvatResultaat(resultaat) {
  const afwezig = !!resultaat?.afwezig;
  const partijen = afwezig ? [] : (resultaat?.partijen || []);
  const winst   = partijen.filter(p => p.resultaat === 'winst').length;
  const verlies = partijen.filter(p => p.resultaat === 'verlies').length;
  return {
    afwezig,
    winst,
    verlies,
    totaal: winst + verlies,
    eindplaats: afwezig ? null : (resultaat?.eindplaats || null),
    ingevuld: !!resultaat && (afwezig || winst + verlies > 0 || !!resultaat.eindplaats),
  };
}
