/**
 * PinLogin.jsx  –  Full-screen PIN login for Kodokan Clubapp
 *
 * Flow:
 *   1. Landing screen: title / subtitle + two large role buttons
 *   2. PIN-pad screen: 4-dot indicator, 0-9 numpad, backspace, confirm
 *
 * Auth: calls login(pin) from useAuth(). The AuthContext resolves the
 * role from the PIN automatically (beheerder=1234, trainer=5678 by default).
 *
 * All styles are inline – no external CSS imports required.
 */

import React, { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:           '#1a1a1a',
  surface:      '#242424',
  card:         '#2d2d2d',
  border:       '#3a3a3a',
  red:          '#c0392b',
  redHover:     '#e74c3c',
  redDark:      '#962d22',
  blue:         '#2980b9',
  textPrimary:  '#ffffff',
  textSecondary:'#aaaaaa',
  textMuted:    '#666666',
  danger:       '#e74c3c',
};

// ─── Tiny helpers ───────────────────────────────────────────────────────────────
const pill = (extra = {}) => ({
  display:       'inline-block',
  padding:       '4px 14px',
  borderRadius:  '999px',
  fontSize:      '12px',
  fontWeight:    '700',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  ...extra,
});

// ─── NumKey ─────────────────────────────────────────────────────────────────────
function NumKey({ label, onClick, variant = 'default' }) {
  const [pressed, setPressed] = useState(false);

  const variantStyles = {
    default:   { background: pressed ? '#3a3a3a' : C.card,    color: C.textPrimary },
    backspace: { background: pressed ? '#3a3a3a' : C.surface, color: C.textSecondary },
    confirm:   { background: pressed ? C.redDark : C.red,     color: '#fff' },
    empty:     { background: 'transparent', pointerEvents: 'none' },
  };

  return (
    <button
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        height:          '68px',
        width:           '100%',
        borderRadius:    '12px',
        border:          'none',
        cursor:          variant === 'empty' ? 'default' : 'pointer',
        fontSize:        variant === 'backspace' ? '22px' : '26px',
        fontWeight:      '700',
        fontFamily:      'inherit',
        transition:      'background 0.1s, transform 0.08s',
        userSelect:      'none',
        WebkitTapHighlightColor: 'transparent',
        outline:         'none',
        transform:       pressed ? 'scale(0.93)' : 'scale(1)',
        ...variantStyles[variant],
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => { setPressed(false); onClick && onClick(); }}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
    >
      {label}
    </button>
  );
}

