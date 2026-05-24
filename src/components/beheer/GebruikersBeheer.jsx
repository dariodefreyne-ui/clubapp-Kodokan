// src/components/beheer/GebruikersBeheer.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getAllUsers, updateUserRol, ensureLesgeverVoorUser } from '../../services/firestoreService';
import { rolBadge } from './beheerStyles';
import { C } from '../../styles/tokens';

const ROL_VOLGORDE = { admin: 0, bestuurslid: 1, trainer: 2, assistent: 3, lid: 4 };
const ROL_KLEUR = {
  admin:       { bg: C.purpleDim, border: C.purple, text: C.purple },
  bestuurslid: { bg: C.redDim,    border: C.red,    text: C.red },
  trainer:     { bg: C.blueDim,   border: C.blue,   text: C.blue },
  assistent:   { bg: C.orangeDim, border: C.orange, text: C.orange },
  lid:         { bg: 'rgba(100,116,139,0.14)', border: C.textMuted, text: C.textMuted },
};

export default function GebruikersBeheer() {
  const [users, setUsers] = useState([]);
  const [laden, setLaden] = useState(true);
  const [zoekterm, setZoekterm] = useState('');
  const [filterRol, setFilterRol] = useState(null); // null = alle

  useEffect(() => {
    getAllUsers().then(u => { setUsers(u); setLaden(false); });
  }, []);

  const wijzigRol = async (uid, nieuweRol) => {
    await updateUserRol(uid, nieuweRol);
    // Een assistent heeft een lesgever-record (type 'assistent') nodig om trainingen
    // en uitbetaling te koppelen — maak het automatisch aan als het nog niet bestaat.
    if (nieuweRol === 'assistent') {
      const u = users.find(x => x.uid === uid);
      try { await ensureLesgeverVoorUser(uid, u?.naam || u?.email || '', 'assistent'); }
      catch (e) { console.error('Lesgever-record aanmaken mislukt:', e); }
    }
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, rol: nieuweRol } : u));
  };

  const aantalPerRol = useMemo(() =>
    users.reduce((acc, u) => {
      const r = u.rol || 'lid';
      acc[r] = (acc[r] || 0) + 1;
      return acc;
    }, {}),
  [users]);

  const gefilterdeUsers = useMemo(() => {
    const q = zoekterm.trim().toLowerCase();
    return users
      .filter(u => {
        if (filterRol && (u.rol || 'lid') !== filterRol) return false;
        if (!q) return true;
        return (
          (u.naam || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.rol || 'lid').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (ROL_VOLGORDE[a.rol] ?? 3) - (ROL_VOLGORDE[b.rol] ?? 3));
  }, [users, zoekterm, filterRol]);

  if (laden) return <div style={{ color: C.textSec, padding: '12px' }}>Laden...</div>;

  const rolChips = [
    { rol: null,          label: `Alle (${users.length})`,              kleur: C.textMuted },
    { rol: 'admin',       label: `Admin (${aantalPerRol.admin || 0})`,  kleur: C.purple },
    { rol: 'bestuurslid', label: `Bestuur (${aantalPerRol.bestuurslid || 0})`, kleur: C.red },
    { rol: 'trainer',     label: `Trainers (${aantalPerRol.trainer || 0})`, kleur: C.blue },
    { rol: 'assistent',   label: `Assistenten (${aantalPerRol.assistent || 0})`, kleur: C.orange },
    { rol: 'lid',         label: `Leden (${aantalPerRol.lid || 0})`,    kleur: C.textMuted },
  ];

  return (
    <div>
      {/* Zoekbalk */}
      <input
        type="text"
        value={zoekterm}
        onChange={e => setZoekterm(e.target.value)}
        placeholder="Zoek op naam, e-mail of rol..."
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '10px 14px',
          background: 'var(--bg-primary)', border: `1px solid ${C.borderSoft}`,
          borderRadius: '10px', color: C.textPrimary, fontSize: '14px',
          marginBottom: '12px',
        }}
      />

      {/* Rolfilter chips */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {rolChips.map(({ rol, label, kleur }) => {
          const actief = filterRol === rol;
          return (
            <button
              key={String(rol)}
              onClick={() => setFilterRol(rol)}
              style={{
                padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
                fontSize: '12px', fontWeight: actief ? '700' : '500',
                border: `1px solid ${actief ? kleur : C.borderSoft}`,
                background: actief ? kleur + '22' : 'transparent',
                color: actief ? kleur : C.textSec,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Gebruikerslijst */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {gefilterdeUsers.length === 0 && (
          <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px 0', textAlign: 'center' }}>
            Geen gebruikers gevonden
          </div>
        )}
        {gefilterdeUsers.map(u => {
          const rol = u.rol || 'lid';
          const k = ROL_KLEUR[rol] || ROL_KLEUR.lid;
          return (
            <div
              key={u.uid}
              style={{
                background: 'var(--bg-primary)',
                border: `1px solid ${C.borderSoft}`,
                borderLeft: `3px solid ${k.border}`,
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: '700', color: C.textPrimary, fontSize: '14px' }}>
                    {u.naam || '(Geen naam)'}
                  </span>
                  {rolBadge(rol)}
                </div>
                <div style={{ fontSize: '12px', color: C.textSec }}>{u.email || u.uid.slice(0, 16)}</div>
                {u.communicatieEmail && u.communicatieEmail !== u.email && (
                  <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>
                    📧 {u.communicatieEmail}
                  </div>
                )}
                {u.aangemaakt && (
                  <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '3px' }}>
                    Aangemaakt: {new Date(u.aangemaakt?.toDate?.() || u.aangemaakt).toLocaleDateString('nl-BE')}
                  </div>
                )}
              </div>
              <select
                value={u.rol || 'lid'}
                onChange={e => wijzigRol(u.uid, e.target.value)}
                style={{
                  background: 'var(--bg-card)', border: `1px solid ${C.borderSoft}`,
                  color: C.textPrimary, padding: '7px 10px',
                  borderRadius: '8px', fontSize: '13px',
                  marginLeft: '12px', flexShrink: 0,
                }}
              >
                <option value="lid">Lid</option>
                <option value="assistent">Assistent</option>
                <option value="trainer">Trainer</option>
                <option value="bestuurslid">Bestuurslid</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          );
        })}
      </div>

      <p style={{ color: C.textMuted, fontSize: '12px', marginTop: '16px' }}>
        Nieuwe gebruikers kunnen zelf een account aanmaken via het inlogscherm. Wijs hier de juiste rol toe.
      </p>
    </div>
  );
}
