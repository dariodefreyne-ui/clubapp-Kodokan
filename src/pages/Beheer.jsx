import React, { useState, useEffect } from 'react';
import { collection, doc, getDoc, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { seedTechnieken } from '../scripts/seedTechnieken';
import { migreerSeizoen } from '../scripts/migreerSeizoen';

const ALLE_PAGINAS = [
  { pad: '/trainingen',    label: 'Trainingen',    icon: '📅' },
  { pad: '/leden',         label: 'Leden',         icon: '👥' },
  { pad: '/wedstrijden',   label: 'Wedstrijden',   icon: '🏆' },
  { pad: '/examens',       label: 'Examens',       icon: '📘' },
  { pad: '/technieken',    label: 'Technieken',    icon: '🥋' },
  { pad: '/uitbetalingen', label: 'Uitbetalingen', icon: '💶' },
  { pad: '/winkel',        label: 'Clubwinkel',    icon: '🛒' },
  { pad: '/verkoop',       label: 'Verkoop',       icon: '💳' },
  { pad: '/stock',         label: 'Stock',         icon: '📦' },
  { pad: '/rapporten',     label: 'Rapporten',     icon: '📊' },
  { pad: '/communicatie',  label: 'Communicatie',  icon: '📣' },
  { pad: '/documenten',    label: 'Documenten',    icon: '📁' },
  { pad: '/eetfestijn',    label: 'Eetfestijn',    icon: '🍝' },
  { pad: '/agenda',        label: 'Agenda',         icon: '📅' },
  { pad: '/evenementen',   label: 'Evenementen',    icon: '🎉' },
  { pad: '/beheer',        label: 'Beheer',        icon: '🔧' },
];

const LEEFTIJDSCATEGORIEEN = [
  'U7', 'U9', 'U11', 'U13', 'U14', 'U15', 'U16', 'U18', 'U21', 'Senior',
];

const ROLLEN = ['beheerder', 'trainer', 'lid'];
const ROL_LABELS = { beheerder: 'Beheerder', trainer: 'Trainer', lid: 'Lid' };
const ROL_STANDAARD = {
  beheerder: ['/trainingen','/leden','/wedstrijden','/examens','/technieken','/uitbetalingen','/winkel','/verkoop','/stock','/rapporten','/communicatie','/documenten','/eetfestijn','/agenda','/evenementen','/beheer'],
  trainer:   ['/trainingen','/wedstrijden','/examens','/uitbetalingen','/communicatie','/agenda'],
  lid:       ['/wedstrijden','/examens','/communicatie','/agenda'],
};

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

function GebruikersBeheer() {
  const [users, setUsers] = useState([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setLaden(false);
    });
  }, []);

  const wijzigRol = async (uid, nieuweRol) => {
    await setDoc(doc(db, 'users', uid), { rol: nieuweRol }, { merge: true });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, rol: nieuweRol } : u));
  };

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  return (
    <div>
      {users.map(u => (
        <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #3a3a3a' }}>
          <div>
            <div style={{ fontWeight: '600', color: '#fff' }}>{u.naam || '(Geen naam)'}</div>
            <div style={{ fontSize: '12px', color: '#aaa' }}>{u.email || u.uid.slice(0, 12)}</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
              {(u.groepen || []).length} groep(en)
            </div>
          </div>
          <select
            value={u.rol || 'trainer'}
            onChange={e => wijzigRol(u.uid, e.target.value)}
            style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', color: '#fff', padding: '6px 10px', borderRadius: '6px', fontSize: '13px' }}
          >
            <option value="lid">Lid</option>
            <option value="trainer">Trainer</option>
            <option value="beheerder">Beheerder</option>
          </select>
        </div>
      ))}
      <p style={{ color: '#555', fontSize: '12px', marginTop: '12px' }}>
        Nieuwe accounts: Firebase Console → Authentication → Add user
      </p>
    </div>
  );
}

