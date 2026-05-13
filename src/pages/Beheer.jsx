// src/pages/Beheer.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
 getClubSettings,
 setClubSettings,
 DEFAULT_GEEN_TRAINING_MARKERS,
 normaliseerGeenTrainingMarkers,
} from '../services/firestoreService';
import { CLUB_NAAM } from '../config/appConfig';
import { seedTechnieken } from '../scripts/seedTechnieken';
import { migreerSeizoen } from '../scripts/migreerSeizoen';
import GebruikersBeheer from '../components/beheer/GebruikersBeheer';
import LesgeversBeheer from '../components/beheer/LesgeversBeheer';
import GroepenBeheer from '../components/beheer/GroepenBeheer';
import PaginaRollenBeheer from '../components/beheer/PaginaRollenBeheer';
import {
  TrainerMeldingenBeheer,
  StockMeldingenBeheer,
  StockOverzichtMail,
  PushStatusDashboard,
  ClubBerichtBeheer,
  NieuwLidMeldingenBeheer,
} from '../components/beheer/MeldingenBeheer';
import { C, cardStyle, tabBarStyle, tabButtonStyle } from '../styles/tokens';

const TABS_BESTUURSLID = [
 { id: 'club', label: '🏠 Club' },
 { id: 'gebruikers', label: '👥 Gebruikers' },
 { id: 'groepen', label: '🥋 Groepen' },
 { id: 'lesgevers', label: '👤 Lesgevers' },
];

const TABS_ADMIN_ONLY = [
 { id: 'paginas', label: '📄 Paginas' },
 { id: 'meldingen', label: '🔔 Meldingen' },
 { id: 'data', label: '⚙️ Data' },
];

