// src/hooks/useIsMobile.js
// Gedeelde mobile-detectie zodat componenten dezelfde breakpoint gebruiken
// i.p.v. losse `window.innerWidth < 768`-checks met afwijkende grenzen.
import { useEffect, useState } from 'react';

export const MOBILE_BP = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BP : true
  );
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BP);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}
