// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { standaardVoorkeurenVoorRol } from '../notifications/notificationCategories';
import { setSeizoenSettings } from '../utils/seizoenUtils';

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

// Koppel het user-account automatisch aan een lid uit ledenbeheer op basis van
// het e-mailadres, zodat inschrijvingen/activiteiten betrouwbaar aan dit lid
// gekoppeld kunnen worden. Gebeurt enkel bij exact één actief lid met dat
// e-mailadres; anders bewust niet (geen foute koppeling).
async function koppelLidViaEmailIndienNodig(uid, email, bestaandeData) {
  if (bestaandeData?.linkedMemberId || !email) return;
  try {
    const snap = await getDocs(query(collection(db, 'members'), where('email', '==', email)));
    const actieve = snap.docs.filter(d => {
      const m = d.data();
      return m.actief !== false && m.active !== false;
    });
    if (actieve.length !== 1) return; // geen of dubbelzinnig → niet koppelen
    const lid = actieve[0];
    // Eigen user-doc: altijd schrijfbaar → dit is wat het dashboard gebruikt.
    await setDoc(doc(db, 'users', uid), { linkedMemberId: lid.id, bijgewerkt: serverTimestamp() }, { merge: true });
    // Omgekeerde link op het lid: best-effort (lukt voor trainer/admin; voor een
    // lid mogelijk niet door de rules — dan legt ledenbeheer dit later).
    try {
      await setDoc(doc(db, 'members', lid.id), { linkedUserId: uid }, { merge: true });
    } catch { /* reverse-link niet toegestaan voor dit account */ }
  } catch { /* stil falen — koppeling kan later via ledenbeheer */ }
}

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profiel, setProfiel] = useState(null);
  const [profielLoaded, setProfielLoaded] = useState(false);
  const [lesgeverId, setLesgeverId] = useState(null);
  const [configCache, setConfigCache] = useState({
    categorieen: [], gordels: [], lesgeverTypes: [], groepen: [],
    techniekCategorieen: [],
    clubSettings: null,
    seizoenSettings: null,
  });

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

      // Probeer (eenmalig, tot gelukt) een lid te koppelen op e-mail.
      koppelLidViaEmailIndienNodig(
        firebaseUser.uid,
        firebaseUser.email,
        snap.exists() ? snap.data() : null
      );
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

  useEffect(() => {
    if (!firebaseUser) {
      setConfigCache({
        categorieen: [], gordels: [], lesgeverTypes: [], groepen: [],
        techniekCategorieen: [], clubSettings: null, seizoenSettings: null,
      });
      return;
    }
    let actief = true;
    const laden = async () => {
      try {
        const [catSnap, gordelSnap, lesSnap, groepenSnap, techCatSnap, clubSnap, seizSnap] = await Promise.all([
          getDocs(query(collection(db, 'categorieen'), orderBy('volgorde'))),
          getDocs(query(collection(db, 'gordels'), orderBy('volgorde'))),
          getDocs(query(collection(db, 'lesgeverTypes'), orderBy('volgorde'))),
          getDocs(query(collection(db, 'groepen'), orderBy('naam'))),
          getDocs(query(collection(db, 'techniekCategorieen'), orderBy('volgorde'))).catch(() => ({ docs: [] })),
          getDoc(doc(db, 'settings', 'club')).catch(() => null),
          getDoc(doc(db, 'settings', 'seizoen')).catch(() => null),
        ]);
        if (!actief) return;
        const seizoenData = seizSnap?.exists() ? seizSnap.data() : null;
        if (seizoenData) setSeizoenSettings(seizoenData);
        const clubData = clubSnap?.exists() ? clubSnap.data() : null;
        // Cache club settings in localStorage zodat LoginPagina + Onboarding
        // de juiste naam tonen vooraleer Firestore weer ingelezen is.
        if (clubData) {
          try {
            localStorage.setItem('clubSettingsCache', JSON.stringify({
              clubname: clubData.clubname || clubData.naam || '',
              naamKort: clubData.naamKort || '',
              logoUrl: clubData.logoUrl || '',
            }));
          } catch { /* localStorage onbeschikbaar */ }
        }
        setConfigCache({
          categorieen: catSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          gordels: gordelSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          lesgeverTypes: lesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          groepen: groepenSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          techniekCategorieen: techCatSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          clubSettings: clubData,
          seizoenSettings: seizoenData,
        });
      } catch { /* stil falen — pagina's vallen terug op eigen fetch */ }
    };
    laden();
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
      updatedBy: firebaseUser.uid,
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
      configCache,
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
