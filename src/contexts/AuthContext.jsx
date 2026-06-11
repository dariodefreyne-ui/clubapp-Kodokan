// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { standaardVoorkeurenVoorRol } from '../notifications/notificationCategories';
import { setSeizoenSettings, initSeizoenListener } from '../utils/seizoenUtils';

const AuthContext = createContext(null);

// Config-data (categorieën, gordels, ...) verandert zelden. We cachen ze per
// tab-sessie in sessionStorage met een TTL, zodat tabwissels/app-herstarts
// binnen het uur geen 6 extra Firestore-reads per login kosten.
// Tradeoff (zie A7): een config-wijziging door een beheerder is voor andere
// ingelogde gebruikers pas zichtbaar na max. 1u of een nieuwe tab-sessie.
const CONFIG_CACHE_KEY = 'configCache';
const CONFIG_CACHE_TTL_MS = 60 * 60 * 1000; // 1 uur

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

// Server-side afgehandeld door de Cloud Function koppelLidViaEmail.
// De client-side koppeling is verwijderd omdat linkedMemberId een privilege-
// dragend veld is: de koppeling bepaalt welk members-document een lid mag
// lezen en bewerken (isLinkedMember-check in firestore.rules).

export function AuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(undefined);
  const [profiel, setProfiel] = useState(null);
  const [profielLoaded, setProfielLoaded] = useState(false);
  const [lesgeverId, setLesgeverId] = useState(null);
  const [configCache, setConfigCache] = useState({
    categorieen: [], gordels: [], lesgeverTypes: [], groepen: [],
    techniekCategorieen: [], productCategorieen: [],
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
    let snapOntvangenOf = false;

    // Veiligheidsnets: als Firestore na 8s nog niet heeft gereageerd (bv. door trage
    // IndexedDB-initialisatie op iOS PWA), gaan we verder met een minimaal profiel
    // zodat de app niet oneindig in laadtoestand blijft hangen.
    const fallbackTimer = setTimeout(() => {
      if (snapOntvangenOf) return;
      snapOntvangenOf = true;
      console.warn('[AuthContext] Firestore profiel niet geladen binnen 8s — fallback profiel gebruikt');
      setProfiel({ uid: firebaseUser.uid, email: firebaseUser.email, naam: '', rol: 'lid', groepen: [] });
      setProfielLoaded(true);
    }, 8000);

    const unsub = onSnapshot(ref, async (snap) => {
      snapOntvangenOf = true;
      clearTimeout(fallbackTimer);
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
      // Lid-koppeling op e-mail: server-side afgehandeld door de Cloud Function koppelLidViaEmail.
    }, (err) => {
      snapOntvangenOf = true;
      clearTimeout(fallbackTimer);
      console.error('[AuthContext] profiel laden mislukt:', err.code, err.message);
      setProfiel({ uid: firebaseUser.uid, email: firebaseUser.email, naam: '', rol: 'lid', groepen: [] });
      setProfielLoaded(true);
    });

    return () => {
      unsub();
      clearTimeout(fallbackTimer);
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!firebaseUser) {
      setLesgeverId(null);
      return;
    }

    let actief = true;
    // Gericht zoeken op uid → altijd 0 of 1 document i.p.v. de volledige
    // lesgevers-collectie inlezen bij elke login.
    getDocs(query(collection(db, 'lesgevers'), where('uid', '==', firebaseUser.uid), limit(1)))
      .then((snap) => {
        if (!actief) return;
        setLesgeverId(snap.empty ? null : snap.docs[0].id);
      })
      .catch(() => {
        if (actief) setLesgeverId(null);
      });

    return () => { actief = false; };
  }, [firebaseUser?.uid]);

  // Realtime listener voor seizoeninstellingen — actief zolang gebruiker ingelogd is.
  // Zo werkt een startmaand-wijziging in Beheer meteen door zonder page-refresh.
  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = initSeizoenListener(db);
    return unsub;
  }, [firebaseUser?.uid]);

  useEffect(() => {
    if (!firebaseUser) {
      setConfigCache({
        categorieen: [], gordels: [], lesgeverTypes: [], groepen: [],
        techniekCategorieen: [], productCategorieen: [],
        clubSettings: null, seizoenSettings: null,
      });
      try { sessionStorage.removeItem(CONFIG_CACHE_KEY); } catch { /* niet beschikbaar */ }
      return;
    }
    let actief = true;

    // Verse cache uit sessionStorage gebruiken indien beschikbaar → vermijdt de
    // 6 config-reads bij app-herstart/tabwissel binnen de TTL.
    try {
      const raw = sessionStorage.getItem(CONFIG_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.uid === firebaseUser.uid && parsed?.ts &&
            (Date.now() - parsed.ts) < CONFIG_CACHE_TTL_MS && parsed.data) {
          setConfigCache(parsed.data);
          return () => { actief = false; };
        }
      }
    } catch { /* corrupt of onbeschikbaar → gewoon vers laden */ }

    const laden = async () => {
      try {
        const [catSnap, gordelSnap, lesSnap, groepenSnap, techCatSnap, clubSnap, prodCatSnap] = await Promise.all([
          getDocs(query(collection(db, 'categorieen'), orderBy('volgorde'))),
          getDocs(query(collection(db, 'gordels'), orderBy('volgorde'))),
          getDocs(query(collection(db, 'lesgeverTypes'), orderBy('volgorde'))),
          getDocs(query(collection(db, 'groepen'), orderBy('naam'))),
          getDocs(query(collection(db, 'techniekCategorieen'), orderBy('volgorde'))).catch(() => ({ docs: [] })),
          getDoc(doc(db, 'settings', 'club')).catch(() => null),
          getDocs(query(collection(db, 'productCategorieen'), orderBy('volgorde'))).catch(() => ({ docs: [] })),
        ]);
        if (!actief) return;
        const seizoenData = null; // komt nu van realtime initSeizoenListener hierboven
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
        const volgende = {
          categorieen: catSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          gordels: gordelSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          lesgeverTypes: lesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          groepen: groepenSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          techniekCategorieen: techCatSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          productCategorieen: prodCatSnap.docs.map(d => ({ id: d.id, ...d.data() })),
          clubSettings: clubData,
          seizoenSettings: seizoenData,
        };
        setConfigCache(volgende);
        try {
          sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
            uid: firebaseUser.uid, ts: Date.now(), data: volgende,
          }));
        } catch { /* sessionStorage vol/onbeschikbaar → niet cachen */ }
      } catch { /* stil falen — pagina's vallen terug op eigen fetch */ }
    };
    laden();
    return () => { actief = false; };
  }, [firebaseUser?.uid]);

  const refreshConfigCache = React.useCallback(async () => {
    if (!firebaseUser) return;
    try { sessionStorage.removeItem(CONFIG_CACHE_KEY); } catch { /* noop */ }
    const [catSnap, gordelSnap, lesSnap, groepenSnap, techCatSnap, clubSnap, prodCatSnap] = await Promise.all([
      getDocs(query(collection(db, 'categorieen'), orderBy('volgorde'))),
      getDocs(query(collection(db, 'gordels'), orderBy('volgorde'))),
      getDocs(query(collection(db, 'lesgeverTypes'), orderBy('volgorde'))),
      getDocs(query(collection(db, 'groepen'), orderBy('naam'))),
      getDocs(query(collection(db, 'techniekCategorieen'), orderBy('volgorde'))).catch(() => ({ docs: [] })),
      getDoc(doc(db, 'settings', 'club')).catch(() => null),
      getDocs(query(collection(db, 'productCategorieen'), orderBy('volgorde'))).catch(() => ({ docs: [] })),
    ]);
    const clubData = clubSnap?.exists() ? clubSnap.data() : null;
    const volgende = {
      categorieen:          catSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      gordels:              gordelSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      lesgeverTypes:        lesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      groepen:              groepenSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      techniekCategorieen:  techCatSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      productCategorieen:   prodCatSnap.docs.map(d => ({ id: d.id, ...d.data() })),
      clubSettings:         clubData,
      seizoenSettings:      null,
    };
    setConfigCache(volgende);
    try {
      sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({
        uid: firebaseUser.uid, ts: Date.now(), data: volgende,
      }));
    } catch { /* noop */ }
  }, [firebaseUser]);

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
    // linkedMemberId wordt server-side beheerd — nooit via slaProfielOp meesturen.
    // eslint-disable-next-line no-unused-vars
    const { linkedMemberId: _remoov, ...veiligData } = data;
    await setDoc(doc(db, 'users', firebaseUser.uid), {
      ...veiligData,
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
  const isAssistent = profiel?.rol === 'assistent';
  // Assistenten gedragen zich als lesgever voor techniek-zicht, eigen trainingen
  // en uitbetaling — maar krijgen GEEN trainer-schrijfrechten (gebruik isTrainer
  // daar waar het om beheer/bewerken gaat).
  const isLesgever = isTrainer || isAssistent;
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
      isAssistent,
      isLesgever,
      isLid,
      login,
      registreer,
      logout,
      resetWachtwoord,
      slaProfielOp,
      setProfiel,
      configCache,
      refreshConfigCache,
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
