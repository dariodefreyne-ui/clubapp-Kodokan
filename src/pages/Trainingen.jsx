// src/pages/Trainingen.jsx
// TRAININGEN v3.1
import React, { useState, useEffect, useCallback } from 'react';
import {
 collection, query, where, orderBy, onSnapshot, getDocs,
 doc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { DARK, LIGHT } from '../components/trainingen/tokens';
import {
 vandaagISO,
 formatDatum,
 beschikbareSeizoenStartJaren,
 huidigSeizoenStartJaar,
 seizoenBereikVanJaar,
} from '../components/trainingen/seizoenHelpers';
import ExcelUpload from '../components/trainingen/ExcelUpload';
import TrainingFormulier from '../components/trainingen/TrainingFormulier';
import TrainingKaart from '../components/trainingen/TrainingKaart';

async function exporteerSeizoen(seizoen, groepen, lesgeversLijst) {
 const rows = [
 [`Seizoensextractie ${seizoen}`, '', '', '', '', '', ''],
 ['Datum', 'Groep', 'Duur (min)', 'Lesgevers', 'Techniek', 'Fase', 'Opmerking'],
 ];
 const snap = await getDocs(query(collection(db, 'trainingen'), where('seizoen', '==', seizoen), orderBy('datum', 'asc')));
 for (const d of snap.docs) {
 const t = d.data();
 const groep = groepen.find(g => g.id === t.groepId);
 const groepNaam = groep?.naam || t.groepId;
 const lesgeversStr = (t.lesgevers || []).map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id).join(' + ');
 const duur = t.duurMinuten || '';
 const techSnap = await getDocs(query(collection(db, 'trainingen', d.id, 'technieken'), orderBy('volgorde')));
 const techs = techSnap.docs.map(td => td.data());
 if (techs.length === 0) {
 rows.push([t.datum, groepNaam, duur, lesgeversStr, '', '', t.opmerking || '']);
 } else {
 techs.forEach((tech, i) => {
 rows.push([i === 0 ? t.datum : '', i === 0 ? groepNaam : '', i === 0 ? duur : '', i === 0 ? lesgeversStr : '', tech.techniekNaam || '', tech.fase || '', i === 0 ? (t.opmerking || '') : '']);
 });
 }
 }
 const ws = XLSX.utils.aoa_to_sheet(rows);
 ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 12 }, { wch: 30 }];
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, 'Seizoen');
 XLSX.writeFile(wb, `seizoen_${seizoen}_extractie.xlsx`);
}

async function exporteerGroepExcel(actieveGroepData, gefilterdeTrainingen, lesgeversLijst) {
 const rows = [
 [`Trainingsplanning ${actieveGroepData.naam} (${actieveGroepData.dag})`],
 ['Datum', 'Duur (min)', 'Basisvaardigheid', 'Techniek', 'Fase', 'Lesgevers', 'Opmerking'],
 ];
 for (const training of gefilterdeTrainingen) {
 const techSnap = await getDocs(query(collection(db, 'trainingen', training.id, 'technieken'), orderBy('volgorde')));
 const techs = techSnap.docs.map(d => d.data());
 const lesgeversStr = (training.lesgevers || []).map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id).join(' + ');
 if (techs.length === 0) {
 rows.push([training.datum, training.duurMinuten || '', '', '', '', lesgeversStr, training.opmerking || '']);
 } else {
 techs.forEach((t, i) => {
 rows.push([i === 0 ? training.datum : '', i === 0 ? (training.duurMinuten || '') : '', t.basisvaardigheid || '', t.techniekNaam || '', t.fase || '', i === 0 ? lesgeversStr : '', i === 0 ? (training.opmerking || '') : '']);
 });
 }
 }
 const ws = XLSX.utils.aoa_to_sheet(rows);
 ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 30 }];
 const wb = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb, ws, actieveGroepData.naam);
 XLSX.writeFile(wb, `trainingen_${actieveGroepData.id}_export.xlsx`);
}

