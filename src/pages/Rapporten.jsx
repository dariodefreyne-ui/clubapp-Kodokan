// src/pages/Rapporten.jsx — v3
// Rapporten per seizoen: trainingen, lesgevers/uitbetalingen, aanwezigheid,
// winkel, verkoop en examens.
import React, { useState, useEffect } from 'react';
import {
  collection, getDocs, collectionGroup, query, orderBy, where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  huidigSeizoenStartJaar, beschikbareSeizoenStartJaren, seizoenBereikVanJaar,
} from '../utils/seizoenUtils';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../components/trainingen/trainingStatus';
import { minutenNaarUren, formatUren, formatBedrag, vindLesgever } from '../components/uitbetalingen/uitbetalingHelpers';
import { useLesgeversRealtime } from '../hooks/useLesgeversRealtime';
import { C } from '../styles/tokens';

// ─── Design tokens ────────────────────────────────────────────────────────────

const S = {
  page:     { color: C.textPrimary, paddingBottom: '48px', minHeight: '100vh' },
  header:   { marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` },
  title:    { margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' },
  subtitle: { margin: 0, fontSize: '14px', color: C.textSec },
  sLabel:   { fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' },
  chipRij:  { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
  chip:     (a) => ({ padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: a ? C.red : C.card, border: `1px solid ${a ? C.red : C.border}`, color: a ? '#fff' : C.textSec, fontFamily: 'inherit' }),
  tabBar:   { display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${C.border}`, marginBottom: '20px' },
  tab:      (a) => ({ background: 'none', border: 'none', borderBottom: `2px solid ${a ? C.red : 'transparent'}`, color: a ? C.textPrimary : C.textMuted, padding: '10px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: a ? '700' : '400', whiteSpace: 'nowrap', fontFamily: 'inherit' }),
  card:     { background: C.card, borderRadius: '12px', padding: '16px', border: `1px solid ${C.border}`, marginBottom: '16px' },
  kpiGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px', marginBottom: '24px' },
  kpi:      (c) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', borderLeft: `3px solid ${c || C.blue}` }),
  kpiNum:   (c) => ({ fontSize: '22px', fontWeight: '800', color: c || C.textPrimary }),
  kpiLbl:   { fontSize: '11px', color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' },
  kpiSub:   { fontSize: '11px', color: C.textMuted, marginTop: '2px' },
  tbl:      { width: '100%', borderCollapse: 'collapse' },
  th:       { padding: '8px 10px', textAlign: 'left', color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  thr:      { padding: '8px 10px', textAlign: 'right', color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:       { padding: '8px 10px', fontSize: '13px', textAlign: 'left', borderBottom: `1px solid ${C.border}`, color: C.textPrimary },
  tdr:      { padding: '8px 10px', fontSize: '13px', textAlign: 'right', borderBottom: `1px solid ${C.border}`, color: C.textPrimary },
  bar:      (p, c) => ({ height: '14px', background: `linear-gradient(90deg,${c||C.red} ${p}%,${C.bg} ${p}%)`, borderRadius: '4px', marginTop: '4px' }),
  leeg:     { color: C.textMuted, textAlign: 'center', padding: '40px', fontStyle: 'italic', fontSize: '14px' },
  loadBtn:  { padding: '8px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
  h3:       { margin: '0 0 12px', fontSize: '15px', fontWeight: '700' },
  beltBadge:(b) => {
    const m = { wit:'#fff', geel:'#f1c40f', oranje:'#e67e22', groen:'#27ae60', blauw:'#3498db', bruin:'#8B4513', zwart:'#1a1a1a' };
    return { marginLeft:'6px', padding:'1px 7px', borderRadius:'10px', fontSize:'11px', fontWeight:'700', background: m[b]||'#555', color: ['wit','geel'].includes(b)?'#333':'#fff', border: b==='zwart'?'1px solid #555':'none' };
  },
};

// ─── Kleine herbruikbare componenten ─────────────────────────────────────────

function Kpi({ label, value, color, sub }) {
  return (
    <div style={S.kpi(color)}>
      <div style={S.kpiNum(color)}>{value}</div>
      <div style={S.kpiLbl}>{label}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

function Sectiekop({ children, extra }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
      <h3 style={{ margin:0, fontSize:'15px', fontWeight:'700' }}>{children}</h3>
      {extra}
    </div>
  );
}

// ─── Data laden ───────────────────────────────────────────────────────────────

async function laadTrainingData(bereik) {
  const [trainSnap, groepenSnap, tariefSnap] = await Promise.all([
    getDocs(query(collection(db,'trainingen'), where('datum','>=',bereik.start), where('datum','<=',bereik.einde), orderBy('datum'))),
    getDocs(collection(db,'groepen')),
    getDocs(collection(db,'tarieven')),
  ]);
  const groepenMap = {};
  groepenSnap.docs.forEach(d => { groepenMap[d.id] = { id:d.id, ...d.data() }; });
  const tarieven = {};
  tariefSnap.docs.forEach(d => { tarieven[d.id] = d.data(); });
  const trainingen = trainSnap.docs.map(d => {
    const data = d.data();
    const groep = groepenMap[data.groepId] || {};
    return { id:d.id, ...data, _status: bepaalTrainingStatus(data, { volgtProvincialeKalender: !!groep.volgtProvincialeKalender }), _groep: groep };
  });
  return { trainingen, groepenMap, tarieven };
}

async function laadTechnieken(trainingIds) {
  const set = new Set(trainingIds);
  const snap = await getDocs(collectionGroup(db,'technieken'));
  const byTech = {};
  snap.docs.forEach(d => {
    if (!set.has(d.ref.parent.parent?.id)) return;
    const t = d.data();
    const naam = t.techniekNaam || t.naam || '?';
    if (!byTech[naam]) byTech[naam] = { naam, totaal:0, basis:0, verdieping:0 };
    byTech[naam].totaal++;
    if ((t.fase||'').toLowerCase().includes('verdiep')) byTech[naam].verdieping++;
    else byTech[naam].basis++;
  });
  return Object.values(byTech).sort((a,b) => b.totaal - a.totaal);
}

async function laadAanwezigheid(bereik) {
  const [membersSnap, attSnap] = await Promise.all([
    getDocs(collection(db,'members')),
    getDocs(collectionGroup(db,'attendance')),
  ]);
  const countByMember = {};
  attSnap.forEach(d => {
    const { date } = d.data();
    if (date && date >= bereik.start && date <= bereik.einde) {
      const mid = d.ref.parent.parent?.id;
      if (mid) countByMember[mid] = (countByMember[mid]||0) + 1;
    }
  });
  return membersSnap.docs
    .map(d => ({ id:d.id, ...d.data(), aanwezigheid: countByMember[d.id]||0 }))
    .sort((a,b) => b.aanwezigheid - a.aanwezigheid);
}

async function laadWinkel() {
  const snap = await getDocs(query(collection(db,'products'), orderBy('soldCount','desc')));
  const products = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  const totalValue   = products.reduce((s,p) => s + (p.costPrice||0)*(p.stock||0), 0);
  const totalRevenue = products.reduce((s,p) => s + (p.price||0)*(p.soldCount||0), 0);
  const totalCost    = products.reduce((s,p) => s + (p.costPrice||0)*(p.soldCount||0), 0);
  return { products, totalValue, totalRevenue, margin: totalRevenue - totalCost };
}

async function laadVerkoop(bereik) {
  const [salesSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db,'sales'), orderBy('aangemaaktOp','desc'))),
    getDocs(collection(db,'users')),
  ]);
  const verkoperMap = {};
  usersSnap.docs.forEach(d => { const u = d.data(); verkoperMap[d.id] = u.naam||u.displayName||d.id; });
  const sales = salesSnap.docs
    .map(d => { const sd = d.data(); return { id:d.id, ...sd, _totaal: sd.totaal??sd.total??0, _ts: sd.aangemaaktOp||sd.createdAt }; })
    .filter(s => {
      const dt = s._ts?.toDate ? s._ts.toDate().toISOString().slice(0,10) : '';
      return dt >= bereik.start && dt <= bereik.einde;
    });
  const total = sales.reduce((s,x) => s + (x._totaal||0), 0);
  const byDate = {};
  sales.forEach(s => {
    const d = s._ts?.toDate ? s._ts.toDate().toLocaleDateString('nl-BE') : '—';
    byDate[d] = (byDate[d]||0) + (s._totaal||0);
  });
  return { sales, total, count: sales.length, byDate, verkoperMap };
}

async function laadExamens(bereik) {
  const snap = await getDocs(query(collection(db,'events'), where('type','==','examen')));
  const events = snap.docs.map(d => ({ id:d.id, ...d.data() }))
    .filter(e => e.date >= bereik.start && e.date <= bereik.einde);
  return Promise.all(events.map(async ev => {
    const regSnap = await getDocs(collection(db,'events',ev.id,'registrations'));
    const regs = regSnap.docs.map(d => d.data());
    const passed = regs.filter(r => r.result==='geslaagd').length;
    const total  = regs.filter(r => r.result!=='afwezig').length;
    return { ...ev, candidates:regs.length, passed, failed:regs.filter(r=>r.result==='niet_geslaagd').length, absent:regs.filter(r=>r.result==='afwezig').length, passRate: total>0?Math.round(passed/total*100):0 };
  }));
}

// ─── Tab: Trainingen ──────────────────────────────────────────────────────────

function TrainingenTab({ trainingen, groepenMap }) {
  const [techData,  setTechData]  = useState(null);
  const [techLaden, setTechLaden] = useState(false);

  const totaal       = trainingen.length;
  const normaal      = trainingen.filter(t => t._status === TRAINING_STATUS.NORMAAL).length;
  const geannuleerd  = trainingen.filter(t => t._status === TRAINING_STATUS.GEANNULEERD).length;
  const samengevoegd = trainingen.filter(t => t._status === TRAINING_STATUS.SAMENGEVOEGD).length;
  const geen         = trainingen.filter(t => t._status === TRAINING_STATUS.GEEN).length;
  const metTwee      = trainingen.filter(t =>
    (t._status === TRAINING_STATUS.NORMAAL || t._status === TRAINING_STATUS.SAMENGEVOEGD)
    && (t.lesgevers||[]).length >= 2
  ).length;

  // Per-groep aggregatie
  const perGroep = {};
  trainingen.forEach(t => {
    const gId = t.groepId || '?';
    if (!perGroep[gId]) {
      const g = groepenMap[gId] || {};
      perGroep[gId] = { naam:g.naam||gId, provinciaal:!!g.volgtProvincialeKalender, totaal:0, normaal:0, geannuleerd:0, samengevoegd:0, geen:0, metTwee:0, uren:0 };
    }
    const s = perGroep[gId];
    s.totaal++;
    s[t._status] = (s[t._status]||0) + 1;
    const isActief = t._status === TRAINING_STATUS.NORMAAL || t._status === TRAINING_STATUS.SAMENGEVOEGD;
    if (isActief && (t.lesgevers||[]).length >= 2) s.metTwee++;
    if (isActief) s.uren += minutenNaarUren(t.duurMinuten || t._groep?.duurMinuten || 60);
  });
  const groepenLijst = Object.values(perGroep).sort((a,b) => b.normaal - a.normaal);
  const totalUren = groepenLijst.reduce((s,g) => s + g.uren, 0);

  async function loadTech() {
    setTechLaden(true);
    const ids = trainingen.filter(t => t._status === TRAINING_STATUS.NORMAAL || t._status === TRAINING_STATUS.SAMENGEVOEGD).map(t => t.id);
    setTechData(await laadTechnieken(ids));
    setTechLaden(false);
  }

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Totaal gepland"   value={totaal}               color={C.blue} />
        <Kpi label="Gegeven"          value={normaal + samengevoegd} color={C.green} sub={`${totalUren.toFixed(1)} uur`} />
        <Kpi label="Geannuleerd"      value={geannuleerd}          color={C.red} />
        <Kpi label="Geen training"    value={geen}                 color={C.textMuted} />
        <Kpi label="Samengevoegd"     value={samengevoegd}         color={C.purple} />
        <Kpi label="Met 2 lesgevers"  value={metTwee}              color={C.orange} />
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Per groep</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={S.th}>Groep</th>
                <th style={S.thr}>Gepland</th>
                <th style={{ ...S.thr, color:C.green }}>Gegeven</th>
                <th style={{ ...S.thr, color:C.red }}>Geann.</th>
                <th style={{ ...S.thr, color:C.purple }}>Samenv.</th>
                <th style={S.thr}>Geen</th>
                <th style={{ ...S.thr, color:C.orange }}>2× les.</th>
                <th style={{ ...S.thr, color:C.blue }}>Uren</th>
              </tr>
            </thead>
            <tbody>
              {groepenLijst.map((g,i) => (
                <tr key={g.naam} style={{ background: i%2===0 ? C.card : C.bg }}>
                  <td style={S.td}>
                    <span style={{ fontWeight:'600' }}>{g.naam}</span>
                    {g.provinciaal && <span style={{ marginLeft:'6px', fontSize:'10px', background:C.blueDim, color:C.blue, border:`1px solid rgba(56,189,248,0.3)`, borderRadius:'4px', padding:'1px 5px' }}>prov.</span>}
                  </td>
                  <td style={S.tdr}>{g.totaal}</td>
                  <td style={{ ...S.tdr, color:C.green, fontWeight:'600' }}>{(g.normaal||0)+(g.samengevoegd||0)}</td>
                  <td style={{ ...S.tdr, color:(g.geannuleerd||0)>0?C.red:C.textMuted }}>{g.geannuleerd||0}</td>
                  <td style={{ ...S.tdr, color:(g.samengevoegd||0)>0?C.purple:C.textMuted }}>{g.samengevoegd||0}</td>
                  <td style={{ ...S.tdr, color:C.textMuted }}>{g.geen||0}</td>
                  <td style={{ ...S.tdr, color:g.metTwee>0?C.orange:C.textMuted }}>{g.metTwee}</td>
                  <td style={{ ...S.tdr, color:C.blue }}>{g.uren.toFixed(1)}u</td>
                </tr>
              ))}
              {groepenLijst.length > 1 && (
                <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
                  <td style={{ ...S.td, fontWeight:'800' }}>Totaal</td>
                  <td style={{ ...S.tdr, fontWeight:'700' }}>{totaal}</td>
                  <td style={{ ...S.tdr, color:C.green, fontWeight:'700' }}>{normaal+samengevoegd}</td>
                  <td style={{ ...S.tdr, color:C.red, fontWeight:'700' }}>{geannuleerd}</td>
                  <td style={{ ...S.tdr, color:C.purple, fontWeight:'700' }}>{samengevoegd}</td>
                  <td style={{ ...S.tdr, fontWeight:'700' }}>{geen}</td>
                  <td style={{ ...S.tdr, color:C.orange, fontWeight:'700' }}>{metTwee}</td>
                  <td style={{ ...S.tdr, color:C.blue, fontWeight:'700' }}>{totalUren.toFixed(1)}u</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technieken sectie */}
      <div style={S.card}>
        <Sectiekop extra={!techData && <button style={S.loadBtn} onClick={loadTech} disabled={techLaden}>{techLaden?'Laden…':'Laad technieken'}</button>}>
          🥋 Technieken aan bod
        </Sectiekop>
        {!techData && !techLaden && (
          <div style={{ fontSize:'13px', color:C.textMuted }}>Klik op "Laad technieken" om te zien welke technieken dit seizoen aan bod zijn gekomen.</div>
        )}
        {techData && (
          techData.length === 0
            ? <div style={S.leeg}>Geen technieken geregistreerd voor dit seizoen.</div>
            : <>
                <div style={{ fontSize:'12px', color:C.textMuted, marginBottom:'12px' }}>{techData.length} technieken · {techData.reduce((s,t)=>s+t.totaal,0)}× gegeven</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={S.tbl}>
                    <thead>
                      <tr>
                        <th style={S.th}>Techniek</th>
                        <th style={S.thr}>Totaal</th>
                        <th style={{ ...S.thr, color:C.green }}>Basis</th>
                        <th style={{ ...S.thr, color:C.orange }}>Verdieping</th>
                      </tr>
                    </thead>
                    <tbody>
                      {techData.slice(0,60).map((t,i) => (
                        <tr key={t.naam} style={{ background:i%2===0?C.card:C.bg }}>
                          <td style={S.td}>{t.naam}</td>
                          <td style={{ ...S.tdr, fontWeight:'700' }}>{t.totaal}×</td>
                          <td style={{ ...S.tdr, color:C.green }}>{t.basis||'—'}</td>
                          <td style={{ ...S.tdr, color:C.orange }}>{t.verdieping||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Lesgevers & Uitbetalingen ──────────────────────────────────────────

function LesgeversTab({ trainingen, lesgeversLijst, tarieven }) {
  const actief = trainingen.filter(t =>
    t._status === TRAINING_STATUS.NORMAAL || t._status === TRAINING_STATUS.SAMENGEVOEGD
  );

  const perLesgever = {};
  actief.forEach(t => {
    (t.lesgevers||[]).forEach(key => {
      const lsg = vindLesgever(key, lesgeversLijst);
      const id = lsg?.id || key;
      if (!perLesgever[id]) perLesgever[id] = { naam:lsg?.naam||key, type:lsg?.type||'', n:0, uren:0, bedrag:0 };
      const uren = minutenNaarUren(t.duurMinuten || t._groep?.duurMinuten || 60);
      const tarief = tarieven[lsg?.type||'']?.bedragPerUur || 0;
      perLesgever[id].n++;
      perLesgever[id].uren += uren;
      perLesgever[id].bedrag += uren * tarief;
    });
  });

  const lijst = Object.values(perLesgever).sort((a,b) => b.uren - a.uren);
  const trainers    = lijst.filter(l => l.type !== 'assistent');
  const assistenten = lijst.filter(l => l.type === 'assistent');
  const totBedrag   = lijst.reduce((s,l) => s + l.bedrag, 0);
  const totUren     = lijst.reduce((s,l) => s + l.uren, 0);
  const totTrainingen = actief.length;

  function LesgeversGroep({ titel, lijst: lg, kleur }) {
    if (!lg.length) return null;
    const gUren   = lg.reduce((s,l) => s + l.uren, 0);
    const gBedrag = lg.reduce((s,l) => s + l.bedrag, 0);
    return (
      <div style={{ marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', paddingBottom:'6px', borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:'700', fontSize:'14px' }}>{titel}</span>
          <span style={{ fontSize:'12px', color:C.textMuted, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'999px', padding:'2px 10px' }}>{lg.length}</span>
          <span style={{ marginLeft:'auto', fontWeight:'800', color:kleur }}>{formatBedrag(gBedrag)}</span>
        </div>
        <div style={{ overflowX:'auto', borderRadius:'10px', border:`1px solid ${C.border}` }}>
          <table style={S.tbl}>
            <thead>
              <tr style={{ background:C.bg }}>
                <th style={S.th}>Naam</th>
                <th style={{ ...S.th, textAlign:'center' }}>Trainingen</th>
                <th style={S.thr}>Uren</th>
                <th style={{ ...S.thr, color:kleur }}>Vergoeding</th>
              </tr>
            </thead>
            <tbody>
              {lg.map((l,i) => (
                <tr key={l.naam} style={{ background:i%2===0?C.card:C.bg }}>
                  <td style={{ ...S.td, fontWeight:'600' }}>{l.naam}</td>
                  <td style={{ ...S.tdr, color:C.textMuted }}>{l.n}×</td>
                  <td style={S.tdr}>{formatUren(l.uren)}</td>
                  <td style={{ ...S.tdr, color:kleur, fontWeight:'700' }}>{formatBedrag(l.bedrag)}</td>
                </tr>
              ))}
              <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
                <td colSpan={2} style={{ ...S.td, fontWeight:'800' }}>Subtotaal</td>
                <td style={{ ...S.tdr, color:C.orange, fontWeight:'700' }}>{formatUren(gUren)}</td>
                <td style={{ ...S.tdr, color:kleur, fontWeight:'800' }}>{formatBedrag(gBedrag)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Totaal uitbetaling" value={formatBedrag(totBedrag)} color={C.green} sub="trainingen" />
        <Kpi label="Totaal uren" value={`${totUren.toFixed(1)}u`} color={C.blue} />
        <Kpi label="Trainers & initiators" value={trainers.length} color={C.red} />
        <Kpi label="Assistenten" value={assistenten.length} color={C.orange} />
        <Kpi label="Geregistreerde trainingen" value={totTrainingen} color={C.purple} />
      </div>

      {lijst.length === 0
        ? <div style={S.leeg}>Geen lesgevers/trainers geregistreerd voor dit seizoen.</div>
        : <>
            <LesgeversGroep titel="🥋 Trainers & initiators" lijst={trainers} kleur={C.red} />
            <LesgeversGroep titel="🎓 Assistenten" lijst={assistenten} kleur={C.blue} />
          </>
      }

      <div style={{ fontSize:'12px', color:C.textMuted, marginTop:'8px', padding:'10px', background:C.surface||C.bg, borderRadius:'8px', border:`1px solid ${C.border}` }}>
        💡 Wedstrijdkosten (km-vergoedingen &amp; inkomgeld) vind je in de <strong>Uitbetalingen</strong>-pagina.
      </div>
    </div>
  );
}

// ─── Tab: Aanwezigheid ────────────────────────────────────────────────────────

function AanwezigheidTab({ leden }) {
  const max = Math.max(...leden.map(m => m.aanwezigheid), 1);
  const totaal = leden.reduce((s,m) => s + m.aanwezigheid, 0);
  const actief = leden.filter(m => m.aanwezigheid > 0);
  const gem = actief.length > 0 ? Math.round(totaal / actief.length) : 0;

  // Gordelverdeling
  const perGordel = {};
  leden.forEach(m => {
    const b = m.belt || 'onbekend';
    if (!perGordel[b]) perGordel[b] = 0;
    perGordel[b]++;
  });
  const gordelRij = Object.entries(perGordel).sort((a,b) => b[1]-a[1]);
  const GORDEL_ORDER = ['wit','geel','oranje','groen','blauw','bruin','zwart'];
  const gordelSorted = [
    ...GORDEL_ORDER.filter(g => perGordel[g]).map(g => [g, perGordel[g]]),
    ...gordelRij.filter(([g]) => !GORDEL_ORDER.includes(g)),
  ];

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Leden totaal"         value={leden.length}  color={C.blue} />
        <Kpi label="Actief dit seizoen"   value={actief.length} color={C.green} />
        <Kpi label="Inactief dit seizoen" value={leden.length - actief.length} color={C.textMuted} />
        <Kpi label="Totaal aanwezigheden" value={totaal}        color={C.orange} />
        <Kpi label="Gem. per actief lid"  value={gem}           color={C.purple} />
      </div>

      {/* Gordelverdeling */}
      <div style={S.card}>
        <h3 style={S.h3}>Gordelverdeling</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {gordelSorted.map(([gordel, n]) => (
            <div key={gordel} style={{ display:'flex', alignItems:'center', gap:'6px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'6px 12px' }}>
              <span style={{ ...(S.beltBadge(gordel)), marginLeft:0 }}>{gordel}</span>
              <span style={{ fontSize:'14px', fontWeight:'700', color:C.textPrimary }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Aanwezigheid per lid */}
      <div style={S.card}>
        <h3 style={S.h3}>Aanwezigheid per lid</h3>
        {leden.length === 0
          ? <div style={S.leeg}>Geen aanwezigheidsdata voor dit seizoen.</div>
          : leden.map(m => (
            <div key={m.id} style={{ marginBottom:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span style={{ fontWeight:'600', fontSize:'13px' }}>{m.name}</span>
                  {m.belt && <span style={S.beltBadge(m.belt)}>{m.belt}</span>}
                </div>
                <span style={{ fontWeight:'700', color: m.aanwezigheid > 0 ? C.red : C.textMuted }}>{m.aanwezigheid}×</span>
              </div>
              <div style={S.bar(Math.round(m.aanwezigheid/max*100), C.red)} />
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── Tab: Winkel ──────────────────────────────────────────────────────────────

function WinkelTab({ data }) {
  return (
    <div>
      <div style={{ fontSize:'12px', color:C.textMuted, marginBottom:'16px', display:'flex', alignItems:'center', gap:'6px' }}>
        <span>ℹ️</span> Winkelstatistieken tonen alle tijden (niet gefilterd op seizoen).
      </div>
      <div style={S.kpiGrid}>
        <Kpi label="Stockwaarde"      value={`€${data.totalValue.toFixed(0)}`}   color={C.blue} />
        <Kpi label="Omzet"            value={`€${data.totalRevenue.toFixed(0)}`}  color={C.green} />
        <Kpi label="Marge"            value={`€${data.margin.toFixed(0)}`}        color={C.orange} />
        <Kpi label="Producten stock"  value={data.products.reduce((s,p) => s+(p.stock||0),0)} color={C.purple} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Productoverzicht</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={S.th}>Product</th>
                <th style={S.th}>Variant</th>
                <th style={S.thr}>Stock</th>
                <th style={S.thr}>Verkocht</th>
                <th style={S.thr}>Omzet</th>
                <th style={S.thr}>Marge</th>
              </tr>
            </thead>
            <tbody>
              {data.products.map((p,i) => (
                <tr key={p.id} style={{ background:i%2===0?C.card:C.bg }}>
                  <td style={{ ...S.td, fontWeight:'600' }}>{p.name}</td>
                  <td style={{ ...S.td, color:C.textMuted }}>{p.variant}</td>
                  <td style={{ ...S.tdr, color:(p.stock||0)<=0?C.red:(p.stock||0)<3?C.orange:C.green, fontWeight:'600' }}>{p.stock||0}</td>
                  <td style={S.tdr}>{p.soldCount||0}</td>
                  <td style={S.tdr}>€{((p.price||0)*(p.soldCount||0)).toFixed(2)}</td>
                  <td style={S.tdr}>€{(((p.price||0)-(p.costPrice||0))*(p.soldCount||0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Verkoop ─────────────────────────────────────────────────────────────

function VerkoopTab({ data }) {
  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Omzet dit seizoen"   value={`€${data.total.toFixed(2)}`}  color={C.green} />
        <Kpi label="Transacties"          value={data.count}                    color={C.blue} />
        <Kpi label="Gem. per transactie" value={`€${data.count>0?(data.total/data.count).toFixed(2):'0.00'}`} color={C.orange} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Per dag</h3>
        {Object.keys(data.byDate).length === 0
          ? <div style={S.leeg}>Geen verkopen in dit seizoen.</div>
          : Object.entries(data.byDate).map(([date,tot]) => (
              <div key={date} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}` }}>
                <span style={{ color:C.textSec }}>{date}</span>
                <span style={{ fontWeight:'700', color:C.green }}>€{tot.toFixed(2)}</span>
              </div>
            ))
        }
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Recente transacties</h3>
        {data.sales.length === 0
          ? <div style={S.leeg}>Geen transacties.</div>
          : data.sales.slice(0,30).map(s => (
            <div key={s.id} style={{ padding:'8px 0', borderBottom:`1px solid ${C.bg}` }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:C.textSec, fontSize:'12px' }}>{s._ts?.toDate ? s._ts.toDate().toLocaleString('nl-BE') : '—'}</span>
                <span style={{ fontWeight:'700', color:C.green }}>€{(s._totaal||0).toFixed(2)}</span>
              </div>
              <div style={{ fontSize:'12px', color:C.textMuted, marginTop:'2px' }}>{(s.items||[]).map(i=>`${i.name} ${i.variant||''} ×${i.qty}`).join(' · ')}</div>
              <div style={{ fontSize:'12px', color:C.textMuted }}>Verkoper: {data.verkoperMap[s.verkoperUid]||s.koperNaam||'—'}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── Tab: Examens ─────────────────────────────────────────────────────────────

function ExamensTab({ examens }) {
  const totKandidaten = examens.reduce((s,e) => s + e.candidates, 0);
  const totGeslaagd   = examens.reduce((s,e) => s + e.passed, 0);
  const globaalPct    = totKandidaten > 0 ? Math.round(totGeslaagd / totKandidaten * 100) : 0;

  if (examens.length === 0) return <div style={S.leeg}>Geen examens in dit seizoen.</div>;

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Examens"        value={examens.length} color={C.blue} />
        <Kpi label="Kandidaten"     value={totKandidaten}  color={C.orange} />
        <Kpi label="Geslaagd"       value={totGeslaagd}    color={C.green} />
        <Kpi label="Slaagpercentage" value={`${globaalPct}%`} color={globaalPct>=70?C.green:C.orange} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Examenresultaten</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={S.th}>Examen</th>
                <th style={S.th}>Datum</th>
                <th style={S.thr}>Kandidaten</th>
                <th style={{ ...S.thr, color:C.green }}>Geslaagd</th>
                <th style={{ ...S.thr, color:C.red }}>Niet geslaagd</th>
                <th style={S.thr}>Slaagpct.</th>
              </tr>
            </thead>
            <tbody>
              {examens.sort((a,b) => (a.date||'').localeCompare(b.date||'')).map((e,i) => (
                <tr key={e.id} style={{ background:i%2===0?C.card:C.bg }}>
                  <td style={{ ...S.td, fontWeight:'600' }}>{e.name||e.naam}</td>
                  <td style={{ ...S.td, color:C.textMuted }}>{e.date}</td>
                  <td style={S.tdr}>{e.candidates}</td>
                  <td style={{ ...S.tdr, color:C.green, fontWeight:'600' }}>{e.passed}</td>
                  <td style={{ ...S.tdr, color:C.red, fontWeight:'600' }}>{e.failed}</td>
                  <td style={{ ...S.tdr, color:e.passRate>=70?C.green:C.orange, fontWeight:'700' }}>{e.passRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Hoofd component ──────────────────────────────────────────────────────────

const TABS = [
  { id:'trainingen',  label:'🥋 Trainingen' },
  { id:'lesgevers',   label:'👥 Lesgevers' },
  { id:'aanwezigheid',label:'📅 Aanwezigheid' },
  { id:'winkel',      label:'📦 Winkel' },
  { id:'verkoop',     label:'💳 Verkoop' },
  { id:'examens',     label:'📘 Examens' },
];

export default function Rapporten() {
  const { isBeheerder } = useAuth();
  const { lesgevers: lesgeversLijst } = useLesgeversRealtime();

  const seizoenen = beschikbareSeizoenStartJaren().filter(j => j <= huidigSeizoenStartJaar());

  const [seizoenJaar, setSeizoenJaar] = useState(() => huidigSeizoenStartJaar());
  const [tab,         setTab]         = useState('trainingen');
  const [cache,       setCache]       = useState({});
  const [loading,     setLoading]     = useState(false);

  if (!isBeheerder) {
    return (
      <div style={{ padding:'40px', textAlign:'center', color:C.textPrimary }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
        <div style={{ color:C.textSec }}>Rapporten zijn enkel beschikbaar voor admin of bestuurslid.</div>
      </div>
    );
  }

  // Sleutel voor de huidige tab+seizoen-combinatie
  const cacheKey = tab === 'winkel' ? 'winkel' : `${tab}:${seizoenJaar}`;
  // trainingen en lesgevers delen dezelfde onderliggende data
  const sharedKey = `_train:${seizoenJaar}`;

  useEffect(() => {
    if (cache[cacheKey]) return;

    setLoading(true);
    const bereik = seizoenBereikVanJaar(seizoenJaar);

    async function laden() {
      try {
        if (tab === 'trainingen' || tab === 'lesgevers') {
          const data = cache[sharedKey] || await laadTrainingData(bereik);
          setCache(prev => ({
            ...prev,
            [sharedKey]: data,
            [`trainingen:${seizoenJaar}`]: data,
            [`lesgevers:${seizoenJaar}`]: data,
          }));
        } else if (tab === 'aanwezigheid') {
          const data = await laadAanwezigheid(bereik);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'winkel') {
          const data = await laadWinkel();
          setCache(prev => ({ ...prev, winkel: data }));
        } else if (tab === 'verkoop') {
          const data = await laadVerkoop(bereik);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'examens') {
          const data = await laadExamens(bereik);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        }
      } catch (err) {
        console.error('Rapport laden mislukt:', err);
      } finally {
        setLoading(false);
      }
    }

    laden();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, seizoenJaar]);

  const tabData = cache[cacheKey];
  const bereik  = seizoenBereikVanJaar(seizoenJaar);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>📊 Rapporten</h1>
        <p style={S.subtitle}>Overzichten en statistieken per seizoen</p>
      </div>

      {/* Seizoenkiezer */}
      <div style={{ marginBottom:'16px' }}>
        <div style={S.sLabel}>Seizoen</div>
        <div style={S.chipRij}>
          {seizoenen.map(jaar => (
            <button key={jaar} style={S.chip(seizoenJaar===jaar)} onClick={() => setSeizoenJaar(jaar)}>
              {seizoenBereikVanJaar(jaar).label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:'12px', color:C.textMuted }}>
          {bereik.start} → {bereik.einde}
        </div>
      </div>

      {/* Tabbladen */}
      <div style={S.tabBar}>
        {TABS.map(({ id, label }) => (
          <button key={id} style={S.tab(tab===id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ color:C.textMuted, textAlign:'center', padding:'48px', fontSize:'14px' }}>
          Berekenen…
        </div>
      )}

      {!loading && tabData && (
        <>
          {tab === 'trainingen'   && <TrainingenTab    trainingen={tabData.trainingen}  groepenMap={tabData.groepenMap} />}
          {tab === 'lesgevers'    && <LesgeversTab      trainingen={tabData.trainingen}  lesgeversLijst={lesgeversLijst} tarieven={tabData.tarieven} />}
          {tab === 'aanwezigheid' && <AanwezigheidTab   leden={tabData} />}
          {tab === 'winkel'       && <WinkelTab          data={tabData} />}
          {tab === 'verkoop'      && <VerkoopTab         data={tabData} />}
          {tab === 'examens'      && <ExamensTab         examens={tabData} />}
        </>
      )}
    </div>
  );
}
