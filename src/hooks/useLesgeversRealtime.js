// src/hooks/useLesgeversRealtime.js
// Backward-compatibele wrapper rond LesgeversContext.
// Alle bestaande imports blijven werken zonder aanpassing;
// data komt uit één gedeelde listener i.p.v. per component een eigen onSnapshot.

import { useLesgevers } from '../contexts/LesgeversContext.jsx';

export function useLesgeversRealtime() {
  return useLesgevers();
}
