// src/components/trainingen/seizoenHelpers.js
// Re-exporteer gedeelde seizoenslogica
export {
  huidigSeizoenStartJaar,
  beschikbareSeizoenStartJaren,
  seizoenBereikVanJaar,
} from '../../utils/seizoenUtils';

// Trainingen-specifieke helpers (werken met 'YYYY-YYYY' string formaat)
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
