/**
 * seizoenUtils.js — seizoenslogica
 * Defaults: seizoen loopt van 1 september t.e.m. 30 juni.
 * Pas aan via Beheer > Clubdata > Seizoen (Firestore: settings/seizoen).
 */

// Module-level cache voor seizoeninstellingen. Wordt geladen door AuthContext
// en geüpdate via setSeizoenSettings().
let SEIZOEN_SETTINGS = { startMaand: 9, startDag: 1, eindMaand: 6, eindDag: 30 };

export function setSeizoenSettings(settings) {
  if (!settings) return;
  SEIZOEN_SETTINGS = {
    startMaand: Number(settings.startMaand) || 9,
    startDag: Number(settings.startDag) || 1,
    eindMaand: Number(settings.eindMaand) || 6,
    eindDag: Number(settings.eindDag) || 30,
  };
}

export function getSeizoenSettings() {
  return { ...SEIZOEN_SETTINGS };
}

/**
 * Geeft start- en einddatum van een seizoen terug op basis van het startjaar.
 * @param {number} startJaar  bv. 2025 → seizoen 2025-2026
 */
export function seizoenBereikVanJaar(startJaar) {
  const { startMaand, startDag, eindMaand, eindDag } = SEIZOEN_SETTINGS;
  const sm = String(startMaand).padStart(2, '0');
  const sd = String(startDag).padStart(2, '0');
  const em = String(eindMaand).padStart(2, '0');
  const ed = String(eindDag).padStart(2, '0');
  return {
    start: `${startJaar}-${sm}-${sd}`,
    einde: `${startJaar + 1}-${em}-${ed}`,
    label: `${startJaar}–${startJaar + 1}`,
    startJaar,
  };
}

/**
 * Huidig seizoensstartjaar op basis van de huidige datum + start-maand setting.
 * Voorbeeld met september-start: April → maand 3 < 8 → startJaar = vorigJaar.
 */
export function huidigSeizoenStartJaar() {
  const now = new Date();
  // startMaand is 1-indexed (sept = 9); JS getMonth is 0-indexed (sept = 8).
  const startMaandIdx = SEIZOEN_SETTINGS.startMaand - 1;
  return now.getMonth() >= startMaandIdx ? now.getFullYear() : now.getFullYear() - 1;
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
  const startMaandIdx = SEIZOEN_SETTINGS.startMaand - 1;
  const startJaar = d.getMonth() >= startMaandIdx ? d.getFullYear() : d.getFullYear() - 1;
  return `${startJaar}–${startJaar + 1}`;
}

// ─── DATUM & SEIZOEN HELPERS ──────────────────────────────────────────────────

export function bepaalSeizoen(datumISO) {
  if (!datumISO) return null;
  const d = new Date(datumISO + 'T00:00:00');
  const jaar = d.getFullYear();
  const maand = d.getMonth();
  const startMaandIdx = SEIZOEN_SETTINGS.startMaand - 1;
  return maand >= startMaandIdx ? `${jaar}-${jaar + 1}` : `${jaar - 1}-${jaar}`;
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
