// src/hooks/useLedenStore.js
// Gedeelde ledenlijst-store voor Ledenbeheer:
//  - useLedenFilters: filterstatus in sessionStorage (blijft behouden bij terugkeer uit LidDetail)
//  - useLedenStore:   module-brede cache (TTL) zodat terugkeren/filteren 0 reads kost.
//                     Alle filtering (groep, categorie, zoeken) gebeurt client-side.
//
// Schaalbaarheid: bevat een actief-/inactief-/alle-selectie meer dan MAX_LEDEN leden,
// dan valt de store terug op laden per groep (en server-zoeken via zoekPrefixes).
import { useCallback, useEffect, useState } from 'react';
import {
  collection, doc, getDoc, getDocFromServer, getDocs, getDocsFromServer, limit, query, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { vergelijkLeden } from '../utils/ledenKoppeling';

export const MAX_LEDEN = 500;
const TTL_MS = 3 * 60 * 1000;

const FILTER_KEY = 'ledenFilters';
const LAATST_GEOPEND_KEY = 'ledenLaatstGeopend';
const VEROUDERD_KEY = 'ledenVerouderd';

// ── Module-brede state ──────────────────────────────────────────────────────
const cache = new Map();        // sleutel `${actief}|${groep}` → { actief, groep, leden, tijd, afgekapt }
const inflight = new Map();     // sleutel → Promise (dedupe gelijktijdige loads)
const teGroot = new Set();      // actief-modi waarvoor de volledige lijst > MAX_LEDEN is
let cacheUid;                   // uid waarvoor de cache geldt

const maakSleutel = (actief, groep) => `${actief}|${groep || ''}`;
const isVers = (entry) => !!entry && Date.now() - entry.tijd < TTL_MS;

function sessieGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function sessieSet(key, waarde) {
  try { sessionStorage.setItem(key, waarde); } catch { /* sessionStorage niet beschikbaar */ }
}
function sessieDel(key) {
  try { sessionStorage.removeItem(key); } catch { /* idem */ }
}

function wisCache() {
  cache.clear();
  inflight.clear();
  teGroot.clear();
}

// Bij een andere ingelogde gebruiker mag er geen ledendata of filter blijven hangen.
function synchroniseerGebruiker(uid) {
  if (cacheUid !== undefined && cacheUid !== uid) {
    wisCache();
    sessieDel(FILTER_KEY);
    sessieDel(LAATST_GEOPEND_KEY);
    sessieDel(VEROUDERD_KEY);
  }
  cacheUid = uid;
}

// ── Publieke helpers (voor Ledenbeheer) ─────────────────────────────────────
/** Onthoud welk lid geopend wordt: bij terugkeer wordt enkel dat document herlezen (1 read). */
export function onthoudLaatstGeopend(id) {
  if (id) sessieSet(LAATST_GEOPEND_KEY, String(id));
}

/** Markeer de cache als verouderd (bv. na "+ Nieuw lid"): volgende mount laadt vers. */
export function markeerLedenVerouderd() {
  sessieSet(VEROUDERD_KEY, '1');
}

function neemSleutel(key) {
  const w = sessieGet(key);
  if (w !== null) sessieDel(key);
  return w;
}

// ── Firestore ───────────────────────────────────────────────────────────────
function bouwQuery(actief, groep) {
  const c = [];
  if (actief === 'inactief') c.push(where('actief', '==', false));
  else if (actief !== 'alle') c.push(where('actief', '!=', false));
  if (groep) c.push(where('groepen', 'array-contains', groep));
  c.push(limit(MAX_LEDEN + 1)); // +1 om overschrijding te kunnen detecteren
  return query(collection(db, 'members'), ...c);
}

// Forceer een server-fetch: op iOS/iPadOS kan onbetrouwbare netwerkdetectie anders
// stilletjes verouderde cache tonen. Offline val je terug op de lokale cache.
async function leesDocs(q) {
  try {
    return await getDocsFromServer(q);
  } catch {
    return await getDocs(q);
  }
}

function haalLeden(actief, groep) {
  const sleutel = maakSleutel(actief, groep);
  if (inflight.has(sleutel)) return inflight.get(sleutel);
  const p = (async () => {
    const snap = await leesDocs(bouwQuery(actief, groep));
    const lijst = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    lijst.sort(vergelijkLeden);
    return lijst;
  })().finally(() => { inflight.delete(sleutel); });
  inflight.set(sleutel, p);
  return p;
}

function bewaar(actief, groep, lijst) {
  cache.set(maakSleutel(actief, groep), {
    actief,
    groep: groep || '',
    leden: lijst.slice(0, MAX_LEDEN),
    tijd: Date.now(),
    afgekapt: lijst.length > MAX_LEDEN,
  });
}

async function zorgVoorLading(actief, groep, geforceerd) {
  if (teGroot.has(actief) && !groep) return;
  let eff = teGroot.has(actief) ? groep : '';
  if (!geforceerd && isVers(cache.get(maakSleutel(actief, eff)))) return;

  const lijst = await haalLeden(actief, eff);
  if (!eff && lijst.length > MAX_LEDEN) {
    // Te veel leden voor één lading: voortaan enkel per groep laden.
    teGroot.add(actief);
    if (!groep) return;
    eff = groep;
    if (!geforceerd && isVers(cache.get(maakSleutel(actief, eff)))) return;
    bewaar(actief, eff, await haalLeden(actief, eff));
    return;
  }
  bewaar(actief, eff, lijst);
}

function pastBij(lid, actief, groep) {
  const actiefOk = actief === 'alle' ? true : actief === 'inactief' ? lid.actief === false : lid.actief !== false;
  const groepOk = !groep || (Array.isArray(lid.groepen) && lid.groepen.includes(groep));
  return actiefOk && groepOk;
}

// Herlees één lid en pas alle gecachte lijsten aan (toevoegen / vervangen / verwijderen).
async function ververLidInCache(id) {
  const ref = doc(db, 'members', id);
  let snap;
  try {
    snap = await getDocFromServer(ref);
  } catch {
    snap = await getDoc(ref);
  }
  const lid = snap.exists() ? { id, ...snap.data() } : null;
  for (const [sleutel, entry] of cache.entries()) {
    const rest = entry.leden.filter(m => m.id !== id);
    if (lid && pastBij(lid, entry.actief, entry.groep)) rest.push(lid);
    rest.sort(vergelijkLeden);
    cache.set(sleutel, { ...entry, leden: rest });
  }
}

// Server-side prefix-zoeken (enkel gebruikt als er > MAX_LEDEN leden zijn en geen groep gekozen is).
// Aangevuld met een exacte vergunningsnummer-match.
async function zoekServer(actief, term) {
  const naamFilters = [where('zoekPrefixes', 'array-contains', term)];
  const nummerFilters = [where('vergunningsnummer', '==', term.trim())];
  if (actief === 'inactief') {
    naamFilters.push(where('actief', '==', false));
    nummerFilters.push(where('actief', '==', false));
  } else if (actief !== 'alle') {
    naamFilters.push(where('actief', '!=', false));
    nummerFilters.push(where('actief', '!=', false));
  }
  const [naamSnap, nummerSnap] = await Promise.all([
    leesDocs(query(collection(db, 'members'), ...naamFilters)),
    leesDocs(query(collection(db, 'members'), ...nummerFilters)),
  ]);
  const gezien = new Map();
  [...naamSnap.docs, ...nummerSnap.docs].forEach(d => gezien.set(d.id, { id: d.id, ...d.data() }));
  const lijst = [...gezien.values()];
  lijst.sort(vergelijkLeden);
  return lijst;
}

// ── Filters (sessionStorage) ────────────────────────────────────────────────
const ACTIEF_WAARDEN = ['actief', 'inactief', 'alle'];

function leesFilters() {
  const standaard = { zoek: '', groep: '', actief: 'actief', cats: [] };
  try {
    const raw = sessieGet(FILTER_KEY);
    if (!raw) return standaard;
    const p = JSON.parse(raw);
    return {
      zoek: typeof p.zoek === 'string' ? p.zoek : '',
      groep: typeof p.groep === 'string' ? p.groep : '',
      actief: ACTIEF_WAARDEN.includes(p.actief) ? p.actief : 'actief',
      cats: Array.isArray(p.cats) ? p.cats.filter(c => typeof c === 'string') : [],
    };
  } catch {
    return standaard;
  }
}

/** Filterstatus die een navigatie naar LidDetail en terug overleeft. */
export function useLedenFilters() {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const [filters, setFilters] = useState(() => {
    synchroniseerGebruiker(uid);
    return leesFilters();
  });

  useEffect(() => {
    sessieSet(FILTER_KEY, JSON.stringify(filters));
  }, [filters]);

  // patch: object of functie (vorigeFilters) => object
  const zet = useCallback((patch) => {
    setFilters(f => ({ ...f, ...(typeof patch === 'function' ? patch(f) : patch) }));
  }, []);

  return [filters, zet];
}

// ── Ledenstore ──────────────────────────────────────────────────────────────
/**
 * @param {'actief'|'inactief'|'alle'} actief
 * @param {string} groep   gekozen groep ('' = geen) — filtering gebeurt client-side;
 *                         enkel bij > MAX_LEDEN leden bepaalt de groep ook de Firestore-query
 * @param {string} zoek    zoekterm (enkel relevant voor de server-zoekfallback)
 */
export function useLedenStore(actief, groep, zoek) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  const [, setVersie] = useState(0);
  const bump = useCallback(() => setVersie(v => v + 1), []);
  const [foutSleutel, setFoutSleutel] = useState(null);
  const [verversen, setVerversen] = useState(false);
  const [zoekRes, setZoekRes] = useState(null);

  // Synchroon bij eerste render (idempotent, dus veilig onder StrictMode):
  // andere gebruiker → cache wissen; "Nieuw lid" gestart → cache verouderd.
  useState(() => {
    synchroniseerGebruiker(uid);
    if (neemSleutel(VEROUDERD_KEY) !== null) wisCache();
    return 0;
  });

  const vereistGroep = teGroot.has(actief);
  const wachtOpGroep = vereistGroep && !groep;
  const effGroep = vereistGroep ? groep : '';
  const sleutel = maakSleutel(actief, effGroep);
  const entry = wachtOpGroep ? null : cache.get(sleutel);

  // Laden (of uit cache serveren)
  useEffect(() => {
    let levend = true;
    (async () => {
      try {
        await zorgVoorLading(actief, groep, false);
        if (levend) setFoutSleutel(null);
      } catch (err) {
        console.error('Error fetching members:', err);
        if (levend) setFoutSleutel(maakSleutel(actief, teGroot.has(actief) ? groep : ''));
      } finally {
        if (levend) bump();
      }
    })();
    return () => { levend = false; };
  }, [actief, groep, bump]);

  // Bij terugkeer uit LidDetail: enkel dat ene lid herlezen (1 read).
  useEffect(() => {
    const id = neemSleutel(LAATST_GEOPEND_KEY);
    if (!id) return;
    ververLidInCache(id).then(bump).catch(() => { /* TTL vangt dit op */ });
  }, [bump]);

  // Server-zoeken (enkel bij > MAX_LEDEN leden zonder groep)
  const zoekTerm = wachtOpGroep && zoek && zoek.trim().length >= 3 ? zoek.trim().toLowerCase() : '';
  const zoekSleutel = zoekTerm ? `${actief}|${zoekTerm}` : '';
  useEffect(() => {
    if (!zoekTerm) return undefined;
    let levend = true;
    const t = setTimeout(async () => {
      const s = `${actief}|${zoekTerm}`;
      try {
        const leden = await zoekServer(actief, zoekTerm);
        if (levend) setZoekRes({ sleutel: s, leden, fout: false });
      } catch (err) {
        console.error('Error searching members:', err);
        if (levend) setZoekRes({ sleutel: s, leden: [], fout: true });
      }
    }, 450);
    return () => { levend = false; clearTimeout(t); };
  }, [actief, zoekTerm]);

  const vernieuw = useCallback(async () => {
    setVerversen(true);
    try {
      wisCache();
      await zorgVoorLading(actief, groep, true);
      setFoutSleutel(null);
    } catch (err) {
      console.error('Error refreshing members:', err);
      setFoutSleutel(maakSleutel(actief, teGroot.has(actief) ? groep : ''));
    } finally {
      setVerversen(false);
      bump();
    }
  }, [actief, groep, bump]);

  // Resultaat samenstellen
  if (zoekSleutel) {
    const klaar = zoekRes && zoekRes.sleutel === zoekSleutel;
    return {
      leden: klaar ? zoekRes.leden : [],
      loading: !klaar,
      verversen,
      fout: !!(klaar && zoekRes.fout),
      vereistGroep,
      serverZoek: true,
      afgekapt: false,
      laadtijd: null,
      vernieuw,
    };
  }

  return {
    leden: entry ? entry.leden : [],
    loading: !wachtOpGroep && !entry && foutSleutel !== sleutel,
    verversen,
    fout: !entry && !wachtOpGroep && foutSleutel === sleutel,
    vereistGroep,
    serverZoek: false,
    afgekapt: !!entry?.afgekapt,
    laadtijd: entry ? entry.tijd : null,
    vernieuw,
  };
}
