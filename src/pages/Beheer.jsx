import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { seedTechnieken } from '../scripts/seedTechnieken';
import { migreerSeizoen } from '../scripts/migreerSeizoen';

const ALLE_PAGINAS = [
  { pad: '/trainingen', label: 'Trainingen', icon: '📅' },
  { pad: '/leden', label: 'Leden', icon: '👥' },
  { pad: '/wedstrijden', label: 'Wedstrijden', icon: '🏆' },
  { pad: '/examens', label: 'Examens', icon: '📘' },
  { pad: '/technieken', label: 'Technieken', icon: '🥋' },
  { pad: '/uitbetalingen', label: 'Uitbetalingen', icon: '💶' },
  { pad: '/winkel', label: 'Winkel', icon: '🛒' },
  { pad: '/rapporten', label: 'Rapporten', icon: '📊' },
  { pad: '/communicatie', label: 'Communicatie', icon: '📣' },
  { pad: '/documenten', label: 'Documenten', icon: '📁' },
  { pad: '/eetfestijn', label: 'Eetfestijn', icon: '🍝' },
  { pad: '/agenda', label: 'Agenda', icon: '📅' },
  { pad: '/evenementen', label: 'Evenementen', icon: '🎉' },
  { pad: '/beheer', label: 'Beheer', icon: '🔧' },
];

const LEEFTIJDSCATEGORIEEN = [
  'U7', 'U9', 'U11', 'U13', 'U14', 'U15', 'U16', 'U18', 'U21', 'Senior',
];

const ROLLEN = ['beheerder', 'trainer', 'lid'];
const ROL_LABELS = { beheerder: 'Beheerder', trainer: 'Trainer', lid: 'Lid' };
const ROL_STANDAARD = {
  beheerder: ['/trainingen','/leden','/wedstrijden','/examens','/technieken','/uitbetalingen','/winkel','/rapporten','/communicatie','/documenten','/eetfestijn','/agenda','/evenementen','/beheer'],
  trainer: ['/trainingen','/wedstrijden','/examens','/uitbetalingen','/winkel','/communicatie','/agenda'],
  lid: ['/wedstrijden','/examens','/communicatie','/agenda'],
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

function rolBadge(rol) {
  const config = {
    beheerder: { kleur: '#c0392b', label: 'Beheerder' },
    trainer: { kleur: '#2980b9', label: 'Trainer' },
    lid: { kleur: '#555', label: 'Lid' },
  };
  const c = config[rol] || config.lid;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: c.kleur + '33',
      color: c.kleur,
      border: '1px solid ' + c.kleur,
      marginLeft: '8px',
    }}>
      {c.label}
    </span>
  );
}

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

  const aantalPerRol = users.reduce((acc, u) => {
    const r = u.rol || 'lid';
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { rol: 'beheerder', kleur: '#c0392b', label: 'Beheerders' },
          { rol: 'trainer', kleur: '#2980b9', label: 'Trainers' },
          { rol: 'lid', kleur: '#555', label: 'Leden' },
        ].map(({ rol, kleur, label }) => (
          <div key={rol} style={{
            background: kleur + '22',
            border: '1px solid ' + kleur + '55',
            borderRadius: '8px',
            padding: '8px 14px',
            fontSize: '13px',
            color: kleur,
            fontWeight: '600',
          }}>
            {aantalPerRol[rol] || 0} {label}
          </div>
        ))}
      </div>

      {users
        .sort((a, b) => {
          const volgorde = { beheerder: 0, trainer: 1, lid: 2 };
          return (volgorde[a.rol] ?? 3) - (volgorde[b.rol] ?? 3);
        })
        .map(u => (
          <div key={u.uid} style={{ padding: '14px 0', borderBottom: '1px solid #3a3a3a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                  <span style={{ fontWeight: '600', color: '#fff', fontSize: '14px' }}>
                    {u.naam || '(Geen naam)'}
                  </span>
                  {rolBadge(u.rol)}
                </div>
                <div style={{ fontSize: '12px', color: '#aaa', marginTop: '4px' }}>
                  {u.email || u.uid.slice(0, 16)}
                </div>
                {u.aangemaakt && (
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    Aangemaakt: {new Date(u.aangemaakt?.toDate?.() || u.aangemaakt).toLocaleDateString('nl-BE')}
                  </div>
                )}
              </div>
              <select
                value={u.rol || 'lid'}
                onChange={e => wijzigRol(u.uid, e.target.value)}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  color: '#fff',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginLeft: '12px',
                  flexShrink: 0,
                }}
              >
                <option value="lid">Lid</option>
                <option value="trainer">Trainer</option>
                <option value="beheerder">Beheerder</option>
              </select>
            </div>
          </div>
        ))}

      <p style={{ color: '#555', fontSize: '12px', marginTop: '12px' }}>
        Nieuwe gebruikers kunnen zelf een account aanmaken via het inlogscherm. Wijs hier de juiste rol toe.
      </p>
    </div>
  );
}

