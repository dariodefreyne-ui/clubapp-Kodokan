// Eenvoudige media-query hook — luistert naar viewport-veranderingen
import { useEffect, useState } from 'react';

export default function useMediaQuery(query) {
  const [match, setMatch] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const onChange = (e) => setMatch(e.matches);
    mql.addEventListener('change', onChange);
    setMatch(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return match;
}
