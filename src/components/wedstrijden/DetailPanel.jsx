import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, getDocs, writeBatch, where, query, orderBy, limit, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { updateMetAudit, zoekLedenOpNaam } from '../../services/firestoreService';
import { berekenCategorie, CAT_RANGORDE, useCatRangorde, isVetCode } from '../../utils/categorieLogica';
import { jaarUitGeboortedatum, lidVeldenVoorInschrijving } from '../../utils/ledenKoppeling';
import { C, CATEGORIE_COLORS, PROVINCES, getCatColor } from './tokens';
import { DoelgroepBadges, btnStyle, InfoRow, Field, formatDate, VeteranenSelector } from './SharedUI';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useLesgevers } from '../../contexts/LesgeversContext.jsx';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';

function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export default function DetailPanel({ event, inschrijvingenVoorEvent, allInschrijvingen = [], onClose, onUpdate, onDelete }) {
  const { profiel, configCache } = useAuth();
  const isLid = profiel?.rol === 'lid';
  const confirm = useConfirm();
  const { lesgevers: alleLesgeversCtx = [] } = useLesgevers();
  const alleCats = useCatRangorde();
  const [tab, setTab]           = useState(isLid ? 'info' : 'judoka');
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState({});
  const [newJudoka, setNewJudoka] = useState({naam:'',geboortejaar:'',memberId:null});
  const [saving, setSaving]     = useState(false);
  const [adding, setAdding]     = useState(false);
  const [judokaSearch, setJudokaSearch] = useState('');

  // Lid-suggesties uit ledenbeheer (zelfde aanpak als de werkende kassa-zoek)
  const [lidSuggesties, setLidSuggesties] = useState([]);

  // Begeleider state
  const [coaches, setCoaches]       = useState([]);         // actieve lesgevers uit lesgevers-collectie
  const [begeleiders, setBegeleiders] = useState([]);       // [{lesgeverId, uid?, naam, aanwezig, km, inkom}]
  const [savingBeg, setSavingBeg]   = useState(false);

  // Coaches uit gedeelde context (geen extra Firestore-read)
  useEffect(() => {
    const lijst = alleLesgeversCtx
      .map(l => ({ lesgeverId: l.id, ...l }))
      .filter(l => l.actief !== false);
    setCoaches(lijst);
  }, [alleLesgeversCtx]);

  // Zoek leden rechtstreeks in Firestore terwijl je typt (identiek aan de kassa,
  // die wél werkt — i.t.t. een onbegrensde getMembers()-preload).
  const zoekLeden = useCallback(debounce(async (term) => {
    if (term.trim().length < 2) { setLidSuggesties([]); return; }
    try {
      setLidSuggesties(await zoekLedenOpNaam(term, 6));
    } catch (e) { console.error('Leden zoeken mislukt:', e); setLidSuggesties([]); }
  }, 300), []);

  useEffect(() => {
    setForm({
      ...event,
      doelgroepCodes: event.doelgroepCodes?.length > 0
        ? event.doelgroepCodes
        : parseerDoelgroepArray(event.doelgroep),
    });
    setEditing(false);
    setTab('judoka');
    setJudokaSearch('');
    setNewJudoka({naam:'',geboortejaar:'',memberId:null});
    setLidSuggesties([]);
    // Init begeleiders vanuit event — nooit automatisch de ingelogde gebruiker toevoegen.
    const opgeslagen = Array.isArray(event?.begeleiders) ? event.begeleiders : [];
    setBegeleiders(opgeslagen);
  }, [event?.id]);

  const inputStyle = {width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'14px',boxSizing:'border-box',fontFamily:'inherit',outline:'none'};

  const f = (k,v) => setForm(prev=>({...prev,[k]:v}));

  function parseerDoelgroepArray(doelgroep) {
    if (Array.isArray(doelgroep)) return doelgroep;
    if (!doelgroep) return [];
    return doelgroep.split(/[-\/]/).map(s => s.trim()).filter(Boolean);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const {id, _judokaCount, ...data} = form;
      const doelgroepStr = (form.doelgroepCodes || []).join('-');
      const saveData = { ...data, doelgroep: doelgroepStr, doelgroepCodes: form.doelgroepCodes || [] };
      await updateMetAudit(doc(db,'events',event.id), saveData);
      onUpdate && onUpdate({...event,...saveData});

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
  function updateBegeleider(lesgeverId, veld, waarde) {
    setBegeleiders(prev => prev.map(b => b.lesgeverId === lesgeverId ? {...b, [veld]: waarde} : b));
  }
  function voegBegeleiderToe(coach) {
    if (begeleiders.find(b => b.lesgeverId === coach.lesgeverId)) return;
    setBegeleiders(prev => [...prev, { lesgeverId: coach.lesgeverId, uid: coach.uid || null, naam: coach.naam || '', aanwezig: true, km: '', inkom: '' }]);
  }
  async function verwijderBegeleider(lesgeverId) {
    const beg = begeleiders.find(b => b.lesgeverId === lesgeverId);
    const ok = await confirm({
      titel: 'Coach verwijderen?',
      beschrijving: beg?.naam
        ? `${beg.naam} wordt verwijderd uit de begeleiding. Vergeet niet "Begeleiding opslaan" te klikken om de wijziging te bewaren.`
        : 'Deze coach wordt verwijderd uit de begeleiding. Vergeet niet "Begeleiding opslaan" te klikken om de wijziging te bewaren.',
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    setBegeleiders(prev => prev.filter(b => b.lesgeverId !== lesgeverId));
  }
  async function slaBegeleidersOp() {
    setSavingBeg(true);
    try {
      // km en inkom opslaan als getallen, lege string = null
      const clean = begeleiders.map(b => ({
        lesgeverId: b.lesgeverId,
        uid:        b.uid || null,
        naam:       b.naam,
        aanwezig:   !!b.aanwezig,
        km:         b.km !== '' ? parseFloat(b.km) || 0 : 0,
        inkom:      b.inkom !== '' ? parseFloat(b.inkom) || 0 : 0,
      }));
      await updateMetAudit(doc(db, 'events', event.id), { begeleiders: clean });
      onUpdate && onUpdate({ ...event, begeleiders: clean });
    } catch(e) { console.error(e); }
    setSavingBeg(false);
  }

  // Vrij naam typen → behandel als vrij veld (geen lid gekoppeld) en toon
  // lid-suggesties uit ledenbeheer.
  function wijzigJudokaNaam(naam) {
    setNewJudoka(p => ({ ...p, naam, memberId: null }));
    zoekLeden(naam);
  }

  // Lid uit suggesties kiezen → koppel memberId en haal geboortejaar uit ledenbeheer
  function kiesLid(m) {
    const { memberId, judokaNaam, geboortejaar } = lidVeldenVoorInschrijving(m);
    setNewJudoka({ naam: judokaNaam, geboortejaar: geboortejaar ? String(geboortejaar) : '', memberId });
    setLidSuggesties([]);
  }

  function ontkoppelLid() {
    setNewJudoka(p => ({ ...p, memberId: null }));
  }

  // Geboortejaar uit ledenbeheer is leidend en niet manueel aanpasbaar zolang
  // een lid gekoppeld is met gekende geboortedatum.
  const lidGeboortejaarVast = !!newJudoka.memberId && !!newJudoka.geboortejaar;

  async function handleAddJudoka() {
    if (!newJudoka.naam.trim() || !newJudoka.geboortejaar) return;
    setAdding(true);
    try {
      const {cat} = berekenCategorie(newJudoka.geboortejaar, event.datum, event.doelgroepCodes || event.doelgroep);
      await addDoc(collection(db,'inschrijvingen'), {
        eventId:         event.id,
        eventNaam:       event.naam,
        eventDatum:      event.datum,
        judokaNaam:      newJudoka.naam.trim(),
        geboortejaar:    parseInt(newJudoka.geboortejaar),
        categorie:       cat,
        memberId:        newJudoka.memberId || null,
        addedAt:         serverTimestamp(),
        idempotencyKey:  crypto.randomUUID(),
      });
      // W8 — nieuwe inschrijving: verwittig trainers en bestuurslid/admin
      stuurPushTrigger(PUSH_TYPES.NIEUWE_INSCHRIJVING, {
        judokaNaam: newJudoka.naam.trim(),
        eventNaam: event.naam || '',
        datum: event.datum || '',
      });
      setNewJudoka({naam:'',geboortejaar:'',memberId:null});
      setLidSuggesties([]);
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
    await updateDoc(doc(db,'inschrijvingen',insId), {
      deleted:    true,
      deletedAt:  serverTimestamp(),
      deletedDoor: profiel?.uid || null,
    });
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
    ? berekenCategorie(newJudoka.geboortejaar, event.datum, event.doelgroepCodes || event.doelgroep)
    : null;

  const actieveInschrijvingen = inschrijvingenVoorEvent.filter(j => !j.deleted);
  const gefilterd = judokaSearch.trim()
    ? actieveInschrijvingen.filter(j => j.judokaNaam?.toLowerCase().includes(judokaSearch.toLowerCase()))
    : actieveInschrijvingen;

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
          {(isLid
            ? [['info','ℹ️ Info']]
            : [['judoka',`👥 Judoka (${inschrijvingenVoorEvent.length})`],['begeleider','🧑‍🏫 Begeleider'],['info','ℹ️ Info']]
          ).map(([t,l]) => (
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
              <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:'8px',marginBottom:'8px',position:'relative'}}>
                <div style={{position:'relative'}}>
                  <input style={{...inputStyle,width:'100%'}} placeholder="Naam judoka (zoek lid of vrije naam)" value={newJudoka.naam}
                    autoComplete="off"
                    onChange={e => wijzigJudokaNaam(e.target.value)}
                    onKeyDown={e=>e.key==='Enter'&&document.getElementById('gbj')?.focus()} />
                  {lidSuggesties.length > 0 && (
                    <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:20,marginTop:'4px',background:C.card,border:`1px solid ${C.border}`,borderRadius:'8px',overflow:'hidden',boxShadow:'0 8px 24px rgba(0,0,0,0.35)'}}>
                      {lidSuggesties.map(m => {
                        const jaar = jaarUitGeboortedatum(m.geboortedatum);
                        return (
                          <button key={m.id} type="button" onClick={() => kiesLid(m)}
                            style={{display:'flex',alignItems:'center',gap:'8px',width:'100%',textAlign:'left',background:'transparent',border:'none',borderBottom:`1px solid ${C.border}`,color:C.text,padding:'10px 12px',cursor:'pointer',fontSize:'13px',fontFamily:'inherit'}}>
                            <span style={{flex:1}}>{m.naam || m.name}</span>
                            <span style={{fontSize:'11px',color:C.textMuted}}>{jaar || '— geen geb.jaar'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                <input id="gbj" style={{...inputStyle,width:'90px',opacity:lidGeboortejaarVast?0.6:1}} placeholder="Jaar" type="number" min="2000" max="2025"
                  value={newJudoka.geboortejaar}
                  disabled={lidGeboortejaarVast}
                  title={lidGeboortejaarVast ? 'Geboortejaar komt uit ledenbeheer' : ''}
                  onChange={e=>setNewJudoka(p=>({...p,geboortejaar:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&handleAddJudoka()} />
              </div>
              {newJudoka.memberId ? (
                <div style={{fontSize:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'6px',color:'var(--success)'}}>
                  <span>✓ Gelinkt aan lid</span>
                  {lidGeboortejaarVast && <span style={{color:C.textMuted}}>· geboortejaar uit ledenbeheer</span>}
                  <button type="button" onClick={ontkoppelLid} style={{marginLeft:'auto',background:'none',border:'none',color:C.textMuted,cursor:'pointer',fontSize:'12px',textDecoration:'underline',fontFamily:'inherit'}}>ontkoppel</button>
                </div>
              ) : newJudoka.naam.trim() && (
                <div style={{fontSize:'11px',marginBottom:'8px',color:C.textMuted}}>
                  Niet gekoppeld aan lid — vrij veld. Vul het geboortejaar manueel in.
                </div>
              )}
              {catPreview && (
                <div style={{fontSize:'12px',marginBottom:'8px',display:'flex',alignItems:'center',gap:'6px'}}>
                  <span style={{color:C.textSec}}>Categorie:</span>
                  <strong style={{color:catPreview.buiten?C.orange:C.text}}>{catPreview.cat}</strong>
                  {catPreview.buiten && <span style={{fontSize:'11px',color:C.orange,background:'rgba(245,158,11,0.1)',padding:'1px 6px',borderRadius:'4px',border:'1px solid rgba(245,158,11,0.3)'}}>⚠ buiten doelgroep</span>}
                </div>
              )}
              <button style={{...btnStyle('primary'),width:'100%'}} onClick={handleAddJudoka}
                disabled={adding||!newJudoka.naam.trim()||!newJudoka.geboortejaar}>
                {adding?'Toevoegen...':'+ Toevoegen'}
              </button>
            </div>

            {/* Lijst */}
            {gefilterd.length===0 ? (
              <div style={{color:C.textMuted,textAlign:'center',padding:'24px',fontSize:'14px'}}>
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
                        <span style={{fontSize:'12px',color:C.textMuted}}>{list.length} judoka</span>
                      </div>
                      {list.map(j => (
                        <div key={j.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 12px',background:C.surface,borderRadius:'8px',marginBottom:'5px',border:`1px solid ${C.border}`}}>
                          <span style={{width:'28px',height:'28px',borderRadius:'50%',background:C.redDim,border:`1px solid ${C.redBord}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'700',color:C.red,flexShrink:0}}>
                            {(j.judokaNaam||'?').charAt(0).toUpperCase()}
                          </span>
                          <span style={{flex:1,fontSize:'14px',color:C.text}}>{j.judokaNaam}</span>
                          <span style={{fontSize:'12px',color:C.textMuted}}>{j.geboortejaar}</span>
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
          const beschikbaar = coaches.filter(c => !begeleiders.find(b => b.lesgeverId === c.lesgeverId));
          return (
            <div>
              {/* Begeleiders lijst */}
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginBottom:'16px'}}>
                {begeleiders.length === 0 && (
                  <div style={{color:C.textMuted,fontSize:'13px',textAlign:'center',padding:'16px'}}>
                    Nog geen begeleider toegevoegd.
                  </div>
                )}
                {begeleiders.map(b => (
                  <div key={b.lesgeverId} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'12px'}}>
                    {/* Naam + aanwezig toggle */}
                    <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
                      <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',flex:1}}>
                        <input
                          type="checkbox"
                          checked={!!b.aanwezig}
                          onChange={e => updateBegeleider(b.lesgeverId, 'aanwezig', e.target.checked)}
                          style={{accentColor:C.red,width:'16px',height:'16px',cursor:'pointer'}}
                        />
                        <span style={{fontSize:'14px',fontWeight:'700',color:b.aanwezig?C.text:C.textMuted}}>
                          {b.naam || b.lesgeverId}
                        </span>
                        {!b.aanwezig && (
                          <span style={{fontSize:'11px',color:C.textMuted,background:C.card,border:`1px solid ${C.border}`,padding:'1px 6px',borderRadius:'4px'}}>afwezig</span>
                        )}
                      </label>
                      {begeleiders.length > 1 && (
                        <button onClick={() => verwijderBegeleider(b.lesgeverId)} style={{background:'none',border:'none',color:C.textMuted,cursor:'pointer',fontSize:'16px',padding:'2px 6px',lineHeight:1}}>✕</button>
                      )}
                    </div>
                    {/* km + inkom */}
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
                      <Field label="Km verplaatsing">
                        <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                          <input
                            type="number" min="0" step="1" placeholder="0"
                            value={b.km}
                            onChange={e => updateBegeleider(b.lesgeverId, 'km', e.target.value)}
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
                            onChange={e => updateBegeleider(b.lesgeverId, 'inkom', e.target.value)}
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
                      const coach = coaches.find(c => c.lesgeverId === e.target.value);
                      if (coach) voegBegeleiderToe(coach);
                      e.target.value = '';
                    }}
                    style={{...inputStyle,width:'100%',cursor:'pointer'}}
                  >
                    <option value="" disabled>— Selecteer coach —</option>
                    {beschikbaar.map(c => (
                      <option key={c.lesgeverId} value={c.lesgeverId}>{c.naam}</option>
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
            {/* Inschrijfstatus voor lid */}
            {isLid && (() => {
              const mijnMemberId = profiel?.linkedMemberId;
              const ben = inschrijvingenVoorEvent.some(
                i => (mijnMemberId && i.memberId === mijnMemberId) || (profiel?.naam && i.judokaNaam === profiel.naam)
              );
              return (
                <div style={{
                  marginBottom:'16px',padding:'10px 14px',borderRadius:'10px',
                  background: ben ? 'rgba(34,197,94,0.1)' : 'rgba(100,100,100,0.07)',
                  border: `1px solid ${ben ? 'rgba(34,197,94,0.35)' : 'rgba(100,100,100,0.2)'}`,
                  fontSize:'13px',fontWeight:'600',
                  color: ben ? 'var(--success,#22c55e)' : C.textSec,
                }}>
                  {ben ? '✓ Jij bent ingeschreven voor dit tornooi' : 'Je bent niet ingeschreven voor dit tornooi.'}
                  {ben && (
                    <div style={{fontSize:'12px',fontWeight:'400',color:C.textSec,marginTop:'3px'}}>
                      {inschrijvingenVoorEvent.length} {inschrijvingenVoorEvent.length === 1 ? 'judoka ingeschreven' : "judoka's ingeschreven"} in totaal
                    </div>
                  )}
                </div>
              );
            })()}
            {!editing ? (
              <>
                <InfoRow label="Doelgroep"         value={<DoelgroepBadges doelgroep={event.doelgroep} doelgroepCodes={event.doelgroepCodes}/>} />
                <InfoRow label="Locatie"            value={event.locatie} />
                <InfoRow label="Adres"              value={event.adres} />
                <InfoRow label="Organiserende club" value={event.club} />
                <InfoRow label="Start"              value={event.startuur} />
                <InfoRow label="Einde"              value={event.einduur} />
                {!isLid && <InfoRow label="Max deelnemers"     value={event.maxDln} />}
                {!isLid && <InfoRow label="# Matten"           value={event.aantalMatten} />}
                <InfoRow label="Opmerking"          value={event.opmerking} />
                {/* Weeguren per categorie */}
                {event.weeguren && Object.keys(event.weeguren).length > 0 && (() => {
                  const weeguurCatsView = event.doelgroepCodes?.length > 0
                    ? event.doelgroepCodes
                    : Object.keys(event.weeguren);
                  return (
                    <div style={{marginTop:'10px'}}>
                      <div style={{fontSize:'11px',fontWeight:'700',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'6px'}}>Weeguren</div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                        {alleCats.filter(cat => weeguurCatsView.includes(cat) && event.weeguren[cat]).map(cat => {
                          const cc = getCatColor(cat, configCache?.categorieen);
                          return (
                            <span key={cat} style={{background:cc.bg,color:cc.color,border:`1px solid ${cc.border}`,borderRadius:'8px',padding:'4px 10px',fontSize:'12px',fontWeight:'600'}}>
                              {cat}: {event.weeguren[cat]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div style={{display:'flex',gap:'8px',marginTop:'20px',flexWrap:'wrap'}}>
                  {!isLid && <button style={btnStyle('primary')} onClick={()=>setEditing(true)}>✏️ Bewerken</button>}
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
                          await updateMetAudit(doc(db,'events',event.id), {
                            geannuleerd: true,
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
                <Field label="Doelgroep — categorieën">
                  <div style={{display:'flex',flexWrap:'wrap',gap:'8px'}}>
                    {alleCats.filter(code => !isVetCode(code)).map(code => {
                      const cc = getCatColor(code, configCache?.categorieen);
                      const checked = (form.doelgroepCodes || []).includes(code);
                      return (
                        <label key={code} style={{
                          display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',
                          background: checked ? cc.bg : C.surface,
                          border: `1px solid ${checked ? cc.border : C.border}`,
                          borderRadius:'8px', padding:'6px 10px',
                          color: checked ? cc.color : C.textSec, fontSize:'13px', fontWeight:'700',
                          transition:'all 0.12s',
                        }}>
                          <input type="checkbox" style={{display:'none'}}
                            checked={checked}
                            onChange={e => {
                              const prev = form.doelgroepCodes || [];
                              f('doelgroepCodes', e.target.checked
                                ? [...prev, code]
                                : prev.filter(c => c !== code));
                            }}
                          />
                          {code}
                        </label>
                      );
                    })}
                    <VeteranenSelector
                      doelgroepCodes={form.doelgroepCodes || []}
                      onChange={codes => f('doelgroepCodes', codes)}
                    />
                  </div>
                </Field>
                <Field label="Locatie">  <input style={inputStyle} value={form.locatie||''}  onChange={e=>f('locatie',e.target.value)} /></Field>
                <Field label="Adres">    <input style={inputStyle} value={form.adres||''}    onChange={e=>f('adres',e.target.value)} /></Field>
                <Field label="Organiserende club"><input style={inputStyle} value={form.club||''} onChange={e=>f('club',e.target.value)} /></Field>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  <Field label="Max deelnemers"><input style={inputStyle} value={form.maxDln||''}       onChange={e=>f('maxDln',e.target.value)} /></Field>
                  <Field label="# Matten">      <input style={inputStyle} value={form.aantalMatten||''} onChange={e=>f('aantalMatten',e.target.value)} /></Field>
                </div>
                <Field label="Opmerking">
                  <textarea
                    style={{...inputStyle, minHeight:'70px', resize:'vertical'}}
                    value={form.opmerking || ''}
                    onChange={e => f('opmerking', e.target.value)}
                    placeholder="Extra info, opmerkingen voor coaches of judoka's..."
                  />
                </Field>
                {/* Weeguren per categorie — enkel geselecteerde cats */}
                <div>
                  <div style={{fontSize:'11px',fontWeight:'700',color:'var(--text-secondary)',textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Weeguren per categorie</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))',gap:'8px'}}>
                    {(form.doelgroepCodes?.length > 0
                      ? alleCats.filter(c => form.doelgroepCodes.includes(c))
                      : alleCats
                    ).map(cat => (
                      <Field key={cat} label={cat}>
                        <input
                          style={inputStyle}
                          type="time"
                          value={(form.weeguren||{})[cat]||''}
                          onChange={e => f('weeguren', {...(form.weeguren||{}), [cat]: e.target.value || undefined})}
                          placeholder="--:--"
                        />
                      </Field>
                    ))}
                  </div>
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
