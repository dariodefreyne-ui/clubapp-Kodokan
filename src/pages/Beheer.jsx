import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { seedTechnieken } from '../scripts/seedTechnieken';

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'16px' },
  cardTitle: { fontSize:'16px', fontWeight:'700', marginBottom:'12px', color:'#c0392b' },
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  label: { color:'#aaa', fontSize:'12px', marginBottom:'4px', display:'block' },
  btn: (v='primary') => ({ background:v==='primary'?'#c0392b':'#3a3a3a', border:'none', color:'#fff', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontWeight:'600' }),
  row: { display:'flex', gap:'10px', flexWrap:'wrap' },
  pinRow: { display:'flex', gap:'10px', alignItems:'center', marginBottom:'12px' },
  pinLabel: { minWidth:'100px', color:'#aaa', fontSize:'14px' },
  pinInput: { background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', width:'120px', letterSpacing:'4px' },
  roleTag: { background:'rgba(192,57,43,0.2)', color:'#e74c3c', padding:'4px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'600' },
  successMsg: { background:'#27ae60', borderRadius:'8px', padding:'10px 14px', fontSize:'14px', fontWeight:'600', marginBottom:'12px' },
  dangerZone: { background:'#1a1a1a', borderRadius:'10px', padding:'14px', border:'1px solid #e74c3c', marginTop:'8px' },
};

export default function Beheer() {
  const { role, savePins } = useAuth();
  const [settings, setSettings] = useState({ clubname:'Judo Kodokan Merchtem', logoUrl:'' });
  const [pins, setPins] = useState({ beheerder:'', trainer:'' });
  const [showPins, setShowPins] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [seedStatus, setSeedStatus] = useState(''); // '' | 'bezig' | 'klaar'

  useEffect(() => {
    getDoc(doc(db,'settings','club')).then(snap => {
      if (snap.exists()) setSettings(snap.data());
    });
  }, []);

  async function saveSettings() {
    setSaving(true);
    await setDoc(doc(db,'settings','club'), { ...settings, updatedAt: serverTimestamp() }, { merge:true });
    setSaved('Instellingen opgeslagen!');
    setTimeout(() => setSaved(''), 3000);
    setSaving(false);
  }

  // PINs opslaan in Firestore → sync naar alle toestellen automatisch
  async function handleSavePins() {
    if (pins.beheerder && pins.beheerder.length < 4) { alert('PIN moet minstens 4 cijfers zijn'); return; }
    if (pins.trainer   && pins.trainer.length   < 4) { alert('PIN moet minstens 4 cijfers zijn'); return; }
    setSaving(true);
    try {
      // Haal huidige waarden op zodat leeg veld = ongewijzigd
      const currentSnap = await getDoc(doc(db, 'settings', 'pins'));
      const current = currentSnap.exists() ? currentSnap.data() : { beheerder:'1234', trainer:'5678' };
      await savePins(
        pins.beheerder || current.beheerder,
        pins.trainer   || current.trainer,
      );
      setSaved('PINs opgeslagen op alle toestellen!');
      setTimeout(() => setSaved(''), 3000);
      setPins({ beheerder:'', trainer:'' });
    } catch (e) { console.error(e); alert('Fout bij opslaan'); }
    setSaving(false);
  }

  async function resetToDefaults() {
    if (!window.confirm('Reset PINs naar standaard (beheerder: 1234, trainer: 5678)?')) return;
    await savePins('1234', '5678');
    setSaved('PINs gereset op alle toestellen!');
    setTimeout(() => setSaved(''), 3000);
  }

  if (role !== 'beheerder') {
    return (
      <div style={S.page}>
        <div style={{ textAlign:'center', padding:'60px', color:'#aaa' }}>
          <div style={{ fontSize:'48px', marginBottom:'16px' }}>🔒</div>
          <div style={{ fontSize:'18px' }}>Alleen beschikbaar voor beheerders.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.title}>🔧 Beheer</div>

      {saved && <div style={S.successMsg}>✓ {saved}</div>}

      {/* Club info */}
      <div style={S.card}>
        <div style={S.cardTitle}>Clubinstellingen</div>
        <label style={S.label}>Clubnaam</label>
        <input style={S.input} value={settings.clubname||''} onChange={e=>setSettings(s=>({...s,clubname:e.target.value}))} placeholder="Clubnaam" />
        <label style={S.label}>Logo URL (optioneel)</label>
        <input style={S.input} value={settings.logoUrl||''} onChange={e=>setSettings(s=>({...s,logoUrl:e.target.value}))} placeholder="https://..." />
        {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" style={{ maxHeight:'80px', borderRadius:'8px', marginBottom:'10px', objectFit:'contain' }} />}
        <button style={S.btn('primary')} onClick={saveSettings} disabled={saving}>{saving?'Opslaan...':'✓ Opslaan'}</button>
      </div>

      {/* PIN management */}
      <div style={S.card}>
        <div style={S.cardTitle}>PIN configuratie</div>
        <p style={{ color:'#aaa', fontSize:'14px', marginTop:0 }}>Stel de toegangscodes in voor elk rol. Laat leeg om de huidige PIN te behouden.</p>

        <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'16px' }}>
          <button style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}
            onClick={() => setShowPins(s=>!s)}>
            {showPins ? '👁 Verberg invoer' : '🔑 PIN wijzigen'}
          </button>
        </div>

        {showPins && (
          <div>
            <div style={S.pinRow}>
              <span style={S.pinLabel}><span style={S.roleTag}>beheerder</span></span>
              <input style={S.pinInput} type="password" inputMode="numeric" maxLength={8}
                value={pins.beheerder} onChange={e=>setPins(p=>({...p,beheerder:e.target.value.replace(/\D/,'')}))}
                placeholder="Nieuwe PIN" />
            </div>
            <div style={S.pinRow}>
              <span style={S.pinLabel}><span style={{ ...S.roleTag, background:'rgba(52,152,219,0.2)', color:'#3498db' }}>trainer</span></span>
              <input style={S.pinInput} type="password" inputMode="numeric" maxLength={8}
                value={pins.trainer} onChange={e=>setPins(p=>({...p,trainer:e.target.value.replace(/\D/,'')}))}
                placeholder="Nieuwe PIN" />
            </div>
            <div style={S.row}>
              <button style={S.btn('primary')} onClick={handleSavePins} disabled={saving}>✓ PINs opslaan</button>
            </div>

            <div style={S.dangerZone}>
              <div style={{ color:'#e74c3c', fontWeight:'700', marginBottom:'8px' }}>⚠ Gevaarzone</div>
              <p style={{ color:'#aaa', fontSize:'13px', margin:'0 0 10px' }}>Reset PINs naar standaardwaarden (beheerder: 1234, trainer: 5678)</p>
              <button style={{ background:'#e74c3c', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}
                onClick={resetToDefaults}>Reset PINs</button>
            </div>
          </div>
        )}
      </div>

      {/* Seed technieken */}
      <div style={S.card}>
        <div style={S.cardTitle}>Data beheer</div>
        <p style={{ color:'#aaa', fontSize:'13px', marginBottom:'8px', marginTop:0 }}>
          Eenmalige actie: vult de Firestore-collectie <code style={{ background:'#1a1a1a', padding:'2px 6px', borderRadius:'4px', color:'#c0392b' }}>technieken</code> met de standaard techniekdata.
          Wordt automatisch overgeslagen als de data al aanwezig is.
        </p>
        <button
          onClick={async () => {
            setSeedStatus('bezig');
            try {
              await seedTechnieken();
              setSeedStatus('klaar');
            } catch (e) {
              setSeedStatus('');
              alert('Fout bij seeding: ' + e.message);
            }
          }}
          disabled={seedStatus === 'bezig'}
          style={{
            background: seedStatus === 'klaar' ? '#27ae60' : '#c0392b',
            border: 'none', color: '#fff', padding: '10px 16px',
            borderRadius: '8px', cursor: seedStatus === 'bezig' ? 'not-allowed' : 'pointer',
            fontSize: '14px', fontWeight: '600', opacity: seedStatus === 'bezig' ? 0.7 : 1,
          }}
        >
          {seedStatus === 'bezig' ? '⏳ Bezig...' : seedStatus === 'klaar' ? '✓ Geseed' : '🌱 Seed technieken'}
        </button>
      </div>

      {/* App info */}
      <div style={S.card}>
        <div style={S.cardTitle}>App informatie</div>
        <div style={{ display:'grid', gap:'8px' }}>
          {[['Versie','1.0.0'],['Technologie','React + Firebase Firestore'],['Hosting','Firebase Hosting (gratis tier)'],['Authenticatie','PIN-gebaseerd (lokaal)'],['Betaald?','Nee — volledig gratis']].map(([k,v])=>(
            <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #3a3a3a' }}>
              <span style={{ color:'#aaa', fontSize:'13px' }}>{k}</span>
              <span style={{ fontSize:'13px', fontWeight:'500' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Firestore tips */}
      <div style={S.card}>
        <div style={S.cardTitle}>Firebase configuratie</div>
        <p style={{ color:'#aaa', fontSize:'14px', margin:'0 0 12px' }}>
          Om de app te verbinden met Firebase, pas het bestand <code style={{ background:'#1a1a1a', padding:'2px 6px', borderRadius:'4px', color:'#c0392b' }}>src/firebase.js</code> aan met uw eigen Firebase projectinstellingen.
        </p>
        <div style={{ background:'#1a1a1a', borderRadius:'8px', padding:'12px', fontFamily:'monospace', fontSize:'12px', color:'#27ae60', overflowX:'auto' }}>
          {`const firebaseConfig = {\n  apiKey: "uw-api-key",\n  authDomain: "uw-project.firebaseapp.com",\n  projectId: "uw-project-id",\n  storageBucket: "uw-project.appspot.com",\n  messagingSenderId: "123456",\n  appId: "uw-app-id"\n};`}
        </div>
      </div>
    </div>
  );
}
