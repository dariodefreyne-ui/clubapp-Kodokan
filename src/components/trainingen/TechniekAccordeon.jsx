// src/components/trainingen/TechniekAccordeon.jsx
import React, { useState } from 'react';
import { C } from './tokens';

function TechniekAccordeonItem({ t, detail }) {
  const [open, setOpen] = useState(false);
  const faseKleur = t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.textMuted;
  const faseBg    = t.fase === 'basis' ? C.blueDim : t.fase === 'verdieping' ? C.redDim : '#2a2a2a';

  const secties = [];
  if (detail?.basisfase?.length)       secties.push({ label: 'Basisfase',       items: detail.basisfase,       kleur: C.blue });
  if (detail?.verdieping?.length)      secties.push({ label: 'Verdieping',      items: detail.verdieping,      kleur: C.red });
  if (detail?.aandachtspunten?.length) secties.push({ label: 'Aandachtspunten', items: detail.aandachtspunten, kleur: C.orange });
  if (detail?.basisvoorwaarden?.length) secties.push({ label: 'Basisvoorwaarden', items: detail.basisvoorwaarden, kleur: C.textMuted });
  if (detail?.remediering?.length)     secties.push({ label: 'Remediering',     items: detail.remediering,     kleur: C.textMuted });
  if (detail?.oefenvormen?.length)     secties.push({ label: 'Oefenvormen',     items: detail.oefenvormen,     kleur: C.green });

  const heeftDetails = secties.length > 0 || t.basisvaardigheid;

  return (
    <div style={{ background: C.bg, borderRadius: '8px', marginBottom: '6px', border: `1px solid ${open ? faseKleur : C.border}`, overflow: 'hidden', transition: 'border-color 0.15s' }}>
      <div onClick={() => heeftDetails && setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 12px', cursor: heeftDetails ? 'pointer' : 'default' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', flexShrink: 0, background: faseBg, color: faseKleur, border: `1px solid ${faseKleur}` }}>
          {t.fase || '—'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: C.textPrimary }}>
            {t.techniekNaam || '—'}
            {!detail && t.techniekNaam && (
              <span style={{ fontSize: '11px', color: C.orange, marginLeft: '8px', fontWeight: '400' }}>⚠ niet in databank</span>
            )}
          </div>
          {t.basisvaardigheid && !open && (
            <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '1px' }}>{t.basisvaardigheid}</div>
          )}
        </div>
        {heeftDetails && <span style={{ color: C.textMuted, fontSize: '12px', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>}
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {t.basisvaardigheid && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Basisvaardigheid</div>
              <div style={{ fontSize: '13px', color: C.textSec }}>{t.basisvaardigheid}</div>
            </div>
          )}
          {secties.map(sectie => (
            <div key={sectie.label}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: sectie.kleur, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{sectie.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {sectie.items.map((item, i) => (
                  <div key={i} style={{ fontSize: '12px', color: C.textSec, padding: '4px 8px', background: C.card, borderRadius: '6px', borderLeft: `3px solid ${sectie.kleur}` }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TechniekAccordeonLijst({ technieksLijst, techniekDatabank }) {
  if (technieksLijst.length === 0) {
    return <div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '12px' }}>Geen technieken ingepland.</div>;
  }
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Technieken</div>
      {technieksLijst.map(t => {
        const detail = techniekDatabank?.find(tk => tk.id === t.techniekId);
        return <TechniekAccordeonItem key={t.id} t={t} detail={detail} />;
      })}
    </div>
  );
}

export { TechniekAccordeonItem, TechniekAccordeonLijst };
