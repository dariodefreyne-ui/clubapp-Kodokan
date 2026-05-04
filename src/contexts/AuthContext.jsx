// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const AuthContext = createContext(null);

const DEFAULT_NOTIFICATIES = {
  stockAlerts: false,
  trainerGroepen: [],
  emailVoorkeur: '',
  pushTokens: [],
};

async function initialiseerNotificatiesIndienNodig(uid, email, bestaandeData) {
  if (bestaandeData?.notificaties) return;
  await setDoc(doc(db, 'users', uid), {
    notificaties: { ...DEFAULT_NOTIFICATIES, emailVoorkeur: email || '' },
    bijgewerkt: serverTimestamp(),
  }, { merge: true });
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profiel, setProfiel] = useState(null);
  const [profielLoaded, setProfielLoaded] = useState(false);

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

  useEffect(() => {
    if (!firebaseUser) return;

    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(ref, async (snap) => {
      const userData = snap.exists()
        ? { uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() }
        : { uid: firebaseUser.uid, email: firebaseUser.email, naam: '', rol: 'lid', groepen: [] };

      try {
        const lesgeversSnap = await getDocs(collection(db, 'lesgevers'));
        const gekoppeld = lesgeversSnap.docs.find(d => d.data().uid === firebaseUser.uid);
        userData.lesgeverId = gekoppeld ? gekoppeld.id : null;
      } catch {
        userData.lesgeverId = null;
      }

      // Initialiseer notificaties-map als die nog niet bestaat
      await initialiseerNotificatiesIndienNodig(
        firebaseUser.uid,
        firebaseUser.email,
        snap.exists() ? snap.data() : null
      );

      setProfiel(userData);
      setProfielLoaded(true);
    });

    return unsub;
  }, [firebaseUser]);

  const login = async (email, wachtwoord) => {
    await signInWithEmailAndPassword(auth, email, wachtwoord);
  };

  const resetWachtwoord = async (email) => {
    await sendPasswordResetEmail(auth, email);
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

  const isLaden = firebaseUser === undefined || (firebaseUser !== null && !profielLoaded);
  const isAuthenticated = !!firebaseUser && profielLoaded;
  const isBeheerder = profiel?.rol === 'beheerder';
  const isTrainer = profiel?.rol === 'trainer' || isBeheerder;
  const isLid = profiel?.rol === 'lid';
  const role = profiel?.rol ?? null;

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
      resetWachtwoord,
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
