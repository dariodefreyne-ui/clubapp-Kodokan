// src/pages/Uitbetalingen.jsx
// ─── UITBETALINGEN v2.0 ────────────────────────────────────────────────────────

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, getDocs,
  doc, setDoc, deleteDoc, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLesgeversRealtime } from '../hooks/useLesgeversRealtime';
import { useConfirm } from '../contexts/ConfirmContext';
import * as XLSX from 'xlsx';
import { C } from '../components/trainingen/tokens';

// ─── Formatters ────────────────────────────────────────────────────────────────
function minutenNaarUren(min) { return Math.round((min / 60) * 100) / 100; }
function formatUren(u) { return u ? `${u.toFixed(2)}u` : '—'; }
function formatBedrag(b) { return `€ ${b.toFixed(2)}`; }
function datumNaarISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function normNaam(s) { return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
function vindLesgever(key, lijst) {
  if (!key || !Array.isArray(lijst)) return null;
  return lijst.find(l=>l.id===key) || lijst.find(l=>l.uid&&l.uid===key) || lijst.find(l=>normNaam(l.naam)===normNaam(key)) || null;
}

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
function maandOptiesVoorSeizoen() {
  const nu=new Date(), jaar=nu.getFullYear(), maand=nu.getMonth();
  const s=maand>=8?jaar:jaar-1;
  return Array.from({length:12},(_,i)=>{
    const d=new Date(s,8+i,1);
    return { id:`maand-${datumNaarISO(d)}`, van:datumNaarISO(d), tot:datumNaarISO(new Date(d.getFullYear(),d.getMonth()+1,0)), naam:d.toLocaleDateString('nl-BE',{month:'long',year:'numeric'}), value:`${datumNaarISO(d)}|${datumNaarISO(new Date(d.getFullYear(),d.getMonth()+1,0))}` };
  });
}

// ─── Herbruikbare CollapsibleSectie ───────────────────────────────────────────
function CollapsibleSectie({ titel, badge, bedrag, kleur, defaultOpen=true, children, extra }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom:'16px', border:`1px solid ${C.border}`, borderRadius:'12px', overflow:'hidden' }}>
      <button
        onClick={() => setOpen(o=>!o)}
        style={{ width:'100%', display:'flex', alignItems:'center', gap:'10px', padding:'13px 16px', background:C.card, border:'none', cursor:'pointer', textAlign:'left' }}
      >
        <span style={{ fontSize:'16px', fontWeight:'700', color:C.textPrimary, flex:1 }}>{titel}</span>
        {badge && (
          <span style={{ fontSize:'12px', color:C.textMuted, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'999px', padding:'2px 10px', flexShrink:0 }}>{badge}</span>
        )}
        {bedrag !== undefined && (
          <span style={{ fontSize:'15px', fontWeight:'800', color:kleur||C.green, flexShrink:0 }}>{formatBedrag(bedrag)}</span>
        )}
        {extra}
        <span style={{ color:C.textMuted, fontSize:'13px', flexShrink:0, marginLeft:'4px' }}>{open?'▲':'▼'}</span>
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
    const nu=new Date(), m=nu.getMonth(), j=nu.getFullYear(), pi=Math.floor(m/2), sm=pi*2, em=sm+1;
    const mn=['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    setVan(datumNaarISO(new Date(j,sm,1))); setTot(datumNaarISO(new Date(j,em+1,0))); setNaam(`${mn[sm]}-${mn[em]} ${j}`);
  };
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
          <input type="date" value={van} onChange={e=>setVan(e.target.value)} style={{flex:1,padding:'8px',background:C.bg,border:`1px solid ${C.border}`,borderRadius:'6px',color:C.textPrimary,fontSize:'13px'}}/>
          <span style={{color:C.textMuted,alignSelf:'center'}}>→</span>
          <input type="date" value={tot} onChange={e=>setTot(e.target.value)} style={{flex:1,padding:'8px',background:C.bg,border:`1px solid ${C.border}`,borderRadius:'6px',color:C.textPrimary,fontSize:'13px'}}/>
        </div>
        <input type="text" value={naam} onChange={e=>setNaam(e.target.value)} placeholder="Naam periode (optioneel)" style={{width:'100%',padding:'8px 10px',background:C.bg,border:`1px solid ${C.border}`,borderRadius:'6px',color:C.textPrimary,fontSize:'13px',boxSizing:'border-box'}}/>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={huidigePeriode} style={{flex:1,padding:'8px',background:'transparent',border:`1px solid ${C.border}`,borderRadius:'6px',color:C.textSec,cursor:'pointer',fontSize:'12px'}}>Huidige 2-maand</button>
          <button onClick={voegToe} disabled={!van||!tot} style={{flex:1,padding:'8px',background:van&&tot?C.red:C.borderSoft,border:'none',borderRadius:'6px',color:'var(--text-primary)',cursor:van&&tot?'pointer':'not-allowed',fontSize:'13px',fontWeight:'600'}}>+ Toevoegen</button>
        </div>
      </div>
    </div>
  );
}

