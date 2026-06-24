// src/components/details/DetailModal.jsx
// Gedeelde bottom-sheet wrapper voor detailpanels.
// Sluit via backdrop-klik, '×'-knop en Escape-toets.
// Animeert in/uit (backdrop-fade + paneel-slide); animation-duration valt terug
// op 0.01ms via de globale prefers-reduced-motion-regel in theme.css.

import React, { useEffect, useId, useRef, useState } from 'react';
import { C } from '../../styles/tokens';

const DUUR_MS = 220;
const EASE_OUT = 'cubic-bezier(0.25,1,0.5,1)'; // ease-out-quart, geen bounce/elastic

export default function DetailModal({ open, onClose, title, accentKleur, children }) {
  const titleId = useId();
  const paneelRef = useRef(null);
  const vorigeFocusRef = useRef(null);
  const [gemonteerd, setGemonteerd] = useState(open);
  const [zichtbaar, setZichtbaar] = useState(false);

  // Bij open: eerst monteren (transform/opacity op startwaarde), dan op de
  // volgende frame naar de eindwaarde — anders is er niets om van te animeren.
  // Bij sluiten: eerst terug naar startwaarde animeren, pas daarna demonteren,
  // zodat de exit-animatie ook echt zichtbaar is i.p.v. een instant unmount.
  useEffect(() => {
    if (open) {
      setGemonteerd(true);
      const frame = requestAnimationFrame(() => setZichtbaar(true));
      return () => cancelAnimationFrame(frame);
    }
    setZichtbaar(false);
    const timer = setTimeout(() => setGemonteerd(false), DUUR_MS);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!gemonteerd) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);

    vorigeFocusRef.current = document.activeElement;
    paneelRef.current?.focus();

    return () => {
      window.removeEventListener('keydown', onKey);
      vorigeFocusRef.current?.focus?.();
    };
  }, [gemonteerd, onClose]);

  if (!gemonteerd) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        opacity: zichtbaar ? 1 : 0,
        transition: `opacity ${DUUR_MS}ms ${EASE_OUT}`,
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
          transform: zichtbaar ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${DUUR_MS}ms ${EASE_OUT}`,
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
