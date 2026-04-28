// src/pages/Trainingen.jsx
// ─── TRAININGEN v2.0 ──────────────────────────────────────────────────────────
// Wijzigingen t.o.v. v1:
//  • Trainers kunnen zichzelf toevoegen/verwijderen van trainingen
//  • beschikbaarheid-subcollectie afgeschaft → één bron: lesgevers[]
//  • duurMinuten staat op groep (of manueel overschreven per training)
//  • Export bevat lesgevers-kolom + duur
//  • Seizoensextractie: alle groepen, per datum, met technieken
//  • Tarieven-systeem via Firestore (geen hardcoded bedragen)
//  • Minst hardcoded mogelijk: alles configureerbaar via Beheer

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { C } from '../components/trainingen/tokens';
import {
  vandaagISO,
  formatDatum,
  beschikbareSeizoenStartJaren,
  huidigSeizoenStartJaar,
} from '../components/trainingen/seizoenHelpers';
import LesgeversPanel from '../components/trainingen/LesgeversPanel';
import { TechniekAccordeonLijst } from '../components/trainingen/TechniekAccordeon';
import ExcelUpload from '../components/trainingen/ExcelUpload';
import TrainingFormulier from '../components/trainingen/TrainingFormulier';

// ─── TrainingKaart v2.0 ────────────────────────────────────────────────────────
function TrainingKaart({ training, technieken, groepen, isBeheerder, profiel, lesgeversLijst, selectieModus, isGeselecteerd, isVolgende, onToggleSelectie, onBewerken, onVerwijderen }) {
  const [uitgeklapt, setUitgeklapt]         = useState(false);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const trainId = training.id;

  useEffect(() => {
    if (training.techniekBadges?.length > 0) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [trainId]);

  useEffect(() => {
    if (!uitgeklapt) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [trainId, uitgeklapt]);

  const isVandaag = training.datum === vandaagISO();
  const duurLabel = training.duurMinuten
    ? (training.duurMinuten >= 60
        ? `${Math.floor(training.duurMinuten / 60)}u${training.duurMinuten % 60 ? (training.duurMinuten % 60) + 'min' : ''}`
        : `${training.duurMinuten}min`)
    : null;

  return (
    <div id={`training-${training.id}`}
      style={{ background: C.card, border: `1.5px solid ${isVandaag ? C.green : isVolgende ? C.orange : C.border}`, borderRadius: '12px', overflow: 'hidden' }}>

      {/* Header */}
      <div onClick={() => selectieModus ? onToggleSelectie() : setUitgeklapt(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', background: isGeselecteerd ? 'rgba(192,57,43,0.08)' : 'transparent' }}>
        {selectieModus && (
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, background: isGeselecteerd ? C.red : 'transparent', border: `2px solid ${isGeselecteerd ? C.red : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isGeselecteerd && <span style={{ color: '#fff', fontSize: '12px', lineHeight: 1 }}>✓</span>}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: '700' }}>{formatDatum(training.datum)}</span>
            {(() => {
              const groep = groepen?.find(g => g.id === training.groepId);
              if (!groep) return null;
              const kort = groep.naam.replace('Groep ', '').replace('groep ', '');
              return (
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: '#2a2a3a', border: '1px solid #4a4a6a', color: '#9a9aba' }}>
                  {kort}
                </span>
              );
            })()}
            {duurLabel && (
              <span style={{ fontSize: '11px', color: C.textMuted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '2px 8px' }}>
                {duurLabel} {training.duurOverschreven && '✎'}
              </span>
            )}
            {isVandaag && <span style={{ fontSize: '11px', fontWeight: '700', color: C.green, background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '999px', padding: '2px 8px' }}>Vandaag</span>}
            {isVolgende && !isVandaag && <span style={{ fontSize: '11px', fontWeight: '700', color: C.orange, background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: '999px', padding: '2px 8px' }}>Volgende</span>}
          </div>
          {training.opmerking && <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '2px' }}>{training.opmerking}</div>}
          {training.lesgevers?.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {training.lesgevers.map(l => (
                <span key={l} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontWeight: '600' }}>
                  {l}
                </span>
              ))}
            </div>
          )}
          {/* Technieken badges */}
          {(() => {
            const badges = training.techniekBadges?.length > 0
              ? training.techniekBadges
              : technieksLijst.map(t => ({ naam: t.techniekNaam, fase: t.fase }));
            if (!badges.length) return null;
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {badges.map((t, i) => (
                  <span key={i} style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600', background: t.fase === 'basis' ? C.blueDim : t.fase === 'verdieping' ? C.redDim : '#2a2a2a', border: `1px solid ${t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.border}`, color: t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.textMuted }}>
                    {t.naam || '—'}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
        <span style={{ color: C.textMuted, fontSize: '12px' }}>{uitgeklapt ? '▲' : '▼'}</span>
      </div>

      {/* Uitgeklapt */}
      {uitgeklapt && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px' }}>
          <TechniekAccordeonLijst technieksLijst={technieksLijst} techniekDatabank={technieken} />

          {/* LesgeversPanel v2.0 — vervangt BeschikbaarheidPanel */}
          <LesgeversPanel
            training={training}
            profiel={profiel}
            isBeheerder={isBeheerder}
            lesgeversLijst={lesgeversLijst}
          />

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

// ─── Seizoensextractie ─────────────────────────────────────────────────────────
// Exporteert alle trainingen van het seizoen over alle groepen
async function exporteerSeizoen(seizoen, groepen) {
  const rows = [
    [`Seizoensextractie ${seizoen}`, '', '', '', '', '', ''],
    ['Datum', 'Groep', 'Duur (min)', 'Lesgevers', 'Techniek', 'Fase', 'Opmerking'],
  ];

  const snap = await getDocs(query(
    collection(db, 'trainingen'),
    where('seizoen', '==', seizoen),
    orderBy('datum', 'asc'),
  ));

  for (const d of snap.docs) {
    const t = d.data();
    const groep = groepen.find(g => g.id === t.groepId);
    const groepNaam = groep?.naam || t.groepId;
    const lesgeversStr = (t.lesgevers || []).join(' + ');
    const duur = t.duurMinuten || '';

    const techSnap = await getDocs(query(collection(db, 'trainingen', d.id, 'technieken'), orderBy('volgorde')));
    const techs = techSnap.docs.map(td => td.data());

    if (techs.length === 0) {
      rows.push([t.datum, groepNaam, duur, lesgeversStr, '', '', t.opmerking || '']);
    } else {
      techs.forEach((tech, i) => {
        rows.push([
          i === 0 ? t.datum : '',
          i === 0 ? groepNaam : '',
          i === 0 ? duur : '',
          i === 0 ? lesgeversStr : '',
          tech.techniekNaam || '',
          tech.fase || '',
          i === 0 ? (t.opmerking || '') : '',
        ]);
      });
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Seizoen');
  XLSX.writeFile(wb, `seizoen_${seizoen}_extractie.xlsx`);
}

// ─── Groep export (bestaande functionaliteit, nu met lesgevers + duur) ─────────
async function exporteerGroepExcel(actieveGroepData, gefilterdeTrainingen) {
  const rows = [
    [`Trainingsplanning ${actieveGroepData.naam} (${actieveGroepData.dag})`],
    ['Datum', 'Duur (min)', 'Basisvaardigheid', 'Techniek', 'Fase', 'Lesgevers', 'Opmerking'],
  ];

  for (const training of gefilterdeTrainingen) {
    const techSnap = await getDocs(query(collection(db, 'trainingen', training.id, 'technieken'), orderBy('volgorde')));
    const techs = techSnap.docs.map(d => d.data());
    const lesgeversStr = (training.lesgevers || []).join(' + ');

    if (techs.length === 0) {
      rows.push([training.datum, training.duurMinuten || '', '', '', '', lesgeversStr, training.opmerking || '']);
    } else {
      techs.forEach((t, i) => {
        rows.push([
          i === 0 ? training.datum : '',
          i === 0 ? (training.duurMinuten || '') : '',
          t.basisvaardigheid || '',
          t.techniekNaam || '',
          t.fase || '',
          i === 0 ? lesgeversStr : '',
          i === 0 ? (training.opmerking || '') : '',
        ]);
      });
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 30 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, actieveGroepData.naam);
  XLSX.writeFile(wb, `trainingen_${actieveGroepData.id}_export.xlsx`);
}

// ─── Hoofd component ───────────────────────────────────────────────────────────
export default function Trainingen() {
  const { isBeheerder, profiel } = useAuth();

  const [groepen, setGroepen]                             = useState([]);
  const [trainingen, setTrainingen]                       = useState([]);
  const [technieken, setTechnieken]                       = useState([]);
  const [actieveGroep, setActieveGroep]                   = useState('');
  const [periodeStart, setPeriodeStart]                   = useState('');
  const [periodeEinde, setPeriodeEinde]                   = useState('');
  const [melding, setMelding]                             = useState('');
  const [formulierOpen, setFormulierOpen]                 = useState(false);
  const [formulierDatum, setFormulierDatum]               = useState('');
  const [formulierTraining, setFormulierTraining]         = useState(null);
  const [excelOpen, setExcelOpen]                         = useState(false);
  const [selectieModus, setSelectieModus]                 = useState(false);
  const [geselecteerd, setGeselecteerd]                   = useState(new Set());
  const [actieveSeizoenStart, setActieveSeizoenStart]     = useState(huidigSeizoenStartJaar());
  const actieveSeizoen = `${actieveSeizoenStart}-${actieveSeizoenStart + 1}`;
  const [lesgeversLijst, setLesgeversLijst]               = useState([]);
  const [filterLesgever, setFilterLesgever]               = useState('');
  const [alleTrainingen, setAlleTrainingen]               = useState([]);
  const [seizoensExportBezig, setSeizoenExportBezig]      = useState(false);

  // Laad groepen
  useEffect(() => {
    getDocs(collection(db, 'groepen')).then(snap => {
      const g = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.naam.localeCompare(b.naam));
      setGroepen(g);
      if (g.length > 0) setActieveGroep(g[0].id);
    });
  }, []);

  // Laad trainingen voor actieve groep + seizoen
  useEffect(() => {
    if (!actieveGroep) return;
    const q = query(
      collection(db, 'trainingen'),
      where('groepId', '==', actieveGroep),
      where('seizoen', '==', actieveSeizoen),
      orderBy('datum', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [actieveGroep, actieveSeizoen]);

  // Laad alle trainingen (voor lesgever-filter modus)
  useEffect(() => {
    if (!filterLesgever) { setAlleTrainingen([]); return; }
    const q = query(collection(db, 'trainingen'), where('seizoen', '==', actieveSeizoen), orderBy('datum', 'asc'));
    const unsub = onSnapshot(q, snap => {
      setAlleTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [filterLesgever, actieveSeizoen]);

  // Laad techniekendatabank
  useEffect(() => {
    getDocs(collection(db, 'technieken')).then(snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Laad lesgeverslijst
  useEffect(() => {
    getDocs(collection(db, 'lesgevers')).then(snap => {
      setLesgeversLijst(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.actief !== false)
          .sort((a, b) => a.naam.localeCompare(b.naam))
      );
    });
  }, []);

  const bronTrainingen = filterLesgever ? alleTrainingen : trainingen;
  const gefilterdeTrainingen = bronTrainingen.filter(t => {
    if (periodeStart && t.datum < periodeStart) return false;
    if (periodeEinde && t.datum > periodeEinde) return false;
    if (filterLesgever && !(t.lesgevers || []).includes(filterLesgever)) return false;
    return true;
  });

  const volgendTrainingId = gefilterdeTrainingen.find(t => t.datum >= vandaagISO())?.id || null;

  const toonMelding = useCallback((tekst) => {
    setMelding(tekst);
    setTimeout(() => setMelding(''), 3000);
  }, []);

  const stelPeriodeIn = (type) => {
    const nu = new Date();
    const jaar = nu.getFullYear();
    const maand = nu.getMonth();
    if (type === 'week') {
      const dag = nu.getDay() || 7;
      const maandag = new Date(nu); maandag.setDate(nu.getDate() - dag + 1);
      const zondag = new Date(maandag); zondag.setDate(maandag.getDate() + 6);
      setPeriodeStart(maandag.toISOString().slice(0, 10));
      setPeriodeEinde(zondag.toISOString().slice(0, 10));
    } else if (type === 'maand') {
      setPeriodeStart(new Date(jaar, maand, 1).toISOString().slice(0, 10));
      setPeriodeEinde(new Date(jaar, maand + 1, 0).toISOString().slice(0, 10));
    } else if (type === 'seizoen') {
      const seizoenStart = maand >= 8 ? new Date(jaar, 8, 1) : new Date(jaar - 1, 8, 1);
      const seizoenEinde = new Date(seizoenStart.getFullYear() + 1, 5, 30);
      setPeriodeStart(seizoenStart.toISOString().slice(0, 10));
      setPeriodeEinde(seizoenEinde.toISOString().slice(0, 10));
    } else {
      setPeriodeStart(''); setPeriodeEinde('');
    }
  };

  const openNieuweTraining = () => { setFormulierDatum(vandaagISO()); setFormulierTraining(null); setFormulierOpen(true); };
  const openBewerken = (training) => { setFormulierDatum(training.datum); setFormulierTraining(training); setFormulierOpen(true); };

  const verwijderTraining = async (training) => {
    if (!window.confirm(`Training van ${formatDatum(training.datum)} verwijderen?`)) return;
    try {
      const techSnap = await getDocs(collection(db, 'trainingen', training.id, 'technieken'));
      for (const d of techSnap.docs) await deleteDoc(d.ref);
      await deleteDoc(doc(db, 'trainingen', training.id));
      toonMelding('Training verwijderd');
    } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
  };

  const bulkVerwijder = async () => {
    if (geselecteerd.size === 0) return;
    if (!window.confirm(`${geselecteerd.size} training(en) verwijderen?`)) return;
    const aantal = geselecteerd.size;
    try {
      for (const trainId of geselecteerd) {
        const techSnap = await getDocs(collection(db, 'trainingen', trainId, 'technieken'));
        for (const d of techSnap.docs) await deleteDoc(d.ref);
        await deleteDoc(doc(db, 'trainingen', trainId));
      }
      setGeselecteerd(new Set()); setSelectieModus(false);
      toonMelding(`${aantal} training(en) verwijderd`);
    } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
  };

  const toggleSelectie = (id) => {
    setGeselecteerd(prev => { const nieuw = new Set(prev); if (nieuw.has(id)) nieuw.delete(id); else nieuw.add(id); return nieuw; });
  };

  const actieveGroepData = groepen.find(g => g.id === actieveGroep);

  // Trainer: kan zelf ook een training toevoegen (niet alleen beheerder)
  const magTrainingToevoegen = isBeheerder || !!profiel?.naam;

  return (
    <div style={{ color: C.textPrimary, paddingBottom: '40px' }}>

      {/* Toast melding */}
      {melding && (
        <div style={{ position: 'fixed', top: '70px', right: '16px', zIndex: 300, background: C.green, color: '#fff', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
          ✓ {melding}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' }}>🥋 Trainingsplanning</h1>
        <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>Overzicht technieken per groep per training</p>
      </div>

      {/* Groep tabs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
        {groepen.map(g => (
          <button key={g.id} onClick={() => setActieveGroep(g.id)}
            style={{ padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actieveGroep === g.id ? C.red : C.card, border: `1px solid ${actieveGroep === g.id ? C.red : C.border}`, color: actieveGroep === g.id ? '#fff' : C.textSec }}>
            {g.naam} <span style={{ fontSize: '11px', opacity: 0.7 }}>({g.dag})</span>
          </button>
        ))}
      </div>

      {/* Seizoensselector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seizoen:</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {beschikbareSeizoenStartJaren().map(startJaar => {
            const label = `${startJaar}-${startJaar + 1}`;
            return (
              <button key={startJaar} onClick={() => setActieveSeizoenStart(startJaar)}
                style={{ padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                  background: actieveSeizoenStart === startJaar ? C.red : C.card,
                  border: `1px solid ${actieveSeizoenStart === startJaar ? C.red : C.border}`,
                  color: actieveSeizoenStart === startJaar ? '#fff' : C.textSec }}>
                {label}{startJaar === huidigSeizoenStartJaar() ? ' (huidig)' : ''}
              </button>
            );
          })}
        </div>
        {isBeheerder && (
          <button
            onClick={async () => {
              if (!window.confirm(`Alle trainingen van seizoen ${actieveSeizoen} voor ${actieveGroepData?.naam} verwijderen?`)) return;
              try {
                const snap = await getDocs(query(collection(db, 'trainingen'), where('groepId', '==', actieveGroep), where('seizoen', '==', actieveSeizoen)));
                for (const d of snap.docs) {
                  const techSnap = await getDocs(collection(db, 'trainingen', d.id, 'technieken'));
                  for (const t of techSnap.docs) await deleteDoc(t.ref);
                  await deleteDoc(d.ref);
                }
                toonMelding(`Seizoen ${actieveSeizoen} verwijderd`);
                setActieveSeizoenStart(huidigSeizoenStartJaar());
              } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
            }}
            style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #555', borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '11px', marginLeft: 'auto' }}>
            🗑 Seizoen wissen
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        {/* Periode filters */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[{ label: 'Week', type: 'week' }, { label: 'Maand', type: 'maand' }, { label: 'Seizoen', type: 'seizoen' }, { label: 'Alles', type: 'alles' }].map(({ label, type }) => (
            <button key={type} onClick={() => stelPeriodeIn(type)}
              style={{ padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: C.card, border: `1px solid ${C.border}`, color: C.textSec }}>
              {label}
            </button>
          ))}
        </div>
        <input type="date" value={periodeStart} onChange={e => setPeriodeStart(e.target.value)}
          style={{ padding: '8px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px' }} />
        <span style={{ color: C.textMuted }}>→</span>
        <input type="date" value={periodeEinde} onChange={e => setPeriodeEinde(e.target.value)}
          style={{ padding: '8px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px' }} />
        {(periodeStart || periodeEinde) && (
          <button onClick={() => stelPeriodeIn('alles')}
            style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px' }}>✕</button>
        )}

        {/* Lesgever filter */}
        <select value={filterLesgever} onChange={e => setFilterLesgever(e.target.value)}
          style={{ padding: '8px 10px', background: C.card, border: `1px solid ${filterLesgever ? C.purple : C.border}`, borderRadius: '8px', color: filterLesgever ? C.purple : C.textSec, fontSize: '13px', cursor: 'pointer' }}>
          <option value="">👤 Alle lesgevers</option>
          {lesgeversLijst.map(l => <option key={l.id} value={l.naam}>{l.naam}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {/* Vandaag / Volgende */}
        <button
          onClick={() => {
            const vandaag = vandaagISO();
            const bron = filterLesgever ? alleTrainingen.filter(t => (t.lesgevers || []).includes(filterLesgever)) : trainingen;
            const doel = bron.find(t => t.datum === vandaag) || bron.find(t => t.datum > vandaag);
            if (!doel) { toonMelding('Geen toekomstige training gevonden'); return; }
            setPeriodeStart(''); setPeriodeEinde(''); setFilterLesgever('');
            setTimeout(() => { const el = document.getElementById(`training-${doel.id}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 100);
          }}
          style={{ padding: '8px 14px', background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '8px', color: C.green, cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
          📅 Vandaag / Volgende
        </button>

        {/* Admin acties */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {isBeheerder && (
            <>
              <button onClick={() => setExcelOpen(true)}
                style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                📥 Import
              </button>
              <button onClick={async () => {
                setSeizoenExportBezig(true);
                try { await exporteerGroepExcel(actieveGroepData, gefilterdeTrainingen); toonMelding('Export klaar'); }
                catch (e) { alert('Export mislukt: ' + e.message); }
                finally { setSeizoenExportBezig(false); }
              }}
                style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                📤 Export
              </button>
              <button onClick={async () => {
                setSeizoenExportBezig(true);
                try { await exporteerSeizoen(actieveSeizoen, groepen); toonMelding('Seizoensextractie klaar'); }
                catch (e) { alert('Extractie mislukt: ' + e.message); }
                finally { setSeizoenExportBezig(false); }
              }} disabled={seizoensExportBezig}
                style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600', opacity: seizoensExportBezig ? 0.6 : 1 }}>
                📊 Seizoen
              </button>
            </>
          )}
          {/* Trainers mogen ook training toevoegen */}
          {magTrainingToevoegen && (
            <button onClick={openNieuweTraining}
              style={{ padding: '8px 14px', background: C.red, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
              + Training
            </button>
          )}
        </div>
      </div>

      {/* Trainingen lijst */}
      {actieveGroepData && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {filterLesgever
                ? `${filterLesgever} — alle groepen — ${gefilterdeTrainingen.length} training(en)`
                : `${actieveGroepData.naam} — ${actieveGroepData.dag} — ${gefilterdeTrainingen.length} training(en)`}
            </div>
            {isBeheerder && gefilterdeTrainingen.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectieModus ? (
                  <>
                    <span style={{ fontSize: '12px', color: C.textMuted }}>{geselecteerd.size} geselecteerd</span>
                    <button onClick={bulkVerwijder} disabled={geselecteerd.size === 0}
                      style={{ padding: '5px 12px', background: geselecteerd.size > 0 ? 'rgba(231,76,60,0.15)' : 'transparent', border: `1px solid ${geselecteerd.size > 0 ? '#e74c3c' : C.border}`, borderRadius: '6px', color: geselecteerd.size > 0 ? '#e74c3c' : C.textMuted, cursor: geselecteerd.size > 0 ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '600' }}>
                      🗑 Verwijder ({geselecteerd.size})
                    </button>
                    <button onClick={() => { setSelectieModus(false); setGeselecteerd(new Set()); }}
                      style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '12px' }}>
                      Annuleren
                    </button>
                  </>
                ) : (
                  <button onClick={() => setSelectieModus(true)}
                    style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '12px' }}>
                    ☑ Selecteren
                  </button>
                )}
              </div>
            )}
          </div>

          {gefilterdeTrainingen.length === 0 ? (
            <div style={{ background: C.card, borderRadius: '12px', padding: '32px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>
              Nog geen trainingen ingepland.
              {magTrainingToevoegen && (
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
                  groepen={groepen}
                  isBeheerder={isBeheerder}
                  profiel={profiel}
                  lesgeversLijst={lesgeversLijst}
                  selectieModus={selectieModus}
                  isGeselecteerd={geselecteerd.has(training.id)}
                  isVolgende={training.id === volgendTrainingId}
                  onToggleSelectie={() => toggleSelectie(training.id)}
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
          lesgeversLijst={lesgeversLijst}
          groepen={groepen}
          onClose={() => setFormulierOpen(false)}
          onSaved={() => toonMelding('Training opgeslagen')}
        />
      )}

      {/* Excel modal */}
      {excelOpen && (
        <ExcelUpload
          groepen={groepen}
          technieken={technieken}
          onClose={() => setExcelOpen(false)}
          onSuccess={toonMelding}
        />
      )}
    </div>
  );
}
