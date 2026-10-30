// src/components/leden/ledenUi.jsx
// Kleine UI-bouwstenen voor de ledenpagina: iconen, dropdown-menu en gedeelde CSS.
// Enkel componenten exporteren (React Fast Refresh).
import React, { useCallback, useEffect, useRef, useState } from 'react';

// ── Iconen (inline SVG, erven de tekstkleur) ────────────────────────────────
function Svg({ size = 18, children }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" style={{ flexShrink: 0 }}
    >
      {children}
    </svg>
  );
}
export const IcoonZoek = (p) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>;
export const IcoonKruis = (p) => <Svg {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const IcoonVerversen = (p) => <Svg {...p}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></Svg>;
export const IcoonFilter = (p) => <Svg {...p}><path d="M3 5h18l-7 8v6l-4 2v-8z" /></Svg>;
export const IcoonChevron = (p) => <Svg {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const IcoonDownload = (p) => <Svg {...p}><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" /></Svg>;
export const IcoonPlus = (p) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const IcoonMeer = (p) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" />
  </Svg>
);
export const IcoonLeden = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2 .8 3.5 2.6 3.5 5.7" />
  </Svg>
);
export const IcoonWaarschuwing = (p) => (
  <Svg {...p}><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17.5v.01" /></Svg>
);

// ── Gedeelde CSS (focus, hover, spinner) ────────────────────────────────────
export function LedenStijlen() {
  return (
    <style>{`
      @keyframes leden-spin { to { transform: rotate(360deg); } }
      .leden-spin { animation: leden-spin 0.9s linear infinite; }
      .leden-focus:focus-visible,
      .leden-rij:focus-visible { outline: 2px solid var(--accent-blue); outline-offset: 2px; }
      .leden-check:focus-within { outline: 2px solid var(--accent-blue); outline-offset: -2px; }
      @media (hover: hover) {
        .leden-rij:hover { border-color: var(--accent-red) !important; }
        .leden-item:hover, .leden-check:hover { background: var(--bg-card-hover) !important; }
        .leden-primair:hover { background: var(--accent-red-hover) !important; }
      }
      @media (prefers-reduced-motion: reduce) { .leden-spin { animation: none; } }
    `}</style>
  );
}

// ── Dropdown-menu ───────────────────────────────────────────────────────────
const knop = {
  display: 'inline-flex', alignItems: 'center', gap: '8px',
  padding: '0 14px', minHeight: '44px', background: 'var(--bg-card)',
  border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', fontWeight: '500',
  cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
};
const paneel = {
  position: 'absolute', top: 'calc(100% + 6px)', zIndex: 40,
  maxWidth: 'min(92vw, 360px)', maxHeight: '60vh', overflowY: 'auto',
  background: 'var(--bg-card)', border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)', padding: '6px',
};
const badge = {
  minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '10px',
  background: 'var(--accent-red)', color: '#fff', fontSize: 'var(--font-size-xs)',
  fontWeight: '700', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

/**
 * Knop met uitklappaneel. Sluit op buitenklik en Escape.
 * children mag een functie zijn: ({ close }) => JSX.
 * paneelRol: 'menu' (acties) of 'dialog' (bv. checklist).
 */
export function Menu({
  label, ariaLabel, icoon, aantal = 0, align = 'left', breedte = 220, paneelRol = 'menu', children,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const knopRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const buiten = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const toets = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        knopRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', buiten);
    document.addEventListener('touchstart', buiten);
    document.addEventListener('keydown', toets);
    return () => {
      document.removeEventListener('mousedown', buiten);
      document.removeEventListener('touchstart', buiten);
      document.removeEventListener('keydown', toets);
    };
  }, [open]);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={knopRef}
        type="button"
        className="leden-focus"
        style={knop}
        aria-haspopup={paneelRol}
        aria-expanded={open}
        aria-label={ariaLabel || undefined}
        onClick={() => setOpen(o => !o)}
      >
        {icoon}
        {label && <span>{label}</span>}
        {aantal > 0 && <span style={badge}>{aantal}</span>}
        {label && <IcoonChevron size={16} />}
      </button>
      {open && (
        <div
          role={paneelRol}
          style={{ ...paneel, minWidth: breedte, [align === 'right' ? 'right' : 'left']: 0 }}
        >
          {typeof children === 'function' ? children({ close }) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onClick, close, titel, children }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="leden-item leden-focus"
      title={titel}
      onClick={() => { if (close) close(); onClick(); }}
      style={{
        display: 'block', width: '100%', textAlign: 'left', padding: '0 12px',
        minHeight: '44px', background: 'transparent', border: 'none',
        borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
        fontSize: 'var(--font-size-md)', cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}
