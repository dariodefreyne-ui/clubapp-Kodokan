// src/components/trainingen/ExcelUpload.jsx
import React, { useEffect, useState } from 'react';
import {
  collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';
import { bepaalSeizoen, trainingsId } from './seizoenHelpers';
import {
  getClubSettings,
  DEFAULT_GEEN_TRAINING_MARKERS,
  DEFAULT_PROVINCIALE_MARKERS,
  markersUitSettings,
  markersProvinciaalUitSettings,
  isGeenTrainingTekst,
} from '../../services/firestoreService';
import {
  TRAINING_STATUS,
  STATUS_LABELS,
  STATUS_EMOJI,
  heeftSamenvoegHint,
  resolveSamenvoegGroep,
} from './trainingStatus';
import { matchTechniek } from '../../utils/techniekMatching';

// Bepaalt de status die bij import op de training gezet wordt, rekening houdend
// met de groep (volgt die de provinciale kalender?) en eventuele samenvoeging.
function bepaalImportStatus(tekst, { groepen, huidigeGroepId, hardMarkers, provincialeMarkers, volgtProvincialeKalender }) {
  const merge = resolveSamenvoegGroep(tekst, groepen, huidigeGroepId);
  if (merge) return { status: TRAINING_STATUS.SAMENGEVOEGD, samengevoegdMet: merge };
  if (isGeenTrainingTekst(tekst, hardMarkers)) return { status: TRAINING_STATUS.GEEN, samengevoegdMet: null };
  if (volgtProvincialeKalender && isGeenTrainingTekst(tekst, provincialeMarkers)) {
    return { status: TRAINING_STATUS.GEEN, samengevoegdMet: null };
  }
  return { status: TRAINING_STATUS.NORMAAL, samengevoegdMet: null };
}

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
      const isLabel = isGeenTrainingTekst(techniekRaw, geenTrainingMarkers)
        || heeftSamenvoegHint(techniekRaw) || heeftSamenvoegHint(opmerking);
      if (!techniekRaw || isLabel) {
        parsed.push({ datum, basisvaardigheid: '', opmerking: isGeenTrainingTekst(techniekRaw, geenTrainingMarkers) || heeftSamenvoegHint(techniekRaw) ? techniekRaw : opmerking, techniekNaam: '', techniekId: null, fase: 'basis', lesgevers: [], ukemi, alleenDatum: true });
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

function normaliseerLesgeverNaam(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Zoekt het echte lesgever-document-ID op basis van een rauwe naam uit Excel.
// Geen match of dubbelzinnige naam (meerdere lesgevers met dezelfde naam) →
// de rauwe naam blijft behouden zodat er niets stilzwijgend verloren gaat;
// dat geval moet dan manueel opgelost worden na import.
function koppelLesgeverNaam(naam, lesgeversLijst) {
  const key = normaliseerLesgeverNaam(naam);
  const matches = (lesgeversLijst || []).filter(l => normaliseerLesgeverNaam(l.naam) === key);
  return matches.length === 1 ? matches[0].id : naam;
}

function parseU13Stijl(rows, techniekDatabank, geenTrainingMarkers = DEFAULT_GEEN_TRAINING_MARKERS, lesgeversLijst = []) {
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
    const lesgevers = splitPlus(lesgeversRaw)
      .filter(l => l.toLowerCase() !== 'nvt' && l.toLowerCase() !== '-')
      .map(l => koppelLesgeverNaam(l, lesgeversLijst));
    const isLabel = isGeenTrainingTekst(techniekRaw, geenTrainingMarkers)
      || isGeenTrainingTekst(opmerking, geenTrainingMarkers)
      || heeftSamenvoegHint(techniekRaw) || heeftSamenvoegHint(opmerking);
    if (!techniekRaw || isLabel) {
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

function ExcelUpload({ groepen, technieken, lesgeversLijst, onClose, onSuccess }) {
  const [geselecteerdeGroep, setGeselecteerdeGroep] = useState('');
  const [preview, setPreview] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [geenTrainingMarkers, setGeenTrainingMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);
  const [provincialeMarkers, setProvincialeMarkers] = useState(DEFAULT_PROVINCIALE_MARKERS);

  useEffect(() => {
    getClubSettings()
      .then(settings => {
        setGeenTrainingMarkers(markersUitSettings(settings));
        setProvincialeMarkers(markersProvinciaalUitSettings(settings));
      })
      .catch(() => {
        setGeenTrainingMarkers(DEFAULT_GEEN_TRAINING_MARKERS);
        setProvincialeMarkers(DEFAULT_PROVINCIALE_MARKERS);
      });
  }, []);

  const geselecteerdeGroepData = groepen.find(g => g.id === geselecteerdeGroep);
  const volgtProvincialeKalender = !!geselecteerdeGroepData?.volgtProvincialeKalender;
  // Voor het parsen: alle markers die betekenen dat een cel een label is i.p.v.
  // een techniek. De finale status wordt per groep bepaald bij het importeren.
  const labelMarkers = [...geenTrainingMarkers, ...provincialeMarkers];

  const parseExcel = async (file) => {
    try {
      const buf = await file.arrayBuffer();
      const { Workbook } = await import('exceljs');
      const wb = new Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      const rows = [];
      const colCount = ws.actualColumnCount;
      ws.eachRow({ includeEmpty: true }, (row) => {
        const rowArr = [];
        for (let c = 1; c <= colCount; c++) {
          const val = row.getCell(c).value;
          rowArr.push(val !== null && val !== undefined ? val : '');
        }
        rows.push(rowArr);
      });
      const isGroep3Stijl = rows.length > 2 &&
        String(rows[1]?.[0] || '').trim().toLowerCase() === 'dag' &&
        String(rows[2]?.[0] || '').trim().toLowerCase() === 'datum';
      const result = isGroep3Stijl
        ? parseGroep3Stijl(rows, technieken, labelMarkers)
        : parseU13Stijl(rows, technieken, labelMarkers, lesgeversLijst);
      setPreview(result);
      setFout('');
    } catch (err) {
      setFout('Fout bij inlezen: ' + err.message);
    }
  };

  const downloadTemplate = async () => {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.columns = [
      { width: 14 }, { width: 20 }, { width: 25 },
      { width: 12 }, { width: 20 }, { width: 25 },
    ];
    ws.addRows([
      ['Programma training', '', '', '', '', ''],
      ['Datum', 'Basisvaardigheid', 'Techniek', 'Fase', 'Lesgever', 'Opmerking'],
      ['2025-09-06', 'Buig-strek', 'Seo Nage', 'basis', 'Sofie', ''],
      ['2025-09-06', '', 'O Soto Gari', 'verdieping', 'Sofie + Dario', ''],
      ['2025-09-13', 'Buig-strek', 'Seo Nage + Tai Otoshi', 'basis + basis', 'Dario', ''],
      ['2025-09-20', '', '', '', 'Nvt', 'Sporthal gesloten'],
      ['2025-12-27', '', '', '', 'Nvt', 'Samen met Groep 2&3'],
    ]);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trainingen_template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
      const volgtProv = !!groepData?.volgtProvincialeKalender;
      for (const [datum, data] of Object.entries(perDatum)) {
        const trainId = trainingsId(geselecteerdeGroep, datum);
        const trainRef = doc(db, 'trainingen', trainId);
        const bestaand = await getDoc(trainRef);
        // Status per groep bepalen (geen / samengevoegd / normaal).
        const { status, samengevoegdMet } = bepaalImportStatus(data.opmerking, {
          groepen,
          huidigeGroepId: geselecteerdeGroep,
          hardMarkers: geenTrainingMarkers,
          provincialeMarkers,
          volgtProvincialeKalender: volgtProv,
        });
        if (!bestaand.exists()) {
          const trainingDoc = {
            groepId: geselecteerdeGroep,
            datum,
            opmerking: data.opmerking || '',
            lesgevers: data.lesgevers || [],
            seizoen: bepaalSeizoen(datum),
            duurMinuten,
            duurOverschreven: false,
            status,
            samengevoegdMet: samengevoegdMet || null,
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
            status,
            samengevoegdMet: samengevoegdMet || null,
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
        {geselecteerdeGroep && (
          <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '-10px', marginBottom: '16px' }}>
            {volgtProvincialeKalender
              ? '🏛️ Volgt provinciale kalender — labels zoals "prov. training" of "tornooi" worden als géén training geïmporteerd.'
              : 'ℹ️ Volgt de provinciale kalender niet — bij "prov. training" of "tornooi" gaat de gewone training door. Aanpasbaar via Beheer → Groepen.'}
          </div>
        )}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) parseExcel(f); }}
          style={{ border: `2px dashed ${C.border}`, borderRadius: '10px', padding: '24px', textAlign: 'center', marginBottom: '16px', cursor: 'pointer' }}
          onClick={() => document.getElementById('excel-input').click()}
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📂</div>
          <div style={{ fontSize: '14px', color: C.textSec }}>Klik of sleep een Excel-bestand</div>
          <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '4px' }}>.xlsx</div>
          <input id="excel-input" type="file" accept=".xlsx" style={{ display: 'none' }}
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
                const { status, samengevoegdMet } = bepaalImportStatus(rijen[0]?.opmerking, {
                  groepen,
                  huidigeGroepId: geselecteerdeGroep,
                  hardMarkers: geenTrainingMarkers,
                  provincialeMarkers,
                  volgtProvincialeKalender,
                });
                const doelNaam = samengevoegdMet ? (groepen.find(g => g.id === samengevoegdMet)?.naam || samengevoegdMet) : '';
                return (
                  <div key={datum} style={{ fontSize: '12px', color: C.textSec, padding: '4px 8px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '6px' }}>
                    <span style={{ color: C.textPrimary, fontWeight: '600' }}>{datum}</span>
                    {status !== TRAINING_STATUS.NORMAAL && (
                      <span style={{ marginLeft: '6px', fontWeight: '600', color: C.orange }}>
                        {STATUS_EMOJI[status]} {status === TRAINING_STATUS.SAMENGEVOEGD ? `Samen met ${doelNaam}` : STATUS_LABELS[status]}
                      </span>
                    )}
                    {technieken.length > 0 ? (' — ' + technieken.map(t => t.techniekNaam).join(', ')) : (status === TRAINING_STATUS.NORMAAL ? (' — ' + (rijen[0]?.opmerking || 'geen techniek')) : '')}
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
            style={{ flex: 1, padding: '12px', border: 'none', borderRadius: '8px', color: preview && geselecteerdeGroep ? C.btnPrimaryText : '#fff', background: preview && geselecteerdeGroep ? C.red : '#444', cursor: preview && geselecteerdeGroep ? 'pointer' : 'not-allowed', fontSize: '14px', fontWeight: '700', opacity: bezig ? 0.6 : 1 }}>
            {bezig ? 'Bezig...' : '📥 Importeren'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ExcelUpload;
