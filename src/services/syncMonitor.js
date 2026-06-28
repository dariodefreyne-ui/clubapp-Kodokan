// src/services/syncMonitor.js
// ─── SyncMonitor ─────────────────────────────────────────────────────────────
// De bestaande ConnectionDot gebruikte enkel `waitForPendingWrites()` — dat
// bevestigt alleen dat lokale schrijfbewerkingen de server bereikt hebben, niet
// dat de app nog binnenkomende updates (onSnapshot-listeners) ontvangt. Op iOS
// in "Toegevoegd aan beginscherm"-modus (standalone) is er een gekend WebKit-
// probleem waarbij IndexedDB-transacties na lang draaien/achtergrond-cycli
// vast kunnen lopen — Firestore's persistente cache hangt dan stil zonder
// foutmelding, terwijl waitForPendingWrites() gewoon meteen resolvet (er staat
// niets in de wachtrij). Vandaar deze monitor: ze bewaakt de écht relevante
// signalen (onSnapshotsInSync, IndexedDB-latentie, online/offline, zichtbaar-
// heid, service worker) en houdt een logboek bij dat de gebruiker zelf kan
// bekijken/kopiëren — geen Firebase-kennis nodig om te zien "wat er fout loopt".
import { onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../firebase';

const LOG_KEY = 'kodokan_sync_log_v1';
const MAX_LOG = 200;
const STUCK_DREMPEL_MS = 3 * 60 * 1000; // 3 min zonder sync-update terwijl online+zichtbaar = verdacht

let log = [];
let listeners = new Set();
let started = false;

const state = {
  startedAt: Date.now(),
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  standalone: detecteerStandalone(),
  visibility: typeof document !== 'undefined' ? document.visibilityState : 'visible',
  lastSyncAt: null,
  lastIdbCheckAt: null,
  lastIdbLatencyMs: null,
  idbStuck: false,
  swState: 'onbekend',
  stuck: false,
};

function detecteerStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true;
}

function persist() {
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_LOG))); } catch {}
}

function notify() {
  for (const fn of listeners) fn({ ...state }, log);
}

function voegToe(type, bericht, extra) {
  log.push({ ts: Date.now(), type, bericht, ...(extra ? { extra } : {}) });
  if (log.length > MAX_LOG) log = log.slice(-MAX_LOG);
  persist();
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  fn({ ...state }, log);
  return () => listeners.delete(fn);
}

export function getSnapshot() {
  return { state: { ...state }, log };
}

export function clearLog() {
  log = [];
  persist();
  notify();
}

// Eénmalige IndexedDB-rondetest met timeout — exact het scenario dat op iOS
// standalone vastloopt: een transactie die nooit zijn complete/error-event vuurt.
function testIndexedDb(timeoutMs = 5000) {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') { resolve({ ok: false, latencyMs: null, reden: 'geen IndexedDB' }); return; }
    const start = performance.now();
    let klaar = false;
    const timer = setTimeout(() => {
      if (klaar) return;
      klaar = true;
      resolve({ ok: false, latencyMs: null, reden: `timeout >${timeoutMs}ms` });
    }, timeoutMs);

    try {
      const req = indexedDB.open('kodokan_idb_healthcheck', 1);
      req.onupgradeneeded = () => { req.result.createObjectStore?.('probe'); };
      req.onsuccess = () => {
        if (klaar) { req.result.close(); return; }
        klaar = true;
        clearTimeout(timer);
        req.result.close();
        resolve({ ok: true, latencyMs: Math.round(performance.now() - start) });
      };
      req.onerror = () => {
        if (klaar) return;
        klaar = true;
        clearTimeout(timer);
        resolve({ ok: false, latencyMs: null, reden: req.error?.message || 'onbekende fout' });
      };
    } catch (e) {
      if (klaar) return;
      klaar = true;
      clearTimeout(timer);
      resolve({ ok: false, latencyMs: null, reden: e.message });
    }
  });
}

