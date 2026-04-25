// src/pages/Trainingen.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, setDoc, addDoc, deleteDoc, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

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
  purple:      '#8e44ad',
  purpleDim:   'rgba(142,68,173,0.15)',
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

export function bepaalSeizoen(datumISO) {
  if (!datumISO) return null;
  const d = new Date(datumISO + 'T00:00:00');
  const jaar = d.getFullYear();
  const maand = d.getMonth();
  return maand >= 8 ? `${jaar}-${jaar + 1}` : `${jaar - 1}-${jaar}`;
}

export function huidigSeizoen() {
  return bepaalSeizoen(new Date().toISOString().slice(0, 10));
}

// ─── Gedeelde helpers ─────────────────────────────────────────────────────────
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

// ─── Japanse techniek matching ────────────────────────────────────────────────
const JAPANSE_SYNONIEMEN = {
  'seoi': 'seo',
  'seio': 'seo',
  'shio': 'shiho',
  'katame': 'gatame',
  'goruma': 'guruma',
  'geruma': 'guruma',
  'sasai': 'sasae',
  'ippon seo': 'ippon seoi',
};

function normaliseerTechniek(s) {
  let n = s.toLowerCase()
    .replace(/[-–_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const [fout, correct] of Object.entries(JAPANSE_SYNONIEMEN)) {
    const re = new RegExp('\\b' + fout + '\\b', 'g');
    n = n.replace(re, correct);
  }
  return n;
}

function matchTechniek(invoer, databank) {
  if (!invoer) return null;
  const b = normaliseerTechniek(invoer);
  const bWoorden = new Set(b.split(' '));

  // 1. Exacte match na normalisatie
  for (const t of databank) {
    if (normaliseerTechniek(t.techniek) === b) return t;
  }
  // 2. Invoer bevat alle woorden van databank-naam
  for (const t of databank) {
    const aWoorden = new Set(normaliseerTechniek(t.techniek).split(' '));
    if (aWoorden.size >= 2 && [...aWoorden].every(w => bWoorden.has(w))) return t;
  }
  // 3. Databank-naam bevat alle woorden van invoer
  for (const t of databank) {
    const aWoorden = new Set(normaliseerTechniek(t.techniek).split(' '));
    if (bWoorden.size >= 2 && [...bWoorden].every(w => aWoorden.has(w))) return t;
  }
  return null;
}

function parseTechniekCel(celWaarde, techniekDatabank) {
  const technieken = [];
  const delen = splitPlus(celWaarde);

  for (const deel of delen) {
    const kolonIdx = deel.lastIndexOf(':');
    let techniekNaam = deel;
    let fase = 'basis';

    if (kolonIdx > -1) {
      techniekNaam = deel.slice(0, kolonIdx).trim();
      const faseTekst = deel.slice(kolonIdx + 1).trim().toLowerCase();
      if (faseTekst.includes('verdiep')) fase = 'verdieping';
      else if (faseTekst.includes('basis')) fase = 'basis';
    }

    if (!techniekNaam || isGeenTrainingTekst(techniekNaam)) continue;

    const gevonden = matchTechniek(techniekNaam, techniekDatabank);

    technieken.push({
      techniekNaam: gevonden ? gevonden.techniek : techniekNaam,
      techniekId:   gevonden?.id || null,
      fase,
      basisvaardigheid: '',
    });
  }
  return technieken;
}

// ─── Parser 1: Groep 3 stijl (kolommen = trainingen) ─────────────────────────
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
        parsed.push({
          datum,
          basisvaardigheid: '',
          opmerking: isGeenTrainingTekst(techniekRaw) ? techniekRaw : opmerking,
          techniekNaam: '',
          techniekId: null,
          fase: 'basis',
          lesgevers: [],
          ukemi,
          alleenDatum: true,
        });
        continue;
      }

      const technieken = parseTechniekCel(techniekRaw, techniekDatabank);

      if (technieken.length === 0) {
        parsed.push({
          datum, opmerking,
          basisvaardigheid: '',
          techniekNaam: techniekRaw,
          techniekId: null,
          fase: 'basis',
          lesgevers: [],
          ukemi,
          alleenDatum: false,
        });
      } else {
        technieken.forEach((t, i) => {
          parsed.push({
            datum,
            basisvaardigheid: ukemi,
            opmerking: i === 0 ? opmerking : '',
            techniekNaam: t.techniekNaam,
            techniekId: t.techniekId,
            fase: t.fase,
            lesgevers: [],
            ukemi,
            alleenDatum: false,
          });
        });
      }
    }
  }

  return parsed;
}

// ─── Parser 2: U13 stijl (rijen = trainingen) ────────────────────────────────
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
      parsed.push({
        datum,
        basisvaardigheid: '',
        opmerking: opmerking || techniekRaw,
        techniekNaam: '',
        techniekId: null,
        fase: 'basis',
        lesgevers,
        alleenDatum: true,
      });
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