// ─── PinDots ────────────────────────────────────────────────────────────────────
function PinDots({ length }) {
  return (
    <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', margin: '24px 0' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          style={{
            width:        '18px',
            height:       '18px',
            borderRadius: '50%',
            background:   i < length ? C.red : 'transparent',
            border:       `2px solid ${i < length ? C.red : C.border}`,
            transition:   'background 0.15s, border-color 0.15s',
            boxShadow:    i < length ? `0 0 8px ${C.red}88` : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ─── PinPad ─────────────────────────────────────────────────────────────────────
function PinPad({ role, onBack }) {
  const { login } = useAuth();
  const [digits,  setDigits]  = useState('');
  const [error,   setError]   = useState('');
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  const roleLabel = role === 'beheerder' ? 'Beheerder' : 'Trainer';
  const roleColor = role === 'beheerder' ? C.red : C.blue;

  const shake = () => {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  };

  const attemptLogin = useCallback((pin) => {
    setLoading(true);
    // Small delay so the last dot animation is visible before validation
    setTimeout(() => {
      const role = login(pin);
      if (!role) {
        setDigits('');
        setError('Verkeerde PIN. Probeer opnieuw.');
        shake();
      }
      setLoading(false);
    }, 120);
  }, [login]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDigit = useCallback((d) => {
    if (loading) return;
    setError('');
    setDigits(prev => {
      if (prev.length >= 4) return prev;
      const next = prev + d;
      if (next.length === 4) {
        // Auto-submit when 4th digit is pressed
        setTimeout(() => attemptLogin(next), 0);
      }
      return next;
    });
  }, [loading, attemptLogin]);

  const handleBackspace = useCallback(() => {
    if (loading) return;
    setError('');
    setDigits(prev => prev.slice(0, -1));
  }, [loading]);

  const handleConfirm = useCallback(() => {
    if (digits.length < 4) {
      setError('Vul 4 cijfers in');
      shake();
      return;
    }
    attemptLogin(digits);
  }, [digits, attemptLogin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Numpad layout: rows of 3
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [null, '0', '⌫'],
  ];

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      alignItems:    'center',
      width:         '100%',
      maxWidth:      '360px',
      margin:        '0 auto',
      padding:       '0 16px',
    }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          alignSelf:    'flex-start',
          background:   'none',
          border:       'none',
          color:        C.textSecondary,
          cursor:       'pointer',
          fontSize:     '14px',
          padding:      '8px 0',
          marginBottom: '12px',
          display:      'flex',
          alignItems:   'center',
          gap:          '6px',
          fontFamily:   'inherit',
        }}
      >
        ← Terug
      </button>

      {/* Role badge */}
      <div style={pill({ background: roleColor, color: '#fff', marginBottom: '6px' })}>
        {roleLabel}
      </div>
      <p style={{ color: C.textSecondary, fontSize: '14px', margin: '4px 0 0' }}>
        Voer uw PIN in
      </p>

      {/* Dot indicator with optional shake */}
      <div style={{ animation: shaking ? 'kodokan-shake 0.5s ease' : 'none' }}>
        <PinDots length={digits.length} />
      </div>

      {/* Error message */}
      <div style={{
        minHeight:    '22px',
        marginBottom: '10px',
        color:        C.danger,
        fontSize:     '13px',
        fontWeight:   '500',
        textAlign:    'center',
      }}>
        {error}
      </div>

      {/* Numpad grid */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap:                 '10px',
        width:               '100%',
        opacity:             loading ? 0.5 : 1,
        pointerEvents:       loading ? 'none' : 'auto',
        transition:          'opacity 0.2s',
      }}>
        {rows.flat().map((key, idx) => {
          if (key === null) {
            return <NumKey key={idx} label="" variant="empty" />;
          }
          if (key === '⌫') {
            return <NumKey key={idx} label="⌫" variant="backspace" onClick={handleBackspace} />;
          }
          return <NumKey key={idx} label={key} onClick={() => handleDigit(key)} />;
        })}
      </div>

      {/* Manual confirm button (safety net if auto-submit somehow didn't fire) */}
      {digits.length === 4 && !loading && (
        <button
          onClick={handleConfirm}
          style={{
            marginTop:     '16px',
            width:         '100%',
            padding:       '16px',
            borderRadius:  '12px',
            border:        'none',
            background:    C.red,
            color:         '#fff',
            fontSize:      '16px',
            fontWeight:    '700',
            cursor:        'pointer',
            letterSpacing: '0.5px',
            fontFamily:    'inherit',
            transition:    'background 0.15s',
          }}
          onMouseOver={e => (e.currentTarget.style.background = C.redHover)}
          onMouseOut={e => (e.currentTarget.style.background = C.red)}
        >
          Bevestigen ✓
        </button>
      )}

      {/* Shake animation injected inline once */}
      <style>{`
        @keyframes kodokan-shake {
          0%,100% { transform: translateX(0); }
          15%      { transform: translateX(-8px); }
          30%      { transform: translateX(8px); }
          45%      { transform: translateX(-6px); }
          60%      { transform: translateX(6px); }
          75%      { transform: translateX(-3px); }
          90%      { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}

// ─── RoleButton ─────────────────────────────────────────────────────────────────
function RoleButton({ emoji, label, description, color, onClick }) {
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
        display:     'flex',
        alignItems:  'center',
        gap:         '16px',
        padding:     '20px',
        borderRadius:'14px',
        border:      `2px solid ${hovered || pressed ? color : C.border}`,
        background:  pressed
          ? `${color}22`
          : hovered
          ? `${color}11`
          : C.card,
        color:       C.textPrimary,
        cursor:      'pointer',
        textAlign:   'left',
        width:       '100%',
        transition:  'border-color 0.18s, background 0.18s, transform 0.1s',
        transform:   pressed ? 'scale(0.97)' : 'scale(1)',
        WebkitTapHighlightColor: 'transparent',
        outline:     'none',
        fontFamily:  'inherit',
      }}
    >
      {/* Icon circle */}
      <div style={{
        width:          '52px',
        height:         '52px',
        flexShrink:     0,
        borderRadius:   '12px',
        background:     `${color}22`,
        border:         `1.5px solid ${color}55`,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        fontSize:       '26px',
      }}>
        {emoji}
      </div>

      {/* Text */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontWeight:    '700',
          fontSize:      '18px',
          marginBottom:  '3px',
          color:         hovered ? color : C.textPrimary,
          transition:    'color 0.18s',
        }}>
          {label}
        </div>
        <div style={{ fontSize: '13px', color: C.textSecondary, lineHeight: '1.4' }}>
          {description}
        </div>
      </div>

      {/* Chevron */}
      <div style={{
        color:      hovered ? color : C.textMuted,
        fontSize:   '20px',
        transition: 'color 0.18s',
      }}>›</div>
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────────
export default function PinLogin() {
  const [selectedRole, setSelectedRole] = useState(null); // null | 'beheerder' | 'trainer'

  return (
    <div style={{
      minHeight:      '100dvh',
      background:     C.bg,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '24px 16px',
      fontFamily:     '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color:          C.textPrimary,
    }}>
      {selectedRole ? (
        /* ── PIN-pad view ── */
        <PinPad role={selectedRole} onBack={() => setSelectedRole(null)} />
      ) : (
        /* ── Role selection view ── */
        <div style={{
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          width:         '100%',
          maxWidth:      '360px',
        }}>
          {/* Logo */}
          <div style={{
            width:          '80px',
            height:         '80px',
            background:     `linear-gradient(135deg, ${C.red}, ${C.redDark})`,
            borderRadius:   '20px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '42px',
            marginBottom:   '20px',
            boxShadow:      `0 8px 32px ${C.red}55`,
          }}>
            🥋
          </div>

          {/* Title */}
          <h1 style={{
            margin:        '0 0 6px',
            fontSize:      '28px',
            fontWeight:    '800',
            letterSpacing: '-0.5px',
            color:         C.textPrimary,
            textAlign:     'center',
          }}>
            Kodokan Clubapp
          </h1>
          <p style={{
            margin:     '0 0 40px',
            fontSize:   '15px',
            color:      C.textSecondary,
            fontWeight: '400',
            textAlign:  'center',
          }}>
            Judo Kodokan Merchtem
          </p>

          {/* Prompt */}
          <p style={{
            fontSize:      '13px',
            color:         C.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            fontWeight:    '600',
            marginBottom:  '16px',
            margin:        '0 0 16px',
          }}>
            Kies uw rol
          </p>

          {/* Role buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
            <RoleButton
              emoji="👔"
              label="Beheerder"
              description="Volledige toegang tot alle modules"
              color={C.red}
              onClick={() => setSelectedRole('beheerder')}
            />
            <RoleButton
              emoji="🥋"
              label="Trainer"
              description="Trainingen, leden en examens"
              color={C.blue}
              onClick={() => setSelectedRole('trainer')}
            />
          </div>

          <p style={{
            marginTop: '40px',
            fontSize:  '12px',
            color:     C.textMuted,
            textAlign: 'center',
          }}>
            Selecteer een rol om in te loggen met PIN
          </p>
        </div>
      )}
    </div>
  );
}
