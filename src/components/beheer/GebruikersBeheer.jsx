// src/components/beheer/GebruikersBeheer.jsx
import React, { useState, useEffect } from 'react';
import { getAllUsers, updateUserRol } from '../../services/firestoreService';
import { rolBadge } from './beheerStyles';

export default function GebruikersBeheer() {
  const [users, setUsers] = useState([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    getAllUsers().then(users => {
      setUsers(users);
      setLaden(false);
    });
  }, []);

  const wijzigRol = async (uid, nieuweRol) => {
    await updateUserRol(uid, nieuweRol);
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
