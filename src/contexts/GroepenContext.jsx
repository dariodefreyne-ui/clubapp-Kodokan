// src/contexts/GroepenContext.jsx
// Thin wrapper die configCache.groepen uit AuthContext hergebruikt.
// Geen eigen Firestore listener — AuthContext beheert de data centraal.

import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

const GroepenContext = createContext(null);

export function GroepenProvider({ children }) {
  const { configCache } = useAuth();
  const groepen = configCache?.groepen || [];

  return (
    <GroepenContext.Provider value={{ groepen, loading: false, error: null }}>
      {children}
    </GroepenContext.Provider>
  );
}

export function useGroepen() {
  const ctx = useContext(GroepenContext);
  if (!ctx) throw new Error('useGroepen moet binnen <GroepenProvider> gebruikt worden');
  return ctx;
}