function LesgeversBeheer() {
  const [lesgevers, setLesgevers] = useState([]);
  const [users, setUsers]         = useState([]);
  const [nieuw, setNieuw]         = useState('');
  const [laden, setLaden]         = useState(true);

  useEffect(() => {
    // 1 read per collectie, parallel
    Promise.all([
      getDocs(collection(db, 'lesgevers')),
      getDocs(collection(db, 'users')),
    ]).then(([lesSnap, usersSnap]) => {
      setLesgevers(
        lesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.naam.localeCompare(b.naam))
      );
      setUsers(
        usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))
          .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''))
      );
      setLaden(false);
    });
  }, []);

  const voegToe = async () => {
    const naam = nieuw.trim();
    if (!naam) return;
    const id = naam.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await setDoc(doc(db, 'lesgevers', id), { naam, actief: true, aangemaakt: new Date().toISOString() });
    setLesgevers(prev => [...prev, { id, naam, actief: true }].sort((a, b) => a.naam.localeCompare(b.naam)));
    setNieuw('');
  };

  const updateVeld = async (l, veld, waarde) => {
    await setDoc(doc(db, 'lesgevers', l.id), { [veld]: waarde }, { merge: true });
    setLesgevers(prev => prev.map(x => x.id === l.id ? { ...x, [veld]: waarde } : x));
  };

  const toggleActief = (l) => updateVeld(l, 'actief', !l.actief);

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  // UIDs al gekoppeld aan andere lesgevers — voorkom dubbele koppeling
  const gekoppeldeUids = new Set(lesgevers.map(l => l.uid).filter(Boolean));

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text" value={nieuw}
          onChange={e => setNieuw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && voegToe()}
          placeholder="Naam nieuwe lesgever"
          style={{ flex: 1, padding: '10px 12px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
        />
        <button onClick={voegToe}
          style={{ padding: '10px 16px', background: '#c0392b', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>
          +
        </button>
      </div>

      {lesgevers.map(l => (
        <div key={l.id} style={{ padding: '12px 0', borderBottom: '1px solid #3a3a3a' }}>
          {/* Naam + actief toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: l.actief ? '#fff' : '#555', fontSize: '14px', textDecoration: l.actief ? 'none' : 'line-through', fontWeight: '600' }}>
              {l.naam}
              {l.uid && <span style={{ fontSize: '11px', color: '#27ae60', marginLeft: '8px', fontWeight: '400' }}>● gekoppeld</span>}
            </span>
            <button onClick={() => toggleActief(l)}
              style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: 'transparent', border: `1px solid ${l.actief ? '#3a3a3a' : '#27ae60'}`, color: l.actief ? '#666' : '#27ae60' }}>
              {l.actief ? 'Deactiveren' : 'Activeren'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* Type */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#666', minWidth: '32px' }}>Type</span>
              <select
                value={l.type || ''}
                onChange={e => updateVeld(l, 'type', e.target.value)}
                style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', color: l.type ? '#fff' : '#666', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', flex: 1 }}
              >
                <option value="">— Kies type —</option>
                <option value="aspirant">Aspirant-trainer</option>
                <option value="initiator">Initiator</option>
                <option value="trainer_b">Trainer B</option>
                <option value="trainer_a">Trainer A</option>
              </select>
            </div>

            {/* Account koppeling */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#666', minWidth: '32px' }}>Account</span>
              <select
                value={l.uid || ''}
                onChange={e => updateVeld(l, 'uid', e.target.value || null)}
                style={{ background: '#1a1a1a', border: `1px solid ${l.uid ? '#27ae60' : '#3a3a3a'}`, color: l.uid ? '#27ae60' : '#666', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', flex: 1 }}
              >
                <option value="">— Geen account —</option>
                {users
                  .filter(u => !gekoppeldeUids.has(u.uid) || u.uid === l.uid)
                  .map(u => (
                    <option key={u.uid} value={u.uid}>{u.naam || u.email}</option>
                  ))
                }
              </select>
            </div>
          </div>
        </div>
      ))}

      <p style={{ color: '#555', fontSize: '12px', marginTop: '12px' }}>
        Koppel elke lesgever aan een account zodat ze automatisch herkend worden bij aanmelden en wedstrijdbegeleiding.
        Gedeactiveerde lesgevers verschijnen niet meer in dropdowns.
      </p>
    </div>
  );
}

function GroepenBeheer() {
  const [groepen, setGroepen] = useState([]);
  const [laden, setLaden]     = useState(true);

  useEffect(() => {
    getDocs(collection(db, 'groepen')).then(snap => {
      setGroepen(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.naam.localeCompare(b.naam)));
      setLaden(false);
    });
  }, []);

  const updateDuur = async (groep, duurMinuten) => {
    const duur = parseInt(duurMinuten);
    if (isNaN(duur) || duur <= 0) return;
    await setDoc(doc(db, 'groepen', groep.id), { duurMinuten: duur }, { merge: true });
    setGroepen(prev => prev.map(g => g.id === groep.id ? { ...g, duurMinuten: duur } : g));
  };

  const toggleCategorie = async (groep, cat) => {
    const huidig = groep.categorieen || [];
    const nieuw = huidig.includes(cat)
      ? huidig.filter(c => c !== cat)
      : [...huidig, cat];
    await setDoc(doc(db, 'groepen', groep.id), { categorieen: nieuw }, { merge: true });
    setGroepen(prev => prev.map(g => g.id === groep.id ? { ...g, categorieen: nieuw } : g));
  };

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  if (groepen.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: '13px', padding: '12px' }}>
        Geen groepen gevonden. Groepen worden aangemaakt bij het importeren van trainingen.
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: '#aaa', fontSize: '13px', marginTop: 0, marginBottom: '12px' }}>
        Stel de standaard trainingsduur per groep in. Deze wordt automatisch overgenomen bij nieuwe trainingen en is manueel aanpasbaar per training.
      </p>
      {groepen.map(g => (
        <div key={g.id} style={{ padding: '14px 0', borderBottom: '1px solid #3a3a3a' }}>
          {/* Naam + dag */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{g.naam}</div>
            {g.dag && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{g.dag}</div>}
          </div>

          {/* Trainingsduur */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trainingsduur</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[45, 60, 90, 120].map(min => (
                <button
                  key={min}
                  onClick={() => updateDuur(g, min)}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                    background: g.duurMinuten === min ? 'rgba(192,57,43,0.2)' : 'transparent',
                    border: `1px solid ${g.duurMinuten === min ? '#c0392b' : '#3a3a3a'}`,
                    color: g.duurMinuten === min ? '#c0392b' : '#666',
                  }}
                >
                  {min >= 60 ? `${Math.floor(min/60)}u${min%60 ? (min%60)+'min' : ''}` : `${min}min`}
                </button>
              ))}
            </div>
          </div>

          {/* Leeftijdscategorieën */}
          <div>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Leeftijdscategorieen</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {LEEFTIJDSCATEGORIEEN.map(cat => {
                const actief = (g.categorieen || []).includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategorie(g, cat)}
                    style={{
                      padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
                      background: actief ? 'rgba(41,128,185,0.2)' : 'transparent',
                      border: `1px solid ${actief ? '#2980b9' : '#3a3a3a'}`,
                      color: actief ? '#2980b9' : '#666',
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaginaRollenBeheer() {
  const [config, setConfig] = useState(null);
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'instellingen', 'paginaRollen')).then(snap => {
      setConfig(snap.exists() ? snap.data() : ROL_STANDAARD);
      setLaden(false);
    });
  }, []);

  const togglePagina = (rol, pad) => {
    setConfig(prev => {
      const huidig = prev[rol] || [];
      const nieuw = huidig.includes(pad)
        ? huidig.filter(p => p !== pad)
        : [...huidig, pad];
      return { ...prev, [rol]: nieuw };
    });
  };

  const slaOp = async () => {
    setOpslaan(true);
    await setDoc(doc(db, 'instellingen', 'paginaRollen'), config);
    setOpslaan(false);
    setSucces(true);
    setTimeout(() => setSucces(false), 2000);
  };

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  return (
    <div>
      {succes && <div style={S.successMsg}>Opgeslagen!</div>}
      {ROLLEN.map(rol => (
        <div key={rol} style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#c0392b', marginBottom: '10px' }}>
            {ROL_LABELS[rol]}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ALLE_PAGINAS.map(p => {
              const actief = (config[rol] || []).includes(p.pad);
              return (
                <button
                  key={p.pad}
                  onClick={() => togglePagina(rol, p.pad)}
                  style={{
                    background: actief ? '#c0392b' : '#1a1a1a',
                    border: `1px solid ${actief ? '#c0392b' : '#3a3a3a'}`,
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: actief ? '600' : '400',
                  }}
                >
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button onClick={slaOp} disabled={opslaan} style={S.btn('primary')}>
        {opslaan ? 'Opslaan...' : 'Opslaan'}
      </button>
    </div>
  );
}

export default function Beheer() {
  const { role } = useAuth();
  const [actieveTab, setActieveTab] = useState('club');
  const [settings, setSettings] = useState({ clubname: 'Judo Kodokan Merchtem', logoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [seedStatus, setSeedStatus] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'settings', 'club')).then(snap => {
      if (snap.exists()) setSettings(snap.data());
    });
  }, []);

  async function saveSettings() {
    setSaving(true);
    await setDoc(doc(db, 'settings', 'club'), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
    setSaved('Instellingen opgeslagen!');
    setTimeout(() => setSaved(''), 3000);
    setSaving(false);
  }

  if (role !== 'beheerder') {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#aaa' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px' }}>Alleen beschikbaar voor beheerders.</div>
        </div>
      </div>
    );
  }

  const TABS = [
    { id: 'club',       label: '🏠 Club' },
    { id: 'gebruikers', label: '👥 Gebruikers' },
    { id: 'paginas',    label: '📄 Paginas' },
    { id: 'groepen',    label: '🥋 Groepen' },
    { id: 'lesgevers',  label: '👤 Lesgevers' },
    { id: 'data',       label: '⚙️ Data' },
  ];

  return (
    <div style={S.page}>
      <div style={S.title}>🔧 Beheer</div>

      {saved && <div style={S.successMsg}>✓ {saved}</div>}

      {/* Tab navigatie */}
      <div style={{
        display: 'flex',
        gap: '0',
        marginBottom: '20px',
        borderBottom: '1px solid #3a3a3a',
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActieveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              color: actieveTab === tab.id ? '#c0392b' : '#aaa',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: actieveTab === tab.id ? '700' : '400',
              borderBottom: actieveTab === tab.id ? '2px solid #c0392b' : '2px solid transparent',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Club */}
      {actieveTab === 'club' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Clubinstellingen</div>
            <label style={S.label}>Clubnaam</label>
            <input
              style={S.input}
              value={settings.clubname || ''}
              onChange={e => setSettings(s => ({ ...s, clubname: e.target.value }))}
              placeholder="Clubnaam"
            />
            <label style={S.label}>Logo URL (optioneel)</label>
            <input
              style={S.input}
              value={settings.logoUrl || ''}
              onChange={e => setSettings(s => ({ ...s, logoUrl: e.target.value }))}
              placeholder="https://..."
            />
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '80px', borderRadius: '8px', marginBottom: '10px', objectFit: 'contain' }} />
            )}
            <button style={S.btn('primary')} onClick={saveSettings} disabled={saving}>
              {saving ? 'Opslaan...' : '✓ Opslaan'}
            </button>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>App informatie</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                ['Versie', '1.0.0'],
                ['Technologie', 'React + Firebase'],
                ['Hosting', 'Firebase Hosting (gratis tier)'],
                ['Authenticatie', 'Firebase Authentication (email)'],
                ['Betaald?', 'Nee — volledig gratis'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #3a3a3a' }}>
                  <span style={{ color: '#aaa', fontSize: '13px' }}>{k}</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: Gebruikers */}
      {actieveTab === 'gebruikers' && (
        <div style={S.card}>
          <div style={S.cardTitle}>👥 Gebruikers</div>
          <GebruikersBeheer />
        </div>
      )}

      {/* Tab: Paginas per rol */}
      {actieveTab === 'paginas' && (
        <div style={S.card}>
          <div style={S.cardTitle}>📄 Paginas per rol</div>
          <PaginaRollenBeheer />
        </div>
      )}

      {/* Tab: Groepen */}
      {actieveTab === 'groepen' && (
        <div style={S.card}>
          <div style={S.cardTitle}>🥋 Groepen & trainingsduur</div>
          <GroepenBeheer />
        </div>
      )}

      {/* Tab: Lesgevers */}
      {actieveTab === 'lesgevers' && (
        <div style={S.card}>
          <div style={S.cardTitle}>👤 Lesgevers</div>
          <LesgeversBeheer />
        </div>
      )}

      {/* Tab: Data */}
      {actieveTab === 'data' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Data beheer</div>
            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px', marginTop: 0 }}>
              Eenmalige actie: vult de Firestore-collectie
              <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', color: '#c0392b' }}>technieken</code>
              met de standaard techniekdata. Wordt overgeslagen als de data al aanwezig is.
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

            <p style={{ color: '#aaa', fontSize: '13px', marginTop: '16px', marginBottom: '8px' }}>
              Eenmalige migratie: voegt het
              <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', color: '#c0392b' }}>seizoen</code>-veld
              toe aan bestaande trainingen zonder seizoen.
            </p>
            <button
              onClick={async () => {
                try {
                  const n = await migreerSeizoen();
                  alert(`${n} trainingen gemigreerd`);
                } catch (e) {
                  alert('Migratie mislukt: ' + e.message);
                }
              }}
              style={{ background: '#2980b9', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
            >
              🔄 Migreer seizoen (eenmalig)
            </button>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Firebase configuratie</div>
            <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 12px' }}>
              Pas <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', color: '#c0392b' }}>src/firebase.js</code> aan met uw eigen Firebase projectinstellingen.
            </p>
            <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#27ae60', overflowX: 'auto' }}>
              {`const firebaseConfig = {\n  apiKey: "uw-api-key",\n  authDomain: "uw-project.firebaseapp.com",\n  projectId: "uw-project-id",\n  storageBucket: "uw-project.appspot.com",\n  messagingSenderId: "123456",\n  appId: "uw-app-id"\n};`}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
