import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, deleteDoc,
  collection, getDocs, query, orderBy, where, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const BELTS = ['wit','geel','oranje','groen','blauw','bruin','zwart'];
const BELT_COLORS = {
  wit:    { bg:'#ffffff', color:'#333', border:'1px solid #ccc' },
  geel:   { bg:'#f1c40f', color:'#333', border:'none' },
  oranje: { bg:'#e67e22', color:'#fff', border:'none' },
  groen:  { bg:'#27ae60', color:'#fff', border:'none' },
  blauw:  { bg:'#3498db', color:'#fff', border:'none' },
  bruin:  { bg:'#8B4513', color:'#fff', border:'none' },
  zwart:  { bg:'#1a1a1a', color:'#fff', border:'1px solid #555' },
};
const GROUPS = ['Groep 1','Groep 2','Groep 3','Groep 4','Competitie','Kata'];

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  header: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' },
  backBtn: { background:'#2d2d2d', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'16px' },
  name: { fontSize:'22px', fontWeight:'700' },
  tabs: { display:'flex', gap:'8px', marginBottom:'20px', borderBottom:'1px solid #3a3a3a', paddingBottom:'0' },
  tab: (active) => ({ background:'none', border:'none', color: active ? '#c0392b' : '#aaa', padding:'10px 16px', cursor:'pointer', fontSize:'15px', fontWeight: active ? '700' : '400', borderBottom: active ? '2px solid #c0392b' : '2px solid transparent' }),
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'12px' },
  label: { color:'#aaa', fontSize:'12px', marginBottom:'4px' },
  value: { fontSize:'15px', marginBottom:'12px' },
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  select: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  btn: (variant='primary') => ({
    background: variant==='primary' ? '#c0392b' : variant==='danger' ? '#e74c3c' : '#2d2d2d',
    border:'none', color:'#fff', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontWeight:'600'
  }),
  row: { display:'flex', gap:'12px', flexWrap:'wrap' },
  beltBadge: (belt) => ({ ...BELT_COLORS[belt], padding:'3px 10px', borderRadius:'12px', fontSize:'12px', fontWeight:'700', display:'inline-block' }),
  attendanceRow: { display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #3a3a3a' },
  qrContainer: { textAlign:'center', padding:'24px' },
  checkGroup: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', cursor:'pointer' },
  textarea: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px', minHeight:'80px', resize:'vertical' },
};

