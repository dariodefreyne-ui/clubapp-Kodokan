// src/pages/Uitbetalingen.jsx
// ─── UITBETALINGEN v3.0 ────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection, query, where, orderBy, getDocs,
  doc, setDoc, deleteDoc, serverTimestamp, onSnapshot, updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLesgeversRealtime } from '../hooks/useLesgeversRealtime';
import { useConfirm } from '../contexts/ConfirmContext';
import { updateMetAudit, setMetAudit } from '../services/firestoreService';
import * as XLSX from 'xlsx';
import { C } from '../components/trainingen/tokens';
import { useSeizoenSettings, maandOptiesVoorSeizoen, huidigSeizoenStartJaar } from '../utils/seizoenUtils';

// ─── Formatters ────────────────────────────────────────────────────────────────
function minutenNaarUren(min) { return Math.round((min / 60) * 100) / 100; }
function formatUren(u) { return u ? `${Number(u).toFixed(2)}u` : '—'; }
function formatBedrag(b) { return `€ ${Number(b).toFixed(2)}`; }
function datumNaarISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function formatDatumLeesbaar(iso) {
  if (!iso) return '';
  return new Date(iso+'T00:00:00').toLocaleDateString('nl-BE',{weekday:'short',day:'numeric',month:'short'});
}
function normNaam(s) { return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
function vindLesgever(key, lijst) {
  if (!key || !Array.isArray(lijst)) return null;
  return lijst.find(l=>l.id===key) || lijst.find(l=>l.uid&&l.uid===key) || lijst.find(l=>normNaam(l.naam)===normNaam(key)) || null;
}

// ─── Stijl helpers ─────────────────────────────────────────────────────────────
const INPUT = {
  background: 'transparent',
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  color: C.textPrimary,
  padding: '4px 8px',
  fontSize: '12px',
  fontFamily: 'inherit',
  textAlign: 'right',
  width: '72px',
};
const SAVE_BTN = {
  padding: '4px 10px', background: C.green, border: 'none', borderRadius: '6px',
  color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
};
const CANCEL_BTN = {
  padding: '4px 10px', background: 'transparent', border: `1px solid ${C.border}`,
  borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '11px',
};

// ─── Periode helpers ───────────────────────────────────────────────────────────
function periodeVanSnelknop(type) {
  const nu=new Date(), jaar=nu.getFullYear(), maand=nu.getMonth();
  if (type==='deze-maand') {
    return { van:datumNaarISO(new Date(jaar,maand,1)), tot:datumNaarISO(new Date(jaar,maand+1,0)), naam:nu.toLocaleDateString('nl-BE',{month:'long',year:'numeric'}) };
  }
  if (type==='vorige-maand') {
    const d=new Date(jaar,maand-1,1);
    return { van:datumNaarISO(d), tot:datumNaarISO(new Date(jaar,maand,0)), naam:d.toLocaleDateString('nl-BE',{month:'long',year:'numeric'}) };
  }
  if (type==='dit-seizoen') {
    const s=maand>=8?jaar:jaar-1;
    return { van:`${s}-09-01`, tot:`${s+1}-06-30`, naam:`Seizoen ${s}-${s+1}` };
  }
  return null;
}
// maandOptiesVoorSeizoen komt nu uit seizoenUtils (dynamisch op basis van instellingen)

// ─── CollapsibleSectie ────────────────────────────────────────────────────────
function CollapsibleSectie({ titel, badge, defaultOpen=true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom:'16px', border:`1px solid ${C.border}`, borderRadius:'12px', overflow:'hidden' }}>
      <button onClick={()=>setOpen(o=>!o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'13px 16px', background:C.card, border:'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
        <span style={{ fontSize:'15px', fontWeight:'700', color:C.textPrimary, flex:1 }}>{titel}</span>
        {badge && <span style={{ fontSize:'12px', color:C.textMuted, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'999px', padding:'2px 10px', flexShrink:0 }}>{badge}</span>}
        <span style={{ color:C.textMuted, fontSize:'12px', flexShrink:0 }}>{open?'▲':'▼'}</span>
      </button>
      {open && <div style={{ padding:'0 16px 16px', background:C.bg }}>{children}</div>}
    </div>
  );
}

// ─── PeriodeBeheer ─────────────────────────────────────────────────────────────
function PeriodeBeheer({ periodes, onNieuwe, onVerwijder }) {
  const [van,setVan]=useState(''), [tot,setTot]=useState(''), [naam,setNaam]=useState('');
  const voegToe=()=>{ if(!van||!tot) return; onNieuwe({van,tot,naam:naam||`${van} → ${tot}`}); setVan('');setTot('');setNaam(''); };
  const huidigePeriode=()=>{
    const nu=new Date(),m=nu.getMonth(),j=nu.getFullYear(),pi=Math.floor(m/2),sm=pi*2,em=sm+1;
    const mn=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    setVan(datumNaarISO(new Date(j,sm,1))); setTot(datumNaarISO(new Date(j,em+1,0))); setNaam(`${mn[sm]}-${mn[em]} ${j}`);
  };
  const inp={padding:'8px',background:C.bg,border:`1px solid ${C.border}`,borderRadius:'6px',color:C.textPrimary,fontSize:'13px'};
  return (
    <div style={{background:C.card,borderRadius:'12px',padding:'20px',marginBottom:'24px'}}>
      <h3 style={{margin:'0 0 16px',fontSize:'16px',fontWeight:'700'}}>📅 Uitbetalingsperiodes</h3>
      {periodes.length>0 && (
        <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'16px'}}>
          {periodes.map(p=>(
            <div key={p.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:C.bg,borderRadius:'8px'}}>
              <span style={{flex:1,fontSize:'13px',color:C.textPrimary,fontWeight:'600'}}>{p.naam}</span>
              <span style={{fontSize:'12px',color:C.textMuted}}>{p.van} → {p.tot}</span>
              <button onClick={()=>onVerwijder(p.id)} style={{background:'transparent',border:'none',color:C.textMuted,cursor:'pointer',fontSize:'14px'}}>🗑</button>
            </div>
          ))}
        </div>
      )}
      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
        <div style={{display:'flex',gap:'8px'}}>
          <input type="date" value={van} onChange={e=>setVan(e.target.value)} style={{...inp,flex:1}}/>
          <span style={{color:C.textMuted,alignSelf:'center'}}>→</span>
          <input type="date" value={tot} onChange={e=>setTot(e.target.value)} style={{...inp,flex:1}}/>
        </div>
        <input type="text" value={naam} onChange={e=>setNaam(e.target.value)} placeholder="Naam periode (optioneel)" style={{...inp,width:'100%',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={huidigePeriode} style={{flex:1,padding:'8px',background:'transparent',border:`1px solid ${C.border}`,borderRadius:'6px',color:C.textSec,cursor:'pointer',fontSize:'12px'}}>Huidige 2-maand</button>
          <button onClick={voegToe} disabled={!van||!tot} style={{flex:1,padding:'8px',background:van&&tot?C.red:C.borderSoft,border:'none',borderRadius:'6px',color:'white',cursor:van&&tot?'pointer':'not-allowed',fontSize:'13px',fontWeight:'600'}}>+ Toevoegen</button>
        </div>
      </div>
    </div>
  );
}

