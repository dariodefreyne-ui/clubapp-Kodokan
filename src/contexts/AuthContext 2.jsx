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
  const [lesgeverId, setLesgeverId]     = useState(null);

  // Luister naar Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfiel(null);
        setLesgeverId(null);
        setProfielLoaded(true);
      }
    });
    return unsub;
  }, []);

  // Laad Firestore profiel via realtime listener
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

  // Zoek lesgeverId op via uid-koppeling -- apart van onSnapshot zodat auth
  // zeker actief is voor de Firestore read. Eenmalig bij login.
  // Let op: als een beheerder de uid-koppeling achteraf legt in Beheer.jsx,
  // is opnieuw inloggen nodig om lesgeverId te zien -- dit is bewust geaccepteerd.
  useEffect(() => {
    if (!firebaseUser || !profielLoaded) return;
    let actief = true;

    getDocs(collection(db, 'lesgevers'))
      .then(snap => {
        if (!actief) return;
        const gekoppeld = snap.docs.find(d => d.data().uid === firebaseUser.uid);
        setLesgeverId(gekoppeld ? gekoppeld.id : null);
      })
      .catch(() => {
        if (actief) setLesgeverId(null);
      });

    return () => { actief = false; };
  }, [firebaseUser, profielLoaded]);

  const login = async (email, wachtwoord) => {
    await signInWithEmailAndPassword(auth, email, wachtwoord);
  };

  const logout = async () => {
    await signOut(auth);
    setProfiel(null);
    setLesgeverId(null);
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

  // lesgeverId wordt samengevoegd in profiel zodat alle componenten
  // gewoon profiel.lesgeverId kunnen gebruiken zonder aanpassing
  const profielMetLesgeverId = profiel ? { ...profiel, lesgeverId } : null;

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      profiel: profielMetLesgeverId,
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
