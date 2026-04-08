// src/pages/Technieken.jsx
// Stap 2: filterbar + uitklapbare TechniekCards
// Leesbaar voor beheerder én trainer — bewerken komt in stap 3 (beheerder only)

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// ─── Design tokens (exact uit spec) ──────────────────────────────────────────
const C = {
  bg:        '#1a1a1a',
  card:      '#2d2d2d',
  cardHover: '#333333',
  border:    '#3a3a3a',
  red:       '#c0392b',
  redDim:    'rgba(192,57,43,0.15)',
  textPrimary: '#ffffff',
  textSec:   '#aaaaaa',
  textMuted: '#666666',
  green:     '#27ae60',
  greenDim:  'rgba(39,174,96,0.15)',
};

// ─── Kyu gordel kleuren (exact uit spec) ─────────────────────────────────────
const KYU_COLORS = {
  '6': { label: 'Wit (6e)',    bg: '#ffffff', color: '#333', border: '1px solid #aaa' },
  '5': { label: 'Geel (5e)',   bg: '#f1c40f', color: '#333' },
  '4': { label: 'Oranje (4e)', bg: '#e67e22', color: '#fff' },
  '3': { label: 'Groen (3e)',  bg: '#27ae60', color: '#fff' },
  '2': { label: 'Blauw (2e)', bg: '#3498db', color: '#fff' },
  '1': { label: 'Bruin (1e)', bg: '#8B4513', color: '#fff' },
};

const TYPE_OPTIONS = ['Alle', 'Val', 'houdgreep', 'Verplaatsing', 'Worpen', 'Transitie'];

// ─── KyuDot ──────────────────────────────────────────────────────────────────
function KyuDot({ kyu }) {
  const cfg = KYU_COLORS[kyu];
  if (!cfg) return null;
  return (
    <div
      title={cfg.label}
      style={{
        width: '14px', height: '14px', borderRadius: '50%',
        background: cfg.bg,
        border: cfg.border || `1px solid ${cfg.bg}`,
        flexShrink: 0,
      }}
    />
  );
}

// ─── KyuBadge ────────────────────────────────────────────────────────────────
function KyuBadge({ kyu, label }) {
  const cfg = KYU_COLORS[kyu];
  if (!cfg) return null;
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: cfg.border || 'none',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: '700',
      whiteSpace: 'nowrap',
    }}>
      {label || cfg.label}
    </span>
  );
}

// ─── Sectie (in uitgeklapte card) ────────────────────────────────────────────
function Sectie({ titel, items }) {
  if (!items || items.length === 0) {
    return (
      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: C.textMuted, marginBottom: '6px' }}>
          {titel}
        </div>
        <div style={{ color: C.textMuted, fontSize: '13px' }}>—</div>
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: C.textMuted, marginBottom: '6px' }}>
        {titel}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item, i) => (
          <li key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: '6px',
            fontSize: '13px', color: C.textSec, lineHeight: '1.5',
            marginBottom: '3px',
          }}>
            <span style={{ color: C.red, flexShrink: 0, marginTop: '1px' }}>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── TechniekCard ─────────────────────────────────────────────────────────────
