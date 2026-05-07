// src/components/beheer/LesgeversBeheer.jsx
import React, { useState, useEffect } from 'react';
import {
  getAllLesgevers, getAllUsers, getAllGroepen,
  setLesgever, updateLesgever,
} from '../../services/firestoreService';

export default function LesgeversBeheer() {
  const [lesgevers, setLesgevers] = useState([]);
  const [users, setUsers] = useState([]);
  const [groepen, setGroepen] = useState([]);
  const [nieuw, setNieuw] = useState('');
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    Promise.all([
      getAllLesgevers(),
      getAllUsers(),
      getAllGroepen(),
    ]).then(([les, usersData, groepenData]) => {
      setLesgevers(les);
      setUsers(usersData.sort((a, b) => (a.naam || '').localeCompare(b.naam || '')));
      setGroepen(groepenData.sort((a, b) => a.naam.localeCompare(b.naam)));
      setLaden(false);
    });
  }, []);

  const voegToe = async () => {
    const naam = nieuw.trim();
    if (!naam) return;
    const id = naam.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    await setLesgever(id, { naam, actief: true, aangemaakt: new Date().toISOString() });
    setLesgevers(prev => [...prev, { id, naam, actief: true }].sort((a, b) => a.naam.localeCompare(b.naam)));
    setNieuw('');
  };

  const updateVeld = async (l, veld, waarde) => {
    await updateLesgever(l.id, veld, waarde);
    setLesgevers(prev => prev.map(x => x.id === l.id ? { ...x, [veld]: waarde } : x));
  };

  const toggleActief = (l) => updateVeld(l, 'actief', !l.actief);

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

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
