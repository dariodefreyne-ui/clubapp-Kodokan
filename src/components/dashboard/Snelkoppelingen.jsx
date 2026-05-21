// Snelkoppelingen-widget — toont favoriete paginas (instelbaar per gebruiker)
// Twee varianten:
//   variant='grid'    — kaarten-grid (vergelijkbaar met huidige stijl)
//   variant='compact' — icoon-strip, smaller, geschikt voor sidebar/bento-tegel
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALLE_PAGINAS } from '../../config/appConfig';

const PAGINA_META = Object.fromEntries(
  ALLE_PAGINAS.map(p => [p.pad, { label: p.label, icon: p.icon }])
);

export default function Snelkoppelingen({ beschikbarePaginas, favorieten, onWijzig, variant = 'grid' }) {
  const navigate = useNavigate();
  const [bewerk, setBewerk] = useState(false);

  const actieveLijst = favorieten.length > 0 ? favorieten : beschikbarePaginas.slice(0, 6);

  if (bewerk) {
    return (
      <div>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Tik op een pagina om toe te voegen of te verwijderen
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          {beschikbarePaginas.map(pad => {
            const meta = PAGINA_META[pad];
            if (!meta) return null;
            const actief = favorieten.includes(pad);
            return (
              <button
                key={pad}
                onClick={() => {
                  const nieuw = actief
                    ? favorieten.filter(p => p !== pad)
                    : [...favorieten, pad];
                  onWijzig(nieuw);
                }}
                style={{
                  background: actief ? 'var(--accent-red)' : 'var(--bg-primary)',
                  border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`,
                  color: 'var(--text-primary)',
                  padding: 'var(--space-2) 14px',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setBewerk(false)}
          style={{ background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}
        >
          Klaar
        </button>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {actieveLijst.map(pad => {
          const meta = PAGINA_META[pad];
          if (!meta) return null;
          return (
            <button
              key={pad}
              onClick={() => navigate(pad)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '8px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-red)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              <span style={{ fontSize: '18px' }}>{meta.icon}</span>
              <span style={{ fontWeight: '600' }}>{meta.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setBewerk(true)}
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 10px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-xs)', marginTop: '2px' }}
        >
          ✏️ Aanpassen
        </button>
      </div>
    );
  }

  // Default 'grid'
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginBottom: '12px' }}>
        {actieveLijst.map(pad => {
          const meta = PAGINA_META[pad];
          if (!meta) return null;
          return (
            <button
              key={pad}
              onClick={() => navigate(pad)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                borderRadius: 'var(--radius-lg)',
                padding: '14px 8px',
                cursor: 'pointer',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-red)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
            >
              <span style={{ fontSize: '24px' }}>{meta.icon}</span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', lineHeight: '1.2' }}>{meta.label}</span>
            </button>
          );
        })}
      </div>
      <button
        onClick={() => setBewerk(true)}
        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
      >
        ✏️ Aanpassen
      </button>
    </div>
  );
}
