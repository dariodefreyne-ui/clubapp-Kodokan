import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, onSnapshot, addDoc, getDocs,
  query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../firebase';
import { C, MONTHS_NL, PROVINCES } from '../components/wedstrijden/tokens';
import { cardStyle, buttonStyle, badgeStyle, tabBarStyle, tabButtonStyle } from '../styles/tokens';
import { Section, MonthDivider, Field, btnStyle, isUpcoming } from '../components/wedstrijden/SharedUI';
import JudokaTab from '../components/wedstrijden/JudokaTab';
import TournamentCard from '../components/wedstrijden/TournamentCard';
import DetailPanel from '../components/wedstrijden/DetailPanel';
import WedstrijdDetailPanel from '../components/details/WedstrijdDetailPanel';
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
  const { id: detailId } = useParams();
  const navigate = useNavigate();
  const actiesRef = useRef(null);

  const [events,           setEvents]          = useState([]);
  const [inschrijvingen,   setInschrijvingen]  = useState([]);
  const [loading,          setLoading]         = useState(true);
  const [selected,         setSelected]        = useState(null);
  const [activeTab,        setActiveTab]       = useState('tornooien');
  const [search,           setSearch]          = useState('');
  const [filterCat,        setFilterCat]       = useState('alle');
  const [filterMaandJaar,  setFilterMaandJaar] = useState('alle');
  const [showImport,       setShowImport]      = useState(false);
  const [showMailImport,   setShowMailImport]  = useState(false);
  const [showNewForm,      setShowNewForm]     = useState(false);
  const [showActiesMenu,   setShowActiesMenu]  = useState(false);
  const [showVoorbij,      setShowVoorbij]     = useState(false);
  const [newForm,          setNewForm]         = useState({naam:'',datum:'',tijdstip:'',doelgroep:'',locatie:''});
  const [creating,         setCreating]        = useState(false);
  const [seizoenStartJaar, setSeizoenStartJaar]= useState(huidigSeizoenStartJaar());

  const { start, einde, label: seizoenLabel } = seizoenBereikVanJaar(seizoenStartJaar);

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

  // Wordt opgeroepen vanuit DetailPanel na elke opslag (info én begeleiders)
  const handleEventUpdate = useCallback((updated) => {
    setSelected(updated);
    // Vervang het event in de lijst zodat de parent ook de laatste data heeft
    setEvents(prev => prev.map(e => e.id === updated.id ? { ...e, ...updated } : e));
    // Herlaad van Firestore om zeker te zijn (begeleiders worden op het event opgeslagen)
    laadEvents();
  }, [laadEvents]);

  useEffect(() => { setFilterMaandJaar('alle'); setShowVoorbij(false); }, [seizoenStartJaar]);

  // Sluit acties-menu bij klik buiten
  useEffect(() => {
    if (!showActiesMenu) return;
    function handler(e) {
      if (actiesRef.current && !actiesRef.current.contains(e.target)) {
        setShowActiesMenu(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showActiesMenu]);

  const allCats = [...new Set(
    events.flatMap(e => (e.doelgroep||'').split(/[-\/]/).map(s=>s.trim()).filter(Boolean))
  )].sort();

  const maandJaarOpties = groeperOpMaand(events).map(g => ({
    value: `${g.jaar}-${g.maand}`,
    label: g.label,
  }));

  const insByEvent = inschrijvingen.reduce((acc, ins) => {
    if (!acc[ins.eventId]) acc[ins.eventId] = [];
    acc[ins.eventId].push(ins);
    return acc;
  }, {});

  const gefilterd = events.filter(e => {
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
  const filtersActief = search || filterCat !== 'alle' || filterMaandJaar !== 'alle';
  // Voorbije tornooien tonen: altijd als er gezocht wordt, anders via toggle
  const toonVoorbije = !!search || showVoorbij;

  function resetFilters() {
    setSearch('');
    setFilterCat('alle');
    setFilterMaandJaar('alle');
  }

  function openTornooi(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    setSelected(event);
    setActiveTab('tornooien');
    if (!isUpcoming(event.datum)) setShowVoorbij(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleCreate() {
    if (!newForm.naam.trim() || !newForm.datum) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, 'events'), {
        ...newForm, type: 'wedstrijd', createdAt: serverTimestamp(),
      });
      setShowNewForm(false);
      setNewForm({ naam:'', datum:'', tijdstip:'', doelgroep:'', locatie:'' });
      setSelected({ id: ref.id, ...newForm, type: 'wedstrijd' });
      await laadEvents();
    } catch (e) { console.error(e); }
    setCreating(false);
  }

  const inputStyle = {
    background: C.surface, border: `1px solid ${C.border}`,
    borderRadius: '8px', color: C.text, padding: '9px 12px',
    fontSize: '13px', fontFamily: 'inherit', outline: 'none',
  };
  const selectStyle = { ...inputStyle, cursor: 'pointer' };

  const chipStyle = {
    fontSize: '12px', color: C.textSec, background: C.card,
    border: `1px solid ${C.border}`, borderRadius: '20px', padding: '5px 12px',
    whiteSpace: 'nowrap',
  };

  return (
    <div style={{color:C.text,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",paddingBottom:'40px'}}>

      {/* ── Header ── */}
      <div style={{marginBottom:'16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'10px'}}>
          <div>
            <h1 style={{margin:0,fontSize:'22px',fontWeight:'800',letterSpacing:'-0.5px'}}>🏆 Wedstrijden</h1>
            <p style={{margin:'2px 0 0',fontSize:'12px',color:C.textSec}}>
              {seizoenLabel} · Kodokan Merchtem
            </p>
          </div>

          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            {/* Stats chips */}
            <span style={chipStyle}>👥 <strong style={{color:C.text}}>{totalJudoka}</strong> judoka's</span>
            <span style={chipStyle}>🏆 <strong style={{color:C.text}}>{events.length}</strong> tornooien</span>
            <span style={chipStyle}>📅 <strong style={{color:C.text}}>{komendeEvents.length}</strong> komend</span>

            {/* Seizoenselector */}
            <select
              value={seizoenStartJaar}
              onChange={e => setSeizoenStartJaar(Number(e.target.value))}
              style={{...selectStyle,fontWeight:'700',borderColor:C.red,padding:'7px 10px',fontSize:'12px'}}
            >
              {beschikbareSeizoenStartJaren().map(j => (
                <option key={j} value={j}>
                  {j}–{j+1}{j === huidigSeizoenStartJaar() ? ' (huidig)' : ''}
                </option>
              ))}
            </select>

            {/* Acties dropdown */}
            <div ref={actiesRef} style={{position:'relative'}}>
              <button
                style={{...btnStyle('ghost'),fontSize:'12px',padding:'8px 12px'}}
                onClick={() => setShowActiesMenu(s => !s)}
              >
                Acties {showActiesMenu ? '▲' : '▼'}
              </button>
              {showActiesMenu && (
                <div style={{
                  position:'absolute',right:0,top:'calc(100% + 4px)',zIndex:200,
                  background:C.card,border:`1px solid ${C.border}`,borderRadius:'10px',
                  minWidth:'190px',boxShadow:'0 8px 24px rgba(0,0,0,0.35)',overflow:'hidden',
                }}>
                  {[
                    ['+ Nieuw tornooi',    () => { setShowNewForm(s=>!s); setShowImport(false); setShowMailImport(false); setShowActiesMenu(false); }],
                    ['📊 Excel importeren', () => { setShowImport(s=>!s); setShowMailImport(false); setShowActiesMenu(false); }],
                    ['📧 Mail importeren',  () => { setShowMailImport(s=>!s); setShowImport(false); setShowActiesMenu(false); }],
                    ['🔄 Vernieuwen',       () => { laadEvents(); setShowActiesMenu(false); }],
                  ].map(([lbl, fn], idx, arr) => (
                    <button
                      key={lbl}
                      onClick={fn}
                      style={{
                        width:'100%',background:'none',
                        border:'none',
                        borderBottom: idx < arr.length - 1 ? `1px solid ${C.border}` : 'none',
                        color:C.text,padding:'11px 16px',cursor:'pointer',
                        fontFamily:'inherit',fontSize:'13px',textAlign:'left',display:'block',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = C.cardHov}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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
            {[['naam','Naam tornooi','text','bv. Mansio Cup'],['datum','Datum','date',''],['tijdstip','Tijdstip','time',''],['doelgroep','Doelgroep','text','bv. U11-U13'],['locatie','Locatie','text','Sporthal…']].map(([key,lbl,type,ph])=>(
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

      {/* ── Tab-balk ── */}
      <div style={{...tabBarStyle, marginBottom:'20px'}}>
        <button
          style={{...tabButtonStyle(activeTab==='tornooien'), fontFamily:'inherit'}}
          onClick={() => setActiveTab('tornooien')}
        >
          📅 Tornooien ({events.length})
        </button>
        <button
          style={{...tabButtonStyle(activeTab==='judokas'), fontFamily:'inherit'}}
          onClick={() => setActiveTab('judokas')}
        >
          👥 Judoka's ({totalJudoka})
        </button>
      </div>

      {/* ── Tab: Tornooien ── */}
      {activeTab === 'tornooien' && (
        <>
          {/* Filterbalk */}
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center',marginBottom:'16px'}}>
            <input
              placeholder="🔍 Zoek tornooi of locatie…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                ...inputStyle, flex:'1 1 160px', padding:'9px 13px',
                border:`1px solid ${search ? C.red : C.border}`,
                transition:'border-color 0.15s',
              }}
            />
            <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={selectStyle}>
              <option value="alle">Alle categorieën</option>
              {allCats.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <select value={filterMaandJaar} onChange={e=>setFilterMaandJaar(e.target.value)} style={selectStyle}>
              <option value="alle">Alle maanden</option>
              {maandJaarOpties.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {filtersActief && (
              <button onClick={resetFilters} style={{...btnStyle('subtle'),fontSize:'12px',padding:'8px 12px',whiteSpace:'nowrap'}}>
                ✕ Filters wissen
              </button>
            )}
          </div>

          {/* Lijst + DetailPanel */}
          <div style={{display:'grid',gridTemplateColumns:selected?'minmax(0,1fr) minmax(0,420px)':'1fr',gap:'20px',alignItems:'start'}}>
            <div>
              {loading ? (
                <div style={{color:C.textSec,textAlign:'center',padding:'60px'}}>Laden…</div>
              ) : gefilterd.length === 0 ? (
                <div style={{color:C.textMut,textAlign:'center',padding:'60px',fontSize:'14px'}}>
                  {filterMaandJaar !== 'alle'
                    ? `Geen tornooien in ${maandJaarOpties.find(o=>o.value===filterMaandJaar)?.label||''}.`
                    : search
                      ? `Geen tornooien gevonden voor "${search}".`
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

                  {voorbijEvents.length > 0 && (
                    toonVoorbije ? (
                      <Section
                        label="Voorbije tornooien"
                        count={voorbijEvents.length}
                        muted
                        collapsible={!search}
                        defaultOpen={true}
                      >
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
                    ) : (
                      <button
                        onClick={() => setShowVoorbij(true)}
                        style={{
                          width:'100%',background:'none',border:`1px dashed ${C.border}`,
                          borderRadius:'10px',color:C.textMut,padding:'14px',
                          cursor:'pointer',fontFamily:'inherit',fontSize:'13px',textAlign:'center',
                        }}
                      >
                        Toon {voorbijEvents.length} voorbije tornooien ▼
                      </button>
                    )
                  )}
                </>
              )}
            </div>

            {selected && (
              <div style={{position:'sticky',top:'16px',maxHeight:'85vh',display:'flex',flexDirection:'column',animation:'fadeIn 0.2s ease'}}>
                <DetailPanel
                  event={selected}
                  inschrijvingenVoorEvent={insByEvent[selected.id]||[]}
                  allInschrijvingen={inschrijvingen}
                  onClose={()=>setSelected(null)}
                  onUpdate={handleEventUpdate}
                  onDelete={()=>setSelected(null)}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Tab: Judoka's ── */}
      {activeTab === 'judokas' && (
        <JudokaTab
          inschrijvingen={inschrijvingen}
          onOpenTornooi={openTornooi}
        />
      )}

      {detailId && (
        <WedstrijdDetailPanel
          eventId={detailId}
          onClose={() => navigate('/wedstrijden')}
        />
      )}
    </div>
  );
}
