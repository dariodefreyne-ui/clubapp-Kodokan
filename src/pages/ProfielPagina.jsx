// src/pages/ProfielPagina.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const S = {
 page: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px' },
 title: { fontSize: 'var(--font-size-xl)', fontWeight: '700', marginBottom: '16px' },
 card: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px' },
 cardTitle: { fontSize: 'var(--font-size-base)', fontWeight: '700', marginBottom: '12px', color: 'var(--accent-red)' },
 label: { display: 'block', fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
 input: { width: '100%', padding: '12px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', marginBottom: '14px', boxSizing: 'border-box' },
 rolBadge: (r) => ({ display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)', fontSize: 'var(--font-size-sm)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', background: (r === 'admin' || r === 'bestuurslid') ? 'var(--accent-red)' : '#2980b9', color: 'var(--text-primary)' }),
 saveBtn: { background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600' },
 logoutBtn: { background: 'transparent', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600', marginTop: '8px', width: '100%' },
 success: { background: 'rgba(39,174,96,0.15)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--success)', fontSize: 'var(--font-size-md)', marginBottom: '12px' },
 groepTag: (actief) => ({ padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600', background: actief ? 'var(--accent-red)' : 'var(--bg-primary)', border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`, color: 'var(--text-primary)' }),
 toggle: (actief) => ({ width: '46px', height: '26px', borderRadius: '13px', background: actief ? 'var(--accent-red)' : 'var(--border-color)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }),
 toggleDot: (actief) => ({ position: 'absolute', top: '3px', left: actief ? '23px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--text-primary)', transition: 'left 0.2s' }),
};

export default function ProfielPagina() {
 const { profiel, slaProfielOp, logout, isBeheerder } = useAuth();
 const [naam, setNaam] = useState('');
 const [groepen, setGroepen] = useState([]);
 const [agendaFilters, setAgendaFilters] = useState({
 toonTrainingen: true,
 toonWedstrijden: true,
 toonExamens: true,
 toonEvenementen: true,
 enkelMijnGroepen: false,
 });
 const WEDSTRIJD_CATEGORIEEN = ['U7','U9','U11','U13','U14','U15','U16','U18','U21','Senior'];
 const [meldGroepen, setMeldGroepen] = useState([]);
 const [meldCategorieen, setMeldCategorieen] = useState([]);
 const [wedstrijdMeldingen, setWedstrijdMeldingen] = useState(true);
 const [trainerMeldingenActief, setTrainerMeldingenActief] = useState(true);
 const [stockMeldingenActief, setStockMeldingenActief] = useState(true);
 const [alleGroepen, setAlleGroepen] = useState([]);
 const [opgeslagen, setOpgeslagen] = useState(false);
 const [melding, setMelding] = useState('');
 const [bezig, setBezig] = useState(false);

 useEffect(() => {
 if (profiel) {
 setNaam(profiel.naam || '');
 setGroepen(profiel.groepen || []);
 if (profiel.agendaFilters) {
 setAgendaFilters(prev => ({ ...prev, ...profiel.agendaFilters }));
 }
 setMeldGroepen(profiel.notificaties?.trainerGroepen || []);
 setMeldCategorieen(profiel.notificaties?.wedstrijdCategorieen || []);
 setWedstrijdMeldingen(profiel.notificaties?.wedstrijdMeldingen !== false);
 setTrainerMeldingenActief(profiel.notificaties?.trainerMeldingenActief !== false);
 setStockMeldingenActief(profiel.notificaties?.stockMeldingenActief !== false);
 }
 }, [profiel]);

 useEffect(() => {
 getDocs(collection(db, 'groepen')).then(snap => {
 setAlleGroepen(snap.docs.map(d => ({ id: d.id, ...d.data() }))
 .sort((a, b) => a.naam.localeCompare(b.naam)));
 });
 }, []);

 const toggleGroep = (id) =>
 setGroepen(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

 const verplaatsGroep = (id, richting) => {
 setGroepen(prev => {
 const index = prev.indexOf(id);
 if (index === -1) return prev;
 const nieuweIndex = index + richting;
 if (nieuweIndex < 0 || nieuweIndex >= prev.length) return prev;
 const nieuw = [...prev];
 [nieuw[index], nieuw[nieuweIndex]] = [nieuw[nieuweIndex], nieuw[index]];
 return nieuw;
 });
 };

 const maakFavoriet = (id) => {
 setGroepen(prev => prev.includes(id) ? [id, ...prev.filter(g => g !== id)] : [id, ...prev]);
 };

 const opslaan = async () => {
 setBezig(true);
 await slaProfielOp({
 naam,
 groepen,
 agendaFilters,
 notificaties: {
 ...(profiel.notificaties || {}),
 wedstrijdMeldingen,
 trainerMeldingenActief,
 stockMeldingenActief,
 trainerGroepen: meldGroepen,
 wedstrijdCategorieen: meldCategorieen,
 },
 });
 setOpgeslagen(true);
 setTimeout(() => setOpgeslagen(false), 2000);
 setMelding('Profiel opgeslagen.');
 setTimeout(() => setMelding(''), 3000);
 setBezig(false);
 };

 function renderToggle(label, beschrijving, actief, onClick) {
 return (
 <div
 onClick={onClick}
 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
 >
 <div style={{ flex: 1, paddingRight: '12px' }}>
 <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', fontWeight: '600' }}>{label}</div>
 {beschrijving && <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>{beschrijving}</div>}
 </div>
 <div style={S.toggle(actief)}>
 <div style={S.toggleDot(actief)} />
 </div>
 </div>
 );
 }

 if (!profiel) return <div style={S.page}>Laden...</div>;

 return (
 <div style={S.page}>
 <div style={S.title}>👤 Mijn Profiel</div>
 {opgeslagen && <div style={S.success}>✓ Profiel opgeslagen</div>}

 <div style={S.card}>
 <div style={S.cardTitle}>Account</div>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)' }}>{profiel.email}</span>
 <span style={S.rolBadge(profiel.rol)}>{profiel.rol || 'lid'}</span>
 </div>
 </div>

 <div style={S.card}>
 <div style={S.cardTitle}>Weergavenaam</div>
 <label style={S.label}>Naam</label>
 <input type="text" value={naam} onChange={e => setNaam(e.target.value)}
 placeholder="Voornaam Achternaam" style={S.input} />
 </div>

 <div style={S.card}>
 <div style={S.cardTitle}>Mijn standaardgroepen</div>
 <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '12px', marginTop: 0 }}>
 De eerste groep in deze lijst wordt standaard geopend op de trainingspagina. Gebruik Omhoog/Omlaag of Maak favoriet om de volgorde te bepalen.
 </p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
 {alleGroepen.map(g => (
 <button key={g.id} onClick={() => toggleGroep(g.id)}
 style={S.groepTag(groepen.includes(g.id))}>
 {g.naam} <span style={{ fontSize: '11px', opacity: 0.7 }}>({g.dag})</span>
 </button>
 ))}
 </div>
 {groepen.length > 0 && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
 {groepen.map((id, index) => {
 const groep = alleGroepen.find(g => g.id === id);
 if (!groep) return null;
 return (
 <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-primary)', border: index === 0 ? '1px solid var(--accent-red)' : '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '10px', flexWrap: 'wrap' }}>
 <div style={{ flex: 1, minWidth: '160px' }}>
 <div style={{ fontWeight: '700' }}>{index + 1}. {groep.naam}</div>
 <div style={{ color: index === 0 ? 'var(--accent-red)' : 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
 {index === 0 ? 'Favoriete groep - standaard op Trainingen' : 'Standaardgroep'}{groep.dag ? ` (${groep.dag})` : ''}
 </div>
 </div>
 <button onClick={() => verplaatsGroep(id, -1)} disabled={index === 0} style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.5 : 1 }}>Omhoog</button>
 <button onClick={() => verplaatsGroep(id, 1)} disabled={index === groepen.length - 1} style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: index === groepen.length - 1 ? 'not-allowed' : 'pointer', opacity: index === groepen.length - 1 ? 0.5 : 1 }}>Omlaag</button>
 {index !== 0 && <button onClick={() => maakFavoriet(id)} style={{ padding: '7px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-red)', background: 'transparent', color: 'var(--accent-red)', cursor: 'pointer' }}>Maak favoriet</button>}
 </div>
 );
 })}
 </div>
 )}
 </div>

 <div style={S.card}>
 <div style={S.cardTitle}>🔔 Meldingen</div>
 <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '16px', marginTop: 0 }}>
 Kies per sectie welke meldingen je wil ontvangen.
 </p>

 {/* Wedstrijdmeldingen */}
 <div style={{ marginBottom: '20px' }}>
 <label style={S.label}>Wedstrijden</label>
 {renderToggle(
 'Wedstrijdmeldingen',
 'Meldingen voor nieuwe of gewijzigde tornooien.',
 wedstrijdMeldingen,
 () => setWedstrijdMeldingen(prev => !prev)
 )}
 <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '10px', marginBottom: '10px' }}>
 Je krijgt een melding als er een nieuw tornooi wordt toegevoegd voor deze categorieen.
 </p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', opacity: wedstrijdMeldingen ? 1 : 0.45 }}>
 {WEDSTRIJD_CATEGORIEEN.map(cat => {
 const actief = meldCategorieen.includes(cat);
 return (
 <button
 key={cat}
 disabled={!wedstrijdMeldingen}
 onClick={() => setMeldCategorieen(prev =>
 actief ? prev.filter(c => c !== cat) : [...prev, cat]
 )}
 style={{
 padding: '8px 14px',
 borderRadius: 'var(--radius-md)',
 cursor: wedstrijdMeldingen ? 'pointer' : 'not-allowed',
 fontSize: 'var(--font-size-sm)',
 fontWeight: '600',
 background: actief ? 'rgba(39,174,96,0.2)' : 'var(--bg-primary)',
 border: '1px solid ' + (actief ? 'var(--success)' : 'var(--border-color)'),
 color: actief ? 'var(--success)' : 'var(--text-secondary)',
 }}
 >
 {cat}
 </button>
 );
 })}
 </div>
 </div>

 {(profiel.rol === 'trainer' || isBeheerder) && (
 <div style={{ marginBottom: '20px' }}>
 <label style={S.label}>Trainingen</label>
 {renderToggle(
 'Trainermeldingen',
 'Meldingen voor trainingen zonder ingevulde lesgever.',
 trainerMeldingenActief,
 () => setTrainerMeldingenActief(prev => !prev)
 )}
 <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '10px', marginBottom: '10px' }}>
 Je krijgt een melding als er voor deze groepen geen lesgever is ingevuld.
 </p>
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', opacity: trainerMeldingenActief ? 1 : 0.45 }}>
 {alleGroepen.map(g => {
 const actief = meldGroepen.includes(g.id);
 return (
 <button
 key={g.id}
 disabled={!trainerMeldingenActief}
 onClick={() => setMeldGroepen(prev =>
 actief ? prev.filter(id => id !== g.id) : [...prev, g.id]
 )}
 style={{
 padding: '8px 14px',
 borderRadius: 'var(--radius-md)',
 cursor: trainerMeldingenActief ? 'pointer' : 'not-allowed',
 fontSize: 'var(--font-size-sm)',
 fontWeight: '600',
 background: actief ? 'rgba(41,128,185,0.2)' : 'var(--bg-primary)',
 border: '1px solid ' + (actief ? '#2980b9' : 'var(--border-color)'),
 color: actief ? '#2980b9' : 'var(--text-secondary)',
 }}
 >
 {g.naam}
 {g.dag && <span style={{ fontSize: '11px', opacity: 0.7, marginLeft: '4px' }}>({g.dag})</span>}
 </button>
 );
 })}
 {alleGroepen.length === 0 && (
 <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Geen groepen gevonden.</span>
 )}
 </div>
 </div>
 )}

 {isBeheerder && (
 <div>
 <label style={S.label}>Stock</label>
 {renderToggle(
 'Stockmeldingen',
 'Meldingen wanneer producten uit stock gaan of lage stock bereiken.',
 stockMeldingenActief,
 () => setStockMeldingenActief(prev => !prev)
 )}
 </div>
 )}
 </div>

 <div style={S.card}>
 <div style={S.cardTitle}>Agenda-instellingen</div>
 <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '12px', marginTop: 0 }}>
 Kies wat je standaard ziet op de agenda.
 </p>
 {[
 { key: 'toonTrainingen', label: 'Trainingen', kleur: '#2980b9' },
 { key: 'toonWedstrijden', label: 'Wedstrijden', kleur: '#e67e22' },
 { key: 'toonExamens', label: 'Examens', kleur: '#27ae60' },
 { key: 'toonEvenementen', label: 'Evenementen', kleur: '#8e44ad' },
 ].map(({ key, label, kleur }) => (
 <div
 key={key}
 onClick={() => setAgendaFilters(prev => ({ ...prev, [key]: !prev[key] }))}
 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }}
 >
 <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
 <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: kleur, flexShrink: 0 }} />
 <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>{label}</span>
 </div>
 <div style={{
 width: '44px', height: '24px', borderRadius: '12px',
 background: agendaFilters[key] ? kleur : 'var(--border-color)',
 position: 'relative', transition: 'background 0.2s', flexShrink: 0,
 }}>
 <div style={{
 position: 'absolute', top: '3px',
 left: agendaFilters[key] ? '23px' : '3px',
 width: '18px', height: '18px', borderRadius: '50%',
 background: 'var(--text-primary)', transition: 'left 0.2s',
 }} />
 </div>
 </div>
 ))}
 {(profiel?.groepen || []).length > 0 && (
 <div
 onClick={() => setAgendaFilters(prev => ({ ...prev, enkelMijnGroepen: !prev.enkelMijnGroepen }))}
 style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', cursor: 'pointer' }}
 >
 <div style={{ flex: 1, paddingRight: '12px' }}>
 <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)' }}>Enkel mijn groepen</span>
 <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>Toon enkel trainingen van groepen waar ik bij betrokken ben</div>
 </div>
 <div style={{
 width: '44px', height: '24px', borderRadius: '12px',
 background: agendaFilters.enkelMijnGroepen ? 'var(--accent-red)' : 'var(--border-color)',
 position: 'relative', transition: 'background 0.2s', flexShrink: 0,
 }}>
 <div style={{
 position: 'absolute', top: '3px',
 left: agendaFilters.enkelMijnGroepen ? '23px' : '3px',
 width: '18px', height: '18px', borderRadius: '50%',
 background: 'var(--text-primary)', transition: 'left 0.2s',
 }} />
 </div>
 </div>
 )}
 </div>

 <div style={S.card}>
 {melding && (
 <div style={{
 background: 'rgba(34,197,94,0.15)',
 border: '1px solid rgba(34,197,94,0.4)',
 borderRadius: 'var(--radius-md)',
 padding: '10px 14px',
 color: 'rgb(34,197,94)',
 fontSize: 'var(--font-size-sm)',
 marginBottom: '12px',
 }}>
 {melding}
 </div>
 )}
 <button onClick={opslaan} disabled={bezig} style={{ ...S.saveBtn, opacity: bezig ? 0.6 : 1 }}>
 {bezig ? 'Bezig...' : '💾 Opslaan'}
 </button>
 </div>

 <div style={S.card}>
 <div style={S.cardTitle}>Sessie</div>
 <button onClick={logout} style={S.logoutBtn}>🚪 Uitloggen</button>
 </div>
 </div>
 );
}
