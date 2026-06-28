// ─── UitbetalingStatistieken ───────────────────────────────────────────────────
// Overzicht (KPI's) van trainingen- en wedstrijdkosten per lesgever/begeleider.
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from '../trainingen/tokens';
import { minutenNaarUren, formatUren, formatBedrag, vindLesgever, periodeVanSnelknop } from './uitbetalingHelpers';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../trainingen/trainingStatus';
import { getClubSettings, markersUitSettings, markersProvinciaalUitSettings } from '../../services/firestoreService';

export default function UitbetalingStatistieken({ lesgeversLijst, tarieven }) {
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
      getClubSettings(),
    ]).then(([tSnap,gSnap,settings])=>{
      const gMap={}; gSnap.docs.forEach(d=>{ gMap[d.id]=d.data(); });
      const geenMarkers = markersUitSettings(settings);
      const provincialeMarkers = markersProvinciaalUitSettings(settings);
      // Enkel NORMAAL: samengevoegde groepen tellen niet mee als gegeven training.
      // Een lesgever ingevuld bij een samengevoegde groep wordt niet uitbetaald.
      const doorgaand = tSnap.docs
        .map(d=>({id:d.id,...d.data(),_uren:minutenNaarUren(d.data().duurMinuten||gMap[d.data().groepId]?.duurMinuten||60)}))
        .filter(t => {
          const status = bepaalTrainingStatus(t, { geenMarkers, provincialeMarkers, volgtProvincialeKalender: !!gMap[t.groepId]?.volgtProvincialeKalender });
          return status === TRAINING_STATUS.NORMAAL;
        });
      setTrainingen(doorgaand);
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
      // naam live opzoeken via lesgeverId — events.begeleiders[].naam is enkel een
      // snapshot van het moment van toevoegen en kan verouderd zijn na naamswijziging.
      const lsg=vindLesgever(b.lesgeverId,lesgeversLijst);
      const naam=lsg?.naam||b.naam||'—';
      const key=b.lesgeverId||naam;
      if (!perBeg[key]) perBeg[key]={naam,key,km:0,kmBedrag:0,inkom:0,n:0,isAssistent:false,events:[]};
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
  const thS={padding:'8px 10px',textAlign:'left',color:C.textMuted,fontWeight:'700',fontSize:'11px',borderBottom:`1px solid ${C.border}`,position:'sticky',top:0,zIndex:1};
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
        <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'min(65vh,520px)',borderRadius:'10px',border:`1px solid ${C.border}`}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
            <thead><tr style={{background:C.bg}}>
              <th style={{...thS,background:C.bg}}>Naam</th><th style={{...thS,textAlign:'center',background:C.bg}}>Trainingen</th>
              <th style={{...thS,textAlign:'right',background:C.bg}}>Uren</th><th style={{...thS,textAlign:'right',color:kleur,background:C.bg}}>Bedrag</th>
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
          <div style={kpiS}><span style={kpiL}>Km vergoed</span><span style={kpiV(C.orange)}>{Number(Object.values(perBeg).reduce((s,b)=>s+b.km,0)).toFixed(2)} km</span><span style={{fontSize:'11px',color:C.textMuted}}>{formatBedrag(totKmB)} uitbetaald</span></div>
          <div style={kpiS}><span style={kpiL}>Inkomgeld</span><span style={kpiV(C.blue)}>{formatBedrag(totInk)}</span><span style={{fontSize:'11px',color:C.textMuted}}>{wedstrijdEvents.length} wedstrijden</span></div>
        </div>

        <div style={{marginBottom:'12px',fontSize:'16px',fontWeight:'700',color:C.textPrimary}}>🥋 Trainingen per lesgever</div>
        {!Object.keys(perLesgever).length
          ? <div style={{color:C.textMuted,fontSize:'14px',fontStyle:'italic',marginBottom:'24px'}}>Geen trainingsdata in deze periode.</div>
          : <><LesgeversGroep titel="Assistenten" lijst={assistenten} kleur={C.blue} emoji="🎓"/><LesgeversGroep titel="Trainers" lijst={trainers} kleur={C.red} emoji="🥋"/></>
        }

        {Object.keys(perBeg).length>0&&(
          <div>
            <div style={{fontSize:'16px',fontWeight:'700',color:C.textPrimary,marginBottom:'10px',paddingTop:'8px',borderTop:`1px solid ${C.border}`}}>🏆 Wedstrijdkosten per begeleider</div>
            <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'min(65vh,520px)',borderRadius:'10px',border:`1px solid ${C.border}`}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
                <thead><tr style={{background:C.card}}>
                  <th style={{...thS,background:C.card}}>Naam</th><th style={{...thS,textAlign:'center',background:C.card}}>Wedstrijden</th>
                  <th style={{...thS,textAlign:'right',color:C.orange,background:C.card}}>Km-vergoeding</th>
                  <th style={{...thS,textAlign:'right',color:C.blue,background:C.card}}>Inkom</th>
                  <th style={{...thS,textAlign:'right',color:C.green,background:C.card}}>Totaal</th><th style={{...thS,background:C.card}}></th>
                </tr></thead>
                <tbody>
                  {Object.values(perBeg).sort((a,b)=>(b.kmBedrag+b.inkom)-(a.kmBedrag+a.inkom)).map((b,i)=>{
                    const isOpen=openBeg===b.key;
                    return(
                      <React.Fragment key={b.key}>
                        <tr style={{background:isOpen?'rgba(255,255,255,0.06)':(i%2===0?C.bg:C.card),cursor:'pointer'}} onClick={()=>setOpenBeg(isOpen?null:b.key)}>
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
