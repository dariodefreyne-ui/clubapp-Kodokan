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
bg: '#1a1a1a',
card: '#2d2d2d',
cardHover: '#333333',
border: '#3a3a3a',
red: '#c0392b',
redHover: '#a93226',
redDim: 'rgba(192,57,43,0.15)',
textPrimary: '#ffffff',
textSec: '#aaaaaa',
textMuted: '#666666',
green: '#27ae60',
greenDim: 'rgba(39,174,96,0.15)',
blue: '#2980b9',
blueDim: 'rgba(41,128,185,0.15)',
orange: '#e67e22',
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
const normaliseer = (s) => s.toLowerCase().replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').tr
const gevonden = techniekDatabank.find(t => {
const a = normaliseer(t.techniek);
const b = normaliseer(techniekNaam);
return a === b || a.includes(b) || b.includes(a);
});
technieken.push({
techniekNaam: gevonden ? gevonden.techniek : techniekNaam,
techniekId: gevonden?.id || null,
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
const doel const ukemi = String(doelRij?.[kolIdx] || '').trim();
= String(ukemiRij?.[kolIdx] || '').trim();
const opmerking = doel || '';
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
const techniekRaw const faseRaw const lesgeversRaw const opmerking = String(rij[2] || '').trim();
= String(rij[3] || '').trim().toLowerCase();
= String(rij[4] || '').trim();
= String(rij[5] || '').trim();
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
const normaliseer = (s) => s.toLowerCase().replace(/[-–_]/g, ' ').replace(/\s+/g, ' ').
const gevonden = techniekNaam ? techniekDatabank.find(t => {
const a = normaliseer(t.techniek);
const b = normaliseer(techniekNaam);
return a === b || a.includes(b) || b.includes(a);
}) : null;
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
const [bezig, setBezig] = useState(false);
const [fout, setFout] = useState('');
const parseExcel = (file) => {
const reader = new FileReader();
reader.onload = (e) => {
try {
const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
// Groep3-stijl: kolom A rij 2 = "Dag", rij 3 = "Datum"
// U13-stijl: rij 1 = titel, rij 2 = headers met "Datum" in kolom A
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
ws['!cols'] = [{ wch: 14 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 20 }, { wch: 25
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
aangemaakt: serverTimestamp(),
bijgewerkt: serverTimestamp(),
});
} else {
// Bestaande technieken verwijderen (overschrijven)
const oudeSnap = await getDocs(collection(db, 'trainingen', trainId, 'technieken'))
for (const d of oudeSnap.docs) await deleteDoc(d.ref);
await setDoc(trainRef, {
bijgewerkt: serverTimestamp(),
lesgevers: data.lesgevers || [],
...(data.opmerking ? { opmerking: data.opmerking } : {}),
}, { merge: true });
}
// Sla technieken op (niet voor alleenDatum rijen)
if (!data.alleenDatum) {
for (let i = 0; i < data.technieken.length; i++) {
const t = data.technieken[i];
await addDoc(collection(db, 'trainingen', trainId, 'technieken'), {
basisvaardigheid: t.basisvaardigheid || t.ukemi || '',
techniekId: t.techniekId || '',
techniekNaam: t.techniekNaam || '',
fase: t.fase || 'basis',
volgorde: i,
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
<div style={{ background: C.card, borderRadius: '14px', padding: '24px', width: '100%',
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
<h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}> Excel importeren<
<button onClick={onClose} style={{ background: 'transparent', border: 'none', color
</div>
{fout && (
{fout}
</div>
<div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', bord
)}
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom:
<select value={geselecteerdeGroep} onChange={e => setGeselecteerdeGroep(e.target.valu
style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.b
<option value="">— Kies groep —</option>
{groepen.map(g => (
<option key={g.id} value={g.id}>{g.naam} ({g.dag})</option>
))}
</select>
<div style={{ marginBottom: '14px' }}>
<p style={{ color: C.textSec, fontSize: '13px', margin: '0 0 8px' }}>
De app herkent automatisch twee Excel-formaten:
</p>
<ul style={{ color: C.textMuted, fontSize: '12px', margin: '0 0 8px', paddingLeft:
<li><strong style={{ color: C.textSec }}>Standaard template</strong> (rijen = tra
<li><strong style={{ color: C.textSec }}>Groep 3 stijl</strong> (kolommen = train
</ul>
<p style={{ color: C.textMuted, fontSize: '11px', margin: '0 0 8px' }}>
Meerdere technieken of lesgevers in één cel: scheiden met <strong>+</strong> (bv.
Fase staat na ":" in de techniekcel (bv. "Seo Nage: verdieping") of in de Fase-ko
</p>
<button onClick={downloadTemplate}
style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.textSec, pad
Download template
</button>
</div>
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom:
<input type="file" accept=".xlsx,.xls"
onChange={e => e.target.files[0] && parseExcel(e.target.files[0])}
style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.b
/>
{preview && (
<div style={{ marginBottom: '14px' }}>
<p style={{ color: C.green, fontSize: '13px', fontWeight: '600', margin: '0 0 8px
✓ {preview.length} rij(en) herkend
</p>
<div style={{ maxHeight: '180px', overflowY: 'auto', background: C.bg, borderRadi
{preview.slice(0, 8).map((r, i) => (
<div key={i} style={{ fontSize: '12px', color: C.textSec, padding: '4px 0', b
<span style={{ color: C.textMuted }}>{r.datum}</span> — {r.techniekNaam}
{!r.techniekId && <span style={{ color: C.orange, marginLeft: '6px' }}>⚠ ni
</div>
))}
</div>
</div>
{preview.length > 8 && <div style={{ color: C.textMuted, fontSize: '12px', padd
)}
<div style={{ display: 'flex', gap: '10px' }}>
<button onClick={onClose}
style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px Annuleren
</button>
<button onClick={importeren} disabled={!preview || !geselecteerdeGroep || bezig}
style={{
flex: 1, padding: '12px', border: 'none', borderRadius: '8px', color: '#fff',
background: preview && geselecteerdeGroep ? C.red : '#444',
cursor: preview && geselecteerdeGroep ? 'pointer' : 'not-allowed',
fontSize: '14px', fontWeight: '700', opacity: bezig ? 0.6 : 1,
}}>
{bezig ? 'Bezig...' : ' Importeren'}
solid
</button>
</div>
</div>
</div>
);
}
// ─── BeschikbaarheidPanel ─────────────────────────────────────────────────────
function BeschikbaarheidPanel({ trainId, profiel, isBeheerder, alleUsers }) {
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
const statusKleur = (s) => ({ bevestigd: C.green, afwezig: '#e74c3c', onbekend: C.textMuted
const statusLabel = (s) => ({ bevestigd: '✓ Aanwezig', afwezig: '✗ Afwezig', onbekend: '? O
const eigeneStatus = beschikbaarheid.find(b => b.uid === profiel?.uid)?.status || 'onbekend
return (
<div style={{ background: C.bg, borderRadius: '10px', padding: '12px', marginBottom: '12p
<div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: '
Beschikbaarheid
</div>
{/* Eigen status */}
<div style={{ marginBottom: isBeheerder ? '12px' : '0' }}>
<div style={{ fontSize: '12px', color: C.textSec, marginBottom: '6px' }}>Jouw status:
<div style={{ display: 'flex', gap: '8px' }}>
{['bevestigd', 'afwezig'].map(s => (
<button key={s}
onClick={() => stelIn(profiel.uid, profiel.naam || profiel.email, s)}
style={{
flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '1
background: eigeneStatus === s ? (s === 'bevestigd' ? C.greenDim : 'rgba(231,
border: `1px solid ${eigeneStatus === s ? statusKleur(s) : C.border}`,
color: eigeneStatus === s ? statusKleur(s) : C.textSec,
}}>
</button>
{s === 'bevestigd' ? '✓ Aanwezig' : '✗ Afwezig'}
))}
</div>
</div>
{/* Beheerder: overzicht + invullen voor anderen */}
{isBeheerder && (
<>
{beschikbaarheid.length > 0 && (
<div style={{ marginBottom: '10px' }}>
<div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '6px' }}>Over
{beschikbaarheid.map(b => (
<div key={b.uid} style={{ display: 'flex', justifyContent: 'space-between', p
<span style={{ color: C.textSec }}>{b.naam}</span>
<span style={{ color: statusKleur(b.status), fontWeight: '600', fontSize: '
</div>
))}
</div>
)}
'onbek
{alleUsers.filter(u => u.uid !== profiel?.uid).length > 0 && (
<div>
<div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '6px' }}>Invu
<div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
{alleUsers.filter(u => u.uid !== profiel?.uid).map(u => {
const status = beschikbaarheid.find(b => b.uid === u.uid)?.status || return (
<div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '8p
<span style={{ flex: 1, fontSize: '12px', color: C.textSec }}>{u.naam |
{['bevestigd', 'afwezig'].map(s => (
<button key={s}
onClick={() => stelIn(u.uid, u.naam || u.email, s)}
style={{
padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', font
background: status === s ? (s === 'bevestigd' ? C.greenDim : 'rgb
border: `1px solid ${status === s ? statusKleur(s) : C.border}`,
color: status === s ? statusKleur(s) : C.textMuted,
}}>
</button>
{s === 'bevestigd' ? '✓' : '✗'}
))}
</div>
);
})}
</div>
</div>
)}
</>
)}
</div>
);
}
// ─── TrainingFormulier ────────────────────────────────────────────────────────
function TrainingFormulier({ groepId, datum, trainingsData, technieken, onClose, onSaved }) {
const [opmerking, setOpmerking] = useState(trainingsData?.opmerking || '');
const [technieksLijst, setTechnieksLijst] = useState([]);
const [bezig, setBezig] = useState(false);
const [fout, setFout] = useState('');
const [lesgevers, setLesgevers] = useState(trainingsData?.lesgevers || []);
const [nieuweLesgever, setNieuweLesgever] = useState('');
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
}));
return { ...t, [veld]: waarde };
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
lesgevers,
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
} else {
await addDoc(collection(db, 'trainingen', trainId, 'technieken'), data);
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
<div style={{ background: C.card, borderRadius: '14px', padding: '24px', width: '100%',
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
<h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
{trainingsData ? ' Bewerken' : '+ Nieuwe training'}
</h2>
</div>
<button onClick={onClose} style={{ background: 'transparent', border: 'none', color
<div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '16px' }}>{formatDa
{fout && (
{fout}
</div>
<div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', bord
)}
{/* Datum (readonly, beheerd door parent) */}
{!trainingsData && (
<>
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBot
<input
type="date" defaultValue={datum} readOnly
style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid $
/>
</>
)}
{/* Opmerking */}
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom:
<input
type="text" value={opmerking}
onChange={e => setOpmerking(e.target.value)}
placeholder="Bv. tornooi, sporthal gesloten..."
style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid
/>
{/* Lesgevers */}
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom:
Lesgevers
</label>
<div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
<input
type="text"
value={nieuweLesgever}
onChange={e => setNieuweLesgever(e.target.value)}
onKeyDown={e => {
if (e.key === 'Enter' && nieuweLesgever.trim()) {
setLesgevers(prev => [...new Set([...prev, nieuweLesgever.trim()])]);
setNieuweLesgever('');
}
}}
placeholder="Naam lesgever + Enter"
style={{ flex: 1, padding: '8px 10px', background: C.bg, border: `1px solid ${C.b
/>
<button
onClick={() => {
if (nieuweLesgever.trim()) {
setLesgevers(prev => [...new Set([...prev, nieuweLesgever.trim()])]);
setNieuweLesgever('');
}
}}
style={{ padding: '8px 12px', background: C.redDim, border: `1px solid ${C.red}`,
>
+
</button>
</div>
{lesgevers.length > 0 && (
<div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }
{lesgevers.map(l => (
<span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontS
{l}
<button onClick={() => setLesgevers(prev => prev.filter(x => x !== l))}
style={{ background: 'transparent', border: 'none', color: C.blue, cursor:
×
</button>
</span>
))}
</div>
)}
{/* Technieken sectie */}
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
<span style={{ fontSize: '12px', fontWeight: '700', color: C.textMuted, textTransfo
<button onClick={voegTechniekToe}
style={{ background: C.redDim, border: `1px solid ${C.red}`, color: C.red, + Toevoegen
</button>
</div>
paddin
{technieksLijst.length === 0 && (
<div style={{ color: C.textMuted, fontSize: '14px', padding: '14px', background: C.
Nog geen technieken. Klik "+ Toevoegen".
</div>
)}
{technieksLijst.map((t, idx) => (
<div key={t.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderR
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'cent
<span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '600' }}>Techn
<button onClick={() => verwijderTechniek(t, idx)}
style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor:
</button>
</div>
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBot
<input type="text" value={t.basisvaardigheid}
onChange={e => updateTechniek(idx, 'basisvaardigheid', e.target.value)}
placeholder="Bv. Buig-strek, Yoko-ukemi..."
style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px s
/>
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBot
<select value={t.techniekId} onChange={e => updateTechniek(idx, 'techniekId', e.t
style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px s
<option value="">— Kies techniek uit databank —</option>
{['Val', 'Houdgreep', 'Verplaatsing', 'Worpen', 'Transitie'].map(type => (
<optgroup key={type} label={type}>
{technieken.filter(tk => tk.type === type).map(tk => (
<option key={tk.id} value={tk.id}>{tk.techniek}</option>
))}
</optgroup>
))}
</select>
<label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBot
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
flex: 1, padding: '7px', borderRadius: '6px', cursor: 'pointer', fontSize
background: t.fase === f ? (f === 'basis' ? C.blueDim : C.redDim) : C.car
border: `1px solid ${t.fase === f ? (f === 'basis' ? C.blue : C.red) : C.
color: t.fase === f ? (f === 'basis' ? C.blue : C.red) : C.textSec,
}}>
{f === 'basis' ? ' Basis' : ' Verdieping'}
</button>
))}
</div>
</div>
))}
solid
<div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
<button onClick={onClose}
style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px Annuleren
</button>
<button onClick={opslaan} disabled={bezig}
style={{ flex: 2, padding: '12px', background: C.red, border: 'none', borderRadiu
{bezig ? 'Opslaan...' : ' Opslaan'}
</button>
</div>
</div>
</div>
);
}
// ─── TrainingKaart ────────────────────────────────────────────────────────────
function TrainingKaart({ training, technieken, isBeheerder, profiel, alleUsers, selectieModus
const [uitgeklapt, setUitgeklapt] = useState(false);
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
onClick={() => selectieModus ? onToggleSelectie() : setUitgeklapt(v => !v)}
style={{
display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: '
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
{isGeselecteerd && <span style={{ color: '#fff', fontSize: '12px', lineHeight: 1
</div>
)}
<div style={{ flex: 1 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }
<span style={{ fontSize: '15px', fontWeight: '700' }}>{formatDatum(training.datum
{isVandaag && (
<span style={{ fontSize: '11px', fontWeight: '700', color: C.green, background:
Vandaag
</span>
)}
</div>
{training.opmerking && (
<div style={{ fontSize: '13px', color: C.textMuted, marginTop: '2px' }}>{training
)}
{training.lesgevers?.length > 0 && (
<div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
{training.lesgevers.map(l => (
<span key={l} style={{
fontSize: '11px', padding: '2px 8px', borderRadius: '999px',
background: C.blueDim, border: `1px solid ${C.blue}`, color: C.blue,
fontWeight: '600',
}}>
{l}
</span>
))}
</div>
)}
</div>
</div>
<span style={{ color: C.textMuted, fontSize: '12px' }}>{uitgeklapt ? '▲' : '▼'}</span
{/* Uitgeklapt */}
{uitgeklapt && (
<div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px' }}>
{technieksLijst.length === 0 ? (
<div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '12px' }}>Geen
) : (
<div style={{ marginBottom: '12px' }}>
<div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTran
Technieken
</div>
{technieksLijst.map(t => (
<div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', p
<span style={{
fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6
background: t.fase === 'basis' ? C.blueDim : C.redDim,
color: t.fase === 'basis' ? C.blue : C.red,
border: `1px solid ${t.fase === 'basis' ? C.blue : C.red}`,
}}>
{t.fase}
</span>
<div style={{ flex: 1 }}>
<div style={{ fontSize: '14px', fontWeight: '600', color: C.textPrimary }
{t.basisvaardigheid && (
<div style={{ fontSize: '12px', color: C.textMuted }}>{t.basisvaardighe
)}
</div>
</div>
))}
</div>
)}
<BeschikbaarheidPanel
trainId={trainId}
profiel={profiel}
isBeheerder={isBeheerder}
alleUsers={alleUsers}
/>
{isBeheerder && (
<div style={{ display: 'flex', gap: '8px' }}>
<button onClick={onBewerken}
style={{ flex: 1, padding: '9px', background: C.redDim, border: `1px solid ${
Bewerken
</button>
<button onClick={onVerwijderen}
style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #
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
const [groepen, setGroepen] = useState([]);
const [trainingen, setTrainingen] = useState([]);
const [technieken, setTechnieken] = useState([]);
const [actieveGroep, setActieveGroep] = useState('');
const [periodeStart, setPeriodeStart] = useState('');
const [periodeEinde, setPeriodeEinde] = useState('');
const [melding, setMelding] = useState('');
const [formulierOpen, setFormulierOpen] = useState(false);
const [formulierDatum, setFormulierDatum] = useState('');
const [formulierTraining, setFormulierTraining] = useState(null);
const [alleUsers, setAlleUsers] = useState([]);
const [excelOpen, setExcelOpen] = useState(false);
const [selectieModus, setSelectieModus] = useState(false);
const [geselecteerd, setGeselecteerd] = useState(new Set());
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
// Laad lesgevende users voor beschikbaarheid
useEffect(() => {
getDocs(collection(db, 'users')).then(snap => {
const users = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
const lesgevers = users.filter(u =>
u.rol === 'trainer' || (u.groepen && u.groepen.length > 0)
);
});
}, []);
setAlleUsers(lesgevers);
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
const techSnap = await getDocs(collection(db, 'trainingen', training.id, 'technieken'))
for (const d of techSnap.docs) await deleteDoc(d.ref);
const beschSnap = await getDocs(collection(db, 'trainingen', training.id, 'beschikbaarh
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
const beschSnap = await getDocs(collection(db, 'trainingen', trainId, 'beschikbaarhei
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
<div style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${C
<h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' }
Trainingsplanning
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
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '20px', ali
<input
type="date" value={periodeStart}
onChange={e => setPeriodeStart(e.target.value)}
style={{ padding: '8px', background: C.card, border: `1px solid ${C.border}`, borde
/>
<span style={{ color: C.textMuted }}>→</span>
<input
type="date" value={periodeEinde}
onChange={e => setPeriodeEinde(e.target.value)}
style={{ padding: '8px', background: C.card, border: `1px solid ${C.border}`, borde
/>
{(periodeStart || periodeEinde) && (
<button onClick={() => { setPeriodeStart(''); setPeriodeEinde(''); }}
style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: '
✕
</button>
)}
<div style={{ flex: 1 }} />
{isBeheerder && (
<div style={{ display: 'flex', gap: '8px' }}>
<button onClick={() => setExcelOpen(true)}
style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border
Import
</button>
<button onClick={exporteerExcel}
style={{ padding: '8px 14px', background: C.card, border: `1px solid ${C.border
Export
</button>
<button
onClick={openNieuweTraining}
style={{ padding: '8px 14px', background: C.red, border: 'none', borderRadius:
>
+ Training
</button>
</div>
)}
</div>
{/* Trainingen lijst */}
{actieveGroepData && (
<div>
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center
<div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransf
{actieveGroepData.naam} — {actieveGroepData.dag} — {gefilterdeTrainingen.length
</div>
{isBeheerder && gefilterdeTrainingen.length > 0 && (
<div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
{selectieModus ? (
<>
<span style={{ fontSize: '12px', color: C.textMuted }}>{geselecteerd.size
<button
onClick={bulkVerwijder}
disabled={geselecteerd.size === 0}
style={{ padding: '5px 12px', background: geselecteerd.size > 0 ? 'rgba
>
Verwijder ({geselecteerd.size})
</button>
<button
onClick={() => { setSelectieModus(false); setGeselecteerd(new Set()); }
style={{ padding: '5px 12px', background: 'transparent', border: `1px s
>
Annuleren
</button>
</>
) : (
<button
onClick={() => setSelectieModus(true)}
style={{ padding: '5px 12px', background: 'transparent', border: `1px sol
>
☑ Selecteren
</button>
)}
</div>
)}
</div>
{gefilterdeTrainingen.length === 0 ? (
<div style={{ background: C.card, borderRadius: '12px', padding: '32px', textAlig
Nog geen trainingen ingepland.
{isBeheerder && (
<div style={{ marginTop: '12px' }}>
<button onClick={openNieuweTraining}
style={{ background: C.redDim, border: `1px solid ${C.red}`, color: C.red
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
}
);
</div>
