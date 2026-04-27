/**
 * seizoenUtils.js — Kodokan seizoenslogica
 * Seizoen loopt van 1 september t.e.m. 30 juni.
 */

/**
 * Geeft start- en einddatum van een seizoen terug op basis van het startjaar.
 * @param {number} startJaar  bv. 2025 → seizoen 2025-2026
 */
export function seizoenBereikVanJaar(startJaar) {
  return {
    start: `${startJaar}-09-01`,
    einde: `${startJaar + 1}-06-30`,
    label: `${startJaar}–${startJaar + 1}`,
    startJaar,
  };
}

/**
 * Huidig seizoensstartjaar op basis van de huidige datum.
 * April 2026 → maand 3 < 8 → startJaar = 2025 → seizoen 2025-2026 ✓
 */
export function huidigSeizoenStartJaar() {
  const now = new Date();
  return now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
}

/**
 * Huidig seizoen (convenience).
 */
export function seizoenBereik(offsetJaar = 0) {
  return seizoenBereikVanJaar(huidigSeizoenStartJaar() + offsetJaar);
}

/**
 * Geeft een lijst van beschikbare seizoenen terug: huidig + 2 vorige + 1 volgend.
 */
export function beschikbareSeizoenStartJaren() {
  const huidig = huidigSeizoenStartJaar();
  return [huidig + 1, huidig, huidig - 1, huidig - 2];
}

/**
 * Seizoenslabel voor een datum-string.
 */
export function seizoenVanDatum(datum) {
  if (!datum) return '—';
  const d = new Date(datum);
  const startJaar = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1;
  return `${startJaar}–${startJaar + 1}`;
}
