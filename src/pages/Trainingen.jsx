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
import { useParams, useNavigate } from 'react-router-dom';
import {
 collection, query, where, orderBy, onSnapshot, getDocs,
 doc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLesgeversRealtime } from '../hooks/useLesgeversRealtime';
import { useConfirm } from '../contexts/ConfirmContext';
import { Workbook } from 'exceljs';
import { C } from '../components/trainingen/tokens';
import {
 vandaagISO,
 formatDatum,
 beschikbareSeizoenStartJaren,
 huidigSeizoenStartJaar,
  getSeizoenSettings,
 seizoenBereikVanJaar,
} from '../components/trainingen/seizoenHelpers';
import ExcelUpload from '../components/trainingen/ExcelUpload';
import TrainingFormulier from '../components/trainingen/TrainingFormulier';
import TrainerModus from '../components/trainingen/TrainerModus';
import GroepKiezer from '../components/trainingen/GroepKiezer';
import TrainingDetailPanel from '../components/details/TrainingDetailPanel';
import { DEFAULT_GEEN_TRAINING_MARKERS, markersUitSettings, getClubSettings } from '../services/firestoreService';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../components/trainingen/trainingStatus';
import { vindLesgever } from '../components/uitbetalingen/uitbetalingHelpers';
import VolgendeDagWidget from '../components/trainingen/VolgendeDagWidget';
import TrainingenLijst from '../components/trainingen/TrainingenLijst';
import BeheerZone from '../components/trainingen/BeheerZone';
import WedstrijdDetailPanel from '../components/details/WedstrijdDetailPanel';
import { usePaginaTitelOverride } from '../contexts/PaginaTitelContext';

const STANDAARD_MODUS_KEY = 'trainingenStandaardModus';

// ─── Seizoensextractie ─────────────────────────────────────────────────────────
// Exporteert alle trainingen van het seizoen over alle groepen
async function exporteerSeizoen(seizoen, groepen, lesgeversLijst, wedstrijdEvents = []) {
 const snap = await getDocs(query(
 collection(db, 'trainingen'),
 where('seizoen', '==', seizoen),
 orderBy('datum', 'asc'),
 ));
 // Technieken voor alle trainingen parallel laden i.p.v. sequentieel
 const techSnaps = await Promise.all(
   snap.docs.map(d => getDocs(query(collection(db, 'trainingen', d.id, 'technieken'), orderBy('volgorde'))))
 );
 const evByDatum = {};
 wedstrijdEvents.forEach(e => {
   const d = e.datum || e.date || '';
   if (d) { evByDatum[d] = evByDatum[d] || []; evByDatum[d].push(e); }
 });
 const rows = [
 [`Seizoensextractie ${seizoen}`, '', '', '', '', '', '', ''],
 ['Datum', 'Groep', 'Duur (min)', 'Lesgevers', 'Techniek', 'Fase', 'Opmerking', 'Wedstrijd'],
 ];
 snap.docs.forEach((d, idx) => {
 const t = d.data();
 const groep = groepen.find(g => g.id === t.groepId);
 const groepNaam = groep?.naam || t.groepId;
 // ids omzetten naar namen voor export; onbekende id valt terug op de id zelf
 const lesgeversStr = (t.lesgevers || [])
 .map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id)
 .join(' + ');
 const duur = t.duurMinuten || '';
 const techs = techSnaps[idx].docs.map(td => td.data());
 let wedstrijdTekst = '';
 if (groep?.dag?.toLowerCase() === 'zaterdag' && wedstrijdEvents.length) {
   const zo = new Date(t.datum + 'T00:00:00');
   zo.setDate(zo.getDate() + 1);
   const zoStr = zo.toISOString().slice(0, 10);
   const zaW = (evByDatum[t.datum] || []).map(e => `${e.naam || 'Wedstrijd'} (za)`);
   const zoW = (evByDatum[zoStr] || []).map(e => `${e.naam || 'Wedstrijd'} (zo)`);
   wedstrijdTekst = [...zaW, ...zoW].join(', ');
 }
 if (techs.length === 0) {
 rows.push([t.datum, groepNaam, duur, lesgeversStr, '', '', t.opmerking || '', wedstrijdTekst]);
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
 i === 0 ? wedstrijdTekst : '',
 ]);
 });
 }
 });
 const wb = new Workbook();
 const ws = wb.addWorksheet('Seizoen');
 ws.columns = [{ width: 14 }, { width: 16 }, { width: 10 }, { width: 25 }, { width: 25 }, { width: 12 }, { width: 30 }, { width: 30 }];
 ws.addRows(rows);
 const buffer = await wb.xlsx.writeBuffer();
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `seizoen_${seizoen}_extractie.xlsx`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
}

