/**
 * Wedstrijden.jsx – Wedstrijdmodule voor Kodokan Clubapp
 *
 * v5 – Flat inschrijvingen collectie:
 *  - Subcollectie events/{id}/judoka volledig vervangen door
 *    flat collectie `inschrijvingen` met één realtime listener
 *  - Judoka zoekbalk bovenaan → filtert tornooilijst
 *  - Teller "judoka ingeschreven" klikbaar → popup met
 *    alle judoka's A→Z + per judoka welke tornooien
 *  - DetailPanel judoka-tab leest/schrijft via inschrijvingen collectie
 *
 * Datamodel inschrijvingen/{autoId}:
 *   eventId      string
 *   eventNaam    string
 *   eventDatum   string  (YYYY-MM-DD)
 *   judokaNaam   string
 *   geboortejaar number | null
 *   categorie    string
 *   viaMailImport bool (optioneel)
 *   addedAt      timestamp
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, getDocs, writeBatch, where
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

// ─── Categorie-logica ─────────────────────────────────────────────────────────
function berekenRuweCategorie(geboortejaar, tornooidatum) {
  if (!geboortejaar || !tornooidatum) return null;
  const jaar = new Date(tornooidatum).getFullYear();
  const leeftijd = jaar - parseInt(geboortejaar);
  if (leeftijd <= 6)   return null;
  if (leeftijd <= 8)   return 'U9';
  if (leeftijd <= 10)  return 'U11';
  if (leeftijd <= 12)  return 'U13';
  if (leeftijd === 13) return 'U14';
  if (leeftijd === 14) return 'U15';
  if (leeftijd === 15) return 'U16';
  if (leeftijd <= 17)  return 'U18';
  return 'U21+';
}

const CAT_RANGORDE = ['U9','U11','U13','U14','U15','U16','U18','U21+'];

function parseerToegelatenCategorieen(doelgroep) {
  if (!doelgroep) return null;
  const d = doelgroep.toUpperCase().replace(/\s/g, '');
  if (d.includes('ALLE') || d === '') return [...CAT_RANGORDE];
  const toegelaten = new Set();
  for (const cat of CAT_RANGORDE) {
    const escaped = cat.replace('+', '\\+');
    if (new RegExp(`(^|[^0-9])${escaped}([^0-9+]|$)`).test(d)) toegelaten.add(cat);
  }
  if (/U15[+]/.test(d) || /U15-U21/.test(d) || /U15-U18-U21/.test(d))
    ['U15','U18','U21+'].forEach(c => toegelaten.add(c));
  if (/U18[+]/.test(d) || /U18-U21/.test(d))
    ['U18','U21+'].forEach(c => toegelaten.add(c));
  if (toegelaten.size === 0) return [...CAT_RANGORDE];
  return [...toegelaten];
}

function berekenCategorie(geboortejaar, tornooidatum, doelgroep = null) {
  const ruw = berekenRuweCategorie(geboortejaar, tornooidatum);
  if (!ruw) return { cat: '—', buiten: false };
  const toegelaten = parseerToegelatenCategorieen(doelgroep);
  if (!toegelaten) return { cat: ruw, buiten: false };
  if (toegelaten.includes(ruw)) return { cat: ruw, buiten: false };
  const rawIdx = CAT_RANGORDE.indexOf(ruw);
  for (let i = rawIdx; i < CAT_RANGORDE.length; i++)
    if (toegelaten.includes(CAT_RANGORDE[i])) return { cat: CAT_RANGORDE[i], buiten: false };
  for (let i = rawIdx - 1; i >= 0; i--)
    if (toegelaten.includes(CAT_RANGORDE[i])) return { cat: CAT_RANGORDE[i], buiten: true };
  return { cat: ruw, buiten: true };
}

// ─── Mail parser ──────────────────────────────────────────────────────────────
const MAANDEN_NL = {
  januari:1,februari:2,maart:3,april:4,mei:5,juni:6,
  juli:7,augustus:8,september:9,oktober:10,november:11,december:12,
};
const MAAND_RE_STR = Object.keys(MAANDEN_NL).join('|');

function parseerMailTekst(mailTekst) {
  if (!mailTekst) return { naamJudoka: '', inschrijvingen: [] };
  const huidigJaar = new Date().getFullYear();

  let naamJudoka = '';
  const naamMatch = mailTekst.match(/voornaam\s+en\s+naam\s+judoka(.+?)(?:e-?mailadres|@|\d{6,})/i);
  if (naamMatch) naamJudoka = naamMatch[1].trim();

  const footerIdx = mailTekst.search(/gewicht\s*\(|uitschrijven\s+voor/i);
  const relevantTekst = footerIdx > -1 ? mailTekst.slice(0, footerIdx) : mailTekst;

  const grenzenRe = new RegExp(`-\\s*\\d{1,2}\\s+(?:${MAAND_RE_STR})(?:\\s+\\d{4})?(?:Ja)?`, 'gi');
  const grenzen = [];
  let gm;
  while ((gm = grenzenRe.exec(relevantTekst)) !== null)
    grenzen.push({ index: gm.index, match: gm[0] });

  const inschrijvingen = [];
  for (let i = 0; i < grenzen.length; i++) {
    const grens = grenzen[i];
    const vorigeEinde = i === 0 ? 0 : grenzen[i-1].index + grenzen[i-1].match.length;
    const tornooiNaamRaw = relevantTekst.slice(vorigeEinde, grens.index).trim();

    const datumRe = new RegExp(`-\\s*(\\d{1,2})\\s+(${MAAND_RE_STR})(?:\\s+(\\d{4}))?`, 'i');
    const datumMatch = grens.match.match(datumRe);
    if (!datumMatch) continue;

    const dag   = parseInt(datumMatch[1]);
    const maand = MAANDEN_NL[datumMatch[2].toLowerCase()];
    const jaar  = datumMatch[3] ? parseInt(datumMatch[3]) : huidigJaar;
    if (!maand) continue;

    const heeftJa = /Ja$/i.test(grens.match.trim());
    if (!tornooiNaamRaw || tornooiNaamRaw.length < 3) continue;
    if (/^(e-?mailadres|voornaam|naam\s+judoka)/i.test(tornooiNaamRaw)) continue;
    if (tornooiNaamRaw.includes('@')) continue;

    const datum = new Date(jaar, maand - 1, dag).toISOString().slice(0, 10);
    const label = `${tornooiNaamRaw} - ${dag} ${datumMatch[2]}${datumMatch[3] ? ` ${jaar}` : ''}`;
    inschrijvingen.push({ label, tornooiNaam: tornooiNaamRaw, datum, ingeschreven: heeftJa });
  }

  return { naamJudoka, inschrijvingen };
}

function fuzzyMatch(haystack, needle) {
  if (!haystack || !needle) return false;
  const h = haystack.toLowerCase();
  const stop = new Set(['cup','van','de','het','voor','over','en','op','in','bij']);
  const woorden = needle.toLowerCase().replace(/[()[\]/]/g,' ').split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w));
  if (woorden.length === 0) return false;
  return woorden.filter(w => h.includes(w)).length >= Math.min(2, woorden.length);
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:'#111111', surface:'#1c1c1e', card:'#242428', cardHov:'#2a2a2f',
  border:'#2e2e35', red:'#e63946', redDim:'rgba(230,57,70,0.12)',
  redBord:'rgba(230,57,70,0.35)', text:'#f8f8f8', textSec:'#9999aa',
  textMut:'#555566', green:'#22c55e', amber:'#f59e0b', blue:'#3b82f6',
};

const CATEGORIE_COLORS = {
  'U9':  {bg:'#fef3c7',color:'#92400e',border:'#fde68a'},
  'U11': {bg:'#d1fae5',color:'#065f46',border:'#6ee7b7'},
  'U13': {bg:'#dbeafe',color:'#1e40af',border:'#93c5fd'},
  'U14': {bg:'#e0f2fe',color:'#075985',border:'#7dd3fc'},
  'U15': {bg:'#ede9fe',color:'#5b21b6',border:'#c4b5fd'},
  'U16': {bg:'#fce7f3',color:'#9d174d',border:'#f9a8d4'},
  'U18': {bg:'#fee2e2',color:'#991b1b',border:'#fca5a5'},
  'U21+':{bg:'#f1f5f9',color:'#334155',border:'#cbd5e1'},
};

const PROVINCES = ['ANT','LIM','OVL','WVL','VBR','JV','—'];
const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-BE', {weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-BE', {day:'numeric',month:'short'});
}
function isUpcoming(d) { return d && new Date(d) >= new Date(new Date().setHours(0,0,0,0)); }
function isSoonish(d) {
  if (!d) return false;
  const diff = new Date(d) - new Date();
  return diff > 0 && diff < 1000*60*60*24*14;
}

// ─── Kleine componenten ───────────────────────────────────────────────────────
function Badge({ label, style={} }) {
  return <span style={{display:'inline-block',padding:'2px 9px',borderRadius:'999px',fontSize:'11px',fontWeight:'700',letterSpacing:'0.4px',...style}}>{label}</span>;
}
function DoelgroepBadges({ doelgroep }) {
  if (!doelgroep) return null;
  const unique = [...new Set(doelgroep.split(/[-\/]/).map(s=>s.trim()).filter(Boolean))];
  return (
    <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
      {unique.map(cat => {
        const c = CATEGORIE_COLORS[cat] || {bg:C.card,color:C.textSec,border:C.border};
        return <Badge key={cat} label={cat} style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}} />;
      })}
    </div>
  );
}
function btnStyle(v='primary') {
  const base = {border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'600',padding:'10px 16px',fontFamily:'inherit',transition:'background 0.15s'};
  if (v==='primary') return {...base,background:C.red,color:'#fff'};
  if (v==='danger')  return {...base,background:'#e74c3c',color:'#fff'};
  if (v==='ghost')   return {...base,background:C.surface,border:`1px solid ${C.border}`,color:C.textSec};
  return base;
}
function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'9px 0',borderBottom:`1px solid ${C.border}`,gap:'12px'}}>
      <span style={{fontSize:'12px',color:C.textSec,flexShrink:0,paddingTop:'2px'}}>{label}</span>
      <span style={{fontSize:'14px',color:C.text,textAlign:'right'}}>{value}</span>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:'5px',fontWeight:'600'}}>{label}</label>
      {children}
    </div>
  );
}
function Section({ label, children, muted=false }) {
  return (
    <div style={{marginBottom:'28px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
        <span style={{fontSize:'11px',fontWeight:'800',textTransform:'uppercase',letterSpacing:'1.2px',color:muted?C.textMut:C.red}}>{label}</span>
        <div style={{flex:1,height:'1px',background:C.border}} />
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>{children}</div>
    </div>
  );
}

// ─── JudokaOverviewPopup ──────────────────────────────────────────────────────
// Toont alle ingeschreven judoka's A→Z met per judoka hun tornooien
function JudokaOverviewPopup({ inschrijvingen, onClose }) {
  const [zoek, setZoek] = useState('');

  // Groepeer op judokaNaam
  const byJudoka = {};
  for (const ins of inschrijvingen) {
    const naam = ins.judokaNaam || '—';
    if (!byJudoka[naam]) byJudoka[naam] = [];
    byJudoka[naam].push(ins);
  }

  // Sorteer A→Z, filter op zoek
  const judokaNamen = Object.keys(byJudoka)
    .filter(n => !zoek || n.toLowerCase().includes(zoek.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'nl'));

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px',
        width:'100%', maxWidth:'560px', maxHeight:'80vh',
        display:'flex', flexDirection:'column', overflow:'hidden',
        animation:'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{padding:'18px 20px 14px', borderBottom:`1px solid ${C.border}`, flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
            <div>
              <div style={{fontSize:'16px',fontWeight:'800',color:C.text}}>👥 Ingeschreven judoka's</div>
              <div style={{fontSize:'12px',color:C.textSec,marginTop:'2px'}}>
                {judokaNamen.length} judoka's · {inschrijvingen.length} inschrijvingen
              </div>
            </div>
            <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.textSec,fontSize:'16px',cursor:'pointer',padding:'6px 10px',lineHeight:1,fontFamily:'inherit'}}>✕</button>
          </div>
          <input
            autoFocus
            placeholder="🔍 Zoek judoka..."
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'13px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        {/* Lijst */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 20px'}}>
          {judokaNamen.length === 0 ? (
            <div style={{color:C.textMut,textAlign:'center',padding:'32px',fontSize:'14px'}}>
              {zoek ? 'Geen judoka gevonden.' : 'Nog geen inschrijvingen.'}
            </div>
          ) : judokaNamen.map(naam => {
            const tornooien = byJudoka[naam].sort((a,b) => (a.eventDatum||'').localeCompare(b.eventDatum||''));
            return (
              <div key={naam} style={{marginBottom:'14px',paddingBottom:'14px',borderBottom:`1px solid ${C.border}`}}>
                {/* Judoka naam */}
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                  <span style={{
                    width:'32px',height:'32px',borderRadius:'50%',
                    background:C.redDim,border:`1px solid ${C.redBord}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:'13px',fontWeight:'800',color:C.red,flexShrink:0,
                  }}>
                    {naam.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div style={{fontSize:'14px',fontWeight:'700',color:C.text}}>{naam}</div>
                    <div style={{fontSize:'11px',color:C.textMut}}>{tornooien.length} tornooi{tornooien.length!==1?'en':''}</div>
                  </div>
                </div>
                {/* Tornooien */}
                <div style={{display:'flex',flexDirection:'column',gap:'4px',paddingLeft:'42px'}}>
                  {tornooien.map((ins, i) => {
                    const cc = CATEGORIE_COLORS[ins.categorie] || {bg:C.surface,color:C.textSec,border:C.border};
                    const past = ins.eventDatum && !isUpcoming(ins.eventDatum);
                    return (
                      <div key={i} style={{
                        display:'flex',alignItems:'center',gap:'8px',
                        padding:'6px 10px',borderRadius:'8px',
                        background:C.surface,border:`1px solid ${C.border}`,
                        opacity: past ? 0.6 : 1,
                      }}>
                        <span style={{fontSize:'11px',color:C.textMut,minWidth:'52px',flexShrink:0}}>
                          {ins.eventDatum ? formatDateShort(ins.eventDatum) : '—'}
                        </span>
                        <span style={{fontSize:'13px',color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {ins.eventNaam}
                        </span>
                        {ins.categorie && ins.categorie !== '—' && (
                          <span style={{background:cc.bg,color:cc.color,border:`1px solid ${cc.border}`,padding:'1px 7px',borderRadius:'999px',fontSize:'10px',fontWeight:'700',flexShrink:0}}>
                            {ins.categorie}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── TournamentCard ───────────────────────────────────────────────────────────
function TournamentCard({ event, isSelected, onClick, judokaCount }) {
  const [hov, setHov] = useState(false);
  const soon     = isSoonish(event.datum);
  const upcoming = isUpcoming(event.datum);
  const past     = !upcoming;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:'flex',alignItems:'stretch',gap:0,width:'100%',
        background:isSelected||hov?C.cardHov:C.card,
        border:`1px solid ${isSelected?C.red:C.border}`,
        borderLeft:`3px solid ${isSelected?C.red:soon?C.amber:past?C.textMut:C.green}`,
        borderRadius:'10px',cursor:'pointer',textAlign:'left',
        transition:'all 0.15s',fontFamily:'inherit',outline:'none',
        opacity:past?0.65:1,WebkitTapHighlightColor:'transparent',overflow:'hidden',
      }}
    >
      <div style={{minWidth:'54px',padding:'12px 8px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRight:`1px solid ${C.border}`,background:isSelected?C.redDim:'transparent'}}>
        <span style={{fontSize:'18px',fontWeight:'800',color:isSelected?C.red:C.text,lineHeight:1}}>
          {event.datum ? new Date(event.datum).getDate() : '—'}
        </span>
        <span style={{fontSize:'10px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:'2px'}}>
          {event.datum ? MONTHS_NL[new Date(event.datum).getMonth()] : ''}
        </span>
      </div>
      <div style={{flex:1,padding:'10px 12px',minWidth:0}}>
        <div style={{fontWeight:'700',fontSize:'13px',color:C.text,marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {event.naam}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
          <DoelgroepBadges doelgroep={event.doelgroep} />
          {event.provincie && (
            <span style={{fontSize:'10px',color:C.textMut,background:C.surface,padding:'1px 6px',borderRadius:'4px',border:`1px solid ${C.border}`}}>
              {event.provincie}
            </span>
          )}
        </div>
      </div>
      {judokaCount > 0 && (
        <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:'50px',background:C.redDim,borderLeft:`1px solid ${C.redBord}`}}>
          <span style={{fontSize:'18px',fontWeight:'800',color:C.red,lineHeight:1}}>{judokaCount}</span>
          <span style={{fontSize:'9px',color:C.red,textTransform:'uppercase',opacity:0.7}}>leden</span>
        </div>
      )}
    </button>
  );
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────
// inschrijvingenVoorEvent = gefilterde inschrijvingen voor dit event (uit main listener)
function DetailPanel({ event, inschrijvingenVoorEvent, onClose, onUpdate, onDelete }) {
  const [tab, setTab]           = useState('judoka');
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({});
  const [newJudoka, setNewJudoka] = useState({naam:'',geboortejaar:''});
  const [saving, setSaving]     = useState(false);
  const [adding, setAdding]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [judokaSearch, setJudokaSearch] = useState('');

  useEffect(() => {
    setForm({...event});
    setEditing(false);
    setTab('judoka');
    setJudokaSearch('');
  }, [event?.id]);

  const inputStyle = {width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit',outline:'none'};
  const f = (k,v) => setForm(prev=>({...prev,[k]:v}));

  async function handleSave() {
    setSaving(true);
    try {
      const {id, _judokaCount, ...data} = form;
      await updateDoc(doc(db,'events',event.id), {...data, updatedAt:serverTimestamp()});
      onUpdate && onUpdate({...event,...data});
      setEditing(false);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  async function handleAddJudoka() {
    if (!newJudoka.naam.trim() || !newJudoka.geboortejaar) return;
    setAdding(true);
    try {
      const {cat} = berekenCategorie(newJudoka.geboortejaar, event.datum, event.doelgroep);
      // Schrijf naar flat inschrijvingen collectie
      await addDoc(collection(db,'inschrijvingen'), {
        eventId:     event.id,
        eventNaam:   event.naam,
        eventDatum:  event.datum,
        judokaNaam:  newJudoka.naam.trim(),
        geboortejaar: parseInt(newJudoka.geboortejaar),
        categorie:   cat,
        addedAt:     serverTimestamp(),
      });
      setNewJudoka({naam:'',geboortejaar:''});
    } catch(e) { console.error(e); }
    setAdding(false);
  }

  async function handleRemoveJudoka(insId) {
    await deleteDoc(doc(db,'inschrijvingen',insId));
  }

  async function handleDelete() {
    // Verwijder ook alle inschrijvingen voor dit event
    const snap = await getDocs(query(collection(db,'inschrijvingen'), where('eventId','==',event.id)));
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db,'events',event.id));
    await batch.commit();
    onDelete && onDelete(event.id);
    onClose();
  }

  const catPreview = newJudoka.geboortejaar?.length===4
    ? berekenCategorie(newJudoka.geboortejaar, event.datum, event.doelgroep)
    : null;

  const gefilterd = judokaSearch.trim()
    ? inschrijvingenVoorEvent.filter(j => j.judokaNaam?.toLowerCase().includes(judokaSearch.toLowerCase()))
    : inschrijvingenVoorEvent;

  const byCategorie = gefilterd.reduce((acc,j) => {
    const cat = j.categorie||'—';
    if (!acc[cat]) acc[cat]=[];
    acc[cat].push(j);
    return acc;
  }, {});

  return (
    <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'14px',display:'flex',flexDirection:'column',height:'100%',overflow:'hidden'}}>
      {/* Header */}
      <div style={{padding:'16px 18px 0',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
        <div style={{display:'flex',alignItems:'flex-start',gap:'10px',marginBottom:'12px'}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:'16px',fontWeight:'800',color:C.text,lineHeight:1.3,marginBottom:'4px'}}>{event.naam}</div>
            <div style={{fontSize:'13px',color:C.textSec}}>
              {formatDate(event.datum)}
              {event.startuur && ` · ${event.startuur}${event.einduur?`–${event.einduur}`:''}`}
            </div>
          </div>
          <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.textSec,fontSize:'16px',cursor:'pointer',padding:'6px 10px',lineHeight:1,flexShrink:0,fontFamily:'inherit'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:0}}>
          {[['judoka',`👥 Judoka (${inschrijvingenVoorEvent.length})`],['info','ℹ️ Info']].map(([t,l]) => (
            <button key={t} onClick={()=>setTab(t)} style={{background:'none',border:'none',borderBottom:`2px solid ${tab===t?C.red:'transparent'}`,color:tab===t?C.red:C.textSec,padding:'8px 14px',cursor:'pointer',fontSize:'13px',fontWeight:tab===t?'700':'400',fontFamily:'inherit'}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,overflowY:'auto',padding:'18px'}}>

        {tab==='judoka' && (
          <div>
            <input
              placeholder="🔍 Zoek judoka op naam..."
              value={judokaSearch}
              onChange={e=>setJudokaSearch(e.target.value)}
              style={{...inputStyle,marginBottom:'14px',fontSize:'13px'}}
            />
            {/* Toevoegen */}
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'14px',marginBottom:'18px'}}>
              <div style={{fontSize:'12px',fontWeight:'700',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'10px'}}>Judoka toevoegen</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'8px',marginBottom:'8px'}}>
                <input style={inputStyle} placeholder="Naam judoka" value={newJudoka.naam}
                  onChange={e=>setNewJudoka(p=>({...p,naam:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&document.getElementById('gbj')?.focus()} />
                <input id="gbj" style={{...inputStyle,width:'90px'}} placeholder="Jaar" type="number" min="2000" max="2025"
                  value={newJudoka.geboortejaar}
                  onChange={e=>setNewJudoka(p=>({...p,geboortejaar:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&handleAddJudoka()} />
              </div>
              {catPreview && (
                <div style={{fontSize:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
                  <span style={{color:C.textSec}}>Categorie:</span>
                  <strong style={{color:catPreview.buiten?C.amber:C.text}}>{catPreview.cat}</strong>
                  {catPreview.buiten && <span style={{fontSize:'11px',color:C.amber,background:'rgba(245,158,11,0.1)',padding:'1px 6px',borderRadius:'4px',border:'1px solid rgba(245,158,11,0.3)'}}>⚠ buiten doelgroep</span>}
                </div>
              )}
              <button style={{...btnStyle('primary'),width:'100%'}} onClick={handleAddJudoka}
                disabled={adding||!newJudoka.naam.trim()||!newJudoka.geboortejaar}>
                {adding?'Toevoegen...':'+ Toevoegen'}
              </button>
            </div>

            {/* Lijst */}
            {gefilterd.length===0 ? (
              <div style={{color:C.textMut,textAlign:'center',padding:'24px',fontSize:'14px'}}>
                {judokaSearch?'Geen judoka gevonden.':'Nog geen judoka ingeschreven.'}
              </div>
            ) : Object.entries(byCategorie)
                .sort(([a],[b])=>[...CAT_RANGORDE,'—'].indexOf(a)-[...CAT_RANGORDE,'—'].indexOf(b))
                .map(([cat,list]) => {
                  const cc = CATEGORIE_COLORS[cat]||{bg:C.surface,color:C.textSec,border:C.border};
                  return (
                    <div key={cat} style={{marginBottom:'16px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'8px'}}>
                        <span style={{background:cc.bg,color:cc.color,border:`1px solid ${cc.border}`,padding:'2px 10px',borderRadius:'999px',fontSize:'11px',fontWeight:'700'}}>{cat}</span>
                        <span style={{fontSize:'12px',color:C.textMut}}>{list.length} judoka</span>
                      </div>
                      {list.map(j => (
                        <div key={j.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',background:C.surface,borderRadius:'8px',marginBottom:'5px',border:`1px solid ${C.border}`}}>
                          <span style={{width:'28px',height:'28px',borderRadius:'50%',background:C.redDim,border:`1px solid ${C.redBord}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'700',color:C.red,flexShrink:0}}>
                            {(j.judokaNaam||'?').charAt(0).toUpperCase()}
                          </span>
                          <span style={{flex:1,fontSize:'14px',color:C.text}}>{j.judokaNaam}</span>
                          <span style={{fontSize:'12px',color:C.textMut}}>{j.geboortejaar}</span>
                          <button onClick={()=>handleRemoveJudoka(j.id)} style={{background:'none',border:'none',color:'#e74c3c',cursor:'pointer',fontSize:'16px',padding:'2px 4px',lineHeight:1}}>✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })
            }
          </div>
        )}

        {tab==='info' && (
          <div>
            {!editing ? (
              <>
                <InfoRow label="Doelgroep"         value={<DoelgroepBadges doelgroep={event.doelgroep}/>} />
                <InfoRow label="Locatie"            value={event.locatie} />
                <InfoRow label="Adres"              value={event.adres} />
                <InfoRow label="Organiserende club" value={event.club} />
                <InfoRow label="Provincie"          value={event.provincie} />
                <InfoRow label="Start"              value={event.startuur} />
                <InfoRow label="Einde"              value={event.einduur} />
                <InfoRow label="Max deelnemers"     value={event.maxDln} />
                <InfoRow label="# Matten"           value={event.aantalMatten} />
                <div style={{display:'flex',gap:'8px',marginTop:'20px',flexWrap:'wrap'}}>
                  <button style={btnStyle('primary')} onClick={()=>setEditing(true)}>✏️ Bewerken</button>
                  <button style={btnStyle('danger')}  onClick={()=>setConfirmDel(true)}>🗑 Verwijderen</button>
                </div>
              </>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                <Field label="Naam tornooi"><input style={inputStyle} value={form.naam||''} onChange={e=>f('naam',e.target.value)} /></Field>
                <Field label="Datum"><input style={inputStyle} type="date" value={form.datum?form.datum.slice(0,10):''} onChange={e=>f('datum',e.target.value)} /></Field>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <Field label="Startuur"><input style={inputStyle} value={form.startuur||''} onChange={e=>f('startuur',e.target.value)} placeholder="08:00" /></Field>
                  <Field label="Einduur"> <input style={inputStyle} value={form.einduur||''}  onChange={e=>f('einduur',e.target.value)}  placeholder="17:00" /></Field>
                </div>
                <Field label="Doelgroep"><input style={inputStyle} value={form.doelgroep||''} onChange={e=>f('doelgroep',e.target.value)} placeholder="bv. U11-U13" /></Field>
                <Field label="Locatie">  <input style={inputStyle} value={form.locatie||''}  onChange={e=>f('locatie',e.target.value)} /></Field>
                <Field label="Adres">    <input style={inputStyle} value={form.adres||''}    onChange={e=>f('adres',e.target.value)} /></Field>
                <Field label="Organiserende club"><input style={inputStyle} value={form.club||''} onChange={e=>f('club',e.target.value)} /></Field>
                <Field label="Provincie">
                  <select style={inputStyle} value={form.provincie||''} onChange={e=>f('provincie',e.target.value)}>
                    <option value="">—</option>
                    {PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <Field label="Max deelnemers"><input style={inputStyle} value={form.maxDln||''}       onChange={e=>f('maxDln',e.target.value)} /></Field>
                  <Field label="# Matten">      <input style={inputStyle} value={form.aantalMatten||''} onChange={e=>f('aantalMatten',e.target.value)} /></Field>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button style={{...btnStyle('primary'),flex:1}} onClick={handleSave} disabled={saving}>{saving?'Opslaan...':'✓ Opslaan'}</button>
                  <button style={btnStyle('ghost')} onClick={()=>{setEditing(false);setForm({...event});}}>Annuleer</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {confirmDel && (
        <div style={{padding:'16px 18px',borderTop:`1px solid ${C.border}`,background:'rgba(230,57,70,0.08)',flexShrink:0}}>
          <div style={{fontSize:'14px',color:C.text,marginBottom:'10px',fontWeight:'600'}}>Tornooi verwijderen?</div>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{...btnStyle('danger'),flex:1}} onClick={handleDelete}>Ja, verwijderen</button>
            <button style={btnStyle('ghost')} onClick={()=>setConfirmDel(false)}>Annuleer</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ExcelImport ──────────────────────────────────────────────────────────────
function ExcelImport({ onDone }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus]     = useState(null);
  const fileRef = useRef();

  async function processFile(file) {
    if (!file) return;
    setStatus('importing');
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf,{type:'array',cellDates:true});
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws,{header:1});
      const headerRow = rows.findIndex(r=>r.some(c=>String(c).toLowerCase().includes('datum')));
      if (headerRow===-1) { setStatus({error:'Geen geldige header gevonden.'}); return; }
      const headers = rows[headerRow].map(h=>String(h||'').toLowerCase().trim());
      const idx = k=>headers.findIndex(h=>h.includes(k));
      const colDatum=idx('datum'),colNaam=idx('naam'),colDoel=idx('doelgroep'),colStart=idx('startuur'),
            colEind=idx('einduur'),colMatten=idx('matten'),colMax=idx('max'),colLocatie=idx('locatie'),
            colAdres=idx('adres'),colClubNr=idx('clubnr'),
            colClub=headers.findIndex((h,i)=>h==='club'&&i!==colClubNr),colProv=idx('provincie');
      const dataRows = rows.slice(headerRow+1).filter(r=>r[colDatum]&&r[colNaam]);
      const snap = await getDocs(collection(db,'events'));
      const existing = snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.type==='wedstrijd');
      const batch = writeBatch(db);
      let added=0,updated=0;
      for (const row of dataRows) {
        const rawDate=row[colDatum];
        let dateStr='';
        if (rawDate instanceof Date) dateStr=rawDate.toISOString().slice(0,10);
        else if (typeof rawDate==='string') dateStr=rawDate.slice(0,10);
        else if (typeof rawDate==='number') dateStr=new Date(Math.round((rawDate-25569)*86400*1000)).toISOString().slice(0,10);
        const naam=String(row[colNaam]||'').trim();
        const doelgroep=String(row[colDoel]||'').trim();
        if (!naam) continue;
        const data={
          type:'wedstrijd',datum:dateStr,naam,doelgroep,
          startuur:    colStart>=0?String(row[colStart]||''):'',
          einduur:     colEind>=0?String(row[colEind]||''):'',
          aantalMatten:colMatten>=0?String(row[colMatten]||''):'',
          maxDln:      colMax>=0?String(row[colMax]||''):'',
          locatie:     colLocatie>=0?String(row[colLocatie]||''):'',
          adres:       colAdres>=0?String(row[colAdres]||''):'',
          clubnr:      colClubNr>=0?String(row[colClubNr]||''):'',
          club:        colClub>=0?String(row[colClub]||''):'',
          provincie:   colProv>=0?String(row[colProv]||''):'',
        };
        const match=existing.find(e=>e.naam?.trim().toLowerCase()===naam.toLowerCase()&&e.doelgroep?.trim().toLowerCase()===doelgroep.toLowerCase());
        if (match) { batch.update(doc(db,'events',match.id),{...data,updatedAt:serverTimestamp()}); updated++; }
        else { batch.set(doc(collection(db,'events')),{...data,createdAt:serverTimestamp()}); added++; }
      }
      await batch.commit();
      setStatus({added,updated,total:dataRows.length});
      onDone&&onDone();
    } catch(e) { console.error(e); setStatus({error:e.message||'Onbekende fout.'}); }
  }

  return (
    <div style={{marginBottom:'20px'}}>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}}
        onClick={()=>fileRef.current?.click()}
        style={{border:`2px dashed ${dragging?C.red:C.border}`,borderRadius:'10px',padding:'18px',textAlign:'center',cursor:'pointer',background:dragging?C.redDim:C.surface,transition:'all 0.2s'}}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>processFile(e.target.files[0])} />
        <div style={{fontSize:'24px',marginBottom:'6px'}}>📊</div>
        <div style={{fontSize:'13px',color:C.textSec,fontWeight:'600'}}>{status==='importing'?'⏳ Importeren...':'Sleep Excel-bestand hier of klik om te kiezen'}</div>
        <div style={{fontSize:'11px',color:C.textMut,marginTop:'4px'}}>Judo Vlaanderen kalender (.xlsx)</div>
      </div>
      {status&&status!=='importing'&&(
        <div style={{marginTop:'10px',padding:'12px 14px',borderRadius:'8px',background:status.error?'rgba(230,57,70,0.1)':'rgba(34,197,94,0.1)',border:`1px solid ${status.error?C.red:C.green}`,fontSize:'13px',color:status.error?'#e74c3c':C.green}}>
          {status.error?`❌ ${status.error}`:`✓ Import klaar — ${status.added} nieuw, ${status.updated} bijgewerkt (van ${status.total} rijen)`}
        </div>
      )}
    </div>
  );
}

