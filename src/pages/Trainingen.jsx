// src/pages/Trainingen.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, setDoc, addDoc, deleteDoc, serverTimestamp,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── TrainingFormulier ────────────────────────────────────────────────────────
function TrainingFormulier({ groepId, datum, trainingsData, technieken, onClose, onSaved }) {
  const [opmerking, setOpmerking]           = useState(trainingsData?.opmerking || '');
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const [bezig, setBezig]                   = useState(false);
  const [fout, setFout]                     = useState('');
  const trainId = trainingsId(groepId, datum);

  // Laad bestaande technieken van deze training
  useEffect(() => {
    if (!trainingsData) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    getDocs(query(ref, orderBy('volgorde'))).then(snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [trainId, trainingsData]);

  const voegTechniekToe = () => {
    setTechnieksLijst(prev => [...prev, {
      id: `nieuw_${Date.now()}`,
      basisvaardigheid: '', techniekId: '', techniekNaam: '', fase: 'basis',
      volgorde: prev.length, isNieuw: true,
    }]);
  };

  const updateTechniek = (idx, veld, waarde) => {
    setTechnieksLijst(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      if (veld === 'techniekId') {
        const gevonden = technieken.find(tk => tk.id === waarde);
        return { ...t, techniekId: waarde, techniekNaam: gevonden ? gevonden.techniek : '' };
      }
      return { ...t, [veld]: waarde };
    }));
  };

  const verwijderTechniek = async (techniek, idx) => {
    if (!techniek.isNieuw) {
      try { await deleteDoc(doc(db, 'trainingen', trainId, 'technieken', techniek.id)); }
      catch (e) { console.error(e); }
    }
    setTechnieksLijst(prev => prev.filter((_, i) => i !== idx));
  };

  const opslaan = async () => {
    setBezig(true);
    setFout('');
    try {
      await setDoc(doc(db, 'trainingen', trainId), {
        groepId, datum, opmerking,
        aangemaakt: trainingsData ? trainingsData.aangemaakt : serverTimestamp(),
        bijgewerkt: serverTimestamp(),
      }, { merge: true });

      for (let i = 0; i < technieksLijst.length; i++) {
        const t = technieksLijst[i];
        if (!t.techniekNaam && !t.techniekId) continue;
        const data = {
          basisvaardigheid: t.basisvaardigheid || '',
          techniekId: t.techniekId || '',
          techniekNaam: t.techniekNaam || '',
          fase: t.fase || 'basis',
          volgorde: i,
        };
        if (t.isNieuw) {
          await addDoc(collection(db, 'trainingen', trainId, 'technieken'), data);
        } else {
          await setDoc(doc(db, 'trainingen', trainId, 'technieken', t.id), data);
        }
      }
      onSaved();
      onClose();
    } catch (e) {
      setFout('Opslaan mislukt: ' + e.message);
    } finally {
      setBezig(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '16px', overflowY: 'auto',
    }}>
      <div style={{ background: C.card, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '580px', marginTop: '20px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
            {trainingsData ? '✏️ Bewerken' : '+ Nieuwe training'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textSec, fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '16px' }}>{formatDatum(datum)}</div>

        {fout && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', borderRadius: '8px', padding: '10px', color: '#e74c3c', fontSize: '14px', marginBottom: '14px' }}>
            {fout}
          </div>
        )}

        {/* Datum (readonly, beheerd door parent) */}
        {!trainingsData && (
          <>
            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Datum</label>
            <input
              type="date" defaultValue={datum} readOnly
              style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' }}
            />
          </>
        )}

        {/* Opmerking */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Opmerking (optioneel)</label>
        <input
          type="text" value={opmerking}
          onChange={e => setOpmerking(e.target.value)}
          placeholder="Bv. tornooi, sporthal gesloten..."
          style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '18px', boxSizing: 'border-box' }}
        />

        {/* Technieken sectie */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Technieken</span>
          <button onClick={voegTechniekToe}
            style={{ background: C.redDim, border: `1px solid ${C.red}`, color: C.red, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
            + Toevoegen
          </button>
        </div>

        {technieksLijst.length === 0 && (
          <div style={{ color: C.textMuted, fontSize: '14px', padding: '14px', background: C.bg, borderRadius: '8px', textAlign: 'center', marginBottom: '14px' }}>
            Nog geen technieken. Klik "+ Toevoegen".
          </div>
        )}

        {technieksLijst.map((t, idx) => (
          <div key={t.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '600' }}>Techniek {idx + 1}</span>
              <button onClick={() => verwijderTechniek(t, idx)}
                style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                🗑
              </button>
            </div>

            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Basisvaardigheid</label>
            <input type="text" value={t.basisvaardigheid}
              onChange={e => updateTechniek(idx, 'basisvaardigheid', e.target.value)}
              placeholder="Bv. Buig-strek, Yoko-ukemi..."
              style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
            />

            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Techniek</label>
            <select value={t.techniekId} onChange={e => updateTechniek(idx, 'techniekId', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '6px', color: t.techniekId ? C.textPrimary : C.textMuted, fontSize: '13px', marginBottom: '8px' }}>
              <option value="">— Kies techniek uit databank —</option>
              {['Val', 'Houdgreep', 'Verplaatsing', 'Worpen', 'Transitie'].map(type => (
                <optgroup key={type} label={type}>
                  {technieken.filter(tk => tk.type === type).map(tk => (
                    <option key={tk.id} value={tk.id}>{tk.techniek}</option>
                  ))}
                </optgroup>
              ))}
            </select>

            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Fase</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['basis', 'verdieping'].map(f => (
                <button key={f} onClick={() => updateTechniek(idx, 'fase', f)}
                  style={{
                    flex: 1, padding: '7px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                    background: t.fase === f ? (f === 'basis' ? C.blueDim : C.redDim) : C.card,
                    border: `1px solid ${t.fase === f ? (f === 'basis' ? C.blue : C.red) : C.border}`,
                    color: t.fase === f ? (f === 'basis' ? C.blue : C.red) : C.textSec,
                  }}>
                  {f === 'basis' ? '🔵 Basis' : '🔴 Verdieping'}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '14px' }}>
            Annuleren
          </button>
          <button onClick={opslaan} disabled={bezig}
            style={{ flex: 2, padding: '12px', background: C.red, border: 'none', borderRadius: '8px', color: '#fff', cursor: bezig ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: '700', opacity: bezig ? 0.6 : 1 }}>
            {bezig ? 'Opslaan...' : '💾 Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TrainingKaart ────────────────────────────────────────────────────────────
function TrainingKaart({ training, technieken, isBeheerder, onBewerken, onVerwijderen }) {
  const [uitgeklapt, setUitgeklapt]         = useState(false);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const trainId = training.id;

  useEffect(() => {
    if (!uitgeklapt) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [trainId, uitgeklapt]);

  const isVandaag = training.datum === vandaagISO();

  return (
    <div style={{
      background: C.card,
      border: `1.5px solid ${isVandaag ? C.green : C.border}`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setUitgeklapt(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: '700' }}>{formatDatum(training.datum)}</span>
            {isVandaag && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: C.green, background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '999px', padding: '2px 8px' }}>
                Vandaag
              </span>
            )}
          </div>
          {training.opmerking && (
            <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '2px' }}>{training.opmerking}</div>
          )}
        </div>
        <span style={{ color: C.textMuted, fontSize: '12px' }}>{uitgeklapt ? '▲' : '▼'}</span>
      </div>

      {/* Uitgeklapt */}
      {uitgeklapt && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px' }}>
          {technieksLijst.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '12px' }}>Geen technieken ingepland.</div>
          ) : (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                Technieken
              </div>
              {technieksLijst.map(t => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: C.bg, borderRadius: '8px', marginBottom: '6px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', flexShrink: 0,
                    background: t.fase === 'basis' ? C.blueDim : C.redDim,
                    color: t.fase === 'basis' ? C.blue : C.red,
                    border: `1px solid ${t.fase === 'basis' ? C.blue : C.red}`,
                  }}>
                    {t.fase}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: C.textPrimary }}>{t.techniekNaam || '—'}</div>
                    {t.basisvaardigheid && (
                      <div style={{ fontSize: '12px', color: C.textMuted }}>{t.basisvaardigheid}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Placeholder beschikbaarheid — komt in sessie 2c */}
          <div style={{ background: C.bg, borderRadius: '8px', padding: '10px', fontSize: '12px', color: C.textMuted, marginBottom: '12px' }}>
            Beschikbaarheid komt in sessie 2c
          </div>

          {isBeheerder && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onBewerken}
                style={{ flex: 1, padding: '9px', background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', color: C.red, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                ✏️ Bewerken
              </button>
              <button onClick={onVerwijderen}
                style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: C.textMuted, cursor: 'pointer', fontSize: '13px' }}>
                🗑
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Hoofd component ──────────────────────────────────────────────────────────
export default function Trainingen() {
  const { isBeheerder } = useAuth();

  const [groepen, setGroepen]               = useState([]);
  const [trainingen, setTrainingen]         = useState([]);
  const [technieken, setTechnieken]         = useState([]);
  const [actieveGroep, setActieveGroep]     = useState('');
  const [periodeStart, setPeriodeStart]     = useState('');
  const [periodeEinde, setPeriodeEinde]     = useState('');
  const [melding, setMelding]               = useState('');
  const [formulierOpen, setFormulierOpen]   = useState(false);
  const [formulierDatum, setFormulierDatum] = useState('');
  const [formulierTraining, setFormulierTraining] = useState(null);

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

  // Laad technieken uit databank
  useEffect(() => {
    getDocs(collection(db, 'technieken')).then(snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

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

  const openNieuweTraining = () => {
    setFormulierDatum(vandaagISO());
    setFormulierTraining(null);
    setFormulierOpen(true);
  };

  const openBewerken = (training) => {
    setFormulierDatum(training.datum);
    setFormulierTraining(training);
    setFormulierOpen(true);
  };

  const verwijderTraining = async (training) => {
    if (!window.confirm(`Training van ${formatDatum(training.datum)} verwijderen?`)) return;
    try {
      const techSnap = await getDocs(collection(db, 'trainingen', training.id, 'technieken'));
      for (const d of techSnap.docs) await deleteDoc(d.ref);
      const beschSnap = await getDocs(collection(db, 'trainingen', training.id, 'beschikbaarheid'));
      for (const d of beschSnap.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, 'trainingen', training.id));
      toonMelding('Training verwijderd');
    } catch (e) {
      alert('Verwijderen mislukt: ' + e.message);
    }
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
            <button disabled style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textMuted, fontSize: '13px', cursor: 'not-allowed' }}>
              📥 Excel (komt in 2c)
            </button>
            <button
              onClick={openNieuweTraining}
              style={{ padding: '8px 14px', background: C.red, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}
            >
              + Training
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
              Nog geen trainingen ingepland.
              {isBeheerder && (
                <div style={{ marginTop: '12px' }}>
                  <button onClick={openNieuweTraining}
                    style={{ background: C.redDim, border: `1px solid ${C.red}`, color: C.red, padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                    + Eerste training toevoegen
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {gefilterdeTrainingen.map(training => (
                <TrainingKaart
                  key={training.id}
                  training={training}
                  technieken={technieken}
                  isBeheerder={isBeheerder}
                  onBewerken={() => openBewerken(training)}
                  onVerwijderen={() => verwijderTraining(training)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulier modal */}
      {formulierOpen && (
        <TrainingFormulier
          groepId={actieveGroep}
          datum={formulierDatum}
          trainingsData={formulierTraining}
          technieken={technieken}
          onClose={() => setFormulierOpen(false)}
          onSaved={() => toonMelding('Training opgeslagen')}
        />
      )}
    </div>
  );
}
