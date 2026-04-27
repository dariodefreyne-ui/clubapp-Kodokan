import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, writeBatch, where, query, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { berekenCategorie, CAT_RANGORDE } from '../../utils/categorieLogica';
import { C, CATEGORIE_COLORS, PROVINCES } from './tokens';
import { DoelgroepBadges, btnStyle, InfoRow, Field, formatDate } from './SharedUI';

export default function DetailPanel({ event, inschrijvingenVoorEvent, onClose, onUpdate, onDelete }) {
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
