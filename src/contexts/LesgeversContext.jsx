// src/contexts/LesgeversContext.jsx
// Eén gedeelde onSnapshot-listener voor de hele app.
// Hoeveel componenten de data ook nodig hebben:
// altijd 1 actieve Firestore-listener → minimale reads op free tier.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const LesgeversContext = createContext(null);

export function LesgeversProvider({ children }) {
  const [lesgevers, setLesgevers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'lesgevers'), orderBy('naam', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setLesgevers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  return (
    <LesgeversContext.Provider value={{ lesgevers, loading, error }}>
      {children}
    </LesgeversContext.Provider>
  );
}

export function useLesgevers() {
  const ctx = useContext(LesgeversContext);
  if (!ctx) throw new Error('useLesgevers moet binnen <LesgeversProvider> gebruikt worden');
  return ctx;
}
