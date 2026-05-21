import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, updateDoc, deleteDoc,
  collection, getDocs, query, orderBy, where, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useConfirm } from '../contexts/ConfirmContext';

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
  page: { minHeight:'100vh', background:'var(--bg-primary)', color:'var(--text-primary)', padding:'16px' },
  header: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' },
  backBtn: { background:'var(--bg-card)', border:'none', color:'var(--text-primary)', padding:'8px 14px', borderRadius:'var(--radius-md)', cursor:'pointer', fontSize:'var(--font-size-base)' },
  name: { fontSize:'var(--font-size-xl)', fontWeight:'700' },
  tabs: { display:'flex', gap:'8px', marginBottom:'20px', borderBottom:'1px solid var(--border-color)', paddingBottom:'0' },
  tab: (active) => ({ background:'none', border:'none', color: active ? 'var(--accent-red)' : 'var(--text-secondary)', padding:'10px 16px', cursor:'pointer', fontSize:'var(--font-size-md)', fontWeight: active ? '700' : '400', borderBottom: active ? '2px solid var(--accent-red)' : '2px solid transparent' }),
  card: { background:'var(--bg-card)', borderRadius:'var(--radius-lg)', padding:'16px', marginBottom:'12px' },
  label: { color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', marginBottom:'4px' },
  value: { fontSize:'var(--font-size-md)', marginBottom:'12px' },
  input: { width:'100%', background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', padding:'10px', fontSize:'var(--font-size-md)', boxSizing:'border-box', marginBottom:'10px' },
  select: { width:'100%', background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', padding:'10px', fontSize:'var(--font-size-md)', boxSizing:'border-box', marginBottom:'10px' },
  btn: (variant='primary') => ({
    background: variant==='primary' ? 'var(--accent-red)' : variant==='danger' ? 'var(--danger)' : 'var(--bg-card)',
    border:'none', color:'var(--text-primary)', padding:'12px 20px', borderRadius:'var(--radius-md)', cursor:'pointer', fontSize:'var(--font-size-md)', fontWeight:'600'
  }),
  row: { display:'flex', gap:'12px', flexWrap:'wrap' },
  beltBadge: (belt) => ({ ...BELT_COLORS[belt], padding:'3px 10px', borderRadius:'var(--radius-lg)', fontSize:'var(--font-size-sm)', fontWeight:'700', display:'inline-block' }),
  attendanceRow: { display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border-color)' },
  qrContainer: { textAlign:'center', padding:'24px' },
  checkGroup: { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', cursor:'pointer' },
  textarea: { width:'100%', background:'var(--bg-primary)', border:'1px solid var(--border-color)', borderRadius:'var(--radius-md)', color:'var(--text-primary)', padding:'10px', fontSize:'var(--font-size-md)', boxSizing:'border-box', marginBottom:'10px', minHeight:'80px', resize:'vertical' },
};

export default function LidDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profiel');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [attendance, setAttendance] = useState([]);
  const [attendLoading, setAttendLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
      const payload = {
        naam: form.naam?.trim() || '',
        geboortedatum: form.geboortedatum || null,
        email: form.email?.trim() || null,
        telefoon: form.telefoon?.trim() || null,
        gordel: form.gordel || 'wit',
        lidnummer: form.lidnummer?.trim() || null,
        ingeschrevenJaar: form.ingeschrevenJaar ? Number(form.ingeschrevenJaar) : null,
        groepen: form.groepen || [],
        medischeInfo: form.medischeInfo?.trim() || null,
        noodcontactNaam: form.noodcontactNaam?.trim() || null,
        noodcontactTelefoon: form.noodcontactTelefoon?.trim() || null,
        bijdrageBetaald: form.bijdrageBetaald || false,
        bijdrageVervaldatum: form.bijdrageVervaldatum || null,
        actief: form.actief !== false,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, 'members', id), payload);
      setMember({ id, ...payload });
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDelete() {
    const ok = await confirm({
      titel: 'Lid verwijderen?',
      beschrijving: `${member?.naam || 'Dit lid'} wordt definitief uit het ledenbestand verwijderd. Deze actie kan niet ongedaan gemaakt worden.`,
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'members', id));
      navigate('/leden');
    } catch (e) { console.error(e); setDeleting(false); }
  }

  function toggleGroep(g) {
    const groepen = form.groepen || [];
    setForm(f => ({
      ...f,
      groepen: groepen.includes(g) ? groepen.filter(x => x !== g) : [...groepen, g]
    }));
  }

  if (loading) return <div style={S.page}><div style={{ padding:'40px', textAlign:'center', color:'var(--text-secondary)' }}>Laden...</div></div>;
  if (!member) return <div style={S.page}><div style={{ padding:'40px', textAlign:'center', color:'var(--text-secondary)' }}>Lid niet gevonden.</div></div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/leden')}>← Terug</button>
        <div style={S.name}>{member.naam}</div>
        {member.gordel && <span style={S.beltBadge(member.gordel)}>{member.gordel}</span>}
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
                <span style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)' }}>Lidnummer: {member.lidnummer || '—'}</span>
                <span style={{ color: member.actief ? 'var(--success)' : 'var(--danger)', fontSize:'var(--font-size-sm)', fontWeight:'600' }}>
                  {member.actief ? '✓ Actief' : '✗ Inactief'}
                </span>
              </div>
              <Field label="Naam" value={member.naam} />
              <Field label="Geboortedatum" value={member.geboortedatum} />
              <Field label="Email" value={member.email} />
              <Field label="Telefoon" value={member.telefoon} />
              <Field label="Gordel" value={member.gordel ? <span style={S.beltBadge(member.gordel)}>{member.gordel}</span> : '—'} />
              <Field label="Groepen" value={(member.groepen||[]).join(', ') || '—'} />
              <Field label="Lid sinds" value={member.ingeschrevenJaar} />
              <Field label="Bijdrage betaald" value={member.bijdrageBetaald ? `Ja (vervalt ${member.bijdrageVervaldatum||''})` : 'Nee'} />
              <Field label="Medische info" value={member.medischeInfo} />
              <Field label="Noodcontact" value={(member.noodcontactNaam || member.noodcontactTelefoon) ? `${member.noodcontactNaam || ''} ${member.noodcontactTelefoon || ''}`.trim() : '—'} />
              <div style={{ ...S.row, marginTop:'16px' }}>
                <button style={S.btn('primary')} onClick={() => setEditing(true)}>✏️ Bewerken</button>
                <button style={S.btn('danger')} onClick={handleDelete} disabled={deleting}>{deleting ? 'Verwijderen...' : '🗑 Verwijderen'}</button>
              </div>
            </div>
          ) : (
            <div style={S.card}>
              <h3 style={{ marginTop:0, marginBottom:'16px' }}>Lid bewerken</h3>
              <label style={S.label}>Naam</label>
              <input style={S.input} value={form.naam||''} onChange={e => setForm(f=>({...f,naam:e.target.value}))} />
              <label style={S.label}>Geboortedatum</label>
              <input style={S.input} type="date" value={form.geboortedatum||''} onChange={e => setForm(f=>({...f,geboortedatum:e.target.value}))} />
              <label style={S.label}>Email</label>
              <input style={S.input} type="email" value={form.email||''} onChange={e => setForm(f=>({...f,email:e.target.value}))} />
              <label style={S.label}>Telefoon</label>
              <input style={S.input} value={form.telefoon||''} onChange={e => setForm(f=>({...f,telefoon:e.target.value}))} />
              <label style={S.label}>Gordel</label>
              <select style={S.select} value={form.gordel||'wit'} onChange={e => setForm(f=>({...f,gordel:e.target.value}))}>
                {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <label style={S.label}>Lidnummer</label>
              <input style={S.input} value={form.lidnummer||''} onChange={e => setForm(f=>({...f,lidnummer:e.target.value}))} />
              <label style={S.label}>Lid sinds (jaar)</label>
              <input style={S.input} type="number" value={form.ingeschrevenJaar||''} onChange={e => setForm(f=>({...f,ingeschrevenJaar:e.target.value}))} />
              <label style={S.label}>Groepen</label>
              {GROUPS.map(g => (
                <label key={g} style={S.checkGroup}>
                  <input type="checkbox" checked={(form.groepen||[]).includes(g)} onChange={() => toggleGroep(g)} />
                  {g}
                </label>
              ))}
              <label style={S.label}>Medische info</label>
              <textarea style={S.textarea} value={form.medischeInfo||''} onChange={e => setForm(f=>({...f,medischeInfo:e.target.value}))} />
              <label style={S.label}>Noodcontact naam</label>
              <input style={S.input} value={form.noodcontactNaam||''} onChange={e => setForm(f=>({...f,noodcontactNaam:e.target.value}))} />
              <label style={S.label}>Noodcontact telefoon</label>
              <input style={S.input} value={form.noodcontactTelefoon||''} onChange={e => setForm(f=>({...f,noodcontactTelefoon:e.target.value}))} />
              <label style={S.checkGroup}>
                <input type="checkbox" checked={form.bijdrageBetaald||false} onChange={e => setForm(f=>({...f,bijdrageBetaald:e.target.checked}))} />
                Bijdrage betaald
              </label>
              <label style={S.label}>Vervaldatum bijdrage</label>
              <input style={S.input} type="date" value={form.bijdrageVervaldatum||''} onChange={e => setForm(f=>({...f,bijdrageVervaldatum:e.target.value}))} />
              <label style={S.checkGroup}>
                <input type="checkbox" checked={form.actief!==false} onChange={e => setForm(f=>({...f,actief:e.target.checked}))} />
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
          {attendLoading ? <div style={{ color:'var(--text-secondary)' }}>Laden...</div> :
           attendance.length === 0 ? <div style={{ color:'var(--text-secondary)' }}>Nog geen aanwezigheden.</div> :
           attendance.map(a => (
             <div key={a.id} style={S.attendanceRow}>
               <span>{a.date}</span>
               <span style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)' }}>{a.trainingGroup || a.trainingId || '—'}</span>
               <span style={{ color:'var(--success)', fontSize:'var(--font-size-sm)' }}>✓ Aanwezig</span>
             </div>
           ))
          }
          <div style={{ marginTop:'12px', color:'var(--text-secondary)', fontSize:'var(--font-size-sm)' }}>{attendance.length} trainingen bijgewoond</div>
        </div>
      )}

      {tab === 'qr' && (
        <div style={S.card}>
          <div style={S.qrContainer}>
            <h3 style={{ marginTop:0 }}>QR Check-in code</h3>
            <p style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)' }}>Scan om aanwezigheid te registreren</p>
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code" style={{ borderRadius:'var(--radius-lg)', border:'4px solid #fff' }} />
            ) : (
              <div style={{ color:'var(--text-secondary)', padding:'40px' }}>QR genereren...</div>
            )}
            <p style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', marginTop:'12px' }}>Lid ID: {id}</p>
          </div>
        </div>
      )}

      {tab === 'aankopen' && (
        <div style={S.card}>
          <h3 style={{ marginTop:0 }}>Aankopen</h3>
          {aankopenLaden ? (
            <div style={{ color:'var(--text-secondary)' }}>Laden...</div>
          ) : aankopen.length === 0 ? (
            <div style={{ color:'var(--text-secondary)' }}>Geen aankopen geregistreerd</div>
          ) : (
            aankopen.map(s => {
              const ts = s.aangemaaktOp || s.createdAt;
              const datum = ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '—';
              const bedrag = Number(s.totaal ?? s.total ?? 0);
              const samenvatting = (s.items || []).map(i => `${i.name} ${i.variant} x${i.qty}`).join(', ');
              return (
                <div key={s.id} style={{ padding:'10px 0', borderBottom:'1px solid var(--border-color)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                    <div style={{ fontSize:'var(--font-size-sm)', color:'var(--text-secondary)' }}>{datum}</div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {s.betaald === false && (
                        <span style={{ background:'var(--danger)', color:'var(--text-primary)', fontSize:'var(--font-size-xs)', fontWeight:'700', padding:'2px 7px', borderRadius:'10px' }}>Openstaand</span>
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
                      return <span style={{ background: isOvs ? '#3498db' : 'var(--success)', color:'var(--text-primary)', fontSize:'var(--font-size-xs)', fontWeight:'700', padding:'2px 7px', borderRadius:'10px', textTransform:'capitalize' }}>{m}</span>;
                    })()}
                    {s.betaald !== false && (
                      <span style={{ background:'var(--success)', color:'var(--text-primary)', fontSize:'var(--font-size-xs)', fontWeight:'700', padding:'2px 7px', borderRadius:'10px' }}>Betaald</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{ marginBottom:'10px' }}>
      <div style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', marginBottom:'2px' }}>{label}</div>
      <div style={{ fontSize:'var(--font-size-md)' }}>{value || '—'}</div>
    </div>
  );
}
