// src/hooks/useLesgeversRealtime.js
// Backward-compatibele wrapper rond LesgeversContext.
// Alle bestaande imports van deze hook blijven werken zonder aanpassing,
// maar de data komt nu uit één gedeelde listener in plaats van per component.

import { useLesgevers } from '../contexts/LesgeversContext';

export function useLesgeversRealtime() {
  return useLesgevers();
}
