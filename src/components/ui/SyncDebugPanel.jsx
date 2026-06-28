// src/components/ui/SyncDebugPanel.jsx
// Visueel debug-paneel voor sync-problemen — bedoeld voor een niet-technische
// gebruiker die toch "wil zien wat er fout loopt" en het logboek kan kopiëren
// om door te sturen. Toont live status + een geschiedenis van events, ook van
// vóór de huidige sessie (overleeft een herstart van de PWA via localStorage).
import { useEffect, useState } from 'react';
import { C } from '../../styles/tokens';
import { subscribe, runManualCheck, clearLog } from '../../services/syncMonitor';

const TYPE_KLEUR = { error: C.red, warn: C.orange, sync: C.green, info: C.textMuted };
const TYPE_LABEL = { error: '✗', warn: '⚠', sync: '✓', info: 'ℹ' };

function geledenTekst(ms) {
  if (ms == null) return 'nooit';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s geleden`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min geleden`;
  return `${Math.round(m / 60)} u geleden`;
}

export default function SyncDebugPanel({ onClose }) {
  const [snap, setSnap] = useState(null);
  const [log, setLog] = useState([]);
  const [bezig, setBezig] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = subscribe((state, l) => { setSnap(state); setLog([...l].reverse()); });
    const tik = setInterval(() => setNow(Date.now()), 1000);
    return () => { unsub(); clearInterval(tik); };
  }, []);

  if (!snap) return null;

  const test = async () => {
    setBezig(true);
    try { await runManualCheck(); } finally { setBezig(false); }
  };

  const kopieer = () => {
    const tekst = log.map(e => `${new Date(e.ts).toLocaleString('nl-BE')}  [${e.type}]  ${e.bericht}`).join('\n');
    navigator.clipboard?.writeText(tekst).catch(() => {});
  };

  const rij = (label, waarde, kleur) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.borderSoft}`, fontSize: '13px' }}>
      <span style={{ color: C.textMuted }}>{label}</span>
      <span style={{ color: kleur || C.textPrimary, fontWeight: '600' }}>{waarde}</span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.card, width: 'min(560px, 100%)', maxHeight: '85vh',
          borderRadius: '16px 16px 0 0', padding: '20px', overflowY: 'auto',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '17px', color: C.textPrimary }}>🔍 Sync-diagnose</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textMuted, fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ marginBottom: '14px' }}>
          {rij('Netwerk', snap.online ? 'Online' : 'Offline', snap.online ? C.green : C.red)}
          {rij('App-modus', snap.standalone ? 'Standalone (beginscherm)' : 'Browser')}
          {rij('Schermzichtbaarheid', snap.visibility)}
          {rij('Laatste Firestore-sync', geledenTekst(snap.lastSyncAt ? now - snap.lastSyncAt : null), snap.stuck ? C.red : C.green)}
          {rij('IndexedDB-test', snap.idbStuck ? 'Vastgelopen' : (snap.lastIdbLatencyMs != null ? `${snap.lastIdbLatencyMs}ms` : '—'), snap.idbStuck ? C.red : C.green)}
          {rij('Service worker', snap.swState)}
          {rij('App-uptime', geledenTekst(now - snap.startedAt))}
        </div>

        {snap.stuck && (
          <div style={{ background: 'rgba(239,68,68,0.12)', border: `1px solid ${C.red}`, borderRadius: '10px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', color: C.red }}>
            Sync lijkt vastgelopen terwijl je online en actief bent. Sluit de app volledig af (swipe weg) en open opnieuw — dat herstelt de IndexedDB-verbinding.
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <button onClick={test} disabled={bezig} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: 'none', background: C.blue, color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer', opacity: bezig ? 0.6 : 1 }}>
            {bezig ? 'Bezig…' : '🔄 Test nu'}
          </button>
          <button onClick={kopieer} style={{ flex: 1, padding: '9px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.textPrimary, fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}>
            📋 Kopieer logboek
          </button>
          <button onClick={clearLog} style={{ padding: '9px 12px', borderRadius: '8px', border: `1px solid ${C.border}`, background: 'transparent', color: C.textMuted, fontSize: '13px', cursor: 'pointer' }}>
            Wis
          </button>
        </div>

        <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
          Logboek ({log.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {log.length === 0 && <div style={{ color: C.textMuted, fontSize: '13px' }}>Nog geen events.</div>}
          {log.map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '4px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ color: C.textMuted, whiteSpace: 'nowrap' }}>{new Date(e.ts).toLocaleTimeString('nl-BE')}</span>
              <span style={{ color: TYPE_KLEUR[e.type] || C.textPrimary }}>{TYPE_LABEL[e.type] || ''}</span>
              <span style={{ color: C.textPrimary }}>{e.bericht}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
