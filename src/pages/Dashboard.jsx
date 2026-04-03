/**
 * Dashboard.jsx  –  Home screen for Kodokan Clubapp
 *
 * Shows:
 *   • Greeting with current role and today's date
 *   • Responsive grid of module cards (same as sidebar nav items)
 *     Each card: big emoji, name, short description, red border on hover
 *
 * Navigates to the matching route when a card is tapped / clicked.
 * All styles are inline.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ─── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:            '#1a1a1a',
  card:          '#2d2d2d',
  cardHover:     '#333333',
  border:        '#3a3a3a',
  borderHover:   '#c0392b',
  red:           '#c0392b',
  redHover:      '#e74c3c',
  textPrimary:   '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted:     '#666666',
};

// ─── Module definitions ─────────────────────────────────────────────────────────
const MODULES = [
  {
    path:        '/',
    icon:        '🏠',
    label:       'Dashboard',
    description: 'Overzicht en snelle toegang',
  },
  {
    path:        '/trainingen',
    icon:        '📅',
    label:       'Trainingen',
    description: 'Planning en aanwezigheid',
  },
  {
    path:        '/leden',
    icon:        '🥋',
    label:       'Ledenbeheer',
    description: 'Leden registreren en beheren',
  },
  {
    path:        '/winkel',
    icon:        '🎽',
    label:       'Clubwinkel',
    description: 'Producten en bestellingen',
  },
  {
    path:        '/verkoop',
    icon:        '💳',
    label:       'Verkoop',
    description: 'Kassa en betalingen',
  },
  {
    path:        '/stock',
    icon:        '📦',
    label:       'Stockbeheer',
    description: 'Voorraadbeheer',
  },
  {
    path:        '/eetfestijn',
    icon:        '🍝',
    label:       'Eetfestijn',
    description: 'Tickets en maaltijden',
  },
  {
    path:        '/wedstrijden',
    icon:        '🏆',
    label:       'Wedstrijden',
    description: 'Competities en resultaten',
  },
  {
    path:        '/examens',
    icon:        '📘',
    label:       'Examens',
    description: 'Gradaties en beoordelingen',
  },
  {
    path:        '/documenten',
    icon:        '📁',
    label:       'Documenten',
    description: 'Bestanden en formulieren',
  },
  {
    path:        '/communicatie',
    icon:        '📣',
    label:       'Communicatie',
    description: 'Berichten en aankondigingen',
  },
  {
    path:        '/rapporten',
    icon:        '📊',
    label:       'Rapporten',
    description: 'Statistieken en overzichten',
  },
  {
    path:        '/beheer',
    icon:        '🔧',
    label:       'Beheer',
    description: 'Configuratie en instellingen',
  },
  {
    path:        '/instellingen',
    icon:        '⚙️',
    label:       'Instellingen',
    description: 'App-instellingen en PIN',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(date) {
  return date.toLocaleDateString('nl-BE', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}

function roleLabel(role) {
  const map = {
    beheerder: 'Beheerder',
    trainer:   'Trainer',
  };
  return map[role] ?? role ?? 'Gebruiker';
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Goedemorgen';
  if (h < 18) return 'Goedemiddag';
  return 'Goedenavond';
}

// ─── ModuleCard ─────────────────────────────────────────────────────────────────
function ModuleCard({ icon, label, description, onClick }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            '10px',
        padding:        '20px 18px',
        background:     hovered ? C.cardHover : C.card,
        border:         `1.5px solid ${hovered ? C.borderHover : C.border}`,
        borderRadius:   '14px',
        cursor:         'pointer',
        textAlign:      'left',
        width:          '100%',
        transition:     'background 0.18s, border-color 0.18s, transform 0.1s, box-shadow 0.18s',
        transform:      pressed ? 'scale(0.97)' : 'scale(1)',
        boxShadow:      hovered
          ? `0 4px 20px rgba(192,57,43,0.18)`
          : '0 2px 8px rgba(0,0,0,0.3)',
        fontFamily:     'inherit',
        WebkitTapHighlightColor: 'transparent',
        outline:        'none',
        minHeight:      '110px',
      }}
    >
      {/* Emoji */}
      <div style={{
        width:          '48px',
        height:         '48px',
        borderRadius:   '12px',
        background:     hovered ? `rgba(192,57,43,0.15)` : 'rgba(255,255,255,0.05)',
        border:         `1px solid ${hovered ? 'rgba(192,57,43,0.35)' : 'rgba(255,255,255,0.07)'}`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '24px',
        transition:     'background 0.18s, border-color 0.18s',
      }}>
        {icon}
      </div>

      {/* Text */}
      <div>
        <div style={{
          fontWeight:  '700',
          fontSize:    '15px',
          color:       hovered ? C.redHover : C.textPrimary,
          marginBottom:'3px',
          transition:  'color 0.18s',
        }}>
          {label}
        </div>
        <div style={{
          fontSize:   '12px',
          color:      C.textMuted,
          lineHeight: '1.4',
        }}>
          {description}
        </div>
      </div>
    </button>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate   = useNavigate();
  const { role }   = useAuth();
  const today      = new Date();

  return (
    <div style={{
      color:      C.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      {/* ── Header ── */}
      <div style={{
        marginBottom: '28px',
        paddingBottom:'20px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        {/* Date pill */}
        <div style={{
          display:       'inline-flex',
          alignItems:    'center',
          gap:           '6px',
          background:    'rgba(255,255,255,0.05)',
          border:        `1px solid ${C.border}`,
          borderRadius:  '999px',
          padding:       '5px 14px',
          fontSize:      '12px',
          color:         C.textSecondary,
          marginBottom:  '14px',
          textTransform: 'capitalize',
        }}>
          📅 {formatDate(today)}
        </div>

        {/* Greeting */}
        <h1 style={{
          margin:        '0 0 6px',
          fontSize:      'clamp(22px, 5vw, 30px)',
          fontWeight:    '800',
          letterSpacing: '-0.5px',
          color:         C.textPrimary,
        }}>
          {greeting()},{' '}
          <span style={{ color: C.red }}>{roleLabel(role)}</span>!
        </h1>
        <p style={{
          margin:   0,
          fontSize: '14px',
          color:    C.textSecondary,
        }}>
          Welkom bij Judo Kodokan Merchtem — kies een module hieronder.
        </p>
      </div>

      {/* ── Section label ── */}
      <p style={{
        fontSize:      '11px',
        fontWeight:    '700',
        textTransform: 'uppercase',
        letterSpacing: '1.2px',
        color:         C.textMuted,
        margin:        '0 0 16px',
      }}>
        Modules
      </p>

      {/* ── Module grid ── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
        gap:                 '14px',
      }}>
        {MODULES.map(mod => (
          <ModuleCard
            key={mod.path}
            icon={mod.icon}
            label={mod.label}
            description={mod.description}
            onClick={() => navigate(mod.path)}
          />
        ))}
      </div>
    </div>
  );
}
