// src/components/trainingen/GroepKiezer.jsx
// Compacte groepskeuze via knop + pop-up (bottom sheet). Bespaart ruimte op gsm
// t.o.v. een rij pillen. Herbruikt in zowel trainer- als beheer-module.
import React, { useState } from 'react';
import DetailModal from '../details/DetailModal';

const stijl = {
  knop: {
    width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', gap: '10px', minHeight: '48px',
    padding: '10px 14px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit',
    background: 'var(--bg-card)', border: '1px solid var(--accent-red)',
    color: 'var(--text-primary)', fontSize: '15px', fontWeight: '700',
  },
  rij: (actief) => ({
    width: '100%', boxSizing: 'border-box', textAlign: 'left',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
    padding: '14px 16px', marginBottom: '8px', borderRadius: '12px', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: '15px', fontWeight: actief ? '700' : '500',
    background: actief ? 'rgba(220,38,38,0.12)' : 'var(--bg-primary)',
    border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`,
    color: 'var(--text-primary)',
  }),
};

export default function GroepKiezer({ groepen, actieveGroep, onKies, profielGroepen = [], label = 'Groep' }) {
  const [open, setOpen] = useState(false);
  const huidige = groepen.find(g => g.id === actieveGroep);

  return (
    <>
      <button style={stijl.knop} onClick={() => setOpen(true)} aria-label="Kies groep">
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {huidige
            ? `${profielGroepen.includes(huidige.id) ? '★ ' : ''}${huidige.naam}${huidige.dag ? ` · ${huidige.dag}` : ''}`
            : 'Kies een groep'}
        </span>
        <span style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>▾</span>
      </button>

      <DetailModal open={open} onClose={() => setOpen(false)} title={label} accentKleur="var(--accent-red)">
        {groepen.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Geen groepen beschikbaar.</div>
        ) : (
          groepen.map(g => (
            <button
              key={g.id}
              style={stijl.rij(g.id === actieveGroep)}
              onClick={() => { onKies(g.id); setOpen(false); }}
            >
              <span>
                {profielGroepen.includes(g.id) ? '★ ' : ''}{g.naam}
                {g.dag && <span style={{ color: 'var(--text-secondary)', fontWeight: '400' }}> · {g.dag}</span>}
              </span>
              {g.id === actieveGroep && <span style={{ color: 'var(--accent-red)', flexShrink: 0 }}>✓</span>}
            </button>
          ))
        )}
      </DetailModal>
    </>
  );
}