// ─── Groep export (bestaande functionaliteit, nu met lesgevers + duur) ─────────
async function exporteerGroepExcel(actieveGroepData, gefilterdeTrainingen, lesgeversLijst) {
 // Technieken voor alle trainingen parallel laden i.p.v. sequentieel
 const techSnaps = await Promise.all(
   gefilterdeTrainingen.map(t => getDocs(query(collection(db, 'trainingen', t.id, 'technieken'), orderBy('volgorde'))))
 );
 const rows = [
 [`Trainingsplanning ${actieveGroepData.naam} (${actieveGroepData.dag})`],
 ['Datum', 'Duur (min)', 'Basisvaardigheid', 'Techniek', 'Fase', 'Lesgevers', 'Opmerking', 'Wedstrijd'],
 ];
 gefilterdeTrainingen.forEach((training, idx) => {
 const techs = techSnaps[idx].docs.map(d => d.data());
 // ids omzetten naar namen voor export
 const lesgeversStr = (training.lesgevers || [])
 .map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id)
 .join(' + ');
 const wedstrijdTekst = (training._wedstrijdInfo || [])
   .map(w => `${w.naam} (${w.dag === 'zondag' ? 'zo' : 'za'})`).join(', ');
 if (techs.length === 0) {
 rows.push([training.datum, training.duurMinuten || '', '', '', '', lesgeversStr, training.opmerking || '', wedstrijdTekst]);
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
 i === 0 ? wedstrijdTekst : '',
 ]);
 });
 }
 });
 const wb = new Workbook();
 const ws = wb.addWorksheet(actieveGroepData.naam);
 ws.columns = [{ width: 14 }, { width: 10 }, { width: 20 }, { width: 25 }, { width: 12 }, { width: 25 }, { width: 30 }, { width: 30 }];
 ws.addRows(rows);
 const buffer = await wb.xlsx.writeBuffer();
 const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `trainingen_${actieveGroepData.id}_export.xlsx`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
}