export default function Beheer() {
 const { role, isAdmin } = useAuth();
 const zichtbareTabs = isAdmin ? [...TABS_BESTUURSLID, ...TABS_ADMIN_ONLY] : TABS_BESTUURSLID;
 const [actieveTab, setActieveTab] = useState('club');
 const [settings, setSettings] = useState({
 clubname: CLUB_NAAM,
 logoUrl: '',
 trainingGeenTrainingMarkers: DEFAULT_GEEN_TRAINING_MARKERS,
 });
 const [saving, setSaving] = useState(false);
 const [saved, setSaved] = useState('');
 const [seedStatus, setSeedStatus] = useState('');

 useEffect(() => {
 getClubSettings().then(data => {
 const volgendeSettings = data || {};
 setSettings({
 clubname: CLUB_NAAM,
 logoUrl: '',
 ...volgendeSettings,
 trainingGeenTrainingMarkers: normaliseerGeenTrainingMarkers([
  ...(Array.isArray(volgendeSettings?.trainingGeenTrainingMarkers)
   ? volgendeSettings.trainingGeenTrainingMarkers
   : []),
  volgendeSettings?.geenTrainingMarker,
  volgendeSettings?.geenTrainingTekst,
  volgendeSettings?.geenTrainingMarkers,
  volgendeSettings?.trainerReminder?.uitsluitZin,
 ].filter(Boolean)),
 });
 });
 }, []);

 const updateGeenTrainingMarker = (index, value) => {
 setSettings(s => {
 const markers = Array.isArray(s.trainingGeenTrainingMarkers)
 ? [...s.trainingGeenTrainingMarkers]
 : [...DEFAULT_GEEN_TRAINING_MARKERS];
 markers[index] = value;
 return { ...s, trainingGeenTrainingMarkers: markers };
 });
 };

 const voegGeenTrainingMarkerToe = () => {
 setSettings(s => ({
 ...s,
 trainingGeenTrainingMarkers: [
 ...(Array.isArray(s.trainingGeenTrainingMarkers) ? s.trainingGeenTrainingMarkers : DEFAULT_GEEN_TRAINING_MARKERS),
 '',
 ],
 }));
 };

 const verwijderGeenTrainingMarker = (index) => {
 setSettings(s => ({
 ...s,
 trainingGeenTrainingMarkers: (Array.isArray(s.trainingGeenTrainingMarkers) ? s.trainingGeenTrainingMarkers : DEFAULT_GEEN_TRAINING_MARKERS)
 .filter((_, i) => i !== index),
 }));
 };

 async function saveSettings() {
 setSaving(true);
 const opgeschoondeMarkers = normaliseerGeenTrainingMarkers([
  ...(Array.isArray(settings?.trainingGeenTrainingMarkers)
   ? settings.trainingGeenTrainingMarkers
   : []),
  settings?.geenTrainingMarker,
  settings?.geenTrainingTekst,
  settings?.geenTrainingMarkers,
  settings?.trainerReminder?.uitsluitZin,
 ].filter(Boolean));
 await setClubSettings({
 ...settings,
 trainingGeenTrainingMarkers: opgeschoondeMarkers,
 });
 setSettings(s => ({ ...s, trainingGeenTrainingMarkers: opgeschoondeMarkers }));
 setSaved('Instellingen opgeslagen!');
 setTimeout(() => setSaved(''), 3000);
 setSaving(false);
 }

 if (role !== 'admin' && role !== 'bestuurslid') {
 return (
 <div style={{ padding: '24px', color: 'var(--text-primary)' }}>
 <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
 <div>Alleen beschikbaar voor admin of bestuurslid.</div>
 </div>
 );
 }

 const markers = Array.isArray(settings.trainingGeenTrainingMarkers)
 ? settings.trainingGeenTrainingMarkers
 : DEFAULT_GEEN_TRAINING_MARKERS;

 return (
 <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px' }}>
 <section style={{ ...cardStyle({ gradient: true }), marginBottom: '16px' }}>
 <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(22px,5vw,30px)', fontWeight: '900' }}>🔧 Beheer</h1>
 <p style={{ margin: 0, color: C.textSec, fontSize: '13px' }}>Clubinstellingen, gebruikers, groepen, lesgevers en meldingen</p>
 </section>
 {saved && (
 <div style={{ background: 'rgba(34,197,94,0.18)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--success)', marginBottom: '12px' }}>
 ✓ {saved}
 </div>
 )}

 <div style={tabBarStyle}>
 {zichtbareTabs.map(tab => (
 <button
 key={tab.id}
 onClick={() => setActieveTab(tab.id)}
 style={{ ...tabButtonStyle(actieveTab === tab.id), flexShrink: 0 }}
 >
 {tab.label}
 </button>
 ))}
 </div>

 {actieveTab === 'club' && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Clubinstellingen</h2>
 <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '6px' }}>Clubnaam</label>
 <input
 value={settings.clubname || ''}
 onChange={e => setSettings(s => ({ ...s, clubname: e.target.value }))}
 placeholder="Clubnaam"
 style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: '12px', boxSizing: 'border-box' }}
 />
 <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '6px' }}>Logo URL (optioneel)</label>
 <input
 value={settings.logoUrl || ''}
 onChange={e => setSettings(s => ({ ...s, logoUrl: e.target.value }))}
 placeholder="https://..."
 style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: '12px', boxSizing: 'border-box' }}
 />
 {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '80px', display: 'block', marginBottom: '12px' }} />}
 </section>

 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2 style={{ margin: '0 0 6px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Training detectie en trainerherinneringen</h2>
 <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 0 }}>
 Deze teksten betekenen dat er geen gewone training is. Ze worden gebruikt bij Excel import en om trainerherinneringen niet te versturen voor bijvoorbeeld Sporthal gesloten, vakantie of tornooi. Herkenning is hoofdletterongevoelig.
 </p>
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
 {markers.map((marker, index) => (
 <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
 <input
 value={marker}
 onChange={e => updateGeenTrainingMarker(index, e.target.value)}
 placeholder="Bijv. sporthal gesloten"
 style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
 />
 <button
 onClick={() => verwijderGeenTrainingMarker(index)}
 style={{ padding: '10px 12px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', cursor: 'pointer' }}
 >
 Verwijder
 </button>
 </div>
 ))}
 </div>
 <button
 onClick={voegGeenTrainingMarkerToe}
 style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}
 >
 + Tekst toevoegen
 </button>
 </section>

 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <button
 onClick={saveSettings}
 disabled={saving}
 style={{ background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '700', opacity: saving ? 0.7 : 1 }}
 >
 {saving ? 'Opslaan...' : '✓ Opslaan'}
 </button>
 </section>

 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>App informatie</h2>
 {[
 ['Versie', '1.0.0'],
 ['Technologie', 'React + Firebase'],
 ['Hosting', 'Firebase Hosting (gratis tier)'],
 ['Authenticatie', 'Firebase Authentication (email)'],
 ['Betaald?', 'Nee - volledig gratis'],
 ].map(([k, v]) => (
 <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
 <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
 <span>{v}</span>
 </div>
 ))}
 </section>
 </div>
 )}

 {actieveTab === 'gebruikers' && (
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2>👥 Gebruikers</h2>
 <GebruikersBeheer />
 </section>
 )}

 {actieveTab === 'paginas' && isAdmin && (
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2>📄 Paginas per rol</h2>
 <PaginaRollenBeheer />
 </section>
 )}

 {actieveTab === 'groepen' && (
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2>🥋 Groepen & trainingsduur</h2>
 <GroepenBeheer />
 </section>
 )}

 {actieveTab === 'lesgevers' && (
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2>👤 Lesgevers</h2>
 <LesgeversBeheer />
 </section>
 )}

 {actieveTab === 'meldingen' && isAdmin && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}><h2>👤 Nieuw lid registratie</h2><NieuwLidMeldingenBeheer /></section>
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}><h2>Trainer herinneringen</h2><TrainerMeldingenBeheer /></section>
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}><h2>Stock meldingen</h2><StockMeldingenBeheer /></section>
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}><h2>Clubbericht</h2><ClubBerichtBeheer /></section>
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}><h2>Stock overzicht mailen</h2><StockOverzichtMail /></section>
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2>📲 Push token status</h2>
 <p style={{ color: 'var(--text-secondary)' }}>Overzicht van alle geregistreerde push tokens. Gebruik dit om te controleren of meldingen actief zijn op de juiste toestellen.</p>
 <PushStatusDashboard />
 </section>
 </div>
 )}

 {actieveTab === 'data' && isAdmin && (
 <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
 <h2>Data beheer</h2>
 <h3>technieken</h3>
 <p>Eenmalige actie: vult de Firestore-collectie technieken.</p>
 <button
 onClick={async () => {
 setSeedStatus('bezig');
 try { await seedTechnieken(); setSeedStatus('klaar'); }
 catch (e) { setSeedStatus(''); alert('Fout bij seeding: ' + e.message); }
 }}
 disabled={seedStatus === 'bezig'}
 style={{ background: seedStatus === 'klaar' ? 'var(--success)' : 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '10px var(--space-4)', borderRadius: 'var(--radius-md)', cursor: seedStatus === 'bezig' ? 'not-allowed' : 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600', opacity: seedStatus === 'bezig' ? 0.7 : 1 }}
 >
 {seedStatus === 'bezig' ? '⏳ Bezig...' : seedStatus === 'klaar' ? '✓ Geseed' : '🌱 Seed technieken'}
 </button>
 <h3>seizoen</h3>
 <p>Eenmalige migratie: voegt het seizoenveld toe aan bestaande trainingen.</p>
 <button
 onClick={async () => {
 try { const n = await migreerSeizoen(); alert(`${n} trainingen gemigreerd`); }
 catch (e) { alert('Migratie mislukt: ' + e.message); }
 }}
 style={{ background: 'var(--accent-blue)', border: 'none', color: 'var(--text-primary)', padding: '10px var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600' }}
 >
 🔄 Migreer seizoen (eenmalig)
 </button>
 <h3>Firebase configuratie</h3>
 <code>src/firebase.js</code>
 </section>
 )}
 </div>
 );
}
