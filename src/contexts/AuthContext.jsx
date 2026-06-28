// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
// tab-sessie in sessionStorage met een TTL van 24u. Een config-wijziging door
// een beheerder is voor andere ingelogde gebruikers pas zichtbaar na de TTL of
// na een nieuw tabblad. Tradeoff is bewust: 7 reads per sessie in plaats van
// elke uur.
const CONFIG_CACHE_KEY = 'configCache';
const CONFIG_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 uur

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

  // Laad-diagnostics: bijhouden welke fase hangt en wanneer elke stap klaar was.
  // Geëxporteerd naar App.jsx voor tonen in de timeout-scherm.
  const laadT0 = useRef(Date.now());
  const authVuurdeRef = useRef(false);
  const [laadFase, setLaadFase] = useState({
    auth: 'wachtend',   // 'wachtend' | 'ingelogd' | 'uitgelogd' | 'timeout'
    authMs: null,
    profiel: 'nvt',     // 'nvt' | 'wachtend' | 'geladen' | 'timeout' | 'fout'
    profielMs: null,
    profielFout: null,
    online: navigator.onLine,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      const ms = Date.now() - laadT0.current;
      authVuurdeRef.current = true;
      setFirebaseUser(user);
      setLaadFase(f => ({ ...f, auth: user ? 'ingelogd' : 'uitgelogd', authMs: ms, online: navigator.onLine }));
      if (!user) {
        setProfiel(null);
        setProfielLoaded(true);
      }
    });
    return unsub;
  }, []);

  // Veiligheidsnet: als onAuthStateChanged na 4s niet vuurde (bv. Firebase SDK
  // intern geblokkeerd door App Check / reCAPTCHA), forceer dan de uitgelogde
  // staat zodat de app niet voor altijd in laadtoestand blijft hangen.
  useEffect(() => {
    const t = setTimeout(() => {
      if (authVuurdeRef.current) return;
      console.error('[AuthContext] onAuthStateChanged niet gevuurd na 4s — forceer uitgelogd');
      setFirebaseUser(null);
      setLaadFase(f => ({ ...f, auth: 'timeout', authMs: 12_000, online: navigator.onLine }));
    }, 12_000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;

    const ref = doc(db, 'users', firebaseUser.uid);
    let snapOntvangenOf = false;

    setLaadFase(f => ({ ...f, profiel: 'wachtend' }));

    // Veiligheidsnets: als Firestore na 5s nog niet heeft gereageerd (bv. door trage
    // netwerk of IndexedDB-initialisatie op iOS PWA), gaan we verder met een minimaal
    // profiel zodat de app niet in laadtoestand blijft hangen.
    const fallbackTimer = setTimeout(() => {
      if (snapOntvangenOf) return;
      snapOntvangenOf = true;
      const ms = Date.now() - laadT0.current;
      console.warn('[AuthContext] Firestore profiel niet geladen binnen 5s — fallback profiel gebruikt');
      setLaadFase(f => ({ ...f, profiel: 'timeout', profielMs: ms, online: navigator.onLine }));
      setProfiel({ uid: firebaseUser.uid, email: firebaseUser.email, naam: '', rol: 'lid', groepen: [] });
      setProfielLoaded(true);
    }, 5000);

    const unsub = onSnapshot(ref, (snap) => {
      snapOntvangenOf = true;
      clearTimeout(fallbackTimer);
      const ms = Date.now() - laadT0.current;
      const userData = snap.exists()
        ? { uid: firebaseUser.uid, email: firebaseUser.email, ...snap.data() }
        : { uid: firebaseUser.uid, email: firebaseUser.email, naam: '', rol: 'lid', groepen: [] };

      setLaadFase(f => ({ ...f, profiel: 'geladen', profielMs: ms, online: navigator.onLine }));
      setProfiel(userData);
      setProfielLoaded(true);

      // Fire-and-forget: initialise notification preferences in the background.
      initialiseerNotificatiesIndienNodig(
        firebaseUser.uid,
        firebaseUser.email,
        snap.exists() ? snap.data() : null
      ).catch(() => {});
    }, (err) => {
      snapOntvangenOf = true;
      clearTimeout(fallbackTimer);
      const ms = Date.now() - laadT0.current;
      console.error('[AuthContext] profiel laden mislukt:', err.code, err.message);
      setLaadFase(f => ({ ...f, profiel: 'fout', profielMs: ms, profielFout: err.code || err.message, online: navigator.onLine }));
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
    // onAuthStateChanged handelt setFirebaseUser(null), setProfiel(null) en
    // setProfielLoaded(true) af — geen handmatige state-reset nodig.
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
      laadFase,
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
