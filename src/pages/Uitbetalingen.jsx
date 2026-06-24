// src/pages/Uitbetalingen.jsx
// ─── UITBETALINGEN v3.0 ────────────────────────────────────────────────────────
// De drie zware deelschermen zijn opgesplitst naar src/components/uitbetalingen/:
//   - UitbetalingsMatrix      (trainingen-matrix per lesgever × datum)
//   - WedstrijdKostenSectie   (km-/inkomvergoeding per begeleider)
//   - UitbetalingStatistieken (KPI-overzicht)
// Gedeelde formatters/stijlen staan in components/uitbetalingen/uitbetalingHelpers.

import React, { useState, useEffect } from 'react';
import {
  collection, query, orderBy,
  doc, setDoc, deleteDoc, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLesgeversRealtime } from '../hooks/useLesgeversRealtime';
import { useConfirm } from '../contexts/ConfirmContext';
import { C } from '../components/trainingen/tokens';
import { useSeizoenSettings, maandOptiesVoorSeizoen, huidigSeizoenStartJaar } from '../utils/seizoenUtils';
import { datumNaarISO, periodeVanSnelknop } from '../components/uitbetalingen/uitbetalingHelpers';
import UitbetalingsMatrix from '../components/uitbetalingen/UitbetalingsMatrix';
import WedstrijdKostenSectie from '../components/uitbetalingen/WedstrijdKostenSectie';
import UitbetalingStatistieken from '../components/uitbetalingen/UitbetalingStatistieken';

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

// ─── Hoofd component ───────────────────────────────────────────────────────────
export default function Uitbetalingen() {
  const { isBeheerder, isTrainer, isAssistent, lesgeverId, configCache } = useAuth();
  const confirm = useConfirm();
  const [tarieven, setTarieven]       = useState({});
  const tarieftypes = configCache?.lesgeverTypes || [];
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
    <div>
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
      {tabBlad==='statistieken' && <UitbetalingStatistieken lesgeversLijst={lesgeversLijst} tarieven={tarieven}/>}

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
                      groepenLijst={configCache?.groepen || []}
                    />
                }
              </CollapsibleSectie>

              <CollapsibleSectie titel="🏆 Wedstrijdkosten" defaultOpen={true}>
                <WedstrijdKostenSectie
                  periode={actievePeriode}
                  lesgeverId={lesgeverId}
                  isBeheerder={isBeheerder}
                  tarieven={tarieven}
                  lesgeversLijst={lesgeversLijst}
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