function FilterDrawer({ open, onClose, filterMaand, setFilterMaand, filterLesgever, setFilterLesgever, periodeStart, setPeriodeStart, periodeEinde, setPeriodeEinde, maandOpties, lesgeversLijst, T, isDark }) {
 const inp = { width: '100%', padding: '8px 10px', boxSizing: 'border-box', background: isDark ? T.navyMid : T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: '8px', color: T.text, fontSize: '14px' };
 const sectionLabel = { display: 'block', fontSize: '11px', fontWeight: '700', color: T.textMuted, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' };
 const heeftFilters = filterMaand !== 'alle' || filterLesgever || periodeStart || periodeEinde;
 const kiesPeriode = (type) => {
 const nu = new Date();
 const jaar = nu.getFullYear();
 const maand = nu.getMonth();
 if (type === 'week') {
 const dag = nu.getDay() || 7;
 const ma = new Date(nu); ma.setDate(nu.getDate() - dag + 1);
 const zo = new Date(ma); zo.setDate(ma.getDate() + 6);
 setPeriodeStart(ma.toISOString().slice(0, 10));
 setPeriodeEinde(zo.toISOString().slice(0, 10));
 } else if (type === 'maand') {
 setPeriodeStart(new Date(jaar, maand, 1).toISOString().slice(0, 10));
 setPeriodeEinde(new Date(jaar, maand + 1, 0).toISOString().slice(0, 10));
 } else {
 const start = maand >= 8 ? new Date(jaar, 8, 1) : new Date(jaar - 1, 8, 1);
 const einde = new Date(start.getFullYear() + 1, 5, 30);
 setPeriodeStart(start.toISOString().slice(0, 10));
 setPeriodeEinde(einde.toISOString().slice(0, 10));
 }
 onClose();
 };
 return (
 <>
 <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.45)', opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none', transition: 'opacity 0.2s' }} />
 <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: '300px', zIndex: 201, background: isDark ? T.navyLight : T.surface, borderLeft: `1px solid ${T.borderSoft}`, boxShadow: '-8px 0 32px rgba(0,0,0,0.3)', padding: '24px 20px', transform: open ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)', display: 'flex', flexDirection: 'column', gap: '22px', overflowY: 'auto' }}>
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
 <span style={{ fontSize: '18px', fontWeight: '800', color: T.text }}>Filters</span>
 <button onClick={onClose} style={{ background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '8px', color: T.textMuted, cursor: 'pointer', padding: '5px 11px', fontSize: '14px' }}>✕</button>
 </div>
 <div><span style={sectionLabel}>Maand</span><select value={filterMaand} onChange={e => setFilterMaand(e.target.value)} style={inp}><option value='alle'>Alle maanden</option>{maandOpties.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
 <div><span style={sectionLabel}>Lesgever</span><select value={filterLesgever} onChange={e => setFilterLesgever(e.target.value)} style={{ ...inp, color: filterLesgever ? T.purple : T.text, borderColor: filterLesgever ? T.purple : T.border }}><option value=''>Alle lesgevers</option>{lesgeversLijst.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}</select></div>
 <div><span style={sectionLabel}>Datumperiode</span><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}><input type='date' value={periodeStart} onChange={e => setPeriodeStart(e.target.value)} style={inp} /><input type='date' value={periodeEinde} onChange={e => setPeriodeEinde(e.target.value)} style={inp} /></div></div>
 <div><span style={sectionLabel}>Snelkeuze</span><div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>{[{ label: 'Deze week', type: 'week' }, { label: 'Deze maand', type: 'maand' }, { label: 'Dit seizoen', type: 'seizoen' }].map(({ label, type }) => <button key={type} onClick={() => kiesPeriode(type)} style={{ padding: '9px 12px', background: isDark ? T.surface : T.surfaceHigh, border: 'none', borderRadius: '8px', color: T.textSec, cursor: 'pointer', fontSize: '14px', textAlign: 'left', fontWeight: '500' }}>{label}</button>)}</div></div>
 {heeftFilters && <button onClick={() => { setFilterMaand('alle'); setFilterLesgever(''); setPeriodeStart(''); setPeriodeEinde(''); }} style={{ padding: '10px', background: T.redDim, border: `1px solid ${T.red}`, borderRadius: '8px', color: T.red, cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>Alle filters wissen</button>}
 </div>
 </>
 );
}

const GROEP_ACCENTEN = ['#38BDF8', '#A78BFA', '#22C55E', '#FB923C', '#E63346'];