// ─── WedstrijdKostenSectie ─────────────────────────────────────────────────────
// Gecombineerd overzicht per begeleider (km + inkom), klikbaar voor detail.
function WedstrijdKostenSectie({ periode, lesgeverId, isBeheerder, tarieven }) {
  const [events, setEvents] = useState([]);
  const [laden, setLaden]   = useState(true);
  const [openBegeleider, setOpenBegeleider] = useState(null); // naam van open begeleider

  useEffect(() => {
    if (!periode) return;
    setLaden(true);
    const unsub = onSnapshot(collection(db,'events'), snap => {
      setEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>
        e.type==='wedstrijd' && e.datum>=periode.van && e.datum<=periode.tot &&
        Array.isArray(e.begeleiders) && e.begeleiders.length>0
      ));
      setLaden(false);
    });
    return unsub;
  }, [periode]);

  if (laden) return <div style={{color:C.textMuted,fontSize:'13px',padding:'12px 0'}}>Wedstrijden laden...</div>;

  const kmTarief = tarieven['kilometer']?.bedragPerKm || 0;

  // Alle rijen
  const rijen = [];
  for (const ev of events) {
    for (const b of (ev.begeleiders||[]).filter(x=>x.aanwezig!==false)) {
      if (!isBeheerder && b.lesgeverId !== lesgeverId) continue;
      rijen.push({ eventId:ev.id, eventNaam:ev.naam||ev.datum, datum:ev.datum, naam:b.naam||'—', lesgeverId:b.lesgeverId, km:parseFloat(b.km)||0, inkom:parseFloat(b.inkom)||0 });
    }
  }

  if (rijen.length===0) return <div style={{color:C.textMuted,fontSize:'13px',fontStyle:'italic',padding:'8px 0'}}>Geen wedstrijdkosten in deze periode.</div>;

  // Groepeer per begeleider
  const perBegeleider = {};
  for (const r of rijen) {
    if (!perBegeleider[r.naam]) perBegeleider[r.naam] = { naam:r.naam, km:0, kmBedrag:0, inkom:0, events:[] };
    perBegeleider[r.naam].km     += r.km;
    perBegeleider[r.naam].kmBedrag += r.km * kmTarief;
    perBegeleider[r.naam].inkom  += r.inkom;
    perBegeleider[r.naam].events.push(r);
  }
  const lijst = Object.values(perBegeleider).sort((a,b)=>(b.kmBedrag+b.inkom)-(a.kmBedrag+a.inkom));
  const totKm = lijst.reduce((s,b)=>s+b.km,0);
  const totKmB = lijst.reduce((s,b)=>s+b.kmBedrag,0);
  const totInkom = lijst.reduce((s,b)=>s+b.inkom,0);
  const totaal = totKmB + totInkom;

  const thStyle = { padding:'8px 10px', textAlign:'left', color:C.textMuted, fontWeight:'700', fontSize:'11px', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' };
  const tdStyle = (right=false) => ({ padding:'8px 10px', color:C.textPrimary, fontSize:'12px', textAlign:right?'right':'left', borderBottom:`1px solid ${C.border}` });

  return (
    <div style={{paddingTop:'12px'}}>
      <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:C.card}}>
              <th style={thStyle}>Begeleider</th>
              <th style={{...thStyle,textAlign:'right'}}>Km</th>
              <th style={{...thStyle,textAlign:'right',color:C.orange}}>Km-verg.</th>
              <th style={{...thStyle,textAlign:'right',color:C.blue}}>Inkom</th>
              <th style={{...thStyle,textAlign:'right',color:C.green}}>Totaal</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {lijst.map((b,i) => {
              const isOpen = openBegeleider === b.naam;
              const rij = b.events;
              return (
                <React.Fragment key={b.naam}>
                  <tr
                    style={{background:isOpen?C.card:(i%2===0?C.bg:C.card), cursor:'pointer'}}
                    onClick={()=>setOpenBegeleider(isOpen?null:b.naam)}
                  >
                    <td style={{...tdStyle(),fontWeight:'700'}}>{b.naam}</td>
                    <td style={{...tdStyle(true)}}>{b.km>0?`${b.km} km`:'—'}</td>
                    <td style={{...tdStyle(true),color:C.orange,fontWeight:'600'}}>{b.kmBedrag>0?formatBedrag(b.kmBedrag):'—'}</td>
                    <td style={{...tdStyle(true),color:C.blue,fontWeight:'600'}}>{b.inkom>0?formatBedrag(b.inkom):'—'}</td>
                    <td style={{...tdStyle(true),color:C.green,fontWeight:'700'}}>{formatBedrag(b.kmBedrag+b.inkom)}</td>
                    <td style={{...tdStyle(),color:C.textMuted,fontSize:'11px'}}>{isOpen?'▲':'▼'}</td>
                  </tr>
                  {isOpen && rij.map(r=>(
                    <tr key={`${r.eventId}-${r.naam}`} style={{background:'rgba(255,255,255,0.03)'}}>
                      <td style={{...tdStyle(),paddingLeft:'24px',color:C.textSec,fontStyle:'italic'}}>↳ {r.eventNaam}</td>
                      <td style={{...tdStyle(true),color:C.textSec}}>{r.km>0?`${r.km} km`:'—'}</td>
                      <td style={{...tdStyle(true),color:C.orange}}>{r.km>0&&kmTarief>0?formatBedrag(r.km*kmTarief):'—'}</td>
                      <td style={{...tdStyle(true),color:C.blue}}>{r.inkom>0?formatBedrag(r.inkom):'—'}</td>
                      <td style={{...tdStyle(true),color:C.textSec}}>{formatBedrag((r.km*kmTarief)+(r.inkom))}</td>
                      <td style={tdStyle()}>
                        <span style={{fontSize:'11px',color:C.textMuted}}>{r.datum}</span>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
            <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
              <td style={{...tdStyle(),fontWeight:'800',color:C.textPrimary}}>TOTAAL</td>
              <td style={{...tdStyle(true),fontWeight:'700',color:C.textPrimary}}>{totKm} km</td>
              <td style={{...tdStyle(true),fontWeight:'800',color:C.orange}}>{formatBedrag(totKmB)}</td>
              <td style={{...tdStyle(true),fontWeight:'800',color:C.blue}}>{formatBedrag(totInkom)}</td>
              <td style={{...tdStyle(true),fontWeight:'800',color:C.green}}>{formatBedrag(totaal)}</td>
              <td style={tdStyle()}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── UitbetalingsMatrix (trainingen) ──────────────────────────────────────────
function UitbetalingsMatrix({ periode, lesgeversLijst, tarieven, tarieftypes, filterLesgeverId }) {
  const [data, setData]   = useState(null);
  const [laden, setLaden] = useState(false);
  const [fout, setFout]   = useState('');

  const laad = useCallback(async () => {
    if (!periode) return;
    setLaden(true); setFout('');
    try {
      const snap = await getDocs(query(collection(db,'trainingen'), where('datum','>=',periode.van), where('datum','<=',periode.tot), orderBy('datum','asc')));
      const trainingen = snap.docs.map(d=>({id:d.id,...d.data()})).filter(t=>(t.lesgevers||[]).length>0);
      if (trainingen.length===0) { setData({datums:[],lesgevers:{}}); return; }

      const groepenSnap = await getDocs(collection(db,'groepen'));
      const groepenMap = {};
      groepenSnap.docs.forEach(d=>{ groepenMap[d.id]=d.data(); });

      const datums = [...new Set(trainingen.map(t=>t.datum))].sort();
      const matrix = {};
      for (const t of trainingen) {
        const uren = minutenNaarUren(t.duurMinuten || groepenMap[t.groepId]?.duurMinuten || 60);
        for (const rawKey of (t.lesgevers||[])) {
          const id = vindLesgever(rawKey,lesgeversLijst)?.id || rawKey;
          if (!matrix[id]) matrix[id]={};
          matrix[id][t.datum] = (matrix[id][t.datum]||0) + uren;
        }
      }
      const gefilterd = filterLesgeverId
        ? Object.fromEntries(Object.entries(matrix).filter(([id])=>id===filterLesgeverId))
        : matrix;
      setData({datums,lesgevers:gefilterd});
    } catch(e) { setFout('Laden mislukt: '+e.message); }
    finally { setLaden(false); }
  }, [periode, lesgeversLijst]);

  useEffect(()=>{ laad(); },[laad]);

  const exporteerMatrix = () => {
    if (!data) return;
    const gesorteerd = Object.keys(data.lesgevers).sort((a,b)=>{
      return (lesgeversLijst.find(l=>l.id===a)?.naam??a).localeCompare(lesgeversLijst.find(l=>l.id===b)?.naam??b);
    });
    const headers = ['Lesgever','Type',...data.datums,'Totaal uren','Tarief/u','Totaal €'];
    const rows = [[`Uitbetaling ${periode.naam}`], headers];
    for (const id of gesorteerd) {
      const info = lesgeversLijst.find(l=>l.id===id);
      const tarief = tarieven[info?.type||'']?.bedragPerUur||0;
      let totU=0;
      const dw = data.datums.map(d=>{ const u=data.lesgevers[id][d]||0; totU+=u; return u>0?u:''; });
      rows.push([info?.naam??id, tarieftypes.find(t=>t.id===info?.type)?.label||info?.type||'—', ...dw, Math.round(totU*100)/100, tarief>0?tarief:'—', tarief>0?Math.round(totU*tarief*100)/100:'—']);
    }
    const totaalPerDatum = data.datums.map(d=>gesorteerd.reduce((s,id)=>s+(data.lesgevers[id][d]||0),0));
    rows.push(['TOTAAL','',...totaalPerDatum.map(u=>u>0?Math.round(u*100)/100:''),'','','']);
    const ws=XLSX.utils.aoa_to_sheet(rows), wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,ws,'Uitbetaling');
    XLSX.writeFile(wb,`uitbetaling_${periode.naam.replace(/\s/g,'_')}.xlsx`);
  };

  if (!periode) return null;
  if (laden) return <div style={{color:C.textMuted,fontSize:'14px',padding:'20px'}}>Laden…</div>;
  if (fout)  return <div style={{color:'var(--danger)',fontSize:'14px',padding:'20px'}}>{fout}</div>;
  if (!data) return null;
  if (data.datums.length===0) return <div style={{color:C.textMuted,fontSize:'14px',padding:'12px 0',fontStyle:'italic'}}>Geen trainingen met lesgevers in deze periode.</div>;

  const gesorteerd = Object.keys(data.lesgevers).sort((a,b)=>{
    return (lesgeversLijst.find(l=>l.id===a)?.naam??a).localeCompare(lesgeversLijst.find(l=>l.id===b)?.naam??b);
  });

  const totaalBedrag = gesorteerd.reduce((sum,id)=>{
    const info=lesgeversLijst.find(l=>l.id===id);
    const tarief=tarieven[info?.type||'']?.bedragPerUur||0;
    const u=data.datums.reduce((s,d)=>s+(data.lesgevers[id][d]||0),0);
    return sum+u*tarief;
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
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((id,idx)=>{
              const info=lesgeversLijst.find(l=>l.id===id);
              const naam=info?.naam??id;
              const typeId=info?.type||'';
              const typeLabel=tarieftypes.find(t=>t.id===typeId)?.label||'—';
              const tarief=tarieven[typeId]?.bedragPerUur||0;
              let totU=0;
              return (
                <tr key={id} style={{background:idx%2===0?C.bg:C.card,borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:'10px 12px',color:C.textPrimary,fontWeight:'600',position:'sticky',left:0,background:idx%2===0?C.bg:C.card,borderRight:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{naam}</td>
                  <td style={{padding:'10px 8px',color:C.textMuted,fontSize:'11px'}}>{typeLabel}</td>
                  {data.datums.map(d=>{ const u=data.lesgevers[id][d]||0; totU+=u; return (
                    <td key={d} style={{padding:'10px 8px',textAlign:'center',color:u>0?C.textPrimary:C.textMuted}}>{u>0?`${u}u`:'·'}</td>
                  ); })}
                  <td style={{padding:'10px 8px',textAlign:'right',color:C.textPrimary,fontWeight:'700',borderLeft:`1px solid ${C.border}`}}>{formatUren(totU)}</td>
                  <td style={{padding:'10px 8px',textAlign:'right',color:C.textMuted}}>{tarief>0?`€${tarief}`:'—'}</td>
                  <td style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'700'}}>{tarief>0?formatBedrag(totU*tarief):'—'}</td>
                </tr>
              );
            })}
            <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
              <td style={{padding:'10px 12px',color:C.textPrimary,fontWeight:'800',position:'sticky',left:0,background:C.card,borderRight:`1px solid ${C.border}`}}>TOTAAL</td>
              <td/>
              {data.datums.map(d=>{
                const tot=gesorteerd.reduce((s,id)=>s+(data.lesgevers[id][d]||0),0);
                return <td key={d} style={{padding:'10px 8px',textAlign:'center',color:C.orange,fontWeight:'700',fontSize:'11px'}}>{tot>0?`${Math.round(tot*100)/100}u`:''}</td>;
              })}
              <td style={{padding:'10px 8px',textAlign:'right',color:C.orange,fontWeight:'800',borderLeft:`1px solid ${C.border}`}}>
                {formatUren(gesorteerd.reduce((s,id)=>s+data.datums.reduce((ss,d)=>ss+(data.lesgevers[id][d]||0),0),0))}
              </td>
              <td/>
              <td style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'800'}}>{formatBedrag(totaalBedrag)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── StatistiekenTab ───────────────────────────────────────────────────────────
function StatistiekenTab({ lesgeversLijst, tarieven, tarieftypes }) {
  const [periode, setPeriode] = useState(()=>periodeVanSnelknop('dit-seizoen'));
  const [trainingen, setTrainingen] = useState([]);
  const [wedstrijdEvents, setWedstrijdEvents] = useState([]);
  const [laden, setLaden] = useState(false);
  const [openBeg, setOpenBeg] = useState(null);

  useEffect(()=>{
    if(!periode) return;
    setLaden(true);
    Promise.all([
      getDocs(query(collection(db,'trainingen'),where('datum','>=',periode.van),where('datum','<=',periode.tot),orderBy('datum','asc'))),
      getDocs(collection(db,'groepen')),
    ]).then(([tSnap,gSnap])=>{
      const gMap={};
      gSnap.docs.forEach(d=>{ gMap[d.id]=d.data(); });
      setTrainingen(tSnap.docs.map(d=>({id:d.id,...d.data(),_uren:minutenNaarUren(d.data().duurMinuten||gMap[d.data().groepId]?.duurMinuten||60)})));
      setLaden(false);
    }).catch(()=>setLaden(false));
  },[periode]);

  useEffect(()=>{
    if(!periode) return;
    const unsub=onSnapshot(collection(db,'events'),snap=>{
      setWedstrijdEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>
        e.type==='wedstrijd'&&e.datum>=periode.van&&e.datum<=periode.tot&&Array.isArray(e.begeleiders)&&e.begeleiders.length>0
      ));
    });
    return unsub;
  },[periode]);

  function vindLsg(key){ return vindLesgever(key,lesgeversLijst); }

  // Per lesgever
  const perLesgever={};
  for(const t of trainingen){
    for(const rawKey of (t.lesgevers||[])){
      const lsg=vindLsg(rawKey);
      const id=lsg?.id||rawKey;
      if(!perLesgever[id]) perLesgever[id]={naam:lsg?.naam||rawKey,type:lsg?.type||'',uren:0,bedrag:0,aantalTrainingen:0};
      const tarief=tarieven[lsg?.type||'']?.bedragPerUur||0;
      perLesgever[id].uren+=t._uren;
      perLesgever[id].bedrag+=t._uren*tarief;
      perLesgever[id].aantalTrainingen+=1;
    }
  }
  const kmTarief=tarieven['kilometer']?.bedragPerKm||0;
  const perBegeleider={};
  for(const ev of wedstrijdEvents){
    for(const b of (ev.begeleiders||[]).filter(x=>x.aanwezig!==false)){
      const key=b.naam||b.lesgeverId||'—';
      if(!perBegeleider[key]) perBegeleider[key]={naam:key,km:0,kmBedrag:0,inkom:0,aantalWedstrijden:0,isAssistent:false,events:[]};
      const lsg=vindLsg(b.lesgeverId);
      perBegeleider[key].isAssistent=lsg?.type==='assistent';
      perBegeleider[key].km+=parseFloat(b.km)||0;
      perBegeleider[key].kmBedrag+=(parseFloat(b.km)||0)*kmTarief;
      perBegeleider[key].inkom+=parseFloat(b.inkom)||0;
      perBegeleider[key].aantalWedstrijden+=1;
      perBegeleider[key].events.push({eventNaam:ev.naam||ev.datum,datum:ev.datum,km:parseFloat(b.km)||0,inkom:parseFloat(b.inkom)||0});
    }
  }

  const assistenten=Object.values(perLesgever).filter(l=>l.type==='assistent');
  const trainers=Object.values(perLesgever).filter(l=>l.type!=='assistent');
  const totaalBedragT=Object.values(perLesgever).reduce((s,l)=>s+l.bedrag,0);
  const totaalKm=Object.values(perBegeleider).reduce((s,b)=>s+b.km,0);
  const totaalKmB=Object.values(perBegeleider).reduce((s,b)=>s+b.kmBedrag,0);
  const totaalInkom=Object.values(perBegeleider).reduce((s,b)=>s+b.inkom,0);
  const totaalW=totaalKmB+totaalInkom;
  const totaalAlles=totaalBedragT+totaalW;

  const kpiStyle={background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px 20px',display:'flex',flexDirection:'column',gap:'4px'};
  const kpiL={fontSize:'11px',color:C.textMuted,fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.6px'};
  const kpiV=(c)=>({fontSize:'22px',fontWeight:'800',color:c||C.textPrimary});

  function LesgeversGroep({titel,lijst,kleur,emoji}){
    if(!lijst.length) return null;
    const totU=lijst.reduce((s,l)=>s+l.uren,0), totB=lijst.reduce((s,l)=>s+l.bedrag,0);
    const thS={padding:'8px 10px',textAlign:'left',color:C.textMuted,fontWeight:'700',fontSize:'11px',borderBottom:`1px solid ${C.border}`};
    return(
      <div style={{marginBottom:'20px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px',paddingBottom:'8px',borderBottom:`1px solid ${C.border}`}}>
          <span style={{fontSize:'14px',fontWeight:'700',color:C.textPrimary}}>{emoji} {titel}</span>
          <span style={{fontSize:'12px',color:C.textMuted,background:C.bg,border:`1px solid ${C.border}`,borderRadius:'999px',padding:'2px 10px'}}>{lijst.length} personen</span>
          <span style={{marginLeft:'auto',fontSize:'14px',fontWeight:'800',color:kleur}}>{formatBedrag(totB)}</span>
        </div>
        <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
            <thead><tr style={{background:C.bg}}>
              <th style={thS}>Naam</th>
              <th style={{...thS,textAlign:'center'}}>Trainingen</th>
              <th style={{...thS,textAlign:'right'}}>Uren</th>
              <th style={{...thS,textAlign:'right',color:kleur}}>Bedrag</th>
            </tr></thead>
            <tbody>
              {lijst.sort((a,b)=>b.uren-a.uren).map((l,i)=>(
                <tr key={l.naam} style={{background:i%2===0?C.card:C.bg,borderTop:`1px solid ${C.border}`}}>
                  <td style={{padding:'8px 10px',color:C.textPrimary,fontWeight:'600'}}>{l.naam}</td>
                  <td style={{padding:'8px 10px',textAlign:'center',color:C.textMuted}}>{l.aantalTrainingen}×</td>
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

  const thSW={padding:'8px 10px',textAlign:'left',color:C.textMuted,fontWeight:'700',fontSize:'11px',borderBottom:`1px solid ${C.border}`};
  const tdSW=(right=false)=>({padding:'8px 10px',color:C.textPrimary,fontSize:'12px',textAlign:right?'right':'left',borderBottom:`1px solid ${C.border}`});

  return(
    <div>
      <div style={{marginBottom:'20px'}}>
        <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Periode</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
          {['dit-seizoen','vorige-maand','deze-maand'].map(type=>{
            const p=periodeVanSnelknop(type), actief=periode?.van===p.van&&periode?.tot===p.tot;
            return <button key={type} onClick={()=>setPeriode(p)} style={{padding:'7px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'13px',fontWeight:'600',background:actief?C.red:C.card,border:`1px solid ${actief?C.red:C.border}`,color:actief?'white':C.textSec}}>{p.naam}</button>;
          })}
        </div>
        {periode && <div style={{marginTop:'6px',fontSize:'12px',color:C.textMuted}}>{periode.van} → {periode.tot}</div>}
      </div>

      {laden ? <div style={{color:C.textMuted,padding:'20px',textAlign:'center'}}>Laden…</div> : <>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'12px',marginBottom:'28px'}}>
          <div style={kpiStyle}><span style={kpiL}>Totaal uitbetaling</span><span style={kpiV(C.green)}>{formatBedrag(totaalAlles)}</span><span style={{fontSize:'11px',color:C.textMuted}}>trainingen + wedstrijden</span></div>
          <div style={kpiStyle}><span style={kpiL}>🥋 Trainingen</span><span style={kpiV(C.red)}>{formatBedrag(totaalBedragT)}</span><span style={{fontSize:'11px',color:C.textMuted}}>{formatUren(Object.values(perLesgever).reduce((s,l)=>s+l.uren,0))} totaal</span></div>
          <div style={kpiStyle}><span style={kpiL}>🏆 Wedstrijdkosten</span><span style={kpiV(C.orange)}>{formatBedrag(totaalW)}</span><span style={{fontSize:'11px',color:C.textMuted}}>km + inkom</span></div>
          <div style={kpiStyle}><span style={kpiL}>Assistenten</span><span style={kpiV(C.blue)}>{assistenten.length}</span><span style={{fontSize:'11px',color:C.textMuted}}>van {Object.keys(perLesgever).length} lesgevers</span></div>
          <div style={kpiStyle}><span style={kpiL}>Km vergoed</span><span style={kpiV(C.orange)}>{totaalKm} km</span><span style={{fontSize:'11px',color:C.textMuted}}>{formatBedrag(totaalKmB)} uitbetaald</span></div>
          <div style={kpiStyle}><span style={kpiL}>Inkomgeld</span><span style={kpiV(C.blue)}>{formatBedrag(totaalInkom)}</span><span style={{fontSize:'11px',color:C.textMuted}}>{wedstrijdEvents.length} wedstrijden</span></div>
        </div>

        <div style={{marginBottom:'12px',fontSize:'16px',fontWeight:'700',color:C.textPrimary}}>🥋 Trainingen per lesgever</div>
        {Object.keys(perLesgever).length===0
          ? <div style={{color:C.textMuted,fontSize:'14px',fontStyle:'italic',marginBottom:'24px'}}>Geen trainingsdata in deze periode.</div>
          : <><LesgeversGroep titel="Assistenten" lijst={assistenten} kleur={C.blue} emoji="🎓"/><LesgeversGroep titel="Trainers & initiators" lijst={trainers} kleur={C.red} emoji="🥋"/></>
        }

        {Object.keys(perBegeleider).length>0 && (
          <div>
            <div style={{fontSize:'16px',fontWeight:'700',color:C.textPrimary,marginBottom:'10px',paddingTop:'8px',borderTop:`1px solid ${C.border}`}}>🏆 Wedstrijdkosten per begeleider</div>
            <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                <thead><tr style={{background:C.card}}>
                  <th style={thSW}>Naam</th>
                  <th style={{...thSW,textAlign:'center'}}>Wedstrijden</th>
                  <th style={{...thSW,textAlign:'right',color:C.orange}}>Km-vergoeding</th>
                  <th style={{...thSW,textAlign:'right',color:C.blue}}>Inkom</th>
                  <th style={{...thSW,textAlign:'right',color:C.green}}>Totaal</th>
                  <th style={thSW}></th>
                </tr></thead>
                <tbody>
                  {Object.values(perBegeleider).sort((a,b)=>(b.kmBedrag+b.inkom)-(a.kmBedrag+a.inkom)).map((b,i)=>{
                    const isOpen=openBeg===b.naam;
                    return(
                      <React.Fragment key={b.naam}>
                        <tr style={{background:isOpen?C.card:(i%2===0?C.bg:C.card),cursor:'pointer'}} onClick={()=>setOpenBeg(isOpen?null:b.naam)}>
                          <td style={{...tdSW(),fontWeight:'700'}}>
                            {b.naam}
                            {b.isAssistent&&<span style={{marginLeft:'6px',fontSize:'10px',background:'rgba(59,130,246,0.15)',color:C.blue,border:`1px solid rgba(59,130,246,0.3)`,borderRadius:'4px',padding:'1px 5px'}}>assistent</span>}
                          </td>
                          <td style={{...tdSW(true)}}>{b.aantalWedstrijden}×</td>
                          <td style={{...tdSW(true),color:C.orange,fontWeight:'600'}}>{b.kmBedrag>0?formatBedrag(b.kmBedrag):'—'}</td>
                          <td style={{...tdSW(true),color:C.blue,fontWeight:'600'}}>{b.inkom>0?formatBedrag(b.inkom):'—'}</td>
                          <td style={{...tdSW(true),color:C.green,fontWeight:'700'}}>{formatBedrag(b.kmBedrag+b.inkom)}</td>
                          <td style={{...tdSW(),color:C.textMuted,fontSize:'11px'}}>{isOpen?'▲':'▼'}</td>
                        </tr>
                        {isOpen&&b.events.map((e,ei)=>(
                          <tr key={ei} style={{background:'rgba(255,255,255,0.03)'}}>
                            <td style={{...tdSW(),paddingLeft:'24px',color:C.textSec,fontStyle:'italic'}}>↳ {e.eventNaam}</td>
                            <td style={{...tdSW(true),color:C.textMuted,fontSize:'11px'}}>{e.datum}</td>
                            <td style={{...tdSW(true),color:C.orange}}>{e.km>0&&kmTarief>0?formatBedrag(e.km*kmTarief):'—'}</td>
                            <td style={{...tdSW(true),color:C.blue}}>{e.inkom>0?formatBedrag(e.inkom):'—'}</td>
                            <td style={{...tdSW(true),color:C.textSec}}>{formatBedrag((e.km*kmTarief)+e.inkom)}</td>
                            <td style={tdSW()}></td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
                    <td colSpan={2} style={{...tdSW(),fontWeight:'800',color:C.textPrimary}}>TOTAAL</td>
                    <td style={{...tdSW(true),fontWeight:'800',color:C.orange}}>{formatBedrag(totaalKmB)}</td>
                    <td style={{...tdSW(true),fontWeight:'800',color:C.blue}}>{formatBedrag(totaalInkom)}</td>
                    <td style={{...tdSW(true),fontWeight:'800',color:C.green}}>{formatBedrag(totaalW)}</td>
                    <td style={tdSW()}></td>
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
  const maandOpties = maandOptiesVoorSeizoen();
  const actieveMaandWaarde = maandOpties.find(p=>p.van===actievePeriode?.van&&p.tot===actievePeriode?.tot)?.value||'';

  useEffect(()=>{
    const unsub=onSnapshot(collection(db,'tarieven'),snap=>{
      const data={}; snap.docs.forEach(d=>{ data[d.id]=d.data(); }); setTarieven(data);
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
      if(lijst.length>0&&!actievePeriode) setActievePeriode(lijst[0]);
    }); return unsub;
  },[]);

  const voegPeriodeToe = async({van,tot,naam})=>{
    await setDoc(doc(collection(db,'uitbetalingsperiodes')),{van,tot,naam,aangemaakt:serverTimestamp()});
  };
  const verwijderPeriode = async(id)=>{
    const ok=await confirm({titel:'Uitbetalingsperiode verwijderen?',beschrijving:'De periode wordt definitief verwijderd.',bevestigLabel:'Ja, verwijderen',variant:'danger'});
    if(!ok) return;
    await deleteDoc(doc(db,'uitbetalingsperiodes',id));
    if(actievePeriode?.id===id) setActievePeriode(null);
  };

  // Bereken totalen voor CollapsibleSectie badges in het Overzicht
  // (worden pas berekend nadat child-components de data hebben — we geven geen totaal mee in header,
  //  enkel de toeklapbare wrapper met een neutraal label)

  if (!isTrainer && !isBeheerder && !isAssistent) return (
    <div style={{color:C.textPrimary,padding:'40px',textAlign:'center'}}>
      <div style={{fontSize:'48px',marginBottom:'16px'}}>🔒</div>
      <div style={{fontSize:'16px',color:C.textSec}}>Geen toegang.</div>
    </div>
  );

  const tabStyle = (id) => ({
    padding:'8px 16px',background:'transparent',border:'none',
    borderBottom:`2px solid ${tabBlad===id?C.red:'transparent'}`,
    color:tabBlad===id?C.textPrimary:C.textMuted,
    cursor:'pointer',fontSize:'14px',fontWeight:tabBlad===id?'700':'400',
    marginBottom:'-1px',fontFamily:'inherit',
  });

  return (
    <div style={{color:C.textPrimary,paddingBottom:'40px'}}>
      {/* Header */}
      <div style={{marginBottom:'24px',paddingBottom:'16px',borderBottom:`1px solid ${C.border}`}}>
        <h1 style={{margin:'0 0 4px',fontSize:'clamp(20px,5vw,26px)',fontWeight:'800'}}>💶 Uitbetalingen lesgevers</h1>
        <p style={{margin:0,fontSize:'14px',color:C.textSec}}>Matrix op basis van aanwezigheid × duur × tarief</p>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:'4px',marginBottom:'24px',borderBottom:`1px solid ${C.border}`,paddingBottom:'0'}}>
        <button style={tabStyle('matrix')} onClick={()=>setTabBlad('matrix')}>📊 Overzicht</button>
        {isBeheerder && <button style={tabStyle('statistieken')} onClick={()=>setTabBlad('statistieken')}>📈 Statistieken</button>}
        <button style={tabStyle('periodes')} onClick={()=>setTabBlad('periodes')}>📅 Periodes</button>
      </div>

      {/* ── Periodes tab ── */}
      {tabBlad==='periodes' && <PeriodeBeheer periodes={periodes} onNieuwe={voegPeriodeToe} onVerwijder={verwijderPeriode}/>}

      {/* ── Statistieken tab ── */}
      {tabBlad==='statistieken' && (
        <StatistiekenTab lesgeversLijst={lesgeversLijst} tarieven={tarieven} tarieftypes={tarieftypes}/>
      )}

      {/* ── Overzicht tab ── */}
      {tabBlad==='matrix' && (
        <div>
          {/* Periode-selector */}
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
                return <button key={type} onClick={()=>setActievePeriode(p)} style={{padding:'7px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'13px',fontWeight:'600',background:actief?C.red:C.card,border:`1px solid ${actief?C.red:C.border}`,color:actief?'white':C.textSec}}>{p.naam}</button>;
              })}
            </div>
          </div>
          {periodes.length>0 && (
            <div style={{marginBottom:'16px'}}>
              <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Opgeslagen periodes</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {periodes.map(p=>{
                  const actief=actievePeriode?.id===p.id;
                  return <button key={p.id} onClick={()=>setActievePeriode(p)} style={{padding:'7px 14px',borderRadius:'20px',cursor:'pointer',fontSize:'13px',fontWeight:'600',background:actief?C.red:C.card,border:`1px solid ${actief?C.red:C.border}`,color:actief?'white':C.textSec}}>{p.naam}</button>;
                })}
              </div>
            </div>
          )}

          {actievePeriode ? (
            <div style={{marginTop:'8px'}}>
              {/* Trainingen — toeklapbaar */}
              <CollapsibleSectie titel="🥋 Trainingen" badge={`${lesgeversLijst.length} lesgevers`} defaultOpen={true}>
                {lesgeversLaden
                  ? <div style={{color:C.textMuted,fontSize:'14px',padding:'20px'}}>Lesgevers laden…</div>
                  : <UitbetalingsMatrix
                      periode={actievePeriode}
                      lesgeversLijst={lesgeversLijst}
                      tarieven={tarieven}
                      tarieftypes={tarieftypes}
                      filterLesgeverId={isBeheerder?null:lesgeverId}
                    />
                }
              </CollapsibleSectie>

              {/* Wedstrijdkosten — toeklapbaar */}
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
