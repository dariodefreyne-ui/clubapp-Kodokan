// src/components/details/DetailModal.jsx
// Gedeelde bottom-sheet wrapper voor detailpanels.
// Sluit via backdrop-klik, '×'-knop en Escape-toets.

import React, { useEffect } from 'react';
import { C } from '../../styles/tokens';

export default function DetailModal({ open, onClose, title, accentKleur, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          borderTop: accentKleur ? `3px solid ${accentKleur}` : 'none',
          borderRadius: '16px 16px 0 0',
          maxHeight: '85vh', overflowY: 'auto',
          padding: '20px', width: '100%', maxWidth: '600px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '20px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.25, flex: 1, minWidth: 0 }}>
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            style={{
              background: 'none', border: 'none', color: C.textSec,
              fontSize: '28px', lineHeight: 1, cursor: 'pointer',
              padding: '0 4px', minHeight: '32px', minWidth: '32px',
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
