// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDocs, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { standaardVoorkeurenVoorRol } from '../notifications/notificationCategories';

const AuthContext = createContext(null);

async function initialiseerNotificatiesIndienNodig(uid, email, bestaandeData) {
  // Initialiseer notificatieVoorkeuren als nog niet aanwezig
  if (bestaandeData?.notificatieVoorkeuren) return;
  const rol = bestaandeData?.rol || 'lid';
  await setDoc(doc(db, 'users', uid), {
    notificatieVoorkeuren: standaardVoorkeurenVoorRol(rol),
    notificatieEmail: bestaandeData?.notificatieEmail || email || '',
    bijgewerkt: serverTimestamp(),
  }, { merge: true });
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profiel, setProfiel] = useState(null);
  const [profielLoaded, setProfielLoaded] = useState(false);
  const [lesgeverId, setLesgeverId] = useState(null);

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

  useEffect(() => {
    if (!firebaseUser) {
      setLesgeverId(null);
      return;
    }

    let actief = true;
    getDocs(collection(db, 'lesgevers'))
      .then((snap) => {
        if (!actief) return;
        const gekoppeld = snap.docs.find(d => d.data().uid === firebaseUser.uid);
        setLesgeverId(gekoppeld ? gekoppeld.id : null);
      })
      .catch(() => {
        if (actief) setLesgeverId(null);
      });

    return () => { actief = false; };
  }, [firebaseUser?.uid]);

  const login = async (email, wachtwoord) => {
    await signInWithEmailAndPassword(auth, email, wachtwoord);
  };

  const registreer = async (email, wachtwoord, naam) => {
    const credential = await createUserWithEmailAndPassword(auth, email, wachtwoord);
    const uid = credential.user.uid;
    await setDoc(doc(db, 'users', uid), {
      naam: naam.trim(),
      email: email.trim(),
      rol: 'lid',
      groepen: [],
      notificatieVoorkeuren: standaardVoorkeurenVoorRol('lid'),
      notificatieEmail: email.trim(),
      onboardingVoltooid: false,
      aangemaakt: serverTimestamp(),
      bijgewerkt: serverTimestamp(),
    });
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
  const isAdmin = profiel?.rol === 'admin';
  const isBestuurslid = profiel?.rol === 'bestuurslid';
  // Backwards-compatibel alias - wordt gebruikt door stap 2 nog niet aangepaste paginas
  const isBeheerder = isAdmin || isBestuurslid;
  const isTrainer = profiel?.rol === 'trainer' || isBeheerder;
  const isLid = profiel?.rol === 'lid';
  const role = profiel?.rol ?? null;

  return (
    <AuthContext.Provider value={{
      firebaseUser,
      profiel,
      lesgeverId,
      role,
      isLaden,
      isAuthenticated,
      isAdmin,
      isBestuurslid,
      isBeheerder,
      isTrainer,
      isLid,
      login,
      registreer,
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
