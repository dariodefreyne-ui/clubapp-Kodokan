// src/hooks/agendaStore.js
// Gedeelde, tijdelijke cache voor de dashboard-agenda.
//
// DOEL: alle dashboardwidgets delen ÉÉN fetch per dashboardbezoek, i.p.v. elk
// hun eigen reads van trainingen/events/evenementen.
//
// WERKING
//  • De store bewaart enkel RUWE Firestore-data (geen profiel- of config-afhankelijke
//    items). Elke widget filtert/bouwt client-side (zie useAgendaItems.maakItems).
//  • Per bron (trainingen, events, evenementen) wordt een aaneengesloten datumvenster
//    ("gedekt") bijgehouden. Een basisvenster wordt altijd opgehaald; navigatie buiten
//    het venster (andere week/maand) haalt enkel de ontbrekende stukken op.
//  • Gelijktijdige aanvragen worden per bron achter elkaar gezet (keten), zodat 4 widgets
//    die tegelijk mounten samen maar 1× lezen.
//
// INVALIDATIE (zodat bewerkingen niet te lang verouderd blijven)
//  1. De cache leeft enkel zolang er widgets gemount zijn (+3s respijt voor remounts/layoutwissel).
//     Dashboard verlaten = cache weg → volgend bezoek leest vers.
//  2. Max. leeftijd 5 min: bij terugkeer naar de tab (visibilitychange) of bij een
//     nieuwe widget-mount wordt een verlopen cache weggegooid en herladen.
//  3. Bewerken van trainingen/events/evenementen gebeurt op andere pagina's (de detailpanelen
//     zijn read-only voor die documenten) → dashboard/agenda unmount → cache weg na 3s.
//     invalideerAgendaStore() wist alles voor flows die het scherm wél open laten.
//  4. Reset bij andere gebruiker (uid) of nieuw seizoen.
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { huidigSeizoen, vandaagISO } from '../components/trainingen/seizoenHelpers';

const TRAINING_HORIZON_DAGEN = 42;   // trainingen zijn dicht gezaaid → korte horizon
const EVENT_HORIZON_DAGEN = 365;     // events/evenementen zijn schaars → lange horizon
const MAX_LEEFTIJD_MS = 5 * 60 * 1000;
const RESPIJT_MS = 3 * 1000;

const LEGE_LIJSTEN = { trainingen: [], events: [], evenementen: [] };

// ── Datumhulp (lokale tijd, geen toISOString → geen UTC-verschuiving) ─────────
function naarISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoPlusDagen(isoDatum, n) {
  const [j, m, d] = isoDatum.split('-').map(Number);
  return naarISO(new Date(j, m - 1, d + n));
}

// Basisvenster: vanaf begin van de huidige maand of maandag van deze week (de vroegste
// van de twee), tot vandaag + horizon. Dekt week-strip, maandkalender en 'komende' lijsten.
function basisBereik(bron) {
  const vandaag = vandaagISO();
  const maandStart = `${vandaag.slice(0, 8)}01`;
  const [j, m, d] = vandaag.split('-').map(Number);
  const dagIndex = (new Date(j, m - 1, d).getDay() + 6) % 7;
  const maandag = isoPlusDagen(vandaag, -dagIndex);
  return {
    vanaf: maandStart < maandag ? maandStart : maandag,
    tot: isoPlusDagen(vandaag, bron === 'trainingen' ? TRAINING_HORIZON_DAGEN : EVENT_HORIZON_DAGEN),
  };
}

// ── Queries (ook gebruikt door laadAgendaItems in useAgendaItems) ─────────────
// trainingen: bestaande composite index (seizoen, datum).
export function trainingenQuery(seizoen, vanaf, tot) {
  const c = [where('seizoen', '==', seizoen)];
  if (vanaf) c.push(where('datum', '>=', vanaf));
  if (tot)   c.push(where('datum', '<=', tot));
  return query(collection(db, 'trainingen'), ...c, orderBy('datum', 'asc'));
}

// events / evenementen: single-field index op datum (automatisch).
export function eventsQuery(vanaf, tot) {
  const c = [];
  if (vanaf) c.push(where('datum', '>=', vanaf));
  if (tot)   c.push(where('datum', '<=', tot));
  return c.length ? query(collection(db, 'events'), ...c) : collection(db, 'events');
}

export function evenementenQuery(vanaf, tot) {
  const c = [];
  if (vanaf) c.push(where('datum', '>=', vanaf));
  if (tot)   c.push(where('datum', '<=', tot));
  return query(collection(db, 'evenementen'), ...c, orderBy('datum', 'asc'));
}

function bouwQuery(bron, seizoen, vanaf, tot) {
  if (bron === 'trainingen') return trainingenQuery(seizoen, vanaf, tot);
  if (bron === 'events') return eventsQuery(vanaf, tot);
  return evenementenQuery(vanaf, tot);
}

// ── Store-state ───────────────────────────────────────────────────────────────
let entry = null;
let versie = 0;
let respijtTimer = null;
const luisteraars = new Set();

function maakBron() {
  return { docs: new Map(), gedekt: null, keten: Promise.resolve(), lijst: null, fout: false };
}