function LesgeversBeheer() {
  const [lesgevers, setLesgevers] = useState([]);
  const [users, setUsers] = useState([]);
  const [groepen, setGroepen] = useState([]);
  const [nieuw, setNieuw] = useState('');
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    Promise.all([
      getDocs(collection(db, 'lesgevers')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'groepen')),
    ]).then(([lesSnap, usersSnap, groepenSnap]) => {
      setLesgevers(
        lesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.naam.localeCompare(b.naam))
      );
      setUsers(
        usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }))
          .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''))
      );
      setGroepen(
        groepenSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.naam.localeCompare(b.naam))
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

  // UIDs al gekoppeld aan andere lesgevers: voorkom dubbele koppeling
  const gekoppeldeUids = new Set(lesgevers.map(l => l.uid).filter(Boolean));

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          type="text"
          value={nieuw}
          onChange={e => setNieuw(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && voegToe()}
          placeholder="Naam nieuwe lesgever"
          style={{ flex: 1, padding: '10px 12px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '14px' }}
        />
        <button
          onClick={voegToe}
          style={{ padding: '10px 16px', background: '#c0392b', border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontWeight: '700' }}
        >
          +
        </button>
      </div>

      {lesgevers.map(l => (
        <div key={l.id} style={{ padding: '12px 0', borderBottom: '1px solid #3a3a3a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ color: l.actief ? '#fff' : '#555', fontSize: '14px', textDecoration: l.actief ? 'none' : 'line-through', fontWeight: '600' }}>
              {l.naam}
              {l.uid && <span style={{ fontSize: '11px', color: '#27ae60', marginLeft: '8px', fontWeight: '400' }}>● gekoppeld</span>}
            </span>
            <button
              onClick={() => toggleActief(l)}
              style={{ padding: '4px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: 'transparent', border: `1px solid ${l.actief ? '#3a3a3a' : '#27ae60'}`, color: l.actief ? '#666' : '#27ae60' }}
            >
              {l.actief ? 'Deactiveren' : 'Activeren'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#666', minWidth: '32px' }}>Type</span>
              <select
                value={l.type || ''}
                onChange={e => updateVeld(l, 'type', e.target.value)}
                style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', color: l.type ? '#fff' : '#666', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', flex: 1 }}
              >
                <option value="">- Kies type -</option>
                <option value="aspirant">Aspirant-trainer</option>
                <option value="initiator">Initiator</option>
                <option value="trainer_b">Trainer B</option>
                <option value="trainer_a">Trainer A</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '11px', color: '#666', minWidth: '32px' }}>Account</span>
              <select
                value={l.uid || ''}
                onChange={e => updateVeld(l, 'uid', e.target.value || null)}
                style={{ background: '#1a1a1a', border: `1px solid ${l.uid ? '#27ae60' : '#3a3a3a'}`, color: l.uid ? '#27ae60' : '#666', padding: '4px 8px', borderRadius: '6px', fontSize: '12px', flex: 1 }}
              >
                <option value="">- Geen account -</option>
                {users
                  .filter(u => !gekoppeldeUids.has(u.uid) || u.uid === l.uid)
                  .map(u => (
                    <option key={u.uid} value={u.uid}>{u.naam || u.email}</option>
                  ))}
              </select>
            </div>
          </div>

          {groepen.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Meldingen voor groepen
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {groepen.map(g => {
                  const geselecteerd = (l.groepen || []).includes(g.id);
                  return (
                    <button
                      key={g.id}
                      onClick={() => {
                        const huidig = l.groepen || [];
                        const nieuwGroepen = geselecteerd
                          ? huidig.filter(id => id !== g.id)
                          : [...huidig, g.id];
                        updateVeld(l, 'groepen', nieuwGroepen);
                      }}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '600',
                        background: geselecteerd ? 'rgba(41,128,185,0.2)' : 'transparent',
                        border: `1px solid ${geselecteerd ? '#2980b9' : '#3a3a3a'}`,
                        color: geselecteerd ? '#2980b9' : '#666',
                      }}
                    >
                      {g.naam}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
  const [laden, setLaden] = useState(true);

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
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{g.naam}</div>
            {g.dag && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{g.dag}</div>}
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trainingsduur</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[45, 60, 90, 120].map(min => (
                <button
                  key={min}
                  onClick={() => updateDuur(g, min)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
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
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
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

const WEEKDAGEN = [
  { nr: 1, label: 'Ma' },
  { nr: 2, label: 'Di' },
  { nr: 3, label: 'Woe' },
  { nr: 4, label: 'Do' },
  { nr: 5, label: 'Vr' },
  { nr: 6, label: 'Za' },
  { nr: 0, label: 'Zo' },
];

const DAGEN_OPTIES = [1, 2, 3, 4, 5, 6, 7, 10, 14];

function TrainerMeldingenBeheer() {
  const [config, setConfig] = useState({
    actiefOpDagen: [3, 6],
    aantalDagen: 5,
    uitsluitZin: 'sporthal gesloten',
  });
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [bericht, setBericht] = useState('');
  const [vrijInvoer, setVrijInvoer] = useState(false);
  const [vrijDagen, setVrijDagen] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'instellingen', 'meldingen')).then(snap => {
      if (snap.exists()) {
        const cfg = snap.data()?.trainerReminder || {};
        const dagen = cfg.aantalDagen ?? 5;
        const isVrij = !DAGEN_OPTIES.includes(dagen);

        setConfig({
          actiefOpDagen: cfg.actiefOpDagen ?? [3, 6],
          aantalDagen: dagen,
          uitsluitZin: cfg.uitsluitZin ?? 'sporthal gesloten',
        });

        if (isVrij) {
          setVrijInvoer(true);
          setVrijDagen(String(dagen));
        }
      }

      setLaden(false);
    }).catch(e => {
      setBericht('Fout bij laden: ' + e.message);
      setLaden(false);
    });
  }, []);

  function toggleDag(nr) {
    setConfig(prev => {
      const huidige = prev.actiefOpDagen;
      return {
        ...prev,
        actiefOpDagen: huidige.includes(nr)
          ? huidige.filter(d => d !== nr)
          : [...huidige, nr],
      };
    });
  }

  async function slaOp() {
    const aantalDagen = vrijInvoer
      ? Math.max(1, Math.min(30, parseInt(vrijDagen) || 5))
      : config.aantalDagen;

    if (config.actiefOpDagen.length === 0) {
      setBericht('Selecteer minstens 1 weekdag.');
      return;
    }

    setOpslaan(true);
    setBericht('');

    try {
      await setDoc(
        doc(db, 'instellingen', 'meldingen'),
        {
          trainerReminder: {
            actiefOpDagen: config.actiefOpDagen,
            aantalDagen,
            uitsluitZin: config.uitsluitZin.trim().toLowerCase(),
            bijgewerktOp: serverTimestamp(),
          },
        },
        { merge: true }
      );

      setConfig(prev => ({ ...prev, aantalDagen }));
      setBericht('Instellingen opgeslagen.');
      setTimeout(() => setBericht(''), 3000);
    } catch (e) {
      setBericht('Fout bij opslaan: ' + e.message);
    }

    setOpslaan(false);
  }

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  return (
    <div>
      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
        De Cloud Function controleert dagelijks om 9u. Hieronder bepaal je op welke dagen hij actief is en hoeveel dagen vooruit hij kijkt.
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Controleer op deze weekdagen
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {WEEKDAGEN.map(dag => {
            const actief = config.actiefOpDagen.includes(dag.nr);
            return (
              <button
                key={dag.nr}
                onClick={() => toggleDag(dag.nr)}
                style={{
                  background: actief ? 'rgba(192,57,43,0.2)' : '#1a1a1a',
                  border: actief ? '1px solid #c0392b' : '1px solid #3a3a3a',
                  color: actief ? '#e74c3c' : '#aaa',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: actief ? '700' : '400',
                }}
              >
                {dag.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
          Aantal dagen vooruit controleren
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={vrijInvoer ? 'vrij' : String(config.aantalDagen)}
            onChange={e => {
              if (e.target.value === 'vrij') {
                setVrijInvoer(true);
                setVrijDagen(String(config.aantalDagen));
              } else {
                setVrijInvoer(false);
                setConfig(prev => ({ ...prev, aantalDagen: parseInt(e.target.value) }));
              }
            }}
            style={{
              background: '#1a1a1a',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#fff',
              padding: '9px 12px',
              fontSize: '14px',
            }}
          >
            {DAGEN_OPTIES.map(d => (
              <option key={d} value={String(d)}>{d} dagen</option>
            ))}
            <option value="vrij">Vrij invoeren...</option>
          </select>

          {vrijInvoer && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="1"
                max="30"
                value={vrijDagen}
                onChange={e => setVrijDagen(e.target.value)}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #3a3a3a',
                  borderRadius: '8px',
                  color: '#fff',
                  padding: '9px 12px',
                  fontSize: '14px',
                  width: '80px',
                }}
              />
              <span style={{ color: '#aaa', fontSize: '13px' }}>dagen (1-30)</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Melding blokkeren als opmerking bevat
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
          Als de opmerking van een training deze tekst bevat, wordt geen herinnering gestuurd. Hoofdletters worden genegeerd.
        </div>
        <input
          type="text"
          value={config.uitsluitZin}
          onChange={e => setConfig(prev => ({ ...prev, uitsluitZin: e.target.value }))}
          placeholder="bv. sporthal gesloten"
          style={{
            background: '#1a1a1a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#fff',
            padding: '10px 12px',
            fontSize: '14px',
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: '#c0392b',
          border: 'none',
          color: '#fff',
          padding: '11px 20px',
          borderRadius: '8px',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>

      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') || bericht.startsWith('Selecteer') ? '#e74c3c' : '#2ecc71',
          fontSize: '13px',
        }}>
          {bericht.startsWith('Fout') || bericht.startsWith('Selecteer') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}


function StockMeldingenBeheer() {
  const [config, setConfig] = useState({
    drempelLaagStock: 3,
    vasteMails: [],
    stockNulActief: true,
    laagStockActief: true,
  });
  const [mailinvoer, setMailinvoer] = useState('');
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [bericht, setBericht] = useState('');

  useEffect(() => {
    getDoc(doc(db, 'instellingen', 'meldingen')).then(snap => {
      if (snap.exists()) {
        const cfg = snap.data()?.stockMeldingen || {};
        const mails = Array.isArray(cfg.vasteMails) ? cfg.vasteMails : [];

        setConfig({
          drempelLaagStock: cfg.drempelLaagStock ?? 3,
          vasteMails: mails,
          stockNulActief: cfg.stockNulActief ?? true,
          laagStockActief: cfg.laagStockActief ?? true,
        });
        setMailinvoer(mails.join('\n'));
      }

      setLaden(false);
    }).catch(e => {
      setBericht('Fout bij laden: ' + e.message);
      setLaden(false);
    });
  }, []);

  async function slaOp() {
    const mails = mailinvoer
      .split(/[\n,]+/)
      .map(m => m.trim().toLowerCase())
      .filter(m => m.includes('@'));

    setOpslaan(true);
    setBericht('');

    try {
      await setDoc(
        doc(db, 'instellingen', 'meldingen'),
        {
          stockMeldingen: {
            drempelLaagStock: Math.max(0, parseInt(config.drempelLaagStock) || 0),
            vasteMails: mails,
            stockNulActief: config.stockNulActief,
            laagStockActief: config.laagStockActief,
            bijgewerktOp: serverTimestamp(),
          },
        },
        { merge: true }
      );

      setConfig(prev => ({ ...prev, vasteMails: mails }));
      setMailinvoer(mails.join('\n'));
      setBericht('Instellingen opgeslagen.');
      setTimeout(() => setBericht(''), 3000);
    } catch (e) {
      setBericht('Fout bij opslaan: ' + e.message);
    }

    setOpslaan(false);
  }

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  const toggleStyle = () => ({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '10px',
    padding: '12px 14px',
    marginBottom: '10px',
    cursor: 'pointer',
  });

  const knopStyle = (actief) => ({
    background: actief ? '#27ae60' : '#555',
    border: 'none',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '700',
    minWidth: '60px',
  });

  return (
    <div>
      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
        Meldingen aan/uit
      </div>

      <div style={toggleStyle(config.stockNulActief)}>
        <div>
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>Stock = 0 melding</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>Push + mail bij uitverkocht</div>
        </div>
        <button
          onClick={() => setConfig(prev => ({ ...prev, stockNulActief: !prev.stockNulActief }))}
          style={knopStyle(config.stockNulActief)}
        >
          {config.stockNulActief ? 'Aan' : 'Uit'}
        </button>
      </div>

      <div style={toggleStyle(config.laagStockActief)}>
        <div>
          <div style={{ fontSize: '14px', color: '#fff', fontWeight: '600' }}>Lage stock melding</div>
          <div style={{ fontSize: '12px', color: '#aaa', marginTop: '3px' }}>Mail bij daling onder drempel</div>
        </div>
        <button
          onClick={() => setConfig(prev => ({ ...prev, laagStockActief: !prev.laagStockActief }))}
          style={knopStyle(config.laagStockActief)}
        >
          {config.laagStockActief ? 'Aan' : 'Uit'}
        </button>
      </div>

      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Drempelwaarde lage stock
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
          Melding wordt gestuurd als stock daalt naar dit getal of lager, maar niet 0. Zet op 0 om uit te schakelen.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="number"
            min="0"
            max="50"
            value={config.drempelLaagStock}
            onChange={e => setConfig(prev => ({ ...prev, drempelLaagStock: e.target.value }))}
            style={{
              background: '#1a1a1a',
              border: '1px solid #3a3a3a',
              borderRadius: '8px',
              color: '#fff',
              padding: '10px 12px',
              fontSize: '16px',
              width: '80px',
              textAlign: 'center',
            }}
          />
          <span style={{ color: '#aaa', fontSize: '13px' }}>stuks of minder = lage stock melding</span>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
          Vaste mailadressen voor stockmeldingen
        </div>
        <div style={{ fontSize: '11px', color: '#555', marginBottom: '8px' }}>
          Deze adressen ontvangen altijd een mail bij stock = 0 of lage stock, los van individuele profielinstellingen. Een adres per regel of kommagescheiden.
        </div>
        <textarea
          value={mailinvoer}
          onChange={e => setMailinvoer(e.target.value)}
          placeholder={'admin@kodokan.be\nbeheer@kodokan.be'}
          rows={4}
          style={{
            background: '#1a1a1a',
            border: '1px solid #3a3a3a',
            borderRadius: '8px',
            color: '#fff',
            padding: '10px 12px',
            fontSize: '14px',
            width: '100%',
            boxSizing: 'border-box',
            resize: 'vertical',
            fontFamily: 'monospace',
          }}
        />
        {mailinvoer && (
          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
            {mailinvoer.split(/[\n,]+/).filter(m => m.trim().includes('@')).length} geldig(e) adres(sen) herkend
          </div>
        )}
      </div>

      <button
        onClick={slaOp}
        disabled={opslaan}
        style={{
          background: '#c0392b',
          border: 'none',
          color: '#fff',
          padding: '11px 20px',
          borderRadius: '8px',
          cursor: opslaan ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          opacity: opslaan ? 0.7 : 1,
        }}
      >
        {opslaan ? 'Opslaan...' : 'Instellingen opslaan'}
      </button>

      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? '#e74c3c' : '#2ecc71',
          fontSize: '13px',
        }}>
          {bericht.startsWith('Fout') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}


function StockOverzichtMail() {
  const [bezig, setBezig] = useState(false);
  const [bericht, setBericht] = useState('');

  async function stuurOverzicht() {
    setBezig(true);
    setBericht('');

    try {
      // Haal producten op
      const productenSnap = await getDocs(collection(db, 'products'));
      const producten = [];
      productenSnap.forEach(d => producten.push({ id: d.id, ...d.data() }));

      if (producten.length === 0) {
        setBericht('Geen producten gevonden in de database.');
        setBezig(false);
        return;
      }

      // Haal stock configuratie op
      const configSnap = await getDoc(doc(db, 'instellingen', 'meldingen'));
      const stockCfg = configSnap.exists() ? (configSnap.data()?.stockMeldingen || {}) : {};
      const drempel = typeof stockCfg.drempelLaagStock === 'number' ? stockCfg.drempelLaagStock : 3;
      const vasteMails = Array.isArray(stockCfg.vasteMails) ? stockCfg.vasteMails : [];

      // Haal users op met stockAlerts
      const usersSnap = await getDocs(collection(db, 'users'));
      const adressenSet = new Set(vasteMails.filter(m => m.includes('@')));

      usersSnap.forEach(d => {
        const u = d.data();
        if (u.notificaties?.stockAlerts) {
          const mail = u.notificaties?.emailVoorkeur || u.email;
          if (mail) adressenSet.add(mail);
        }
      });

      const adressen = Array.from(adressenSet);

      if (adressen.length === 0) {
        setBericht('Geen mailadressen geconfigureerd. Voeg vaste adressen toe in de stockinstellingen.');
        setBezig(false);
        return;
      }

      // Sorteer: stock 0 eerst, dan lage stock, dan normaal
      const gesorteerd = [...producten].sort((a, b) => {
        const sA = a.stock || 0;
        const sB = b.stock || 0;

        if (sA === 0 && sB !== 0) return -1;
        if (sB === 0 && sA !== 0) return 1;
        if (drempel > 0 && sA > 0 && sA < drempel && (sB === 0 || sB >= drempel)) return -1;
        if (drempel > 0 && sB > 0 && sB < drempel && (sA === 0 || sA >= drempel)) return 1;

        return (a.category || '').localeCompare(b.category || '');
      });

      const rijen = gesorteerd.map(p => {
        const stock = p.stock || 0;
        let kleur = '#333';
        let label = '';

        if (stock === 0) {
          kleur = '#c0392b';
          label = ' UITVERKOCHT';
        } else if (drempel > 0 && stock < drempel) {
          kleur = '#e67e22';
          label = ' LAAG';
        }

        return `<tr>
<td style="padding:7px 10px; border-bottom:1px solid #eee;">${p.category || ''}</td>
<td style="padding:7px 10px; border-bottom:1px solid #eee;">${p.name || p.naam || ''} ${p.variant || ''}</td>
<td style="padding:7px 10px; border-bottom:1px solid #eee; font-weight:bold; color:${kleur};">${stock}${label}</td>
</tr>`;
      }).join('');

      const aantalNul = gesorteerd.filter(p => (p.stock || 0) === 0).length;
      const aantalLaag = gesorteerd.filter(p => {
        const s = p.stock || 0;
        return drempel > 0 && s > 0 && s < drempel;
      }).length;
      const aantalNormaal = gesorteerd.length - aantalNul - aantalLaag;

      const samenvatting = `
<div style="display:flex; gap:20px; margin-bottom:16px; flex-wrap:wrap;">
  <div style="background:#fdf0ed; border:1px solid #e74c3c; border-radius:8px; padding:10px 16px; min-width:100px;">
    <div style="font-size:22px; font-weight:bold; color:#c0392b;">${aantalNul}</div>
    <div style="font-size:12px; color:#888;">Uitverkocht</div>
  </div>
  ${drempel > 0 ? `<div style="background:#fef9f0; border:1px solid #e67e22; border-radius:8px; padding:10px 16px; min-width:100px;">
    <div style="font-size:22px; font-weight:bold; color:#e67e22;">${aantalLaag}</div>
    <div style="font-size:12px; color:#888;">Lage stock (&lt;${drempel})</div>
  </div>` : ''}
  <div style="background:#f0fdf4; border:1px solid #27ae60; border-radius:8px; padding:10px 16px; min-width:100px;">
    <div style="font-size:22px; font-weight:bold; color:#27ae60;">${aantalNormaal}</div>
    <div style="font-size:12px; color:#888;">Normaal</div>
  </div>
</div>
`;

      const datum = new Date().toLocaleDateString('nl-BE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      const html = `
<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
  <div style="background: #c0392b; padding: 20px 24px;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Kodokan Merchtem</h1>
  </div>
  <div style="padding: 24px;">
    <h2 style="color: #1a1a1a; margin-top: 0;">Stockoverzicht - ${datum}</h2>
    ${samenvatting}
    <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:13px;">
      <tr style="background:#f5f5f5;">
        <th style="padding:8px 10px; text-align:left; font-size:12px; color:#888;">Categorie</th>
        <th style="padding:8px 10px; text-align:left; font-size:12px; color:#888;">Product</th>
        <th style="padding:8px 10px; text-align:left; font-size:12px; color:#888;">Stock</th>
      </tr>
      ${rijen}
    </table>
    <p style="margin-top:20px; color:#888; font-size:12px;">
      Beheer de voorraad via de Kodokan Clubapp onder Winkel.
    </p>
  </div>
  <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #888;">
    Dit is een manueel aangevraagd stockoverzicht via Beheer.
  </div>
</div>
`;

      await addDoc(collection(db, 'mail'), {
        to: adressen,
        message: {
          subject: `Stockoverzicht ${datum} - Kodokan`,
          html,
        },
        aangemaakt: serverTimestamp(),
        type: 'stock_overzicht',
      });

      setBericht(`Stockoverzicht verstuurd naar ${adressen.length} adres(sen).`);
      setTimeout(() => setBericht(''), 6000);
    } catch (e) {
      setBericht('Fout: ' + e.message);
    }

    setBezig(false);
  }

  return (
    <div>
      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
        Stuur een volledig stockoverzicht per mail naar alle geconfigureerde adressen. Producten met lage stock of stock 0 worden duidelijk gemarkeerd.
      </div>
      <button
        onClick={stuurOverzicht}
        disabled={bezig}
        style={{
          background: bezig ? '#555' : '#2980b9',
          border: 'none',
          color: '#fff',
          padding: '11px 20px',
          borderRadius: '8px',
          cursor: bezig ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          opacity: bezig ? 0.7 : 1,
        }}
      >
        {bezig ? 'Bezig...' : 'Stuur stockoverzicht per mail'}
      </button>
      {bericht && (
        <div style={{
          marginTop: '12px',
          color: bericht.startsWith('Fout') ? '#e74c3c' : '#2ecc71',
          fontSize: '13px',
        }}>
          {bericht.startsWith('Fout') ? '' : '✓ '}{bericht}
        </div>
      )}
    </div>
  );
}


function TrainerCheckNu() {
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState(null);

  async function voerCheckUit() {
    setBezig(true);
    setResultaat(null);

    try {
      const ref = await addDoc(collection(db, 'trainerReminderTriggers'), {
        aangevraagdOp: serverTimestamp(),
        bron: 'manueel_beheer',
        status: 'wachten',
      });

      let pogingen = 0;
      const interval = setInterval(async () => {
        pogingen++;
        const snap = await getDoc(ref);
        const data = snap.data();

        if (data?.status === 'klaar') {
          clearInterval(interval);
          setResultaat({
            ok: true,
            aantalGroepen: data.aantalGroepen ?? 0,
            aantalMeldingen: data.aantalMeldingen ?? 0,
            bericht: data.samenvatting || 'Check uitgevoerd.',
          });
          setBezig(false);
        } else if (data?.status === 'fout') {
          clearInterval(interval);
          setResultaat({
            ok: false,
            bericht: data.fout || 'Onbekende fout.',
          });
          setBezig(false);
        } else if (pogingen >= 15) {
          clearInterval(interval);
          setResultaat({
            ok: true,
            bericht: 'Check gestart. Resultaat verschijnt in de logs en duurt max 30 sec.',
          });
          setBezig(false);
        }
      }, 1000);
    } catch (e) {
      setResultaat({ ok: false, bericht: 'Fout: ' + e.message });
      setBezig(false);
    }
  }

  return (
    <div>
      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '16px' }}>
        Voer de trainer-check nu manueel uit, ongeacht de dag of het tijdstip. Trainers zonder lesgever in de ingestelde periode ontvangen meteen een push en/of mail.
      </div>
      <button
        onClick={voerCheckUit}
        disabled={bezig}
        style={{
          background: bezig ? '#555' : '#2980b9',
          border: 'none',
          color: '#fff',
          padding: '11px 20px',
          borderRadius: '8px',
          cursor: bezig ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: '700',
          opacity: bezig ? 0.7 : 1,
        }}
      >
        {bezig ? 'Bezig met controleren...' : 'Controleer nu & stuur meldingen'}
      </button>
      {bezig && (
        <div style={{ marginTop: '10px', color: '#aaa', fontSize: '13px' }}>
          Wacht op Cloud Function... (max 15 sec)
        </div>
      )}
      {resultaat && (
        <div style={{
          marginTop: '12px',
          padding: '12px 14px',
          borderRadius: '8px',
          background: resultaat.ok ? 'rgba(39,174,96,0.15)' : 'rgba(231,76,60,0.15)',
          border: '1px solid ' + (resultaat.ok ? '#27ae60' : '#e74c3c'),
          fontSize: '13px',
          color: resultaat.ok ? '#2ecc71' : '#e74c3c',
        }}>
          {resultaat.ok ? '✓ ' : '✗ '}{resultaat.bericht}
          {resultaat.aantalMeldingen > 0 && (
            <div style={{ marginTop: '4px', color: '#aaa', fontSize: '12px' }}>
              {resultaat.aantalGroepen} groep(en) gecontroleerd - {resultaat.aantalMeldingen} melding(en) verstuurd.
            </div>
          )}
        </div>
      )}
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
    { id: 'club', label: '🏠 Club' },
    { id: 'gebruikers', label: '👥 Gebruikers' },
    { id: 'paginas', label: '📄 Paginas' },
    { id: 'groepen', label: '🥋 Groepen' },
    { id: 'lesgevers', label: '👤 Lesgevers' },
    { id: 'meldingen', label: '🔔 Meldingen' },
    { id: 'data', label: '⚙️ Data' },
  ];

  return (
    <div style={S.page}>
      <div style={S.title}>🔧 Beheer</div>
      {saved && <div style={S.successMsg}>✓ {saved}</div>}

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
                ['Betaald?', 'Nee - volledig gratis'],
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

      {actieveTab === 'gebruikers' && (
        <div style={S.card}>
          <div style={S.cardTitle}>👥 Gebruikers</div>
          <GebruikersBeheer />
        </div>
      )}

      {actieveTab === 'paginas' && (
        <div style={S.card}>
          <div style={S.cardTitle}>📄 Paginas per rol</div>
          <PaginaRollenBeheer />
        </div>
      )}

      {actieveTab === 'groepen' && (
        <div style={S.card}>
          <div style={S.cardTitle}>🥋 Groepen & trainingsduur</div>
          <GroepenBeheer />
        </div>
      )}

      {actieveTab === 'lesgevers' && (
        <div style={S.card}>
          <div style={S.cardTitle}>👤 Lesgevers</div>
          <LesgeversBeheer />
        </div>
      )}

      {actieveTab === 'meldingen' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Trainer herinneringen</div>
            <TrainerMeldingenBeheer />
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Manuele trainer check</div>
            <TrainerCheckNu />
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Stock meldingen</div>
            <StockMeldingenBeheer />
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Stock overzicht mailen</div>
            <StockOverzichtMail />
          </div>
        </div>
      )}

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
                border: 'none',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: seedStatus === 'bezig' ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                opacity: seedStatus === 'bezig' ? 0.7 : 1,
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
              {`const firebaseConfig = {\n apiKey: "uw-api-key",\n authDomain: "uw-project.firebaseapp.com",\n projectId: "uw-project-id",\n storageBucket: "uw-project.appspot.com",\n messagingSenderId: "123456",\n appId: "uw-app-id"\n};`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