// ─── Hoofd component ───────────────────────────────────────────────────────────
export default function Trainingen() {
 const { isBeheerder, isTrainer, profiel, lesgeverId, configCache } = useAuth();
 const confirm = useConfirm();
 const { id: detailId } = useParams();
 const navigate = useNavigate();
 usePaginaTitelOverride(detailId ? 'Training detail' : null);
 const [groepen, setGroepen] = useState([]);
 const [trainingen, setTrainingen] = useState([]);
 const [modus, setModus] = useState(() => {
   if (typeof window === 'undefined') return 'trainer';
   return localStorage.getItem(STANDAARD_MODUS_KEY) || 'trainer';
 });
 const [standaardModus, setStandaardModus] = useState(() => {
   if (typeof window === 'undefined') return 'trainer';
   return localStorage.getItem(STANDAARD_MODUS_KEY) || 'trainer';
 });
 const [technieken, setTechnieken] = useState([]);
 const [actieveGroep, setActieveGroep] = useState('');
 const [periodeStart, setPeriodeStart] = useState('');
 const [periodeEinde, setPeriodeEinde] = useState('');
 const [melding, setMelding] = useState('');
 const [formulierOpen, setFormulierOpen] = useState(false);
 const [formulierDatum, setFormulierDatum] = useState('');
 const [formulierTraining, setFormulierTraining] = useState(null);
 const [excelOpen, setExcelOpen] = useState(false);
const [filtersOpen, setFiltersOpen] = useState(false);
 const [actieveSeizoenStart, setActieveSeizoenStart] = useState(huidigSeizoenStartJaar());
 const actieveSeizoen = `${actieveSeizoenStart}-${actieveSeizoenStart + 1}`;
 const { label: seizoenLabel } = seizoenBereikVanJaar(actieveSeizoenStart);
 const [lesgeversLijst, setLesgeversLijst] = useState([]);
  const { lesgevers: lesgeversData, loading: lesgeversLaden } = useLesgeversRealtime();
 const [filterLesgever, setFilterLesgever] = useState('');
 const [filterMaand, setFilterMaand] = useState('alle');
 const [filterDag, setFilterDag] = useState('');
 const [filterStatus, setFilterStatus] = useState('');
 const [alleTrainingen, setAlleTrainingen] = useState([]);
 const [profielGroepTrainingen, setProfielGroepTrainingen] = useState([]);
 const [lesgeverTrainingen, setLesgeverTrainingen] = useState([]);
 const [geenTrainingMarkers, setGeenTrainingMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);
 const [wedstrijdEvents, setWedstrijdEvents] = useState([]);
 const [openWedstrijdId, setOpenWedstrijdId] = useState(null);

 // Laad groepen en zet initielegroep op basis van profielfavoriet
 // Reset wanneer profiel.groepen of configCache.groepen wijzigt
 const profielGroepenSleutel = (profiel?.groepen || []).join(',');
 const cacheGroepenSleutel = (configCache?.groepen || []).map(g => g.id).join(',');
 useEffect(() => {
 if (!profiel) return;
 const g = (configCache?.groepen || []).slice().sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
 setGroepen(g);
 if (g.length > 0) {
 const profielGroepen = profiel?.groepen || [];
 const favorieteGroepId = profielGroepen[0];
 const favorieteGroep = g.find(groep => groep.id === favorieteGroepId);
 setActieveGroep(favorieteGroep?.id || g[0].id);
 }
 }, [profielGroepenSleutel, cacheGroepenSleutel]);

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

 // Laad alle trainingen van het seizoen (voor lesgever- of dag-filter modus)
 useEffect(() => {
 if (!filterLesgever && !filterDag) { setAlleTrainingen([]); return; }
 const q = query(collection(db, 'trainingen'), where('seizoen', '==', actieveSeizoen), orderBy('datum', 'asc'));
 getDocs(q).then(snap => {
 setAlleTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 });
 }, [filterLesgever, filterDag, actieveSeizoen]);

 // Laad trainingen voor alle profielgroepen (voor mijnVolgendeTraining widget) — eenmalig
 useEffect(() => {
 const groepen = profiel?.groepen || [];
 if (groepen.length === 0) { setProfielGroepTrainingen([]); return; }
 const q = query(
 collection(db, 'trainingen'),
 where('seizoen', '==', actieveSeizoen),
 where('groepId', 'in', groepen.slice(0, 10)),
 orderBy('datum', 'asc')
 );
 getDocs(q).then(snap => {
 setProfielGroepTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 });
 }, [profiel?.groepen, actieveSeizoen]);

 // Laad trainingen waar de gebruiker zelf als lesgever staat — eenmalig
 useEffect(() => {
 if (!lesgeverId) { setLesgeverTrainingen([]); return; }
 const q = query(collection(db, 'trainingen'), where('lesgevers', 'array-contains', lesgeverId));
 getDocs(q).then(snap => {
 setLesgeverTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 }).catch(() => setLesgeverTrainingen([]));
 }, [lesgeverId]);

 // Reset maandfilter bij seizoenswissel
 useEffect(() => { setFilterMaand('alle'); }, [actieveSeizoenStart]);

 // Laad techniekendatabank
 useEffect(() => {
 getDocs(collection(db, 'technieken')).then(snap => {
 setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 });
 }, []);

  // Sync lesgeversLijst vanuit gedeelde context (één Firestore-listener voor hele app)
  useEffect(() => {
    setLesgeversLijst(lesgeversData.filter(l => l.actief !== false));
  }, [lesgeversData]);

 // Laad geen-training markers
 useEffect(() => {
 getClubSettings().then(settings => {
 if (settings) setGeenTrainingMarkers(markersUitSettings(settings));
 });
 }, []);

 // Laad wedstrijden voor het actieve seizoen (weekendinfo op zaterdag-trainingen)
 useEffect(() => {
 const { start, einde } = seizoenBereikVanJaar(actieveSeizoenStart);
 getDocs(query(
   collection(db, 'events'),
   where('type', '==', 'wedstrijd'),
   where('datum', '>=', start),
   where('datum', '<=', einde)
 )).then(snap => {
   setWedstrijdEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 }).catch(() => {});
 }, [actieveSeizoenStart]);

 const bronTrainingen = (filterLesgever || filterDag) ? alleTrainingen : trainingen;
 const gefilterdeTrainingen = bronTrainingen.filter(t => {
 if (periodeStart && t.datum < periodeStart) return false;
 if (periodeEinde && t.datum > periodeEinde) return false;
 if (filterLesgever && !(t.lesgevers || []).some(key => vindLesgever(key, lesgeversLijst)?.id === filterLesgever)) return false;
 if (filterDag) {
 const d = new Date(t.datum + 'T00:00:00');
 if (String(d.getDay()) !== filterDag) return false;
 }
 if (filterMaand !== 'alle') {
 const d = new Date(t.datum + 'T00:00:00');
 if (`${d.getFullYear()}-${d.getMonth()}` !== filterMaand) return false;
 }
 if (filterStatus && bepaalTrainingStatus(t) !== filterStatus) return false;
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
      const { startMaand: sm, eindMaand: em, eindDag: ed } = getSeizoenSettings();
      const seizoenStart = maand >= sm - 1 ? new Date(jaar, sm - 1, 1) : new Date(jaar - 1, sm - 1, 1);
      const seizoenEinde = new Date(seizoenStart.getFullYear() + 1, em - 1, ed);
 setPeriodeStart(seizoenStart.toISOString().slice(0, 10));
 setPeriodeEinde(seizoenEinde.toISOString().slice(0, 10));
 } else {
 setPeriodeStart(''); setPeriodeEinde('');
 }
 };

 const openNieuweTraining = () => { setFormulierDatum(vandaagISO()); setFormulierTraining(null); setFormulierOpen(true); };
 const openBewerken = (training) => { setFormulierDatum(training.datum); setFormulierTraining(training); setFormulierOpen(true); };

 const verwijderTraining = async (training) => {
 const ok = await confirm({
 titel: 'Training verwijderen?',
 beschrijving: `Training van ${formatDatum(training.datum)} wordt definitief verwijderd, inclusief alle gekoppelde technieken.`,
 bevestigLabel: 'Ja, verwijderen',
 variant: 'danger',
 });
 if (!ok) return;
 try {
 const techSnap = await getDocs(collection(db, 'trainingen', training.id, 'technieken'));
 for (const d of techSnap.docs) await deleteDoc(d.ref);
 await deleteDoc(doc(db, 'trainingen', training.id));
 toonMelding('Training verwijderd');
 } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
 };

 const actieveGroepData = groepen.find(g => g.id === actieveGroep);
 const profielGroepen = profiel?.groepen || [];

 // Verrijk gefilterde trainingen met weekendwedstrijdinfo voor zaterdag-groepen
 const _wByDatum = {};
 wedstrijdEvents.forEach(e => {
   const d = e.datum || e.date || '';
   if (d) { _wByDatum[d] = _wByDatum[d] || []; _wByDatum[d].push(e); }
 });
 const _groepCats = actieveGroepData?.categorieen || [];
 const _wRelevant = (e) => {
   const dc = e.doelgroepCodes || [];
   if (dc.length === 0 || _groepCats.length === 0) return true;
   return dc.some(cat => _groepCats.includes(cat));
 };
 const gefilterdeTrainingenMet = (actieveGroepData?.dag?.toLowerCase() === 'zaterdag' && wedstrijdEvents.length)
   ? gefilterdeTrainingen.map(t => {
       const zo = new Date(t.datum + 'T00:00:00');
       zo.setDate(zo.getDate() + 1);
       const zoStr = zo.toISOString().slice(0, 10);
       const zaW = (_wByDatum[t.datum] || []).filter(_wRelevant).map(e => ({ eventId: e.id, naam: e.naam || e.name || 'Wedstrijd', dag: 'zaterdag' }));
       const zoW = (_wByDatum[zoStr] || []).filter(_wRelevant).map(e => ({ eventId: e.id, naam: e.naam || e.name || 'Wedstrijd', dag: 'zondag' }));
       const info = [...zaW, ...zoW];
       return info.length ? { ...t, _wedstrijdInfo: info } : t;
     })
   : gefilterdeTrainingen;

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
 const komendeTrainingen = gefilterdeTrainingenMet.filter(t => t.datum >= vandaag);
 const voorbijTrainingen = gefilterdeTrainingenMet.filter(t => t.datum < vandaag).reverse();
 const heeftActieveFilters = !!periodeStart || !!periodeEinde || !!filterLesgever || filterMaand !== 'alle' || !!filterDag || !!filterStatus;
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
 // Eerstvolgende training waar jij als lesgever staat — over alle groepen,
 // ook groepen buiten je profiel/de actieve groep.
 const eigenLes = lesgeverTrainingen
 .filter(t => t.datum >= vandaagISO() && !t.geannuleerd)
 .sort((a, b) => a.datum.localeCompare(b.datum))[0];
 if (eigenLes) return eigenLes;
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
 // Alle trainingen van de eerstvolgende lesdag (je kan meerdere groepen op
 // dezelfde dag lesgeven). Valt terug op de enkele volgende training.
 const volgendeDagTrainingen = (() => {
 if (!mijnVolgendeTraining) return [];
 const dag = mijnVolgendeTraining.datum;
 const eigenDieDag = lesgeverTrainingen
 .filter(t => t.datum === dag && !t.geannuleerd)
 .reduce((acc, t) => { if (!acc.find(x => x.id === t.id)) acc.push(t); return acc; }, []);
 const lijst = eigenDieDag.length > 0 ? eigenDieDag : [mijnVolgendeTraining];
 return lijst.sort((a, b) => (a.startTijd || '').localeCompare(b.startTijd || '')
 || (a.groepId || '').localeCompare(b.groepId || ''));
 })();

 const lesgeversLabel = (training) => (training?.lesgevers || [])
 .map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id)
 .join(' + ');

 const scrollNaarTraining = (training) => {
 if (!training) return;
 if (training.groepId && training.groepId !== actieveGroep) setActieveGroep(training.groepId);
 setPeriodeStart('');
 setPeriodeEinde('');
 setFilterLesgever('');
 setFilterDag('');
 setFilterStatus('');
 setTimeout(() => {
 const el = document.getElementById(`training-${training.id}`);
 if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
 }, 150);
 };

 const gaNaarVandaagOfVolgende = () => {
 const vandaag = vandaagISO();
 const bron = filterLesgever ? alleTrainingen.filter(t => (t.lesgevers || []).some(key => vindLesgever(key, lesgeversLijst)?.id === filterLesgever)) : trainingen;
 const doel = bron.find(t => t.datum === vandaag) || bron.find(t => t.datum > vandaag);
 if (!doel) { toonMelding('Geen toekomstige training gevonden'); return; }
 scrollNaarTraining(doel);
 };

 const wisFilters = () => {
 setPeriodeStart('');
 setPeriodeEinde('');
 setFilterLesgever('');
 setFilterMaand('alle');
 setFilterDag('');
 setFilterStatus('');
 };

 const verwijderSeizoen = async () => {
 const ok = await confirm({
 titel: 'Volledig seizoen verwijderen?',
 beschrijving: `Alle trainingen van seizoen ${actieveSeizoen} voor ${actieveGroepData?.naam} worden definitief verwijderd. Deze actie kan niet ongedaan gemaakt worden.`,
 bevestigLabel: 'Ja, verwijder seizoen',
 variant: 'danger',
 });
 if (!ok) return;
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
 {gefilterdeTrainingenMet.length} training(en)
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

 const renderGroepEnSeizoenZone = () => (
 <section style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
 <div style={{ fontSize: '12px', color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '12px' }}>
 Groep en seizoen
 </div>
 <label style={{ display: 'block', fontSize: '11px', color: C.textMuted, fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: '6px' }}>
 Groep
 </label>
 <div style={{ marginBottom: '14px' }}>
 <GroepKiezer groepen={groepen} actieveGroep={actieveGroep} onKies={setActieveGroep} profielGroepen={profielGroepen} />
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
 <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
   <span style={{ fontSize: '11px', color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginRight: '2px' }}>Dag:</span>
   {[{ label: 'Alle', value: '' }, { label: 'Wo', value: '3' }, { label: 'Za', value: '6' }].map(({ label, value }) => (
     <button key={value || 'alle'} onClick={() => setFilterDag(value)}
       style={{ padding: '6px 12px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
         background: filterDag === value ? C.orangeDim : C.bg,
         border: `1px solid ${filterDag === value ? C.orange : C.borderSoft}`,
         color: filterDag === value ? C.orange : C.textSec }}>
       {label}
     </button>
   ))}
 </div>
 <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
   style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${filterStatus ? C.orange : C.borderSoft}`, borderRadius: '8px', color: filterStatus ? C.orange : C.textSec, fontSize: '13px', cursor: 'pointer' }}>
   <option value="">📊 Alle statussen</option>
   <option value={TRAINING_STATUS.NORMAAL}>🥋 Gewone training</option>
   <option value={TRAINING_STATUS.GEEN}>🚫 Geen training</option>
   <option value={TRAINING_STATUS.SAMENGEVOEGD}>🔗 Samengevoegd</option>
 </select>
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

 const renderActieveFiltersZone = () => {
 if (!heeftActieveFilters) return null;
 return (
 <section style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
 {periodeStart || periodeEinde ? (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.blueDim, border: `1px solid ${C.blue}`, color: C.blue, fontSize: '12px', fontWeight: '700' }}>
 Periode: {periodeStart || '-'} - {periodeEinde || '-'}
 <button onClick={() => { setPeriodeStart(''); setPeriodeEinde(''); }} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', minWidth: '24px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>×</button>
 </span>
 ) : null}
 {filterLesgever && (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontSize: '12px', fontWeight: '700' }}>
 Lesgever: {lesgeversLijst.find(l => l.id === filterLesgever)?.naam ?? filterLesgever}
 <button onClick={() => setFilterLesgever('')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', minWidth: '24px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>×</button>
 </span>
 )}
 {filterMaand !== 'alle' && (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.redDim, border: `1px solid ${C.red}`, color: C.red, fontSize: '12px', fontWeight: '700' }}>
 Maand: {geselecteerdeMaandLabel}
 <button onClick={() => setFilterMaand('alle')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', minWidth: '24px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>×</button>
 </span>
 )}
 {filterDag && (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.orangeDim, border: `1px solid ${C.orange}`, color: C.orange, fontSize: '12px', fontWeight: '700' }}>
 Dag: {filterDag === '3' ? 'Woensdag' : filterDag === '6' ? 'Zaterdag' : filterDag}
 <button onClick={() => setFilterDag('')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', minWidth: '24px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>×</button>
 </span>
 )}
 {filterStatus && (
 <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '999px', background: C.orangeDim, border: `1px solid ${C.orange}`, color: C.orange, fontSize: '12px', fontWeight: '700' }}>
 Status: {filterStatus === TRAINING_STATUS.NORMAAL ? 'Gewone training' : filterStatus === TRAINING_STATUS.GEEN ? 'Geen training' : filterStatus === TRAINING_STATUS.SAMENGEVOEGD ? 'Samengevoegd' : filterStatus}
 <button onClick={() => setFilterStatus('')} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: '0 0 0 4px', minWidth: '24px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '12px', lineHeight: 1, fontFamily: 'inherit' }}>×</button>
 </span>
 )}
 </section>
 );
 };

 const wijzigModus = (nieuw) => setModus(nieuw);

 const maakStandaard = () => {
   setStandaardModus(modus);
   try { localStorage.setItem(STANDAARD_MODUS_KEY, modus); } catch { /* ignore */ }
   toonMelding(`${modus === 'trainer' ? 'Trainer' : 'Beheer'} is nu je standaardmodule`);
 };

 const modusToggle = (
 <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
 <div style={{ display: 'flex', gap: '6px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
 {[['beheer', '📋 Beheer'], ['trainer', '📱 Trainer']].map(([id, label]) => (
 <button key={id} onClick={() => wijzigModus(id)} style={{
 padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer',
 fontSize: '14px', fontWeight: modus === id ? '700' : '500', fontFamily: 'inherit',
 background: modus === id ? C.red : 'transparent',
 color: modus === id ? '#fff' : C.textSec,
 }}>{label}{standaardModus === id ? ' ★' : ''}</button>
 ))}
 </div>
 {modus !== standaardModus && (
 <button onClick={maakStandaard} style={{
 padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit',
 fontSize: '12px', fontWeight: '700', background: 'transparent',
 border: `1px solid ${C.borderSoft}`, color: C.textSec,
 }}>★ Maak standaard</button>
 )}
 </div>
 );

 if (modus === 'trainer') {
 return (
 <div className="page-trainingen">
 {modusToggle}
 <TrainerModus
 groepen={groepen}
 lesgeversLijst={lesgeversLijst}
 lesgeverTrainingen={lesgeverTrainingen}
 profielGroepen={profielGroepen}
 actieveGroep={actieveGroep}
 onKiesGroep={setActieveGroep}
 />
 </div>
 );
 }

 return (
 <div className="page-trainingen">
 {/* Toast melding */}
 {melding && (
 <div style={{ position: 'fixed', top: '70px', right: '16px', zIndex: 300, background: C.green, color: '#fff', padding: '10px 16px', borderRadius: '10px', fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
 ✓ {melding}
 </div>
 )}

 {modusToggle}

 {/* Zone 1 - PlanningHeader */}
 {renderPlanningHeader()}

 {/* Mijn volgende training */}
      <VolgendeDagWidget
        mijnVolgendeTraining={mijnVolgendeTraining}
        volgendeDagTrainingen={volgendeDagTrainingen}
        groepen={groepen}
        technieken={technieken}
        lesgeversLijst={lesgeversLijst}
        profielGroepen={profielGroepen}
      />

      {/* Zone 2 - GroepEnSeizoenZone */}
      {renderGroepEnSeizoenZone()}

      {/* Zone 3 - PrimaireActiesZone */}
      {renderPrimaireActiesZone()}

      {/* Zone 4 - Filters */}
      {renderMeerFiltersZone()}

      {/* Zone 5 - Beheer */}
      <BeheerZone
        magBeheerActiesZien={magBeheerActiesZien}
        magDestructieveActiesZien={magDestructieveActiesZien}
        actieveGroepData={actieveGroepData}
        gefilterdeTrainingen={gefilterdeTrainingenMet}
        lesgeversLijst={lesgeversLijst}
        actieveSeizoen={actieveSeizoen}
        groepen={groepen}
        onImport={() => setExcelOpen(true)}
        onExportGroep={() => exporteerGroepExcel(actieveGroepData, gefilterdeTrainingenMet, lesgeversLijst)}
        onExportSeizoen={() => exporteerSeizoen(actieveSeizoen, groepen, lesgeversLijst, wedstrijdEvents)}
        onVerwijderSeizoen={verwijderSeizoen}
        toonMelding={toonMelding}
      />

      {/* Zone 6 - Actieve filters */}
      {renderActieveFiltersZone()}

      {/* Zone 7 - Trainingen lijst */}
      <TrainingenLijst
        actieveGroepData={actieveGroepData}
        gefilterdeTrainingen={gefilterdeTrainingenMet}
        technieken={technieken}
        groepen={groepen}
        isBeheerder={isBeheerder}
        profiel={profiel}
        lesgeversLijst={lesgeversLijst}
        filterLesgever={filterLesgever}
        filterDag={filterDag}
        geenTrainingMarkers={geenTrainingMarkers}
        magTrainingToevoegen={magTrainingToevoegen}
        onBewerken={openBewerken}
        onVerwijderen={async (ids, onDone) => {
          if (ids.length === 1) await verwijderTraining({ id: ids[0] });
          else {
            const ok = await confirm({ titel: `${ids.length} training(en) verwijderen?`, beschrijving: 'Deze trainingen en hun technieken worden definitief verwijderd.', bevestigLabel: 'Ja, verwijderen', variant: 'danger' });
            if (!ok) return;
            try {
              for (const id of ids) {
                const ts = await getDocs(collection(db, 'trainingen', id, 'technieken'));
                for (const d of ts.docs) await deleteDoc(d.ref);
                await deleteDoc(doc(db, 'trainingen', id));
              }
              toonMelding(`${ids.length} training(en) verwijderd`);
              onDone?.();
            } catch (e) { alert('Verwijderen mislukt: ' + e.message); }
          }
        }}
        onNieuweTraining={openNieuweTraining}
        onWedstrijdKlik={id => setOpenWedstrijdId(id)}
      />

      {/* Wedstrijd detail panel */}
      {openWedstrijdId && (
        <WedstrijdDetailPanel eventId={openWedstrijdId} onClose={() => setOpenWedstrijdId(null)} />
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

 {detailId && (
 <TrainingDetailPanel
 trainingId={detailId}
 onClose={() => navigate('/trainingen')}
 />
 )}
 </div>
 );
}