// ─── WedstrijdKostenSectie ─────────────────────────────────────────────────────
// Gecombineerde tabel per begeleider. Open-klikken toont detailrijen met inline edit.
function WedstrijdKostenSectie({ periode, lesgeverId: myLesgeverId, isBeheerder, tarieven }) {
  const [events, setEvents]       = useState([]);
  const [laden, setLaden]         = useState(true);
  const [openBegeleider, setOpen] = useState(null);
  // edit-state: { [eventId_naam]: { km, inkom } }
  const [edits, setEdits]         = useState({});
  const [saving, setSaving]       = useState({});
  const [saved, setSaved]         = useState({});   // { [key]: true } voor vinkje-feedback

  useEffect(()=>{
    if (!periode) return;
    setLaden(true);
    // getDocs i.p.v. onSnapshot: wedstrijdkosten hoeven niet live te updaten
    getDocs(collection(db,'events')).then(snap=>{
      setEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>
        e.type==='wedstrijd' && e.datum>=periode.van && e.datum<=periode.tot &&
        Array.isArray(e.begeleiders) && e.begeleiders.length>0
      ));
      setLaden(false);
    }).catch(()=>setLaden(false));
  },[periode]);

  const kmTarief = tarieven['kilometer']?.bedragPerKm || 0;

  // Bouw rijen
  const rijen = [];
  for (const ev of events) {
    for (const b of (ev.begeleiders||[]).filter(x=>x.aanwezig!==false)) {
      if (!isBeheerder && b.lesgeverId !== myLesgeverId) continue;
      rijen.push({ eventId:ev.id, eventNaam:ev.naam||ev.datum, datum:ev.datum, naam:b.naam||'—', lesgeverId:b.lesgeverId, km:parseFloat(b.km)||0, inkom:parseFloat(b.inkom)||0, _rawEvent:ev });
    }
  }

  if (laden) return <div style={{color:C.textMuted,fontSize:'13px',padding:'12px 0'}}>Wedstrijden laden…</div>;
  if (rijen.length===0) return <div style={{color:C.textMuted,fontSize:'13px',fontStyle:'italic',padding:'8px 0'}}>Geen wedstrijdkosten in deze periode.</div>;

  // Groepeer per begeleider
  const perBeg = {};
  for (const r of rijen) {
    if (!perBeg[r.naam]) perBeg[r.naam]={naam:r.naam,km:0,kmBedrag:0,inkom:0,events:[]};
    perBeg[r.naam].km       += r.km;
    perBeg[r.naam].kmBedrag += r.km*kmTarief;
    perBeg[r.naam].inkom    += r.inkom;
    perBeg[r.naam].events.push(r);
  }
  const lijst = Object.values(perBeg).sort((a,b)=>(b.kmBedrag+b.inkom)-(a.kmBedrag+a.inkom));

  const totKm   = lijst.reduce((s,b)=>s+b.km,0);
  const totKmB  = lijst.reduce((s,b)=>s+b.kmBedrag,0);
  const totInk  = lijst.reduce((s,b)=>s+b.inkom,0);

  const editKey = (eventId, naam) => `${eventId}__${naam}`;

  function getEditVal(ek, veld, fallback) {
    return edits[ek]?.[veld] !== undefined ? edits[ek][veld] : String(fallback);
  }
  function setEditVal(ek, veld, val) {
    setEdits(prev=>({...prev,[ek]:{...prev[ek],[veld]:val}}));
  }

  async function slaOp(r) {
    const ek = editKey(r.eventId, r.naam);
    const nieuweKm    = parseFloat(getEditVal(ek,'km',r.km))   || 0;
    const nieuweInkom = parseFloat(getEditVal(ek,'inkom',r.inkom)) || 0;
    setSaving(prev=>({...prev,[ek]:true}));
    try {
      const ev = events.find(e=>e.id===r.eventId);
      if (!ev) return;
      const nieuweBegeleiders = (ev.begeleiders||[]).map(b=>{
        if (b.naam !== r.naam && b.lesgeverId !== r.lesgeverId) return b;
        return {...b, km:nieuweKm, inkom:nieuweInkom};
      });
      await updateMetAudit(doc(db,'events',r.eventId), { begeleiders:nieuweBegeleiders });
      // clear edit state
      setEdits(prev=>{ const n={...prev}; delete n[ek]; return n; });
      setSaved(prev=>({...prev,[ek]:true}));
      setTimeout(()=>setSaved(prev=>{ const n={...prev}; delete n[ek]; return n; }), 2000);
    } catch(e) { console.error(e); }
    finally { setSaving(prev=>{ const n={...prev}; delete n[ek]; return n; }); }
  }

  const thS={ padding:'8px 10px', textAlign:'left', color:C.textMuted, fontWeight:'700', fontSize:'11px', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' };
  const tdS=(right=false,extra={})=>({ padding:'8px 10px', color:C.textPrimary, fontSize:'12px', textAlign:right?'right':'left', borderBottom:`1px solid ${C.border}`, ...extra });

  return (
    <div style={{paddingTop:'12px'}}>
      <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:C.card}}>
              <th style={thS}>Begeleider</th>
              <th style={{...thS,textAlign:'right'}}>Km</th>
              <th style={{...thS,textAlign:'right',color:C.orange}}>Km-vergoeding</th>
              <th style={{...thS,textAlign:'right',color:C.blue}}>Inkom</th>
              <th style={{...thS,textAlign:'right',color:C.green}}>Totaal</th>
              <th style={thS}></th>
            </tr>
          </thead>
          <tbody>
            {lijst.map((b,i)=>{
              const isOpen = openBegeleider===b.naam;
              return (
                <React.Fragment key={b.naam}>
                  {/* Samengevatte rij — klikbaar */}
                  <tr style={{background:isOpen?'rgba(255,255,255,0.06)':(i%2===0?C.bg:C.card), cursor:'pointer'}}
                      onClick={()=>setOpen(isOpen?null:b.naam)}>
                    <td style={{...tdS(),fontWeight:'700'}}>{b.naam}</td>
                    <td style={tdS(true)}>{b.km>0?`${b.km} km`:'—'}</td>
                    <td style={{...tdS(true),color:C.orange,fontWeight:'600'}}>{b.kmBedrag>0?formatBedrag(b.kmBedrag):'—'}</td>
                    <td style={{...tdS(true),color:C.blue,fontWeight:'600'}}>{b.inkom>0?formatBedrag(b.inkom):'—'}</td>
                    <td style={{...tdS(true),color:C.green,fontWeight:'700'}}>{formatBedrag(b.kmBedrag+b.inkom)}</td>
                    <td style={{...tdS(),color:C.textMuted,fontSize:'11px',textAlign:'right'}}>{isOpen?'▲':'▼'}</td>
                  </tr>

                  {/* Detail per wedstrijd — inline bewerkbaar */}
                  {isOpen && b.events.map(r=>{
                    const ek = editKey(r.eventId, r.naam);
                    const isSaving = !!saving[ek];
                    const isSaved  = !!saved[ek];
                    const heeftEdit = !!edits[ek];
                    const kmVal    = getEditVal(ek,'km',r.km);
                    const inkomVal = getEditVal(ek,'inkom',r.inkom);
                    const kmNum    = parseFloat(kmVal)||0;
                    const inkNum   = parseFloat(inkomVal)||0;
                    const kmBedrag = kmNum*kmTarief;
                    const totaal   = kmBedrag+inkNum;
                    return (
                      <tr key={ek} style={{background:'rgba(255,255,255,0.03)',borderTop:`1px solid ${C.border}`}}>
                        {/* Wedstrijd naam + datum */}
                        <td style={{...tdS(),paddingLeft:'24px'}}>
                          <div style={{color:C.textSec,fontStyle:'italic',fontSize:'12px'}}>↳ {r.eventNaam}</div>
                          <div style={{color:C.textMuted,fontSize:'11px'}}>{formatDatumLeesbaar(r.datum)}</div>
                        </td>
                        {/* Km — bewerkbaar */}
                        <td style={tdS(true)}>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end'}}>
                            <input
                              type="number" min="0" step="1"
                              value={kmVal}
                              onChange={e=>setEditVal(ek,'km',e.target.value)}
                              style={{...INPUT}}
                            />
                            <span style={{fontSize:'11px',color:C.textMuted}}>km</span>
                          </div>
                        </td>
                        {/* Km-bedrag — berekend */}
                        <td style={{...tdS(true),color:C.orange}}>
                          {kmTarief>0 ? formatBedrag(kmBedrag) : '—'}
                        </td>
                        {/* Inkom — bewerkbaar */}
                        <td style={tdS(true)}>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end'}}>
                            <span style={{fontSize:'11px',color:C.textMuted}}>€</span>
                            <input
                              type="number" min="0" step="0.50"
                              value={inkomVal}
                              onChange={e=>setEditVal(ek,'inkom',e.target.value)}
                              style={{...INPUT}}
                            />
                          </div>
                        </td>
                        {/* Totaal */}
                        <td style={{...tdS(true),color:C.green,fontWeight:'600'}}>{formatBedrag(totaal)}</td>
                        {/* Opslaan */}
                        <td style={{...tdS(),minWidth:'90px'}}>
                          {isSaved ? (
                            <span style={{color:C.green,fontSize:'12px',fontWeight:'700'}}>✓ Opgeslagen</span>
                          ) : (
                            <div style={{display:'flex',gap:'4px',justifyContent:'flex-end'}}>
                              <button onClick={e=>{e.stopPropagation();slaOp(r);}} disabled={isSaving}
                                style={{...SAVE_BTN,opacity:isSaving?0.6:1}}>
                                {isSaving?'…':'Opslaan'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Totaalrij */}
            <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
              <td style={{...tdS(),fontWeight:'800',color:C.textPrimary}}>TOTAAL</td>
              <td style={{...tdS(true),fontWeight:'700',color:C.textPrimary}}>{totKm} km</td>
              <td style={{...tdS(true),fontWeight:'800',color:C.orange}}>{formatBedrag(totKmB)}</td>
              <td style={{...tdS(true),fontWeight:'800',color:C.blue}}>{formatBedrag(totInk)}</td>
              <td style={{...tdS(true),fontWeight:'800',color:C.green}}>{formatBedrag(totKmB+totInk)}</td>
              <td style={tdS()}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── UitbetalingsMatrix (trainingen) ──────────────────────────────────────────
// Matrix per lesgever × datum. Klik op rij → toont trainingen in periode voor
// die lesgever, met inline toggle van aanwezigheid.
function UitbetalingsMatrix({ periode, lesgeversLijst, tarieven, tarieftypes, filterLesgeverId }) {
  const [data, setData]         = useState(null);   // { datums, lesgevers: {id:{datum:uren}}, trainingen: Training[] }
  const [laden, setLaden]       = useState(false);
  const [fout, setFout]         = useState('');
  const [openLesgever, setOpenL]= useState(null);   // lesgeverId van openstaande rij
  const [saving, setSaving]     = useState({});     // { trainingId: bool }
  const [saved, setSaved]       = useState({});     // { trainingId: bool }
  // localLesgevers: { trainingId: lesgeversArray } — lokale kopie voor direct tonen
  const [localLsg, setLocalLsg] = useState({});

  // Memoized Map: O(1) lesgever-lookup i.p.v. O(n) per vindLesgever call
  const lesgeversMap = React.useMemo(() => {
    const m = new Map();
    for (const l of lesgeversLijst) {
      m.set(l.id, l);
      if (l.uid) m.set(l.uid, l);
      if (l.naam) m.set(normNaam(l.naam), l);
    }
    return m;
  }, [lesgeversLijst]);


  const laad = useCallback(async()=>{
    if (!periode) return;
    setLaden(true); setFout('');
    try {
      const snap = await getDocs(query(collection(db,'trainingen'),where('datum','>=',periode.van),where('datum','<=',periode.tot),orderBy('datum','asc')));
      const groepenSnap = await getDocs(collection(db,'groepen'));
      const groepenMap = {};
      groepenSnap.docs.forEach(d=>{ groepenMap[d.id]=d.data(); });

      const trainingen = snap.docs.map(d=>({
        id:d.id,...d.data(),
        _uren: minutenNaarUren(d.data().duurMinuten || groepenMap[d.data().groepId]?.duurMinuten || 60),
        _groepNaam: groepenMap[d.data().groepId]?.naam || '',
      })).filter(t=>(t.lesgevers||[]).length>0);

      if (trainingen.length===0) { setData({datums:[],lesgevers:{},trainingen:[]}); return; }

      const datums = [...new Set(trainingen.map(t=>t.datum))].sort();
      const matrix = {};
      for (const t of trainingen) {
        for (const rawKey of (t.lesgevers||[])) {
          const id = lesgeversMap.get(rawKey)?.id || lesgeversMap.get(normNaam(rawKey))?.id || rawKey;
          if (!matrix[id]) matrix[id]={};
          matrix[id][t.datum] = (matrix[id][t.datum]||0) + t._uren;
        }
      }
      const gefilterd = filterLesgeverId
        ? Object.fromEntries(Object.entries(matrix).filter(([id])=>id===filterLesgeverId))
        : matrix;

      // init localLsg met huidige lesgevers per training
      const initLocal = {};
      trainingen.forEach(t=>{ initLocal[t.id]=[...(t.lesgevers||[])]; });
      setLocalLsg(initLocal);
      setData({datums, lesgevers:gefilterd, trainingen});
    } catch(e) { setFout('Laden mislukt: '+e.message); }
    finally { setLaden(false); }
  }, [periode]);

  useEffect(()=>{ laad(); },[laad]);

  // Toggle aanwezigheid van een lesgever in een training (lokaal)
  function toggleAanwezig(trainingId, lesgeverId) {
    setLocalLsg(prev=>{
      const huidig = prev[trainingId] || [];
      const zitErin = huidig.includes(lesgeverId);
      return {...prev, [trainingId]: zitErin ? huidig.filter(x=>x!==lesgeverId) : [...huidig, lesgeverId]};
    });
  }

  async function slaTrainingOp(training) {
    const tId = training.id;
    setSaving(prev=>({...prev,[tId]:true}));
    try {
      const nieuweLesgevers = localLsg[tId] || [];
      await setMetAudit(doc(db,'trainingen',tId), { lesgevers: nieuweLesgevers }, { merge:true });
      setSaved(prev=>({...prev,[tId]:true}));
      setTimeout(()=>setSaved(prev=>{ const n={...prev}; delete n[tId]; return n; }), 2500);
      // Herbereken matrix lokaal
      setData(prev=>{
        if (!prev) return prev;
        const nieuweMatrix = {...prev.lesgevers};
        // reset uren voor deze training
        for (const id of Object.keys(nieuweMatrix)) {
          if (nieuweMatrix[id][training.datum]) {
            // we recalculate below
          }
        }
        // rebuild volledig
        const matrix = {};
        const bijgewerkte = prev.trainingen.map(t=>t.id===tId?{...t,lesgevers:nieuweLesgevers}:t);
        for (const t of bijgewerkte) {
          for (const rawKey of (t.lesgevers||[])) {
            const id = lesgeversMap.get(rawKey)?.id || lesgeversMap.get(normNaam(rawKey))?.id || rawKey;
            if (!matrix[id]) matrix[id]={};
            matrix[id][t.datum] = (matrix[id][t.datum]||0) + t._uren;
          }
        }
        const gefilterd = filterLesgeverId
          ? Object.fromEntries(Object.entries(matrix).filter(([id])=>id===filterLesgeverId))
          : matrix;
        return {...prev, lesgevers:gefilterd, trainingen:bijgewerkte};
      });
    } catch(e) { console.error(e); }
    finally { setSaving(prev=>{ const n={...prev}; delete n[tId]; return n; }); }
  }

  const exporteerMatrix = ()=>{
    if (!data) return;
const gesorteerd = React.useMemo(() => {
    if (!data) return [];
    return Object.keys(data.lesgevers).sort((a,b)=>
      (lesgeversLijst.find(l=>l.id===a)?.naam??a).localeCompare(lesgeversLijst.find(l=>l.id===b)?.naam??b));
  }, [data, lesgeversLijst]);

    const ws=XLSX.utils.aoa_to_sheet(rows),wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Uitbetaling');
    XLSX.writeFile(wb,`uitbetaling_${periode.naam.replace(/\s/g,'_')}.xlsx`);
  };

  if (!periode) return null;
  if (laden) return <div style={{color:C.textMuted,padding:'20px'}}>Laden…</div>;
  if (fout)  return <div style={{color:'var(--danger)',padding:'20px'}}>{fout}</div>;
  if (!data) return null;
  if (data.datums.length===0) return <div style={{color:C.textMuted,fontSize:'14px',padding:'12px 0',fontStyle:'italic'}}>Geen trainingen met lesgevers in deze periode.</div>;

  const gesorteerd = Object.keys(data.lesgevers).sort((a,b)=>
    (lesgeversLijst.find(l=>l.id===a)?.naam??a).localeCompare(lesgeversLijst.find(l=>l.id===b)?.naam??b));
  const totaalBedrag = gesorteerd.reduce((sum,id)=>{
    const tarief=tarieven[lesgeversLijst.find(l=>l.id===id)?.type||'']?.bedragPerUur||0;
    return sum+data.datums.reduce((s,d)=>s+(data.lesgevers[id][d]||0),0)*tarief;
  },0);

  return (
    <div style={{paddingTop:'12px'}}>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'10px'}}>
        <button onClick={exporteerMatrix} style={{padding:'7px 14px',background:C.green,border:'none',borderRadius:'8px',color:'white',cursor:'pointer',fontSize:'12px',fontWeight:'700'}}>📤 Excel exporteren</button>
      </div>
      <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:'600px'}}>
          <thead>
            <tr style={{background:C.card}}>
              <th style={{padding:'10px 12px',textAlign:'left',color:C.textMuted,fontWeight:'700',position:'sticky',left:0,background:C.card,borderRight:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>Lesgever</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap'}}>Type</th>
              {data.datums.map(d=>(
                <th key={d} style={{padding:'10px 8px',textAlign:'center',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap',minWidth:'72px'}}>
                  {new Date(d+'T00:00:00').toLocaleDateString('nl-BE',{day:'numeric',month:'short'})}
                </th>
              ))}
              <th style={{padding:'10px 8px',textAlign:'right',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap',borderLeft:`1px solid ${C.border}`}}>Uren</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap'}}>€/u</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'700',whiteSpace:'nowrap'}}>Totaal €</th>
              <th style={{padding:'10px 8px',width:'28px'}}></th>
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((id,idx)=>{
              const info     = lesgeversLijst.find(l=>l.id===id);
              const naam     = info?.naam??id;
              const typeId   = info?.type||'';
              const typeLabel= tarieftypes.find(t=>t.id===typeId)?.label||'—';
              const tarief   = tarieven[typeId]?.bedragPerUur||0;
              const isOpen   = openLesgever===id;
              let totU=0;

              // Trainingen voor deze lesgever in de periode
              const mijnTrainingen = (data.trainingen||[]).filter(t=>{
                const lsgIds = (localLsg[t.id]||[]).map(rawKey=>vindLesgever(rawKey,lesgeversLijst)?.id||rawKey);
                return lsgIds.includes(id) || (t.lesgevers||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id);
              });

              return (
                <React.Fragment key={id}>
                  {/* Samengevatte matrix-rij — klikbaar */}
                  <tr style={{background:isOpen?'rgba(255,255,255,0.06)':(idx%2===0?C.bg:C.card),cursor:'pointer',borderTop:`1px solid ${C.border}`}}
                      onClick={()=>setOpenL(isOpen?null:id)}>
                    <td style={{padding:'10px 12px',color:C.textPrimary,fontWeight:'600',position:'sticky',left:0,background:isOpen?'rgba(40,40,50,0.98)':(idx%2===0?C.bg:C.card),borderRight:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{naam}</td>
                    <td style={{padding:'10px 8px',color:C.textMuted,fontSize:'11px'}}>{typeLabel}</td>
                    {data.datums.map(d=>{ const u=data.lesgevers[id]?.[d]||0; totU+=u; return (
                      <td key={d} style={{padding:'10px 8px',textAlign:'center',color:u>0?C.textPrimary:C.textMuted}}>{u>0?`${u}u`:'·'}</td>
                    ); })}
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.textPrimary,fontWeight:'700',borderLeft:`1px solid ${C.border}`}}>{formatUren(totU)}</td>
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.textMuted}}>{tarief>0?`€${tarief}`:'—'}</td>
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'700'}}>{tarief>0?formatBedrag(totU*tarief):'—'}</td>
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.textMuted,fontSize:'11px'}}>{isOpen?'▲':'▼'}</td>
                  </tr>

                  {/* Detail-rijen: trainingen van deze lesgever */}
                  {isOpen && (
                    <tr style={{borderTop:`1px solid ${C.border}`}}>
                      <td colSpan={data.datums.length+5} style={{padding:0}}>
                        <div style={{background:'rgba(255,255,255,0.03)',padding:'12px 16px 16px 40px'}}>
                          <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'10px'}}>
                            Trainingen in periode — aanwezigheid aanpassen
                          </div>
                          {/* Trainingen: aanwezige eerst, afwezige dimmed eronder */}
                          {(data.trainingen||[]).length===0
                            ? <div style={{color:C.textMuted,fontSize:'13px'}}>Geen trainingen.</div>
                            : (() => {
                                const gesorteerdeTrainingen = [...(data.trainingen||[])].sort((a,b) => {
                                  const aAanw = (localLsg[a.id]||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id);
                                  const bAanw = (localLsg[b.id]||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id);
                                  if (aAanw !== bAanw) return aAanw ? -1 : 1;
                                  return a.datum.localeCompare(b.datum);
                                });
                                const aantalAanwezig = gesorteerdeTrainingen.filter(t =>
                                  (localLsg[t.id]||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id)
                                ).length;
                                return (<>
                                  {gesorteerdeTrainingen.map(t=>{
                                    const lsgList = localLsg[t.id] || [];
                                    const lsgIds  = lsgList.map(k=>vindLesgever(k,lesgeversLijst)?.id||k);
                                    const isAanwezig = lsgIds.includes(id);
                                    const isSavingT  = !!saving[t.id];
                                    const isSavedT   = !!saved[t.id];
                                    return (
                                      <div key={t.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:isAanwezig?'rgba(34,197,94,0.08)':C.card,border:`1px solid ${isAanwezig?'rgba(34,197,94,0.25)':C.border}`,borderRadius:'8px',marginBottom:'6px',opacity:isAanwezig?1:0.45}}>
                                        <input type="checkbox" checked={isAanwezig}
                                          onChange={()=>toggleAanwezig(t.id,id)}
                                          style={{accentColor:C.green,width:'16px',height:'16px',cursor:'pointer',flexShrink:0}}
                                        />
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{fontSize:'13px',fontWeight:isAanwezig?'600':'400',color:C.textPrimary}}>{formatDatumLeesbaar(t.datum)}</div>
                                          {t._groepNaam && <div style={{fontSize:'11px',color:C.textMuted}}>{t._groepNaam}</div>}
                                        </div>
                                        <span style={{fontSize:'12px',color:C.textSec,flexShrink:0}}>{formatUren(t._uren)}</span>
                                        {tarief>0 && isAanwezig && (
                                          <span style={{fontSize:'12px',color:C.green,fontWeight:'700',flexShrink:0}}>{formatBedrag(t._uren*tarief)}</span>
                                        )}
                                        {isSavedT ? (
                                          <span style={{fontSize:'11px',color:C.green,fontWeight:'700',flexShrink:0}}>✓</span>
                                        ) : (
                                          <button onClick={()=>slaTrainingOp(t)} disabled={isSavingT}
                                            style={{...SAVE_BTN,flexShrink:0,opacity:isSavingT?0.6:1}}>
                                            {isSavingT?'…':'Opslaan'}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div style={{marginTop:'10px',fontSize:'12px',color:C.textMuted,fontStyle:'italic'}}>
                                    {aantalAanwezig} van {gesorteerdeTrainingen.length} training{gesorteerdeTrainingen.length!==1?'en':''} aanwezig
                                  </div>
                                </>);
                              })()
                          }
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Totaalrij */}
            <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
              <td style={{padding:'10px 12px',color:C.textPrimary,fontWeight:'800',position:'sticky',left:0,background:C.card,borderRight:`1px solid ${C.border}`}}>TOTAAL</td>
              <td/>
              {data.datums.map(d=>{
                const tot=gesorteerd.reduce((s,id)=>s+(data.lesgevers[id]?.[d]||0),0);
                return <td key={d} style={{padding:'10px 8px',textAlign:'center',color:C.orange,fontWeight:'700',fontSize:'11px'}}>{tot>0?`${Math.round(tot*100)/100}u`:''}</td>;
              })}
              <td style={{padding:'10px 8px',textAlign:'right',color:C.orange,fontWeight:'800',borderLeft:`1px solid ${C.border}`}}>
                {formatUren(gesorteerd.reduce((s,id)=>s+data.datums.reduce((ss,d)=>ss+(data.lesgevers[id]?.[d]||0),0),0))}
              </td>
              <td/>
              <td style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'800'}}>{formatBedrag(totaalBedrag)}</td>
              <td/>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── StatistiekenTab ───────────────────────────────────────────────────────────
function StatistiekenTab({ lesgeversLijst, tarieven, tarieftypes }) {
  const [periode, setPeriode]       = useState(()=>periodeVanSnelknop('dit-seizoen'));
  const [trainingen, setTrainingen] = useState([]);
  const [wedstrijdEvents, setWedstrijdEvents] = useState([]);
  const [laden, setLaden]           = useState(false);
  const [openBeg, setOpenBeg]       = useState(null);

  useEffect(()=>{
    if (!periode) return;
    setLaden(true);
    Promise.all([
      getDocs(query(collection(db,'trainingen'),where('datum','>=',periode.van),where('datum','<=',periode.tot),orderBy('datum','asc'))),
      getDocs(collection(db,'groepen')),
    ]).then(([tSnap,gSnap])=>{
      const gMap={}; gSnap.docs.forEach(d=>{ gMap[d.id]=d.data(); });
      setTrainingen(tSnap.docs.map(d=>({id:d.id,...d.data(),_uren:minutenNaarUren(d.data().duurMinuten||gMap[d.data().groepId]?.duurMinuten||60)})));
      setLaden(false);
    }).catch(()=>setLaden(false));
  },[periode]);

  useEffect(()=>{
    if (!periode) return;
    // getDocs i.p.v. onSnapshot: wedstrijddata hoeft niet realtime te zijn
    // in de uitbetalingsmatrix — spaart een permanente Firestore-verbinding uit.
    getDocs(collection(db,'events')).then(snap=>{
      setWedstrijdEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>
        e.type==='wedstrijd'&&e.datum>=periode.van&&e.datum<=periode.tot&&Array.isArray(e.begeleiders)&&e.begeleiders.length>0
      ));
    }).catch(()=>{});
  },[periode]);

  const kmTarief = tarieven['kilometer']?.bedragPerKm||0;

  const perLesgever={};
  for (const t of trainingen) {
    for (const rawKey of (t.lesgevers||[])) {
      const lsg=vindLesgever(rawKey,lesgeversLijst);
      const id=lsg?.id||rawKey;
      if (!perLesgever[id]) perLesgever[id]={naam:lsg?.naam||rawKey,type:lsg?.type||'',uren:0,bedrag:0,n:0};
      const tarief=tarieven[lsg?.type||'']?.bedragPerUur||0;
      perLesgever[id].uren+=t._uren; perLesgever[id].bedrag+=t._uren*tarief; perLesgever[id].n+=1;
    }
  }
  const perBeg={};
  for (const ev of wedstrijdEvents) {
    for (const b of (ev.begeleiders||[]).filter(x=>x.aanwezig!==false)) {
      const key=b.naam||b.lesgeverId||'—';
      if (!perBeg[key]) perBeg[key]={naam:key,km:0,kmBedrag:0,inkom:0,n:0,isAssistent:false,events:[]};
      const lsg=vindLesgever(b.lesgeverId,lesgeversLijst);
      perBeg[key].isAssistent=lsg?.type==='assistent';
      perBeg[key].km+=parseFloat(b.km)||0; perBeg[key].kmBedrag+=(parseFloat(b.km)||0)*kmTarief; perBeg[key].inkom+=parseFloat(b.inkom)||0; perBeg[key].n+=1;
      perBeg[key].events.push({naam:ev.naam||ev.datum,datum:ev.datum,km:parseFloat(b.km)||0,inkom:parseFloat(b.inkom)||0});
    }
  }

  const assistenten=Object.values(perLesgever).filter(l=>l.type==='assistent');
  const trainers=Object.values(perLesgever).filter(l=>l.type!=='assistent');
  const totBT=Object.values(perLesgever).reduce((s,l)=>s+l.bedrag,0);
  const totKmB=Object.values(perBeg).reduce((s,b)=>s+b.kmBedrag,0);
  const totInk=Object.values(perBeg).reduce((s,b)=>s+b.inkom,0);
  const totW=totKmB+totInk;

  const kpiS={background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px 20px',display:'flex',flexDirection:'column',gap:'4px'};
  const kpiL={fontSize:'11px',color:C.textMuted,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.6px'};
  const kpiV=(c)=>({fontSize:'22px',fontWeight:'800',color:c||C.textPrimary});
  const thS={padding:'8px 10px',textAlign:'left',color:C.textMuted,fontWeight:'700',fontSize:'11px',borderBottom:`1px solid ${C.border}`};
  const tdS=(r=false)=>({padding:'8px 10px',color:C.textPrimary,fontSize:'12px',textAlign:r?'right':'left',borderBottom:`1px solid ${C.border}`});

  function LesgeversGroep({titel,lijst,kleur,emoji}){
    if (!lijst.length) return null;
    const totU=lijst.reduce((s,l)=>s+l.uren,0),totB=lijst.reduce((s,l)=>s+l.bedrag,0);
    return(
      <div style={{marginBottom:'20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px',paddingBottom:'8px',borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:'14px',fontWeight:'700',color:C.textPrimary}}>{emoji} {titel}</span>
          <span style={{fontSize:'12px',color:C.textMuted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:'999px',padding:'2px 10px'}}>{lijst.length}</span>
          <span style={{marginLeft:'auto',fontSize:'14px',fontWeight:'800',color:kleur}}>{formatBedrag(totB)}</span>
        </div>
        <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
            <thead><tr style={{background:C.bg}}>
              <th style={thS}>Naam</th><th style={{...thS,textAlign:'center'}}>Trainingen</th>
              <th style={{...thS,textAlign:'right'}}>Uren</th><th style={{...thS,textAlign:'right',color:kleur}}>Bedrag</th>
            </tr></thead>
            <tbody>
              {lijst.sort((a,b)=>b.uren-a.uren).map((l,i)=>(
                <tr key={l.naam} style={{background:i%2===0?C.card:C.bg,borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px 10px',color:C.textPrimary,fontWeight:'600'}}>{l.naam}</td>
                  <td style={{padding:'8px 10px',textAlign:'center',color:C.textMuted}}>{l.n}×</td>
                  <td style={{padding:'8px 10px',textAlign:'right',color:C.textPrimary}}>{formatUren(l.uren)}</td>
                  <td style={{padding:'8px 10px',textAlign:'right',color:kleur,fontWeight:'700'}}>{formatBedrag(l.bedrag)}</td>
                </tr>
              ))}
              <tr style={{background:C.bg,borderTop:`2px solid ${C.border}`}}>
                <td colSpan={2} style={{padding:'8px 10px',fontWeight:'800',color:C.textPrimary}}>Subtotaal</td>
                <td style={{padding:'8px 10px',textAlign:'right',color:C.orange,fontWeight:'700'}}>{formatUren(totU)}</td>
                <td style={{padding:'8px 10px',textAlign:'right',color:kleur,fontWeight:'800'}}>{formatBedrag(totB)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return(
    <div>
      <div style={{marginBottom:'20px'}}>
        <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Periode</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {['dit-seizoen','vorige-maand','deze-maand'].map(type=>{
            const p=periodeVanSnelknop(type),actief=periode?.van===p.van&&periode?.tot===p.tot;
            return <button key={type} onClick={()=>setPeriode(p)} style={{padding:'7px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'13px',fontWeight:'600',background:actief?C.red:C.card,border:`1px solid ${actief?C.red:C.border}`,color:actief?'white':C.textSec,fontFamily:'inherit'}}>{p.naam}</button>;
          })}
        </div>
        {periode && <div style={{marginTop:'6px',fontSize:'12px',color:C.textMuted}}>{periode.van} → {periode.tot}</div>}
      </div>

      {laden?<div style={{color:C.textMuted,padding:'20px',textAlign:'center'}}>Laden…</div>:<>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'12px',marginBottom:'28px'}}>
          <div style={kpiS}><span style={kpiL}>Totaal uitbetaling</span><span style={kpiV(C.green)}>{formatBedrag(totBT+totW)}</span><span style={{fontSize:'11px',color:C.textMuted}}>trainingen + wedstrijden</span></div>
          <div style={kpiS}><span style={kpiL}>🥋 Trainingen</span><span style={kpiV(C.red)}>{formatBedrag(totBT)}</span><span style={{fontSize:'11px',color:C.textMuted}}>{formatUren(Object.values(perLesgever).reduce((s,l)=>s+l.uren,0))} totaal</span></div>
          <div style={kpiS}><span style={kpiL}>🏆 Wedstrijdkosten</span><span style={kpiV(C.orange)}>{formatBedrag(totW)}</span><span style={{fontSize:'11px',color:C.textMuted}}>km + inkom</span></div>
          <div style={kpiS}><span style={kpiL}>Assistenten</span><span style={kpiV(C.blue)}>{assistenten.length}</span><span style={{fontSize:'11px',color:C.textMuted}}>van {Object.keys(perLesgever).length} lesgevers</span></div>
          <div style={kpiS}><span style={kpiL}>Km vergoed</span><span style={kpiV(C.orange)}>{Object.values(perBeg).reduce((s,b)=>s+b.km,0)} km</span><span style={{fontSize:'11px',color:C.textMuted}}>{formatBedrag(totKmB)} uitbetaald</span></div>
          <div style={kpiS}><span style={kpiL}>Inkomgeld</span><span style={kpiV(C.blue)}>{formatBedrag(totInk)}</span><span style={{fontSize:'11px',color:C.textMuted}}>{wedstrijdEvents.length} wedstrijden</span></div>
        </div>

        <div style={{marginBottom:'12px',fontSize:'16px',fontWeight:'700',color:C.textPrimary}}>🥋 Trainingen per lesgever</div>
        {!Object.keys(perLesgever).length
          ? <div style={{color:C.textMuted,fontSize:'14px',fontStyle:'italic',marginBottom:'24px'}}>Geen trainingsdata in deze periode.</div>
          : <><LesgeversGroep titel="Assistenten" lijst={assistenten} kleur={C.blue} emoji="🎓"/><LesgeversGroep titel="Trainers & initiators" lijst={trainers} kleur={C.red} emoji="🥋"/></>
        }

        {Object.keys(perBeg).length>0&&(
          <div>
            <div style={{fontSize:'16px',fontWeight:'700',color:C.textPrimary,marginBottom:'10px',paddingTop:'8px',borderTop:`1px solid ${C.border}`}}>🏆 Wedstrijdkosten per begeleider</div>
            <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                <thead><tr style={{background:C.card}}>
                  <th style={thS}>Naam</th><th style={{...thS,textAlign:'center'}}>Wedstrijden</th>
                  <th style={{...thS,textAlign:'right',color:C.orange}}>Km-vergoeding</th>
                  <th style={{...thS,textAlign:'right',color:C.blue}}>Inkom</th>
                  <th style={{...thS,textAlign:'right',color:C.green}}>Totaal</th><th style={thS}></th>
                </tr></thead>
                <tbody>
                  {Object.values(perBeg).sort((a,b)=>(b.kmBedrag+b.inkom)-(a.kmBedrag+a.inkom)).map((b,i)=>{
                    const isOpen=openBeg===b.naam;
                    return(
                      <React.Fragment key={b.naam}>
                        <tr style={{background:isOpen?'rgba(255,255,255,0.06)':(i%2===0?C.bg:C.card),cursor:'pointer'}} onClick={()=>setOpenBeg(isOpen?null:b.naam)}>
                          <td style={{...tdS(),fontWeight:'700'}}>
                            {b.naam}
                            {b.isAssistent&&<span style={{marginLeft:'6px',fontSize:'10px',background:'rgba(59,130,246,0.15)',color:C.blue,border:`1px solid rgba(59,130,246,0.3)`,borderRadius:'4px',padding:'1px 5px'}}>assistent</span>}
                          </td>
                          <td style={tdS(true)}>{b.n}×</td>
                          <td style={{...tdS(true),color:C.orange,fontWeight:'600'}}>{b.kmBedrag>0?formatBedrag(b.kmBedrag):'—'}</td>
                          <td style={{...tdS(true),color:C.blue,fontWeight:'600'}}>{b.inkom>0?formatBedrag(b.inkom):'—'}</td>
                          <td style={{...tdS(true),color:C.green,fontWeight:'700'}}>{formatBedrag(b.kmBedrag+b.inkom)}</td>
                          <td style={{...tdS(),color:C.textMuted,fontSize:'11px'}}>{isOpen?'▲':'▼'}</td>
                        </tr>
                        {isOpen&&b.events.map((e,ei)=>(
                          <tr key={ei} style={{background:'rgba(255,255,255,0.03)'}}>
                            <td style={{...tdS(),paddingLeft:'24px',color:C.textSec,fontStyle:'italic'}}>↳ {e.naam}</td>
                            <td style={{...tdS(true),color:C.textMuted,fontSize:'11px'}}>{e.datum}</td>
                            <td style={{...tdS(true),color:C.orange}}>{e.km>0&&kmTarief>0?formatBedrag(e.km*kmTarief):'—'}</td>
                            <td style={{...tdS(true),color:C.blue}}>{e.inkom>0?formatBedrag(e.inkom):'—'}</td>
                            <td style={{...tdS(true),color:C.textSec}}>{formatBedrag((e.km*kmTarief)+e.inkom)}</td>
                            <td style={tdS()}></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
                    <td colSpan={2} style={{...tdS(),fontWeight:'800',color:C.textPrimary}}>TOTAAL</td>
                    <td style={{...tdS(true),fontWeight:'800',color:C.orange}}>{formatBedrag(totKmB)}</td>
                    <td style={{...tdS(true),fontWeight:'800',color:C.blue}}>{formatBedrag(totInk)}</td>
                    <td style={{...tdS(true),fontWeight:'800',color:C.green}}>{formatBedrag(totW)}</td>
                    <td style={tdS()}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>}
    </div>
  );
}

// ─── Hoofd component ───────────────────────────────────────────────────────────
export default function Uitbetalingen() {
  const { isBeheerder, isTrainer, isAssistent, lesgeverId } = useAuth();
  const confirm = useConfirm();
  const [tarieven, setTarieven]       = useState({});
  const [tarieftypes, setTarieftypes] = useState([]);
  const [lesgeversLijst, setLesgeversLijst] = useState([]);
  const [periodes, setPeriodes]       = useState([]);
  const [actievePeriode, setActievePeriode] = useState(()=>periodeVanSnelknop('deze-maand'));
  const [tabBlad, setTabBlad]         = useState('matrix');
  const seizoenSettings = useSeizoenSettings();
  const maandOpties = maandOptiesVoorSeizoen(huidigSeizoenStartJaar());
  const actieveMaandWaarde = maandOpties.find(p=>p.van===actievePeriode?.van&&p.tot===actievePeriode?.tot)?.value||'';

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'tarieven'),snap=>{
      const d={}; snap.docs.forEach(dd=>{ d[dd.id]=dd.data(); }); setTarieven(d);
    }); return unsub;
  },[]);

  const { lesgevers: lesgeversData, loading: lesgeversLaden } = useLesgeversRealtime();
  useEffect(()=>{
    setLesgeversLijst(lesgeversData.filter(l=>l.actief!==false).sort((a,b)=>a.naam.localeCompare(b.naam)));
  },[lesgeversData]);

  useEffect(()=>{
    const unsub=onSnapshot(query(collection(db,'uitbetalingsperiodes'),orderBy('van','desc')),snap=>{
      const lijst=snap.docs.map(d=>({id:d.id,...d.data()}));
      setPeriodes(lijst);
    }); return unsub;
  },[]);

  const voegPeriodeToe=async({van,tot,naam})=>{
    await setDoc(doc(collection(db,'uitbetalingsperiodes')),{van,tot,naam,aangemaakt:serverTimestamp()});
  };
  const verwijderPeriode=async(id)=>{
    const ok=await confirm({titel:'Uitbetalingsperiode verwijderen?',beschrijving:'De periode wordt definitief verwijderd.',bevestigLabel:'Ja, verwijderen',variant:'danger'});
    if (!ok) return;
    await deleteDoc(doc(db,'uitbetalingsperiodes',id));
    if (actievePeriode?.id===id) setActievePeriode(null);
  };

  if (!isTrainer && !isBeheerder && !isAssistent) return (
    <div style={{color:C.textPrimary,padding:'40px',textAlign:'center'}}>
      <div style={{fontSize:'48px',marginBottom:'16px'}}>🔒</div>
      <div style={{fontSize:'16px',color:C.textSec}}>Geen toegang.</div>
    </div>
  );

  const tabS=(id)=>({
    padding:'8px 16px',background:'transparent',border:'none',
    borderBottom:`2px solid ${tabBlad===id?C.red:'transparent'}`,
    color:tabBlad===id?C.textPrimary:C.textMuted,
    cursor:'pointer',fontSize:'14px',fontWeight:tabBlad===id?'700':'400',
    marginBottom:'-1px',fontFamily:'inherit',
  });

  return (
    <div style={{color:C.textPrimary,paddingBottom:'40px'}}>
      <div style={{marginBottom:'24px',paddingBottom:'16px',borderBottom:`1px solid ${C.border}`}}>
        <h1 style={{margin:'0 0 4px',fontSize:'clamp(20px,5vw,26px)',fontWeight:'800'}}>💶 Uitbetalingen lesgevers</h1>
        <p style={{margin:0,fontSize:'14px',color:C.textSec}}>Aanwezigheid × duur × tarief</p>
      </div>

      <div style={{display:'flex',gap:'4px',marginBottom:'24px',borderBottom:`1px solid ${C.border}`}}>
        <button style={tabS('matrix')} onClick={()=>setTabBlad('matrix')}>📊 Overzicht</button>
        {isBeheerder && <button style={tabS('statistieken')} onClick={()=>setTabBlad('statistieken')}>📈 Statistieken</button>}
        <button style={tabS('periodes')} onClick={()=>setTabBlad('periodes')}>📅 Periodes</button>
      </div>

      {tabBlad==='periodes' && <PeriodeBeheer periodes={periodes} onNieuwe={voegPeriodeToe} onVerwijder={verwijderPeriode}/>}
      {tabBlad==='statistieken' && <StatistiekenTab lesgeversLijst={lesgeversLijst} tarieven={tarieven} tarieftypes={tarieftypes}/>}

      {tabBlad==='matrix' && (
        <div>
          {/* Periode-kiezer */}
          <div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Maanden</div>
            <select value={actieveMaandWaarde} onChange={e=>{const g=maandOpties.find(p=>p.value===e.target.value);if(g)setActievePeriode(g);}}
              style={{width:'100%',maxWidth:'360px',padding:'9px 12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.textPrimary,fontSize:'13px',fontWeight:'600',cursor:'pointer'}}>
              <option value="">Kies een maand...</option>
              {maandOpties.map(p=><option key={p.id} value={p.value}>{p.naam}</option>)}
            </select>
          </div>

          <div style={{marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Snelle selectie</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
              {['deze-maand','vorige-maand','dit-seizoen'].map(type=>{
                const p=periodeVanSnelknop(type),actief=actievePeriode?.van===p.van&&actievePeriode?.tot===p.tot;
                return <button key={type} onClick={()=>setActievePeriode(p)} style={{padding:'7px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'13px',fontWeight:'600',background:actief?C.red:C.card,border:`1px solid ${actief?C.red:C.border}`,color:actief?'white':C.textSec,fontFamily:'inherit'}}>{p.naam}</button>;
              })}
            </div>
          </div>

          {periodes.length>0&&(
            <div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Opgeslagen periodes</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {periodes.map(p=>{
                  const actief=actievePeriode?.id===p.id;
                  return <button key={p.id} onClick={()=>setActievePeriode(p)} style={{padding:'7px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'13px',fontWeight:'600',background:actief?C.red:C.card,border:`1px solid ${actief?C.red:C.border}`,color:actief?'white':C.textSec,fontFamily:'inherit'}}>{p.naam}</button>;
                })}
              </div>
            </div>
          )}

          {actievePeriode ? (
            <div style={{marginTop:'8px'}}>
              <CollapsibleSectie titel="🥋 Trainingen" badge={`${lesgeversLijst.length} lesgevers`} defaultOpen={true}>
                {lesgeversLaden
                  ? <div style={{color:C.textMuted,padding:'20px'}}>Lesgevers laden…</div>
                  : <UitbetalingsMatrix
                      periode={actievePeriode}
                      lesgeversLijst={lesgeversLijst}
                      tarieven={tarieven}
                      tarieftypes={tarieftypes}
                      filterLesgeverId={isBeheerder?null:lesgeverId}
                    />
                }
              </CollapsibleSectie>

              <CollapsibleSectie titel="🏆 Wedstrijdkosten" defaultOpen={true}>
                <WedstrijdKostenSectie
                  periode={actievePeriode}
                  lesgeverId={lesgeverId}
                  isBeheerder={isBeheerder}
                  tarieven={tarieven}
                />
              </CollapsibleSectie>
            </div>
          ) : (
            <div style={{background:C.card,borderRadius:'12px',padding:'24px',textAlign:'center',color:C.textMuted}}>Selecteer een periode hierboven.</div>
          )}
        </div>
      )}
    </div>
  );
}
