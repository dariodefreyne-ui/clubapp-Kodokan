// src/components/trainingen/ExcelUpload.jsx
import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';
import { bepaalSeizoen, trainingsId } from './seizoenHelpers';
import {
  getClubSettings,
  DEFAULT_GEEN_TRAINING_MARKERS,
  markersUitSettings,
  isGeenTrainingTekst,
} from '../../services/firestoreService';

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

const JAPANSE_SYNONIEMEN = {
  'seoi': 'seo', 'seio': 'seo', 'shio': 'shiho',
  'katame': 'gatame', 'goruma': 'guruma', 'geruma': 'guruma',
  'sasai': 'sasae', 'ippon seo': 'ippon seoi','gesa':'kesa','tomo':'tomoe','tsuri komi':'tusrikomi'
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

function parseTechniekCel(celWaarde, techniekDatabank, geenTrainingMarkers = DEFAULT_GEEN_TRAINING_MARKERS) {
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
    if (!techniekNaam || isGeenTrainingTekst(techniekNaam, geenTrainingMarkers)) continue;
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

function parseGroep3Stijl(rows, techniekDatabank, geenTrainingMarkers = DEFAULT_GEEN_TRAINING_MARKERS) {
  const parsed = [];
  const datumRijIndices = rows.reduce((acc, row, idx) => {
    if (String(row[0] || '').trim().toLowerCase() === 'datum') acc.push(idx);
    return acc;
  }, []);
  for (const datumRijIdx of datumRijIndices) {
    const datumRij = rows[datumRijIdx];
    const techniekRij = rows[datumRijIdx + 2];
    const doelRij = rows[datumRijIdx + 3];
    const ukemiRij = rows[datumRijIdx + 4];
    for (let kolIdx = 1; kolIdx <= 8; kolIdx++) {
      const datumRaw = datumRij[kolIdx];
      if (!datumRaw) continue;
      const datum = parseDatumTijdzone(datumRaw);
      if (!datum) continue;
      const techniekRaw = String(techniekRij?.[kolIdx] || '').trim();
      const doel = String(doelRij?.[kolIdx] || '').trim();
      const ukemi = String(ukemiRij?.[kolIdx] || '').trim();
      const opmerking = doel || '';
      if (!techniekRaw || isGeenTrainingTekst(techniekRaw, geenTrainingMarkers)) {
        parsed.push({ datum, basisvaardigheid: '', opmerking: isGeenTrainingTekst(techniekRaw, geenTrainingMarkers) ? techniekRaw : opmerking, techniekNaam: '', techniekId: null, fase: 'basis', lesgevers: [], ukemi, alleenDatum: true });
        continue;
      }
      const technieken = parseTechniekCel(techniekRaw, techniekDatabank, geenTrainingMarkers);
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

function parseU13Stijl(rows, techniekDatabank, geenTrainingMarkers = DEFAULT_GEEN_TRAINING_MARKERS) {
  const parsed = [];
  const dataRijen = rows.slice(2).filter(r => r[0]);
  for (const rij of dataRijen) {
    const datum = parseDatumTijdzone(rij[0]);
    if (!datum) continue;
    const basisvaardigheidRaw = String(rij[1] || '').trim();
    const techniekRaw = String(rij[2] || '').trim();
    const faseRaw = String(rij[3] || '').trim().toLowerCase();
    const lesgeversRaw = String(rij[4] || '').trim();
    const opmerking = String(rij[5] || '').trim();
    const lesgevers = splitPlus(lesgeversRaw).filter(l =>
      l.toLowerCase() !== 'nvt' && l.toLowerCase() !== '-'
    );
    if (!techniekRaw || isGeenTrainingTekst(techniekRaw, geenTrainingMarkers) || isGeenTrainingTekst(opmerking, geenTrainingMarkers)) {
      parsed.push({ datum, basisvaardigheid: '', opmerking: opmerking || techniekRaw, techniekNaam: '', techniekId: null, fase: 'basis', lesgevers, alleenDatum: true });
      continue;
    }
    const techniekNamen = splitPlus(techniekRaw);
    const basisvaardigheden = splitPlus(basisvaardigheidRaw);
    const fasen = splitPlus(faseRaw);
    for (let i = 0; i < Math.max(techniekNamen.length, 1); i++) {
      const techniekNaam = techniekNamen[i] || '';
      const basisvaardigheid = basisvaardigheden[i] || basisvaardigheden[0] || '';
      const faseWaarde = fasen[i] || fasen[0] || '';
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

function ExcelUpload({ groepen, technieken, onClose, onSuccess }) {
  const [geselecteerdeGroep, setGeselecteerdeGroep] = useState('');
  const [preview, setPreview] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [geenTrainingMarkers, setGeenTrainingMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);

  useEffect(() => {
    getClubSettings()
      .then(settings => {
        setGeenTrainingMarkers(markersUitSettings(settings));
      })
      .catch(() => setGeenTrainingMarkers(DEFAULT_GEEN_TRAINING_MARKERS));
  }, []);

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
          ? parseGroep3Stijl(rows, technieken, geenTrainingMarkers)
          : parseU13Stijl(rows, technieken, geenTrainingMarkers);
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
      const groepDoc = await getDoc(doc(db, 'groepen', geselecteerdeGroep));
      const groepData = groepDoc.data();
      const duurMinuten = groepData?.duurMinuten || 60;
      const startTijd = groepData?.startTijd || null;
      const eindTijd = groepData?.eindTijd || null;
      for (const [datum, data] of Object.entries(perDatum)) {
        const trainId = trainingsId(geselecteerdeGroep, datum);
        const trainRef = doc(db, 'trainingen', trainId);
        const bestaand = await getDoc(trainRef);
        if (!bestaand.exists()) {
          const trainingDoc = {
            groepId: geselecteerdeGroep,
            datum,
            opmerking: data.opmerking || '',
            lesgevers: data.lesgevers || [],
            seizoen: bepaalSeizoen(datum),
            duurMinuten,
            duurOverschreven: false,
            techniekBadges: data.technieken.map(t => ({ naam: t.techniekNaam, fase: t.fase })),
            aangemaakt: serverTimestamp(),
            bijgewerkt: serverTimestamp(),
          };
          if (startTijd) trainingDoc.startTijd = startTijd;
          if (eindTijd) trainingDoc.eindTijd = eindTijd;
          await setDoc(trainRef, trainingDoc);
        } else {
          const bestaandeData = bestaand.data();
          // Fix: overschrijf lesgevers vanuit Excel i.p.v. samenvoegen (voorkomt duplicaten)
          const nieuweLesgevers = data.lesgevers?.length > 0 ? data.lesgevers : (bestaandeData.lesgevers || []);
          await setDoc(trainRef, {
            ...bestaandeData,
            opmerking: data.opmerking || bestaandeData.opmerking || '',
            lesgevers: nieuweLesgevers,
            techniekBadges: data.technieken.length > 0
              ? data.technieken.map(t => ({ naam: t.techniekNaam, fase: t.fase }))
              : bestaandeData.techniekBadges || [],
            bijgewerkt: serverTimestamp(),
          });
        }
        if (!data.alleenDatum && data.technieken.length > 0) {
          // Verwijder eerst alle bestaande technieken (fix: voorkomt duplicaten bij herhaalde import)
          const bestaandeTechniekenSnap = await getDocs(collection(db, 'trainingen', trainId, 'technieken'));
          await Promise.all(bestaandeTechniekenSnap.docs.map(d => deleteDoc(d.ref)));
          // Voeg nieuwe technieken toe
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
      <div style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '580px', marginTop: '20px', boxShadow: '0 16px 40px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>📥 Excel importeren</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textSec, fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Groep</label>
        <select value={geselecteerdeGroep} onChange={e => setGeselecteerdeGroep(e.target.value)}
          style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: geselecteerdeGroep ? C.textPrimary : C.textMuted, fontSize: '14px', marginBottom: '16px' }}>
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
          style={{ width: '100%', padding: '10px', background: 'transparent', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', marginBottom: '16px' }}>
          📄 Template downloaden
        </button>
        {fout && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', padding: '10px', color: C.red, fontSize: '14px', marginBottom: '14px' }}>
            {fout}
          </div>
        )}
        {preview && (
          <div style={{ background: '#0D1B2A', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px' }}>
              Preview: {preview.filter(r => !r.alleenDatum).length} technieken in {new Set(preview.map(r => r.datum)).size} trainingen
            </div>
            <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {[...new Set(preview.map(r => r.datum))].slice(0, 10).map(datum => {
                const rijen = preview.filter(r => r.datum === datum);
                const technieken = rijen.filter(r => !r.alleenDatum && r.techniekNaam);
                return (
                  <div key={datum} style={{ fontSize: '12px', color: C.textSec, padding: '4px 8px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '6px' }}>
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
            style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '14px' }}>
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

export default ExcelUpload;
