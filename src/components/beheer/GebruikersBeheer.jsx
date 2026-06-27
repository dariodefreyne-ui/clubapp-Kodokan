// src/components/beheer/GebruikersBeheer.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { getAllUsers, updateUserRol, ensureLesgeverVoorUser } from '../../services/firestoreService';
import { rolBadge } from './beheerStyles';
import { C } from '../../styles/tokens';
import { useToast } from '../ui/Toast';
import DataTable from '../ui/DataTable';

const ROL_VOLGORDE = { admin: 0, bestuurslid: 1, trainer: 2, assistent: 3, lid: 4 };

export default function GebruikersBeheer() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [laden, setLaden] = useState(true);
  const [filterRol, setFilterRol] = useState(null); // null = alle

  useEffect(() => {
    getAllUsers().then(u => { setUsers(u); setLaden(false); });
  }, []);

  const wijzigRol = async (uid, nieuweRol) => {
    try {
      await updateUserRol(uid, nieuweRol);
    } catch (e) {
      console.error('Rol wijzigen mislukt:', e);
      toast({ bericht: `Rol wijzigen mislukt: ${e.message}`, type: 'error' });
      return;
    }
    // Een assistent heeft een lesgever-record (type 'assistent') nodig om trainingen
    // en uitbetaling te koppelen — maak het automatisch aan als het nog niet bestaat.
    if (nieuweRol === 'assistent') {
      const u = users.find(x => x.uid === uid);
      try { await ensureLesgeverVoorUser(uid, u?.naam || u?.email || '', 'assistent'); }
      catch (e) {
        console.error('Lesgever-record aanmaken mislukt:', e);
        toast({ bericht: `Rol gewijzigd, maar lesgever-record aanmaken mislukt: ${e.message}`, type: 'error' });
      }
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
    return users
      .filter(u => !filterRol || (u.rol || 'lid') === filterRol)
      .map(u => ({ ...u, id: u.uid, rolLabel: u.rol || 'lid' }))
      .sort((a, b) => (ROL_VOLGORDE[a.rol] ?? 3) - (ROL_VOLGORDE[b.rol] ?? 3));
  }, [users, filterRol]);

  if (laden) return <div style={{ color: C.textSec, padding: '12px' }}>Laden...</div>;

  const rolChips = [
    { rol: null,          label: `Alle (${users.length})`,              kleur: C.textMuted },
    { rol: 'admin',       label: `Admin (${aantalPerRol.admin || 0})`,  kleur: C.purple },
    { rol: 'bestuurslid', label: `Bestuur (${aantalPerRol.bestuurslid || 0})`, kleur: C.red },
    { rol: 'trainer',     label: `Trainers (${aantalPerRol.trainer || 0})`, kleur: C.blue },
    { rol: 'assistent',   label: `Assistenten (${aantalPerRol.assistent || 0})`, kleur: C.orange },
    { rol: 'lid',         label: `Leden (${aantalPerRol.lid || 0})`,    kleur: C.textMuted },
  ];

  const kolommen = [
    {
      key: 'naam', label: 'Naam', sorteerbaar: true,
      render: (naam, u) => naam || '(Geen naam)',
    },
    {
      key: 'email', label: 'E-mail', sorteerbaar: true,
      render: (email, u) => (
        <>
          {email || u.uid.slice(0, 16)}
          {u.communicatieEmail && u.communicatieEmail !== email && (
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '2px' }}>📧 {u.communicatieEmail}</div>
          )}
        </>
      ),
    },
    {
      key: 'rolLabel', label: 'Rol', sorteerbaar: true,
      render: (_, u) => rolBadge(u.rol || 'lid'),
    },
    {
      key: 'aangemaakt', label: 'Aangemaakt',
      render: (aangemaakt) => aangemaakt
        ? new Date(aangemaakt?.toDate?.() || aangemaakt).toLocaleDateString('nl-BE')
        : '—',
    },
  ];

  return (
    <div>
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

      <DataTable
        kolommen={kolommen}
        rijen={gefilterdeUsers}
        zoekVeld="naam,email,rolLabel"
        leegTekst="Geen gebruikers gevonden"
        acties={u => (
          <select
            value={u.rol || 'lid'}
            onChange={e => wijzigRol(u.uid, e.target.value)}
            style={{
              background: 'var(--bg-card)', border: `1px solid ${C.borderSoft}`,
              color: C.textPrimary, padding: '7px 10px',
              borderRadius: '8px', fontSize: '13px',
            }}
          >
            <option value="lid">Lid</option>
            <option value="assistent">Assistent</option>
            <option value="trainer">Trainer</option>
            <option value="bestuurslid">Bestuurslid</option>
            <option value="admin">Admin</option>
          </select>
        )}
      />

      <p style={{ color: C.textMuted, fontSize: '12px', marginTop: '16px' }}>
        Nieuwe gebruikers kunnen zelf een account aanmaken via het inlogscherm. Wijs hier de juiste rol toe.
      </p>
    </div>
  );
}
