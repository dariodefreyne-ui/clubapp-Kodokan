import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const TYPES = ['alle','techniek','wedstrijd','examen','reglement','overig'];
const TYPE_LABELS = { alle:'Alle', techniek:'Techniek', wedstrijd:'Wedstrijd', examen:'Examen', reglement:'Reglement', overig:'Overig' };
const TYPE_ICONS = { techniek:'🥋', wedstrijd:'🏆', examen:'📘', reglement:'📋', overig:'📄' };

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  filterRow: { display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' },
  filterBtn: (a) => ({ background: a?'#c0392b':'#2d2d2d', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'20px', cursor:'pointer', fontSize:'13px' }),
  uploadCard: { background:'#2d2d2d', borderRadius:'12px', padding:'20px', marginBottom:'16px', textAlign:'center', border:'2px dashed #3a3a3a' },
  docCard: { background:'#2d2d2d', borderRadius:'10px', padding:'14px', marginBottom:'8px', display:'flex', alignItems:'center', gap:'12px' },
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  select: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  label: { color:'#aaa', fontSize:'12px', marginBottom:'4px', display:'block' },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'16px' },
  modalCard: { background:'#2d2d2d', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'400px' },
  btn: (v='primary') => ({ background:v==='primary'?'#c0392b':'#3a3a3a', border:'none', color:'#fff', padding:'10px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }),
  progress: (pct) => ({ height:'6px', background:'#1a1a1a', borderRadius:'3px', overflow:'hidden', marginTop:'8px', display: pct>0?'block':'none' }),
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

      {loading ? <div style={{ color:'#aaa', textAlign:'center', padding:'40px' }}>Laden...</div> :
       filtered.length === 0 ? <div style={{ color:'#aaa', textAlign:'center', padding:'40px' }}>Geen documenten.</div> :
       filtered.map(d => (
        <div key={d.id} style={S.docCard}>
          <div style={{ fontSize:'28px' }}>{TYPE_ICONS[d.type]||'📄'}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <a href={d.url} target="_blank" rel="noreferrer" style={{ color:'#fff', textDecoration:'none', fontWeight:'600', fontSize:'15px', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {d.title}
            </a>
            <div style={{ color:'#aaa', fontSize:'12px', marginTop:'2px' }}>
              {TYPE_LABELS[d.type]||d.type} · {formatSize(d.fileSize)} · {d.uploadedAt?.toDate ? d.uploadedAt.toDate().toLocaleDateString('nl-BE') : ''}
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <a href={d.url} target="_blank" rel="noreferrer" style={{ background:'#3498db', border:'none', color:'#fff', padding:'8px 12px', borderRadius:'7px', cursor:'pointer', fontSize:'13px', textDecoration:'none' }}>👁 Open</a>
            <button style={{ background:'#e74c3c', border:'none', color:'#fff', padding:'8px 12px', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }} onClick={() => handleDelete(d.id)}>🗑</button>
          </div>
        </div>
       ))
      }

      {showUpload && (
        <div style={S.modal}>
          <div style={S.modalCard}>
            <h3 style={{ marginTop:0 }}>Document uploaden</h3>
            <label style={{ display:'block', background:'#1a1a1a', border:'2px dashed #3a3a3a', borderRadius:'10px', padding:'20px', textAlign:'center', cursor:'pointer', marginBottom:'12px', color:'#aaa' }}>
              {uploadFile ? <span style={{ color:'#fff' }}>📄 {uploadFile.name}</span> : '📁 Klik om bestand te kiezen'}
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
                <div style={{ color:'#aaa', fontSize:'13px', marginBottom:'4px' }}>{progress}% geüpload...</div>
                <div style={S.progress(progress)}>
                  <div style={{ height:'100%', background:'#c0392b', width:`${progress}%`, transition:'width 0.3s' }} />
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
