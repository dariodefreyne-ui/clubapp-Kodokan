// src/components/wedstrijden/ResultatenTab.jsx
// Lijst van ingeschreven judoka's met hun resultaat-op-de-dag — tap op een
// judoka om de ResultaatEditor te openen. Zelfde categorie-groepering als
// het Judoka-tabblad.
import React, { useState } from 'react';
import { CAT_RANGORDE } from '../../utils/categorieLogica';
import { C, CATEGORIE_COLORS } from './tokens';
import { samenvatResultaat } from './gewichtscategorieen';
import ResultaatEditor from './ResultaatEditor';

function ResultaatBadge({ ins }) {
  const s = samenvatResultaat(ins.resultaat);
  if (!s.ingevuld) {
    return <span style={{ fontSize: '12px', color: C.textMuted }}>nog geen resultaat</span>;
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
      {s.totaal > 0 && (
        <span style={{ color: C.textSec }}>
          <span style={{ color: C.green, fontWeight: '700' }}>{s.winst}W</span>
          {' / '}
          <span style={{ color: C.red, fontWeight: '700' }}>{s.verlies}V</span>
        </span>
      )}
      {s.eindplaats && (
        <span style={{ background: C.orangeDim, color: C.orange, border: `1px solid ${C.orange}`, borderRadius: '999px', padding: '1px 8px', fontWeight: '700' }}>
          {s.eindplaats}
        </span>
      )}
    </span>
  );
}

export default function ResultatenTab({ inschrijvingenVoorEvent }) {
  const [open, setOpen] = useState(null);
  const [zoek, setZoek] = useState('');

  const actief = inschrijvingenVoorEvent.filter(j => !j.deleted);
  const gefilterd = zoek.trim()
    ? actief.filter(j => j.judokaNaam?.toLowerCase().includes(zoek.toLowerCase()))
    : actief;

  const byCategorie = gefilterd.reduce((acc, j) => {
    const cat = j.categorie || '—';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(j);
    return acc;
  }, {});

  const inputStyle = {
    width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
    color: C.text, padding: '9px 12px', fontSize: '13px', boxSizing: 'border-box',
    fontFamily: 'inherit', outline: 'none', marginBottom: '14px',
  };

  if (actief.length === 0) {
    return <div style={{ color: C.textMuted, textAlign: 'center', padding: '24px', fontSize: '14px' }}>Nog geen judoka ingeschreven.</div>;
  }

  return (
    <div>
      <input
        placeholder="🔍 Zoek judoka op naam..."
        value={zoek}
        onChange={e => setZoek(e.target.value)}
        style={inputStyle}
      />
      {Object.entries(byCategorie)
        .sort(([a], [b]) => [...CAT_RANGORDE, '—'].indexOf(a) - [...CAT_RANGORDE, '—'].indexOf(b))
        .map(([cat, list]) => {
          const cc = CATEGORIE_COLORS[cat] || { bg: C.surface, color: C.textSec, border: C.border };
          return (
            <div key={cat} style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ background: cc.bg, color: cc.color, border: `1px solid ${cc.border}`, padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700' }}>{cat}</span>
                <span style={{ fontSize: '12px', color: C.textMuted }}>{list.length} judoka</span>
              </div>
              {list.map(j => (
                <div key={j.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(open === j.id ? null : j.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
                      padding: '9px 12px', background: C.surface, borderRadius: '8px', marginBottom: open === j.id ? 0 : '5px',
                      border: `1px solid ${C.border}`, cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: C.redDim, border: `1px solid ${C.redBord}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: C.red, flexShrink: 0 }}>
                      {(j.judokaNaam || '?').charAt(0).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, fontSize: '14px', color: C.text }}>{j.judokaNaam}</span>
                    <ResultaatBadge ins={j} />
                    <span style={{ color: C.textMuted, fontSize: '12px' }}>{open === j.id ? '▲' : '▼'}</span>
                  </button>
                  {open === j.id && (
                    <div style={{ marginBottom: '5px' }}>
                      <ResultaatEditor ins={j} onClose={() => setOpen(null)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
    </div>
  );
}
