// src/pages/Trainingen.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// ─── Design tokens ────────────────────────────────────────────────────────────
export const C = {
  bg:          '#1a1a1a',
  card:        '#2d2d2d',
  cardHover:   '#333333',
  border:      '#3a3a3a',
  red:         '#c0392b',
  redHover:    '#a93226',
  redDim:      'rgba(192,57,43,0.15)',
  textPrimary: '#ffffff',
  textSec:     '#aaaaaa',
  textMuted:   '#666666',
  green:       '#27ae60',
  greenDim:    'rgba(39,174,96,0.15)',
  blue:        '#2980b9',
  blueDim:     'rgba(41,128,185,0.15)',
  orange:      '#e67e22',
};

// ─── Helpers (geëxporteerd voor gebruik in sub-componenten sessie 2b/2c) ──────
export function trainingsId(groepId, datum) {
  return `${groepId}_${datum}`;
}

export function formatDatum(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function vandaagISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Hoofd component ──────────────────────────────────────────────────────────
export default function Trainingen() {
  const { isBeheerder } = useAuth();

  const [groepen, setGroepen]       = useState([]);
  const [trainingen, setTrainingen] = useState([]);
  const [actieveGroep, setActieveGroep] = useState('');
  const [periodeStart, setPeriodeStart] = useState('');
  const [periodeEinde, setPeriodeEinde] = useState('');
  const [melding, setMelding]       = useState('');

  // Laad groepen uit Firestore
  useEffect(() => {
    getDocs(collection(db, 'groepen')).then(snap => {
      const g = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.naam.localeCompare(b.naam));
      setGroepen(g);
      if (g.length > 0) setActieveGroep(g[0].id);
    });
  }, []);

  // Laad trainingen voor actieve groep
  useEffect(() => {
    if (!actieveGroep) return;
    const q = query(
      collection(db, 'trainingen'),
      where('groepId', '==', actieveGroep),
      orderBy('datum', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [actieveGroep]);

  // Filter op periode
  const gefilterdeTrainingen = trainingen.filter(t => {
    if (periodeStart && t.datum < periodeStart) return false;
    if (periodeEinde && t.datum > periodeEinde) return false;
    return true;
  });

  const toonMelding = (tekst) => {
    setMelding(tekst);
    setTimeout(() => setMelding(''), 3000);
  };

  const actieveGroepData = groepen.find(g => g.id === actieveGroep);

  return (
    <div style={{ color: C.textPrimary, paddingBottom: '40px' }}>

      {/* Melding toast */}
      {melding && (
        <div style={{
          position: 'fixed', top: '70px', right: '16px', zIndex: 300,
          background: C.green, color: '#fff', padding: '10px 16px',
          borderRadius: '10px', fontSize: '14px', fontWeight: '600',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        }}>
          ✓ {melding}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' }}>
          🥋 Trainingsplanning
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>
          Overzicht technieken per groep per training
        </p>
      </div>

      {/* Groep tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {groepen.map(g => (
          <button
            key={g.id}
            onClick={() => setActieveGroep(g.id)}
            style={{
              padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
              fontSize: '13px', fontWeight: '600',
              background: actieveGroep === g.id ? C.red : C.card,
              border: `1px solid ${actieveGroep === g.id ? C.red : C.border}`,
              color: actieveGroep === g.id ? '#fff' : C.textSec,
            }}
          >
            {g.naam} <span style={{ fontSize: '11px', opacity: 0.7 }}>({g.dag})</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        <input
          type="date" value={periodeStart}
          onChange={e => setPeriodeStart(e.target.value)}
          style={{ padding: '8px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px' }}
        />
        <span style={{ color: C.textMuted }}>→</span>
        <input
          type="date" value={periodeEinde}
          onChange={e => setPeriodeEinde(e.target.value)}
          style={{ padding: '8px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px' }}
        />
        {(periodeStart || periodeEinde) && (
          <button onClick={() => { setPeriodeStart(''); setPeriodeEinde(''); }}
            style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px' }}>
            ✕
          </button>
        )}
        <div style={{ flex: 1 }} />
        {isBeheerder && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Placeholder knoppen — worden ingevuld in sessie 2b */}
            <button disabled style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textMuted, fontSize: '13px', cursor: 'not-allowed' }}>
              📥 Excel (komt in 2c)
            </button>
            <button disabled style={{ padding: '8px 14px', background: '#444', border: 'none', borderRadius: '8px', color: C.textMuted, fontSize: '13px', cursor: 'not-allowed' }}>
              + Training (komt in 2b)
            </button>
          </div>
        )}
      </div>

      {/* Trainingen lijst */}
      {actieveGroepData && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
            {actieveGroepData.naam} — {actieveGroepData.dag} — {gefilterdeTrainingen.length} training(en)
          </div>

          {gefilterdeTrainingen.length === 0 ? (
            <div style={{ background: C.card, borderRadius: '12px', padding: '32px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>
              Nog geen trainingen ingepland voor deze groep.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {gefilterdeTrainingen.map(training => (
                <div key={training.id} style={{ background: C.card, border: `1.5px solid ${training.datum === vandaagISO() ? C.green : C.border}`, borderRadius: '12px', padding: '14px 16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '15px' }}>{formatDatum(training.datum)}</div>
                  {training.opmerking && <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>{training.opmerking}</div>}
                  <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '6px' }}>
                    Technieken worden zichtbaar in sessie 2b
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
