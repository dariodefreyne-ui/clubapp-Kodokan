// src/hooks/useGordelOpties.js
// Levert gordel-codes en labels uit configCache, met fallback op de
// hardcoded waarden zodat pagina's nooit een lege selectie krijgen.
import { useAuth } from '../contexts/AuthContext';

const FALLBACK_OPTIES = ['wit', 'geel', 'oranje', 'groen', 'blauw', 'bruin', 'zwart'];
const FALLBACK_LABELS = {
  wit: 'Wit', geel: 'Geel', oranje: 'Oranje', groen: 'Groen',
  blauw: 'Blauw', bruin: 'Bruin', zwart: 'Zwart',
};

export function useGordelOpties() {
  const { configCache } = useAuth();
  const gordels = configCache?.gordels || [];
  if (gordels.length === 0) {
    return { opties: FALLBACK_OPTIES, labels: FALLBACK_LABELS, gordels: [] };
  }
  // Sorteer op volgorde, dan extraheer codes en labels
  const gesorteerd = gordels.slice().sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0));
  const opties = gesorteerd.map(g => g.code).filter(Boolean);
  const labels = Object.fromEntries(gesorteerd.map(g => [g.code, g.label || g.code]));
  return { opties, labels, gordels: gesorteerd };
}
