// src/services/syncMonitor.js
// ─── SyncMonitor ─────────────────────────────────────────────────────────────
// Diagnostische monitor voor browser-/Firestore-connectiviteit.
//
// BELANGRIJK:
// onSnapshotsInSync() is GEEN heartbeat. Het vuurt niet periodiek wanneer er
// niets verandert. Daarom gebruiken we het alleen als informatief signaal en
// NIET meer als watchdog die na 3 minuten een Firestore-storing meldt.
//
// De IndexedDB-test controleert alleen of IndexedDB in de browser werkt; hij
// zegt niets over de bereikbaarheid van Firestore.
//
// Een echte Firestore-servercheck gebeurt alleen bij een HANDMATIGE check.
// Zo vermijden we onnodige Firestore-reads en dus onnodige kosten.
//
// Online/Firestore-onderscheid (zie berekenVerbindingsStatus hieronder):
// navigator.onLine zegt alleen dat de browser een netwerk ziet, niet dat
// Firestore bereikbaar is. We leiden een 3-staten status af ZONDER extra
// reads: we hergebruiken het gratis onSnapshotsInSync-signaal (lastSyncAt,
// vuurt toch al mee met bestaande actieve listeners) en, indien recenter,
// het resultaat van een eventuele handmatige check.
//   🟢 'bevestigd'   — online + Firestore recent bevestigd (sync of check)
//   🟠 'onbevestigd' — online, maar geen recente Firestore-bevestiging
//   🔴 'offline'     — browser meldt geen netwerk
import { doc, getDocFromServer, onSnapshotsInSync } from 'firebase/firestore';
import { db } from '../firebase';

const LOG_KEY = 'kodokan_sync_log_v1';
const MAX_LOG = 200;
const FIRESTORE_CONFIRM_MS = 3 * 60 * 1000; // 3 min — hoelang een sync-bevestiging als "vers" telt

let log = [];
let listeners = new Set();
let started = false;

const state = {
  startedAt: Date.now(),
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  standalone: detecteerStandalone(),
  visibility: typeof document !== 'undefined' ? document.visibilityState : 'visible',
  lastSyncAt: null,
  lastServerCheckAt: null,
  lastServerCheckLatencyMs: null,
  serverReachable: null,
  lastIdbCheckAt: null,
  lastIdbLatencyMs: null,
  idbStuck: false,
  swState: 'onbekend',
};

// Puur/afgeleid — geen eigen state, geen Firestore-calls. now is injecteerbaar
// zodat UI-componenten hem kunnen hertekenen op hun eigen 1s-ticker zonder dat
// syncMonitor zelf een timer nodig heeft.
export function berekenVerbindingsStatus(s, now = Date.now()) {
  if (!s.online) return 'offline';
  const kandidaten = [];
  if (s.lastSyncAt) kandidaten.push(s.lastSyncAt);
  if (s.serverReachable && s.lastServerCheckAt) kandidaten.push(s.lastServerCheckAt);
  if (kandidaten.length === 0) return 'onbevestigd';
  const laatsteBevestiging = Math.max(...kandidaten);
  return (now - laatsteBevestiging) < FIRESTORE_CONFIRM_MS ? 'bevestigd' : 'onbevestigd';
}

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

// Eénmalige IndexedDB-rondetest met timeout.
// Dit controleert alleen de browser-IndexedDB-laag, niet Firestore zelf.
function testIndexedDb(timeoutMs = 5000) {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve({ ok: false, latencyMs: null, reden: 'geen IndexedDB' });
      return;
    }

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
    voegToe('error', `IndexedDB-test mislukt (${resultaat.reden})`, resultaat);
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

// Echte Firestore-servercheck. We lezen bewust een publiek leesbare settings-doc.
// Dit is uitsluitend voor diagnostiek en wordt NIET periodiek uitgevoerd.
async function testFirestoreServer(timeoutMs = 10000) {
  const start = performance.now();
  let timer;

  try {
    const request = getDocFromServer(doc(db, 'settings', 'club'));
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout >${timeoutMs}ms`)), timeoutMs);
    });

    await Promise.race([request, timeout]);
    clearTimeout(timer);

    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false,
      latencyMs: null,
      reden: e?.message || 'onbekende Firestore-fout',
      code: e?.code || null,
    };
  }
}

export async function runManualCheck() {
  voegToe('info', 'Handmatige sync-test gestart…');

  const [idb, firestore] = await Promise.all([
    draaiIdbCheck(true),
    state.online ? testFirestoreServer() : Promise.resolve({ ok: false, latencyMs: null, reden: 'browser meldt offline' }),
  ]);

  state.lastServerCheckAt = Date.now();
  state.lastServerCheckLatencyMs = firestore.latencyMs;
  state.serverReachable = firestore.ok;

  if (firestore.ok) {
    voegToe('sync', `Firestore-server bereikbaar (${firestore.latencyMs}ms)`, firestore);
  } else {
    voegToe('error', `Firestore-servercheck mislukt (${firestore.reden})${firestore.code ? ` [${firestore.code}]` : ''}`, firestore);
  }

  voegToe('info', state.online
    ? 'Online volgens de browser'
    : 'Offline volgens de browser');

  notify();
  return { ...getSnapshot(), checks: { idb, firestore } };
}

export function initSyncMonitor() {
  if (started) return;
  started = true;

  try {
    const opgeslagen = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    if (Array.isArray(opgeslagen)) log = opgeslagen.slice(-MAX_LOG);
  } catch {}

  voegToe('info', `App gestart (standalone: ${state.standalone ? 'ja' : 'nee'}, online: ${state.online ? 'ja' : 'nee'})`);

  // Dit is informatief: onSnapshotsInSync is GEEN periodieke heartbeat.
  onSnapshotsInSync(db, () => {
    state.lastSyncAt = Date.now();
    notify();
  });

  window.addEventListener('online', () => {
    state.online = true;
    voegToe('info', 'Browser meldt: online');
  });

  window.addEventListener('offline', () => {
    state.online = false;
    voegToe('warn', 'Browser meldt: offline');
  });

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
      if (!reg) {
        state.swState = 'niet geregistreerd';
        notify();
        return;
      }
      state.swState = reg.active ? 'actief' : (reg.installing ? 'installeren' : 'onbekend');
      notify();
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      voegToe('info', 'Service worker controller gewisseld (nieuwe versie actief)');
    });
  }

  draaiIdbCheck();

  // Alleen de goedkope IndexedDB-check periodiek uitvoeren.
  // Geen valse Firestore-storingsmelding meer na 3 minuten zonder snapshot-event.
  setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    draaiIdbCheck();
  }, 30000);

  notify();
}