function GroepsKaart({ groep, index, actief, onClick, aantalKomend, T, isDark }) {
 const accent = GROEP_ACCENTEN[index % GROEP_ACCENTEN.length];
 return (
 <button onClick={onClick} style={{ flexShrink: 0, minWidth: '160px', padding: '16px 18px', borderRadius: '14px', cursor: 'pointer', textAlign: 'left', background: actief ? isDark ? T.surface : '#fff' : isDark ? 'transparent' : 'rgba(255,255,255,0.5)', border: actief ? `1.5px solid ${accent}` : '1.5px solid transparent', transform: actief ? 'scale(1.03)' : 'scale(1)', boxShadow: actief ? `0 4px 20px rgba(0,0,0,0.2), 0 0 0 1px ${accent}30` : 'none', transition: 'all 0.18s cubic-bezier(.4,0,.2,1)', outline: 'none' }}>
 <div style={{ width: actief ? '32px' : '20px', height: '3px', borderRadius: '2px', background: actief ? accent : T.textMuted, marginBottom: '12px', transition: 'all 0.18s' }} />
 <div style={{ fontSize: '15px', fontWeight: '800', color: actief ? T.text : T.textSec, marginBottom: '3px', letterSpacing: '-0.2px' }}>{groep.naam}</div>
 <div style={{ fontSize: '12px', color: T.textMuted, marginBottom: '10px' }}>{groep.dag}</div>
 <div style={{ fontSize: '12px', fontWeight: '700', color: actief ? accent : T.textMuted }}>{aantalKomend} komend</div>
 </button>
 );
}

