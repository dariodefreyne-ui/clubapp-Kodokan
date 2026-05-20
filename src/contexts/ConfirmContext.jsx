// src/contexts/ConfirmContext.jsx
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [config, setConfig] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opties = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = (uitkomst) => {
        if (opties.redenVeld) {
          resolve(uitkomst || { ok: false, reden: '' });
        } else {
          resolve(uitkomst === true);
        }
      };
      setConfig(opties);
    });
  }, []);

  const sluit = useCallback((uitkomst) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setConfig(null);
    resolver?.(uitkomst);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={!!config}
        titel={config?.titel}
        beschrijving={config?.beschrijving}
        bevestigLabel={config?.bevestigLabel}
        annuleerLabel={config?.annuleerLabel}
        variant={config?.variant}
        redenVeld={config?.redenVeld}
        onBevestig={(result) => sluit(result)}
        onAnnuleer={() => sluit(config?.redenVeld ? { ok: false, reden: '' } : false)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm moet binnen <ConfirmProvider> gebruikt worden');
  return ctx;
}