export default function LidDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profiel');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [attendance, setAttendance] = useState([]);
  const [attendLoading, setAttendLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [aankopen, setAankopen] = useState([]);
  const [aankopenLaden, setAankopenLaden] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchMember();
  }, [id]);

  useEffect(() => {
    if (tab === 'aanwezigheid') fetchAttendance();
    if (tab === 'qr') generateQr();
    if (tab === 'aankopen') fetchAankopen();
  }, [tab]);

  async function fetchMember() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'members', id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setMember(data);
        setForm(data);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchAttendance() {
    setAttendLoading(true);
    try {
      const q = query(collection(db, 'members', id, 'attendance'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
    setAttendLoading(false);
  }

  async function fetchAankopen() {
    setAankopenLaden(true);
    try {
      const q = query(collection(db, 'sales'), where('koperId', '==', id));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const ta = (a.aangemaaktOp || a.createdAt)?.toMillis?.() || 0;
        const tb = (b.aangemaaktOp || b.createdAt)?.toMillis?.() || 0;
        return tb - ta;
      });
      setAankopen(items);
    } catch (e) { console.error(e); }
    setAankopenLaden(false);
  }

  async function generateQr() {
    try {
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(`kodokan-lid:${id}`, { width: 250, margin: 2, color: { dark: '#000', light: '#fff' } });
      setQrDataUrl(url);
    } catch (e) { console.error('QR error', e); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const { id: _id, ...data } = form;
      await updateDoc(doc(db, 'members', id), { ...data, updatedAt: serverTimestamp() });
      setMember({ ...form });
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'members', id));
      navigate('/leden');
    } catch (e) { console.error(e); setDeleting(false); }
  }

  function toggleGroup(g) {
    const groups = form.groups || [];
    setForm(f => ({ ...f, groups: groups.includes(g) ? groups.filter(x => x !== g) : [...groups, g] }));
  }

  if (loading) return <div style={S.page}><div style={{ padding:'40px', textAlign:'center', color:'#aaa' }}>Laden...</div></div>;
  if (!member) return <div style={S.page}><div style={{ padding:'40px', textAlign:'center', color:'#aaa' }}>Lid niet gevonden.</div></div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/leden')}>← Terug</button>
        <div style={S.name}>{member.name}</div>
        {member.belt && <span style={S.beltBadge(member.belt)}>{member.belt}</span>}
      </div>

      <div style={S.tabs}>
        {['profiel','aanwezigheid','aankopen','qr'].map(t => (
          <button key={t} style={S.tab(tab===t)} onClick={() => setTab(t)}>
            {t === 'profiel' ? '👤 Profiel' : t === 'aanwezigheid' ? '📅 Aanwezigheid' : t === 'aankopen' ? '🛒 Aankopen' : '📱 QR Code'}
          </button>
        ))}
      </div>

      {tab === 'profiel' && (
        <div>
          {!editing ? (
            <div style={S.card}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'16px' }}>
                <span style={{ color:'#aaa', fontSize:'13px' }}>Lidnummer: {member.memberNumber || '—'}</span>
                <span style={{ color: member.active ? '#27ae60' : '#e74c3c', fontSize:'13px', fontWeight:'600' }}>
                  {member.active ? '✓ Actief' : '✗ Inactief'}
                </span>
              </div>
              <Field label="Naam" value={member.name} />
              <Field label="Geboortedatum" value={member.birthdate} />
              <Field label="Email" value={member.email} />
              <Field label="Telefoon" value={member.phone} />
              <Field label="Gordel" value={member.belt ? <span style={S.beltBadge(member.belt)}>{member.belt}</span> : '—'} />
              <Field label="Groepen" value={(member.groups||[]).join(', ') || '—'} />
              <Field label="Lid sinds" value={member.joinYear} />
              <Field label="Bijdrage betaald" value={member.subscription?.paid ? `Ja (vervalt ${member.subscription.expires||''})` : 'Nee'} />
              <Field label="Medische info" value={member.medicalInfo} />
              <Field label="Noodcontact" value={member.emergencyContact ? `${member.emergencyContact.name || ''} ${member.emergencyContact.phone || ''}` : '—'} />
              <div style={{ ...S.row, marginTop:'16px' }}>
                <button style={S.btn('primary')} onClick={() => setEditing(true)}>✏️ Bewerken</button>
                <button style={S.btn('danger')} onClick={() => setConfirmDelete(true)}>🗑 Verwijderen</button>
              </div>
            </div>
          ) : (
            <div style={S.card}>
              <h3 style={{ marginTop:0, marginBottom:'16px' }}>Lid bewerken</h3>
              <label style={S.label}>Naam</label>
              <input style={S.input} value={form.name||''} onChange={e => setForm(f=>({...f,name:e.target.value}))} />
              <label style={S.label}>Geboortedatum</label>
              <input style={S.input} type="date" value={form.birthdate||''} onChange={e => setForm(f=>({...f,birthdate:e.target.value}))} />
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" value={form.email||''} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
              <label style={S.label}>Telefoon</label>
              <input style={S.input} value={form.phone||''} onChange={e => setForm(f=>({...f,phone:e.target.value}))} />
              <label style={S.label}>Gordel</label>
              <select style={S.select} value={form.belt||'wit'} onChange={e => setForm(f=>({...f,belt:e.target.value}))}>
                {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <label style={S.label}>Lidnummer</label>
              <input style={S.input} value={form.memberNumber||''} onChange={e => setForm(f=>({...f,memberNumber:e.target.value}))} />
              <label style={S.label}>Lid sinds (jaar)</label>
              <input style={S.input} type="number" value={form.joinYear||''} onChange={e => setForm(f=>({...f,joinYear:e.target.value}))} />
              <label style={S.label}>Groepen</label>
              {GROUPS.map(g => (
                <label key={g} style={S.checkGroup}>
                  <input type="checkbox" checked={(form.groups||[]).includes(g)} onChange={() => toggleGroup(g)} />
                  {g}
                </label>
              ))}
              <label style={S.label}>Medische info</label>
              <textarea style={S.textarea} value={form.medicalInfo||''} onChange={e => setForm(f=>({...f,medicalInfo:e.target.value}))} />
              <label style={S.label}>Noodcontact naam</label>
              <input style={S.input} value={form.emergencyContact?.name||''} onChange={e => setForm(f=>({...f,emergencyContact:{...f.emergencyContact,name:e.target.value}}))} />
              <label style={S.label}>Noodcontact telefoon</label>
              <input style={S.input} value={form.emergencyContact?.phone||''} onChange={e => setForm(f=>({...f,emergencyContact:{...f.emergencyContact,phone:e.target.value}}))} />
              <label style={S.checkGroup}>
                <input type="checkbox" checked={form.subscription?.paid||false} onChange={e => setForm(f=>({...f,subscription:{...f.subscription,paid:e.target.checked}}))} />
                Bijdrage betaald
              </label>
              <label style={S.label}>Vervaldatum bijdrage</label>
              <input style={S.input} type="date" value={form.subscription?.expires||''} onChange={e => setForm(f=>({...f,subscription:{...f.subscription,expires:e.target.value}}))} />
              <label style={S.checkGroup}>
                <input type="checkbox" checked={form.active!==false} onChange={e => setForm(f=>({...f,active:e.target.checked}))} />
                Actief lid
              </label>
              <div style={{ ...S.row, marginTop:'16px' }}>
                <button style={S.btn('primary')} onClick={handleSave} disabled={saving}>{saving ? 'Opslaan...' : '✓ Opslaan'}</button>
                <button style={S.btn()} onClick={() => { setEditing(false); setForm(member); }}>Annuleren</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'aanwezigheid' && (
        <div style={S.card}>
          <h3 style={{ marginTop:0 }}>Aanwezigheidsgeschiedenis</h3>
          {attendLoading ? <div style={{ color:'#aaa' }}>Laden...</div> :
           attendance.length === 0 ? <div style={{ color:'#aaa' }}>Nog geen aanwezigheden.</div> :
           attendance.map(a => (
             <div key={a.id} style={S.attendanceRow}>
               <span>{a.date}</span>
               <span style={{ color:'#aaa', fontSize:'13px' }}>{a.trainingGroup || a.trainingId || '—'}</span>
               <span style={{ color:'#27ae60', fontSize:'13px' }}>✓ Aanwezig</span>
             </div>
           ))
          }
          <div style={{ marginTop:'12px', color:'#aaa', fontSize:'13px' }}>{attendance.length} trainingen bijgewoond</div>
        </div>
      )}

      {tab === 'qr' && (
        <div style={S.card}>
          <div style={S.qrContainer}>
            <h3 style={{ marginTop:0 }}>QR Check-in code</h3>
            <p style={{ color:'#aaa', fontSize:'13px' }}>Scan om aanwezigheid te registreren</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" style={{ borderRadius:'12px', border:'4px solid #fff' }} />
            ) : (
              <div style={{ color:'#aaa', padding:'40px' }}>QR genereren...</div>
            )}
            <p style={{ color:'#aaa', fontSize:'12px', marginTop:'12px' }}>Lid ID: {id}</p>
          </div>
        </div>
      )}

      {tab === 'aankopen' && (
        <div style={S.card}>
          <h3 style={{ marginTop:0 }}>Aankopen</h3>
          {aankopenLaden ? (
            <div style={{ color:'#aaa' }}>Laden...</div>
          ) : aankopen.length === 0 ? (
            <div style={{ color:'#aaa' }}>Geen aankopen geregistreerd</div>
          ) : (
            aankopen.map(s => {
              const ts = s.aangemaaktOp || s.createdAt;
              const datum = ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '—';
              const bedrag = Number(s.totaal ?? s.total ?? 0);
              const samenvatting = (s.items || []).map(i => `${i.name} ${i.variant} x${i.qty}`).join(', ');
              return (
                <div key={s.id} style={{ padding:'10px 0', borderBottom:'1px solid #3a3a3a' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                    <div style={{ fontSize:'13px', color:'#aaa' }}>{datum}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {s.betaald === false && (
                        <span style={{ background:'#e74c3c', color:'#fff', fontSize:'11px', fontWeight:'700', padding:'2px 7px', borderRadius:'10px' }}>Openstaand</span>
                      )}
                      <span style={{ fontWeight:'700', fontSize:'15px' }}>
                        €{bedrag % 1 === 0 ? Math.round(bedrag) : bedrag.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div style={{ fontSize:'13px' }}>{samenvatting || '—'}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'4px', flexWrap:'wrap' }}>
                    {(() => {
                      const m = s.betaalmethode || s.paymentMethod;
                      if (!m) return null;
                      const isOvs = m.toLowerCase().includes('overschrijving');
                      return <span style={{ background: isOvs ? '#3498db' : '#27ae60', color:'#fff', fontSize:'11px', fontWeight:'700', padding:'2px 7px', borderRadius:'10px', textTransform:'capitalize' }}>{m}</span>;
                    })()}
                    {s.betaald !== false && (
                      <span style={{ background:'#27ae60', color:'#fff', fontSize:'11px', fontWeight:'700', padding:'2px 7px', borderRadius:'10px' }}>Betaald</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {confirmDelete && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100 }}>
          <div style={{ background:'#2d2d2d', borderRadius:'16px', padding:'24px', maxWidth:'320px', width:'90%' }}>
            <h3 style={{ marginTop:0 }}>Lid verwijderen?</h3>
            <p style={{ color:'#aaa' }}>Dit kan niet ongedaan worden gemaakt.</p>
            <div style={S.row}>
              <button style={S.btn('danger')} onClick={handleDelete} disabled={deleting}>{deleting ? 'Verwijderen...' : 'Ja, verwijderen'}</button>
              <button style={S.btn()} onClick={() => setConfirmDelete(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom:'10px' }}>
      <div style={{ color:'#aaa', fontSize:'12px', marginBottom:'2px' }}>{label}</div>
      <div style={{ fontSize:'15px' }}>{value || '—'}</div>
    </div>
  );
}
