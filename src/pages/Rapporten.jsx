// src/pages/Rapporten.jsx — v4
// Rapporten per seizoen: trainingen, lesgevers, leden, wedstrijden, aanwezigheid,
// winkel, verkoop (incl. omzettrend) en examens.
import React, { useState, useEffect } from 'react';
import {
  collection, getDocs, collectionGroup, query, orderBy, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import {
  huidigSeizoenStartJaar, beschikbareSeizoenStartJaren, seizoenBereikVanJaar,
  bepaalSeizoen,
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
  th:       { padding: '8px 10px', textAlign: 'left',  color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  thr:      { padding: '8px 10px', textAlign: 'right', color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:       { padding: '8px 10px', fontSize: '13px', textAlign: 'left',  borderBottom: `1px solid ${C.border}`, color: C.textPrimary },
  tdr:      { padding: '8px 10px', fontSize: '13px', textAlign: 'right', borderBottom: `1px solid ${C.border}`, color: C.textPrimary },
  bar:      (p, c) => ({ height: '14px', background: `linear-gradient(90deg,${c||C.red} ${p}%,${C.bg} ${p}%)`, borderRadius: '4px', marginTop: '4px' }),
  leeg:     { color: C.textMuted, textAlign: 'center', padding: '40px', fontStyle: 'italic', fontSize: '14px' },
  loadBtn:  { padding: '8px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
  h3:       { margin: '0 0 12px', fontSize: '15px', fontWeight: '700' },
  beltBadge:(b) => {
    const m = { wit:'#fff', geel:'#f1c40f', oranje:'#e67e22', groen:'#27ae60', blauw:'#3498db', bruin:'#8B4513', zwart:'#1a1a1a' };
    return { marginLeft:'6px', padding:'1px 7px', borderRadius:'10px', fontSize:'11px', fontWeight:'700', background: m[b]||'#555', color: ['wit','geel'].includes(b)?'#333':'#fff', border: b==='zwart'?'1px solid #555':'none' };
  },
  infoBalk: { fontSize:'12px', color:C.textMuted, marginBottom:'16px', display:'flex', alignItems:'center', gap:'6px', padding:'10px', background:C.bg, borderRadius:'8px', border:`1px solid ${C.border}` },
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

function RowBg(i) { return i % 2 === 0 ? C.card : C.bg; }

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

async function laadAanwezigheid(bereik, members) {
  const attSnap = await getDocs(query(collectionGroup(db,'attendance'), where('date','>=',bereik.start), where('date','<=',bereik.einde)));
  const countByMember = {};
  attSnap.forEach(d => {
    const mid = d.ref.parent.parent?.id;
    if (mid) countByMember[mid] = (countByMember[mid]||0) + 1;
  });
  return members
    .map(m => ({ ...m, aanwezigheid: countByMember[m.id]||0 }))
    .sort((a,b) => b.aanwezigheid - a.aanwezigheid);
}

async function laadLedenData(bereik, seizoenJaar, members) {
  const vorigeJaar  = seizoenJaar - 1;
  const vorigBereik = seizoenBereikVanJaar(vorigeJaar);
  // Trend beperkt tot laatste 4 seizoenen zodat we niet alle historische data laden
  const trendStart  = seizoenBereikVanJaar(seizoenJaar - 3).start;

  const [attSnap, trainSnap, groepenSnap] = await Promise.all([
    getDocs(query(collectionGroup(db,'attendance'), where('date','>=',trendStart), where('date','<=',bereik.einde))),
    getDocs(query(collection(db,'trainingen'), where('datum','>=',bereik.start), where('datum','<=',bereik.einde), orderBy('datum'))),
    getDocs(collection(db,'groepen')),
  ]);

  const groepenMap = {};
  groepenSnap.docs.forEach(d => { groepenMap[d.id] = { id:d.id, ...d.data() }; });

  // Attendance verwerken
  const actievHuidig  = new Set();
  const actievVorig   = new Set();
  const attByTraining = {}; // trainingId -> aantalAanwezigen dit seizoen

  attSnap.forEach(d => {
    const { date } = d.data();
    if (!date) return;
    const mid = d.ref.parent.parent?.id;
    if (!mid) return;
    const tid = d.id; // doc ID in subcollection = trainingId
    if (date >= bereik.start && date <= bereik.einde) {
      actievHuidig.add(mid);
      attByTraining[tid] = (attByTraining[tid]||0) + 1;
    }
    if (date >= vorigBereik.start && date <= vorigBereik.einde) {
      actievVorig.add(mid);
    }
  });

  // Ledenverloop: alle attendance ooit → per seizoen unieke leden
  const actievPerSeizoen = {};
  attSnap.forEach(d => {
    const { date } = d.data();
    if (!date) return;
    const mid = d.ref.parent.parent?.id;
    if (!mid) return;
    const sz = bepaalSeizoen(date);
    if (!sz) return;
    if (!actievPerSeizoen[sz]) actievPerSeizoen[sz] = new Set();
    actievPerSeizoen[sz].add(mid);
  });

  // Nieuwe leden dit seizoen (op basis van aangemaaktOp)
  const nieuw = members.filter(m => {
    const ao = typeof m.aangemaaktOp === 'string' ? m.aangemaaktOp : null;
    return ao && ao >= bereik.start && ao <= bereik.einde;
  });

  // Gestopte leden dit seizoen (gedeactiveerdOp in bereik)
  const gestopt = members.filter(m => {
    if (!m.gedeactiveerdOp) return false;
    const ts = m.gedeactiveerdOp?.toDate?.();
    if (!ts) return false;
    const d = ts.toISOString().slice(0,10);
    return d >= bereik.start && d <= bereik.einde;
  });

  // Aanwezigheids% per groep
  const trainingen = trainSnap.docs.map(d => ({ id:d.id, ...d.data() }));
  const normaleTrainingen = trainingen.filter(t => {
    const g = groepenMap[t.groepId] || {};
    const status = bepaalTrainingStatus(t, { volgtProvincialeKalender: !!g.volgtProvincialeKalender });
    return status === TRAINING_STATUS.NORMAAL || status === TRAINING_STATUS.SAMENGEVOEGD;
  });

  const perGroepAtt = {};
  normaleTrainingen.forEach(t => {
    const gId   = t.groepId;
    const gNaam = groepenMap[gId]?.naam || gId;
    if (!perGroepAtt[gNaam]) {
      const ledenCount = members.filter(m => (m.groepen||[]).includes(gNaam)).length;
      perGroepAtt[gNaam] = { naam:gNaam, trainingen:0, totaalAtt:0, leden:ledenCount };
    }
    perGroepAtt[gNaam].trainingen++;
    perGroepAtt[gNaam].totaalAtt += attByTraining[t.id] || 0;
  });
  const groepAttLijst = Object.values(perGroepAtt).map(g => ({
    ...g,
    verwacht: g.leden * g.trainingen,
    pct: g.leden > 0 && g.trainingen > 0 ? Math.round(g.totaalAtt / (g.leden * g.trainingen) * 100) : 0,
  })).sort((a,b) => b.pct - a.pct);

  return {
    members, actievHuidig, actievVorig, nieuw, gestopt,
    actievPerSeizoen, groepAttLijst,
  };
}

async function laadWedstrijdenData(bereik, members) {
  const [eventsSnap, inschrijvingenSnap] = await Promise.all([
    getDocs(query(collection(db,'events'), where('type','==','wedstrijd'), where('datum','>=',bereik.start), where('datum','<=',bereik.einde))),
    getDocs(query(collection(db,'inschrijvingen'), where('eventDatum','>=',bereik.start))),
  ]);

  const events = eventsSnap.docs.map(d => ({ id:d.id, ...d.data() }))
    .filter(e => { const d = e.datum || e.date || ''; return d >= bereik.start && d <= bereik.einde; })
    .sort((a,b) => (a.datum||a.date||'').localeCompare(b.datum||b.date||''));

  const eventIds  = new Set(events.map(e => e.id));
  const eventById = Object.fromEntries(events.map(e => [e.id, e]));

  const inschrijvingen = inschrijvingenSnap.docs.map(d => ({ id:d.id, ...d.data() }))
    .filter(i => eventIds.has(i.eventId));

  const membersMap = {};
  members.forEach(m => { membersMap[m.id] = m; });

  // Dedupliceer events op naam (bv. VK over 2 dagen = 1 toernooi).
  // Sleutel = genormaliseerde naam (lowercase, bijgesneden).
  const toernooiBySleutel = new Map();
  events.forEach(e => {
    const sleutel = (e.naam || e.name || '').trim().toLowerCase();
    if (!toernooiBySleutel.has(sleutel)) {
      toernooiBySleutel.set(sleutel, { naam: e.naam || e.name || sleutel, doelgroepCodes: e.doelgroepCodes || [], sleutel });
    }
  });
  const toernooien = [...toernooiBySleutel.values()];

  // Per categorie
  const perCategorie = {};
  inschrijvingen.forEach(i => {
    const cat = i.categorie || 'Onbekend';
    perCategorie[cat] = (perCategorie[cat]||0) + 1;
  });

  // Pre-build per member: categorieen (uit hun eigen inschrijvingen dit seizoen)
  // en unieke toernooisleutels waaraan deelgenomen.
  // Categorieën via inschrijvingen = automatisch correct bij categorie-overgang in januari.
  const memberCats      = {}; // key → Set<categorie>
  const memberToernooien = {}; // key → Set<toernooiSleutel>
  inschrijvingen.forEach(i => {
    const key = i.memberId || i.judokaNaam || '?';
    if (!memberCats[key])       memberCats[key]       = new Set();
    if (!memberToernooien[key]) memberToernooien[key] = new Set();
    if (i.categorie) memberCats[key].add(i.categorie);
    const ev = eventById[i.eventId];
    if (ev) memberToernooien[key].add((ev.naam || ev.name || '').trim().toLowerCase());
  });

  // Per deelnemer
  const perDeelnemer = {};
  inschrijvingen.forEach(i => {
    const key  = i.memberId || i.judokaNaam || '?';
    const naam = i.memberId ? (membersMap[i.memberId]?.naam || i.judokaNaam || key) : (i.judokaNaam || key);
    if (!perDeelnemer[key]) perDeelnemer[key] = { naam, n:0, memberId:i.memberId||null };
    perDeelnemer[key].n++;
  });

  // Bereken nToernooien, eligible en pct per deelnemer
  Object.entries(perDeelnemer).forEach(([key, d]) => {
    const cats        = memberCats[key]      || new Set();
    const nToernooien = (memberToernooien[key] || new Set()).size;
    // Eligible toernooien = toernooien voor de categorie(ën) van dit lid.
    // Geen doelgroepCodes op een toernooi = open voor iedereen.
    const eligible = toernooien.filter(t => {
      const codes = t.doelgroepCodes;
      return codes.length === 0 || cats.size === 0 || codes.some(c => cats.has(c));
    }).length;
    d.nToernooien = nToernooien;
    d.eligible    = eligible;
    d.pct = eligible > 0 ? Math.round(nToernooien / eligible * 100) : null;
  });

  return { events, toernooien, inschrijvingen, perCategorie, perDeelnemer };
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
  // Laden vanaf max 3 seizoenen geleden zodat de trend zichtbaar is maar we niet alles inladen
  const trendStartISO = seizoenBereikVanJaar(bereik.startJaar - 3).start;
  const trendStartTs  = Timestamp.fromDate(new Date(trendStartISO + 'T00:00:00'));
  const [salesSnap, usersSnap] = await Promise.all([
    getDocs(query(collection(db,'sales'), where('aangemaaktOp','>=',trendStartTs), orderBy('aangemaaktOp','desc'))),
    getDocs(collection(db,'users')),
  ]);
  const verkoperMap = {};
  usersSnap.docs.forEach(d => { const u = d.data(); verkoperMap[d.id] = u.naam||u.displayName||d.id; });

  const alleSales = salesSnap.docs.map(d => {
    const sd = d.data();
    return { id:d.id, ...sd, _totaal: sd.totaal??sd.total??0, _ts: sd.aangemaaktOp||sd.createdAt };
  });

  const sales = alleSales.filter(s => {
    const dt = s._ts?.toDate ? s._ts.toDate().toISOString().slice(0,10) : '';
    return dt >= bereik.start && dt <= bereik.einde;
  });

  const total = sales.reduce((s,x) => s + (x._totaal||0), 0);
  const byDate = {};
  sales.forEach(s => {
    const d = s._ts?.toDate ? s._ts.toDate().toLocaleDateString('nl-BE') : '—';
    byDate[d] = (byDate[d]||0) + (s._totaal||0);
  });

  // Omzettrend over alle seizoenen
  const trendMap = {};
  alleSales.forEach(s => {
    const dt = s._ts?.toDate ? s._ts.toDate().toISOString().slice(0,10) : null;
    if (!dt) return;
    const sz = bepaalSeizoen(dt);
    if (!sz) return;
    if (!trendMap[sz]) trendMap[sz] = { seizoen:sz, count:0, totaal:0 };
    trendMap[sz].count++;
    trendMap[sz].totaal += s._totaal || 0;
  });
  const trend = Object.values(trendMap).sort((a,b) => b.seizoen.localeCompare(a.seizoen));

  return { sales, total, count: sales.length, byDate, verkoperMap, trend };
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
                <tr key={g.naam} style={{ background: RowBg(i) }}>
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
                    <thead><tr>
                      <th style={S.th}>Techniek</th>
                      <th style={S.thr}>Totaal</th>
                      <th style={{ ...S.thr, color:C.green }}>Basis</th>
                      <th style={{ ...S.thr, color:C.orange }}>Verdieping</th>
                    </tr></thead>
                    <tbody>
                      {techData.slice(0,60).map((t,i) => (
                        <tr key={t.naam} style={{ background:RowBg(i) }}>
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
      const uren   = minutenNaarUren(t.duurMinuten || t._groep?.duurMinuten || 60);
      const tarief = tarieven[lsg?.type||'']?.bedragPerUur || 0;
      perLesgever[id].n++;
      perLesgever[id].uren   += uren;
      perLesgever[id].bedrag += uren * tarief;
    });
  });
  const lijst       = Object.values(perLesgever).sort((a,b) => b.uren - a.uren);
  const trainers    = lijst.filter(l => l.type !== 'assistent');
  const assistenten = lijst.filter(l => l.type === 'assistent');
  const totBedrag   = lijst.reduce((s,l) => s + l.bedrag, 0);
  const totUren     = lijst.reduce((s,l) => s + l.uren, 0);

  function LesgeversGroep({ titel, lijst: lg, kleur }) {
    if (!lg.length) return null;
    return (
      <div style={{ marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', paddingBottom:'6px', borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:'700', fontSize:'14px' }}>{titel}</span>
          <span style={{ fontSize:'12px', color:C.textMuted, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'999px', padding:'2px 10px' }}>{lg.length}</span>
          <span style={{ marginLeft:'auto', fontWeight:'800', color:kleur }}>{formatBedrag(lg.reduce((s,l)=>s+l.bedrag,0))}</span>
        </div>
        <div style={{ overflowX:'auto', borderRadius:'10px', border:`1px solid ${C.border}` }}>
          <table style={S.tbl}>
            <thead><tr style={{ background:C.bg }}>
              <th style={S.th}>Naam</th>
              <th style={{ ...S.th, textAlign:'center' }}>Trainingen</th>
              <th style={S.thr}>Uren</th>
              <th style={{ ...S.thr, color:kleur }}>Vergoeding</th>
            </tr></thead>
            <tbody>
              {lg.map((l,i) => (
                <tr key={l.naam} style={{ background:RowBg(i) }}>
                  <td style={{ ...S.td, fontWeight:'600' }}>{l.naam}</td>
                  <td style={{ ...S.tdr, color:C.textMuted }}>{l.n}×</td>
                  <td style={S.tdr}>{formatUren(l.uren)}</td>
                  <td style={{ ...S.tdr, color:kleur, fontWeight:'700' }}>{formatBedrag(l.bedrag)}</td>
                </tr>
              ))}
              <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
                <td colSpan={2} style={{ ...S.td, fontWeight:'800' }}>Subtotaal</td>
                <td style={{ ...S.tdr, color:C.orange, fontWeight:'700' }}>{formatUren(lg.reduce((s,l)=>s+l.uren,0))}</td>
                <td style={{ ...S.tdr, color:kleur, fontWeight:'800' }}>{formatBedrag(lg.reduce((s,l)=>s+l.bedrag,0))}</td>
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
        <Kpi label="Totaal uitbetaling"        value={formatBedrag(totBedrag)} color={C.green} sub="trainingen" />
        <Kpi label="Totaal uren"                value={`${totUren.toFixed(1)}u`} color={C.blue} />
        <Kpi label="Trainers & initiators"      value={trainers.length}         color={C.red} />
        <Kpi label="Assistenten"                value={assistenten.length}      color={C.orange} />
        <Kpi label="Geregistreerde trainingen"  value={actief.length}           color={C.purple} />
      </div>
      {lijst.length === 0
        ? <div style={S.leeg}>Geen lesgevers/trainers geregistreerd voor dit seizoen.</div>
        : <><LesgeversGroep titel="🥋 Trainers & initiators" lijst={trainers} kleur={C.red} /><LesgeversGroep titel="🎓 Assistenten" lijst={assistenten} kleur={C.blue} /></>
      }
      <div style={S.infoBalk}>💡 Wedstrijdkosten (km-vergoedingen &amp; inkomgeld) vind je in de <strong style={{ marginLeft:'4px' }}>Uitbetalingen</strong>-pagina.</div>
    </div>
  );
}

// ─── Tab: Leden ───────────────────────────────────────────────────────────────

function LedenTab({ data, seizoenJaar }) {
  const { members, actievHuidig, actievVorig, nieuw, gestopt, actievPerSeizoen, groepAttLijst } = data;

  const seizoenStr  = `${seizoenJaar}-${seizoenJaar+1}`;
  const totaal      = members.length;
  const actief      = actievHuidig.size;
  const inactief    = totaal - actief;
  const nieuwN      = nieuw.length;
  const gestoptN    = gestopt.length;
  // Leden die vorig seizoen actief waren maar dit seizoen niet
  const verlaten    = [...actievVorig].filter(id => !actievHuidig.has(id)).length;

  // Trend: actieve leden per seizoen
  const seizoenVolgorde = Object.keys(actievPerSeizoen).sort().reverse();

  // Gordelverdeling actieve leden dit seizoen
  const actieveMembersLijst = members.filter(m => actievHuidig.has(m.id));
  const gordelVerdeling = {};
  actieveMembersLijst.forEach(m => {
    const b = m.gordel || m.belt || 'onbekend';
    gordelVerdeling[b] = (gordelVerdeling[b]||0) + 1;
  });
  const GORDEL_ORDER = ['wit','geel','oranje','groen','blauw','bruin','zwart'];
  const gordelSorted = [
    ...GORDEL_ORDER.filter(g => gordelVerdeling[g]).map(g => [g, gordelVerdeling[g]]),
    ...Object.entries(gordelVerdeling).filter(([g]) => !GORDEL_ORDER.includes(g)),
  ];

  const maxAtt = Math.max(...groepAttLijst.map(g => g.pct), 1);

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Leden totaal"           value={totaal}   color={C.blue} />
        <Kpi label="Actief dit seizoen"      value={actief}   color={C.green} sub={`${Math.round(actief/totaal*100)}% v/d leden`} />
        <Kpi label="Inactief dit seizoen"    value={inactief} color={C.textMuted} />
        <Kpi label="Nieuw dit seizoen"       value={nieuwN}   color={C.orange} />
        <Kpi label="Gestopt dit seizoen"     value={gestoptN} color={C.red} />
        <Kpi label="Niet teruggekeerd"       value={verlaten} color={C.purple} sub="actief vorig, niet dit seizoen" />
      </div>

      {/* Aanwezigheids% per groep */}
      <div style={S.card}>
        <h3 style={S.h3}>Aanwezigheidspercentage per groep</h3>
        <div style={{ fontSize:'12px', color:C.textMuted, marginBottom:'12px' }}>
          Berekend als: totaal aanwezigen ÷ (leden in groep × aantal gegeven trainingen)
        </div>
        {groepAttLijst.length === 0
          ? <div style={S.leeg}>Geen data beschikbaar.</div>
          : <div style={{ overflowX:'auto' }}>
              <table style={S.tbl}>
                <thead><tr>
                  <th style={S.th}>Groep</th>
                  <th style={S.thr}>Leden</th>
                  <th style={S.thr}>Trainingen</th>
                  <th style={S.thr}>Verwacht</th>
                  <th style={S.thr}>Aanwezig</th>
                  <th style={{ ...S.thr, color:C.green }}>%</th>
                </tr></thead>
                <tbody>
                  {groepAttLijst.map((g,i) => (
                    <tr key={g.naam} style={{ background:RowBg(i) }}>
                      <td style={{ ...S.td, fontWeight:'600' }}>{g.naam}</td>
                      <td style={S.tdr}>{g.leden}</td>
                      <td style={S.tdr}>{g.trainingen}</td>
                      <td style={{ ...S.tdr, color:C.textMuted }}>{g.verwacht}</td>
                      <td style={S.tdr}>{g.totaalAtt}</td>
                      <td style={{ ...S.tdr, fontWeight:'700', color: g.pct>=70?C.green:g.pct>=50?C.orange:C.red }}>{g.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Gordelverdeling actieve leden */}
      <div style={S.card}>
        <h3 style={S.h3}>Gordelverdeling (actieve leden dit seizoen)</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {gordelSorted.map(([gordel, n]) => (
            <div key={gordel} style={{ display:'flex', alignItems:'center', gap:'6px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'6px 12px' }}>
              <span style={{ ...S.beltBadge(gordel), marginLeft:0 }}>{gordel}</span>
              <span style={{ fontSize:'14px', fontWeight:'700', color:C.textPrimary }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ledenverloop per seizoen */}
      <div style={S.card}>
        <h3 style={S.h3}>Actieve leden per seizoen</h3>
        <div style={{ fontSize:'12px', color:C.textMuted, marginBottom:'12px' }}>Gebaseerd op aanwezigheidsregistraties (≥ 1 training aanwezig = actief dat seizoen).</div>
        {seizoenVolgorde.length === 0
          ? <div style={S.leeg}>Geen historische data.</div>
          : <div style={{ overflowX:'auto' }}>
              <table style={S.tbl}>
                <thead><tr>
                  <th style={S.th}>Seizoen</th>
                  <th style={S.thr}>Actieve leden</th>
                  <th style={S.thr}></th>
                </tr></thead>
                <tbody>
                  {seizoenVolgorde.map((sz,i) => {
                    const n = actievPerSeizoen[sz]?.size || 0;
                    const maxN = Math.max(...seizoenVolgorde.map(s => actievPerSeizoen[s]?.size||0), 1);
                    const isHuidig = sz === seizoenStr;
                    return (
                      <tr key={sz} style={{ background:RowBg(i) }}>
                        <td style={{ ...S.td, fontWeight: isHuidig?'700':'400' }}>
                          {sz.replace('-', '–')}
                          {isHuidig && <span style={{ marginLeft:'6px', fontSize:'10px', background:C.redDim, color:C.red, border:`1px solid ${C.redBord}`, borderRadius:'4px', padding:'1px 5px' }}>huidig</span>}
                        </td>
                        <td style={{ ...S.tdr, fontWeight:'700', color:C.blue }}>{n}</td>
                        <td style={{ ...S.tdr, width:'40%', minWidth:'120px' }}>
                          <div style={S.bar(Math.round(n/maxN*100), C.blue)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Nieuwe leden dit seizoen */}
      {nieuw.length > 0 && (
        <div style={S.card}>
          <h3 style={S.h3}>Nieuwe leden dit seizoen ({nieuw.length})</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {nieuw.sort((a,b) => (a.naam||'').localeCompare(b.naam||'')).map(m => (
              <span key={m.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', fontSize:'12px', color:C.textPrimary }}>
                {m.naam}
                {(m.gordel||m.belt) && <span style={{ ...S.beltBadge(m.gordel||m.belt), marginLeft:'4px' }}>{m.gordel||m.belt}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab: Wedstrijden ─────────────────────────────────────────────────────────

function WedstrijdenTab({ data }) {
  const { events, toernooien, inschrijvingen, perCategorie, perDeelnemer } = data;

  const totDeelnames  = inschrijvingen.length;
  const topDeelnemers = Object.values(perDeelnemer).sort((a,b) => b.nToernooien - a.nToernooien).slice(0,15);
  const maxN = topDeelnemers[0]?.nToernooien || 1;
  const aantalToernooien = (toernooien || []).length;

  return (
    <div>
      {events.length === 0
        ? <div style={S.leeg}>Geen wedstrijden in dit seizoen.</div>
        : <>
            <div style={S.kpiGrid}>
              <Kpi label="Wedstrijddagen"  value={events.length}          color={C.blue} />
              {aantalToernooien !== events.length && <Kpi label="Toernooien" value={aantalToernooien} color={C.purple} />}
              <Kpi label="Deelnames"       value={totDeelnames}           color={C.green} />
              <Kpi label="Unieke deelnemers" value={Object.keys(perDeelnemer).length} color={C.orange} />
              <Kpi label="Categorieën"     value={Object.keys(perCategorie).length} color={C.purple} />
            </div>

            {/* Per wedstrijd */}
            <div style={S.card}>
              <h3 style={S.h3}>Wedstrijden dit seizoen</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={S.tbl}>
                  <thead><tr>
                    <th style={S.th}>Wedstrijd</th>
                    <th style={S.th}>Datum</th>
                    <th style={{ ...S.th }}>Doelgroep</th>
                    <th style={S.thr}>Deelnames</th>
                  </tr></thead>
                  <tbody>
                    {events.map((e,i) => {
                      const n = inschrijvingen.filter(x => x.eventId===e.id).length;
                      return (
                        <tr key={e.id} style={{ background:RowBg(i) }}>
                          <td style={{ ...S.td, fontWeight:'600' }}>{e.naam||e.name}</td>
                          <td style={{ ...S.td, color:C.textMuted }}>{e.datum||e.date}</td>
                          <td style={{ ...S.td, color:C.textMuted, fontSize:'12px' }}>{(e.doelgroepCodes||[]).join(', ')||'—'}</td>
                          <td style={{ ...S.tdr, color:n>0?C.green:C.textMuted, fontWeight:'600' }}>{n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per categorie */}
            {Object.keys(perCategorie).length > 0 && (
              <div style={S.card}>
                <h3 style={S.h3}>Deelnames per categorie</h3>
                <div style={{ overflowX:'auto' }}>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th}>Categorie</th>
                      <th style={S.thr}>Deelnames</th>
                      <th style={{ ...S.thr, width:'40%' }}></th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(perCategorie).sort((a,b)=>b[1]-a[1]).map(([cat,n],i) => {
                        const maxCat = Math.max(...Object.values(perCategorie));
                        return (
                          <tr key={cat} style={{ background:RowBg(i) }}>
                            <td style={{ ...S.td, fontWeight:'600' }}>{cat}</td>
                            <td style={{ ...S.tdr, fontWeight:'700', color:C.green }}>{n}</td>
                            <td style={S.tdr}><div style={S.bar(Math.round(n/maxCat*100), C.green)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top deelnemers */}
            {topDeelnemers.length > 0 && (
              <div style={S.card}>
                <h3 style={S.h3}>Meest actieve deelnemers</h3>
                <div style={{ overflowX:'auto' }}>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Naam</th>
                      <th style={S.thr}>Deelnames</th>
                      <th style={{ ...S.thr, color:C.blue }}>Toernooien %<br/><span style={{ fontSize:'10px', fontWeight:'400', color:C.textMuted }}>eigen categorie</span></th>
                      <th style={{ ...S.thr, width:'25%' }}></th>
                    </tr></thead>
                    <tbody>
                      {topDeelnemers.map((d,i) => {
                        const pctKleur = d.pct === null ? C.textMuted : d.pct >= 75 ? C.green : d.pct >= 50 ? C.orange : C.red;
                        return (
                          <tr key={d.naam+i} style={{ background:RowBg(i) }}>
                            <td style={{ ...S.td, color:C.textMuted, fontWeight:'700', width:'32px' }}>{i+1}</td>
                            <td style={{ ...S.td, fontWeight:'600' }}>{d.naam}</td>
                            <td style={{ ...S.tdr, fontWeight:'700', color:C.orange }}>{d.nToernooien}×</td>
                            <td style={{ ...S.tdr, fontWeight:'700', color:pctKleur }}>
                              {d.pct !== null
                                ? <>{d.pct}%<br/><span style={{ fontSize:'11px', fontWeight:'400', color:C.textMuted }}>{d.nToernooien}/{d.eligible} toern.</span></>
                                : '—'}
                            </td>
                            <td style={S.tdr}><div style={S.bar(d.pct ?? Math.round(d.nToernooien/maxN*100), C.blue)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
      }
    </div>
  );
}

// ─── Tab: Aanwezigheid ────────────────────────────────────────────────────────

function AanwezigheidTab({ leden }) {
  const max     = Math.max(...leden.map(m => m.aanwezigheid), 1);
  const totaal  = leden.reduce((s,m) => s + m.aanwezigheid, 0);
  const actief  = leden.filter(m => m.aanwezigheid > 0);
  const gem     = actief.length > 0 ? Math.round(totaal / actief.length) : 0;

  const perGordel = {};
  leden.forEach(m => { const b = m.gordel||m.belt||'onbekend'; perGordel[b] = (perGordel[b]||0)+1; });
  const GORDEL_ORDER = ['wit','geel','oranje','groen','blauw','bruin','zwart'];
  const gordelSorted = [
    ...GORDEL_ORDER.filter(g => perGordel[g]).map(g => [g, perGordel[g]]),
    ...Object.entries(perGordel).filter(([g]) => !GORDEL_ORDER.includes(g)),
  ];

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Leden totaal"         value={leden.length}  color={C.blue} />
        <Kpi label="Actief dit seizoen"   value={actief.length} color={C.green} />
        <Kpi label="Inactief dit seizoen" value={leden.length-actief.length} color={C.textMuted} />
        <Kpi label="Totaal aanwezigheden" value={totaal}        color={C.orange} />
        <Kpi label="Gem. per actief lid"  value={gem}           color={C.purple} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Gordelverdeling</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {gordelSorted.map(([gordel, n]) => (
            <div key={gordel} style={{ display:'flex', alignItems:'center', gap:'6px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'6px 12px' }}>
              <span style={{ ...S.beltBadge(gordel), marginLeft:0 }}>{gordel}</span>
              <span style={{ fontSize:'14px', fontWeight:'700', color:C.textPrimary }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Aanwezigheid per lid</h3>
        {leden.length === 0
          ? <div style={S.leeg}>Geen aanwezigheidsdata voor dit seizoen.</div>
          : leden.map(m => (
            <div key={m.id} style={{ marginBottom:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span style={{ fontWeight:'600', fontSize:'13px' }}>{m.naam||m.name}</span>
                  {(m.gordel||m.belt) && <span style={S.beltBadge(m.gordel||m.belt)}>{m.gordel||m.belt}</span>}
                </div>
                <span style={{ fontWeight:'700', color: m.aanwezigheid>0?C.red:C.textMuted }}>{m.aanwezigheid}×</span>
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
      <div style={S.infoBalk}>ℹ️ Winkelstatistieken tonen alle tijden (stocktelling is niet seizoensgebonden).</div>
      <div style={S.kpiGrid}>
        <Kpi label="Stockwaarde"     value={`€${data.totalValue.toFixed(0)}`}  color={C.blue} />
        <Kpi label="Omzet totaal"    value={`€${data.totalRevenue.toFixed(0)}`} color={C.green} />
        <Kpi label="Marge totaal"    value={`€${data.margin.toFixed(0)}`}       color={C.orange} />
        <Kpi label="Items in stock"  value={data.products.reduce((s,p)=>s+(p.stock||0),0)} color={C.purple} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Productoverzicht</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Product</th><th style={S.th}>Variant</th>
              <th style={S.thr}>Stock</th><th style={S.thr}>Verkocht</th>
              <th style={S.thr}>Omzet</th><th style={S.thr}>Marge</th>
            </tr></thead>
            <tbody>
              {data.products.map((p,i) => (
                <tr key={p.id} style={{ background:RowBg(i) }}>
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
        <Kpi label="Omzet dit seizoen"   value={`€${data.total.toFixed(2)}`} color={C.green} />
        <Kpi label="Transacties"          value={data.count}                  color={C.blue} />
        <Kpi label="Gem. per transactie" value={`€${data.count>0?(data.total/data.count).toFixed(2):'0.00'}`} color={C.orange} />
      </div>

      {/* Omzettrend over alle seizoenen */}
      {data.trend.length > 1 && (
        <div style={S.card}>
          <h3 style={S.h3}>Omzettrend per seizoen</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={S.tbl}>
              <thead><tr>
                <th style={S.th}>Seizoen</th>
                <th style={S.thr}>Transacties</th>
                <th style={{ ...S.thr, color:C.green }}>Omzet</th>
                <th style={{ ...S.thr, width:'35%' }}></th>
              </tr></thead>
              <tbody>
                {data.trend.map((row,i) => {
                  const maxOmzet = Math.max(...data.trend.map(r=>r.totaal), 1);
                  return (
                    <tr key={row.seizoen} style={{ background:RowBg(i) }}>
                      <td style={{ ...S.td, fontWeight:'600' }}>{row.seizoen.replace('-','–')}</td>
                      <td style={{ ...S.tdr, color:C.textMuted }}>{row.count}</td>
                      <td style={{ ...S.tdr, color:C.green, fontWeight:'700' }}>€{row.totaal.toFixed(2)}</td>
                      <td style={S.tdr}><div style={S.bar(Math.round(row.totaal/maxOmzet*100), C.green)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.h3}>Per dag (dit seizoen)</h3>
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
        <h3 style={S.h3}>Recente transacties (dit seizoen)</h3>
        {data.sales.length === 0
          ? <div style={S.leeg}>Geen transacties.</div>
          : data.sales.slice(0,30).map(s => (
            <div key={s.id} style={{ padding:'8px 0', borderBottom:`1px solid ${C.bg}` }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:C.textSec, fontSize:'12px' }}>{s._ts?.toDate?s._ts.toDate().toLocaleString('nl-BE'):'—'}</span>
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
  const globaalPct    = totKandidaten > 0 ? Math.round(totGeslaagd/totKandidaten*100) : 0;

  if (examens.length === 0) return <div style={S.leeg}>Geen examens in dit seizoen.</div>;

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Examens"         value={examens.length} color={C.blue} />
        <Kpi label="Kandidaten"      value={totKandidaten}  color={C.orange} />
        <Kpi label="Geslaagd"        value={totGeslaagd}    color={C.green} />
        <Kpi label="Slaagpercentage" value={`${globaalPct}%`} color={globaalPct>=70?C.green:C.orange} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Examenresultaten</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Examen</th><th style={S.th}>Datum</th>
              <th style={S.thr}>Kandidaten</th>
              <th style={{ ...S.thr, color:C.green }}>Geslaagd</th>
              <th style={{ ...S.thr, color:C.red }}>Niet geslaagd</th>
              <th style={S.thr}>Slaagpct.</th>
            </tr></thead>
            <tbody>
              {examens.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((e,i) => (
                <tr key={e.id} style={{ background:RowBg(i) }}>
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
  { id:'trainingen',   label:'🥋 Trainingen' },
  { id:'lesgevers',    label:'👥 Lesgevers' },
  { id:'leden',        label:'📈 Leden' },
  { id:'wedstrijden',  label:'🏆 Wedstrijden' },
  { id:'aanwezigheid', label:'📅 Aanwezigheid' },
  { id:'winkel',       label:'📦 Winkel' },
  { id:'verkoop',      label:'💳 Verkoop' },
  { id:'examens',      label:'📘 Examens' },
];

export default function Rapporten() {
  const { isBeheerder } = useAuth();
  const { lesgevers: lesgeversLijst } = useLesgeversRealtime();

  const seizoenen = beschikbareSeizoenStartJaren().filter(j => j <= huidigSeizoenStartJaar());

  const [seizoenJaar, setSeizoenJaar] = useState(() => huidigSeizoenStartJaar());
  const [tab,         setTab]         = useState('trainingen');
  const [cache,       setCache]       = useState({});
  const [loading,     setLoading]     = useState(false);
  const [members,      setMembers]      = useState(null);
  const [membersLaden, setMembersLaden] = useState(true);

  if (!isBeheerder) {
    return (
      <div style={{ padding:'40px', textAlign:'center', color:C.textPrimary }}>
        <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
        <div style={{ color:C.textSec }}>Rapporten zijn enkel beschikbaar voor admin of bestuurslid.</div>
      </div>
    );
  }

  // trainingen en lesgevers tabs delen dezelfde Firestore-data
  const sharedTrainKey = `_train:${seizoenJaar}`;
  const cacheKey = tab === 'winkel'
    ? 'winkel'
    : (tab === 'trainingen' || tab === 'lesgevers')
      ? `${tab}:${seizoenJaar}`
      : `${tab}:${seizoenJaar}`;

  useEffect(() => {
    getDocs(collection(db, 'members'))
      .then(snap => setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(err => console.error('Members laden mislukt:', err))
      .finally(() => setMembersLaden(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cache[cacheKey]) return;

    const tabNeedsMembers = ['leden', 'wedstrijden', 'aanwezigheid'].includes(tab);
    if (tabNeedsMembers && members === null) return;

    setLoading(true);
    const bereik = seizoenBereikVanJaar(seizoenJaar);

    async function laden() {
      try {
        if (tab === 'trainingen' || tab === 'lesgevers') {
          const data = cache[sharedTrainKey] || await laadTrainingData(bereik);
          setCache(prev => ({
            ...prev,
            [sharedTrainKey]: data,
            [`trainingen:${seizoenJaar}`]: data,
            [`lesgevers:${seizoenJaar}`]: data,
          }));
        } else if (tab === 'leden') {
          const data = await laadLedenData(bereik, seizoenJaar, members);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'wedstrijden') {
          const data = await laadWedstrijdenData(bereik, members);
          setCache(prev => ({ ...prev, [cacheKey]: data }));
        } else if (tab === 'aanwezigheid') {
          const data = await laadAanwezigheid(bereik, members);
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
  }, [tab, seizoenJaar, members]);

  const tabData         = cache[cacheKey];
  const bereik          = seizoenBereikVanJaar(seizoenJaar);
  const tabNeedsMembers = ['leden', 'wedstrijden', 'aanwezigheid'].includes(tab);
  const isLoading       = loading || (tabNeedsMembers && membersLaden);

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
        <div style={{ fontSize:'12px', color:C.textMuted }}>{bereik.start} → {bereik.einde}</div>
      </div>

      {/* Tabbladen */}
      <div style={S.tabBar}>
        {TABS.map(({ id, label }) => (
          <button key={id} style={S.tab(tab===id)} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {isLoading && (
        <div style={{ color:C.textMuted, textAlign:'center', padding:'48px', fontSize:'14px' }}>Berekenen…</div>
      )}

      {!isLoading && tabData && (
        <>
          {tab === 'trainingen'   && <TrainingenTab   trainingen={tabData.trainingen} groepenMap={tabData.groepenMap} />}
          {tab === 'lesgevers'    && <LesgeversTab    trainingen={tabData.trainingen} lesgeversLijst={lesgeversLijst} tarieven={tabData.tarieven} />}
          {tab === 'leden'        && <LedenTab        data={tabData} seizoenJaar={seizoenJaar} />}
          {tab === 'wedstrijden'  && <WedstrijdenTab  data={tabData} />}
          {tab === 'aanwezigheid' && <AanwezigheidTab leden={tabData} />}
          {tab === 'winkel'       && <WinkelTab       data={tabData} />}
          {tab === 'verkoop'      && <VerkoopTab      data={tabData} />}
          {tab === 'examens'      && <ExamensTab      examens={tabData} />}
        </>
      )}
    </div>
  );
}
