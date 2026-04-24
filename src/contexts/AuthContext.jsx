// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined); // undefined = nog laden
  const [profiel, setProfiel]           = useState(null);
  const [profielLoaded, setProfielLoaded] = useState(false);

  // Luister naar Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfiel(null);
        setProfielLoaded(true);
      }
    });
    return unsub;
  }, []);

  // Laad Firestore profiel zodra user ingelogd is
  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setProfiel({ uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() });
      } else {
        setProfiel({ uid: firebaseUser.uid, email: firebaseUser.email, naam: '', rol: 'trainer', groepen: [] });
      }
      setProfielLoaded(true);
    });
    return unsub;
  }, [firebaseUser]);

  const login = async (email, wachtwoord) => {
    await signInWithEmailAndPassword(auth, email, wachtwoord);
  };

  const logout = async () => {
    await signOut(auth);
    setProfiel(null);
    setProfielLoaded(false);
  };

  const slaProfielOp = async (data) => {
    if (!firebaseUser) return;
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      ...data,
      email: firebaseUser.email,
      bijgewerkt: serverTimestamp(),
    }, { merge: true });
  };

  const isLaden        = firebaseUser === undefined || (firebaseUser !== null && !profielLoaded);
  const isAuthenticated = !!firebaseUser && profielLoaded;
  const isBeheerder    = profiel?.rol === 'beheerder';
  const isTrainer      = profiel?.rol === 'trainer' || isBeheerder;
  const role           = profiel?.rol ?? null;

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      profiel,
      role,
      isLaden,
      isAuthenticated,
      isBeheerder,
      isTrainer,
      login,
      logout,
      slaProfielOp,
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
