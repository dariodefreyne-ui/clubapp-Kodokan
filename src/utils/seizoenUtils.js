/**
 * seizoenUtils.js — Kodokan seizoenslogica
 *
 * Seizoen loopt altijd van 1 september t.e.m. 30 juni.
 * Juli en augustus zijn zomerpauze en vallen buiten het seizoen.
 *
 * Voorbeelden:
 *   - Huidig seizoen in oktober 2025  → start 2025-09-01, einde 2026-06-30
 *   - Huidig seizoen in maart 2026    → start 2025-09-01, einde 2026-06-30
 *   - Huidig seizoen in augustus 2026 → zomerpauze, maar geeft toch huidig seizoen terug
 */

/**
 * Geeft start- en einddatum van een seizoen terug.
 * @param {number} offsetJaar  0 = huidig seizoen, -1 = vorig seizoen
 * @returns {{ start: string, einde: string, label: string }}
 */
export function seizoenBereik(offsetJaar = 0) {
  const now = new Date();
  // Vanaf september zitten we in het nieuwe seizoen
  // Voor september (maand 0-7) zitten we nog in het seizoen dat vorig jaar startte
  const startJaar =
    (now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1) +
    offsetJaar;

  return {
    start: `${startJaar}-09-01`,
    einde: `${startJaar + 1}-06-30`,
    label: `${startJaar}–${startJaar + 1}`,
  };
}

/**
 * Geeft het seizoenslabel terug voor een gegeven datum-string (YYYY-MM-DD).
 * Handig om bij een event of inschrijving het seizoen te tonen.
 * @param {string} datum  bv. "2026-03-22"
 * @returns {string}  bv. "2025–2026"
 */
export function seizoenVanDatum(datum) {
  if (!datum) return '—';
  const d = new Date(datum);
  // Sept t.e.m. dec = seizoen start dit jaar; jan t.e.m. juni = seizoen startte vorig jaar
  const startJaar = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startJaar}–${startJaar + 1}`;
}
