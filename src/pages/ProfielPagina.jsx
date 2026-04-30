// src/pages/ProfielPagina.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const S = {
  page: { minHeight: '100vh', background: '#1a1a1a', color: '#fff', padding: '16px' },
  title: { fontSize: '22px', fontWeight: '700', marginBottom: '16px' },
  card: { background: '#2d2d2d', borderRadius: '12px', padding: '16px', marginBottom: '16px' },
  cardTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: '#c0392b' },
  label: { display: 'block', fontSize: '13px', fontWeight: '600', color: '#aaa', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  input: { width: '100%', padding: '12px 14px', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', fontSize: '15px', marginBottom: '14px', boxSizing: 'border-box' },
  rolBadge: (r) => ({ display: 'inline-block', padding: '4px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', background: r === 'beheerder' ? '#c0392b' : '#2980b9', color: '#fff' }),
  saveBtn: { background: '#c0392b', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' },
  logoutBtn: { background: 'transparent', border: '1px solid #e74c3c', color: '#e74c3c', padding: '12px 24px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600', marginTop: '8px', width: '100%' },
  success: { background: 'rgba(39,174,96,0.15)', border: '1px solid #27ae60', borderRadius: '8px', padding: '10px 14px', color: '#27ae60', fontSize: '14px', marginBottom: '12px' },
  groepTag: (actief) => ({ padding: '8px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', background: actief ? '#c0392b' : '#1a1a1a', border: `1px solid ${actief ? '#c0392b' : '#3a3a3a'}`, color: '#fff' }),
};

export default function ProfielPagina() {
  const { profiel, slaProfielOp, logout } = useAuth();
  const [naam, setNaam]               = useState('');
  const [groepen, setGroepen]         = useState([]);
  const [agendaFilters, setAgendaFilters] = useState({
    toonTrainingen:   true,
    toonWedstrijden:  true,
    toonExamens:      true,
    toonEvenementen:  true,
    enkelMijnGroepen: false,
  });
  const [alleGroepen, setAlleGroepen] = useState([]);
  const [opgeslagen, setOpgeslagen]   = useState(false);
  const [bezig, setBezig]             = useState(false);

  useEffect(() => {
    if (profiel) {
      setNaam(profiel.naam || '');
      setGroepen(profiel.groepen || []);
      if (profiel.agendaFilters) {
        setAgendaFilters(prev => ({ ...prev, ...profiel.agendaFilters }));
      }
    }
  }, [profiel]);

  useEffect(() => {
    getDocs(collection(db, 'groepen')).then(snap => {
      setAlleGroepen(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.naam.localeCompare(b.naam)));
    });
  }, []);

  const toggleGroep = (id) =>
    setGroepen(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);

  const opslaan = async () => {
    setBezig(true);
    await slaProfielOp({ naam, groepen, agendaFilters });
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
    setBezig(false);
  };

  if (!profiel) return <div style={S.page}>Laden...</div>;

  return (
    <div style={S.page}>
      <div style={S.title}>👤 Mijn Profiel</div>
      {opgeslagen && <div style={S.success}>✓ Profiel opgeslagen</div>}

      <div style={S.card}>
        <div style={S.cardTitle}>Account</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#aaa', fontSize: '14px' }}>{profiel.email}</span>
          <span style={S.rolBadge(profiel.rol)}>{profiel.rol || 'trainer'}</span>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Weergavenaam</div>
        <label style={S.label}>Naam</label>
        <input type="text" value={naam} onChange={e => setNaam(e.target.value)}
          placeholder="Voornaam Achternaam" style={S.input} />
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Mijn groepen</div>
        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px', marginTop: 0 }}>
          Duid aan bij welke groepen je als lesgever betrokken bent.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {alleGroepen.map(g => (
            <button key={g.id} onClick={() => toggleGroep(g.id)}
              style={S.groepTag(groepen.includes(g.id))}>
              {g.naam} <span style={{ fontSize: '11px', opacity: 0.7 }}>({g.dag})</span>
            </button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Agenda-instellingen</div>
        <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px', marginTop: 0 }}>
          Kies wat je standaard ziet op de agenda.
        </p>

        {[
          { key: 'toonTrainingen',   label: 'Trainingen',   kleur: '#2980b9' },
          { key: 'toonWedstrijden',  label: 'Wedstrijden',  kleur: '#e67e22' },
          { key: 'toonExamens',      label: 'Examens',      kleur: '#27ae60' },
          { key: 'toonEvenementen',  label: 'Evenementen',  kleur: '#8e44ad' },
        ].map(({ key, label, kleur }) => (
          <div
            key={key}
            onClick={() => setAgendaFilters(prev => ({ ...prev, [key]: !prev[key] }))}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #3a3a3a', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: kleur, flexShrink: 0 }} />
              <span style={{ fontSize: '14px', color: '#fff' }}>{label}</span>
            </div>
            <div style={{
              width: '44px', height: '24px', borderRadius: '12px',
              background: agendaFilters[key] ? kleur : '#3a3a3a',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: '3px',
                left: agendaFilters[key] ? '23px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
          </div>
        ))}

        {(profiel?.groepen || []).length > 0 && (
          <div
            onClick={() => setAgendaFilters(prev => ({ ...prev, enkelMijnGroepen: !prev.enkelMijnGroepen }))}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', cursor: 'pointer' }}
          >
            <div style={{ flex: 1, paddingRight: '12px' }}>
              <span style={{ fontSize: '14px', color: '#fff' }}>Enkel mijn groepen</span>
              <div style={{ fontSize: '12px', color: '#aaa', marginTop: '2px' }}>Toon enkel trainingen van groepen waar ik bij betrokken ben</div>
            </div>
            <div style={{
              width: '44px', height: '24px', borderRadius: '12px',
              background: agendaFilters.enkelMijnGroepen ? '#c0392b' : '#3a3a3a',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', top: '3px',
                left: agendaFilters.enkelMijnGroepen ? '23px' : '3px',
                width: '18px', height: '18px', borderRadius: '50%',
                background: '#fff', transition: 'left 0.2s',
              }} />
            </div>
          </div>
        )}
      </div>

      <div style={S.card}>
        <button onClick={opslaan} disabled={bezig} style={{ ...S.saveBtn, opacity: bezig ? 0.6 : 1 }}>
          {bezig ? 'Bezig...' : '💾 Opslaan'}
        </button>
      </div>

      <div style={S.card}>
        <div style={S.cardTitle}>Sessie</div>
        <button onClick={logout} style={S.logoutBtn}>🚪 Uitloggen</button>
      </div>
    </div>
  );
}
