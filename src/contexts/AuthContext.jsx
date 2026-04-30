// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
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

  // Laad Firestore profiel zodra user ingelogd is.
  // Na het laden van users/{uid}: zoek bijhorende lesgever op via uid-koppeling.
  // lesgeverId wordt toegevoegd aan profiel zodat LesgeversPanel en andere
  // componenten dit kunnen gebruiken zonder extra reads.
  // Let op: als een beheerder de uid-koppeling achteraf legt in Beheer.jsx,
  // is opnieuw inloggen nodig om lesgeverId te zien -- dit is bewust geaccepteerd.
  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(ref, async (snap) => {
      const userData = snap.exists()
        ? { uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() }
        : { uid: firebaseUser.uid, email: firebaseUser.email, naam: '', rol: 'trainer', groepen: [] };

      // Zoek lesgeverId op via uid-koppeling (1 extra read, eenmalig bij login)
      try {
        const lesgeversSnap = await getDocs(collection(db, 'lesgevers'));
        const gekoppeld = lesgeversSnap.docs.find(d => d.data().uid === firebaseUser.uid);
        userData.lesgeverId = gekoppeld ? gekoppeld.id : null;
      } catch {
        userData.lesgeverId = null;
      }

      setProfiel(userData);
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
  const isLid          = profiel?.rol === 'lid';
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
      isLid,
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
