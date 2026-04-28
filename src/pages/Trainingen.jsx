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
  doc, setDoc, addDoc, deleteDoc, serverTimestamp, getDoc, updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { C } from '../components/trainingen/tokens';
import {
  bepaalSeizoen,
  huidigSeizoen,
  vandaagISO,
  formatDatum,
  trainingsId,
  beschikbareSeizoenStartJaren,
  huidigSeizoenStartJaar,
} from '../components/trainingen/seizoenHelpers';
import LesgeversPanel from '../components/trainingen/LesgeversPanel';
import { TechniekAccordeonLijst } from '../components/trainingen/TechniekAccordeon';

// ─── Gedeelde helpers ──────────────────────────────────────────────────────────
function splitPlus(waarde) {
  return String(waarde || '').split('+').map(s => s.trim()).filter(Boolean);
}

function parseDatumTijdzone(raw) {
  if (raw instanceof Date) {
    const y = raw.getFullYear();
    const m = String(raw.getMonth() + 1).padStart(2, '0');
    const d = String(raw.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === 'number') {
    const d = window.XLSX?.SSF?.parse_date_code?.(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const parts = s.split(/[-/]/);
    if (parts.length === 3 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
    }
  }
  return null;
}

const GEEN_TRAINING_MARKERS = [
  'geen training', 'prov. training', 'provinciale training',
  'judoweekend', 'tornooi', 'vakantie', 'sporthal gesloten', 'ceremonie',
];

function isGeenTrainingTekst(tekst) {
  const l = tekst.toLowerCase();
  return GEEN_TRAINING_MARKERS.some(m => l.includes(m));
}

// ─── Japanse techniek matching ─────────────────────────────────────────────────
const JAPANSE_SYNONIEMEN = {
  'seoi': 'seo', 'seio': 'seo', 'shio': 'shiho',
  'katame': 'gatame', 'goruma': 'guruma', 'geruma': 'guruma',
  'sasai': 'sasae', 'ippon seo': 'ippon seoi',
};

function normaliseerTechniek(s) {
  let n = s.toLowerCase().replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [fout, correct] of Object.entries(JAPANSE_SYNONIEMEN)) {
    n = n.replace(new RegExp('\\b' + fout + '\\b', 'g'), correct);
  }
  return n;
}

function matchTechniek(invoer, databank) {
  if (!invoer) return null;
  const b = normaliseerTechniek(invoer);
  const bWoorden = new Set(b.split(' '));
  for (const t of databank) {
    if (normaliseerTechniek(t.techniek) === b) return t;
  }
  for (const t of databank) {
    const aWoorden = new Set(normaliseerTechniek(t.techniek).split(' '));
    if (aWoorden.size >= 2 && [...aWoorden].every(w => bWoorden.has(w))) return t;
  }
  for (const t of databank) {
    const aWoorden = new Set(normaliseerTechniek(t.techniek).split(' '));
    if (bWoorden.size >= 2 && [...bWoorden].every(w => aWoorden.has(w))) return t;
  }
  return null;
}

function parseTechniekCel(celWaarde, techniekDatabank) {
  const technieken = [];
  for (const deel of splitPlus(celWaarde)) {
    const kolonIdx = deel.lastIndexOf(':');
    let techniekNaam = deel;
    let fase = 'basis';
    if (kolonIdx > -1) {
      techniekNaam = deel.slice(0, kolonIdx).trim();
      const faseTekst = deel.slice(kolonIdx + 1).trim().toLowerCase();
      if (faseTekst.includes('verdiep')) fase = 'verdieping';
    }
    if (!techniekNaam || isGeenTrainingTekst(techniekNaam)) continue;
    const gevonden = matchTechniek(techniekNaam, techniekDatabank);
    technieken.push({
      techniekNaam: gevonden ? gevonden.techniek : techniekNaam,
      techniekId: gevonden?.id || null,
      fase,
      basisvaardigheid: '',
    });
  }
  return technieken;
}

// ─── Parser 1: Groep 3 stijl ───────────────────────────────────────────────────
function parseGroep3Stijl(rows, techniekDatabank) {
  const parsed = [];
  const datumRijIndices = rows.reduce((acc, row, idx) => {
    if (String(row[0] || '').trim().toLowerCase() === 'datum') acc.push(idx);
    return acc;
  }, []);

  for (const datumRijIdx of datumRijIndices) {
    const datumRij    = rows[datumRijIdx];
    const techniekRij = rows[datumRijIdx + 2];
    const doelRij     = rows[datumRijIdx + 3];
    const ukemiRij    = rows[datumRijIdx + 4];

    for (let kolIdx = 1; kolIdx <= 8; kolIdx++) {
      const datumRaw = datumRij[kolIdx];
      if (!datumRaw) continue;
      const datum = parseDatumTijdzone(datumRaw);
      if (!datum) continue;

      const techniekRaw = String(techniekRij?.[kolIdx] || '').trim();
      const doel        = String(doelRij?.[kolIdx] || '').trim();
      const ukemi       = String(ukemiRij?.[kolIdx] || '').trim();
      const opmerking   = doel || '';

      if (!techniekRaw || isGeenTrainingTekst(techniekRaw)) {
        parsed.push({ datum, basisvaardigheid: '', opmerking: isGeenTrainingTekst(techniekRaw) ? techniekRaw : opmerking, techniekNaam: '', techniekId: null, fase: 'basis', lesgevers: [], ukemi, alleenDatum: true });
        continue;
      }

      const technieken = parseTechniekCel(techniekRaw, techniekDatabank);
      if (technieken.length === 0) {
        parsed.push({ datum, opmerking, basisvaardigheid: '', techniekNaam: techniekRaw, techniekId: null, fase: 'basis', lesgevers: [], ukemi, alleenDatum: false });
      } else {
        technieken.forEach((t, i) => {
          parsed.push({ datum, basisvaardigheid: ukemi, opmerking: i === 0 ? opmerking : '', techniekNaam: t.techniekNaam, techniekId: t.techniekId, fase: t.fase, lesgevers: [], ukemi, alleenDatum: false });
        });
      }
    }
  }
  return parsed;
}

// ─── Parser 2: U13 stijl ──────────────────────────────────────────────────────
function parseU13Stijl(rows, techniekDatabank) {
  const parsed = [];
  const dataRijen = rows.slice(2).filter(r => r[0]);

  for (const rij of dataRijen) {
    const datum = parseDatumTijdzone(rij[0]);
    if (!datum) continue;

    const basisvaardigheidRaw = String(rij[1] || '').trim();
    const techniekRaw         = String(rij[2] || '').trim();
    const faseRaw             = String(rij[3] || '').trim().toLowerCase();
    const lesgeversRaw        = String(rij[4] || '').trim();
    const opmerking           = String(rij[5] || '').trim();

    const lesgevers = splitPlus(lesgeversRaw).filter(l =>
      l.toLowerCase() !== 'nvt' && l.toLowerCase() !== '-'
    );

    if (!techniekRaw || isGeenTrainingTekst(techniekRaw) || isGeenTrainingTekst(opmerking)) {
      parsed.push({ datum, basisvaardigheid: '', opmerking: opmerking || techniekRaw, techniekNaam: '', techniekId: null, fase: 'basis', lesgevers, alleenDatum: true });
      continue;
    }

    const techniekNamen     = splitPlus(techniekRaw);
    const basisvaardigheden = splitPlus(basisvaardigheidRaw);
    const fasen             = splitPlus(faseRaw);

    for (let i = 0; i < Math.max(techniekNamen.length, 1); i++) {
      const techniekNaam     = techniekNamen[i] || '';
      const basisvaardigheid = basisvaardigheden[i] || basisvaardigheden[0] || '';
      const faseWaarde       = fasen[i] || fasen[0] || '';

      let fase = 'basis';
      if (faseWaarde === 'verdieping' || faseWaarde === 'v') fase = 'verdieping';
      else if (techniekNaam.toLowerCase().includes('verdieping')) fase = 'verdieping';

      const gevonden = techniekNaam ? matchTechniek(techniekNaam, techniekDatabank) : null;
      parsed.push({
        datum, basisvaardigheid,
        opmerking: i === 0 ? opmerking : '',
        techniekNaam: gevonden ? gevonden.techniek : techniekNaam,
        techniekId: gevonden?.id || null,
        fase,
        lesgevers: i === 0 ? lesgevers : [],
        alleenDatum: false,
      });
    }
  }
  return parsed;
}

// ─── ExcelUpload ───────────────────────────────────────────────────────────────
function ExcelUpload({ groepen, technieken, onClose, onSuccess }) {
  const [geselecteerdeGroep, setGeselecteerdeGroep] = useState('');
  const [preview, setPreview] = useState(null);
  const [bezig, setBezig]     = useState(false);
  const [fout, setFout]       = useState('');

  const parseExcel = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const isGroep3Stijl = rows.length > 2 &&
          String(rows[1]?.[0] || '').trim().toLowerCase() === 'dag' &&
          String(rows[2]?.[0] || '').trim().toLowerCase() === 'datum';
        const result = isGroep3Stijl
          ? parseGroep3Stijl(rows, technieken)
          : parseU13Stijl(rows, technieken);
        setPreview(result);
        setFout('');
      } catch (err) {
        setFout('Fout bij inlezen: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Programma training', '', '', '', '', ''],
      ['Datum', 'Basisvaardigheid', 'Techniek', 'Fase', 'Lesgever', 'Opmerking'],
      ['2025-09-06', 'Buig-strek', 'Seo Nage', 'basis', 'Sofie', ''],
      ['2025-09-06', '', 'O Soto Gari', 'verdieping', 'Sofie + Dario', ''],
      ['2025-09-13', 'Buig-strek', 'Seo Nage + Tai Otoshi', 'basis + basis', 'Dario', ''],
      ['2025-09-20', '', '', '', 'Nvt', 'Sporthal gesloten'],
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, 'trainingen_template.xlsx');
  };

  const importeren = async () => {
    if (!preview || !geselecteerdeGroep) return;
    setBezig(true);
    try {
      const perDatum = {};
      for (const r of preview) {
        if (!perDatum[r.datum]) {
          perDatum[r.datum] = { opmerking: r.opmerking, lesgevers: r.lesgevers || [], technieken: [], alleenDatum: r.alleenDatum };
        }
        if (r.lesgevers?.length) {
          const bestaandeLesgevers = new Set(perDatum[r.datum].lesgevers);
          r.lesgevers.forEach(l => bestaandeLesgevers.add(l));
          perDatum[r.datum].lesgevers = Array.from(bestaandeLesgevers);
        }
        if (!r.alleenDatum) {
          perDatum[r.datum].technieken.push(r);
          perDatum[r.datum].alleenDatum = false;
        }
      }

      // Haal duurMinuten op van de groep
      const groepDoc = await getDoc(doc(db, 'groepen', geselecteerdeGroep));
      const duurMinuten = groepDoc.data()?.duurMinuten || 60;

      for (const [datum, data] of Object.entries(perDatum)) {
        const trainId  = trainingsId(geselecteerdeGroep, datum);
        const trainRef = doc(db, 'trainingen', trainId);
        const bestaand = await getDoc(trainRef);

        if (!bestaand.exists()) {
          await setDoc(trainRef, {
            groepId: geselecteerdeGroep,
            datum,
            opmerking: data.opmerking || '',
            lesgevers: data.lesgevers || [],
            seizoen: bepaalSeizoen(datum),
            duurMinuten,                        // ← nieuw: duur van de groep
            duurOverschreven: false,            // ← nieuw: false = van groep overgenomen
            techniekBadges: data.technieken.map(t => ({ naam: t.techniekNaam, fase: t.fase })),
            aangemaakt: serverTimestamp(),
            bijgewerkt: serverTimestamp(),
          });
        } else {
          // Merge: oefenvormen nooit overschrijven, lesgevers samenvoegen
          const bestaandeData = bestaand.data();
          const bestaandeLesgevers = new Set(bestaandeData.lesgevers || []);
          (data.lesgevers || []).forEach(l => bestaandeLesgevers.add(l));

          await setDoc(trainRef, {
            ...bestaandeData,
            opmerking: data.opmerking || bestaandeData.opmerking || '',
            lesgevers: Array.from(bestaandeLesgevers),
            techniekBadges: data.technieken.length > 0
              ? data.technieken.map(t => ({ naam: t.techniekNaam, fase: t.fase }))
              : bestaandeData.techniekBadges || [],
            bijgewerkt: serverTimestamp(),
          });
        }

        if (!data.alleenDatum && data.technieken.length > 0) {
          for (let i = 0; i < data.technieken.length; i++) {
            const t = data.technieken[i];
            if (!t.techniekNaam && !t.techniekId && !t.basisvaardigheid) continue;
            await addDoc(collection(db, 'trainingen', trainId, 'technieken'), {
              basisvaardigheid: t.basisvaardigheid || '',
              techniekId: t.techniekId || '',
              techniekNaam: t.techniekNaam || '',
              fase: t.fase || 'basis',
              volgorde: i,
            });
          }
        }
      }

      onSuccess('Import voltooid');
      onClose();
    } catch (e) {
      setFout('Import mislukt: ' + e.message);
    } finally {
      setBezig(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: C.card, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '580px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>📥 Excel importeren</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textSec, fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Groep</label>
        <select value={geselecteerdeGroep} onChange={e => setGeselecteerdeGroep(e.target.value)}
          style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: geselecteerdeGroep ? C.textPrimary : C.textMuted, fontSize: '14px', marginBottom: '16px' }}>
          <option value="">— Kies groep —</option>
          {groepen.map(g => <option key={g.id} value={g.id}>{g.naam} ({g.dag})</option>)}
        </select>

        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseExcel(f); }}
          style={{ border: `2px dashed ${C.border}`, borderRadius: '10px', padding: '24px', textAlign: 'center', marginBottom: '16px', cursor: 'pointer' }}
          onClick={() => document.getElementById('excel-input').click()}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📂</div>
          <div style={{ fontSize: '14px', color: C.textSec }}>Klik of sleep een Excel-bestand</div>
          <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '4px' }}>.xlsx of .xls</div>
          <input id="excel-input" type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) parseExcel(e.target.files[0]); }} />
        </div>

        <button onClick={downloadTemplate}
          style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
          📄 Template downloaden
        </button>

        {fout && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', borderRadius: '8px', padding: '10px', color: '#e74c3c', fontSize: '14px', marginBottom: '14px' }}>
            {fout}
          </div>
        )}

        {preview && (
          <div style={{ background: C.bg, borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px' }}>
              Preview: {preview.filter(r => !r.alleenDatum).length} technieken in {new Set(preview.map(r => r.datum)).size} trainingen
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[...new Set(preview.map(r => r.datum))].slice(0, 10).map(datum => {
                const rijen = preview.filter(r => r.datum === datum);
                const technieken = rijen.filter(r => !r.alleenDatum && r.techniekNaam);
                return (
                  <div key={datum} style={{ fontSize: '12px', color: C.textSec, padding: '4px 8px', background: C.card, borderRadius: '6px' }}>
                    <span style={{ color: C.textPrimary, fontWeight: '600' }}>{datum}</span>
                    {technieken.length > 0 ? (' — ' + technieken.map(t => t.techniekNaam).join(', ')) : (' — ' + (rijen[0]?.opmerking || 'geen techniek'))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '14px' }}>
            Annuleren
          </button>
          <button onClick={importeren} disabled={!preview || !geselecteerdeGroep || bezig}
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', color: '#fff', background: preview && geselecteerdeGroep ? C.red : '#444', cursor: preview && geselecteerdeGroep ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '700', opacity: bezig ? 0.6 : 1 }}>
            {bezig ? 'Bezig...' : '📥 Importeren'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TrainingFormulier v2.0 ────────────────────────────────────────────────────
// Wijzigingen: duurMinuten veld toegevoegd (manueel aanpasbaar), lesgever-beheer vereenvoudigd
function TrainingFormulier({ groepId, datum, trainingsData, technieken, lesgeversLijst, onClose, onSaved, groepen }) {
  const [opmerking, setOpmerking]           = useState(trainingsData?.opmerking || '');
  const [gekozenDatum, setGekozenDatum]     = useState(datum);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const [bezig, setBezig]                   = useState(false);
  const [fout, setFout]                     = useState('');
  const [lesgevers, setLesgevers]           = useState(trainingsData?.lesgevers || []);
  const [duurMinuten, setDuurMinuten]       = useState(trainingsData?.duurMinuten || '');
  const trainId = trainingsId(groepId, gekozenDatum);

  // Laad standaard duur van groep als nieuwe training
  useEffect(() => {
    if (trainingsData || !groepId) return;
    const groep = groepen?.find(g => g.id === groepId);
    if (groep?.duurMinuten) setDuurMinuten(groep.duurMinuten);
  }, [groepId, groepen, trainingsData]);

  useEffect(() => {
    if (!trainingsData) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    getDocs(query(ref, orderBy('volgorde'))).then(snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [trainId, trainingsData]);

  const voegTechniekToe = () => {
    setTechnieksLijst(prev => [...prev, {
      id: `nieuw_${Date.now()}`, basisvaardigheid: '', techniekId: '', techniekNaam: '',
      fase: 'basis', volgorde: prev.length, isNieuw: true,
    }]);
  };

  const updateTechniek = (idx, veld, waarde) => {
    setTechnieksLijst(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      if (veld === 'techniekId') {
        const gevonden = technieken.find(tk => tk.id === waarde);
        if (gevonden) {
          return { ...t, techniekId: waarde, techniekNaam: gevonden.techniek, basisvaardigheid: t.basisvaardigheid || gevonden.basisvoorwaarden?.[0] || '', _heeftVerdieping: !!(gevonden.verdieping?.length) };
        }
        return { ...t, techniekId: waarde, techniekNaam: '' };
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
    if (!gekozenDatum) { setFout('Kies een datum.'); return; }
    const datumVroeger = new Date(gekozenDatum) < new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    if (datumVroeger && !window.confirm(`De datum ${formatDatum(gekozenDatum)} ligt meer dan een jaar in het verleden. Toch opslaan?`)) return;
    setBezig(true); setFout('');
    try {
      const duurInt = parseInt(duurMinuten) || 60;
      // Bepaal of duur manueel overschreven werd
      const groep = groepen?.find(g => g.id === groepId);
      const duurOverschreven = groep ? duurInt !== (groep.duurMinuten || 60) : true;

      await setDoc(doc(db, 'trainingen', trainId), {
        groepId, datum: gekozenDatum, opmerking, lesgevers,
        seizoen: bepaalSeizoen(gekozenDatum),
        duurMinuten: duurInt,
        duurOverschreven,
        techniekBadges: technieksLijst.filter(t => t.techniekNaam).map(t => ({ naam: t.techniekNaam, fase: t.fase })),
        aangemaakt: trainingsData ? trainingsData.aangemaakt : serverTimestamp(),
        bijgewerkt: serverTimestamp(),
      }, { merge: true });

      for (let i = 0; i < technieksLijst.length; i++) {
        const t = technieksLijst[i];
        if (!t.techniekNaam && !t.techniekId && !t.basisvaardigheid) continue;
        const data = { basisvaardigheid: t.basisvaardigheid || '', techniekId: t.techniekId || '', techniekNaam: t.techniekNaam || '', fase: t.fase || 'basis', volgorde: i };
        if (t.isNieuw) { await addDoc(collection(db, 'trainingen', trainId, 'technieken'), data); }
        else { await setDoc(doc(db, 'trainingen', trainId, 'technieken', t.id), data); }
      }
      onSaved(); onClose();
    } catch (e) {
      setFout('Opslaan mislukt: ' + e.message);
    } finally { setBezig(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: C.card, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '580px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
            {trainingsData ? '✏️ Bewerken' : '+ Nieuwe training'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textSec, fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {fout && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', borderRadius: '8px', padding: '10px', color: '#e74c3c', fontSize: '14px', marginBottom: '14px' }}>
            {fout}
          </div>
        )}

        {/* Datum */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Datum {trainingsData && <span style={{ fontSize: '11px', fontWeight: '400' }}>(niet wijzigbaar)</span>}
        </label>
        <input type="date" value={gekozenDatum}
          onChange={e => !trainingsData && setGekozenDatum(e.target.value)}
          readOnly={!!trainingsData}
          style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${trainingsData ? C.border : C.red}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box', opacity: trainingsData ? 0.6 : 1 }}
        />

        {/* Duur — manueel aanpasbaar, future-proof */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Duur (minuten)
          <span style={{ fontSize: '11px', fontWeight: '400', marginLeft: '6px' }}>standaard van groep</span>
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {[45, 60, 90, 120].map(min => (
            <button key={min} onClick={() => setDuurMinuten(min)}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: duurMinuten == min ? C.redDim : C.bg, border: `1px solid ${duurMinuten == min ? C.red : C.border}`, color: duurMinuten == min ? C.red : C.textSec }}>
              {min}min
            </button>
          ))}
          <input type="number" value={duurMinuten} onChange={e => setDuurMinuten(e.target.value)}
            placeholder="Ander"
            style={{ width: '80px', padding: '8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px', textAlign: 'center' }}
          />
        </div>

        {/* Opmerking */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Opmerking (optioneel)</label>
        <input type="text" value={opmerking} onChange={e => setOpmerking(e.target.value)}
          placeholder="Bv. tornooi, sporthal gesloten..."
          style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '18px', boxSizing: 'border-box' }}
        />

        {/* Lesgevers */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lesgevers</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select value="" onChange={e => { if (e.target.value) setLesgevers(prev => [...new Set([...prev, e.target.value])]); }}
            style={{ flex: 1, padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px' }}>
            <option value="">— Voeg lesgever toe —</option>
            {lesgeversLijst.filter(l => !lesgevers.includes(l.naam)).map(l => (
              <option key={l.id} value={l.naam}>{l.naam}</option>
            ))}
          </select>
        </div>
        {lesgevers.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {lesgevers.map(l => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 10px', borderRadius: '999px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontWeight: '600' }}>
                {l}
                <button onClick={() => setLesgevers(prev => prev.filter(x => x !== l))}
                  style={{ background: 'transparent', border: 'none', color: C.purple, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>×</button>
              </span>
            ))}
          </div>
        )}

        {/* Technieken */}
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
                style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>🗑</button>
            </div>
            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Basisvaardigheid</label>
            <input type="text" value={t.basisvaardigheid} onChange={e => updateTechniek(idx, 'basisvaardigheid', e.target.value)}
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
            {/* Vrij invulveld als techniek niet in databank staat */}
            {!t.techniekId && (
              <input type="text" value={t.techniekNaam} onChange={e => updateTechniek(idx, 'techniekNaam', e.target.value)}
                placeholder="Of vrij invullen..."
                style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px solid ${C.orange}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
              />
            )}
            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Fase</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['basis', 'verdieping'].map(fase => (
                <button key={fase} onClick={() => updateTechniek(idx, 'fase', fase)}
                  style={{ flex: 1, padding: '7px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: t.fase === fase ? (fase === 'basis' ? C.blueDim : C.redDim) : C.card, border: `1px solid ${t.fase === fase ? (fase === 'basis' ? C.blue : C.red) : C.border}`, color: t.fase === fase ? (fase === 'basis' ? C.blue : C.red) : C.textMuted }}>
                  {fase}
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
            style={{ flex: 2, padding: '12px', background: C.red, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '700', opacity: bezig ? 0.6 : 1 }}>
            {bezig ? 'Opslaan...' : '✓ Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