function nieuweEntry(uid, seizoen) {
  return {
    uid,
    seizoen,
    gemaakt: Date.now(),
    bronnen: { trainingen: maakBron(), events: maakBron(), evenementen: maakBron() },
  };
}

function isVerlopen(e) {
  return Date.now() - e.gemaakt > MAX_LEEFTIJD_MS;
}

function geefEntry(uid) {
  const seizoen = huidigSeizoen();
  if (!entry || entry.uid !== uid || entry.seizoen !== seizoen || isVerlopen(entry)) {
    entry = nieuweEntry(uid, seizoen);
  }
  return entry;
}

function notify() {
  versie += 1;
  luisteraars.forEach((cb) => cb());
}

export function versieAgendaStore() {
  return versie;
}

// Gooit alle gecachete agenda-data weg; mounted widgets laden automatisch opnieuw.
export function invalideerAgendaStore() {
  entry = null;
  notify();
}

function bijZichtbaar() {
  if (document.visibilityState === 'visible' && entry && isVerlopen(entry)) {
    invalideerAgendaStore();
  }
}

// Registreert een widget. Geeft een afmeld-functie terug.
export function abonneer(uid, cb) {
  if (respijtTimer) { clearTimeout(respijtTimer); respijtTimer = null; }
  if (entry && (entry.uid !== uid || isVerlopen(entry))) {
    entry = null;
    if (luisteraars.size > 0) notify();
  }
  luisteraars.add(cb);
  if (luisteraars.size === 1 && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', bijZichtbaar);
  }
  return () => {
    luisteraars.delete(cb);
    if (luisteraars.size === 0) {
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', bijZichtbaar);
      respijtTimer = setTimeout(() => {
        respijtTimer = null;
        if (luisteraars.size === 0) entry = null;
      }, RESPIJT_MS);
    }
  };
}

function lijstVan(s) {
  if (!s.lijst) {
    s.lijst = [...s.docs.entries()]
      .map(([id, data]) => ({ id, data }))
      .sort((a, b) => {
        if (a.data.datum !== b.data.datum) return a.data.datum < b.data.datum ? -1 : 1;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
  }
  return s.lijst;
}

// Ruwe data voor deze gebruiker: { trainingen, events, evenementen } van { id, data }.
export function leesAgendaStore(uid) {
  if (!entry || entry.uid !== uid) return LEGE_LIJSTEN;
  return {
    trainingen: lijstVan(entry.bronnen.trainingen),
    events: lijstVan(entry.bronnen.events),
    evenementen: lijstVan(entry.bronnen.evenementen),
  };
}

// Is het gevraagde bereik voor alle gevraagde bronnen al opgehaald?
export function isGedekt(uid, { vanaf, tot, bronnen }) {
  if (!entry || entry.uid !== uid) return false;
  return bronnen.every((b) => {
    const g = entry.bronnen[b].gedekt;
    if (!g) return false;
    const basis = basisBereik(b);
    return (vanaf || basis.vanaf) >= g.vanaf && (tot || basis.tot) <= g.tot;
  });
}

function vulBron(e, bron, vanaf, tot) {
  const s = e.bronnen[bron];
  s.keten = s.keten.then(async () => {
    if (entry !== e) return; // vervangen of ongeldig gemaakt
    const basis = basisBereik(bron);
    const v = vanaf && vanaf < basis.vanaf ? vanaf : basis.vanaf;
    const t = tot && tot > basis.tot ? tot : basis.tot;

    const stukken = [];
    if (!s.gedekt) {
      stukken.push([v, t]);
    } else {
      if (v < s.gedekt.vanaf) stukken.push([v, isoPlusDagen(s.gedekt.vanaf, -1)]);
      if (t > s.gedekt.tot)   stukken.push([isoPlusDagen(s.gedekt.tot, 1), t]);
    }
    if (stukken.length === 0) return; // reeds gedekt → 0 reads

    try {
      const snaps = await Promise.all(stukken.map(([a, b]) => getDocs(bouwQuery(bron, e.seizoen, a, b))));
      if (entry !== e) return;
      snaps.forEach((snap) => snap.docs.forEach((d) => s.docs.set(d.id, d.data())));
      s.lijst = null;
    } catch (err) {
      // Zelfde gedrag als voorheen: bron valt weg (lege lijst) i.p.v. de widget te breken.
      // Het venster wordt toch als gedekt gemarkeerd (geen retry-lus); herstel via TTL/invalidatie.
      console.error(`agendaStore ${bron}:`, err);
      s.fout = true;
    }
    if (entry !== e) return;
    s.gedekt = s.gedekt
      ? { vanaf: v < s.gedekt.vanaf ? v : s.gedekt.vanaf, tot: t > s.gedekt.tot ? t : s.gedekt.tot }
      : { vanaf: v, tot: t };
    notify();
  });
  return s.keten;
}

// Zorgt dat het gevraagde bereik (altijd ∪ basisvenster) in de store zit.
export function zorgVoor(uid, { vanaf, tot, bronnen }) {
  const e = geefEntry(uid);
  return Promise.all(bronnen.map((b) => vulBron(e, b, vanaf, tot)));
}
