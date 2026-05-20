// src/components/ConfirmDialog.jsx
import React, { useEffect, useRef, useState } from 'react';
import { C, buttonStyle, cardStyle, font, inputStyle } from '../styles/tokens';

export default function ConfirmDialog({
  open,
  titel,
  beschrijving,
  bevestigLabel = 'Bevestigen',
  annuleerLabel = 'Annuleren',
  variant = 'danger',
  redenVeld = null,
  onBevestig,
  onAnnuleer,
}) {
  const [reden, setReden] = useState('');
  const bevestigRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setReden('');
      return;
    }
    const timer = setTimeout(() => {
      if (redenVeld) return;
      bevestigRef.current?.focus();
    }, 30);
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onAnnuleer?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, redenVeld, onAnnuleer]);

  if (!open) return null;

  const redenVerplicht = !!redenVeld?.verplicht;
  const redenTrimmed = reden.trim();
  const bevestigDisabled = redenVerplicht && !redenTrimmed;

  const handleBevestig = () => {
    if (bevestigDisabled) return;
    if (redenVeld) onBevestig?.({ ok: true, reden: redenTrimmed });
    else onBevestig?.(true);
  };

  return (
    <div
      onClick={onAnnuleer}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', fontFamily: font,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...cardStyle({ padded: true, gradient: true }),
          width: '100%', maxWidth: '420px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 800, color: C.text, marginBottom: beschrijving || redenVeld ? '10px' : '16px' }}>
          {titel}
        </div>
        {beschrijving && (
          <div style={{ fontSize: '13px', color: C.textSec, lineHeight: 1.45, marginBottom: redenVeld ? '12px' : '16px' }}>
            {beschrijving}
          </div>
        )}
        {redenVeld && (
          <textarea
            autoFocus
            value={reden}
            onChange={(e) => setReden(e.target.value)}
            placeholder={redenVeld.placeholder || 'Reden…'}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: '72px', marginBottom: '16px' }}
          />
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            ref={bevestigRef}
            onClick={handleBevestig}
            disabled={bevestigDisabled}
            style={{
              ...buttonStyle(variant === 'danger' ? 'danger' : 'primary'),
              flex: 1,
              opacity: bevestigDisabled ? 0.5 : 1,
              cursor: bevestigDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {bevestigLabel}
          </button>
          <button onClick={onAnnuleer} style={buttonStyle('subtle')}>
            {annuleerLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
