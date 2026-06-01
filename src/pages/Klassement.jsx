// src/pages/Klassement.jsx
// Clubklassement: punten per lid op basis van configureerbare activiteiten.
// – Zichtbaar voor alle gebruikers (eigen rij gemarkeerd voor leden).
// – Provinciaal beheer + puntenconfiguratie enkel voor trainer/bestuurslid/admin.
import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, getDocs, getDoc, doc, setDoc, deleteDoc,
  addDoc, writeBatch, serverTimestamp, collectionGroup, where, query,
} from 'firebase/firestore';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../components/trainingen/trainingStatus';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  huidigSeizoenStartJaar, beschikbareSeizoenStartJaren, seizoenBereikVanJaar,
} from '../utils/seizoenUtils';
import { C } from '../styles/tokens';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = { clubtrainingPerMaand: 5, wedstrijd: 3, provincialeTraining: 2, clubevenement: 1, aanwezigheidsdrempel: 75 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function seizoenMaandenVanBereik(bereik) {
  const maanden = [];
  let jaar = parseInt(bereik.start.slice(0, 4), 10);
  let mnd  = parseInt(bereik.start.slice(5, 7), 10);
  const eindJaar = parseInt(bereik.einde.slice(0, 4), 10);
  const eindMnd  = parseInt(bereik.einde.slice(5, 7), 10);
  while (jaar < eindJaar || (jaar === eindJaar && mnd <= eindMnd)) {
    maanden.push(`${jaar}-${String(mnd).padStart(2, '0')}`);
    mnd++;
    if (mnd > 12) { mnd = 1; jaar++; }
  }
  return maanden;
}

// ─── Stijlen ──────────────────────────────────────────────────────────────────

const S = {
  page:    { color: C.textPrimary, paddingBottom: '56px' },
  header:  { marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` },
  title:   { margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' },
  sub:     { margin: 0, fontSize: '14px', color: C.textSec },
  sLabel:  { fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' },
  chipRij: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
  chip:    (a, accent) => {
    const ac = accent || C.red;
    return { padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: a ? ac : C.card, border: `1px solid ${a ? ac : C.border}`, color: a ? '#fff' : C.textSec, fontFamily: 'inherit' };
  },
  tabBar:  { display: 'flex', gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: '20px' },
  tab:     (a) => ({ background: 'none', border: 'none', borderBottom: `2px solid ${a ? C.red : 'transparent'}`, color: a ? C.textPrimary : C.textMuted, padding: '10px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: a ? '700' : '400', whiteSpace: 'nowrap', fontFamily: 'inherit' }),
  card:    { background: C.card, borderRadius: '12px', padding: '16px', border: `1px solid ${C.border}`, marginBottom: '16px' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '12px', marginBottom: '24px' },
  kpi:     (c) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '12px 14px', borderLeft: `3px solid ${c}` }),
  kpiNum:  (c) => ({ fontSize: '20px', fontWeight: '800', color: c }),
  kpiLbl:  { fontSize: '11px', color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' },
  tbl:     { width: '100%', borderCollapse: 'collapse' },
  th:      { padding: '8px 10px', textAlign: 'left',  color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  thr:     { padding: '8px 10px', textAlign: 'right', color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:      (bold) => ({ padding: '9px 10px', fontSize: '13px', textAlign: 'left',  borderBottom: `1px solid ${C.border}`, fontWeight: bold ? '700' : '400', color: C.textPrimary }),
  tdr:     (bold) => ({ padding: '9px 10px', fontSize: '13px', textAlign: 'right', borderBottom: `1px solid ${C.border}`, fontWeight: bold ? '700' : '400', color: C.textPrimary }),
  inp:     { padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px', fontFamily: 'inherit', outline: 'none' },
  btn:     (v) => {
    if (v === 'primary') return { padding: '9px 18px', background: C.red, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit' };
    if (v === 'success') return { padding: '9px 18px', background: C.green, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700', fontFamily: 'inherit' };
    return { padding: '9px 18px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' };
  },
  leeg:    { color: C.textMuted, textAlign: 'center', padding: '40px', fontStyle: 'italic', fontSize: '14px' },
  medal:   (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null,
  belt:    (b) => {
    const m = { wit:'#fff', geel:'#f1c40f', oranje:'#e67e22', groen:'#27ae60', blauw:'#3498db', bruin:'#8B4513', zwart:'#1a1a1a' };
    return { padding:'1px 7px', borderRadius:'10px', fontSize:'11px', fontWeight:'700', background: m[b]||'#555', color: ['wit','geel'].includes(b)?'#333':'#fff', border: b==='zwart'?'1px solid #555':'none', whiteSpace:'nowrap' };
  },
};

// ─── Data laden ───────────────────────────────────────────────────────────────

async function laadKlassementData(bereik, seizoenJaar) {
  const [
    membersSnap, attSnap, inschSnap,
    provEventsSnap, evenementenSnap,
    configSnap, groepenSnap, trainingenSnap,
  ] = await Promise.all([
    getDocs(collection(db, 'members')),
    getDocs(collectionGroup(db, 'attendance')),
    getDocs(collection(db, 'inschrijvingen')),
    getDocs(collection(db, 'events')),
    getDocs(collection(db, 'evenementen')),
    getDoc(doc(db, 'settings', 'puntenconfig')),
    getDocs(collection(db, 'groepen')),
    getDocs(query(collection(db, 'trainingen'), where('datum', '>=', bereik.start), where('datum', '<=', bereik.einde))),
  ]);

  const config = configSnap.exists() ? { ...DEFAULT_CONFIG, ...configSnap.data() } : { ...DEFAULT_CONFIG };

  // Groepen op naam (members.groepen = array van namen)
  const groepenByNaam = {};
  groepenSnap.docs.forEach(d => { const g = { id:d.id, ...d.data() }; groepenByNaam[g.naam] = g; });

  // Aanwezigheid dit seizoen per lid (totaal + per maand)
  const attCount = {};
  const attPerMaand = {};
  attSnap.forEach(d => {
    const { date } = d.data();
    if (!date || date < bereik.start || date > bereik.einde) return;
    const mid = d.ref.parent.parent?.id;
    if (!mid) return;
    attCount[mid] = (attCount[mid] || 0) + 1;
    const mnd = date.slice(0, 7);
    if (!attPerMaand[mid]) attPerMaand[mid] = {};
    attPerMaand[mid][mnd] = (attPerMaand[mid][mnd] || 0) + 1;
  });

  // Wedstrijd inschrijvingen dit seizoen
  const wedCount = {};
  inschSnap.docs.forEach(d => {
    const i = d.data();
    const datum = i.eventDatum || i.datum || '';
    if (datum >= bereik.start && datum <= bereik.einde && i.memberId) {
      wedCount[i.memberId] = (wedCount[i.memberId]||0) + 1;
    }
  });

  // Provinciale trainingen (events met type='provinciaal') dit seizoen
  const provEvents = provEventsSnap.docs
    .map(d => ({ id:d.id, ...d.data() }))
    .filter(e => e.type === 'provinciaal' && (e.datum||'') >= bereik.start && (e.datum||'') <= bereik.einde)
    .sort((a,b) => (a.datum||'').localeCompare(b.datum||''));

  // Club evenementen dit seizoen
  const evenementen = evenementenSnap.docs
    .map(d => ({ id:d.id, ...d.data() }))
    .filter(e => {
      const d = e.datum || e.date || '';
      return d >= bereik.start && d <= bereik.einde;
    });

  // Registraties laden voor provinciaal en evenementen
  const [provRegs, evntRegs] = await Promise.all([
    Promise.all(provEvents.map(e => getDocs(collection(db, 'events', e.id, 'registrations')))),
    Promise.all(evenementen.map(e => getDocs(collection(db, 'evenementen', e.id, 'registrations')))),
  ]);

  const provCount = {};
  const provDeelnemersPerEvent = {};
  provEvents.forEach((e, i) => {
    const deelnemers = new Set(provRegs[i].docs.map(d => d.id));
    provDeelnemersPerEvent[e.id] = deelnemers;
    deelnemers.forEach(mid => { provCount[mid] = (provCount[mid]||0) + 1; });
  });

  const evntCount = {};
  evenementen.forEach((e, i) => {
    evntRegs[i].docs.forEach(d => { evntCount[d.id] = (evntCount[d.id]||0) + 1; });
  });

  // Trainingen per groep: totaal + per maand (normaal + samengevoegd)
  const trainingenPerGroepId = {};
  const trPerGroepPerMaand = {};
  trainingenSnap.docs.forEach(d => {
    const t = d.data();
    const status = bepaalTrainingStatus(t);
    if (status !== TRAINING_STATUS.NORMAAL && status !== TRAINING_STATUS.SAMENGEVOEGD) return;
    if (!t.groepId) return;
    trainingenPerGroepId[t.groepId] = (trainingenPerGroepId[t.groepId] || 0) + 1;
    if (t.datum) {
      const mnd = t.datum.slice(0, 7);
      if (!trPerGroepPerMaand[t.groepId]) trPerGroepPerMaand[t.groepId] = {};
      trPerGroepPerMaand[t.groepId][mnd] = (trPerGroepPerMaand[t.groepId][mnd] || 0) + 1;
    }
  });
  const alleMaanden = seizoenMaandenVanBereik(bereik);

  // Alle categorieën verzamelen
  const allCategorieen = new Set();
  groepenSnap.docs.forEach(d => {
    (d.data().categorieen || []).forEach(c => allCategorieen.add(c));
  });
  const CAT_ORDER = ['U7','U9','U11','U13','U14','U15','U16','U18','U21','Senior'];
  const gesorteerdeCategorieen = [
    ...CAT_ORDER.filter(c => allCategorieen.has(c)),
    ...[...allCategorieen].filter(c => !CAT_ORDER.includes(c)).sort(),
  ];

  // Leden verrijken met punten, maandstats en categorieën
  const leden = membersSnap.docs.map(d => {
    const m = { id:d.id, ...d.data() };
    const att  = attCount[m.id] || 0;
    const wed  = wedCount[m.id] || 0;
    const prov = provCount[m.id] || 0;
    const evnt = evntCount[m.id] || 0;
    // Categorieën via groepsnaam
    const cats = new Set();
    (m.groepen || []).forEach(gNaam => {
      (groepenByNaam[gNaam]?.categorieen || []).forEach(c => cats.add(c));
    });
    // Maandstats: per maand met trainingen → aanwezig% → kwalificeert?
    const memberMaandAtt = attPerMaand[m.id] || {};
    const maandStats = {};
    for (const mnd of alleMaanden) {
      const mog = Math.max(
        0,
        ...(m.groepen || []).map(gNaam => trPerGroepPerMaand[groepenByNaam[gNaam]?.id]?.[mnd] || 0),
      );
      if (mog === 0) continue;
      const aanw = memberMaandAtt[mnd] || 0;
      const pct  = Math.round(aanw / mog * 100);
      maandStats[mnd] = { att: aanw, mogelijk: mog, pct, kwalificeert: pct >= (config.aanwezigheidsdrempel ?? 75) };
    }
    const kwaliMaanden       = Object.values(maandStats).filter(s => s.kwalificeert).length;
    const maandenMetTraining = Object.keys(maandStats).length;
    // Totale aanwezigheid% (seizoen, voor weergave)
    const mogelijkeTr = Math.max(
      0,
      ...(m.groepen || []).map(gNaam => trainingenPerGroepId[groepenByNaam[gNaam]?.id] || 0),
    );
    const attPct = mogelijkeTr > 0 ? Math.round(att / mogelijkeTr * 100) : null;
    const pts = {
      training:    kwaliMaanden * (config.clubtrainingPerMaand ?? config.clubtraining ?? 0),
      wedstrijd:   wed  * (config.wedstrijd           || 0),
      provinciaal: prov * (config.provincialeTraining || 0),
      evenement:   evnt * (config.clubevenement       || 0),
    };
    pts.totaal = pts.training + pts.wedstrijd + pts.provinciaal + pts.evenement;
    return { ...m, _att:att, _wed:wed, _prov:prov, _evnt:evnt, _pts:pts, _cats:[...cats], _mogelijkeTr:mogelijkeTr, _attPct:attPct, _maandStats:maandStats, _kwaliMaanden:kwaliMaanden, _maandenMetTraining:maandenMetTraining };
  });

  return { leden, gesorteerdeCategorieen, provEvents, provDeelnemersPerEvent, evenementen, config, alleMaanden };
}

// ─── KlassementTabel ──────────────────────────────────────────────────────────

function KlassementTabel({ leden, config, eigenMemberId, alleMaanden }) {
  const [categorie, setCategorie]     = useState('alles');
  const [zoek, setZoek]               = useState('');
  const [alleCategorieen, setAlles]   = useState([]);

  useEffect(() => {
    const cats = new Set(leden.flatMap(l => l._cats));
    const CAT_ORDER = ['U7','U9','U11','U13','U14','U15','U16','U18','U21','Senior'];
    setAlles([
      ...CAT_ORDER.filter(c => cats.has(c)),
      ...[...cats].filter(c => !CAT_ORDER.includes(c)).sort(),
    ]);
  }, [leden]);

  const drempel = config.aanwezigheidsdrempel ?? 75;

  const gefilterd = leden
    .filter(l => categorie === 'alles' || l._cats.includes(categorie))
    .filter(l => !zoek || (l.naam||'').toLowerCase().includes(zoek.toLowerCase()))
    .sort((a,b) => b._pts.totaal - a._pts.totaal);

  const totPts = leden.reduce((s,l) => s + l._pts.totaal, 0);
  const actief  = leden.filter(l => l._pts.totaal > 0).length;

  const eigenLid = eigenMemberId ? leden.find(l => l.id === eigenMemberId) : null;

  return (
    <div>
      {/* KPI strip */}
      <div style={S.kpiGrid}>
        <div style={S.kpi(C.blue)}><div style={S.kpiNum(C.blue)}>{leden.length}</div><div style={S.kpiLbl}>Leden</div></div>
        <div style={S.kpi(C.green)}><div style={S.kpiNum(C.green)}>{actief}</div><div style={S.kpiLbl}>Punthouders</div></div>
        <div style={S.kpi(C.orange)}><div style={S.kpiNum(C.orange)}>{totPts}</div><div style={S.kpiLbl}>Totale punten</div></div>
        {(config.clubtrainingPerMaand ?? config.clubtraining ?? 0) > 0 && <div style={S.kpi(C.purple)}><div style={S.kpiNum(C.purple)}>{config.clubtrainingPerMaand ?? config.clubtraining}pt</div><div style={S.kpiLbl}>Per kwalif. maand</div></div>}
        {config.wedstrijd > 0    && <div style={S.kpi(C.red)}><div style={S.kpiNum(C.red)}>{config.wedstrijd}pt</div><div style={S.kpiLbl}>Per wedstrijd</div></div>}
        {config.provincialeTraining > 0 && <div style={S.kpi(C.blue)}><div style={S.kpiNum(C.blue)}>{config.provincialeTraining}pt</div><div style={S.kpiLbl}>Per prov. training</div></div>}
        {config.clubevenement > 0 && <div style={S.kpi(C.textSec)}><div style={S.kpiNum(C.textSec)}>{config.clubevenement}pt</div><div style={S.kpiLbl}>Per evenement</div></div>}
      </div>

      {/* Jouw positie (voor leden) */}
      {eigenLid && (
        <div style={{ background:`rgba(230,51,70,0.08)`, border:`1px solid ${C.redBord}`, borderRadius:'12px', padding:'14px 16px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'12px' }}>
          <span style={{ fontSize:'22px' }}>👤</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:'700', fontSize:'14px' }}>{eigenLid.naam}</div>
            <div style={{ fontSize:'12px', color:C.textMuted, marginTop:'2px' }}>
              {(() => { const pos = gefilterd.findIndex(l=>l.id===eigenLid.id); return pos >= 0 ? `Positie #${pos+1}` : '(niet in huidige filter)'; })()}
              {' · '}{eigenLid._kwaliMaanden}/{eigenLid._maandenMetTraining} mnd
              {eigenLid._attPct !== null && (
                <span style={{ marginLeft:'4px', fontWeight:'700', color: eigenLid._attPct >= drempel ? C.green : C.orange }}>
                  ({eigenLid._attPct}%{eigenLid._attPct < drempel ? ' ⚠' : ''})
                </span>
              )}
              {' · '}wedstrijd {eigenLid._wed}× · provinciaal {eigenLid._prov}× · evenement {eigenLid._evnt}×
            </div>
          </div>
          <div style={{ fontSize:'24px', fontWeight:'900', color:C.red }}>{eigenLid._pts.totaal}pt</div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px', marginBottom:'12px', alignItems:'center' }}>
        <input
          placeholder="Zoek op naam…"
          value={zoek} onChange={e => setZoek(e.target.value)}
          style={{ ...S.inp, flex:'1', minWidth:'160px', maxWidth:'260px' }}
        />
      </div>
      <div style={S.chipRij}>
        <button style={S.chip(categorie==='alles')} onClick={() => setCategorie('alles')}>Alles</button>
        {alleCategorieen.map(c => (
          <button key={c} style={S.chip(categorie===c)} onClick={() => setCategorie(c)}>{c}</button>
        ))}
      </div>

      {/* Klassementtabel */}
      {gefilterd.length === 0
        ? <div style={S.leeg}>Geen leden gevonden.</div>
        : <div style={{ overflowX:'auto' }}>
            <table style={S.tbl}>
              <thead>
                <tr>
                  <th style={{ ...S.th, width:'36px' }}>#</th>
                  <th style={S.th}>Naam</th>
                  <th style={S.th}>Gordel</th>
                  {(config.clubtrainingPerMaand ?? config.clubtraining ?? 0) > 0 &&
                    <th style={{ ...S.thr, color:C.purple }}>Clubtraining<br/><span style={{ color:C.textMuted }}>{config.clubtrainingPerMaand ?? config.clubtraining}pt/mnd · min.{drempel}%</span></th>}
                  {config.wedstrijd > 0 &&
                    <th style={{ ...S.thr, color:C.red }}>Wedstrijd<br/><span style={{ color:C.textMuted }}>{config.wedstrijd}pt/×</span></th>}
                  {config.provincialeTraining > 0 &&
                    <th style={{ ...S.thr, color:C.blue }}>Provinciaal<br/><span style={{ color:C.textMuted }}>{config.provincialeTraining}pt/×</span></th>}
                  {config.clubevenement > 0 &&
                    <th style={{ ...S.thr, color:C.textSec }}>Evenement<br/><span style={{ color:C.textMuted }}>{config.clubevenement}pt/×</span></th>}
                  <th style={{ ...S.thr, color:C.orange }}>Totaal</th>
                </tr>
              </thead>
              <tbody>
                {gefilterd.map((l, i) => {
                  const isEigen = eigenMemberId !== null && l.id === eigenMemberId;
                  const rowBg = isEigen ? 'rgba(230,51,70,0.06)' : i % 2 === 0 ? C.card : C.bg;
                  const medal = S.medal(i + 1);
                  return (
                    <tr key={l.id} style={{ background: rowBg }}>
                      <td style={{ ...S.td(), fontSize:'12px', color:C.textMuted, fontWeight:'700' }}>
                        {medal ? <span>{medal}</span> : `${i+1}`}
                      </td>
                      <td style={S.td(isEigen)}>
                        {l.naam}
                        {isEigen && <span style={{ marginLeft:'6px', fontSize:'10px', background:C.redDim, color:C.red, border:`1px solid ${C.redBord}`, borderRadius:'4px', padding:'1px 5px' }}>jij</span>}
                      </td>
                      <td style={S.td()}>
                        {(l.gordel||l.belt) ? <span style={S.belt(l.gordel||l.belt)}>{l.gordel||l.belt}</span> : <span style={{ color:C.textMuted }}>—</span>}
                      </td>
                      {(config.clubtrainingPerMaand ?? config.clubtraining ?? 0) > 0 &&
                        <td style={{ ...S.tdr(), verticalAlign:'top', paddingTop:'10px' }}>
                          {l._maandenMetTraining === 0
                            ? <span style={{ color:C.textMuted }}>—</span>
                            : <>
                                <div style={{ fontWeight:'700', color:l._pts.training>0?C.purple:C.textMuted, fontSize:'14px' }}>
                                  {l._pts.training>0 ? `${l._pts.training}pt` : '0pt'}
                                </div>
                                <div style={{ fontSize:'10px', color:C.textMuted, marginTop:'1px' }}>
                                  {l._kwaliMaanden}/{l._maandenMetTraining} mnd
                                  {l._attPct !== null && <span style={{ marginLeft:'4px', color: l._attPct >= drempel ? C.green : C.orange }}>{l._attPct}%</span>}
                                </div>
                                <div style={{ display:'flex', gap:'2px', marginTop:'4px', flexWrap:'wrap', maxWidth:'90px', justifyContent:'flex-end' }}>
                                  {alleMaanden.map(mnd => {
                                    const st = l._maandStats[mnd];
                                    if (!st) return null;
                                    const kort = mnd.slice(5); // "09", "10", ...
                                    return (
                                      <div key={mnd} title={`${mnd}: ${st.att}/${st.mogelijk} (${st.pct}%)`}
                                        style={{ width:'10px', height:'10px', borderRadius:'2px', background: st.kwalificeert ? C.green : C.orange, flexShrink:0, cursor:'default' }}
                                      />
                                    );
                                  })}
                                </div>
                              </>
                          }
                        </td>}
                      {config.wedstrijd > 0 &&
                        <td style={{ ...S.tdr(), color:l._pts.wedstrijd>0?C.red:C.textMuted }}>
                          {l._pts.wedstrijd>0 ? <><span style={{ fontWeight:'700' }}>{l._pts.wedstrijd}</span><span style={{ fontSize:'11px', color:C.textMuted }}> ({l._wed}×)</span></> : '—'}
                        </td>}
                      {config.provincialeTraining > 0 &&
                        <td style={{ ...S.tdr(), color:l._pts.provinciaal>0?C.blue:C.textMuted }}>
                          {l._pts.provinciaal>0 ? <><span style={{ fontWeight:'700' }}>{l._pts.provinciaal}</span><span style={{ fontSize:'11px', color:C.textMuted }}> ({l._prov}×)</span></> : '—'}
                        </td>}
                      {config.clubevenement > 0 &&
                        <td style={{ ...S.tdr(), color:l._pts.evenement>0?C.textSec:C.textMuted }}>
                          {l._pts.evenement>0 ? <><span style={{ fontWeight:'700' }}>{l._pts.evenement}</span><span style={{ fontSize:'11px', color:C.textMuted }}> ({l._evnt}×)</span></> : '—'}
                        </td>}
                      <td style={{ ...S.tdr(true), color: l._pts.totaal > 0 ? C.orange : C.textMuted, fontSize:'15px' }}>
                        {l._pts.totaal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      }
    </div>
  );
}

// ─── ProvinciaalBeheer ────────────────────────────────────────────────────────

function ProvinciaalBeheer({ provEvents, provDeelnemersPerEvent, leden, seizoenJaar, onRefresh }) {
  const [huidigEvent,  setHuidigEvent]  = useState(null); // event waarvoor attendance beheerd wordt
  const [attState,     setAttState]     = useState(new Set()); // lidIds als aanwezig gemarkeerd
  const [attLaden,     setAttLaden]     = useState(false);
  const [opslaan,      setOpslaan]      = useState(false);
  const [zoek,         setZoek]         = useState('');
  // Nieuw event formulier
  const [toevForm, setToevForm]         = useState(false);
  const [nDatum,   setNDatum]           = useState('');
  const [nNaam,    setNNaam]            = useState('');
  const [nDoelgr,  setNDoelgr]         = useState('');
  const [aanmaken, setAanmaken]         = useState(false);

  function openEvent(ev) {
    setHuidigEvent(ev);
    setAttState(new Set(provDeelnemersPerEvent[ev.id] || []));
    setZoek('');
  }

  function toggleLid(id) {
    setAttState(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function slaAttendanceOp() {
    if (!huidigEvent) return;
    setOpslaan(true);
    try {
      const huidigeDeelnemers = provDeelnemersPerEvent[huidigEvent.id] || new Set();
      const batch = writeBatch(db);
      // Toevoegen
      [...attState].filter(id => !huidigeDeelnemers.has(id)).forEach(id => {
        batch.set(doc(db, 'events', huidigEvent.id, 'registrations', id), {
          aanwezig: true, geregistreerdOp: serverTimestamp(),
        });
      });
      // Verwijderen
      [...huidigeDeelnemers].filter(id => !attState.has(id)).forEach(id => {
        batch.delete(doc(db, 'events', huidigEvent.id, 'registrations', id));
      });
      await batch.commit();
      onRefresh();
      setHuidigEvent(null);
    } catch (e) {
      console.error(e);
    } finally {
      setOpslaan(false);
    }
  }

  async function maakEventAan() {
    if (!nDatum || !nNaam) return;
    setAanmaken(true);
    try {
      await addDoc(collection(db, 'events'), {
        type: 'provinciaal',
        naam: nNaam,
        datum: nDatum,
        doelgroep: nDoelgr,
        seizoen: `${seizoenJaar}-${seizoenJaar + 1}`,
        createdAt: serverTimestamp(),
      });
      setNDatum(''); setNNaam(''); setNDoelgr('');
      setToevForm(false);
      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setAanmaken(false);
    }
  }

  const gefilterdeleden = leden
    .filter(l => l.actief !== false)
    .filter(l => !zoek || (l.naam||'').toLowerCase().includes(zoek.toLowerCase()))
    .sort((a,b) => (a.naam||'').localeCompare(b.naam||''));

  if (huidigEvent) {
    const aantalAanwezig = attState.size;
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
          <button style={S.btn()} onClick={() => setHuidigEvent(null)}>← Terug</button>
          <div>
            <div style={{ fontWeight:'700', fontSize:'15px' }}>{huidigEvent.naam}</div>
            <div style={{ fontSize:'12px', color:C.textMuted }}>{huidigEvent.datum} · {aantalAanwezig} aanwezig</div>
          </div>
          <button style={{ ...S.btn('success'), marginLeft:'auto' }} onClick={slaAttendanceOp} disabled={opslaan}>
            {opslaan ? 'Opslaan…' : '✓ Opslaan'}
          </button>
        </div>

        <input
          placeholder="Zoek lid…"
          value={zoek} onChange={e => setZoek(e.target.value)}
          style={{ ...S.inp, width:'100%', boxSizing:'border-box', marginBottom:'12px' }}
        />

        <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
          <button style={S.btn()} onClick={() => setAttState(new Set(gefilterdeleden.map(l => l.id)))}>Alle aanwezig</button>
          <button style={S.btn()} onClick={() => setAttState(new Set())}>Alle afwezig</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
          {gefilterdeleden.map(l => {
            const aanwezig = attState.has(l.id);
            return (
              <div
                key={l.id}
                onClick={() => toggleLid(l.id)}
                style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 14px', background: aanwezig ? 'rgba(34,197,94,0.08)' : C.card, border: `1px solid ${aanwezig ? C.green : C.border}`, borderRadius:'8px', cursor:'pointer' }}
              >
                <div style={{ width:'20px', height:'20px', borderRadius:'4px', background: aanwezig ? C.green : C.bg, border: `1px solid ${aanwezig ? C.green : C.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {aanwezig && <span style={{ color:'#fff', fontSize:'13px', fontWeight:'700' }}>✓</span>}
                </div>
                <span style={{ fontWeight: aanwezig ? '700' : '400', color: aanwezig ? C.textPrimary : C.textSec, flex:1 }}>{l.naam}</span>
                {(l.gordel||l.belt) && <span style={S.belt(l.gordel||l.belt)}>{l.gordel||l.belt}</span>}
                {(l.groepen||[]).length > 0 && <span style={{ fontSize:'11px', color:C.textMuted }}>{l.groepen[0]}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <h3 style={{ margin:0, fontSize:'15px', fontWeight:'700' }}>Provinciale trainingen dit seizoen</h3>
        <button style={S.btn('primary')} onClick={() => setToevForm(f => !f)}>+ Toevoegen</button>
      </div>

      {/* Nieuw aanmaken */}
      {toevForm && (
        <div style={{ ...S.card, border:`1px solid ${C.redBord}` }}>
          <h4 style={{ margin:'0 0 12px', fontSize:'14px', fontWeight:'700' }}>Nieuwe provinciale training</h4>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ display:'flex', gap:'8px' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'11px', color:C.textMuted, marginBottom:'4px', fontWeight:'600' }}>Datum *</div>
                <input type="date" value={nDatum} onChange={e => setNDatum(e.target.value)} style={{ ...S.inp, width:'100%', boxSizing:'border-box' }} />
              </div>
              <div style={{ flex:2 }}>
                <div style={{ fontSize:'11px', color:C.textMuted, marginBottom:'4px', fontWeight:'600' }}>Naam *</div>
                <input value={nNaam} onChange={e => setNNaam(e.target.value)} placeholder="bv. Provinciale training U13+" style={{ ...S.inp, width:'100%', boxSizing:'border-box' }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize:'11px', color:C.textMuted, marginBottom:'4px', fontWeight:'600' }}>Doelgroep (optioneel)</div>
              <input value={nDoelgr} onChange={e => setNDoelgr(e.target.value)} placeholder="bv. U13, U15, Senior" style={{ ...S.inp, width:'100%', boxSizing:'border-box' }} />
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button style={S.btn()} onClick={() => setToevForm(false)}>Annuleer</button>
              <button style={S.btn('primary')} onClick={maakEventAan} disabled={!nDatum||!nNaam||aanmaken}>
                {aanmaken ? 'Aanmaken…' : 'Aanmaken'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lijst events */}
      {provEvents.length === 0 && !toevForm
        ? <div style={S.leeg}>Geen provinciale trainingen geregistreerd dit seizoen.<br/>Klik op "+ Toevoegen" om er een aan te maken.</div>
        : provEvents.map(ev => {
          const n = (provDeelnemersPerEvent[ev.id] || new Set()).size;
          return (
            <div key={ev.id} style={{ ...S.card, display:'flex', alignItems:'center', gap:'12px', cursor:'pointer' }} onClick={() => openEvent(ev)}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:'700', fontSize:'14px' }}>{ev.naam}</div>
                <div style={{ fontSize:'12px', color:C.textMuted, marginTop:'2px' }}>
                  {ev.datum}
                  {ev.doelgroep && <span style={{ marginLeft:'8px', color:C.blue }}>{ev.doelgroep}</span>}
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:'700', color:n>0?C.green:C.textMuted, fontSize:'15px' }}>{n}</div>
                <div style={{ fontSize:'11px', color:C.textMuted }}>deelnemers</div>
              </div>
              <span style={{ color:C.textMuted, fontSize:'12px' }}>→</span>
            </div>
          );
        })
      }
    </div>
  );
}

// ─── PuntenConfig ─────────────────────────────────────────────────────────────

function PuntenConfig({ config, onSaved }) {
  const [training,   setTraining]   = useState(String(config.clubtrainingPerMaand ?? config.clubtraining ?? 5));
  const [wedstrijd,  setWedstrijd]  = useState(String(config.wedstrijd ?? 3));
  const [prov,       setProv]       = useState(String(config.provincialeTraining ?? 2));
  const [evenement,  setEvenement]  = useState(String(config.clubevenement ?? 1));
  const [drempel,    setDrempel]    = useState(String(config.aanwezigheidsdrempel ?? 75));
  const [opslaan,    setOpslaan]    = useState(false);
  const [opgeslagen, setOpgeslagen] = useState(false);

  async function slaOp() {
    setOpslaan(true);
    await setDoc(doc(db, 'settings', 'puntenconfig'), {
      clubtrainingPerMaand: Number(training)   || 0,
      wedstrijd:            Number(wedstrijd)  || 0,
      provincialeTraining:  Number(prov)       || 0,
      clubevenement:        Number(evenement)  || 0,
      aanwezigheidsdrempel: Number(drempel)    || 75,
      bijgewerktOp: serverTimestamp(),
    }, { merge: true });
    setOpslaan(false);
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
    onSaved();
  }

  const rij = (label, val, setVal, kleur, desc, eenheid = 'pt') => (
    <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:`1px solid ${C.border}` }}>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:'600', fontSize:'13px' }}>{label}</div>
        <div style={{ fontSize:'12px', color:C.textMuted, marginTop:'2px' }}>{desc}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <input
          type="number" min="0" step={eenheid === '%' ? '5' : '0.5'} value={val} onChange={e => setVal(e.target.value)}
          style={{ ...S.inp, width:'72px', textAlign:'right' }}
        />
        <span style={{ fontSize:'12px', color:kleur, fontWeight:'700', minWidth:'24px' }}>{eenheid}</span>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize:'13px', color:C.textMuted, marginBottom:'16px' }}>
        Stel in hoeveel punten elke activiteit oplevert. Wijzigingen zijn direct van toepassing op alle seizoenen.
      </div>
      <div style={S.card}>
        {rij('Clubtraining — punten per kwalificerende maand', training, setTraining, C.purple, `Punten per maand dat een lid de aanwezigheidsdrempel (${config.aanwezigheidsdrempel ?? 75}%) haalt`)}
        {rij('Wedstrijd deelname',    wedstrijd, setWedstrijd, C.red,   'Per deelname aan een wedstrijd (ongeacht resultaat)')}
        {rij('Provinciale training',  prov, setProv, C.blue,            'Per deelname aan een provinciale training')}
        {rij('Club evenement',        evenement, setEvenement, C.textSec,'Per registratie aan een clubevenement (via Clubevenementen-pagina)')}
        {rij('Aanwezigheidsdrempel clubtraining', drempel, setDrempel, C.orange, 'Minimum % clubtrainingen aanwezig (aanwezige trainingen ÷ gegeven trainingen van de groep). Leden onder dit % krijgen een ⚠ in het klassement.', '%')}
        <div style={{ paddingTop:'12px', display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button style={S.btn(opgeslagen ? 'success' : 'primary')} onClick={slaOp} disabled={opslaan}>
            {opgeslagen ? '✓ Opgeslagen' : opslaan ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hoofd component ──────────────────────────────────────────────────────────

export default function Klassement() {
  const { profiel, isBeheerder, isTrainer, isAssistent } = useAuth();
  const eigenMemberId = profiel?.linkedMemberId ?? null;
  const seizoenen = beschikbareSeizoenStartJaren().filter(j => j <= huidigSeizoenStartJaar());

  const [seizoenJaar, setSeizoenJaar] = useState(() => huidigSeizoenStartJaar());
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [sectie,      setSectie]      = useState('klassement'); // 'klassement' | 'provinciaal' | 'config'

  const canManage = isBeheerder || isTrainer || isAssistent;

  const laad = useCallback(async () => {
    setLoading(true);
    try {
      const bereik = seizoenBereikVanJaar(seizoenJaar);
      setData(await laadKlassementData(bereik, seizoenJaar));
    } catch (e) {
      console.error('Klassement laden mislukt:', e);
    } finally {
      setLoading(false);
    }
  }, [seizoenJaar]);

  useEffect(() => { laad(); }, [laad]);

  const bereik = seizoenBereikVanJaar(seizoenJaar);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>🏅 Clubklassement</h1>
        <p style={S.sub}>Punten per activiteitstype · {bereik.label}</p>
      </div>

      {/* Seizoenkiezer */}
      <div style={{ marginBottom:'16px' }}>
        <div style={S.sLabel}>Seizoen</div>
        <div style={S.chipRij}>
          {seizoenen.map(jaar => (
            <button key={jaar} style={S.chip(seizoenJaar===jaar)} onClick={() => { setSeizoenJaar(jaar); setSectie('klassement'); }}>
              {seizoenBereikVanJaar(jaar).label}
            </button>
          ))}
        </div>
      </div>

      {/* Sectietabs — enkel voor trainer+ */}
      {canManage && (
        <div style={S.tabBar}>
          <button style={S.tab(sectie==='klassement')}  onClick={() => setSectie('klassement')}>🏅 Klassement</button>
          <button style={S.tab(sectie==='provinciaal')} onClick={() => setSectie('provinciaal')}>🗓️ Provinciale trainingen</button>
          {isBeheerder && <button style={S.tab(sectie==='config')} onClick={() => setSectie('config')}>⚙️ Puntenconfiguratie</button>}
        </div>
      )}

      {loading && (
        <div style={{ color:C.textMuted, textAlign:'center', padding:'48px', fontSize:'14px' }}>Laden…</div>
      )}

      {!loading && data && (
        <>
          {sectie === 'klassement' && (
            <KlassementTabel leden={data.leden} config={data.config} eigenMemberId={eigenMemberId} alleMaanden={data.alleMaanden} />
          )}
          {sectie === 'provinciaal' && canManage && (
            <ProvinciaalBeheer
              provEvents={data.provEvents}
              provDeelnemersPerEvent={data.provDeelnemersPerEvent}
              leden={data.leden}
              seizoenJaar={seizoenJaar}
              onRefresh={laad}
            />
          )}
          {sectie === 'config' && isBeheerder && (
            <PuntenConfig config={data.config} onSaved={laad} />
          )}
        </>
      )}
    </div>
  );
}
