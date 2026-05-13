import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, getDocs,
  query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../firebase';
import { C, MONTHS_NL } from '../components/wedstrijden/tokens';
import { cardStyle, buttonStyle, badgeStyle } from '../styles/tokens';
import { Section, MonthDivider, Field, btnStyle, isUpcoming } from '../components/wedstrijden/SharedUI';
import JudokaOverviewPopup from '../components/wedstrijden/JudokaOverviewPopup';
import TournamentCard from '../components/wedstrijden/TournamentCard';
import DetailPanel from '../components/wedstrijden/DetailPanel';
import ExcelImport from '../components/wedstrijden/ExcelImport';
import MailImport from '../components/wedstrijden/MailImport';
import {
  seizoenBereikVanJaar,
  huidigSeizoenStartJaar,
  beschikbareSeizoenStartJaren,
} from '../utils/seizoenUtils';

const MAAND_LANG = ['Januari','Februari','Maart','April','Mei','Juni',
                    'Juli','Augustus','September','Oktober','November','December'];

function groeperOpMaand(events) {
  const map = new Map();
  for (const e of events) {
    const d = new Date(e.datum);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`;
    if (!map.has(key)) map.set(key, { label: `${MAAND_LANG[d.getMonth()]} ${d.getFullYear()}`, maand: d.getMonth(), jaar: d.getFullYear(), items: [] });
    map.get(key).items.push(e);
  }
  return [...map.values()];
}

export default function Wedstrijden() {
  const [events,            setEvents]           = useState([]);
  const [inschrijvingen,    setInschrijvingen]   = useState([]);
  const [loading,           setLoading]          = useState(true);
  const [selected,          setSelected]         = useState(null);
  const [judokaZoek,        setJudokaZoek]       = useState('');
  const [toonVoorbijJudoka, setToonVoorbijJudoka]= useState(false);
  const [search,            setSearch]           = useState('');
  const [filterCat,         setFilterCat]        = useState('alle');
  const [filterMaandJaar,   setFilterMaandJaar]  = useState('alle');
  const [showImport,        setShowImport]       = useState(false);
  const [showMailImport,    setShowMailImport]   = useState(false);
  const [showNewForm,       setShowNewForm]      = useState(false);
  const [showJudokaPopup,   setShowJudokaPopup]  = useState(false);
  const [newForm,           setNewForm]          = useState({naam:'',datum:'',doelgroep:'',locatie:'',provincie:''});
  const [creating,          setCreating]         = useState(false);
  // Seizoen: startJaar als getal, bv. 2025 = seizoen 2025-2026
  const [seizoenStartJaar,  setSeizoenStartJaar] = useState(huidigSeizoenStartJaar());

  const { start, einde, label: seizoenLabel } = seizoenBereikVanJaar(seizoenStartJaar);

  // Events: eenmalig laden via getDocs
  const laadEvents = useCallback(async () => {
    setLoading(true);
    const q = query(
      collection(db, 'events'),
      where('datum', '>=', start),
      where('datum', '<=', einde),
      orderBy('datum')
    );
    try {
      const snap = await getDocs(q);
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.type === 'wedstrijd'));
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [start, einde]);

  useEffect(() => { laadEvents(); }, [laadEvents]);

  // Inschrijvingen: real-time
  useEffect(() => {
    const q = query(
      collection(db, 'inschrijvingen'),
      where('eventDatum', '>=', start),
      where('eventDatum', '<=', einde),
      orderBy('eventDatum')
    );
    return onSnapshot(q, snap => {
      setInschrijvingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [start, einde]);

  useEffect(() => {
    if (selected) {
      const updated = events.find(e => e.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [events]);

  // Reset maand/jaar filter bij seizoenswissel
  useEffect(() => { setFilterMaandJaar('alle'); }, [seizoenStartJaar]);

  // Afgeleide data
  const allCats = [...new Set(
    events.flatMap(e => (e.doelgroep||'').split(/[-\/]/).map(s=>s.trim()).filter(Boolean))
  )].sort();

  // Maand+jaar opties voor dropdown (enkel maanden die bestaan in geladen events)
  const maandJaarOpties = groeperOpMaand(events).map(g => ({
    value: `${g.jaar}-${g.maand}`,
    label: g.label,
  }));

  const insByEvent = inschrijvingen.reduce((acc, ins) => {
    if (!acc[ins.eventId]) acc[ins.eventId] = [];
    acc[ins.eventId].push(ins);
    return acc;
  }, {});

  const eventIdsMetJudoka = judokaZoek.trim()
    ? new Set(inschrijvingen
        .filter(i => i.judokaNaam?.toLowerCase().includes(judokaZoek.toLowerCase()))
        .map(i => i.eventId))
    : null;

  const gefilterd = events.filter(e => {
    if (eventIdsMetJudoka !== null && !eventIdsMetJudoka.has(e.id)) return false;
    const matchSearch = !search
      || e.naam?.toLowerCase().includes(search.toLowerCase())
      || e.locatie?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'alle' || (e.doelgroep||'').includes(filterCat);
    const matchMaand = filterMaandJaar === 'alle' || (() => {
      const d = new Date(e.datum);
      return `${d.getFullYear()}-${d.getMonth()}` === filterMaandJaar;
    })();
    return matchSearch && matchCat && matchMaand;
  });

  const komendeEvents = gefilterd.filter(e =>  isUpcoming(e.datum));
  const voorbijEvents = gefilterd.filter(e => !isUpcoming(e.datum));

  const komendeGroepen = groeperOpMaand(komendeEvents);
  const voorbijGroepen = groeperOpMaand(voorbijEvents).reverse();

  const totalJudoka = new Set(inschrijvingen.map(i => i.judokaNaam)).size;
  const totalInschrijvingen = inschrijvingen.length;

  async function handleCreate() {
    if (!newForm.naam.trim() || !newForm.datum) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, 'events'), {
        ...newForm, type: 'wedstrijd', createdAt: serverTimestamp(),
      });
      setShowNewForm(false);
      setNewForm({ naam:'', datum:'', doelgroep:'', locatie:'', provincie:'' });
      setSelected({ id: ref.id, ...newForm, type: 'wedstrijd' });
      await laadEvents();
    } catch (e) { console.error(e); }
    setCreating(false);
  }

  const inputStyle = {
    background:C.surface, border:`1px solid ${C.border}`,
    borderRadius:'8px', color:C.text, padding:'9px 12px',
    fontSize:'13px', fontFamily:'inherit', outline:'none',
  };
  const selectStyle = { ...inputStyle, cursor:'pointer' };

  return (
    <div style={{color:C.text,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",paddingBottom:'40px'}}>
{showJudokaPopup && (
        <JudokaOverviewPopup inschrijvingen={inschrijvingen} onClose={()=>setShowJudokaPopup(false)} />
      )}

      {/* ── Header ── */}
      <div style={{marginBottom:'20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'10px'}}>
          <div>
            <h1 style={{margin:0,fontSize:'22px',fontWeight:'800',letterSpacing:'-0.5px'}}>🏆 Wedstrijden</h1>
            <p style={{margin:'2px 0 0',fontSize:'12px',color:C.textSec}}>
              {seizoenLabel} · Kodokan Merchtem
            </p>
          </div>
          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',alignItems:'center'}}>
            {/* Seizoensdropdown — duidelijk welk seizoen actief is */}
            <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'11px',color:C.textSec,whiteSpace:'nowrap'}}>📅 Seizoen</span>
              <select
                value={seizoenStartJaar}
                onChange={e => setSeizoenStartJaar(Number(e.target.value))}
                style={{...selectStyle, fontWeight:'700', color: C.text, borderColor: C.red, padding:'7px 10px'}}
              >
                {beschikbareSeizoenStartJaren().map(j => (
                  <option key={j} value={j}>
                    {j}–{j+1}{j === huidigSeizoenStartJaar() ? ' (huidig)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <button style={{...btnStyle('ghost'),fontSize:'12px',padding:'8px 12px'}} onClick={laadEvents} disabled={loading}>
              🔄 {loading ? 'Laden…' : 'Vernieuwen'}
            </button>
            <button style={{...btnStyle('ghost'),fontSize:'12px',padding:'8px 12px'}} onClick={()=>{setShowImport(s=>!s);setShowMailImport(false);}}>
              📊 Excel
            </button>
            <button style={{...btnStyle('ghost'),fontSize:'12px',padding:'8px 12px'}} onClick={()=>{setShowMailImport(s=>!s);setShowImport(false);}}>
              📧 Mail
            </button>
            <button style={{...btnStyle('primary'),fontSize:'12px',padding:'8px 14px'}} onClick={()=>setShowNewForm(s=>!s)}>
              + Tornooi
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:'8px',marginTop:'14px',flexWrap:'wrap'}}>
          <button
            onClick={()=>setShowJudokaPopup(true)}
            style={{background:C.redDim,border:`1px solid ${C.redBord}`,borderRadius:'10px',padding:'10px 16px',display:'flex',alignItems:'center',gap:'10px',cursor:'pointer',fontFamily:'inherit',outline:'none'}}
          >
            <span style={{fontSize:'18px'}}>👥</span>
            <div style={{textAlign:'left'}}>
              <span style={{fontWeight:'900',fontSize:'22px',color:C.red,display:'block',lineHeight:1}}>{totalJudoka}</span>
              <span style={{fontSize:'10px',color:C.red,opacity:0.8}}>judoka's ↗</span>
            </div>
            <div style={{textAlign:'left',paddingLeft:'10px',borderLeft:`1px solid ${C.redBord}`}}>
              <span style={{fontWeight:'700',fontSize:'16px',color:C.red,display:'block',lineHeight:1}}>{totalInschrijvingen}</span>
              <span style={{fontSize:'10px',color:C.red,opacity:0.8}}>inschrijvingen</span>
            </div>
          </button>
          {[['🏆', events.length, 'tornooien'], ['📅', komendeEvents.length, 'komend']].map(([icon,val,lbl])=>(
            <div key={lbl} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'10px 14px',display:'flex',alignItems:'center',gap:'6px'}}>
              <span style={{fontSize:'14px'}}>{icon}</span>
              <span style={{fontWeight:'800',fontSize:'16px'}}>{val}</span>
              <span style={{fontSize:'11px',color:C.textSec}}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Import panelen ── */}
      {showImport && (
        <div style={{animation:'fadeIn 0.2s ease',marginBottom:'12px'}}>
          <ExcelImport onDone={()=>{setShowImport(false);laadEvents();}} />
        </div>
      )}
      {showMailImport && (
        <div style={{animation:'fadeIn 0.2s ease',marginBottom:'12px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px'}}>
          <MailImport events={events} onDone={()=>{setShowMailImport(false);laadEvents();}} />
        </div>
      )}

      {/* ── Nieuw tornooi ── */}
      {showNewForm && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'12px',padding:'16px',marginBottom:'16px',animation:'fadeIn 0.2s ease'}}>
          <div style={{fontWeight:'700',fontSize:'13px',marginBottom:'12px'}}>Nieuw tornooi</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'10px'}}>
            {[['naam','Naam tornooi','text','bv. Mansio Cup'],['datum','Datum','date',''],['doelgroep','Doelgroep','text','bv. U11-U13'],['locatie','Locatie','text','Sporthal…']].map(([key,lbl,type,ph])=>(
              <Field key={key} label={lbl}>
                <input style={{...inputStyle,width:'100%'}} type={type} placeholder={ph}
                  value={newForm[key]||''} onChange={e=>setNewForm(p=>({...p,[key]:e.target.value}))} />
              </Field>
            ))}
          </div>
          <div style={{display:'flex',gap:'8px',marginTop:'12px'}}>
            <button style={btnStyle('primary')} onClick={handleCreate} disabled={creating||!newForm.naam||!newForm.datum}>
              {creating?'Aanmaken…':'✓ Aanmaken'}
            </button>
            <button style={btnStyle('ghost')} onClick={()=>setShowNewForm(false)}>Annuleer</button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>

        {/* Judoka-zoek */}
        <div style={{position:'relative'}}>
          <input
            placeholder="👤 Zoek judoka — filtert tornooilijst…"
            value={judokaZoek}
            onChange={e=>setJudokaZoek(e.target.value)}
            style={{
              ...inputStyle, width:'100%',
              border:`2px solid ${judokaZoek ? C.red : C.border}`,
              borderRadius:'10px', padding:'11px 36px 11px 14px',
              transition:'border-color 0.15s',
            }}
          />
          {judokaZoek && (
            <button onClick={()=>setJudokaZoek('')} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:C.textSec,cursor:'pointer',fontSize:'16px',padding:'4px',lineHeight:1}}>✕</button>
          )}
        </div>

        {/* Judoka-resultaat + voorbije toggle */}
        {judokaZoek && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'6px',paddingLeft:'2px'}}>
            <span style={{fontSize:'12px',color:C.red}}>
              {eventIdsMetJudoka?.size||0} tornooi{eventIdsMetJudoka?.size!==1?'en':''} voor "{judokaZoek}"
              {!toonVoorbijJudoka && voorbijEvents.filter(e=>eventIdsMetJudoka?.has(e.id)).length > 0 && (
                <span style={{color:C.textMut}}> · {voorbijEvents.filter(e=>eventIdsMetJudoka?.has(e.id)).length} voorbije verborgen</span>
              )}
            </span>
            <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'12px',color:C.textSec}}>
              <input type="checkbox" checked={toonVoorbijJudoka} onChange={e=>setToonVoorbijJudoka(e.target.checked)}
                style={{accentColor:C.red,width:'14px',height:'14px',cursor:'pointer'}} />
              Toon voorbije tornooien
            </label>
          </div>
        )}

        {/* Naam/locatie + categorie + maand/jaar */}
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
          <input
            placeholder="🔍 Zoek tornooi of locatie…"
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{...inputStyle,flex:'1 1 160px',borderRadius:'8px',padding:'9px 13px'}}
          />
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={selectStyle}>
            <option value="alle">Alle categorieën</option>
            {allCats.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterMaandJaar} onChange={e=>setFilterMaandJaar(e.target.value)} style={selectStyle}>
            <option value="alle">Alle maanden</option>
            {maandJaarOpties.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Lijst + Detail ── */}
      <div style={{display:'grid',gridTemplateColumns:selected?'minmax(0,1fr) minmax(0,420px)':'1fr',gap:'20px',alignItems:'start'}}>
        <div>
          {loading ? (
            <div style={{color:C.textSec,textAlign:'center',padding:'60px'}}>Laden…</div>
          ) : gefilterd.length === 0 ? (
            <div style={{color:C.textMut,textAlign:'center',padding:'60px',fontSize:'14px'}}>
              {judokaZoek
                ? `Geen tornooien gevonden voor "${judokaZoek}".`
                : filterMaandJaar !== 'alle'
                  ? `Geen tornooien in ${maandJaarOpties.find(o=>o.value===filterMaandJaar)?.label||''}.`
                  : 'Geen tornooien gevonden.'}
              {events.length===0 && ' Importeer de kalender via Excel of controleer het geselecteerde seizoen.'}
            </div>
          ) : (
            <>
              {komendeEvents.length > 0 && (
                <Section label="Komende tornooien" count={komendeEvents.length}>
                  {komendeGroepen.map(({ label, items }) => (
                    <React.Fragment key={label}>
                      <MonthDivider label={label} />
                      {items.map(e => (
                        <TournamentCard key={e.id} event={e}
                          judokaCount={insByEvent[e.id]?.length||0}
                          isSelected={selected?.id===e.id}
                          onClick={()=>setSelected(selected?.id===e.id?null:e)} />
                      ))}
                    </React.Fragment>
                  ))}
                </Section>
              )}

              {voorbijEvents.length > 0 && (!judokaZoek || toonVoorbijJudoka) && (
                <Section label="Voorbije tornooien" count={voorbijEvents.length} muted collapsible defaultOpen={false}>
                  {voorbijGroepen.map(({ label, items }) => (
                    <React.Fragment key={label}>
                      <MonthDivider label={label} />
                      {items.map(e => (
                        <TournamentCard key={e.id} event={e}
                          judokaCount={insByEvent[e.id]?.length||0}
                          isSelected={selected?.id===e.id}
                          onClick={()=>setSelected(selected?.id===e.id?null:e)} />
                      ))}
                    </React.Fragment>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {selected && (
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
