// src/components/trainingen/TrainingKaart.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { DARK } from './tokens';
import { vandaagISO } from './seizoenHelpers';
import LesgeversPanel from './LesgeversPanel';
import { TechniekAccordeonLijst } from './TechniekAccordeon';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';

function duurFmt(min) {
 if (!min) return null;
 if (min >= 60) return `${Math.floor(min / 60)}u${min % 60 ? (min % 60) + 'm' : ''}`;
 return `${min}m`;
}

function TrainingKaart({
 training, technieken, groepen, isBeheerder, profiel, lesgeversLijst,
 selectieModus, isGeselecteerd, isVolgende,
 onToggleSelectie, onBewerken, onVerwijderen,
 isDark = true, T,
}) {
 const tok = T || DARK;
 const [uitgeklapt, setUitgeklapt] = useState(false);
 const [technieksLijst, setTechnieksLijst] = useState([]);
 const trainId = training.id;

 useEffect(() => {
 if (training.techniekBadges?.length > 0) return undefined;
 const ref = collection(db, 'trainingen', trainId, 'technieken');
 const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
 setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 });
 return unsub;
 }, [trainId, training.techniekBadges?.length]);

 useEffect(() => {
 if (!uitgeklapt) return undefined;
 const ref = collection(db, 'trainingen', trainId, 'technieken');
 const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
 setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
 });
 return unsub;
 }, [trainId, uitgeklapt]);

 const isVandaag = training.datum === vandaagISO();
 const isKomend = training.datum >= vandaagISO();
 const dt = new Date(training.datum + 'T00:00:00');
 const accentKleur = isVandaag ? tok.green : isVolgende && isKomend ? tok.orange : 'transparent';
 const badgeBron = training.techniekBadges?.length > 0
 ? training.techniekBadges
 : technieksLijst.map(t => ({ naam: t.techniekNaam, fase: t.fase }));

 const handleKlikHeader = () => {
 if (selectieModus) {
 onToggleSelectie();
 return;
 }
 setUitgeklapt(v => !v);
 };

 return (
 <div
 id={`training-${training.id}`}
 style={{
 borderRadius: '12px',
 overflow: 'hidden',
 background: isDark ? tok.surface : '#fff',
 boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.07)',
 opacity: isKomend ? 1 : 0.55,
 transition: 'box-shadow 0.15s, opacity 0.15s',
 borderLeft: `3px solid ${accentKleur}`,
 }}
 >
 <div
 onClick={handleKlikHeader}
 style={{
 display: 'flex',
 alignItems: 'stretch',
 cursor: 'pointer',
 background: isGeselecteerd ? tok.redDim : 'transparent',
 transition: 'background 0.12s',
 }}
 >
 {selectieModus && (
 <div style={{ width: '16px', margin: '0 0 0 14px', display: 'flex', alignItems: 'center' }}>
 <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, background: isGeselecteerd ? tok.red : 'transparent', border: `2px solid ${isGeselecteerd ? tok.red : tok.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 {isGeselecteerd && <span style={{ color: '#fff', fontSize: '10px', lineHeight: 1 }}>✓</span>}
 </div>
 </div>
 )}

 <div style={{ width: '72px', flexShrink: 0, padding: '14px 10px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: isDark ? tok.navyMid : tok.surfaceHigh }}>
 <div style={{ fontSize: '11px', fontWeight: '700', color: isVandaag ? tok.green : tok.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
 {dt.toLocaleDateString('nl-BE', { weekday: 'short' })}
 </div>
 <div style={{ fontSize: '20px', fontWeight: '900', color: isVandaag ? tok.green : isVolgende ? tok.orange : tok.text, lineHeight: 1.1 }}>
 {dt.getDate()}
 </div>
 <div style={{ fontSize: '11px', color: tok.textMuted }}>
 {dt.toLocaleDateString('nl-BE', { month: 'short' })}
 </div>
 </div>

 <div style={{ flex: 1, padding: '12px 14px', minWidth: 0 }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', flexWrap: 'wrap' }}>
 {isVandaag && <span style={{ fontSize: '10px', fontWeight: '800', color: tok.green, background: tok.greenDim, borderRadius: '4px', padding: '2px 7px', letterSpacing: '0.5px' }}>VANDAAG</span>}
 {isVolgende && !isVandaag && <span style={{ fontSize: '10px', fontWeight: '800', color: tok.orange, background: tok.orangeDim, borderRadius: '4px', padding: '2px 7px', letterSpacing: '0.5px' }}>VOLGENDE</span>}
 {duurFmt(training.duurMinuten) && <span style={{ fontSize: '12px', color: tok.textMuted }}>{duurFmt(training.duurMinuten)}{training.duurOverschreven ? ' ✎' : ''}</span>}
 </div>

 {training.lesgevers?.length > 0 && (
 <div style={{ fontSize: '15px', fontWeight: '700', color: tok.text, marginBottom: '5px', lineHeight: 1.3 }}>
 {training.lesgevers.map((l, i) => (
 <span key={l}>
 {i > 0 && <span style={{ color: tok.textMuted, fontWeight: '400', margin: '0 5px' }}>·</span>}
 {lesgeversLijst.find(ls => ls.id === l)?.naam ?? l}
 </span>
 ))}
 </div>
 )}

 {training.opmerking && (
 <div style={{ fontSize: '13px', color: isDark ? tok.text : tok.textSec, marginBottom: '6px', padding: '4px 8px', background: isDark ? tok.navyMid : '#EEF3F8', borderRadius: '5px', borderLeft: `2px solid ${tok.red}`, display: 'inline-block', maxWidth: '100%' }}>
 {training.opmerking}
 </div>
 )}

 {!uitgeklapt && badgeBron.length > 0 && (
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
 {badgeBron.slice(0, 4).map((t, i) => {
 const kleur = t.fase === 'basis' ? tok.blue : t.fase === 'verdieping' ? tok.red : tok.textMuted;
 return (
 <span key={i} style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '999px', background: t.fase === 'basis' ? tok.blueDim : t.fase === 'verdieping' ? tok.redDim : isDark ? tok.navyMid : tok.surfaceHigh, color: kleur }}>
 {t.naam || '-'}
 </span>
 );
 })}
 {badgeBron.length > 4 && <span style={{ fontSize: '11px', color: tok.textMuted, padding: '2px 4px' }}>+{badgeBron.length - 4}</span>}
 </div>
 )}
 </div>

 <div style={{ padding: '0 14px', display: 'flex', alignItems: 'center', color: tok.textMuted, fontSize: '11px', flexShrink: 0 }}>
 {uitgeklapt ? '▲' : '▼'}
 </div>
 </div>

 {uitgeklapt && (
 <div style={{ background: isDark ? tok.navyMid : tok.surfaceHigh, padding: '14px 16px 14px 14px' }}>
 <TechniekAccordeonLijst technieksLijst={technieksLijst} techniekDatabank={technieken} />
 <LesgeversPanel training={training} profiel={profiel} isBeheerder={isBeheerder} lesgeversLijst={lesgeversLijst} />
 {isBeheerder && (
 <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
 <button onClick={onBewerken} style={{ flex: 1, padding: '9px', background: tok.redDim, border: `1px solid ${tok.red}`, borderRadius: '8px', color: tok.red, cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>✏️ Bewerken</button>
 <button
 onClick={async () => {
 if (!window.confirm('Training als geannuleerd markeren en leden verwittigen?')) return;
 try {
 const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
 await updateDoc(doc(db, 'trainingen', training.id), { geannuleerd: true, bijgewerkt: serverTimestamp() });
 stuurPushTrigger(PUSH_TYPES.TRAINING_GEANNULEERD, { groepId: training.groepId || '', groepNaam: training.groepNaam || training.groepId || '', datum: training.datum || '' });
 } catch (e) {
 console.error('Annuleren mislukt:', e);
 }
 }}
 style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${tok.border}`, borderRadius: '8px', color: tok.textMuted, cursor: 'pointer', fontSize: '13px' }}
 >Annuleer</button>
 <button onClick={onVerwijderen} style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${tok.border}`, borderRadius: '8px', color: tok.textMuted, cursor: 'pointer', fontSize: '13px' }}>🗑</button>
 </div>
 )}
 </div>
 )}
 </div>
 );
}

export default TrainingKaart;
