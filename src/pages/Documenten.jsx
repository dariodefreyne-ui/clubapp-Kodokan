import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { C, cardStyle, buttonStyle, badgeStyle, chipStyle, tabBarStyle, tabButtonStyle, inputStyle } from '../styles/tokens';

const TYPES = ['alle','techniek','wedstrijd','examen','reglement','overig'];
const TYPE_LABELS = { alle:'Alle', techniek:'Techniek', wedstrijd:'Wedstrijd', examen:'Examen', reglement:'Reglement', overig:'Overig' };
const TYPE_ICONS = { techniek:'🥋', wedstrijd:'🏆', examen:'📘', reglement:'📋', overig:'📄' };

const S = {
  page: { minHeight:'100vh', background:'var(--bg-primary)', color:'var(--text-primary)', padding:'var(--space-4)' },
  title: { fontSize:'var(--font-size-xl)', fontWeight:'700', marginBottom:'var(--space-4)' },
  filterRow: { display:'flex', gap:'var(--space-2)', flexWrap:'wrap', marginBottom:'var(--space-4)' },
  filterBtn: (a) => ({ background: a?'var(--accent-red)':'var(--bg-card)', border:'none', color:'var(--text-primary)', padding:'var(--space-2) 14px', borderRadius:'20px', cursor:'pointer', fontSize:'var(--font-size-sm)' }),
  uploadCard: { background:'var(--bg-card)', borderRadius:'var(--radius-lg)', padding:'var(--space-5)', marginBottom:'var(--space-4)', textAlign:'center', border:'2px dashed var(--border-color)' },
  docCard: { background:'var(--bg-card)', borderRadius:'10px', padding:'14px', marginBottom:'var(--space-2)', display:'flex', alignItems:'center', gap:'var(--space-3)' },
  input: { width:'100%', background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', padding:'10px', fontSize:'var(--font-size-md)', boxSizing:'border-box', marginBottom:'10px' },
  select: { width:'100%', background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', padding:'10px', fontSize:'var(--font-size-md)', boxSizing:'border-box', marginBottom:'10px' },
  label: { color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', marginBottom:'var(--space-1)', display:'block' },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'var(--space-4)' },
  modalCard: { background:'var(--bg-card)', borderRadius:'var(--radius-xl)', padding:'var(--space-6)', width:'100%', maxWidth:'400px' },
  btn: (v='primary') => ({ background:v==='primary'?'var(--accent-red)':'var(--border-color)', border:'none', color:'var(--text-primary)', padding:'10px var(--space-4)', borderRadius:'var(--radius-md)', cursor:'pointer', fontSize:'var(--font-size-md)', fontWeight:'600' }),
  progress: (pct) => ({ height:'6px', background:'var(--bg-primary)', borderRadius:'3px', overflow:'hidden', marginTop:'var(--space-2)', display: pct>0?'block':'none' }),
};

export default function Documenten() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('alle');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [form, setForm] = useState({ title:'', type:'techniek' });
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const q = query(collection(db,'documents'), orderBy('uploadedAt','desc'));
    const unsub = onSnapshot(q, snap => { setDocs(snap.docs.map(d=>({id:d.id,...d.data()}))); setLoading(false); }, ()=>setLoading(false));
    return unsub;
  }, []);

  const filtered = filter === 'alle' ? docs : docs.filter(d => d.type === filter);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    if (!form.title) setForm(f => ({ ...f, title: file.name.replace(/\.[^.]+$/,'') }));
  }

  async function handleUpload() {
    if (!uploadFile || !form.title) return;
    setUploading(true);
    try {
      const storageRef = ref(storage, `documents/${Date.now()}_${uploadFile.name}`);
      const task = uploadBytesResumable(storageRef, uploadFile);
      task.on('state_changed',
        snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        console.error,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          await addDoc(collection(db,'documents'), { ...form, url, fileName: uploadFile.name, fileSize: uploadFile.size, uploadedAt: serverTimestamp() });
          setShowUpload(false); setUploadFile(null); setForm({ title:'', type:'techniek' }); setProgress(0);
          setUploading(false);
        }
      );
    } catch (e) { console.error(e); setUploading(false); }
  }

  async function handleDelete(id) {
    if (!window.confirm('Document verwijderen?')) return;
    await deleteDoc(doc(db,'documents',id));
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
    return `${(bytes/1024/1024).toFixed(1)} MB`;
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
        <div style={S.title}>📁 Documenten</div>
        <button style={S.btn('primary')} onClick={() => setShowUpload(true)}>+ Uploaden</button>
      </div>

      <div style={S.filterRow}>
        {TYPES.map(t => <button key={t} style={S.filterBtn(filter===t)} onClick={()=>setFilter(t)}>{TYPE_LABELS[t]}</button>)}
      </div>

      {loading ? <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'40px' }}>Laden...</div> :
       filtered.length === 0 ? <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'40px' }}>Geen documenten.</div> :
       filtered.map(d => (
        <div key={d.id} style={S.docCard}>
          <div style={{ fontSize:'28px' }}>{TYPE_ICONS[d.type]||'📄'}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <a href={d.url} target="_blank" rel="noreferrer" style={{ color:'var(--text-primary)', textDecoration:'none', fontWeight:'600', fontSize:'var(--font-size-md)', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {d.title}
            </a>
            <div style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', marginTop:'2px' }}>
              {TYPE_LABELS[d.type]||d.type} · {formatSize(d.fileSize)} · {d.uploadedAt?.toDate ? d.uploadedAt.toDate().toLocaleDateString('nl-BE') : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <a href={d.url} target="_blank" rel="noreferrer" style={{ background:'var(--accent-blue)', border:'none', color:'var(--text-primary)', padding:'var(--space-2) var(--space-3)', borderRadius:'7px', cursor:'pointer', fontSize:'var(--font-size-sm)', textDecoration:'none' }}>👁 Open</a>
            <button style={{ background:'var(--danger)', border:'none', color:'var(--text-primary)', padding:'var(--space-2) var(--space-3)', borderRadius:'7px', cursor:'pointer', fontSize:'var(--font-size-sm)' }} onClick={() => handleDelete(d.id)}>🗑</button>
          </div>
        </div>
       ))
      }

      {showUpload && (
        <div style={S.modal}>
          <div style={S.modalCard}>
            <h3 style={{ marginTop:0 }}>Document uploaden</h3>
            <label style={{ display:'block', background:'var(--bg-primary)', border:'2px dashed var(--border-color)', borderRadius:'10px', padding:'var(--space-5)', textAlign:'center', cursor:'pointer', marginBottom:'var(--space-3)', color:'var(--text-secondary)' }}>
              {uploadFile ? <span style={{ color:'var(--text-primary)' }}>📄 {uploadFile.name}</span> : '📁 Klik om bestand te kiezen'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ display:'none' }} onChange={handleFileChange} />
            </label>
            <label style={S.label}>Titel</label>
            <input style={S.input} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="Naam van het document" />
            <label style={S.label}>Categorie</label>
            <select style={S.select} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              {TYPES.filter(t=>t!=='alle').map(t=><option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
            </select>
            {uploading && (
              <div>
                <div style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', marginBottom:'var(--space-1)' }}>{progress}% geüpload...</div>
                <div style={S.progress(progress)}>
                  <div style={{ height:'100%', background:'var(--accent-red)', width:`${progress}%`, transition:'width 0.3s' }} />
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:'10px', marginTop:'12px' }}>
              <button style={{ ...S.btn('primary'), flex:1 }} onClick={handleUpload} disabled={uploading||!uploadFile||!form.title}>
                {uploading ? 'Uploaden...' : '⬆️ Uploaden'}
              </button>
              <button style={S.btn()} onClick={() => { setShowUpload(false); setUploadFile(null); setProgress(0); }}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
