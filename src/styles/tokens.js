// src/styles/tokens.js
// Canonieke design tokens voor Kodokan Clubapp.
// Eén bron voor JS-inline styles én gesynchroniseerd met src/styles/theme.css.

export const C = {
  bg: '#06101A',
  surface: '#0D1B2A',
  card: '#1B2A3D',
  cardHover: '#243549',
  border: '#2A3F5A',
  borderSoft: '#1F3046',
  red: '#E63346',
  redHover: '#C41F31',
  redDim: 'rgba(230,51,70,0.16)',
  redBord: 'rgba(230,51,70,0.35)',
  textPrimary: '#F8FAFC',
  text: '#F8FAFC',
  textSec: '#94A3B8',
  textMuted: '#64748B',
  green: '#22C55E',
  greenDim: 'rgba(34,197,94,0.18)',
  blue: '#38BDF8',
  blueDim: 'rgba(56,189,248,0.16)',
  orange: '#FB923C',
  orangeDim: 'rgba(251,146,60,0.16)',
  purple: '#A78BFA',
  purpleDim: 'rgba(167,139,250,0.18)',
};

export const font = "'Plus Jakarta Sans', system-ui, sans-serif";

const colorMap = {
  red: ['red', 'redDim'],
  blue: ['blue', 'blueDim'],
  green: ['green', 'greenDim'],
  orange: ['orange', 'orangeDim'],
  purple: ['purple', 'purpleDim'],
};

function pair(accent = 'red') {
  const [fg, bg] = colorMap[accent] || colorMap.red;
  return { color: C[fg], background: C[bg], border: C[fg] };
}

export function buttonStyle(variant = 'primary') {
  const base = {
    minHeight: '44px', padding: '9px 14px', borderRadius: '8px', cursor: 'pointer',
    fontSize: '13px', fontWeight: '700', fontFamily: font,
    transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease, opacity 0.15s ease',
  };
  if (variant === 'primary') return { ...base, background: C.red, border: 'none', color: '#fff' };
  if (variant === 'danger') return { ...base, background: C.redDim, border: `1px solid ${C.red}`, color: C.red };
  if (variant === 'success') return { ...base, background: C.green, border: 'none', color: '#fff' };
  if (variant === 'accent') return { ...base, background: C.blueDim, border: `1px solid ${C.blue}`, color: C.blue };
  if (variant === 'subtle') return { ...base, background: C.surface, border: `1px solid ${C.borderSoft}`, color: C.textSec };
  return { ...base, background: C.card, border: `1px solid ${C.borderSoft}`, color: C.textSec };
}

export function badgeStyle(color = 'blue') {
  const p = pair(color);
  return {
    display: 'inline-flex', alignItems: 'center', gap: '6px', background: p.background,
    border: `1px solid ${p.border}`, color: p.color, borderRadius: '999px', padding: '6px 10px',
    fontSize: '12px', fontWeight: '700', lineHeight: 1, whiteSpace: 'nowrap',
  };
}

export function cardStyle({ padded = true, gradient = false } = {}) {
  return {
    background: gradient ? 'linear-gradient(135deg, #0D1B2A 0%, #1B2A3D 100%)' : C.card,
    border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: padded ? '16px' : 0,
    boxShadow: gradient ? '0 12px 32px rgba(0,0,0,0.18)' : 'none',
  };
}

export const inputStyle = {
  width: '100%', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px',
  color: C.textPrimary, padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box', outline: 'none',
};

export const tabBarStyle = {
  display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${C.borderSoft}`,
  marginBottom: '16px', WebkitOverflowScrolling: 'touch',
};

export function tabButtonStyle(active) {
  return {
    background: 'none', border: 'none', borderBottom: active ? `2px solid ${C.red}` : '2px solid transparent',
    color: active ? C.textPrimary : C.textMuted, padding: '12px 14px', cursor: 'pointer',
    fontSize: '14px', fontWeight: active ? '800' : '500', whiteSpace: 'nowrap',
  };
}

export function chipStyle(active, accent = 'red') {
  const p = pair(accent);
  return {
    padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
    background: active ? p.background : C.bg, border: `1px solid ${active ? p.border : C.borderSoft}`,
    color: active ? p.color : C.textSec, boxShadow: active ? `0 8px 18px ${p.background}` : 'none',
    whiteSpace: 'nowrap',
  };
}