async function draaiIdbCheck(handmatig = false) {
  const resultaat = await testIndexedDb();
  state.lastIdbCheckAt = Date.now();
  state.lastIdbLatencyMs = resultaat.latencyMs;
  const wasStuck = state.idbStuck;
  state.idbStuck = !resultaat.ok;
  if (!resultaat.ok) {
    voegToe('error', `IndexedDB-test mislukt (${resultaat.reden}) — gekend WebKit-probleem bij lang draaiende "Toegevoegd aan beginscherm"-app`, resultaat);
  } else if (wasStuck) {
    voegToe('sync', `IndexedDB werkt weer (${resultaat.latencyMs}ms)`, resultaat);
  } else if (handmatig) {
    voegToe('info', `IndexedDB-test ok (${resultaat.latencyMs}ms)`, resultaat);
  } else if (resultaat.latencyMs > 800) {
    voegToe('warn', `IndexedDB traag (${resultaat.latencyMs}ms)`, resultaat);
  }
  notify();
  return resultaat;
}

export async function runManualCheck() {
  voegToe('info', 'Handmatige sync-test gestart…');
  await draaiIdbCheck(true);
  const gapMs = state.lastSyncAt ? Date.now() - state.lastSyncAt : null;
  voegToe('info', state.online
    ? `Online · laatste Firestore-sync ${gapMs == null ? 'nooit' : `${Math.round(gapMs/1000)}s geleden`}`
    : 'Offline volgens de browser');
  return getSnapshot();
}

export function initSyncMonitor() {
  if (started) return;
  started = true;

  try {
    const opgeslagen = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    if (Array.isArray(opgeslagen)) log = opgeslagen.slice(-MAX_LOG);
  } catch {}

  voegToe('info', `App gestart (standalone: ${state.standalone ? 'ja' : 'nee'}, online: ${state.online ? 'ja' : 'nee'})`);

  // onSnapshotsInSync vuurt elke keer Firestore's lokale cache in sync is met
  // de server — dit is hét echte signaal dat luisteraars nog data ontvangen,
  // in tegenstelling tot waitForPendingWrites (enkel uitgaande schrijfwachtrij).
  onSnapshotsInSync(db, () => {
    const vorige = state.lastSyncAt;
    state.lastSyncAt = Date.now();
    if (state.stuck) {
      state.stuck = false;
      voegToe('sync', `Firestore-sync herneemt (was ${Math.round((Date.now()-vorige)/1000)}s stil)`);
    } else {
      notify();
    }
  });

  window.addEventListener('online', () => { state.online = true; voegToe('info', 'Browser meldt: online'); });
  window.addEventListener('offline', () => { state.online = false; voegToe('warn', 'Browser meldt: offline'); });
  document.addEventListener('visibilitychange', () => {
    state.visibility = document.visibilityState;
    voegToe('info', `Zichtbaarheid: ${state.visibility}`);
    if (state.visibility === 'visible') draaiIdbCheck();
  });
  window.addEventListener('pageshow', e => {
    if (e.persisted) voegToe('info', 'Pagina herstart vanuit back-forward cache (bfcache)');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (!reg) { state.swState = 'niet geregistreerd'; notify(); return; }
      state.swState = reg.active ? 'actief' : (reg.installing ? 'installeren' : 'onbekend');
      notify();
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      voegToe('info', 'Service worker controller gewisseld (nieuwe versie actief)');
    });
  }

  draaiIdbCheck();

  // Periodieke waakhond — enkel relevant terwijl het scherm zichtbaar is:
  // een stille app op de achtergrond hoort geen sync-updates te krijgen.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    draaiIdbCheck();
    if (!state.online) return;
    const gap = state.lastSyncAt ? Date.now() - state.lastSyncAt : Date.now() - state.startedAt;
    if (gap > STUCK_DREMPEL_MS && !state.stuck) {
      state.stuck = true;
      voegToe('error', `Geen Firestore-sync ontvangen in ${Math.round(gap/1000)}s terwijl online en actief — mogelijk vastgelopen verbinding`);
    }
  }, 30000);

  notify();
}