function TechniekCard({ techniek, isOpen, onToggle, cardRef }) {
  const [hovered, setHovered] = useState(false);

  const kyuGraden = techniek.kyu_graden || [];

  return (
    <div
      ref={cardRef}
      style={{
        background: isOpen ? C.cardHover : hovered ? C.cardHover : C.card,
        border: `1px solid ${isOpen ? C.red : hovered ? '#555' : C.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
        marginBottom: '8px',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ── Ingeklapte header (altijd zichtbaar) ── */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '12px',
          color: C.textPrimary, fontFamily: 'inherit',
        }}
      >
        {/* Chevron */}
        <span style={{
          fontSize: '12px', color: C.textMuted, flexShrink: 0,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>
          ▶
        </span>

        {/* Naam */}
        <span style={{ fontWeight: '700', fontSize: '15px', flex: 1, textAlign: 'left' }}>
          {techniek.techniek}
        </span>

        {/* Type badge */}
        <span style={{
          background: '#1a1a1a', border: `1px solid ${C.border}`,
          color: C.textSec, padding: '2px 8px', borderRadius: '8px',
          fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {techniek.type}
        </span>

        {/* Kyu bolletjes */}
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {kyuGraden.map(k => <KyuDot key={k} kyu={k} />)}
        </div>
      </button>

      {/* BASIS / VERDIEPING labels (altijd zichtbaar, onder header) */}
      {(techniek.basis_vanaf_kyu || techniek.verdieping_vanaf_kyu) && (
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap',
          paddingLeft: '44px', paddingRight: '16px', paddingBottom: '12px',
          marginTop: '-4px',
        }}>
          {techniek.basis_vanaf_kyu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: C.textMuted }}>BASIS vanaf</span>
              <KyuBadge kyu={techniek.basis_vanaf_kyu} label={`${techniek.basis_vanaf_kyu}e kyu`} />
            </div>
          )}
          {techniek.verdieping_vanaf_kyu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: C.textMuted }}>VERDIEPING vanaf</span>
              <KyuBadge kyu={techniek.verdieping_vanaf_kyu} label={`${techniek.verdieping_vanaf_kyu}e kyu`} />
            </div>
          )}
        </div>
      )}

      {/* ── Uitgeklapte sectie ── */}
      {isOpen && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}>
          <Sectie titel="Basisvoorwaarden"  items={techniek.basisvoorwaarden} />
          <Sectie titel="Basisfase"         items={techniek.basisfase} />
          <Sectie titel="Verdieping"        items={techniek.verdieping} />
          <Sectie titel="Aandachtspunten"   items={techniek.aandachtspunten} />
          <Sectie titel="Remediering"       items={techniek.remediering} />
          <Sectie titel="Oefenvormen"       items={techniek.oefenvormen} />
        </div>
      )}
    </div>
  );
}

// ─── FilterPill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.red : '#1a1a1a',
        border: `1px solid ${active ? C.red : C.border}`,
        color: active ? '#fff' : C.textSec,
        padding: '6px 14px', borderRadius: '20px',
        cursor: 'pointer', fontSize: '13px', fontWeight: active ? '600' : '400',
        whiteSpace: 'nowrap', flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

// ─── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function Technieken() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();

  const [technieken, setTechnieken]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [zoekterm, setZoekterm]       = useState('');
  const [filterType, setFilterType]   = useState('Alle');
  const [filterKyu, setFilterKyu]     = useState('Alle');
  const [openId, setOpenId]           = useState(null);

  // Refs voor scrollen naar techniek via URL ?id=
  const cardRefs = useRef({});

  // ── Toegangscontrole ──────────────────────────────────────────────────────
  if (!role) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Geen toegang</div>
          <div style={{ color: C.textSec, fontSize: '14px' }}>Log in om technieken te bekijken.</div>
        </div>
      </div>
    );
  }

  // ── Firestore live data ───────────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const q = query(
      collection(db, 'technieken'),
      orderBy('type'),
      orderBy('techniek'),
    );
    const unsub = onSnapshot(q, snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      console.error('Fout bij laden technieken:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── URL parameter: ?id=<techniekId> → open + scroll ──────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (!idParam || technieken.length === 0) return;
    setOpenId(idParam);
    // Wacht één tick zodat de card gerenderd is
    setTimeout(() => {
      const el = cardRefs.current[idParam];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [searchParams, technieken]);

  // ── Filterlogica ──────────────────────────────────────────────────────────
  const zichtbaar = technieken.filter(t => {
    if (zoekterm && !t.techniek.toLowerCase().includes(zoekterm.toLowerCase())) return false;
    if (filterType !== 'Alle' && t.type !== filterType) return false;
    if (filterKyu !== 'Alle' && !t.kyu_graden?.includes(filterKyu)) return false;
    return true;
  });

  // Groepeer per type voor sectie-headers
  const groepen = {};
  zichtbaar.forEach(t => {
    if (!groepen[t.type]) groepen[t.type] = [];
    groepen[t.type].push(t);
  });

  return (
    <div style={{ color: C.textPrimary, fontFamily: 'inherit', paddingBottom: '40px' }}>

      {/* ── Paginatitel ── */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800', letterSpacing: '-0.5px' }}>
          🤸 Technieken
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>
          Beheer van judotechnieken per kyu-graad
        </p>
      </div>

      {/* ── Filterbar ── */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Zoekbalk */}
        <input
          type="search"
          placeholder="🔍  Zoek op techniek naam..."
          value={zoekterm}
          onChange={e => setZoekterm(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '10px', color: C.textPrimary,
            padding: '10px 14px', fontSize: '14px',
            outline: 'none', fontFamily: 'inherit',
          }}
        />

        {/* Type filter */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', overflowX: 'auto', paddingBottom: '2px' }}>
          <span style={{ fontSize: '11px', color: C.textMuted, alignSelf: 'center', flexShrink: 0, marginRight: '2px' }}>TYPE:</span>
          {TYPE_OPTIONS.map(t => (
            <FilterPill
              key={t}
              label={t}
              active={filterType === t}
              onClick={() => setFilterType(t)}
            />
          ))}
        </div>

        {/* Kyu filter */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', overflowX: 'auto', paddingBottom: '2px' }}>
          <span style={{ fontSize: '11px', color: C.textMuted, alignSelf: 'center', flexShrink: 0, marginRight: '2px' }}>KYU:</span>
          <FilterPill label="Alle" active={filterKyu === 'Alle'} onClick={() => setFilterKyu('Alle')} />
          {Object.entries(KYU_COLORS).map(([k, cfg]) => (
            <FilterPill
              key={k}
              label={cfg.label}
              active={filterKyu === k}
              onClick={() => setFilterKyu(k)}
            />
          ))}
        </div>
      </div>

      {/* ── Resultaatteller ── */}
      {!loading && (
        <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '16px' }}>
          {zichtbaar.length} {zichtbaar.length === 1 ? 'techniek' : 'technieken'} gevonden
          {(zoekterm || filterType !== 'Alle' || filterKyu !== 'Alle') && (
            <button
              onClick={() => { setZoekterm(''); setFilterType('Alle'); setFilterKyu('Alle'); }}
              style={{
                background: 'none', border: 'none', color: C.red,
                cursor: 'pointer', fontSize: '13px', marginLeft: '10px',
                fontFamily: 'inherit', padding: 0,
              }}
            >
              ✕ Filters wissen
            </button>
          )}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{
            width: '32px', height: '32px',
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.red}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ── Leeg ── */}
      {!loading && zichtbaar.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textSec }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🥋</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
            {technieken.length === 0 ? 'Geen technieken gevonden in de database.' : 'Geen resultaten voor deze filters.'}
          </div>
          {technieken.length === 0 && (
            <div style={{ fontSize: '13px', color: C.textMuted }}>
              De seed wordt automatisch uitgevoerd bij opstarten.
            </div>
          )}
        </div>
      )}

      {/* ── Cards per type-groep ── */}
      {!loading && Object.entries(groepen).map(([type, items]) => (
        <div key={type} style={{ marginBottom: '28px' }}>
          {/* Type sectie-header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              fontSize: '11px', fontWeight: '800', textTransform: 'uppercase',
              letterSpacing: '1.2px', color: C.red,
            }}>
              {type}
            </span>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <span style={{ fontSize: '11px', color: C.textMuted }}>{items.length}</span>
          </div>

          {items.map(t => (
            <TechniekCard
              key={t.id}
              techniek={t}
              isOpen={openId === t.id}
              onToggle={() => setOpenId(prev => prev === t.id ? null : t.id)}
              cardRef={el => { cardRefs.current[t.id] = el; }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
