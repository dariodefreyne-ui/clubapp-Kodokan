// src/pages/Trainingen.jsx
// ─── TRAININGEN v2.0 ──────────────────────────────────────────────────────────
// Wijzigingen t.o.v. v1:
// • Trainers kunnen zichzelf toevoegen/verwijderen van trainingen
// • beschikbaarheid-subcollectie afgeschaft → één bron: lesgevers[]
// • duurMinuten staat op groep (of manueel overschreven per training)
// • Export bevat lesgevers-kolom + duur
// • Seizoensextractie: alle groepen, per datum, met technieken
// • Tarieven-systeem via Firestore (geen hardcoded bedragen)
// • Minst hardcoded mogelijk: alles configureerbaar via Beheer
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
 seizoenBereikVanJaar,
} from '../components/trainingen/seizoenHelpers';
import ExcelUpload from '../components/trainingen/ExcelUpload';
import TrainingFormulier from '../components/trainingen/TrainingFormulier';
import TrainingKaart from '../components/trainingen/TrainingKaart';

// ─── Seizoensextractie ─────────────────────────────────────────────────────────
// Exporteert alle trainingen van het seizoen over alle groepen
async function exporteerSeizoen(seizoen, groepen, lesgeversLijst) {
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
 // ids omzetten naar namen voor export; onbekende id valt terug op de id zelf
 const lesgeversStr = (t.lesgevers || [])
 .map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id)
 .join(' + ');
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
async function exporteerGroepExcel(actieveGroepData, gefilterdeTrainingen, lesgeversLijst) {
 const rows = [
 [`Trainingsplanning ${actieveGroepData.naam} (${actieveGroepData.dag})`],
 ['Datum', 'Duur (min)', 'Basisvaardigheid', 'Techniek', 'Fase', 'Lesgevers', 'Opmerking'],
 ];
 for (const training of gefilterdeTrainingen) {
 const techSnap = await getDocs(query(collection(db, 'trainingen', training.id, 'technieken'), orderBy('volgorde')));
 const techs = techSnap.docs.map(d => d.data());
 // ids omzetten naar namen voor export
 const lesgeversStr = (training.lesgevers || [])
 .map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id)
 .join(' + ');
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
 const { isBeheerder, isTrainer, profiel, lesgeverId } = useAuth();
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
 const actieveSeizoen = `${actieveSeizoenStart}-${actieveSeizoenStart + 1}`;
 const { label: seizoenLabel } = seizoenBereikVanJaar(actieveSeizoenStart);
 const [lesgeversLijst, setLesgeversLijst] = useState([]);
 const [filterLesgever, setFilterLesgever] = useState('');
 const [filterMaand, setFilterMaand] = useState('alle');
 const [alleTrainingen, setAlleTrainingen] = useState([]);
 const [profielGroepTrainingen, setProfielGroepTrainingen] = useState([]);
 const [seizoensExportBezig, setSeizoenExportBezig] = useState(false);
 const [toonVoorbije, setToonVoorbije] = useState(false);
 const [filtersOpen, setFiltersOpen] = useState(false);
 const [beheerOpen, setBeheerOpen] = useState(false);

 // Laad groepen en zet initielegroep op basis van profielfavoriet
 // Reset wanneer profiel.groepen wijzigt (bijv. na opslaan in ProfielPagina)
 const profielGroepenSleutel = (profiel?.groepen || []).join(',');
 useEffect(() => {
 if (!profiel) return;
 getDocs(collection(db, 'groepen')).then(snap => {
 const g = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.naam.localeCompare(b.naam));
 setGroepen(g);
 if (g.length > 0) {
 const profielGroepen = profiel?.groepen || [];
 const favorieteGroepId = profielGroepen[0];
 const favorieteGroep = g.find(groep => groep.id === favorieteGroepId);
 setActieveGroep(favorieteGroep?.id || g[0].id);
 }
 });
 }, [profielGroepenSleutel]);

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

 // Laad trainingen voor alle profielgroepen (voor mijnVolgendeTraining widget)
 useEffect(() => {
 const groepen = profiel?.groepen || [];
 if (groepen.length === 0) {
 setProfielGroepTrainingen([]);
 return;
 }
 const seizoen = actieveSeizoen;
 const q = query(
 collection(db, 'trainingen'),
 where('seizoen', '==', seizoen),
 where('groepId', 'in', groepen.slice(0, 10)),
 orderBy('datum', 'asc')
 );
 const unsub = onSnapshot(q, snap => {
 setProfielGroepTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 });
 return unsub;
 }, [profiel?.groepen, actieveSeizoen]);

 // Reset maandfilter bij seizoenswissel
 useEffect(() => { setFilterMaand('alle'); }, [actieveSeizoenStart]);

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
 if (filterMaand !== 'alle') {
 const d = new Date(t.datum + 'T00:00:00');
 if (`${d.getFullYear()}-${d.getMonth()}` !== filterMaand) return false;
 }
 return true;
 });

 // Maandopties op basis van geladen trainingen (enkel maanden met data)
 const maandOpties = (() => {
 const gezien = new Set();
 const opties = [];
 for (const t of bronTrainingen) {
 const d = new Date(t.datum + 'T00:00:00');
 const key = `${d.getFullYear()}-${d.getMonth()}`;
 if (!gezien.has(key)) {
 gezien.add(key);
 opties.push({
 value: key,
 label: d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' }),
 });
 }
 }
 return opties;
 })();

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
 const profielGroepen = profiel?.groepen || [];

 // Trainer: kan zelf ook een training toevoegen (niet alleen bestuurslid/admin)
 const magTrainingToevoegen = isTrainer;

 // Future role zones:
 // - planning: lid, trainer, bestuurslid, admin
 // - filters: lid, trainer, bestuurslid, admin
 // - trainerActies: trainer, bestuurslid, admin
 // - beheerActies: bestuurslid, admin
 // - destructieveActies: admin
 const magBeheerActiesZien = isBeheerder;
 const magDestructieveActiesZien = isBeheerder;

 const vandaag = vandaagISO();
 const komendeTrainingen = gefilterdeTrainingen.filter(t => t.datum >= vandaag);
 const voorbijTrainingen = gefilterdeTrainingen.filter(t => t.datum < vandaag).reverse();
 const heeftActieveFilters = !!periodeStart || !!periodeEinde || !!filterLesgever || filterMaand !== 'alle';
 const geselecteerdeMaandLabel = maandOpties.find(o => o.value === filterMaand)?.label || filterMaand;
 const volgendeTraining = komendeTrainingen.find(t => t.id === volgendTrainingId) || komendeTrainingen[0];
 const toekomstigeTrainingen = [...profielGroepTrainingen, ...bronTrainingen]
 .filter(t => t.datum >= vandaagISO())
 .reduce((acc, t) => {
 if (!acc.find(x => x.id === t.id)) acc.push(t);
 return acc;
 }, [])
 .sort((a, b) => a.datum.localeCompare(b.datum));
 const favorieteGroepId = profielGroepen[0];
 const mijnVolgendeTraining = (() => {
 if (lesgeverId) {
 const lesgeverTraining = toekomstigeTrainingen.find(t => (t.lesgevers || []).includes(lesgeverId));
 if (lesgeverTraining) return lesgeverTraining;
 }
 if (favorieteGroepId) {
 const favorieteTraining = toekomstigeTrainingen.find(t => t.groepId === favorieteGroepId);
 if (favorieteTraining) return favorieteTraining;
 }
 if (profielGroepen.length > 0) {
 const profielTraining = toekomstigeTrainingen.find(t => profielGroepen.includes(t.groepId));
 if (profielTraining) return profielTraining;
 }
 return toekomstigeTrainingen[0] || null;
 })();
 const mijnVolgendeGroep = mijnVolgendeTraining
 ? groepen.find(g => g.id === mijnVolgendeTraining.groepId)
 : null;

 const duurLabel = (minuten) => {
 if (!minuten) return null;
 return minuten >= 60
 ? `${Math.floor(minuten / 60)}u${minuten % 60 ? (minuten % 60) + 'min' : ''}`
 : `${minuten}min`;
 };

 const lesgeversLabel = (training) => (training?.lesgevers || [])
 .map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id)
 .join(' + ');

 const scrollNaarTraining = (training) => {
 if (!training) return;
 if (training.groepId && training.groepId !== actieveGroep) setActieveGroep(training.groepId);
 setPeriodeStart('');
 setPeriodeEinde('');
 setFilterLesgever('');
 setTimeout(() => {
 const el = document.getElementById(`training-${training.id}`);
 if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
 }, 150);
 };

 const gaNaarVandaagOfVolgende = () => {
 const vandaag = vandaagISO();
 const bron = filterLesgever ? alleTrainingen.filter(t => (t.lesgevers || []).includes(filterLesgever)) : trainingen;
 const doel = bron.find(t => t.datum === vandaag) || bron.find(t => t.datum > vandaag);
 if (!doel) { toonMelding('Geen toekomstige training gevonden'); return; }
 scrollNaarTraining(doel);
 };

 const wisFilters = () => {
 setPeriodeStart('');
 setPeriodeEinde('');
 setFilterLesgever('');
 setFilterMaand('alle');
 };

 const verwijderSeizoen = async () => {
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
 };

 const buttonStyle = (accent = C.borderSoft) => ({
 padding: '8px 14px',
 background: C.card,
 border: `1px solid ${accent}`,
 borderRadius: '8px',
 color: C.textSec,
 cursor: 'pointer',
 fontSize: '13px',
 fontWeight: '600',
 });

 const renderPlanningHeader = () => (
 <div style={{ marginBottom: '16px', padding: '18px 20px', border: `1px solid ${C.borderSoft}`, borderRadius: '16px', background: 'linear-gradient(135deg, #0D1B2A 0%, #1B2A3D 100%)', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
 <div>
 <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' }}>🥋 Trainingsplanning</h1>
 </div>
 <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
 <span style={{ background: C.blueDim, border: `1px solid ${C.blue}`, color: C.blue, borderRadius: '999px', padding: '6px 10px', fontSize: '12px', fontWeight: '700' }}>
 {gefilterdeTrainingen.length} training(en)
 </span>
 {volgendeTraining && (
 <span style={{ background: C.greenDim, border: `1px solid ${C.green}`, color: C.green, borderRadius: '999px', padding: '6px 10px', fontSize: '12px', fontWeight: '700' }}>
 Volgende: {formatDatum(volgendeTraining.datum)}
 </span>
 )}
 </div>
 </div>
 </div>
 );

 const renderMijnVolgendeTrainingZone = () => (
 <section onClick={() => mijnVolgendeTraining && scrollNaarTraining(mijnVolgendeTraining)} role={mijnVolgendeTraining ? 'button' : undefined} aria-label={mijnVolgendeTraining ? 'Open mijn volgende training' : undefined} style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, #1B2A3D 100%)', border: `1px solid ${C.blue}`, borderRadius: '18px', padding: '18px', marginBottom: '16px', boxShadow: '0 12px 30px rgba(0,0,0,0.20)', cursor: mijnVolgendeTraining ? 'pointer' : 'default' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
 <div style={{ flex: '1 1 240px' }}>
 <div style={{ fontSize: '12px', color: C.blue, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: '8px' }}>
 Mijn volgende training
 </div>
 {mijnVolgendeTraining ? (
 <>
 <div style={{ fontSize: 'clamp(22px,6vw,32px)', lineHeight: 1.1, fontWeight: '900', color: C.textPrimary, marginBottom: '8px' }}>
 {formatDatum(mijnVolgendeTraining.datum)}
 </div>
 <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
 <span style={{ background: C.blueDim, border: `1px solid ${C.blue}`, color: C.blue, borderRadius: '999px', padding: '5px 10px', fontSize: '12px', fontWeight: '800' }}>
 {mijnVolgendeGroep?.naam || mijnVolgendeTraining.groepId}
 </span>
 {duurLabel(mijnVolgendeTraining.duurMinuten) && (
 <span style={{ background: C.greenDim, border: `1px solid ${C.green}`, color: C.green, borderRadius: '999px', padding: '5px 10px', fontSize: '12px', fontWeight: '800' }}>
 {duurLabel(mijnVolgendeTraining.duurMinuten)}
 </span>
 )}
 </div>
 {lesgeversLabel(mijnVolgendeTraining) && (
 <div style={{ fontSize: '13px', color: C.textSec, marginBottom: '6px' }}>
 Lesgevers: {lesgeversLabel(mijnVolgendeTraining)}
 </div>
 )}
 {mijnVolgendeTraining.opmerking && (
 <div style={{ fontSize: '13px', color: C.orange, background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: '8px', padding: '8px 10px', display: 'inline-block' }}>
 Planning/opmerking: {mijnVolgendeTraining.opmerking}
 </div>
 )}
 </>
 ) : (
 <div style={{ color: C.textSec, fontSize: '14px', lineHeight: 1.5 }}>
 Geen komende training gevonden voor jouw groepen.
 {profielGroepen.length === 0 && (
 <div style={{ marginTop: '4px', color: C.textMuted }}>
 Kies je standaardgroepen in Mijn profiel.
 </div>
 )}
 </div>
 )}
 </div>
 <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignSelf: 'stretch', alignItems: 'flex-end' }}>
 {mijnVolgendeTraining && (
 <button onClick={e => { e.stopPropagation(); scrollNaarTraining(mijnVolgendeTraining); }}
 style={{ minHeight: '44px', padding: '10px 14px', background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: '10px', color: C.blue, cursor: 'pointer', fontSize: '13px', fontWeight: '800' }}>
 Bekijk training
 </button>
 )}
 <button onClick={e => { e.stopPropagation(); gaNaarVandaagOfVolgende(); }}
 style={{ minHeight: '44px', padding: '10px 14px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '10px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '800' }}>
 Open planning
 </button>
 </div>
 </div>
 </section>
 );

 const renderGroepEnSeizoenZone = () => (
 <section style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
 <div style={{ fontSize: '12px', color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
 Groep en seizoen
 </div>
 <label style={{ display: 'block', fontSize: '11px', color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '6px' }}>
 Groep
 </label>
 <select
 value={actieveGroep}
 onChange={e => setActieveGroep(e.target.value)}
 style={{ width: '100%', minHeight: '44px', padding: '10px 12px', background: C.bg, border: `1px solid ${C.blue}`, borderRadius: '10px', color: C.textPrimary, fontSize: '14px', fontWeight: '700', marginBottom: '12px', cursor: 'pointer' }}
 >
 {groepen.map(g => (
 <option key={g.id} value={g.id}>
 {profielGroepen.includes(g.id) ? '★ ' : ''}{g.naam} ({g.dag})
 </option>
 ))}
 </select>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
 {groepen.map(g => (
 <button key={g.id} onClick={() => setActieveGroep(g.id)}
 style={{ padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actieveGroep === g.id ? C.red : C.bg, border: `1px solid ${actieveGroep === g.id ? C.red : C.borderSoft}`, color: actieveGroep === g.id ? '#fff' : C.textSec, boxShadow: actieveGroep === g.id ? `0 8px 18px ${C.redDim}` : 'none', whiteSpace: 'nowrap' }}>
 {profielGroepen.includes(g.id) ? '★ ' : ''}{g.naam} <span style={{ fontSize: '11px', opacity: 0.7 }}>({g.dag})</span>
 {profielGroepen.includes(g.id) && <span style={{ marginLeft: '6px', fontSize: '10px', color: actieveGroep === g.id ? '#fff' : C.blue }}>Mijn groep</span>}
 </button>
 ))}
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
 <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
 Seizoen:
 </span>
 <select
 value={actieveSeizoenStart}
 onChange={e => setActieveSeizoenStart(Number(e.target.value))}
 style={{
 padding: '7px 12px', background: C.bg, border: `1px solid ${C.red}`,
 borderRadius: '8px', color: C.textPrimary, fontSize: '13px', fontWeight: '700',
 cursor: 'pointer',
 }}
 >
 {beschikbareSeizoenStartJaren().map(startJaar => (
 <option key={startJaar} value={startJaar}>
 {startJaar}-{startJaar + 1}{startJaar === huidigSeizoenStartJaar() ? ' (huidig)' : ''}
 </option>
 ))}
 </select>
 </div>
 </section>
 );

 const renderPrimaireActiesZone = () => (
 <section style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
 <button
 onClick={gaNaarVandaagOfVolgende}
 style={{ minHeight: '44px', padding: '9px 14px', background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: '8px', color: C.blue, cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
 📅 Open planning
 </button>
 {magTrainingToevoegen && (
 <button onClick={openNieuweTraining}
 style={{ minHeight: '44px', padding: '9px 14px', background: C.red, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
 + Training
 </button>
 )}
 </section>
 );

 const renderMeerFiltersZone = () => (
 <section style={{ background: C.card, border: `1px solid ${heeftActieveFilters ? C.blue : C.borderSoft}`, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
 <button onClick={() => setFiltersOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', color: C.textPrimary, cursor: 'pointer', padding: 0 }}>
 <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Meer filters</span>
 <span style={{ fontSize: '12px', color: C.textMuted }}>{filtersOpen || heeftActieveFilters ? '▲' : '▼'}</span>
 </button>
 {(filtersOpen || heeftActieveFilters) && (
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px', alignItems: 'center' }}>
 <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
 {[{ label: 'Week', type: 'week' }, { label: 'Maand', type: 'maand' }, { label: 'Seizoen', type: 'seizoen' }, { label: 'Alles', type: 'alles' }].map(({ label, type }) => (
 <button key={type} onClick={() => stelPeriodeIn(type)}
 style={{ padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: C.bg, border: `1px solid ${C.borderSoft}`, color: C.textSec }}>
 {label}
 </button>
 ))}
 </div>
 <input type="date" value={periodeStart} onChange={e => setPeriodeStart(e.target.value)}
 style={{ padding: '8px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px' }} />
 <span style={{ color: C.textMuted }}>→</span>
 <input type="date" value={periodeEinde} onChange={e => setPeriodeEinde(e.target.value)}
 style={{ padding: '8px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px' }} />
 <select value={filterLesgever} onChange={e => setFilterLesgever(e.target.value)}
 style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${filterLesgever ? C.purple : C.borderSoft}`, borderRadius: '8px', color: filterLesgever ? C.purple : C.textSec, fontSize: '13px', cursor: 'pointer' }}>
 <option value="">👤 Alle lesgevers</option>
 {lesgeversLijst.map(l => <option key={l.id} value={l.id}>{l.naam}</option>)}
 </select>
 <select value={filterMaand} onChange={e => setFilterMaand(e.target.value)}
 style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${filterMaand !== 'alle' ? C.red : C.borderSoft}`, borderRadius: '8px', color: filterMaand !== 'alle' ? C.textPrimary : C.textSec, fontSize: '13px', cursor: 'pointer' }}>
 <option value="alle">📅 Alle maanden</option>
 {maandOpties.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
 </select>
 <button onClick={wisFilters} style={{ padding: '8px 12px', background: 'transparent', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textMuted, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
 Wis filters
 </button>
 </div>
 )}
 </section>
 );

 const renderBeheerActiesZone = () => {
 if (!magBeheerActiesZien) return null;
 return (
 <section style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
 <button onClick={() => setBeheerOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', color: C.textPrimary, cursor: 'pointer', padding: 0 }}>
 <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Beheeracties</span>
 <span style={{ fontSize: '12px', color: C.textMuted }}>{beheerOpen ? '▲' : '▼'}</span>
 </button>
 {beheerOpen && (
 <div style={{ marginTop: '14px' }}>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
 <button onClick={() => setExcelOpen(true)} style={buttonStyle()}>
 📥 Import
 </button>
 <button onClick={async () => {
 setSeizoenExportBezig(true);
 try { await exporteerGroepExcel(actieveGroepData, gefilterdeTrainingen, lesgeversLijst); toonMelding('Export klaar'); }
 catch (e) { alert('Export mislukt: ' + e.message); }
 finally { setSeizoenExportBezig(false); }
 }} style={buttonStyle()}>
 📤 Export
 </button>
 <button onClick={async () => {
 setSeizoenExportBezig(true);
 try { await exporteerSeizoen(actieveSeizoen, groepen, lesgeversLijst); toonMelding('Seizoensextractie klaar'); }
 catch (e) { alert('Extractie mislukt: ' + e.message); }
 finally { setSeizoenExportBezig(false); }
 }} disabled={seizoensExportBezig}
 style={{ ...buttonStyle(), opacity: seizoensExportBezig ? 0.6 : 1 }}>
 📊 Seizoen
 </button>
 {selectieModus ? (
 <>
 <span style={{ fontSize: '12px', color: C.textMuted, alignSelf: 'center' }}>{geselecteerd.size} geselecteerd</span>
 <button onClick={bulkVerwijder} disabled={geselecteerd.size === 0}
 style={{ padding: '8px 14px', background: geselecteerd.size > 0 ? C.redDim : 'transparent', border: `1px solid ${geselecteerd.size > 0 ? C.red : C.borderSoft}`, borderRadius: '8px', color: geselecteerd.size > 0 ? C.red : C.textMuted, cursor: geselecteerd.size > 0 ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '600' }}>
 🗑 Verwijder ({geselecteerd.size})
 </button>
 <button onClick={() => { setSelectieModus(false); setGeselecteerd(new Set()); }} style={buttonStyle()}>
 Annuleren
 </button>
 </>
 ) : (
 <button onClick={() => setSelectieModus(true)} style={buttonStyle()}>
 ☑ Selecteren
 </button>
 )}
 </div>
 {magDestructieveActiesZien && (
 <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: '14px' }}>
 <div style={{ fontSize: '11px', color: C.red, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
 Gevaarlijke acties
 </div>
 <button onClick={verwijderSeizoen}
 style={{ padding: '8px 14px', background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', color: C.red, cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
 Seizoen wissen
 </button>
 </div>
 )}
 </div>
 )}
 </section>
 );
 };

 const renderActieveFiltersZone = () => {
 if (!heeftActieveFilters) return null;
 return (
 <section style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
 {periodeStart || periodeEinde ? (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.blueDim, border: `1px solid ${C.blue}`, color: C.blue, fontSize: '12px', fontWeight: '700' }}>
 Periode: {periodeStart || '-'} - {periodeEinde || '-'}
 <button onClick={() => { setPeriodeStart(''); setPeriodeEinde(''); }} style={{ background: 'transparent', border: 'none', color: C.blue, cursor: 'pointer', padding: 0 }}>x</button>
 </span>
 ) : null}
 {filterLesgever && (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontSize: '12px', fontWeight: '700' }}>
 Lesgever: {lesgeversLijst.find(l => l.id === filterLesgever)?.naam ?? filterLesgever}
 <button onClick={() => setFilterLesgever('')} style={{ background: 'transparent', border: 'none', color: C.purple, cursor: 'pointer', padding: 0 }}>x</button>
 </span>
 )}
 {filterMaand !== 'alle' && (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.redDim, border: `1px solid ${C.red}`, color: C.red, fontSize: '12px', fontWeight: '700' }}>
 Maand: {geselecteerdeMaandLabel}
 <button onClick={() => setFilterMaand('alle')} style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', padding: 0 }}>x</button>
 </span>
 )}
 </section>
 );
 };

 const renderTrainingenLijstZone = () => (
 actieveGroepData && (
 <section style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '16px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
 <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
 {filterLesgever
 ? `${lesgeversLijst.find(l => l.id === filterLesgever)?.naam ?? filterLesgever} - alle groepen - ${gefilterdeTrainingen.length} training(en)`
 : `${actieveGroepData.naam} - ${actieveGroepData.dag} - ${gefilterdeTrainingen.length} training(en)`}
 </div>
 </div>
 {komendeTrainingen.length === 0 && voorbijTrainingen.length === 0 ? (
 <div style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '32px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>
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
 {/* Komende trainingen */}
 {komendeTrainingen.length > 0 && (
 <>
 <div style={{ fontSize: '11px', fontWeight: '800', color: C.blue, textTransform: 'uppercase', letterSpacing: '1.4px', marginTop: '4px', padding: '4px 2px' }}>
 Komend ({komendeTrainingen.length})
 </div>
 {komendeTrainingen.map(training => (
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
 </>
 )}
 {/* Voorbije trainingen - collapsible */}
 {voorbijTrainingen.length > 0 && (
 <>
 <button
 onClick={() => setToonVoorbije(v => !v)}
 style={{
 display: 'flex', alignItems: 'center', gap: '8px',
 background: 'transparent', border: `1px solid ${C.borderSoft}`,
 borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
 color: C.textMuted, fontSize: '12px', fontWeight: '600',
 marginTop: '8px',
 }}
 >
 <span>{toonVoorbije ? '▲' : '▼'}</span>
 Voorbije trainingen ({voorbijTrainingen.length})
 </button>
 {toonVoorbije && voorbijTrainingen.map(training => (
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
 isVolgende={false}
 onToggleSelectie={() => toggleSelectie(training.id)}
 onBewerken={() => openBewerken(training)}
 onVerwijderen={() => verwijderTraining(training)}
 />
 ))}
 </>
 )}
 </div>
 )}
 </section>
 )
 );

 return (
 <div className="page-trainingen" style={{ background: C.bg, minHeight: '100vh', color: C.textPrimary, padding: '20px', paddingBottom: '48px', borderRadius: '16px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}>
 {/* Toast melding */}
 {melding && (
 <div style={{ position: 'fixed', top: '70px', right: '16px', zIndex: 300, background: C.green, color: '#fff', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
 ✓ {melding}
 </div>
 )}

 {/* Zone 1 - PlanningHeader */}
 {renderPlanningHeader()}

 {/* Mobile focus - Mijn volgende training */}
 {renderMijnVolgendeTrainingZone()}

 {/* Zone 2 - GroepEnSeizoenZone */}
 {renderGroepEnSeizoenZone()}

 {/* Zone 3 - PrimaireActiesZone */}
 {renderPrimaireActiesZone()}

 {/* Zone 4 - MeerFiltersZone */}
 {renderMeerFiltersZone()}

 {/* Zone 5 - BeheerActiesZone */}
 {renderBeheerActiesZone()}

 {/* Zone 6 - ActieveFiltersZone */}
 {renderActieveFiltersZone()}

 {/* Zone 7 - TrainingenLijstZone */}
 {renderTrainingenLijstZone()}

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