// ─── ExcelUpload ──────────────────────────────────────────────────────────────
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

        // Groep3-stijl: kolom A rij 2 = "Dag", rij 3 = "Datum"
        // U13-stijl:    rij 1 = titel, rij 2 = headers met "Datum" in kolom A
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
      // Groepeer per datum
      const perDatum = {};
      for (const r of preview) {
        if (!perDatum[r.datum]) {
          perDatum[r.datum] = {
            opmerking: r.opmerking,
            lesgevers: r.lesgevers || [],
            technieken: [],
            alleenDatum: r.alleenDatum,
          };
        }
        // Lesgevers samenvoegen (uniek)
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

      for (const [datum, data] of Object.entries(perDatum)) {
        const trainId = trainingsId(geselecteerdeGroep, datum);
        const trainRef = doc(db, 'trainingen', trainId);
        const bestaand = await getDoc(trainRef);

        if (!bestaand.exists()) {
          await setDoc(trainRef, {
            groepId: geselecteerdeGroep,
            datum,
            opmerking: data.opmerking || '',
            lesgevers: data.lesgevers || [],
            seizoen: bepaalSeizoen(datum),
            techniekBadges: data.technieken.map(t => ({ naam: t.techniekNaam, fase: t.fase })),
            aangemaakt: serverTimestamp(),
            bijgewerkt: serverTimestamp(),
          });
        } else {
          // Bestaande technieken verwijderen (overschrijven)
          const oudeSnap = await getDocs(collection(db, 'trainingen', trainId, 'technieken'));
          for (const d of oudeSnap.docs) await deleteDoc(d.ref);
          await setDoc(trainRef, {
            bijgewerkt: serverTimestamp(),
            lesgevers: data.lesgevers || [],
            seizoen: bepaalSeizoen(datum),
            ...(data.opmerking ? { opmerking: data.opmerking } : {}),
          }, { merge: true });
        }

        // Sla technieken op (niet voor alleenDatum rijen)
        if (!data.alleenDatum) {
          for (let i = 0; i < data.technieken.length; i++) {
            const t = data.technieken[i];
            await addDoc(collection(db, 'trainingen', trainId, 'technieken'), {
              basisvaardigheid: t.basisvaardigheid || t.ukemi || '',
              techniekId:       t.techniekId || '',
              techniekNaam:     t.techniekNaam || '',
              fase:             t.fase || 'basis',
              volgorde:         i,
            });
          }
        }
      }

      onSuccess(`${Object.keys(perDatum).length} trainingen geïmporteerd`);
      onClose();
    } catch (err) {
      setFout('Importfout: ' + err.message);
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
      <div style={{ background: C.card, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '520px', marginTop: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>📥 Excel importeren</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textSec, fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {fout && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', borderRadius: '8px', padding: '10px', color: '#e74c3c', fontSize: '14px', marginBottom: '14px' }}>
            {fout}
          </div>
        )}

        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Voor welke groep?</label>
        <select value={geselecteerdeGroep} onChange={e => setGeselecteerdeGroep(e.target.value)}
          style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '14px' }}>
          <option value="">— Kies groep —</option>
          {groepen.map(g => (
            <option key={g.id} value={g.id}>{g.naam} ({g.dag})</option>
          ))}
        </select>

        <div style={{ marginBottom: '14px' }}>
          <p style={{ color: C.textSec, fontSize: '13px', margin: '0 0 8px' }}>
            De app herkent automatisch twee Excel-formaten:
          </p>
          <ul style={{ color: C.textMuted, fontSize: '12px', margin: '0 0 8px', paddingLeft: '16px' }}>
            <li><strong style={{ color: C.textSec }}>Standaard template</strong> (rijen = trainingen): Datum | Basisvaardigheid | Techniek | Fase | Lesgever | Opmerking</li>
            <li><strong style={{ color: C.textSec }}>Groep 3 stijl</strong> (kolommen = trainingen): kolom A = veldnamen (Dag/Datum/Techniek...), kolommen B-I = data per trainingsdag</li>
          </ul>
          <p style={{ color: C.textMuted, fontSize: '11px', margin: '0 0 8px' }}>
            Meerdere technieken of lesgevers in één cel: scheiden met <strong>+</strong> (bv. "Seo Nage + O Soto Gari").<br/>
            Fase staat na ":" in de techniekcel (bv. "Seo Nage: verdieping") of in de Fase-kolom.
          </p>
          <button onClick={downloadTemplate}
            style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.textSec, padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
            📄 Download template
          </button>
        </div>

        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Excel bestand</label>
        <input type="file" accept=".xlsx,.xls"
          onChange={e => e.target.files[0] && parseExcel(e.target.files[0])}
          style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box' }}
        />

        {preview && (
          <div style={{ marginBottom: '14px' }}>
            <p style={{ color: C.green, fontSize: '13px', fontWeight: '600', margin: '0 0 8px' }}>
              ✓ {preview.length} rij(en) herkend
            </p>
            <div style={{ maxHeight: '180px', overflowY: 'auto', background: C.bg, borderRadius: '8px', padding: '10px' }}>
              {preview.slice(0, 8).map((r, i) => (
                <div key={i} style={{ fontSize: '12px', color: C.textSec, padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ color: C.textMuted }}>{r.datum}</span> — {r.techniekNaam}
                  {!r.techniekId && <span style={{ color: C.orange, marginLeft: '6px' }}>⚠ niet in databank</span>}
                </div>
              ))}
              {preview.length > 8 && <div style={{ color: C.textMuted, fontSize: '12px', paddingTop: '4px' }}>...en {preview.length - 8} meer</div>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '14px' }}>
            Annuleren
          </button>
          <button onClick={importeren} disabled={!preview || !geselecteerdeGroep || bezig}
            style={{
              flex: 1, padding: '12px', border: 'none', borderRadius: '8px', color: '#fff',
              background: preview && geselecteerdeGroep ? C.red : '#444',
              cursor: preview && geselecteerdeGroep ? 'pointer' : 'not-allowed',
              fontSize: '14px', fontWeight: '700', opacity: bezig ? 0.6 : 1,
            }}>
            {bezig ? 'Bezig...' : '📥 Importeren'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BeschikbaarheidPanel ─────────────────────────────────────────────────────
function BeschikbaarheidPanel({ trainId, datum, profiel, isBeheerder, alleUsers }) {
  const [beschikbaarheid, setBeschikbaarheid] = useState([]);

  useEffect(() => {
    if (!trainId) return;
    const unsub = onSnapshot(
      collection(db, 'trainingen', trainId, 'beschikbaarheid'),
      snap => setBeschikbaarheid(snap.docs.map(d => ({ uid: d.id, ...d.data() })))
    );
    return unsub;
  }, [trainId]);

  const stelIn = async (uid, naam, status) => {
    await setDoc(doc(db, 'trainingen', trainId, 'beschikbaarheid', uid), {
      naam, status, tijdstip: serverTimestamp(),
    });
  };

  const statusKleur = (s) => ({ bevestigd: C.green, afwezig: '#e74c3c', onbekend: C.textMuted }[s] || C.textMuted);
  const statusLabel = (s) => ({ bevestigd: '✓ Aanwezig', afwezig: '✗ Afwezig', onbekend: '? Onbekend' }[s] || '?');

  const eigeneStatus = beschikbaarheid.find(b => b.uid === profiel?.uid)?.status || 'onbekend';
  const isVerleden = datum && datum < vandaagISO();

  return (
    <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        Beschikbaarheid
      </div>

      {isVerleden ? (
        beschikbaarheid.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '6px' }}>Aanwezigheid:</div>
            {beschikbaarheid.map(b => (
              <div key={b.uid} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
                <span style={{ color: C.textSec }}>{b.naam}</span>
                <span style={{ color: statusKleur(b.status), fontWeight: '600', fontSize: '12px' }}>{statusLabel(b.status)}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Eigen status */}
          <div style={{ marginBottom: isBeheerder ? '12px' : '0' }}>
            <div style={{ fontSize: '12px', color: C.textSec, marginBottom: '6px' }}>Jouw status:</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['bevestigd', 'afwezig'].map(s => (
                <button key={s}
                  onClick={() => stelIn(profiel.uid, profiel.naam || profiel.email, s)}
                  style={{
                    flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                    background: eigeneStatus === s ? (s === 'bevestigd' ? C.greenDim : 'rgba(231,76,60,0.15)') : C.card,
                    border: `1px solid ${eigeneStatus === s ? statusKleur(s) : C.border}`,
                    color: eigeneStatus === s ? statusKleur(s) : C.textSec,
                  }}>
                  {s === 'bevestigd' ? '✓ Aanwezig' : '✗ Afwezig'}
                </button>
              ))}
            </div>
          </div>

          {/* Beheerder: overzicht + invullen voor anderen */}
          {isBeheerder && (
            <>
              {beschikbaarheid.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '6px' }}>Overzicht:</div>
                  {beschikbaarheid.map(b => (
                    <div key={b.uid} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: `1px solid ${C.border}`, fontSize: '13px' }}>
                      <span style={{ color: C.textSec }}>{b.naam}</span>
                      <span style={{ color: statusKleur(b.status), fontWeight: '600', fontSize: '12px' }}>{statusLabel(b.status)}</span>
                    </div>
                  ))}
                </div>
              )}
              {alleUsers.filter(u => u.uid !== profiel?.uid).length > 0 && (
                <div>
                  <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '6px' }}>Invullen voor andere lesgevers:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {alleUsers.filter(u => u.uid !== profiel?.uid).map(u => {
                      const status = beschikbaarheid.find(b => b.uid === u.uid)?.status || 'onbekend';
                      return (
                        <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ flex: 1, fontSize: '12px', color: C.textSec }}>{u.naam || u.email}</span>
                          {['bevestigd', 'afwezig'].map(s => (
                            <button key={s}
                              onClick={() => stelIn(u.uid, u.naam || u.email, s)}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: '600',
                                background: status === s ? (s === 'bevestigd' ? C.greenDim : 'rgba(231,76,60,0.15)') : C.card,
                                border: `1px solid ${status === s ? statusKleur(s) : C.border}`,
                                color: status === s ? statusKleur(s) : C.textMuted,
                              }}>
                              {s === 'bevestigd' ? '✓' : '✗'}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── TrainingFormulier ────────────────────────────────────────────────────────
function TrainingFormulier({ groepId, datum, trainingsData, technieken, alleUsers, lesgeversLijst, onClose, onSaved }) {
  const [opmerking, setOpmerking]           = useState(trainingsData?.opmerking || '');
  const [gekozenDatum, setGekozenDatum]     = useState(datum);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const [bezig, setBezig]                   = useState(false);
  const [fout, setFout]                     = useState('');
  const [lesgevers, setLesgevers]           = useState(trainingsData?.lesgevers || []);
  const trainId = trainingsId(groepId, gekozenDatum);

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
        if (gevonden) {
          const autoBasis = gevonden.basisvoorwaarden?.[0] || '';
          const autoFase = gevonden.basis_vanaf_kyu ? 'basis' : t.fase;
          return {
            ...t,
            techniekId: waarde,
            techniekNaam: gevonden.techniek,
            basisvaardigheid: t.basisvaardigheid || autoBasis,
            fase: autoFase,
            _heeftVerdieping: !!(gevonden.verdieping?.length),
          };
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
    if (datumVroeger) {
      const ok = window.confirm(`De datum ${formatDatum(gekozenDatum)} ligt meer dan een jaar in het verleden. Toch opslaan?`);
      if (!ok) return;
    }
    setBezig(true);
    setFout('');
    try {
      await setDoc(doc(db, 'trainingen', trainId), {
        groepId, datum: gekozenDatum, opmerking,
        lesgevers,
        seizoen: bepaalSeizoen(gekozenDatum),
        techniekBadges: technieksLijst
          .filter(t => t.techniekNaam)
          .map(t => ({ naam: t.techniekNaam, fase: t.fase })),
        aangemaakt: trainingsData ? trainingsData.aangemaakt : serverTimestamp(),
        bijgewerkt: serverTimestamp(),
      }, { merge: true });

      for (let i = 0; i < technieksLijst.length; i++) {
        const t = technieksLijst[i];
        if (!t.techniekNaam && !t.techniekId && !t.basisvaardigheid) continue;
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

        {/* Datum */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Datum {trainingsData && <span style={{ color: C.textMuted, fontSize: '11px', fontWeight: '400' }}>(niet wijzigbaar)</span>}
        </label>
        <input
          type="date"
          value={gekozenDatum}
          onChange={e => !trainingsData && setGekozenDatum(e.target.value)}
          readOnly={!!trainingsData}
          style={{
            width: '100%', padding: '10px', background: C.bg,
            border: `1px solid ${trainingsData ? C.border : C.red}`,
            borderRadius: '8px', color: C.textPrimary, fontSize: '14px',
            marginBottom: '14px', boxSizing: 'border-box',
            opacity: trainingsData ? 0.6 : 1,
          }}
        />

        {/* Opmerking */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Opmerking (optioneel)</label>
        <input
          type="text" value={opmerking}
          onChange={e => setOpmerking(e.target.value)}
          placeholder="Bv. tornooi, sporthal gesloten..."
          style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '18px', boxSizing: 'border-box' }}
        />

        {/* Lesgevers — dropdown van bekende users */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Lesgevers
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select
            value=""
            onChange={e => {
              if (e.target.value) {
                setLesgevers(prev => [...new Set([...prev, e.target.value])]);
              }
            }}
            style={{ flex: 1, padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px' }}
          >
            <option value="">— Voeg lesgever toe —</option>
            {(lesgeversLijst.length > 0 ? lesgeversLijst : alleUsers.map(u => ({ id: u.uid, naam: u.naam || u.email })))
              .filter(l => !lesgevers.includes(l.naam))
              .map(l => (
                <option key={l.id} value={l.naam}>{l.naam}</option>
              ))
            }
          </select>
        </div>
        {lesgevers.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {lesgevers.map(l => (
              <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 10px', borderRadius: '999px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontWeight: '600' }}>
                {l}
                <button onClick={() => setLesgevers(prev => prev.filter(x => x !== l))}
                  style={{ background: 'transparent', border: 'none', color: C.purple, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

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

            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>
              Fase
              {t._heeftVerdieping === false && (
                <span style={{ marginLeft: '8px', color: C.orange, fontSize: '11px' }}>
                  ⚠ geen verdieping beschikbaar voor deze techniek
                </span>
              )}
            </label>
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

// ─── TechniekAccordeonLijst ───────────────────────────────────────────────────
function TechniekAccordeonItem({ t, detail }) {
  const [open, setOpen] = useState(false);
  const isBasis = t.fase === 'basis';
  const faseKleur = isBasis ? C.blue : C.red;
  const faseBg    = isBasis ? C.blueDim : C.redDim;

  const secties = [];
  if (isBasis && detail?.basisfase?.length)
    secties.push({ label: 'Basisfase', items: detail.basisfase, kleur: C.blue });
  if (!isBasis && detail?.verdieping?.length)
    secties.push({ label: 'Verdieping', items: detail.verdieping, kleur: C.red });
  if (detail?.aandachtspunten?.length)
    secties.push({ label: 'Aandachtspunten', items: detail.aandachtspunten, kleur: C.orange });
  if (detail?.basisvoorwaarden?.length)
    secties.push({ label: 'Basisvoorwaarden', items: detail.basisvoorwaarden, kleur: C.textMuted });
  if (detail?.remediering?.length)
    secties.push({ label: 'Remediering', items: detail.remediering, kleur: C.textMuted });
  if (detail?.oefenvormen?.length)
    secties.push({ label: 'Oefenvormen', items: detail.oefenvormen, kleur: C.green });

  const heeftDetails = secties.length > 0 || t.basisvaardigheid;

  return (
    <div style={{
      background: C.bg, borderRadius: '8px', marginBottom: '6px',
      border: `1px solid ${open ? faseKleur : C.border}`,
      overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      <div
        onClick={() => heeftDetails && setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 12px',
          cursor: heeftDetails ? 'pointer' : 'default',
        }}
      >
        <span style={{
          fontSize: '11px', fontWeight: '700', padding: '2px 8px',
          borderRadius: '6px', flexShrink: 0,
          background: faseBg, color: faseKleur,
          border: `1px solid ${faseKleur}`,
        }}>
          {t.fase || '—'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: C.textPrimary }}>
            {t.techniekNaam || '—'}
            {!detail && t.techniekNaam && (
              <span style={{ fontSize: '11px', color: C.orange, marginLeft: '8px', fontWeight: '400' }}>
                ⚠ niet in databank
              </span>
            )}
          </div>
          {t.basisvaardigheid && !open && (
            <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '1px' }}>
              {t.basisvaardigheid}
            </div>
          )}
        </div>
        {heeftDetails && (
          <span style={{ color: C.textMuted, fontSize: '12px', flexShrink: 0 }}>
            {open ? '▲' : '▼'}
          </span>
        )}
      </div>

      {open && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '10px 12px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {t.basisvaardigheid && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                Basisvaardigheid
              </div>
              <div style={{ fontSize: '13px', color: C.textSec }}>{t.basisvaardigheid}</div>
            </div>
          )}
          {secties.map(sectie => (
            <div key={sectie.label}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: sectie.kleur, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>
                {sectie.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {sectie.items.map((item, i) => (
                  <div key={i} style={{
                    fontSize: '12px', color: C.textSec,
                    padding: '4px 8px', background: C.card,
                    borderRadius: '6px', borderLeft: `3px solid ${sectie.kleur}`,
                  }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TechniekAccordeonLijst({ technieksLijst, techniekDatabank }) {
  if (technieksLijst.length === 0) {
    return (
      <div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '12px' }}>
        Geen technieken ingepland.
      </div>
    );
  }
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
        Technieken
      </div>
      {technieksLijst.map(t => {
        const detail = techniekDatabank?.find(tk => tk.id === t.techniekId);
        return (
          <TechniekAccordeonItem key={t.id} t={t} detail={detail} />
        );
      })}
    </div>
  );
}

// ─── TrainingKaart ────────────────────────────────────────────────────────────
function TrainingKaart({ training, technieken, isBeheerder, profiel, alleUsers, selectieModus, isGeselecteerd, isVolgende, onToggleSelectie, onBewerken, onVerwijderen }) {
  const [uitgeklapt, setUitgeklapt]         = useState(false);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const trainId = training.id;

  // Als er geen gecachede badges zijn, laad subcollectie voor badges in header
  useEffect(() => {
    if (training.techniekBadges?.length > 0) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [trainId]);

  // Laad volledige subcollectie bij uitklap
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
    <div
      id={`training-${training.id}`}
      style={{
        background: C.card,
        border: `1.5px solid ${isVandaag ? C.green : isVolgende ? C.orange : C.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        onClick={() => selectieModus ? onToggleSelectie() : setUitgeklapt(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer',
          background: isGeselecteerd ? 'rgba(192,57,43,0.08)' : 'transparent',
        }}
      >
        {selectieModus && (
          <div style={{
            width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
            background: isGeselecteerd ? C.red : 'transparent',
            border: `2px solid ${isGeselecteerd ? C.red : C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {isGeselecteerd && <span style={{ color: '#fff', fontSize: '12px', lineHeight: 1 }}>✓</span>}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: '700' }}>{formatDatum(training.datum)}</span>
            {isVandaag && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: C.green, background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '999px', padding: '2px 8px' }}>
                Vandaag
              </span>
            )}
            {isVolgende && !isVandaag && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: C.orange, background: 'rgba(230,126,34,0.15)', border: `1px solid ${C.orange}`, borderRadius: '999px', padding: '2px 8px' }}>
                Volgende
              </span>
            )}
          </div>
          {training.opmerking && (
            <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '2px' }}>{training.opmerking}</div>
          )}
          {training.lesgevers?.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {training.lesgevers.map(l => (
                <span key={l} style={{
                  fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
                  background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple,
                  fontWeight: '600',
                }}>
                  {l}
                </span>
              ))}
            </div>
          )}
          {/* Technieken preview — gecached of geladen uit subcollectie */}
          {(() => {
            const badges = training.techniekBadges?.length > 0
              ? training.techniekBadges
              : technieksLijst.map(t => ({ naam: t.techniekNaam, fase: t.fase }));
            if (!badges.length) return null;
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {badges.map((t, i) => (
                  <span key={i} style={{
                    fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600',
                    background: t.fase === 'basis' ? C.blueDim : (t.fase === 'verdieping' ? C.redDim : '#2a2a2a'),
                    border: `1px solid ${t.fase === 'basis' ? C.blue : (t.fase === 'verdieping' ? C.red : C.border)}`,
                    color: t.fase === 'basis' ? C.blue : (t.fase === 'verdieping' ? C.red : C.textMuted),
                  }}>
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
          <TechniekAccordeonLijst
            technieksLijst={technieksLijst}
            techniekDatabank={technieken}
          />

          <BeschikbaarheidPanel
            trainId={trainId}
            datum={training.datum}
            profiel={profiel}
            isBeheerder={isBeheerder}
            alleUsers={alleUsers}
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

// ─── Hoofd component ──────────────────────────────────────────────────────────
export default function Trainingen() {
  const { isBeheerder, profiel } = useAuth();

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
  const [alleUsers, setAlleUsers]           = useState([]);
  const [excelOpen, setExcelOpen]           = useState(false);
  const [selectieModus, setSelectieModus]   = useState(false);
  const [geselecteerd, setGeselecteerd]     = useState(new Set());
  const [actieveSeizoen, setActieveSeizoen]               = useState(huidigSeizoen());
  const [beschikbareSeizoenens, setBeschikbareSeizoenens] = useState([huidigSeizoen()]);
  const [lesgeversLijst, setLesgeversLijst]               = useState([]);
  const [filterLesgever, setFilterLesgever]               = useState('');

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

  // Laad unieke seizoenen voor actieve groep
  useEffect(() => {
    if (!actieveGroep) return;
    getDocs(query(
      collection(db, 'trainingen'),
      where('groepId', '==', actieveGroep)
    )).then(snap => {
      const seizoenen = new Set([huidigSeizoen()]);
      snap.docs.forEach(d => {
        const s = d.data().seizoen;
        if (s) seizoenen.add(s);
      });
      setBeschikbareSeizoenens([...seizoenen].sort().reverse());
    });
  }, [actieveGroep]);

  // Laad trainingen voor actieve groep en seizoen
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

  // Laad technieken uit databank
  useEffect(() => {
    getDocs(collection(db, 'technieken')).then(snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Laad lesgevende users voor beschikbaarheid
  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const lesgevers = users.filter(u =>
        u.rol === 'trainer' || (u.groepen && u.groepen.length > 0)
      );
      setAlleUsers(lesgevers);
    });
  }, []);

  // Laad lesgeverslijst uit Firestore
  useEffect(() => {
    getDocs(collection(db, 'lesgevers')).then(snap => {
      const lijst = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(l => l.actief !== false)
        .sort((a, b) => a.naam.localeCompare(b.naam));
      setLesgeversLijst(lijst);
    });
  }, []);

  // Filter op periode
  const gefilterdeTrainingen = trainingen.filter(t => {
    if (periodeStart && t.datum < periodeStart) return false;
    if (periodeEinde && t.datum > periodeEinde) return false;
    if (filterLesgever && !(t.lesgevers || []).includes(filterLesgever)) return false;
    return true;
  });

  const volgendTrainingId = gefilterdeTrainingen.find(t => t.datum >= vandaagISO())?.id || null;

  const toonMelding = (tekst) => {
    setMelding(tekst);
    setTimeout(() => setMelding(''), 3000);
  };

  const stelPeriodeIn = (type) => {
    const nu = new Date();
    const jaar = nu.getFullYear();
    const maand = nu.getMonth();

    if (type === 'week') {
      const dag = nu.getDay() || 7;
      const maandag = new Date(nu);
      maandag.setDate(nu.getDate() - dag + 1);
      const zondag = new Date(maandag);
      zondag.setDate(maandag.getDate() + 6);
      setPeriodeStart(maandag.toISOString().slice(0, 10));
      setPeriodeEinde(zondag.toISOString().slice(0, 10));
    } else if (type === 'maand') {
      const eerste = new Date(jaar, maand, 1);
      const laatste = new Date(jaar, maand + 1, 0);
      setPeriodeStart(eerste.toISOString().slice(0, 10));
      setPeriodeEinde(laatste.toISOString().slice(0, 10));
    } else if (type === 'seizoen') {
      const seizoenStart = maand >= 8
        ? new Date(jaar, 8, 1)
        : new Date(jaar - 1, 8, 1);
      const seizoenEinde = new Date(seizoenStart.getFullYear() + 1, 5, 30);
      setPeriodeStart(seizoenStart.toISOString().slice(0, 10));
      setPeriodeEinde(seizoenEinde.toISOString().slice(0, 10));
    } else if (type === 'alles') {
      setPeriodeStart('');
      setPeriodeEinde('');
    }
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

  const bulkVerwijder = async () => {
    if (geselecteerd.size === 0) return;
    if (!window.confirm(`${geselecteerd.size} training(en) verwijderen?`)) return;
    const aantalBeforeDelete = geselecteerd.size;
    try {
      for (const trainId of geselecteerd) {
        const training = trainingen.find(t => t.id === trainId);
        if (!training) continue;
        const techSnap = await getDocs(collection(db, 'trainingen', trainId, 'technieken'));
        for (const d of techSnap.docs) await deleteDoc(d.ref);
        const beschSnap = await getDocs(collection(db, 'trainingen', trainId, 'beschikbaarheid'));
        for (const d of beschSnap.docs) await deleteDoc(d.ref);
        await deleteDoc(doc(db, 'trainingen', trainId));
      }
      setGeselecteerd(new Set());
      setSelectieModus(false);
      toonMelding(`${aantalBeforeDelete} training(en) verwijderd`);
    } catch (e) {
      alert('Verwijderen mislukt: ' + e.message);
    }
  };

  const toggleSelectie = (id) => {
    setGeselecteerd(prev => {
      const nieuw = new Set(prev);
      if (nieuw.has(id)) nieuw.delete(id);
      else nieuw.add(id);
      return nieuw;
    });
  };

  const exporteerExcel = async () => {
    if (!actieveGroepData) return;
    try {
      const rows = [
        [`Trainingsplanning ${actieveGroepData.naam} (${actieveGroepData.dag})`],
        ['Datum', 'Basisvaardigheid', 'Techniek', 'Fase', 'Opmerking'],
      ];

      for (const training of gefilterdeTrainingen) {
        const techSnap = await getDocs(
          query(collection(db, 'trainingen', training.id, 'technieken'), orderBy('volgorde'))
        );
        const techs = techSnap.docs.map(d => d.data());

        if (techs.length === 0) {
          rows.push([training.datum, '', '', '', training.opmerking || '']);
        } else {
          techs.forEach((t, i) => {
            rows.push([
              i === 0 ? training.datum : '',
              t.basisvaardigheid || '',
              t.techniekNaam || '',
              t.fase || '',
              i === 0 ? (training.opmerking || '') : '',
            ]);
          });
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, actieveGroepData.naam);
      XLSX.writeFile(wb, `trainingen_${actieveGroepData.id}_export.xlsx`);
      toonMelding('Export klaar');
    } catch (e) {
      alert('Export mislukt: ' + e.message);
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

      {/* Seizoensselector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Seizoen:
        </span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {beschikbareSeizoenens.map(s => (
            <button key={s} onClick={() => setActieveSeizoen(s)}
              style={{
                padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
                background: actieveSeizoen === s ? C.red : C.card,
                border: `1px solid ${actieveSeizoen === s ? C.red : C.border}`,
                color: actieveSeizoen === s ? '#fff' : C.textSec,
              }}>
              {s}
            </button>
          ))}
        </div>
        {isBeheerder && (
          <button
            onClick={async () => {
              if (!window.confirm(`Alle trainingen van seizoen ${actieveSeizoen} voor ${actieveGroepData?.naam} verwijderen? Dit kan niet ongedaan gemaakt worden.`)) return;
              try {
                const snap = await getDocs(query(
                  collection(db, 'trainingen'),
                  where('groepId', '==', actieveGroep),
                  where('seizoen', '==', actieveSeizoen),
                ));
                for (const d of snap.docs) {
                  const techSnap = await getDocs(collection(db, 'trainingen', d.id, 'technieken'));
                  for (const t of techSnap.docs) await deleteDoc(t.ref);
                  const beschSnap = await getDocs(collection(db, 'trainingen', d.id, 'beschikbaarheid'));
                  for (const b of beschSnap.docs) await deleteDoc(b.ref);
                  await deleteDoc(d.ref);
                }
                toonMelding(`Seizoen ${actieveSeizoen} verwijderd`);
                setActieveSeizoen(huidigSeizoen());
              } catch (e) {
                alert('Verwijderen mislukt: ' + e.message);
              }
            }}
            style={{ padding: '5px 12px', background: 'transparent', border: '1px solid #555', borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '11px', marginLeft: 'auto' }}
          >
            🗑 Seizoen wissen
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', alignItems: 'center' }}>
        {/* Snelle filters */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {[
            { label: 'Week', type: 'week' },
            { label: 'Maand', type: 'maand' },
            { label: 'Seizoen', type: 'seizoen' },
            { label: 'Alles', type: 'alles' },
          ].map(({ label, type }) => (
            <button key={type} onClick={() => stelPeriodeIn(type)}
              style={{
                padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                background: C.card, border: `1px solid ${C.border}`, color: C.textSec,
              }}>
              {label}
            </button>
          ))}
        </div>
        {/* Handmatige datums */}
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
          <button onClick={() => stelPeriodeIn('alles')}
            style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '18px' }}>
            ✕
          </button>
        )}
        {/* Zoek op lesgever */}
        <select
          value={filterLesgever}
          onChange={e => setFilterLesgever(e.target.value)}
          style={{
            padding: '8px 10px', background: C.card, border: `1px solid ${filterLesgever ? C.purple : C.border}`,
            borderRadius: '8px', color: filterLesgever ? C.purple : C.textSec, fontSize: '13px', cursor: 'pointer',
          }}
        >
          <option value="">👤 Alle lesgevers</option>
          {lesgeversLijst.map(l => (
            <option key={l.id} value={l.naam}>{l.naam}</option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        {/* Vandaag / Volgende knop */}
        <button
          onClick={() => {
            const vandaag = vandaagISO();
            const doel = trainingen.find(t => t.datum === vandaag)
              || trainingen.find(t => t.datum > vandaag);
            if (!doel) { toonMelding('Geen toekomstige training gevonden'); return; }
            setPeriodeStart('');
            setPeriodeEinde('');
            setFilterLesgever('');
            setTimeout(() => {
              const el = document.getElementById(`training-${doel.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }}
          style={{
            padding: '8px 14px', background: C.greenDim, border: `1px solid ${C.green}`,
            borderRadius: '8px', color: C.green, cursor: 'pointer', fontSize: '13px', fontWeight: '700',
          }}
        >
          📅 Vandaag / Volgende
        </button>
        {isBeheerder && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setExcelOpen(true)}
              style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              📥 Import
            </button>
            <button onClick={exporteerExcel}
              style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
              📤 Export
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
              {actieveGroepData.naam} — {actieveGroepData.dag} — {gefilterdeTrainingen.length} training(en)
            </div>
            {isBeheerder && gefilterdeTrainingen.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectieModus ? (
                  <>
                    <span style={{ fontSize: '12px', color: C.textMuted }}>{geselecteerd.size} geselecteerd</span>
                    <button
                      onClick={bulkVerwijder}
                      disabled={geselecteerd.size === 0}
                      style={{ padding: '5px 12px', background: geselecteerd.size > 0 ? 'rgba(231,76,60,0.15)' : 'transparent', border: `1px solid ${geselecteerd.size > 0 ? '#e74c3c' : C.border}`, borderRadius: '6px', color: geselecteerd.size > 0 ? '#e74c3c' : C.textMuted, cursor: geselecteerd.size > 0 ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '600' }}
                    >
                      🗑 Verwijder ({geselecteerd.size})
                    </button>
                    <button
                      onClick={() => { setSelectieModus(false); setGeselecteerd(new Set()); }}
                      style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '12px' }}
                    >
                      Annuleren
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setSelectieModus(true)}
                    style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '12px' }}
                  >
                    ☑ Selecteren
                  </button>
                )}
              </div>
            )}
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
                  profiel={profiel}
                  alleUsers={alleUsers}
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
          alleUsers={alleUsers}
          lesgeversLijst={lesgeversLijst}
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
