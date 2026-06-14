import React, { createContext, useContext, useState } from 'react';

const PaginaTitelContext = createContext(null);

export function PaginaTitelProvider({ children }) {
  const [overrideTitel, setOverrideTitel] = useState(null);
  return (
    <PaginaTitelContext.Provider value={{ overrideTitel, setOverrideTitel }}>
      {children}
    </PaginaTitelContext.Provider>
  );
}

export function usePaginaTitelOverride(titel) {
  const ctx = useContext(PaginaTitelContext);
  React.useEffect(() => {
    if (!ctx) return;
    ctx.setOverrideTitel(titel || null);
    return () => ctx.setOverrideTitel(null);
  }, [titel]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function useOverrideTitel() {
  return useContext(PaginaTitelContext)?.overrideTitel ?? null;
}
