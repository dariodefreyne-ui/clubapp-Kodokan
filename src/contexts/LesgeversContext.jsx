// src/contexts/LesgeversContext.jsx
// Eén gedeelde onSnapshot-listener voor de hele app.
// Wacht op Firebase auth voor de listener start — anders falen Firestore rules.

import React, { createContext, useContext, useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const LesgeversContext = createContext(null);

export function LesgeversProvider({ children }) {
  const { firebaseUser } = useAuth();
  const [lesgevers, setLesgevers] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  useEffect(() => {
    // Wacht tot auth gekend is (undefined = nog aan het laden, null = niet ingelogd)
    if (firebaseUser === undefined) return;
    if (!firebaseUser) {
      setLesgevers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
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
  }, [firebaseUser?.uid]);

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
