import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  subscribeEvents, addEvent,
  subscribeEventRegistrations, addRegistration, updateRegistration,
  getMembers, updateMember, getAllTechnieken,
  subscribeEventDocuments, addEventDocument,
} from '../services/firestoreService';
import { storage } from '../firebase';
import { stuurPushTrigger, PUSH_TYPES } from '../services/pushService';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const GORDEL_KYU = { geel:'5', oranje:'4', groen:'3', blauw:'2', bruin:'1' };

const BELTS = ['wit','geel','oranje','groen','blauw','bruin','zwart'];
const BELT_NEXT = { wit:'geel', geel:'oranje', oranje:'groen', groen:'blauw', blauw:'bruin', bruin:'zwart', zwart:'zwart' };
const BELT_COLORS = {
  wit:{bg:'#fff',color:'#333',border:'1px solid #ccc'}, geel:{bg:'#f1c40f',color:'#333'},
  oranje:{bg:'#e67e22',color:'#fff'}, groen:{bg:'#27ae60',color:'#fff'},
  blauw:{bg:'#3498db',color:'#fff'}, bruin:{bg:'#8B4513',color:'#fff'},
  zwart:{bg:'#1a1a1a',color:'#fff',border:'1px solid #555'},
};
const RESULT_LABELS = { geslaagd:'✓ Geslaagd', niet_geslaagd:'✗ Niet geslaagd', afwezig:'— Afwezig', pending:'⏳ Wacht' };
const RESULT_COLORS = { geslaagd:'#27ae60', niet_geslaagd:'#e74c3c', afwezig:'#aaa', pending:'#f39c12' };

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'12px' },
  btn: (v='primary') => ({ background: v==='primary'?'#c0392b':'#3a3a3a', border:'none', color:'#fff', padding:'10px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }),
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  select: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  label: { color:'#aaa', fontSize:'12px', marginBottom:'4px', display:'block' },
  tabs: { display:'flex', gap:'0', marginBottom:'16px', borderBottom:'1px solid #3a3a3a' },
  tab: (a) => ({ background:'none', border:'none', color:a?'#c0392b':'#aaa', padding:'10px 16px', cursor:'pointer', fontSize:'14px', fontWeight:a?'700':'400', borderBottom:a?'2px solid #c0392b':'2px solid transparent' }),
  beltBadge: (b) => ({ ...(BELT_COLORS[b]||{}), padding:'2px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:'700', display:'inline-block' }),
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'16px' },
  modalCard: { background:'#2d2d2d', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflowY:'auto' },
  candidateRow: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px', background:'#1a1a1a', borderRadius:'8px', marginBottom:'6px' },
};

export default function Examens() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('kandidaten');
  const [candidates, setCandidates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [showAddCandidate, setShowAddCandidate] = useState(false);
  const [eventForm, setEventForm] = useState({ name:'', date:'', location:'', examType:'club' });
  const [candidateForm, setCandidateForm] = useState({ memberId:'', currentBelt:'wit', targetBelt:'geel' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [examTechnieken, setExamTechnieken] = useState([]);
  const [loadingTechnieken, setLoadingTechnieken] = useState(false);

  useEffect(() => {
    const unsub = subscribeEvents(all => {
      const examens = all.filter(e => e.type === 'examen');
      setEvents(examens);
      if (!selected && examens.length > 0) setSelected(examens[0]);
    });
    getMembers().then(members => setMembers(members));
    return unsub;
  }, []);

  useEffect(() => {
    if (!selected) return;
    const u1 = subscribeEventRegistrations(selected.id, setCandidates);
    const u2 = subscribeEventDocuments(selected.id, setDocuments);
    return () => { u1(); u2(); };
  }, [selected]);

  useEffect(() => {
    if (tab !== 'technieken' || !selected) return;
    const doelgordels = [...new Set(candidates.map(c => c.targetBelt))];
    const kyus = doelgordels.map(g => GORDEL_KYU[g]).filter(Boolean);
    if (kyus.length === 0) { setExamTechnieken([]); return; }
    setLoadingTechnieken(true);
    getAllTechnieken().then(all => {
      setExamTechnieken(all.filter(t => t.kyu_graden?.some(k => kyus.includes(k))));
      setLoadingTechnieken(false);
    });
  }, [tab, selected, candidates]);

  async function createEvent() {
    setSaving(true);
    const r = await addEvent({
      naam: eventForm.name,
      datum: eventForm.date,
      location: eventForm.location,
      examType: eventForm.examType,
      type: 'examen',
    });
    const newEv = { id:r.id, ...eventForm, type:'examen' };
    setSelected(newEv);

    // E1 — examen gepland: verwittig trainers en bestuurslid/admin
    stuurPushTrigger(PUSH_TYPES.EXAMEN_GEPLAND, {
      naam:    eventForm.name,
      datum:   eventForm.date,
      locatie: eventForm.location || '',
    });

    setShowNewEvent(false); setEventForm({ name:'', date:'', location:'', examType:'club' });
    setSaving(false);
  }

  async function addCandidate() {
    if (!selected || !candidateForm.memberId) return;
    const member = members.find(m => m.id === candidateForm.memberId);
    setSaving(true);
    await addRegistration(selected.id, {
      memberId: candidateForm.memberId,
      memberName: member?.name || '—',
      currentBelt: candidateForm.currentBelt,
      targetBelt: candidateForm.targetBelt,
      result: 'pending',
      createdAt: new Date().toISOString(),
    });
    // E4 — uitgenodigd voor examen: stuur naar het lid
    // Noot: member.uid is niet beschikbaar in de members collectie.
    // memberId wordt meegegeven zodat een toekomstige koppeling dit kan gebruiken.
    // De Cloud Function filtert op uid — zonder uid bereikt de push niemand
    // persoonsgericht, maar de trigger wordt wel aangemaakt voor als de koppeling later komt.
    stuurPushTrigger(PUSH_TYPES.UITGENODIGD_EXAMEN, {
      uid:        member?.uid || '',
      memberId:   candidateForm.memberId,
      judokaNaam: member?.name || '—',
      examenNaam: selected.naam || selected.name || '',
      datum:      selected.datum || selected.date || '',
    });

    setShowAddCandidate(false); setCandidateForm({ memberId:'', currentBelt:'wit', targetBelt:'geel' });
    setSaving(false);
  }

  async function setResult(candidate, result) {
    await updateRegistration(selected.id, candidate.id, { result });
    if (result === 'geslaagd') {
      await updateMember(candidate.memberId, { belt: candidate.targetBelt });

      // E3 — graad toegekend: stuur naar het lid
      // Zelfde beperking als E4: candidate.uid is niet beschikbaar.
      // memberId wordt meegegeven voor toekomstige koppeling.
      stuurPushTrigger(PUSH_TYPES.GRAAD_TOEGEKEND, {
        uid:        candidate.uid || '',
        memberId:   candidate.memberId || '',
        judokaNaam: candidate.memberName || '',
        gordel:     candidate.targetBelt || '',
      });
    }
  }

  async function uploadDoc(e) {
    const file = e.target.files[0]; if (!file || !selected) return;
    setUploading(true);
    const storageRef = ref(storage, `events/${selected.id}/docs/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed', null, console.error, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      await addEventDocument(selected.id, { title: file.name, url, uploadedAt: new Date().toISOString() });
      setUploading(false);
    });
  }

  const stats = {
    total: candidates.length,
    geslaagd: candidates.filter(c=>c.result==='geslaagd').length,
    niet: candidates.filter(c=>c.result==='niet_geslaagd').length,
    afwezig: candidates.filter(c=>c.result==='afwezig').length,
  };
  const passRate = stats.total > 0 ? Math.round((stats.geslaagd / (stats.total - stats.afwezig || 1)) * 100) : 0;

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
        <div style={S.title}>📘 Examens</div>
        <button style={S.btn('primary')} onClick={() => setShowNewEvent(true)}>+ Nieuw examen</button>
      </div>

      {events.length > 0 && (
        <div style={S.card}>
          <label style={S.label}>Examen</label>
          <select style={S.select} value={selected?.id||''} onChange={e => setSelected(events.find(ev=>ev.id===e.target.value))}>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.name} — {ev.date}</option>)}
          </select>
        </div>
      )}

      {!selected ? (
        <div style={{ ...S.card, textAlign:'center', color:'#aaa', padding:'40px' }}>Geen examens. Maak een nieuw examen aan.</div>
      ) : (
        <>
          {/* Stats row */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px', marginBottom:'16px' }}>
            {[['Kandidaten',stats.total,'#3498db'],['Geslaagd',stats.geslaagd,'#27ae60'],['Niet geslaagd',stats.niet,'#e74c3c'],['Slaagpercentage',`${passRate}%`,'#f39c12']].map(([l,v,c]) => (
              <div key={l} style={{ background:'#2d2d2d', borderRadius:'8px', padding:'10px', borderLeft:`3px solid ${c}`, textAlign:'center' }}>
                <div style={{ fontSize:'20px', fontWeight:'700' }}>{v}</div>
                <div style={{ color:'#aaa', fontSize:'11px' }}>{l}</div>
              </div>
            ))}
          </div>

          <div style={S.tabs}>
            {[['kandidaten','👥 Kandidaten'],['technieken','🥋 Technieken'],['documenten','📄 Documenten']].map(([key,label]) => (
              <button key={key} style={S.tab(tab===key)} onClick={() => setTab(key)}>{label}</button>
            ))}
          </div>

          {tab === 'kandidaten' && (
            <>
              <button style={{ ...S.btn('primary'), marginBottom:'12px', width:'100%' }} onClick={() => setShowAddCandidate(true)}>+ Kandidaat toevoegen</button>
              {candidates.length === 0 ? (
                <div style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>Geen kandidaten.</div>
              ) : candidates.map(c => (
                <div key={c.id} style={S.candidateRow}>
                  <div>
                    <div style={{ fontWeight:'600', fontSize:'15px' }}>{c.memberName}</div>
                    <div style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'4px' }}>
                      <span style={S.beltBadge(c.currentBelt)}>{c.currentBelt}</span>
                      <span style={{ color:'#aaa' }}>→</span>
                      <span style={S.beltBadge(c.targetBelt)}>{c.targetBelt}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexDirection:'column', alignItems:'flex-end' }}>
                    <span style={{ color: RESULT_COLORS[c.result||'pending'], fontSize:'13px', fontWeight:'600' }}>
                      {RESULT_LABELS[c.result||'pending']}
                    </span>
                    {c.result === 'pending' && (
                      <div style={{ display:'flex', gap:'4px' }}>
                        <button style={{ background:'#27ae60', border:'none', color:'#fff', padding:'4px 8px', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }} onClick={() => setResult(c,'geslaagd')}>✓</button>
                        <button style={{ background:'#e74c3c', border:'none', color:'#fff', padding:'4px 8px', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }} onClick={() => setResult(c,'niet_geslaagd')}>✗</button>
                        <button style={{ background:'#555', border:'none', color:'#fff', padding:'4px 8px', borderRadius:'6px', cursor:'pointer', fontSize:'11px' }} onClick={() => setResult(c,'afwezig')}>—</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'technieken' && (() => {
            const doelgordels = [...new Set(candidates.map(c => c.targetBelt))];
            const kyus = [...new Set(doelgordels.map(g => GORDEL_KYU[g]).filter(Boolean))].sort((a,b) => b - a);
            const KYU_LABEL = { '5':'5e Kyu – Geel', '4':'4e Kyu – Oranje', '3':'3e Kyu – Groen', '2':'2e Kyu – Blauw', '1':'1e Kyu – Bruin' };

            if (candidates.length === 0) return (
              <div style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>
                Voeg eerst kandidaten toe om de relevante technieken te zien.
              </div>
            );
            if (kyus.length === 0) return (
              <div style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>
                Geen kyu-doelgordels gevonden (wit en zwart worden niet gemapt).
              </div>
            );
            if (loadingTechnieken) return (
              <div style={{ display:'flex', justifyContent:'center', padding:'40px' }}>
                <div style={{ width:'28px', height:'28px', border:'3px solid #3a3a3a', borderTop:'3px solid #c0392b', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
              </div>
            );

            return (
              <div>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                {kyus.map(doelkyu => {
                  const techs = examTechnieken.filter(t => t.kyu_graden?.includes(doelkyu));
                  if (techs.length === 0) return null;

                  // Groepeer per type
                  const perType = {};
                  techs.forEach(t => { (perType[t.type] = perType[t.type] || []).push(t); });

                  const toonBasis      = t => parseInt(t.basis_vanaf_kyu)      >= parseInt(doelkyu);
                  const toonVerdieping = t => parseInt(t.verdieping_vanaf_kyu) >= parseInt(doelkyu);

                  return (
                    <div key={doelkyu} style={{ marginBottom:'24px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                        <div style={{ width:'14px', height:'14px', borderRadius:'50%', background: BELT_COLORS[Object.keys(GORDEL_KYU).find(g => GORDEL_KYU[g] === doelkyu)]?.bg || '#aaa', border:'1px solid rgba(255,255,255,0.2)', flexShrink:0 }} />
                        <span style={{ fontWeight:'700', fontSize:'14px' }}>{KYU_LABEL[doelkyu] || `${doelkyu}e Kyu`}</span>
                        <div style={{ flex:1, height:'1px', background:'#3a3a3a' }} />
                        <span style={{ color:'#666', fontSize:'12px' }}>{techs.length} technieken</span>
                      </div>

                      {Object.entries(perType).map(([type, items]) => (
                        <div key={type} style={{ marginBottom:'12px', paddingLeft:'8px' }}>
                          <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'1px', color:'#666', marginBottom:'6px' }}>{type}</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                            {items.map(t => (
                              <button
                                key={t.id}
                                onClick={() => navigate(`/technieken?id=${t.id}`)}
                                title="Bekijk techniek details"
                                style={{
                                  background:'#2d2d2d', border:'1px solid #3a3a3a',
                                  borderRadius:'8px', color:'#fff', cursor:'pointer',
                                  padding:'6px 12px', fontSize:'13px', fontFamily:'inherit',
                                  display:'flex', alignItems:'center', gap:'6px',
                                  transition:'border-color 0.15s, background 0.15s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background='#333'; e.currentTarget.style.borderColor='#c0392b'; }}
                                onMouseLeave={e => { e.currentTarget.style.background='#2d2d2d'; e.currentTarget.style.borderColor='#3a3a3a'; }}
                              >
                                <span>{t.techniek}</span>
                                <span style={{ display:'flex', gap:'3px' }}>
                                  {toonBasis(t) && (
                                    <span style={{ background:'rgba(39,174,96,0.2)', color:'#27ae60', border:'1px solid rgba(39,174,96,0.4)', padding:'1px 5px', borderRadius:'4px', fontSize:'10px', fontWeight:'700' }}>BASIS</span>
                                  )}
                                  {toonVerdieping(t) && (
                                    <span style={{ background:'rgba(52,152,219,0.2)', color:'#3498db', border:'1px solid rgba(52,152,219,0.4)', padding:'1px 5px', borderRadius:'4px', fontSize:'10px', fontWeight:'700' }}>VERDIEPING</span>
                                  )}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {tab === 'documenten' && (
            <div>
              <label style={{ display:'block', background:'#c0392b', border:'none', color:'#fff', padding:'12px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600', textAlign:'center', marginBottom:'12px' }}>
                {uploading ? '⏳ Uploaden...' : '📄 Studiedocument uploaden'}
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={uploadDoc} disabled={uploading} />
              </label>
              {documents.map(d => (
                <div key={d.id} style={{ display:'flex', justifyContent:'space-between', padding:'12px', background:'#2d2d2d', borderRadius:'8px', marginBottom:'6px' }}>
                  <a href={d.url} target="_blank" rel="noreferrer" style={{ color:'#3498db', textDecoration:'none', fontSize:'14px' }}>📄 {d.title}</a>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showNewEvent && (
        <div style={S.modal}>
          <div style={{ ...S.modalCard, maxWidth:'380px' }}>
            <h3 style={{ marginTop:0 }}>Nieuw examen</h3>
            <label style={S.label}>Naam</label>
            <input style={S.input} value={eventForm.name} onChange={e=>setEventForm(f=>({...f,name:e.target.value}))} placeholder="bv. Clubkampioenschap 2025" />
            <label style={S.label}>Datum</label>
            <input style={S.input} type="date" value={eventForm.date} onChange={e=>setEventForm(f=>({...f,date:e.target.value}))} />
            <label style={S.label}>Locatie</label>
            <input style={S.input} value={eventForm.location} onChange={e=>setEventForm(f=>({...f,location:e.target.value}))} />
            <label style={S.label}>Type</label>
            <select style={S.select} value={eventForm.examType} onChange={e=>setEventForm(f=>({...f,examType:e.target.value}))}>
              <option value="club">Clubexamen</option>
              <option value="provinciaal">Provinciaal</option>
              <option value="nationaal">Nationaal</option>
            </select>
            <div style={{ display:'flex', gap:'10px' }}>
              <button style={{ ...S.btn('primary'), flex:1 }} onClick={createEvent} disabled={saving}>{saving?'Opslaan...':'✓ Aanmaken'}</button>
              <button style={S.btn()} onClick={() => setShowNewEvent(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}

      {showAddCandidate && (
        <div style={S.modal}>
          <div style={{ ...S.modalCard, maxWidth:'380px' }}>
            <h3 style={{ marginTop:0 }}>Kandidaat toevoegen</h3>
            <label style={S.label}>Lid</label>
            <select style={S.select} value={candidateForm.memberId} onChange={e=>{
              const m = members.find(m=>m.id===e.target.value);
              setCandidateForm(f=>({ ...f, memberId:e.target.value, currentBelt: m?.belt||'wit', targetBelt: BELT_NEXT[m?.belt||'wit']||'geel' }));
            }}>
              <option value="">— Selecteer lid —</option>
              {members.map(m=><option key={m.id} value={m.id}>{m.name} ({m.belt})</option>)}
            </select>
            <label style={S.label}>Huidige gordel</label>
            <select style={S.select} value={candidateForm.currentBelt} onChange={e=>setCandidateForm(f=>({...f,currentBelt:e.target.value}))}>
              {BELTS.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
            <label style={S.label}>Doelgordel</label>
            <select style={S.select} value={candidateForm.targetBelt} onChange={e=>setCandidateForm(f=>({...f,targetBelt:e.target.value}))}>
              {BELTS.map(b=><option key={b} value={b}>{b}</option>)}
            </select>
            <div style={{ display:'flex', gap:'10px' }}>
              <button style={{ ...S.btn('primary'), flex:1 }} onClick={addCandidate} disabled={saving||!candidateForm.memberId}>{saving?'Opslaan...':'✓ Toevoegen'}</button>
              <button style={S.btn()} onClick={() => setShowAddCandidate(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
