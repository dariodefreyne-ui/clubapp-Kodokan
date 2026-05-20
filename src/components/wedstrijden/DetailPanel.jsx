import React, { useState, useEffect } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, writeBatch, where, query, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { berekenCategorie, CAT_RANGORDE } from '../../utils/categorieLogica';
import { C, CATEGORIE_COLORS, PROVINCES } from './tokens';
import { DoelgroepBadges, btnStyle, InfoRow, Field, formatDate } from './SharedUI';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';

export default function DetailPanel({ event, inschrijvingenVoorEvent, onClose, onUpdate, onDelete }) {
  const { profiel } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab]           = useState('judoka');
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({});
  const [newJudoka, setNewJudoka] = useState({naam:'',geboortejaar:''});
  const [saving, setSaving]     = useState(false);
  const [adding, setAdding]     = useState(false);
  const [judokaSearch, setJudokaSearch] = useState('');

  // Begeleider state
  const [coaches, setCoaches]       = useState([]);         // alle users met rol trainer/bestuurslid/admin
  const [begeleiders, setBegeleiders] = useState([]);       // [{uid, naam, aanwezig, km, inkom}]
  const [savingBeg, setSavingBeg]   = useState(false);

  // Laad coaches eenmalig (users met rol trainer, bestuurslid of admin)
  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const lijst = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.rol === 'trainer' || u.rol === 'bestuurslid' || u.rol === 'admin')
        .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
      setCoaches(lijst);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    setForm({...event});
    setEditing(false);
    setTab('judoka');
    setJudokaSearch('');
    // Init begeleiders vanuit event, of voeg huidig profiel toe als default
    const opgeslagen = Array.isArray(event?.begeleiders) ? event.begeleiders : [];
    if (opgeslagen.length === 0 && profiel?.uid) {
      setBegeleiders([{ uid: profiel.uid, naam: profiel.naam || '', aanwezig: true, km: '', inkom: '' }]);
    } else {
      setBegeleiders(opgeslagen);
    }
  }, [event?.id]);

  const inputStyle = {width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit',outline:'none'};
  const f = (k,v) => setForm(prev=>({...prev,[k]:v}));

  async function handleSave() {
    setSaving(true);
    try {
      const {id, _judokaCount, ...data} = form;
      await updateDoc(doc(db,'events',event.id), {...data, updatedAt:serverTimestamp()});
      onUpdate && onUpdate({...event,...data});

      // W5 — tornooi gewijzigd: alleen sturen als datum of locatie effectief veranderd is
      const datumGewijzigd   = form.datum    !== event.datum;
      const locatieGewijzigd = form.locatie  !== event.locatie;
      if (datumGewijzigd || locatieGewijzigd) {
        stuurPushTrigger(PUSH_TYPES.TORNOOI_GEWIJZIGD, {
          eventId:     event.id,
          naam:        form.naam || event.naam || '',
          nieuweDatum: form.datum || '',
          locatie:     form.locatie || '',
        });
      }
      setEditing(false);
    } catch(e) { console.error(e); }
    setSaving(false);
  }

  // Begeleider helpers
  function updateBegeleider(uid, veld, waarde) {
    setBegeleiders(prev => prev.map(b => b.uid === uid ? {...b, [veld]: waarde} : b));
  }
  function voegBegeleiderToe(coach) {
    if (begeleiders.find(b => b.uid === coach.uid)) return;
    setBegeleiders(prev => [...prev, { uid: coach.uid, naam: coach.naam || '', aanwezig: true, km: '', inkom: '' }]);
  }
  async function verwijderBegeleider(uid) {
    const beg = begeleiders.find(b => b.uid === uid);
    const ok = await confirm({
      titel: 'Coach verwijderen?',
      beschrijving: beg?.naam
        ? `${beg.naam} wordt verwijderd uit de begeleiding. Vergeet niet "Begeleiding opslaan" te klikken om de wijziging te bewaren.`
        : 'Deze coach wordt verwijderd uit de begeleiding. Vergeet niet "Begeleiding opslaan" te klikken om de wijziging te bewaren.',
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    setBegeleiders(prev => prev.filter(b => b.uid !== uid));
  }
  async function slaBegeleidersOp() {
    setSavingBeg(true);
    try {
      // km en inkom opslaan als getallen, lege string = null
      const clean = begeleiders.map(b => ({
        uid:     b.uid,
        naam:    b.naam,
        aanwezig: !!b.aanwezig,
        km:      b.km !== '' ? parseFloat(b.km) || 0 : 0,
        inkom:   b.inkom !== '' ? parseFloat(b.inkom) || 0 : 0,
      }));
      await updateDoc(doc(db, 'events', event.id), { begeleiders: clean, updatedAt: serverTimestamp() });
      onUpdate && onUpdate({ ...event, begeleiders: clean });
    } catch(e) { console.error(e); }
    setSavingBeg(false);
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
      // W8 — nieuwe inschrijving: verwittig trainers en bestuurslid/admin
      stuurPushTrigger(PUSH_TYPES.NIEUWE_INSCHRIJVING, {
        judokaNaam: newJudoka.naam.trim(),
        eventNaam: event.naam || '',
        datum: event.datum || '',
      });
      setNewJudoka({naam:'',geboortejaar:''});
    } catch(e) { console.error(e); }
    setAdding(false);
  }

  async function handleRemoveJudoka(insId) {
    const ins = inschrijvingenVoorEvent.find(j => j.id === insId);
    const ok = await confirm({
      titel: 'Judoka uitschrijven?',
      beschrijving: ins?.judokaNaam
        ? `${ins.judokaNaam} wordt uitgeschreven voor dit tornooi.`
        : 'Deze inschrijving wordt verwijderd.',
      bevestigLabel: 'Ja, uitschrijven',
      variant: 'danger',
    });
    if (!ok) return;
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
          {[['judoka',`👥 Judoka (${inschrijvingenVoorEvent.length})`],['begeleider','🧑‍🏫 Begeleider'],['info','ℹ️ Info']].map(([t,l]) => (
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
                          {profiel?.isAdmin && !j.bevestigd && (
                            <button
                              style={{
                                background: 'rgba(39,174,96,0.15)',
                                color: 'var(--success)',
                                border: '1px solid rgba(39,174,96,0.3)',
                                borderRadius: '6px',
                                padding: '4px 10px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                marginRight: '6px',
                              }}
                              onClick={async () => {
                                try {
                                  await updateDoc(doc(db,'inschrijvingen',j.id), {
                                    bevestigd: true,
                                    bevestigdOp: serverTimestamp(),
                                  });
                                  stuurPushTrigger(PUSH_TYPES.INSCHRIJVING_BEVESTIGD, {
                                    uid:        j.uid || '',
                                    judokaNaam: j.judokaNaam || '',
                                    eventNaam:  event.naam || '',
                                    datum:      event.datum || '',
                                  });
                                } catch(e) { console.error(e); }
                              }}
                            >
                              ✓ Bevestig
                            </button>
                          )}
                          {j.bevestigd && (
                            <span style={{ color: 'var(--success)', fontSize: '12px', marginRight: '6px' }}>✓</span>
                          )}
                          <button onClick={()=>handleRemoveJudoka(j.id)} style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:'16px',padding:'2px 4px',lineHeight:1}}>✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })
            }
          </div>
        )}

        {tab==='begeleider' && (() => {
          const beschikbaar = coaches.filter(c => !begeleiders.find(b => b.uid === c.uid));
          return (
            <div>
              {/* Begeleiders lijst */}
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'16px'}}>
                {begeleiders.length === 0 && (
                  <div style={{color:C.textMut,fontSize:'13px',textAlign:'center',padding:'16px'}}>
                    Nog geen begeleider toegevoegd.
                  </div>
                )}
                {begeleiders.map(b => (
                  <div key={b.uid} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'12px'}}>
                    {/* Naam + aanwezig toggle */}
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                      <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',flex:1}}>
                        <input
                          type="checkbox"
                          checked={!!b.aanwezig}
                          onChange={e => updateBegeleider(b.uid, 'aanwezig', e.target.checked)}
                          style={{accentColor:C.red,width:'16px',height:'16px',cursor:'pointer'}}
                        />
                        <span style={{fontSize:'14px',fontWeight:'700',color:b.aanwezig?C.text:C.textMut}}>
                          {b.naam || b.uid}
                        </span>
                        {!b.aanwezig && (
                          <span style={{fontSize:'11px',color:C.textMut,background:C.card,border:`1px solid ${C.border}`,padding:'1px 6px',borderRadius:'4px'}}>afwezig</span>
                        )}
                      </label>
                      {begeleiders.length > 1 && (
                        <button onClick={() => verwijderBegeleider(b.uid)} style={{background:'none',border:'none',color:C.textMut,cursor:'pointer',fontSize:'16px',padding:'2px 6px',lineHeight:1}}>✕</button>
                      )}
                    </div>
                    {/* km + inkom */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <Field label="Km verplaatsing">
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <input
                            type="number" min="0" step="1" placeholder="0"
                            value={b.km}
                            onChange={e => updateBegeleider(b.uid, 'km', e.target.value)}
                            style={{...inputStyle,flex:1,textAlign:'right'}}
                          />
                          <span style={{fontSize:'12px',color:C.textSec,flexShrink:0}}>km</span>
                        </div>
                      </Field>
                      <Field label="Inkomgeld">
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <span style={{fontSize:'12px',color:C.textSec,flexShrink:0}}>€</span>
                          <input
                            type="number" min="0" step="0.50" placeholder="0.00"
                            value={b.inkom}
                            onChange={e => updateBegeleider(b.uid, 'inkom', e.target.value)}
                            style={{...inputStyle,flex:1,textAlign:'right'}}
                          />
                        </div>
                      </Field>
                    </div>
                  </div>
                ))}
              </div>

              {/* Coach toevoegen */}
              {beschikbaar.length > 0 && (
                <div style={{marginBottom:'14px'}}>
                  <div style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'6px',fontWeight:'600'}}>Coach toevoegen</div>
                  <select
                    defaultValue=""
                    onChange={e => {
                      const coach = coaches.find(c => c.uid === e.target.value);
                      if (coach) voegBegeleiderToe(coach);
                      e.target.value = '';
                    }}
                    style={{...inputStyle,width:'100%',cursor:'pointer'}}
                  >
                    <option value="" disabled>— Selecteer coach —</option>
                    {beschikbaar.map(c => (
                      <option key={c.uid} value={c.uid}>{c.naam || c.email || c.uid}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Opslaan */}
              <button
                style={{...btnStyle('primary'),width:'100%'}}
                onClick={slaBegeleidersOp}
                disabled={savingBeg}
              >
                {savingBeg ? 'Opslaan...' : '✓ Begeleiding opslaan'}
              </button>
            </div>
          );
        })()}

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
                  {profiel?.isAdmin && !event.geannuleerd && (
                    <button
                      style={{...btnStyle('danger'), marginRight: '8px'}}
                      onClick={async () => {
                        const ok = await confirm({
                          titel: 'Tornooi annuleren?',
                          beschrijving: 'Het tornooi wordt als geannuleerd gemarkeerd en alle ingeschrevenen krijgen een melding.',
                          bevestigLabel: 'Ja, annuleer tornooi',
                          variant: 'danger',
                        });
                        if (!ok) return;
                        try {
                          await updateDoc(doc(db,'events',event.id), {
                            geannuleerd: true,
                            updatedAt: serverTimestamp(),
                          });
                          stuurPushTrigger(PUSH_TYPES.TORNOOI_GEANNULEERD, {
                            eventId:  event.id,
                            naam:     event.naam || '',
                            datum:    event.datum || '',
                          });
                          onUpdate && onUpdate({...event, geannuleerd: true});
                          onClose();
                        } catch(e) { console.error(e); }
                      }}
                    >
                      Annuleer tornooi
                    </button>
                  )}
                  <button style={btnStyle('danger')} onClick={async () => {
                    const ok = await confirm({
                      titel: 'Tornooi verwijderen?',
                      beschrijving: `${event.naam || 'Dit tornooi'} en alle bijhorende inschrijvingen worden definitief verwijderd. Deze actie kan niet ongedaan gemaakt worden.`,
                      bevestigLabel: 'Ja, verwijderen',
                      variant: 'danger',
                    });
                    if (ok) handleDelete();
                  }}>🗑 Verwijderen</button>
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

    </div>
  );
}