function HeroSection({ seizoenLabel, aantalKomend, volgendeTraining, mijnNaam, onNieuw, kanNieuw }) {
 const isJouwTraining = mijnNaam && volgendeTraining?.lesgevers?.includes(mijnNaam);
 return (
 <div style={{ background: 'linear-gradient(135deg, #0D1B2A 0%, #0F2A45 65%, #11223A 100%)', borderRadius: '14px', padding: '20px 24px 18px', marginBottom: '20px', position: 'relative', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.25)' }}>
 <div style={{ position: 'absolute', top: '-30px', right: '-30px', width: '120px', height: '120px', borderRadius: '50%', background: 'rgba(230,51,70,0.06)', pointerEvents: 'none' }} />
 <div style={{ position: 'absolute', bottom: '-20px', right: '60px', width: '80px', height: '80px', borderRadius: '50%', border: '1px solid rgba(230,51,70,0.08)', pointerEvents: 'none' }} />
 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', position: 'relative' }}>
 <div><div style={{ fontSize: '11px', fontWeight: '800', color: 'rgba(230,51,70,0.75)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Kodokan · {seizoenLabel}</div><h1 style={{ margin: 0, fontSize: 'clamp(20px,4vw,26px)', fontWeight: '900', color: '#EBF2FA', letterSpacing: '-0.5px', lineHeight: 1.1 }}>Trainingsplanning</h1></div>
 {kanNieuw && <button onClick={onNieuw} style={{ flexShrink: 0, padding: '9px 16px', background: '#E63346', border: 'none', borderRadius: '10px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '800', letterSpacing: '0.2px', boxShadow: '0 3px 10px rgba(230,51,70,0.4)', whiteSpace: 'nowrap' }}>+ Nieuwe training</button>}
 </div>
 <div style={{ display: 'flex', gap: '16px', marginTop: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
 <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}><span style={{ fontSize: '22px', fontWeight: '900', color: '#EBF2FA', lineHeight: 1 }}>{aantalKomend}</span><span style={{ fontSize: '12px', color: 'rgba(235,242,250,0.45)' }}>komende trainingen</span></div>
 {volgendeTraining && <><div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.08)' }} /><div><div style={{ fontSize: '11px', color: 'rgba(235,242,250,0.4)', marginBottom: '1px' }}>Volgende</div><div style={{ fontSize: '14px', fontWeight: '700', color: '#EBF2FA' }}>{formatDatum(volgendeTraining.datum)}</div>{volgendeTraining.lesgevers?.length > 0 && <div style={{ fontSize: '12px', color: 'rgba(235,242,250,0.4)', marginTop: '1px' }}>{volgendeTraining.lesgevers.join(' · ')}</div>}</div>{isJouwTraining && <div style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: '8px', background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: '7px' }}><span style={{ fontSize: '14px' }}>🥋</span><div><div style={{ fontSize: '11px', fontWeight: '800', color: '#22C55E', letterSpacing: '0.3px' }}>JOUW TRAINING</div><div style={{ fontSize: '11px', color: 'rgba(235,242,250,0.45)' }}>{formatDatum(volgendeTraining.datum)}</div></div></div>}</>}
 </div>
 </div>
 );
}

export default function Trainingen() {
 const { isBeheerder, profiel } = useAuth();
 const mijnNaam = profiel?.naam || null;
 const [isDark, setIsDark] = useState(true);
 const T = isDark ? DARK : LIGHT;
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
 const [excelOpen, setExcelOpen] = useState(false);
 const [selectieModus, setSelectieModus] = useState(false);
 const [geselecteerd, setGeselecteerd] = useState(new Set());
 const [actieveSeizoenStart, setActieveSeizoenStart] = useState(huidigSeizoenStartJaar());
 const [lesgeversLijst, setLesgeversLijst] = useState([]);
 const [filterLesgever, setFilterLesgever] = useState('');
 const [filterMaand, setFilterMaand] = useState('alle');
 const [alleTrainingen, setAlleTrainingen] = useState([]);
 const [seizoensExportBezig, setSeizoenExportBezig] = useState(false);
 const [toonVoorbije, setToonVoorbije] = useState(false);
 const [drawerOpen, setDrawerOpen] = useState(false);
 const actieveSeizoen = `${actieveSeizoenStart}-${actieveSeizoenStart + 1}`;
 const { label: seizoenLabel } = seizoenBereikVanJaar(actieveSeizoenStart);

 useEffect(() => { getDocs(collection(db, 'groepen')).then(snap => { const g = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.naam.localeCompare(b.naam)); setGroepen(g); if (g.length > 0) setActieveGroep(g[0].id); }); }, []);
 useEffect(() => { if (!actieveGroep) return undefined; const q = query(collection(db, 'trainingen'), where('groepId', '==', actieveGroep), where('seizoen', '==', actieveSeizoen), orderBy('datum', 'asc')); const unsub = onSnapshot(q, snap => { setTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); return unsub; }, [actieveGroep, actieveSeizoen]);
 useEffect(() => { if (!filterLesgever) { setAlleTrainingen([]); return undefined; } const q = query(collection(db, 'trainingen'), where('seizoen', '==', actieveSeizoen), orderBy('datum', 'asc')); const unsub = onSnapshot(q, snap => { setAlleTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); return unsub; }, [filterLesgever, actieveSeizoen]);
 useEffect(() => { setFilterMaand('alle'); }, [actieveSeizoenStart]);
 useEffect(() => { getDocs(collection(db, 'technieken')).then(snap => { setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() }))); }); }, []);
 useEffect(() => { getDocs(collection(db, 'lesgevers')).then(snap => { setLesgeversLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(l => l.actief !== false).sort((a, b) => a.naam.localeCompare(b.naam))); }); }, []);

 const bronTrainingen = filterLesgever ? alleTrainingen : trainingen;
 const gefilterdeTrainingen = bronTrainingen.filter(t => {
 if (periodeStart && t.datum < periodeStart) return false;
 if (periodeEinde && t.datum > periodeEinde) return false;
 if (filterLesgever && !(t.lesgevers || []).includes(filterLesgever)) return false;
 if (filterMaand !== 'alle') {
 const d = new Date(t.datum + 'T00:00:00');
 if (`${d.getFullYear()}-${d.getMonth()}` !== filterMaand) return false;
 }
 return true;
 });
 const maandOpties = (() => { const gezien = new Set(); const opties = []; for (const t of bronTrainingen) { const d = new Date(t.datum + 'T00:00:00'); const key = `${d.getFullYear()}-${d.getMonth()}`; if (!gezien.has(key)) { gezien.add(key); opties.push({ value: key, label: d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' }) }); } } return opties; })();
 const vandaag = vandaagISO();
 const komendeTrainingen = gefilterdeTrainingen.filter(t => t.datum >= vandaag);
 const voorbijTrainingen = gefilterdeTrainingen.filter(t => t.datum < vandaag).reverse();
 const volgendTrainingId = komendeTrainingen[0]?.id || null;
 const volgendeTraining = komendeTrainingen[0] || null;
 const toonMelding = useCallback((tekst) => { setMelding(tekst); setTimeout(() => setMelding(''), 3000); }, []);
 const openNieuweTraining = () => { setFormulierDatum(vandaag); setFormulierTraining(null); setFormulierOpen(true); };
 const openBewerken = (training) => { setFormulierDatum(training.datum); setFormulierTraining(training); setFormulierOpen(true); };
 const verwijderTraining = async (training) => { if (!window.confirm(`Training van ${formatDatum(training.datum)} verwijderen?`)) return; try { const techSnap = await getDocs(collection(db, 'trainingen', training.id, 'technieken')); for (const d of techSnap.docs) await deleteDoc(d.ref); await deleteDoc(doc(db, 'trainingen', training.id)); toonMelding('Training verwijderd'); } catch (e) { alert('Verwijderen mislukt: ' + e.message); } };
 const bulkVerwijder = async () => { if (geselecteerd.size === 0) return; if (!window.confirm(`${geselecteerd.size} training(en) verwijderen?`)) return; const aantal = geselecteerd.size; try { for (const trainId of geselecteerd) { const techSnap = await getDocs(collection(db, 'trainingen', trainId, 'technieken')); for (const d of techSnap.docs) await deleteDoc(d.ref); await deleteDoc(doc(db, 'trainingen', trainId)); } setGeselecteerd(new Set()); setSelectieModus(false); toonMelding(`${aantal} training(en) verwijderd`); } catch (e) { alert('Verwijderen mislukt: ' + e.message); } };
 const toggleSelectie = (id) => { setGeselecteerd(prev => { const nieuw = new Set(prev); if (nieuw.has(id)) nieuw.delete(id); else nieuw.add(id); return nieuw; }); };
 const actieveGroepData = groepen.find(g => g.id === actieveGroep);
 const magTrainingToevoegen = isBeheerder || !!profiel?.naam;
 const aantalFilters = (filterMaand !== 'alle' ? 1 : 0) + (filterLesgever ? 1 : 0) + ((periodeStart || periodeEinde) ? 1 : 0);

 return (
 <div style={{ background: isDark ? T.navy : '#EAF0F7', minHeight: '100vh', color: T.text, paddingBottom: '48px' }}>
 {melding && <div style={{ position: 'fixed', top: '70px', right: '16px', zIndex: 400, background: T.green, color: '#fff', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>✓ {melding}</div>}
 <div style={{ background: isDark ? T.navyLight : T.surface, boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.04)' : '0 1px 0 rgba(0,0,0,0.07)', padding: '0 20px', height: '52px', display: 'flex', alignItems: 'center', gap: '10px', position: 'sticky', top: 0, zIndex: 50 }}>
 <span style={{ fontSize: '13px', color: T.textMuted, fontWeight: '600' }}>Trainingen</span><div style={{ flex: 1 }} />
 <select value={actieveSeizoenStart} onChange={e => setActieveSeizoenStart(Number(e.target.value))} style={{ padding: '5px 10px', background: isDark ? T.navyMid : T.surfaceHigh, border: `1px solid ${T.border}`, borderRadius: '8px', color: T.text, fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>{beschikbareSeizoenStartJaren().map(startJaar => <option key={startJaar} value={startJaar}>{startJaar}-{startJaar + 1}{startJaar === huidigSeizoenStartJaar() ? ' (huidig)' : ''}</option>)}</select>
 <button onClick={() => setDrawerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: aantalFilters > 0 ? T.redDim : 'transparent', border: `1px solid ${aantalFilters > 0 ? T.red : T.border}`, borderRadius: '8px', color: aantalFilters > 0 ? T.red : T.textSec, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>⚙ Filters{aantalFilters > 0 && <span style={{ background: T.red, color: '#fff', borderRadius: '999px', width: '16px', height: '16px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: '900' }}>{aantalFilters}</span>}</button>
 <button onClick={() => setIsDark(d => !d)} style={{ padding: '6px 10px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '8px', color: T.textSec, cursor: 'pointer', fontSize: '13px' }}>{isDark ? '☀️' : '🌙'}</button>
 <button onClick={() => { if (!volgendTrainingId) { toonMelding('Geen komende training gevonden'); return; } const el = document.getElementById(`training-${volgendTrainingId}`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} style={{ padding: '6px 12px', background: T.greenDim, border: `1px solid ${T.green}`, borderRadius: '8px', color: T.green, cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}>Volgende</button>
 </div>
 <FilterDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} filterMaand={filterMaand} setFilterMaand={setFilterMaand} filterLesgever={filterLesgever} setFilterLesgever={setFilterLesgever} periodeStart={periodeStart} setPeriodeStart={setPeriodeStart} periodeEinde={periodeEinde} setPeriodeEinde={setPeriodeEinde} maandOpties={maandOpties} lesgeversLijst={lesgeversLijst} T={T} isDark={isDark} />
 <div style={{ maxWidth: '780px', margin: '0 auto', padding: '24px 20px' }}>
 <HeroSection seizoenLabel={seizoenLabel} aantalKomend={trainingen.filter(t => t.datum >= vandaag).length} volgendeTraining={volgendeTraining} mijnNaam={mijnNaam} onNieuw={openNieuweTraining} kanNieuw={magTrainingToevoegen} />
 <div style={{ overflowX: 'auto', paddingBottom: '6px', marginBottom: '24px' }}><div style={{ display: 'flex', gap: '10px', minWidth: 'max-content' }}>{groepen.map((g, index) => <GroepsKaart key={g.id} groep={g} index={index} actief={actieveGroep === g.id} onClick={() => setActieveGroep(g.id)} aantalKomend={trainingen.filter(t => t.groepId === g.id && t.datum >= vandaag).length} T={T} isDark={isDark} />)}</div></div>
 {actieveGroepData && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}><span style={{ fontSize: '15px', fontWeight: '700', color: T.text }}>{actieveGroepData.naam}</span><span style={{ fontSize: '13px', color: T.textMuted }}>{actieveGroepData.dag}</span><div style={{ flex: 1 }} /><span style={{ fontSize: '12px', color: T.textMuted }}>{gefilterdeTrainingen.length} trainingen</span>{aantalFilters > 0 && <button onClick={() => { setFilterMaand('alle'); setFilterLesgever(''); setPeriodeStart(''); setPeriodeEinde(''); }} style={{ fontSize: '12px', color: T.red, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, fontWeight: '700' }}>× wis filters</button>}{isBeheerder && gefilterdeTrainingen.length > 0 && (selectieModus ? <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><span style={{ fontSize: '12px', color: T.textMuted }}>{geselecteerd.size} geselecteerd</span><button onClick={bulkVerwijder} disabled={geselecteerd.size === 0} style={{ padding: '5px 12px', background: geselecteerd.size > 0 ? T.redDim : 'transparent', border: `1px solid ${geselecteerd.size > 0 ? T.red : T.border}`, borderRadius: '6px', color: geselecteerd.size > 0 ? T.red : T.textMuted, cursor: geselecteerd.size > 0 ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '600' }}>🗑 Verwijder ({geselecteerd.size})</button><button onClick={() => { setSelectieModus(false); setGeselecteerd(new Set()); }} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '6px', color: T.textMuted, cursor: 'pointer', fontSize: '12px' }}>Annuleren</button></div> : <button onClick={() => setSelectieModus(true)} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '6px', color: T.textMuted, cursor: 'pointer', fontSize: '12px' }}>☑ Selecteren</button>)}</div>}
 {gefilterdeTrainingen.length === 0 ? <div style={{ background: isDark ? T.surface : '#fff', borderRadius: '12px', padding: '48px 24px', textAlign: 'center', boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>📋</div><div style={{ fontSize: '16px', fontWeight: '700', color: T.text, marginBottom: '6px' }}>Geen trainingen</div><div style={{ fontSize: '13px', color: T.textMuted, marginBottom: magTrainingToevoegen ? '20px' : 0 }}>Pas de filters aan of voeg een training toe.</div>{magTrainingToevoegen && <button onClick={openNieuweTraining} style={{ padding: '10px 20px', background: T.redDim, border: `1px solid ${T.red}`, borderRadius: '8px', color: T.red, cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>+ Eerste training toevoegen</button>}</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{komendeTrainingen.length > 0 && <><div style={{ fontSize: '11px', fontWeight: '800', color: T.green, textTransform: 'uppercase', letterSpacing: '1.5px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}><span style={{ width: '18px', height: '2px', background: T.green, display: 'inline-block', borderRadius: '2px' }} />Komend ({komendeTrainingen.length})</div>{komendeTrainingen.map(training => <div id={`training-${training.id}`} key={training.id}><TrainingKaart training={training} technieken={technieken} groepen={groepen} isBeheerder={isBeheerder} profiel={profiel} lesgeversLijst={lesgeversLijst} selectieModus={selectieModus} isGeselecteerd={geselecteerd.has(training.id)} isVolgende={training.id === volgendTrainingId} onToggleSelectie={() => toggleSelectie(training.id)} onBewerken={() => openBewerken(training)} onVerwijderen={() => verwijderTraining(training)} isDark={isDark} T={T} /></div>)}</>}{voorbijTrainingen.length > 0 && <><button onClick={() => setToonVoorbije(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', padding: '8px 0', marginTop: '8px' }}><span>{toonVoorbije ? '▲' : '▼'}</span>Voorbije trainingen ({voorbijTrainingen.length})</button>{toonVoorbije && voorbijTrainingen.map(training => <TrainingKaart key={training.id} training={training} technieken={technieken} groepen={groepen} isBeheerder={isBeheerder} profiel={profiel} lesgeversLijst={lesgeversLijst} selectieModus={selectieModus} isGeselecteerd={geselecteerd.has(training.id)} isVolgende={false} onToggleSelectie={() => toggleSelectie(training.id)} onBewerken={() => openBewerken(training)} onVerwijderen={() => verwijderTraining(training)} isDark={isDark} T={T} />)}</>}</div>}
 {isBeheerder && <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: `1px solid ${T.borderSoft}`, display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}><button onClick={() => setExcelOpen(true)} style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '8px', color: T.textMuted, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>📥 Import</button><button onClick={async () => { setSeizoenExportBezig(true); try { await exporteerGroepExcel(actieveGroepData, gefilterdeTrainingen, lesgeversLijst); toonMelding('Export klaar'); } catch (e) { alert('Export mislukt: ' + e.message); } finally { setSeizoenExportBezig(false); } }} style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '8px', color: T.textMuted, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>📤 Export groep</button><button onClick={async () => { setSeizoenExportBezig(true); try { await exporteerSeizoen(actieveSeizoen, groepen, lesgeversLijst); toonMelding('Seizoensextractie klaar'); } catch (e) { alert('Extractie mislukt: ' + e.message); } finally { setSeizoenExportBezig(false); } }} disabled={seizoensExportBezig} style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${T.border}`, borderRadius: '8px', color: T.textMuted, cursor: 'pointer', fontSize: '12px', fontWeight: '600', opacity: seizoensExportBezig ? 0.6 : 1 }}>📊 Seizoensextractie</button><div style={{ flex: 1 }} /><button onClick={async () => { if (!window.confirm(`Alle trainingen van seizoen ${actieveSeizoen} voor ${actieveGroepData?.naam} verwijderen?`)) return; try { const snap = await getDocs(query(collection(db, 'trainingen'), where('groepId', '==', actieveGroep), where('seizoen', '==', actieveSeizoen))); for (const d of snap.docs) { const techSnap = await getDocs(collection(db, 'trainingen', d.id, 'technieken')); for (const t of techSnap.docs) await deleteDoc(t.ref); await deleteDoc(d.ref); } toonMelding(`Seizoen ${actieveSeizoen} verwijderd`); setActieveSeizoenStart(huidigSeizoenStartJaar()); } catch (e) { alert('Verwijderen mislukt: ' + e.message); } }} style={{ padding: '7px 14px', background: 'transparent', border: '1px solid rgba(230,51,70,0.2)', borderRadius: '8px', color: 'rgba(230,51,70,0.4)', cursor: 'pointer', fontSize: '11px' }}>Seizoen wissen</button></div>}
 </div>
 {formulierOpen && <TrainingFormulier groepId={actieveGroep} datum={formulierDatum} trainingsData={formulierTraining} technieken={technieken} lesgeversLijst={lesgeversLijst} groepen={groepen} onClose={() => setFormulierOpen(false)} onSaved={() => toonMelding('Training opgeslagen')} />}
 {excelOpen && <ExcelUpload groepen={groepen} technieken={technieken} onClose={() => setExcelOpen(false)} onSuccess={toonMelding} />}
 </div>
 );
}
