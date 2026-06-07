// src/components/ui/UpdateBanner.jsx
// Toont een vaste banner onderaan het scherm wanneer een nieuwe versie van de
// app beschikbaar is. Gebruikt useAppUpdate() om de SW-status te bewaken.
// Stijl: volledig in lijn met de Kodokan Clubapp design tokens.

import { C, buttonStyle, font } from '../../styles/tokens';
import { useAppUpdate } from '../../hooks/useAppUpdate';

export default function UpdateBanner() {
  const { needsRefresh, updateApp } = useAppUpdate();

  if (!needsRefresh) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        width: 'calc(100% - 32px)',
        maxWidth: '520px',
        background: C.card,
        border: `1px solid ${C.blue}`,
        borderRadius: '14px',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px ${C.blue}22`,
        fontFamily: font,
      }}
    >
      {/* Icoon */}
      <div style={{
        flexShrink: 0,
        width: '38px',
        height: '38px',
        borderRadius: '10px',
        background: C.blueDim,
        border: `1px solid ${C.blue}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
      }}>
        🔄
      </div>

      {/* Tekst */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px',
          fontWeight: '700',
          color: C.textPrimary,
          marginBottom: '2px',
        }}>
          Nieuwe versie beschikbaar
        </div>
        <div style={{
          fontSize: '12px',
          color: C.textSec,
          lineHeight: 1.4,
        }}>
          Herlaad de app om de laatste updates te gebruiken.
        </div>
      </div>

      {/* Knop */}
      <button
        onClick={updateApp}
        style={{
          ...buttonStyle('accent'),
          flexShrink: 0,
          minHeight: '38px',
          padding: '8px 14px',
          fontSize: '13px',
          whiteSpace: 'nowrap',
        }}
      >
        Bijwerken
      </button>
    </div>
  );
}
