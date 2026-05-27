// src/components/trainingen/BeheerZone.jsx
import React, { useState } from 'react';
import { C } from './tokens';

export default function BeheerZone({
  magBeheerActiesZien,
  magDestructieveActiesZien,
  actieveGroepData,
  gefilterdeTrainingen,
  lesgeversLijst,
  actieveSeizoen,
  groepen,
  onImport,
  onExportGroep,
  onExportSeizoen,
  onVerwijderSeizoen,
  toonMelding,
}) {
  const [open, setOpen]         = useState(false);
  const [bezig, setBezig]       = useState(false);

  if (!magBeheerActiesZien) return null;

  const btnBase = {
    padding: '8px 14px', background: C.card, border: `1px solid ${C.borderSoft}`,
    borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600',
  };

  return (
    <section style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
      <button onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', color: C.textPrimary, cursor: 'pointer', padding: 0 }}>
        <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Beheeracties</span>
        <span style={{ fontSize: '12px', color: C.textMuted }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            <button onClick={onImport} style={btnBase}>📥 Import</button>
            <button onClick={async () => {
              setBezig(true);
              try { await onExportGroep(); toonMelding('Export klaar'); }
              catch (e) { alert('Export mislukt: ' + e.message); }
              finally { setBezig(false); }
            }} style={btnBase}>📤 Export</button>
            <button onClick={async () => {
              setBezig(true);
              try { await onExportSeizoen(); toonMelding('Seizoensextractie klaar'); }
              catch (e) { alert('Extractie mislukt: ' + e.message); }
              finally { setBezig(false); }
            }} disabled={bezig} style={{ ...btnBase, opacity: bezig ? 0.6 : 1 }}>📊 Seizoen</button>
          </div>
          {magDestructieveActiesZien && (
            <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '14px' }}>
              <div style={{ fontSize: '11px', color: C.red, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                Gevaarlijke acties
              </div>
              <button onClick={onVerwijderSeizoen}
                style={{ padding: '8px 14px', background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', color: C.red, cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
                Seizoen wissen
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
