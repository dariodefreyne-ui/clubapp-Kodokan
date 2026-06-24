// src/components/details/DetailModal.jsx
// Gedeelde bottom-sheet wrapper voor detailpanels.
// Sluit via backdrop-klik, '×'-knop en Escape-toets.

import React, { useEffect, useId, useRef } from 'react';
import { C } from '../../styles/tokens';

export default function DetailModal({ open, onClose, title, accentKleur, children }) {
  const titleId = useId();
  const paneelRef = useRef(null);
  const vorigeFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    vorigeFocusRef.current = document.activeElement;
    paneelRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      vorigeFocusRef.current?.focus?.();
    };
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
        ref={paneelRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={{
          background: 'var(--bg-card)',
          borderTop: accentKleur ? `3px solid ${accentKleur}` : 'none',
          borderRadius: '16px 16px 0 0',
          maxHeight: '85vh', overflowY: 'auto',
          padding: '20px', width: '100%', maxWidth: '600px',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
          <div id={titleId} style={{ fontSize: '20px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.25, flex: 1, minWidth: 0 }}>
            {title}
          </div>
          <button
            onClick={onClose}
            aria-label="Sluiten"
            style={{
              background: 'none', border: 'none', color: C.textSec,
              fontSize: '28px', lineHeight: 1, cursor: 'pointer',
              padding: '0 4px', minHeight: '44px', minWidth: '44px',
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
