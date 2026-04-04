// src/contexts/AuthContext.jsx
// PIN-beveiliging:
//   - beheerder + trainer PIN: opgeslagen in Firestore settings/pins
//     → zelfde PIN op alle toestellen, geen handmatige sync nodig
//   - beheerderUnlocked: sessionStorage → auto-gewist bij volledig sluiten browser
//   - trainerUnlocked: localStorage met datum → reset elke dag automatisch
//   - Standaard fallback (eerste gebruik): beheerder=1234, trainer=5678

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const DEFAULT_PINS = { beheerder: '1234', trainer: '5678' };
const LS_BEHEERDER_KEY = 'kodokan.beheerder.unlocked'; // sessionStorage
const LS_TRAINER_KEY   = 'kodokan.trainer.unlockedDate'; // localStorage + datum

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [pins, setPins]             = useState(DEFAULT_PINS);
  const [pinsLoaded, setPinsLoaded] = useState(false);
  const [role, setRole]             = useState(null); // 'beheerder' | 'trainer' | null

  const [beheerderUnlocked, setBeheerderUnlocked] = useState(() => {
    try { return sessionStorage.getItem(LS_BEHEERDER_KEY) === '1'; } catch { return false; }
  });
  const [trainerUnlocked, setTrainerUnlocked] = useState(() => {
    try { return localStorage.getItem(LS_TRAINER_KEY) === todayStr(); } catch { return false; }
  });

  // Rol herstellen uit storage bij page refresh
  useEffect(() => {
    if (beheerderUnlocked) setRole('beheerder');
    else if (trainerUnlocked) setRole('trainer');
  }, []); // eslint-disable-line

  // PINs laden uit Firestore → sync over alle toestellen
  useEffect(() => {
    const ref = doc(db, 'settings', 'pins');
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const d = snap.data();
        setPins({
          beheerder: String(d.beheerder || DEFAULT_PINS.beheerder),
          trainer:   String(d.trainer   || DEFAULT_PINS.trainer),
        });
      }
      setPinsLoaded(true);
    }, () => setPinsLoaded(true)); // Offline: gebruik defaults
    return unsub;
  }, []);

  // Reset om middernacht
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        if (!sessionStorage.getItem(LS_BEHEERDER_KEY)) {
          setBeheerderUnlocked(false);
          setRole(r => r === 'beheerder' ? null : r);
        }
        if (localStorage.getItem(LS_TRAINER_KEY) !== todayStr()) {
          setTrainerUnlocked(false);
          setRole(r => r === 'trainer' ? null : r);
        }
      } catch {}
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const login = useCallback((pin) => {
    if (pin === pins.beheerder) {
      setBeheerderUnlocked(true);
      setRole('beheerder');
      try { sessionStorage.setItem(LS_BEHEERDER_KEY, '1'); } catch {}
      return 'beheerder';
    }
    if (pin === pins.trainer) {
      setTrainerUnlocked(true);
      setRole('trainer');
      try { localStorage.setItem(LS_TRAINER_KEY, todayStr()); } catch {}
      return 'trainer';
    }
    return null;
  }, [pins]);

  const logout = useCallback(() => {
    setRole(null);
    setBeheerderUnlocked(false);
    setTrainerUnlocked(false);
    try {
      sessionStorage.removeItem(LS_BEHEERDER_KEY);
      localStorage.removeItem(LS_TRAINER_KEY);
    } catch {}
  }, []);

  // PINs opslaan in Firestore → sync naar alle toestellen automatisch
  const savePins = useCallback(async (newBeheerder, newTrainer) => {
    await setDoc(doc(db, 'settings', 'pins'), {
      beheerder: newBeheerder,
      trainer:   newTrainer,
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      role,
      isAuthenticated: role !== null,
      pinsLoaded,
      login,
      logout,
      savePins,
      isBeheerder: role === 'beheerder',
      isTrainer:   role === 'trainer',
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth buiten AuthProvider');
  return ctx;
}

export default AuthContext;
