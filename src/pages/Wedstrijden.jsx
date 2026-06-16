import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, onSnapshot, addDoc, getDocs,
  query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CLUB_NAAM_KORT } from '../config/appConfig';
import { C, MONTHS_NL, PROVINCES, getCatColor } from '../components/wedstrijden/tokens';
import { cardStyle, buttonStyle, badgeStyle, tabBarStyle, tabButtonStyle } from '../styles/tokens';
import { Section, MonthDivider, Field, btnStyle, isUpcoming, VeteranenSelector } from '../components/wedstrijden/SharedUI';
import { useCatRangorde, berekenCategorie, isVetCode } from '../utils/categorieLogica';
import { getMemberById } from '../services/firestoreService';
import JudokaTab from '../components/wedstrijden/JudokaTab';
import TournamentCard from '../components/wedstrijden/TournamentCard';
import DetailPanel from '../components/wedstrijden/DetailPanel';
import WedstrijdDetailPanel from '../components/details/WedstrijdDetailPanel';
import ExcelImport, { exportWedstrijden } from '../components/wedstrijden/ExcelImport';
import MailImport from '../components/wedstrijden/MailImport';
import { addKalenderTrigger } from '../services/firestoreService';
import {
  seizoenBereikVanJaar,
  huidigSeizoenStartJaar,
  beschikbareSeizoenStartJaren,
} from '../utils/seizoenUtils';
import { usePaginaTitelOverride } from '../contexts/PaginaTitelContext';

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
  usePaginaTitelOverride(detailId ? (selected?.naam || 'Tornooi') : null);
  // RBAC: leden mogen tornooien bekijken, maar enkel trainer+ mag aanmaken,
  // importeren en het kalenderoverzicht versturen (Firestore-rules dwingen dit
  // ook af; we verbergen de UI om verwarrende foutmeldingen te vermijden).
  const { isTrainer, profiel, configCache } = useAuth();
  const isLid = profiel?.rol === 'lid';
  const [mijnGeboortejaar, setMijnGeboortejaar] = useState(null);

  const [events,           setEvents]          = useState([]);
  const [inschrijvingen,   setInschrijvingen]  = useState([]);
  const [loading,          setLoading]         = useState(true);
  const [selected,         setSelected]        = useState(null);
  const [activeTab,        setActiveTab]       = useState('tornooien');
  const [search,           setSearch]          = useState('');
  const [filterCats,       setFilterCats]      = useState([]);
  const [filterMaandJaar,  setFilterMaandJaar] = useState('alle');
  const [showImport,       setShowImport]      = useState(false);
  const [showMailImport,   setShowMailImport]  = useState(false);
  const [showNewForm,      setShowNewForm]     = useState(false);
  const [showActiesMenu,   setShowActiesMenu]  = useState(false);
  const [showVoorbij,      setShowVoorbij]     = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [kalenderMeldingStatus, setKalenderMeldingStatus] = useState(null); // null | 'bezig' | 'ok' | 'fout'
  const filterDropdownRef = useRef(null);
  const [newForm,          setNewForm]         = useState({
    naam:'', datum:'', startuur:'', einduur:'',
    doelgroepCodes:[], locatie:'', adres:'', club:'', opmerking:'',
  });
  const [creating,         setCreating]        = useState(false);
  const [seizoenStartJaar, setSeizoenStartJaar]= useState(huidigSeizoenStartJaar());
  const alleCats = useCatRangorde();

  const { start, einde, label: seizoenLabel } = seizoenBereikVanJaar(seizoenStartJaar);

  // Haal geboortejaar op van het gekoppelde lid (voor leeftijdsfilter en categoriebepaling).
  useEffect(() => {
    if (!isLid || !profiel?.linkedMemberId) { setMijnGeboortejaar(null); return; }
    getMemberById(profiel.linkedMemberId).then(m => {
      if (m?.geboortedatum) setMijnGeboortejaar(new Date(m.geboortedatum).getFullYear());
    }).catch(() => {});
  }, [isLid, profiel?.linkedMemberId]);

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

  // Sluit filter-dropdown bij klik buiten
  useEffect(() => {
    if (!filterDropdownOpen) return;
    function handler(e) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterDropdownOpen]);

  // alleCats komt van useCatRangorde (Firestore, vaste volgorde)

  const maandJaarOpties = groeperOpMaand(events).map(g => ({
    value: `${g.jaar}-${g.maand}`,
    label: g.label,
  }));

  const insByEvent = inschrijvingen.filter(i => !i.deleted).reduce((acc, ins) => {
    if (!acc[ins.eventId]) acc[ins.eventId] = [];
    acc[ins.eventId].push(ins);
    return acc;
  }, {});

  // Set van eventIds waarvoor de ingelogde lid (of een beheerd kind) is ingeschreven.
  // Ouders zien ook de inschrijvingen van hun goedgekeurde beheerde kinderen.
  const mijnInschrijvingenEventIds = React.useMemo(() => {
    if (!isLid) return null;
    const mijnMemberId = profiel?.linkedMemberId;
    const beheerIds = new Set(Array.isArray(profiel?.beheerMemberIds) ? profiel.beheerMemberIds : []);
    return new Set(
      actieveInschrijvingen
        .filter(i =>
          (mijnMemberId && i.memberId === mijnMemberId) ||
          (profiel?.naam && i.judokaNaam === profiel.naam) ||
          (i.memberId && beheerIds.has(i.memberId))
        )
        .map(i => i.eventId)
    );
  }, [isLid, inschrijvingen, profiel?.linkedMemberId, profiel?.naam, profiel?.beheerMemberIds]);

  const gefilterd = events.filter(e => {
    const matchSearch = !search
      || e.naam?.toLowerCase().includes(search.toLowerCase())
      || e.locatie?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCats.length === 0
      || filterCats.some(fc =>
           (e.doelgroepCodes || []).includes(fc)
           || (e.doelgroep || '').includes(fc)
         );
    const matchMaand = filterMaandJaar === 'alle' || (() => {
      const d = new Date(e.datum);
      return `${d.getFullYear()}-${d.getMonth()}` === filterMaandJaar;
    })();
    // Leeftijdsfilter voor leden: toon enkel tornooien waarbij de lid in de doelgroep valt.
    // Tornooien zonder doelgroep zijn voor iedereen zichtbaar.
    const matchLeeftijd = (() => {
      if (!isLid || !mijnGeboortejaar) return true;
      const codes = e.doelgroepCodes?.length > 0 ? e.doelgroepCodes : null;
      if (!codes) return true; // geen doelgroep = voor iedereen
      const result = berekenCategorie(mijnGeboortejaar, e.datum, codes);
      return !result.buiten;
    })();
    return matchSearch && matchCat && matchMaand && matchLeeftijd;
  });

  const komendeEvents = gefilterd.filter(e =>  isUpcoming(e.datum));
  const voorbijEvents = gefilterd.filter(e => !isUpcoming(e.datum));
  const komendeGroepen = groeperOpMaand(komendeEvents);
  const voorbijGroepen = groeperOpMaand(voorbijEvents).reverse();

  const actieveInschrijvingen = inschrijvingen.filter(i => !i.deleted);
  const totalJudoka = new Set(actieveInschrijvingen.map(i => i.judokaNaam)).size;
  const filtersActief = search || filterCats.length > 0 || filterMaandJaar !== 'alle';
  // Voorbije tornooien tonen: altijd als er gezocht wordt, anders via toggle
  const toonVoorbije = !!search || showVoorbij;

  function resetFilters() {
    setSearch('');
    setFilterCats([]);
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
      const doelgroepStr = (newForm.doelgroepCodes || []).join('-');
      const ref = await addDoc(collection(db, 'events'), {
        ...newForm,
        doelgroep: doelgroepStr,
        type: 'wedstrijd',
        createdAt: serverTimestamp(),
      });
      setShowNewForm(false);
      setNewForm({ naam:'', datum:'', startuur:'', einduur:'', doelgroepCodes:[], locatie:'', adres:'', club:'', opmerking:'' });
      setSelected({ id: ref.id, ...newForm, doelgroep: doelgroepStr, type: 'wedstrijd' });
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
    <div>

      {/* ── Header ── */}
      <div style={{marginBottom:'16px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:'10px'}}>
          <div>
            <h1 style={{margin:0,fontSize:'22px',fontWeight:'800',letterSpacing:'-0.5px'}}>🏆 Wedstrijden</h1>
            <p style={{margin:'2px 0 0',fontSize:'12px',color:C.textSec}}>
              {seizoenLabel} · {configCache?.clubSettings?.naamKort || CLUB_NAAM_KORT}
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

            {/* Acties dropdown — enkel voor trainer+ (aanmaken/importeren) */}
            {isTrainer && (
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
                    ['📥 Exporteren (.xlsx)', () => { exportWedstrijden(events, inschrijvingen, seizoenLabel); setShowActiesMenu(false); }],
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
                      onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                      {lbl}
                    </button>
                  ))}
                  {/* Kalenderoverzicht-knop — apart van de lijst wegens eigen state */}
                  <button
                    disabled={kalenderMeldingStatus === 'bezig' || kalenderMeldingStatus === 'ok'}
                    onClick={async () => {
                      setKalenderMeldingStatus('bezig');
                      setShowActiesMenu(false);
                      try {
                        const bereik = seizoenBereikVanJaar(seizoenStartJaar);
                        await addKalenderTrigger({
                          seizoen: `${seizoenStartJaar}-${seizoenStartJaar + 1}`,
                          seizoenLabel: bereik.label,
                          toegevoegd: [],
                          bijgewerkt: [],
                          verwijderd: [],
                        });
                        setKalenderMeldingStatus('ok');
                        setTimeout(() => setKalenderMeldingStatus(null), 5000);
                      } catch(e) {
                        console.error(e);
                        setKalenderMeldingStatus('fout');
                        setTimeout(() => setKalenderMeldingStatus(null), 5000);
                      }
                    }}
                    style={{
                      width:'100%', background:'none', border:'none',
                      borderTop: `1px solid ${C.border}`,
                      color: kalenderMeldingStatus === 'ok' ? C.green : kalenderMeldingStatus === 'fout' ? C.red : C.text,
                      padding:'11px 16px', cursor: kalenderMeldingStatus === 'bezig' ? 'not-allowed' : 'pointer',
                      fontFamily:'inherit', fontSize:'13px', textAlign:'left', display:'block',
                      opacity: kalenderMeldingStatus === 'bezig' ? 0.6 : 1,
                    }}
                    onMouseEnter={e => { if (!kalenderMeldingStatus) e.currentTarget.style.background = C.cardHover; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    {kalenderMeldingStatus === 'bezig' && '⏳ Melding versturen...'}
                    {kalenderMeldingStatus === 'ok'    && '✓ Kalenderoverzicht verzonden'}
                    {kalenderMeldingStatus === 'fout'  && '❌ Mislukt — probeer opnieuw'}
                    {!kalenderMeldingStatus            && '📣 Stuur kalenderoverzicht'}
                  </button>
                </div>
              )}
            </div>
            )}
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
          <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
            <Field label="Naam tornooi *">
              <input style={{...inputStyle,width:'100%'}} placeholder="bv. Mansio Cup"
                value={newForm.naam} onChange={e=>setNewForm(p=>({...p,naam:e.target.value}))} />
            </Field>
            <Field label="Datum *">
              <input style={{...inputStyle,width:'100%'}} type="date"
                value={newForm.datum} onChange={e=>setNewForm(p=>({...p,datum:e.target.value}))} />
            </Field>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              <Field label="Startuur">
                <input style={{...inputStyle,width:'100%'}} placeholder="08:00"
                  value={newForm.startuur} onChange={e=>setNewForm(p=>({...p,startuur:e.target.value}))} />
              </Field>
              <Field label="Einduur">
                <input style={{...inputStyle,width:'100%'}} placeholder="17:00"
                  value={newForm.einduur} onChange={e=>setNewForm(p=>({...p,einduur:e.target.value}))} />
              </Field>
            </div>
            <Field label="Doelgroep — categorieën">
              <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                {alleCats.filter(code => !isVetCode(code)).map(code => {
                  const cc = getCatColor(code, configCache?.categorieen);
                  const checked = (newForm.doelgroepCodes || []).includes(code);
                  return (
                    <label key={code} style={{
                      display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',
                      background: checked ? cc.bg : C.surface,
                      border: `1px solid ${checked ? cc.border : C.border}`,
                      borderRadius:'8px', padding:'6px 10px',
                      color: checked ? cc.color : C.textSec, fontSize:'13px', fontWeight:'700',
                      transition:'all 0.12s',
                    }}>
                      <input type="checkbox" style={{display:'none'}} checked={checked}
                        onChange={e => {
                          const prev = newForm.doelgroepCodes || [];
                          setNewForm(p => ({...p, doelgroepCodes: e.target.checked
                            ? [...prev, code]
                            : prev.filter(c => c !== code)
                          }));
                        }}
                      />
                      {code}
                    </label>
                  );
                })}
                <VeteranenSelector
                  doelgroepCodes={newForm.doelgroepCodes || []}
                  onChange={codes => setNewForm(p => ({ ...p, doelgroepCodes: codes }))}
                />
              </div>
            </Field>
            <Field label="Locatie">
              <input style={{...inputStyle,width:'100%'}} placeholder="Sporthal…"
                value={newForm.locatie} onChange={e=>setNewForm(p=>({...p,locatie:e.target.value}))} />
            </Field>
            <Field label="Adres">
              <input style={{...inputStyle,width:'100%'}} placeholder="Straat 1, 1000 Stad"
                value={newForm.adres} onChange={e=>setNewForm(p=>({...p,adres:e.target.value}))} />
            </Field>
            <Field label="Organiserende club">
              <input style={{...inputStyle,width:'100%'}} placeholder="bv. JC Mansio"
                value={newForm.club} onChange={e=>setNewForm(p=>({...p,club:e.target.value}))} />
            </Field>
            <Field label="Opmerking">
              <textarea style={{...inputStyle,width:'100%',minHeight:'60px',resize:'vertical'}}
                placeholder="Extra info voor coaches of judoka's…"
                value={newForm.opmerking} onChange={e=>setNewForm(p=>({...p,opmerking:e.target.value}))} />
            </Field>
          </div>
          <div style={{display:'flex',gap:'8px',marginTop:'14px'}}>
            <button style={btnStyle('primary')} onClick={handleCreate} disabled={creating||!newForm.naam||!newForm.datum}>
              {creating?'Aanmaken…':'✓ Aanmaken'}
            </button>
            <button style={btnStyle('ghost')} onClick={()=>setShowNewForm(false)}>Annuleer</button>
          </div>
        </div>
      )}

      {/* ── Tab-balk — Judoka's tab enkel voor trainer+ ── */}
      <div style={{...tabBarStyle, marginBottom:'20px'}}>
        <button
          style={{...tabButtonStyle(activeTab==='tornooien'), fontFamily:'inherit'}}
          onClick={() => setActiveTab('tornooien')}
        >
          📅 Tornooien ({gefilterd.length})
        </button>
        {!isLid && (
          <button
            style={{...tabButtonStyle(activeTab==='judokas'), fontFamily:'inherit'}}
            onClick={() => setActiveTab('judokas')}
          >
            👥 Judoka's ({totalJudoka})
          </button>
        )}
      </div>

      {/* ── Tab: Tornooien ── */}
      {activeTab === 'tornooien' && (
        <>
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
            {/* Multi-select categorie filter */}
            <div ref={filterDropdownRef} style={{position:'relative'}}>
              <button
                onClick={() => setFilterDropdownOpen(o => !o)}
                style={{
                  ...selectStyle,
                  minWidth:'160px',
                  border:`1px solid ${filterCats.length > 0 ? C.red : C.border}`,
                  color: filterCats.length > 0 ? C.text : C.textSec,
                  display:'flex',alignItems:'center',justifyContent:'space-between',gap:'6px',
                }}
              >
                <span>
                  {filterCats.length === 0
                    ? 'Alle categorieën'
                    : filterCats.length === 1
                      ? filterCats[0]
                      : `${filterCats.join(', ')} (${filterCats.length})`}
                </span>
                <span style={{fontSize:'10px',opacity:0.6}}>{filterDropdownOpen ? '▲' : '▼'}</span>
              </button>
              {filterDropdownOpen && (
                <div style={{
                  position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:100,
                  background:C.card,border:`1px solid ${C.border}`,borderRadius:'10px',
                  minWidth:'160px',boxShadow:'0 8px 24px rgba(0,0,0,0.35)',overflow:'hidden',padding:'6px',
                }}>
                  {alleCats.filter(code => !isVetCode(code)).map(code => {
                    const cc = getCatColor(code, configCache?.categorieen);
                    const checked = filterCats.includes(code);
                    return (
                      <label key={code} style={{
                        display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',
                        padding:'7px 10px',borderRadius:'7px',
                        background: checked ? cc.bg : 'transparent',
                        color: checked ? cc.color : C.text,
                        fontSize:'13px',fontWeight: checked ? '700' : '400',
                        transition:'background 0.1s',
                      }}>
                        <input type="checkbox" style={{accentColor:C.red,width:'14px',height:'14px'}}
                          checked={checked}
                          onChange={e => setFilterCats(prev =>
                            e.target.checked ? [...prev, code] : prev.filter(c => c !== code)
                          )}
                        />
                        {code}
                      </label>
                    );
                  })}
                  {filterCats.length > 0 && (
                    <button
                      onClick={() => { setFilterCats([]); setFilterDropdownOpen(false); }}
                      style={{
                        width:'100%',marginTop:'4px',padding:'6px',background:'none',
                        border:`1px solid ${C.border}`,borderRadius:'6px',
                        color:C.textMuted,fontSize:'11px',cursor:'pointer',fontFamily:'inherit',
                      }}
                    >
                      ✕ Wis selectie
                    </button>
                  )}
                </div>
              )}
            </div>
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

          {/* Lijst */}
          <div>
            {loading ? (
              <div style={{color:C.textSec,textAlign:'center',padding:'60px'}}>Laden…</div>
            ) : gefilterd.length === 0 ? (
              <div style={{color:C.textMuted,textAlign:'center',padding:'60px',fontSize:'14px'}}>
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
                            ikBenIngeschreven={mijnInschrijvingenEventIds?.has(e.id) ?? false}
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
                              ikBenIngeschreven={mijnInschrijvingenEventIds?.has(e.id) ?? false}
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
                        borderRadius:'10px',color:C.textMuted,padding:'14px',
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

          {/* Detail overlay — fixed rechts, ongeacht scrollpositie */}
          {selected && (
            <>
              <div
                style={{position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(2px)'}}
                onClick={()=>setSelected(null)}
              />
              <div style={{
                position:'fixed',top:'16px',right:'16px',bottom:'16px',zIndex:401,
                width:'min(440px,calc(100vw - 32px))',
                display:'flex',flexDirection:'column',
                animation:'fadeIn 0.2s ease',
              }}>
                <DetailPanel
                  event={selected}
                  inschrijvingenVoorEvent={insByEvent[selected.id]||[]}
                  allInschrijvingen={inschrijvingen}
                  onClose={()=>setSelected(null)}
                  onUpdate={handleEventUpdate}
                  onDelete={()=>setSelected(null)}
                />
              </div>
            </>
          )}
        </>
      )}

      {/* ── Tab: Judoka's ── */}
      {activeTab === 'judokas' && (
        <JudokaTab
          inschrijvingen={actieveInschrijvingen}
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
