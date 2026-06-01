import { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const PaginaRollenContext = createContext(null);

// Provides the Firestore-configurable list of accessible paths for the
// current user's role. Returns null when no custom config exists — consumers
// fall back to ROL_STANDAARD_PAGINAS in that case.
// Mirrors the logic previously inlined in AppLayout so there is one source
// of truth shared by the sidebar and RequireRole.
export function PaginaRollenProvider({ children }) {
  const { profiel } = useAuth();
  const [beschikbarePads, setBeschikbarePads] = useState(null);

  useEffect(() => {
    if (!profiel?.rol) return;
    const unsub = onSnapshot(
      doc(db, 'instellingen', 'paginaRollen'),
      snap => {
        if (!snap.exists()) { setBeschikbarePads(null); return; }
        const pads = snap.data()[profiel.rol] || [];
        if (pads.length === 0) { setBeschikbarePads(null); return; }
        const isBeheerder = profiel.rol === 'admin' || profiel.rol === 'bestuurslid';
        const altijd = ['/', '/dashboard', '/profiel', '/instellingen'];
        if (isBeheerder) altijd.push('/beheer', '/bestuur');
        setBeschikbarePads([...new Set([...pads, ...altijd])]);
      },
      () => setBeschikbarePads(null)
    );
    return unsub;
  }, [profiel?.rol]);

  return (
    <PaginaRollenContext.Provider value={beschikbarePads}>
      {children}
    </PaginaRollenContext.Provider>
  );
}

export function usePaginaRollen() {
  return useContext(PaginaRollenContext);
}
