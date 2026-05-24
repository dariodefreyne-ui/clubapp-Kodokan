// src/hooks/useLesgeversRealtime.js
// Real-time hook dat lesgevers-data via onSnapshot syncht
// Zorgt dat alle pagina's altijd de meest recente data hebben

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useLesgeversRealtime() {
  const [lesgevers, setLesgevers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(collection(db, 'lesgevers'), orderBy('naam', 'asc'));

    // onSnapshot = real-time listener die automatisch triggert bij wijzigingen
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        setLesgevers(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    // Cleanup: verwijder listener als component unmount
    return unsubscribe;
  }, []);

  return { lesgevers, loading, error };
}
