import React from 'react';
import { C, cardStyle, buttonStyle } from '../styles/tokens';
import { useAuth } from '../contexts/AuthContext';

// URL wordt geladen uit Firestore settings/club.eetfestijnUrl.

const modules = [
  ['🛒', 'Bestellingen', 'Tafels & bestellingen registreren'],
  ['💰', 'Kassa', 'Betalingen & kasoverzicht'],
  ['🍳', 'Keukenstation', 'Bestellingen voor de keuken'],
  ['🍹', 'Barstation', 'Bestellingen voor de bar'],
  ['🍮', 'Dessertstation', 'Bestellingen voor desserts'],
  ['📊', 'Rapporten', 'Dagelijks overzicht & statistieken'],
];

export default function Eetfestijn() {
  const { configCache } = useAuth();
  const EETFESTIJN_URL = configCache?.clubSettings?.eetfestijnUrl || null;

  if (!EETFESTIJN_URL) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.textPrimary, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🍝</div>
          <div style={{ fontWeight: '700', marginBottom: '8px' }}>Eetfestijn-app niet geconfigureerd</div>
          <div style={{ color: C.textSec, fontSize: '14px' }}>
            Stel de URL in via Beheer &gt; Instellingen &gt; Eetfestijn URL.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.textPrimary, padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <section style={{ ...cardStyle({ gradient: true }), maxWidth: '520px', width: '100%', textAlign: 'center', padding: '28px 22px' }}>
        <div style={{ fontSize: '64px', marginBottom: '14px' }}>🍝</div>
        <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,7vw,34px)', fontWeight: 900 }}>Eetfestijn App</h1>
        <p style={{ margin: '0 0 24px', color: C.textSec, fontSize: '15px', lineHeight: 1.6 }}>
          Het eetfestijn wordt beheerd via een aparte, gespecialiseerde app met kassa-, keuken- en barstations.
        </p>
        <a href={EETFESTIJN_URL} style={{ ...buttonStyle('primary'), display: 'block', textDecoration: 'none', fontSize: '16px', padding: '15px 20px', marginBottom: '10px' }}>
          🚀 App openen
        </a>
        <a href={EETFESTIJN_URL} target="_blank" rel="noopener noreferrer" style={{ ...buttonStyle('ghost'), display: 'block', textDecoration: 'none' }}>
          ↗ Openen in nieuw tabblad
        </a>
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, margin: '24px 0' }} />
        <h2 style={{ margin: '0 0 14px', fontSize: '15px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Wat zit in de app</h2>
        <div style={{ display: 'grid', gap: '8px', textAlign: 'left' }}>
          {modules.map(([icon, label, desc]) => (
            <div key={label} style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '12px', padding: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '24px', width: '30px', textAlign: 'center' }}>{icon}</div>
              <div>
                <div style={{ fontWeight: 800 }}>{label}</div>
                <div style={{ color: C.textSec, fontSize: '13px' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '20px', fontSize: '12px', color: C.textMuted, display: 'grid', gap: '6px' }}>
          <div style={{ color: C.textMuted, fontSize: '11px' }}>Externe app — opent in je browser</div>
        </div>
      </section>
    </div>
  );
}
