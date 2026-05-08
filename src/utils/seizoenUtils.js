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

// ─── DATUM & SEIZOEN HELPERS ──────────────────────────────────────────────────

export function bepaalSeizoen(datumISO) {
  if (!datumISO) return null;
  const d = new Date(datumISO + 'T00:00:00');
  const jaar = d.getFullYear();
  const maand = d.getMonth();
  return maand >= 8 ? `${jaar}-${jaar + 1}` : `${jaar - 1}-${jaar}`;
}

export function huidigSeizoen() {
  return bepaalSeizoen(new Date().toISOString().slice(0, 10));
}

export function vandaagISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDatum(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function trainingsId(groepId, datum) {
  return `${groepId}_${datum}`;
}