// ─── MailImport ───────────────────────────────────────────────────────────────
function MailImport({ events, onDone }) {
  const [tekst,     setTekst]     = useState('');
  const [preview,   setPreview]   = useState(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);

  function handlePreview() {
    if (!tekst.trim()) return;
    setResult(null);
    const parsed = parseerMailTekst(tekst);
    const metMatch = parsed.inschrijvingen.map(ins => {
      let tornooi = events.find(e=>e.datum===ins.datum&&fuzzyMatch(e.naam,ins.tornooiNaam));
      if (!tornooi) tornooi = events.find(e=>e.datum===ins.datum);
      if (!tornooi) tornooi = events.find(e=>fuzzyMatch(e.naam,ins.tornooiNaam));
      return {...ins, tornooi:tornooi||null, matched:!!tornooi};
    });
    setPreview({...parsed, inschrijvingen:metMatch});
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    let toegevoegd=0,overgeslagen=0,nietGekoppeld=0;
    for (const ins of preview.inschrijvingen) {
      if (!ins.ingeschreven) continue;
      if (!ins.tornooi) { nietGekoppeld++; continue; }
      try {
        const {cat} = berekenCategorie(null, ins.tornooi.datum, ins.tornooi.doelgroep);
        // Dubbele check
        const bestaandSnap = await getDocs(query(collection(db,'inschrijvingen'),where('eventId','==',ins.tornooi.id),where('judokaNaam','==',preview.naamJudoka)));
        if (!bestaandSnap.empty) { overgeslagen++; continue; }
        await addDoc(collection(db,'inschrijvingen'), {
          eventId:      ins.tornooi.id,
          eventNaam:    ins.tornooi.naam,
          eventDatum:   ins.tornooi.datum,
          judokaNaam:   preview.naamJudoka,
          geboortejaar: null,
          categorie:    cat,
          viaMailImport:true,
          addedAt:      serverTimestamp(),
        });
        toegevoegd++;
      } catch(e) { console.error('Import fout voor',ins.label,e); }
    }
    setResult({toegevoegd,overgeslagen,nietGekoppeld});
    setImporting(false);
    setPreview(null);
    setTekst('');
    onDone&&onDone();
  }

  const ingeschrevenIns  = preview?.inschrijvingen.filter(i=>i.ingeschreven)||[];
  const nietIngeschreven = preview?.inschrijvingen.filter(i=>!i.ingeschreven)||[];
  const matchCount   = ingeschrevenIns.filter(i=>i.matched).length;
  const noMatchCount = ingeschrevenIns.filter(i=>!i.matched).length;

  return (
    <div style={{marginBottom:'20px'}}>
      {!preview ? (
        <>
          <div style={{fontSize:'12px',color:C.textSec,marginBottom:'8px',fontWeight:'600'}}>Plak de volledige mail-tekst van de inschrijving hieronder:</div>
          <textarea value={tekst} onChange={e=>setTekst(e.target.value)}
            placeholder={`Voornaam en naam judokaAn Rut E-mailadresre.rut@gmail.comIppon Trophy Antwerpen (U15+) - 16 meiJaMansio cup Meise (U15+) - 22 maartGewicht (Enkel voor Kids Cup):Uitschrijven voor:`}
            style={{width:'100%',minHeight:'180px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',color:C.text,padding:'12px 14px',fontSize:'13px',fontFamily:'monospace',resize:'vertical',outline:'none',boxSizing:'border-box'}} />
          <button style={{...btnStyle('primary'),marginTop:'10px',width:'100%'}} onClick={handlePreview} disabled={!tekst.trim()}>🔍 Analyseren</button>
        </>
      ) : (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'16px'}}>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'4px'}}>Judoka</div>
            <div style={{fontSize:'16px',fontWeight:'700',color:C.text}}>{preview.naamJudoka||'⚠ Naam niet gevonden'}</div>
          </div>
          <div style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Ingeschreven voor ({ingeschrevenIns.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'14px'}}>
            {ingeschrevenIns.length===0 ? (
              <div style={{fontSize:'13px',color:C.textMut,padding:'8px 0'}}>Geen inschrijvingen gevonden.</div>
            ) : ingeschrevenIns.map((ins,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:ins.matched?'rgba(34,197,94,0.08)':'rgba(230,57,70,0.08)',border:`1px solid ${ins.matched?'rgba(34,197,94,0.3)':C.redBord}`,borderRadius:'8px'}}>
                <span style={{fontSize:'16px'}}>{ins.matched?'✓':'⚠'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'12px',color:C.textSec,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ins.label}</div>
                  {ins.tornooi
                    ? <div style={{fontSize:'13px',color:C.green,fontWeight:'600'}}>→ {ins.tornooi.naam} ({ins.datum})</div>
                    : <div style={{fontSize:'12px',color:C.red}}>Geen tornooi gevonden{ins.datum?` voor ${ins.datum}`:' (geen datum herkend)'}</div>}
                </div>
              </div>
            ))}
          </div>
          {nietIngeschreven.length>0&&(
            <details style={{marginBottom:'14px'}}>
              <summary style={{fontSize:'12px',color:C.textMut,cursor:'pointer',userSelect:'none'}}>
                {nietIngeschreven.length} tornooi{nietIngeschreven.length!==1?'s':''} niet aangeduid (toon)
              </summary>
              <div style={{display:'flex',flexDirection:'column',gap:'4px',marginTop:'8px'}}>
                {nietIngeschreven.map((ins,i)=>(
                  <div key={i} style={{fontSize:'12px',color:C.textMut,padding:'4px 8px',background:C.card,borderRadius:'6px'}}>— {ins.label}</div>
                ))}
              </div>
            </details>
          )}
          <div style={{display:'flex',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',color:C.green,background:'rgba(34,197,94,0.1)',padding:'4px 10px',borderRadius:'20px',border:'1px solid rgba(34,197,94,0.3)'}}>✓ {matchCount} gekoppeld</span>
            {noMatchCount>0&&<span style={{fontSize:'12px',color:C.red,background:C.redDim,padding:'4px 10px',borderRadius:'20px',border:`1px solid ${C.redBord}`}}>⚠ {noMatchCount} niet gevonden</span>}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{...btnStyle('primary'),flex:1}} onClick={handleImport} disabled={importing||matchCount===0}>
              {importing?'Importeren...':`✓ ${matchCount} inschrijving${matchCount!==1?'en':''} opslaan`}
            </button>
            <button style={btnStyle('ghost')} onClick={()=>{setPreview(null);setResult(null);}}>← Terug</button>
          </div>
        </div>
      )}
      {result&&(
        <div style={{marginTop:'10px',padding:'12px 14px',borderRadius:'8px',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',fontSize:'13px',color:C.green}}>
          ✓ Import klaar — {result.toegevoegd} toegevoegd
          {result.overgeslagen>0&&`, ${result.overgeslagen} dubbel overgeslagen`}
          {result.nietGekoppeld>0&&`, ${result.nietGekoppeld} niet gekoppeld`}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Wedstrijden() {
  const [events,          setEvents]         = useState([]);
  const [inschrijvingen,  setInschrijvingen]  = useState([]); // flat, realtime
  const [loading,         setLoading]         = useState(true);
  const [selected,        setSelected]        = useState(null);
  const [judokaZoek,      setJudokaZoek]      = useState(''); // globale judoka zoekbalk
  const [search,          setSearch]          = useState('');
  const [filterCat,       setFilterCat]       = useState('alle');
  const [filterMonth,     setFilterMonth]     = useState('alle');
  const [showImport,      setShowImport]      = useState(false);
  const [showMailImport,  setShowMailImport]  = useState(false);
  const [showNewForm,     setShowNewForm]     = useState(false);
  const [showJudokaPopup, setShowJudokaPopup] = useState(false);
  const [newForm,         setNewForm]         = useState({naam:'',datum:'',doelgroep:'',locatie:'',provincie:''});
  const [creating,        setCreating]        = useState(false);

  // ── Listeners ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const q = query(collection(db,'events'), orderBy('datum'));
    return onSnapshot(q, snap => {
      setEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.type==='wedstrijd'));
      setLoading(false);
    }, ()=>setLoading(false));
  }, []);

  useEffect(() => {
    // Eén listener voor alle inschrijvingen
    const q = query(collection(db,'inschrijvingen'), orderBy('judokaNaam'));
    return onSnapshot(q, snap => {
      setInschrijvingen(snap.docs.map(d=>({id:d.id,...d.data()})));
    });
  }, []);

  // Houd selected in sync
  useEffect(() => {
    if (selected) {
      const updated = events.find(e=>e.id===selected.id);
      if (updated) setSelected(updated);
    }
  }, [events]);

  // ── Afleidingen ────────────────────────────────────────────────────────────
  const allCats = [...new Set(
    events.flatMap(e=>(e.doelgroep||'').split(/[-\/]/).map(s=>s.trim()).filter(Boolean))
  )].sort();

  const allMonths = [...new Set(
    events.filter(e=>e.datum).map(e=>new Date(e.datum).getMonth())
  )].sort((a,b)=>a-b);

  // Inschrijvingen per eventId (voor counts en detailpanel)
  const insByEvent = inschrijvingen.reduce((acc,ins)=>{
    if (!acc[ins.eventId]) acc[ins.eventId]=[];
    acc[ins.eventId].push(ins);
    return acc;
  }, {});

  // Globale judoka zoekbalk → welke eventIds bevatten deze judoka?
  const eventIdsMetJudoka = judokaZoek.trim()
    ? new Set(inschrijvingen
        .filter(i=>i.judokaNaam?.toLowerCase().includes(judokaZoek.toLowerCase()))
        .map(i=>i.eventId))
    : null; // null = geen filter actief

  const filtered = events.filter(e => {
    if (eventIdsMetJudoka !== null && !eventIdsMetJudoka.has(e.id)) return false;
    const matchSearch = !search || e.naam?.toLowerCase().includes(search.toLowerCase()) || e.locatie?.toLowerCase().includes(search.toLowerCase());
    const matchCat    = filterCat==='alle'||(e.doelgroep||'').includes(filterCat);
    const matchMonth  = filterMonth==='alle'||(e.datum&&new Date(e.datum).getMonth()===parseInt(filterMonth));
    return matchSearch && matchCat && matchMonth;
  });

  const upcomingList = filtered.filter(e=> isUpcoming(e.datum));
  const pastList     = filtered.filter(e=>!isUpcoming(e.datum));

  const totalJudoka = new Set(inschrijvingen.map(i=>i.judokaNaam)).size;

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

  const totalInschrijvingen = inschrijvingen.length;

  return (
    <div style={{color:C.text,fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",paddingBottom:'40px'}}>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}
        input:focus,select:focus,textarea:focus{border-color:${C.red}!important;box-shadow:0 0 0 3px ${C.redDim}!important}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px}
        details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}
      `}</style>

      {/* ── Popup ── */}
      {showJudokaPopup && (
        <JudokaOverviewPopup
          inschrijvingen={inschrijvingen}
          onClose={()=>setShowJudokaPopup(false)}
        />
      )}

      {/* ── Page header ── */}
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
            <button style={{...btnStyle('primary'),fontSize:'12px'}} onClick={()=>setShowNewForm(s=>!s)}>
              + Tornooi
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{display:'flex',gap:'10px',marginTop:'16px',flexWrap:'wrap'}}>
          {/* Judoka teller — klikbaar → popup */}
          <button
            onClick={()=>setShowJudokaPopup(true)}
            style={{
              background:C.redDim, border:`1px solid ${C.redBord}`, borderRadius:'10px',
              padding:'12px 20px', display:'flex', alignItems:'center', gap:'10px',
              cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
              outline:'none',
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
          <div style={{fontWeight:'700',fontSize:'14px',marginBottom:'12px',color:C.text}}>📧 Mail importeren</div>
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

      {/* ── Filters: judoka zoekbalk bovenaan, dan tornooi/maand ── */}
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'16px'}}>
        {/* Judoka zoekbalk — prominent bovenaan */}
        <div style={{position:'relative'}}>
          <input
            placeholder="👤 Zoek judoka — filtert tornooilijst..."
            value={judokaZoek}
            onChange={e=>setJudokaZoek(e.target.value)}
            style={{
              width:'100%', background:C.card, border:`2px solid ${judokaZoek?C.red:C.border}`,
              borderRadius:'10px', color:C.text, padding:'11px 14px',
              fontSize:'14px', fontFamily:'inherit', outline:'none',
              transition:'border-color 0.15s',
            }}
          />
          {judokaZoek && (
            <button
              onClick={()=>setJudokaZoek('')}
              style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',color:C.textSec,cursor:'pointer',fontSize:'16px',padding:'4px',lineHeight:1}}
            >✕</button>
          )}
        </div>
        {judokaZoek && (
          <div style={{fontSize:'12px',color:C.red,paddingLeft:'4px'}}>
            {eventIdsMetJudoka?.size||0} tornooi{eventIdsMetJudoka?.size!==1?'en':''} gevonden voor "{judokaZoek}"
          </div>
        )}

        {/* Tornooi + maand filters */}
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

      {/* ── Layout ── */}
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
