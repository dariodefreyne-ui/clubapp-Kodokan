import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp, getDocs, getDoc
} from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const MONTHS = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];
const DAYS = ['Zo','Ma','Di','Wo','Do','Vr','Za'];

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'12px' },
  btn: (v='primary') => ({ background: v==='primary'?'#c0392b':v==='ghost'?'transparent':'#3a3a3a', border: v==='ghost'?'1px solid #555':'none', color:'#fff', padding:'10px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }),
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  label: { color:'#aaa', fontSize:'12px', marginBottom:'4px', display:'block' },
  tabs: { display:'flex', gap:'0', marginBottom:'16px', borderBottom:'1px solid #3a3a3a' },
  tab: (a) => ({ background:'none', border:'none', color:a?'#c0392b':'#aaa', padding:'10px 16px', cursor:'pointer', fontSize:'14px', fontWeight:a?'700':'400', borderBottom:a?'2px solid #c0392b':'2px solid transparent' }),
  calGrid: { display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'4px', marginTop:'12px' },
  calDay: (isToday, hasEvent) => ({ background: isToday?'#c0392b':hasEvent?'rgba(192,57,43,0.2)':'#1a1a1a', borderRadius:'6px', padding:'6px', textAlign:'center', fontSize:'13px', fontWeight: isToday||hasEvent?'700':'400', color: isToday?'#fff':hasEvent?'#e74c3c':'#fff', minHeight:'36px', cursor: hasEvent?'pointer':'default', border: hasEvent?'1px solid #c0392b':'1px solid transparent' }),
  competitionCard: { background:'#1a1a1a', borderRadius:'10px', padding:'14px', marginBottom:'8px', border:'1px solid #3a3a3a', cursor:'pointer' },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'16px' },
  modalCard: { background:'#2d2d2d', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'480px', maxHeight:'90vh', overflowY:'auto' },
};

