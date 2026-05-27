// src/contexts/GroepenContext.jsx
// Gedeelde groepen-data (reuse van LesgeversProvider pattern)
// Eén onSnapshot listener → O(1) groep-lookups overal

import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const GroepenContext = createContext(null);

export function GroepenProvider({ children }) {
  const { firebaseUser } = useAuth();
  const [groepen, setGroepen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (firebaseUser === undefined) return;
    if (!firebaseUser) {
      setGroepen([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(collection(db, 'groepen'), orderBy('naam', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setGroepen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, [firebaseUser?.uid]);

  return (
    <GroepenContext.Provider value={{ groepen, loading, error }}>
      {children}
    </GroepenContext.Provider>
  );
}

export function useGroepen() {
  const ctx = useContext(GroepenContext);
  if (!ctx) throw new Error('useGroepen moet binnen <GroepenProvider> gebruikt worden');
  return ctx;
}
