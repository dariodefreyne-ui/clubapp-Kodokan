// src/hooks/useGordelOpties.js
// Levert gordel-codes en labels uit configCache, met fallback op de
// hardcoded waarden zodat pagina's nooit een lege selectie krijgen.
import { useAuth } from '../contexts/AuthContext';

const FALLBACK_OPTIES = ['wit', 'geel', 'oranje', 'groen', 'blauw', 'bruin', 'zwart'];
const FALLBACK_LABELS = {
  wit: 'Wit', geel: 'Geel', oranje: 'Oranje', groen: 'Groen',
  blauw: 'Blauw', bruin: 'Bruin', zwart: 'Zwart',
};
const FALLBACK_KYU = {
  wit: '6', geel: '5', oranje: '4', groen: '3', blauw: '2', bruin: '1', zwart: '0',
};
const FALLBACK_KYU_LABELS = {
  wit: 'Wit (6e kyu)', geel: 'Geel (5e kyu)', oranje: 'Oranje (4e kyu)',
  groen: 'Groen (3e kyu)', blauw: 'Blauw (2e kyu)', bruin: 'Bruin (1e kyu)',
  zwart: 'Zwart (1e dan+)',
};
const FALLBACK_COLORS = {
  wit:    { bg: '#fff', color: '#333', border: '1px solid #ccc' },
  geel:   { bg: '#f1c40f', color: '#333' },
  oranje: { bg: '#e67e22', color: '#fff' },
  groen:  { bg: '#27ae60', color: '#fff' },
  blauw:  { bg: '#3498db', color: '#fff' },
  bruin:  { bg: '#8B4513', color: '#fff' },
  zwart:  { bg: '#1a1a1a', color: '#fff', border: '1px solid #555' },
};
const FALLBACK_NEXT = {
  wit: 'geel', geel: 'oranje', oranje: 'groen', groen: 'blauw',
  blauw: 'bruin', bruin: 'zwart', zwart: 'zwart',
};

// Leidt tekstkleur/rand af uit een hex-achtergrondkleur (luminantie-contrast).
function kleurNaarStijl(kleur) {
  const hex = (kleur || '#999999').replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const stijl = { bg: kleur, color: lum > 0.6 ? '#333' : '#fff' };
  if (lum > 0.85) stijl.border = '1px solid #ccc';
  else if (lum < 0.15) stijl.border = '1px solid #555';
  return stijl;
}

export function useGordelOpties() {
  const { configCache } = useAuth();
  const gordels = configCache?.gordels || [];
  if (gordels.length === 0) {
    return {
      opties: FALLBACK_OPTIES, labels: FALLBACK_LABELS, gordels: [],
      kyuMap: FALLBACK_KYU, kyuLabels: FALLBACK_KYU_LABELS,
      colors: FALLBACK_COLORS, next: FALLBACK_NEXT,
    };
  }
  // Sorteer op volgorde, dan extraheer codes en labels
  const gesorteerd = gordels.slice().sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
  const opties = gesorteerd.map(g => g.code).filter(Boolean);
  const labels = Object.fromEntries(gesorteerd.map(g => [g.code, g.label || g.code]));
  const kyuMap = Object.fromEntries(gesorteerd.map(g => [g.code, String(g.kyu ?? '')]));
  // Het label uit Clubdata bevat al de kyu-aanduiding (bv. "Wit (6e kyu)")
  const kyuLabels = labels;
  const colors = Object.fromEntries(gesorteerd.map(g => [g.code, kleurNaarStijl(g.kleur)]));
  const next = Object.fromEntries(gesorteerd.map((g, i) => [g.code, (gesorteerd[i + 1] || g).code]));
  return { opties, labels, gordels: gesorteerd, kyuMap, kyuLabels, colors, next };
}
