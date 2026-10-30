// src/utils/ledenCategorieen.js
// Categorie-indeling van één lid voor de ledenlijst.
//
// Hoofdcategorie  = de smalste passende NIET-extra categorie (zelfde gedrag als
//                   berekenRuweCategorie, dus geen regressie voor bestaande configuraties).
// Extra categorie = elke passende categorie die in Beheer als `extra` is gemarkeerd
//                   (bv. U14 en U17). Een lid krijgt ALLE passende extra's erbij.
//
// Pure logica, geen Firestore: wordt live berekend uit geboortejaar + categorieconfig.
import { berekenCategorieen, isVetCode } from './categorieLogica';

function smalste(categorieen) {
  if (!categorieen || categorieen.length === 0) return null;
  return categorieen.reduce((beste, c) =>
    (c.totLeeftijd - c.vanLeeftijd) < (beste.totLeeftijd - beste.vanLeeftijd) ? c : beste);
}

/**
 * @returns {{ hoofd: string|null, extras: string[], codes: string[] }}
 *   codes = hoofd + extras (zonder dubbels), in weergavevolgorde.
 */
export function berekenLidCategorieen(geboortejaar, categorieenConfig) {
  if (!geboortejaar) return { hoofd: null, extras: [], codes: [] };
  const passend = berekenCategorieen(geboortejaar, null, categorieenConfig).filter(c => !isVetCode(c.code));
  const hoofd = smalste(passend.filter(c => c.extra !== true))?.code ?? null;
  const extras = passend.filter(c => c.extra === true).map(c => c.code);
  return { hoofd, extras, codes: hoofd ? [hoofd, ...extras] : extras };
}
