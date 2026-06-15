// src/hooks/useRapportenData.js
// Data-fetching functies voor de Rapporten-pagina.
// Uitgesplitst van src/pages/Rapporten.jsx zodat de pagina enkel de shell bevat.

import {
  collection, getDocs, collectionGroup, query, orderBy, where, Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../components/trainingen/trainingStatus';
import { seizoenBereikVanJaar, bepaalSeizoen } from '../utils/seizoenUtils';

export async function laadMembers() {
  const snap = await getDocs(collection(db, 'members'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function laadTrainingData(bereik) {
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

export async function laadTechnieken(trainingIds) {
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

export async function laadAanwezigheid(bereik, members) {
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

export async function laadLedenData(bereik, seizoenJaar, members) {
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

export async function laadWedstrijdenData(bereik, members) {
  const [eventsSnap, inschrijvingenSnap] = await Promise.all([
    getDocs(query(collection(db,'events'), where('type','==','wedstrijd'), where('datum','>=',bereik.start), where('datum','<=',bereik.einde))),
    getDocs(query(collection(db,'inschrijvingen'), where('eventDatum','>=',bereik.start), where('eventDatum','<=',bereik.einde))),
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

export async function laadWinkel() {
  const snap = await getDocs(query(collection(db,'products'), orderBy('soldCount','desc')));
  const products = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  const totalValue   = products.reduce((s,p) => s + (p.costPrice||0)*(p.stock||0), 0);
  const totalRevenue = products.reduce((s,p) => s + (p.price||0)*(p.soldCount||0), 0);
  const totalCost    = products.reduce((s,p) => s + (p.costPrice||0)*(p.soldCount||0), 0);
  return { products, totalValue, totalRevenue, margin: totalRevenue - totalCost };
}

export async function laadVerkoop(bereik) {
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

export async function laadExamens(bereik) {
  const snap = await getDocs(query(collection(db,'events'), where('type','==','examen'), where('date','>=',bereik.start), where('date','<=',bereik.einde)));
  const events = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  return Promise.all(events.map(async ev => {
    const regSnap = await getDocs(collection(db,'events',ev.id,'registrations'));
    const regs = regSnap.docs.map(d => d.data());
    const passed = regs.filter(r => r.result==='geslaagd').length;
    const total  = regs.filter(r => r.result!=='afwezig').length;
    return { ...ev, candidates:regs.length, passed, failed:regs.filter(r=>r.result==='niet_geslaagd').length, absent:regs.filter(r=>r.result==='afwezig').length, passRate: total>0?Math.round(passed/total*100):0 };
  }));
}