export default function Wedstrijden() {
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('kalender');
  const [calDate, setCalDate] = useState(new Date());
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('info');
  const [members, setMembers] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name:'', date:'', location:'', deadline:'' });
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('date'));
    const unsub = onSnapshot(q, snap => setEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.type==='wedstrijd')));
    return unsub;
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'members')).then(snap => setMembers(snap.docs.map(d=>({id:d.id,...d.data()}))));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const u1 = onSnapshot(query(collection(db,'events',selected.id,'registrations')), snap => setRegistrations(snap.docs.map(d=>({id:d.id,...d.data()}))));
    const u2 = onSnapshot(query(collection(db,'events',selected.id,'documents'),orderBy('uploadedAt','desc')), snap => setDocuments(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return () => { u1(); u2(); };
  }, [selected]);

  async function createEvent() {
    setSaving(true);
    const ref2 = await addDoc(collection(db,'events'), { ...form, type:'wedstrijd', createdAt: serverTimestamp() });
    setSelected({ id: ref2.id, ...form, type:'wedstrijd' });
    setShowNew(false); setForm({ name:'', date:'', location:'', deadline:'' });
    setSaving(false);
  }

  async function addMemberToEvent(member) {
    if (registrations.find(r => r.memberId === member.id)) return;
    await addDoc(collection(db,'events',selected.id,'registrations'), {
      memberId: member.id, memberName: member.name, belt: member.belt, createdAt: serverTimestamp()
    });
  }

  async function removeRegistration(regId) {
    await deleteDoc(doc(db,'events',selected.id,'registrations',regId));
  }

  async function uploadDocument(e) {
    const file = e.target.files[0]; if (!file || !selected) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `events/${selected.id}/docs/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);
      task.on('state_changed', null, console.error, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db,'events',selected.id,'documents'), { title: file.name, url, uploadedAt: serverTimestamp() });
        setUploading(false);
      });
    } catch (err) { console.error(err); setUploading(false); }
  }

  // Calendar helpers
  const year = calDate.getFullYear(), month = calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const today = new Date();
  const eventDates = new Set(events.map(e => e.date));

  const filteredMembers = members.filter(m => m.name?.toLowerCase().includes(memberSearch.toLowerCase()));

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
        <div style={S.title}>🏆 Wedstrijdagenda</div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button style={S.btn('ghost')} onClick={() => setView(v => v==='kalender'?'lijst':'kalender')}>
            {view==='kalender' ? '📋 Lijst' : '📅 Kalender'}
          </button>
          <button style={S.btn('primary')} onClick={() => setShowNew(true)}>+ Wedstrijd</button>
        </div>
      </div>

      {view === 'kalender' && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <button style={S.btn()} onClick={() => setCalDate(new Date(year, month-1, 1))}>‹</button>
            <div style={{ fontWeight:'700', fontSize:'16px' }}>{MONTHS[month]} {year}</div>
            <button style={S.btn()} onClick={() => setCalDate(new Date(year, month+1, 1))}>›</button>
          </div>
          <div style={S.calGrid}>
            {DAYS.map(d => <div key={d} style={{ textAlign:'center', color:'#aaa', fontSize:'11px', fontWeight:'700', padding:'4px' }}>{d}</div>)}
            {Array.from({length: firstDay===0?6:firstDay-1}, (_,i) => <div key={`e${i}`} />)}
            {Array.from({length: daysInMonth}, (_, i) => {
              const d = i+1;
              const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
              const isToday = today.getFullYear()===year && today.getMonth()===month && today.getDate()===d;
              const hasEvent = eventDates.has(dateStr);
              const ev = events.find(e => e.date === dateStr);
              return (
                <div key={d} style={S.calDay(isToday, hasEvent)} onClick={() => ev && setSelected(ev)} title={ev?.name}>
                  {d}
                  {hasEvent && <div style={{ fontSize:'8px', color:'#e74c3c', lineHeight:'1' }}>●</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === 'lijst' && (
        <div>
          {events.length === 0 ? (
            <div style={{ color:'#aaa', textAlign:'center', padding:'40px' }}>Geen wedstrijden gepland.</div>
          ) : events.map(ev => (
            <div key={ev.id} style={S.competitionCard} onClick={() => setSelected(ev)}>
              <div style={{ fontWeight:'700', fontSize:'16px' }}>{ev.name}</div>
              <div style={{ color:'#aaa', fontSize:'13px' }}>{ev.date} · {ev.location||'—'}</div>
              {ev.deadline && <div style={{ color:'#f39c12', fontSize:'12px', marginTop:'4px' }}>Inschrijvingsdeadline: {ev.deadline}</div>}
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={S.modal}>
          <div style={S.modalCard}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
              <div>
                <h3 style={{ margin:0 }}>{selected.name}</h3>
                <div style={{ color:'#aaa', fontSize:'13px' }}>{selected.date} · {selected.location}</div>
              </div>
              <button style={{ background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:'20px' }} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={S.tabs}>
              {['info','inschrijvingen','documenten'].map(t => (
                <button key={t} style={S.tab(detailTab===t)} onClick={() => setDetailTab(t)}>
                  {t==='info'?'ℹ️ Info':t==='inschrijvingen'?'👥 Inschrijvingen':'📄 Documenten'}
                </button>
              ))}
            </div>

            {detailTab === 'info' && (
              <div>
                <div style={{ marginBottom:'8px' }}><span style={{ color:'#aaa', fontSize:'12px' }}>Datum: </span>{selected.date}</div>
                <div style={{ marginBottom:'8px' }}><span style={{ color:'#aaa', fontSize:'12px' }}>Locatie: </span>{selected.location||'—'}</div>
                <div style={{ marginBottom:'8px' }}><span style={{ color:'#aaa', fontSize:'12px' }}>Deadline: </span>{selected.deadline||'—'}</div>
                <div style={{ marginBottom:'8px' }}><span style={{ color:'#aaa', fontSize:'12px' }}>Inschrijvingen: </span>{registrations.length}</div>
              </div>
            )}

            {detailTab === 'inschrijvingen' && (
              <div>
                <div style={{ marginBottom:'12px' }}>
                  <input style={{ ...S.input, marginBottom:'8px' }} placeholder="Zoek lid..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                  <div style={{ maxHeight:'180px', overflowY:'auto' }}>
                    {filteredMembers.filter(m => !registrations.find(r=>r.memberId===m.id)).slice(0,10).map(m => (
                      <div key={m.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px', background:'#1a1a1a', borderRadius:'6px', marginBottom:'4px', alignItems:'center' }}>
                        <span style={{ fontSize:'13px' }}>{m.name} <span style={{ color:'#aaa' }}>({m.belt})</span></span>
                        <button style={{ background:'#c0392b', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }} onClick={() => addMemberToEvent(m)}>+ Add</button>
                      </div>
                    ))}
                  </div>
                </div>
                <h4 style={{ margin:'12px 0 8px', color:'#aaa' }}>Ingeschreven ({registrations.length})</h4>
                {registrations.map(r => (
                  <div key={r.id} style={{ display:'flex', justifyContent:'space-between', padding:'8px', background:'#1a1a1a', borderRadius:'6px', marginBottom:'4px', alignItems:'center' }}>
                    <span style={{ fontSize:'14px' }}>{r.memberName} <span style={{ color:'#aaa', fontSize:'12px' }}>({r.belt})</span></span>
                    <button style={{ background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:'16px' }} onClick={() => removeRegistration(r.id)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {detailTab === 'documenten' && (
              <div>
                <label style={{ display:'block', background:'#c0392b', border:'none', color:'#fff', padding:'10px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600', textAlign:'center', marginBottom:'12px' }}>
                  {uploading ? '⏳ Uploaden...' : '📄 Document uploaden'}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:'none' }} onChange={uploadDocument} disabled={uploading} />
                </label>
                {documents.length === 0 ? (
                  <div style={{ color:'#aaa', textAlign:'center', padding:'20px' }}>Geen documenten.</div>
                ) : documents.map(d => (
                  <div key={d.id} style={{ display:'flex', justifyContent:'space-between', padding:'10px', background:'#1a1a1a', borderRadius:'8px', marginBottom:'6px' }}>
                    <a href={d.url} target="_blank" rel="noreferrer" style={{ color:'#3498db', textDecoration:'none', fontSize:'14px' }}>📄 {d.title}</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showNew && (
        <div style={S.modal}>
          <div style={{ ...S.modalCard, maxWidth:'380px' }}>
            <h3 style={{ marginTop:0 }}>Nieuwe wedstrijd</h3>
            <label style={S.label}>Naam</label>
            <input style={S.input} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="bv. Limburgse Kampioenschappen" />
            <label style={S.label}>Datum</label>
            <input style={S.input} type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
            <label style={S.label}>Locatie</label>
            <input style={S.input} value={form.location} onChange={e=>setForm(f=>({...f,location:e.target.value}))} placeholder="bv. Sporthal Hasselt" />
            <label style={S.label}>Inschrijvingsdeadline</label>
            <input style={S.input} type="date" value={form.deadline} onChange={e=>setForm(f=>({...f,deadline:e.target.value}))} />
            <div style={{ display:'flex', gap:'10px' }}>
              <button style={{ ...S.btn('primary'), flex:1 }} onClick={createEvent} disabled={saving}>{saving?'Opslaan...':'✓ Aanmaken'}</button>
              <button style={S.btn()} onClick={() => setShowNew(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
