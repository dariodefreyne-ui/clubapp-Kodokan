import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { C, cardStyle, buttonStyle, badgeStyle, chipStyle, tabBarStyle, tabButtonStyle, inputStyle } from '../styles/tokens';

const GROUPS = ['Groep 1','Groep 2','Groep 3','Groep 4','Competitie','Kata'];

const S = {
  page: { minHeight:'100vh', background:'var(--bg-primary)', color:'var(--text-primary)', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  composeCard: { background:'var(--bg-card)', borderRadius:'12px', padding:'16px', marginBottom:'16px' },
  msgCard: { background:'var(--bg-card)', borderRadius:'12px', padding:'16px', marginBottom:'10px', borderLeft:'3px solid var(--accent-red)' },
  input: { width:'100%', background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:'8px', color:'var(--text-primary)', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  textarea: { width:'100%', background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:'8px', color:'var(--text-primary)', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px', minHeight:'100px', resize:'vertical' },
  label: { color:'var(--text-secondary)', fontSize:'12px', marginBottom:'4px', display:'block' },
  btn: (v='primary') => ({ background:v==='primary'?'var(--accent-red)':'var(--border-color)', border:'none', color:'var(--text-primary)', padding:'10px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }),
  groupTag: (selected) => ({ background: selected?'var(--accent-red)':'var(--bg-primary)', border:`1px solid ${selected?'var(--accent-red)':'var(--border-color)'}`, color:'var(--text-primary)', padding:'5px 10px', borderRadius:'14px', cursor:'pointer', fontSize:'12px' }),
  tagRow: { display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'10px' },
  checkRow: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', cursor:'pointer' },
  msgTitle: { fontWeight:'700', fontSize:'16px', marginBottom:'6px' },
  msgBody: { color:'var(--text-primary)', fontSize:'14px', lineHeight:'1.6', marginBottom:'10px' },
  msgMeta: { display:'flex', justifyContent:'space-between', alignItems:'center', color:'var(--text-secondary)', fontSize:'12px' },
  groupBadge: { background:'rgba(230,51,70,0.16)', color:'var(--danger)', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', marginRight:'4px' },
};

export default function Communicatie() {
  const { role } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({ title:'', body:'', sendToAll:true, groups:[] });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const q = query(collection(db,'communications'), orderBy('createdAt','desc'));
    const unsub = onSnapshot(q, snap => { setMessages(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); });
    return unsub;
  }, []);

  function toggleGroup(g) {
    setForm(f => ({
      ...f,
      groups: f.groups.includes(g) ? f.groups.filter(x=>x!==g) : [...f.groups, g]
    }));
  }

  async function handleSend() {
    if (!form.title.trim() || !form.body.trim()) return;
    setSending(true);
    await addDoc(collection(db,'communications'), {
      title: form.title, body: form.body,
      sendToAll: form.sendToAll, groups: form.sendToAll ? [] : form.groups,
      author: role, createdAt: serverTimestamp()
    });
    setForm({ title:'', body:'', sendToAll:true, groups:[] });
    setShowCompose(false);
    setSending(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Bericht verwijderen?')) return;
    await deleteDoc(doc(db,'communications',id));
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={S.title}>📣 Communicatie</div>
        <button style={S.btn('primary')} onClick={() => setShowCompose(s=>!s)}>
          {showCompose ? '✕ Sluiten' : '✍️ Nieuw bericht'}
        </button>
      </div>

      {showCompose && (
        <div style={S.composeCard}>
          <h3 style={{ marginTop:0, color:'var(--accent-red)' }}>Nieuw bericht</h3>
          <label style={S.label}>Onderwerp</label>
          <input style={S.input} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Onderwerp van het bericht" />
          <label style={S.label}>Bericht</label>
          <textarea style={S.textarea} value={form.body} onChange={e=>setForm(f=>({...f,body:e.target.value}))} placeholder="Typ hier uw bericht..." />
          <label style={S.checkRow}>
            <input type="checkbox" checked={form.sendToAll} onChange={e=>setForm(f=>({...f,sendToAll:e.target.checked,groups:[]}))} />
            Aan alle leden
          </label>
          {!form.sendToAll && (
            <>
              <label style={S.label}>Selecteer groepen</label>
              <div style={S.tagRow}>
                {GROUPS.map(g => (
                  <button key={g} style={S.groupTag(form.groups.includes(g))} onClick={() => toggleGroup(g)}>{g}</button>
                ))}
              </div>
            </>
          )}
          <div style={{ display:'flex', gap:'10px' }}>
            <button style={{ ...S.btn('primary'), flex:1 }} onClick={handleSend} disabled={sending||!form.title||!form.body}>
              {sending ? 'Versturen...' : '📨 Publiceren'}
            </button>
            <button style={S.btn()} onClick={() => setShowCompose(false)}>Annuleren</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'40px' }}>Laden...</div> :
       messages.length === 0 ? <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'40px' }}>Geen berichten.</div> :
       messages.map(m => (
        <div key={m.id} style={S.msgCard}>
          <div style={S.msgTitle}>{m.title}</div>
          <div style={S.msgBody}>{m.body}</div>
          <div style={S.msgMeta}>
            <div>
              {m.sendToAll ? (
                <span style={S.groupBadge}>Alle leden</span>
              ) : (m.groups||[]).map(g => <span key={g} style={S.groupBadge}>{g}</span>)}
            </div>
            <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
              <span>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString('nl-BE',{dateStyle:'medium',timeStyle:'short'}) : '—'}</span>
              <span style={{ background:'var(--bg-primary)', padding:'2px 6px', borderRadius:'8px', fontSize:'11px' }}>{m.author||'admin'}</span>
              <button style={{ background:'none', border:'none', color:'var(--danger)', cursor:'pointer', fontSize:'14px', padding:'2px' }} onClick={() => handleDelete(m.id)}>🗑</button>
            </div>
          </div>
        </div>
       ))
      }
    </div>
  );
}
