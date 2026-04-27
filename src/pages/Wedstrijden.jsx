import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc,
  doc, query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../firebase';
import { C, MONTHS_NL } from '../components/wedstrijden/tokens';
import { Section, Field, btnStyle, isUpcoming } from '../components/wedstrijden/SharedUI';
import JudokaOverviewPopup from '../components/wedstrijden/JudokaOverviewPopup';
import TournamentCard from '../components/wedstrijden/TournamentCard';
import DetailPanel from '../components/wedstrijden/DetailPanel';
import ExcelImport from '../components/wedstrijden/ExcelImport';
import MailImport from '../components/wedstrijden/MailImport';

function huidigSeizoenStart(offsetJaar = 0) {
  const now = new Date();
  const jaar = (now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1) + offsetJaar;
  return `${jaar}-08-01`;
}

export default function Wedstrijden() {
  const [events,          setEvents]         = useState([]);
  const [inschrijvingen,  setInschrijvingen]  = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [selected,        setSelected]        = useState(null);
  const [judokaZoek,      setJudokaZoek]      = useState('');
  const [search,          setSearch]          = useState('');
  const [filterCat,       setFilterCat]       = useState('alle');
  const [filterMonth,     setFilterMonth]     = useState('alle');
  const [showImport,      setShowImport]      = useState(false);
  const [showMailImport,  setShowMailImport]  = useState(false);
  const [showNewForm,     setShowNewForm]     = useState(false);
  const [showJudokaPopup, setShowJudokaPopup] = useState(false);
  const [newForm,         setNewForm]         = useState({naam:'',datum:'',doelgroep:'',locatie:'',provincie:''});
  const [creating,        setCreating]        = useState(false);
  const [toonVorigSeizoen, setToonVorigSeizoen] = useState(false);

  useEffect(() => {
    const seizoenStart = huidigSeizoenStart(toonVorigSeizoen ? -1 : 0);
    const q = query(collection(db,'events'), where('datum','>=',seizoenStart), orderBy('datum'));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.type==='wedstrijd'));
      setLoading(false);
    }, ()=>setLoading(false));
  }, [toonVorigSeizoen]);

  useEffect(() => {
    const seizoenStart = huidigSeizoenStart(toonVorigSeizoen ? -1 : 0);
    const q = query(collection(db,'inschrijvingen'), where('eventDatum','>=',seizoenStart), orderBy('eventDatum'));
    return onSnapshot(q, snap => {
      setInschrijvingen(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
  }, [toonVorigSeizoen]);

  useEffect(() => {
    if (selected) {
      const updated = events.find(e=>e.id===selected.id);
      if (updated) setSelected(updated);
    }
  }, [events]);

  const allCats = [...new Set(
    events.flatMap(e=>(e.doelgroep||'').split(/[-\/]/).map(s=>s.trim()).filter(Boolean))
  )].sort();

  const allMonths = [...new Set(
    events.filter(e=>e.datum).map(e=>new Date(e.datum).getMonth())
  )].sort((a,b)=>a-b);

  const insByEvent = inschrijvingen.reduce((acc,ins)=>{
    if (!acc[ins.eventId]) acc[ins.eventId]=[];
    acc[ins.eventId].push(ins);
    return acc;
  }, {});

  const eventIdsMetJudoka = judokaZoek.trim()
    ? new Set(inschrijvingen
        .filter(i=>i.judokaNaam?.toLowerCase().includes(judokaZoek.toLowerCase()))
        .map(i=>i.eventId))
    : null;

  const filtered = events.filter(e => {
    if (eventIdsMetJudoka !== null && !eventIdsMetJudoka.has(e.id)) return false;
    const matchSearch = !search || e.naam?.toLowerCase().includes(search.toLowerCase()) || e.locatie?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat==='alle'||(e.doelgroep||'').includes(filterCat);
    const matchMonth  = filterMonth==='alle'||(e.datum&&new Date(e.datum).getMonth()===parseInt(filterMonth));
    return matchSearch && matchCat && matchMonth;
  });

  const upcomingList = filtered.filter(e=> isUpcoming(e.datum));
  const pastList     = filtered.filter(e=>!isUpcoming(e.datum));
  const totalJudoka  = new Set(inschrijvingen.map(i=>i.judokaNaam)).size;
  const totalInschrijvingen = inschrijvingen.length;

  async function handleCreate() {
    if (!newForm.naam.trim()||!newForm.datum) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db,'events'), {
        ...newForm, type:'wedstrijd', createdAt:serverTimestamp(),
      });
      setShowNewForm(false);
      setNewForm({naam:'',datum:'',doelgroep:'',locatie:'',provincie:''});
      setSelected({id:ref.id,...newForm,type:'wedstrijd'});
    } catch(e) { console.error(e); }
    setCreating(false);
  }

  return (
    <div style={{color:C.text,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",paddingBottom:'40px'}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        input:focus,select:focus,textarea:focus{border-color:${C.red}!important;box-shadow:0 0 0 3px ${C.redDim}!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
        details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}
      `}</style>

      {showJudokaPopup && (
        <JudokaOverviewPopup
          inschrijvingen={inschrijvingen}
          onClose={()=>setShowJudokaPopup(false)}
        />
      )}

      {/* Page header */}
      <div style={{marginBottom:'24px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'10px'}}>
          <div>
            <h1 style={{margin:0,fontSize:'24px',fontWeight:'800',letterSpacing:'-0.5px'}}>🏆 Wedstrijden</h1>
            <p style={{margin:'4px 0 0',fontSize:'13px',color:C.textSec}}>Seizoenskalender Judo Kodokan Merchtem</p>
          </div>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button style={{...btnStyle('ghost'),fontSize:'12px'}} onClick={()=>{setShowImport(s=>!s);setShowMailImport(false);}}>
              📊 {showImport?'Verberg import':'Excel importeren'}
            </button>
            <button style={{...btnStyle('ghost'),fontSize:'12px'}} onClick={()=>{setShowMailImport(s=>!s);setShowImport(false);}}>
              📧 {showMailImport?'Verberg mail':'Mail importeren'}
            </button>
            <button style={{...btnStyle('ghost'),fontSize:'12px',borderColor:toonVorigSeizoen?C.red:undefined,color:toonVorigSeizoen?C.red:undefined}} onClick={()=>setToonVorigSeizoen(s=>!s)}>
              📅 {toonVorigSeizoen?'Huidig seizoen':'Vorig seizoen'}
            </button>
            <button style={{...btnStyle('primary'),fontSize:'12px'}} onClick={()=>setShowNewForm(s=>!s)}>
              + Tornooi
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:'10px',marginTop:'16px',flexWrap:'wrap'}}>
          <button
            onClick={()=>setShowJudokaPopup(true)}
            style={{
              background:C.redDim, border:`1px solid ${C.redBord}`, borderRadius:'10px',
              padding:'12px 20px', display:'flex', alignItems:'center', gap:'10px',
              cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', outline:'none',
            }}
            title="Klik voor overzicht van alle ingeschreven judoka's"
          >
            <span style={{fontSize:'20px'}}>👥</span>
            <div style={{textAlign:'left'}}>
              <span style={{fontWeight:'900',fontSize:'26px',color:C.red,display:'block',lineHeight:1}}>{totalJudoka}</span>
              <span style={{fontSize:'11px',color:C.red,opacity:0.8}}>judoka's ingeschreven ↗</span>
            </div>
            <div style={{textAlign:'left',paddingLeft:'12px',borderLeft:`1px solid ${C.redBord}`}}>
              <span style={{fontWeight:'700',fontSize:'18px',color:C.red,display:'block',lineHeight:1}}>{totalInschrijvingen}</span>
              <span style={{fontSize:'11px',color:C.red,opacity:0.8}}>inschrijvingen</span>
            </div>
          </button>
          {[['🏆',events.length,'tornooien'],['📅',events.filter(e=>isUpcoming(e.datum)).length,'komend']].map(([icon,val,lbl])=>(
            <div key={lbl} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'12px 16px',display:'flex',alignItems:'center',gap:'8px'}}>
              <span style={{fontSize:'16px'}}>{icon}</span>
              <span style={{fontWeight:'800',fontSize:'18px',color:C.text}}>{val}</span>
              <span style={{fontSize:'12px',color:C.textSec}}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {showImport&&<div style={{animation:'fadeIn 0.2s ease',marginBottom:'8px'}}><ExcelImport onDone={()=>setShowImport(false)} /></div>}

      {showMailImport&&(
        <div style={{animation:'fadeIn 0.2s ease',marginBottom:'8px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px'}}>
          <MailImport events={events} onDone={()=>setShowMailImport(false)} />
        </div>
      )}

      {showNewForm&&(
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'20px',animation:'fadeIn 0.2s ease'}}>
          <div style={{fontWeight:'700',fontSize:'14px',marginBottom:'14px',color:C.text}}>Nieuw tornooi</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'10px'}}>
            {[['naam','Naam tornooi','text','bv. Mansio Cup'],['datum','Datum','date',''],['doelgroep','Doelgroep','text','bv. U11-U13'],['locatie','Locatie','text','Sporthal...']].map(([key,lbl,type,ph])=>(
              <Field key={key} label={lbl}>
                <input style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'14px',fontFamily:'inherit',outline:'none'}}
                  type={type} placeholder={ph} value={newForm[key]||''} onChange={e=>setNewForm(p=>({...p,[key]:e.target.value}))} />
              </Field>
            ))}
          </div>
          <div style={{display:'flex',gap:'8px',marginTop:'14px'}}>
            <button style={{...btnStyle('primary')}} onClick={handleCreate} disabled={creating||!newForm.naam||!newForm.datum}>{creating?'Aanmaken...':'✓ Aanmaken'}</button>
            <button style={btnStyle('ghost')} onClick={()=>setShowNewForm(false)}>Annuleer</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        <div style={{position:'relative'}}>
          <input
            placeholder="👤 Zoek judoka — filtert tornooilijst..."
            value={judokaZoek}
            onChange={e=>setJudokaZoek(e.target.value)}
            style={{width:'100%',background:C.card,border:`2px solid ${judokaZoek?C.red:C.border}`,borderRadius:'10px',color:C.text,padding:'11px 14px',fontSize:'14px',fontFamily:'inherit',outline:'none',transition:'border-color 0.15s'}}
          />
          {judokaZoek && (
            <button onClick={()=>setJudokaZoek('')} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:C.textSec,cursor:'pointer',fontSize:'16px',padding:'4px',lineHeight:1}}>✕</button>
          )}
        </div>
        {judokaZoek && (
          <div style={{fontSize:'12px',color:C.red,paddingLeft:'4px'}}>
            {eventIdsMetJudoka?.size||0} tornooi{eventIdsMetJudoka?.size!==1?'en':''} gevonden voor "{judokaZoek}"
          </div>
        )}
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
          <input
            placeholder="🔍 Zoek tornooi of locatie..."
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{flex:'1 1 200px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 13px',fontSize:'13px',fontFamily:'inherit',outline:'none'}}
          />
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
            style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'13px',cursor:'pointer',outline:'none',fontFamily:'inherit'}}>
            <option value="alle">Alle categorieën</option>
            {allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}
            style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'13px',cursor:'pointer',outline:'none',fontFamily:'inherit'}}>
            <option value="alle">Alle maanden</option>
            {allMonths.map(m=><option key={m} value={m}>{MONTHS_NL[m]}</option>)}
          </select>
        </div>
      </div>

      {/* Layout */}
      <div style={{display:'grid',gridTemplateColumns:selected?'minmax(0,1fr) minmax(0,420px)':'1fr',gap:'20px',alignItems:'start'}}>
        <div>
          {loading ? (
            <div style={{color:C.textSec,textAlign:'center',padding:'60px'}}>Laden...</div>
          ) : filtered.length===0 ? (
            <div style={{color:C.textMut,textAlign:'center',padding:'60px',fontSize:'14px'}}>
              {judokaZoek ? `Geen tornooien gevonden voor "${judokaZoek}".` : 'Geen tornooien gevonden.'}
              {events.length===0&&' Importeer de Excel-kalender via de knop hierboven.'}
            </div>
          ) : (
            <>
              {upcomingList.length>0&&(
                <Section label={`Komende tornooien (${upcomingList.length})`}>
                  {upcomingList.map(e=>(
                    <TournamentCard key={e.id} event={e}
                      judokaCount={insByEvent[e.id]?.length||0}
                      isSelected={selected?.id===e.id}
                      onClick={()=>setSelected(selected?.id===e.id?null:e)} />
                  ))}
                </Section>
              )}
              {pastList.length>0&&(
                <Section label={`Voorbije tornooien (${pastList.length})`} muted>
                  {pastList.map(e=>(
                    <TournamentCard key={e.id} event={e}
                      judokaCount={insByEvent[e.id]?.length||0}
                      isSelected={selected?.id===e.id}
                      onClick={()=>setSelected(selected?.id===e.id?null:e)} />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {selected&&(
          <div style={{position:'sticky',top:'16px',maxHeight:'85vh',display:'flex',flexDirection:'column',animation:'fadeIn 0.2s ease'}}>
            <DetailPanel
              event={selected}
              inschrijvingenVoorEvent={insByEvent[selected.id]||[]}
              onClose={()=>setSelected(null)}
              onUpdate={updated=>setSelected(updated)}
              onDelete={()=>setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
