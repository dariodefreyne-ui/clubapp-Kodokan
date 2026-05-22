// src/components/beheer/LesgeversBeheer.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  getAllLesgevers, getAllUsers, getAllGroepen,
  setLesgever, updateLesgever,
} from '../../services/firestoreService';
import { LESGEVER_TYPES } from '../../config/appConfig';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../styles/tokens';

// Helper: gebruik dynamische lesgeverTypes uit configCache, anders fallback op hardcoded
function gebruikLesgevertypes(configCache) {
  const uitCache = configCache?.lesgeverTypes || [];
  if (uitCache.length > 0) {
    return Object.fromEntries(uitCache.map(t => [t.code, t.label]));
  }
  return LESGEVER_TYPES;
}

function NieuwLesgevervModal({ users, gekoppeldeUids, onSluit, onVoegToe }) {
  const { configCache } = useAuth();
  const lesgevertypes = gebruikLesgevertypes(configCache);
  const [naam, setNaam] = useState('');
  const [type, setType] = useState('');
  const [uid, setUid] = useState('');
  const [bezig, setBezig] = useState(false);

  const beschikbareUsers = users.filter(u => !gekoppeldeUids.has(u.uid));

  async function opslaan() {
    const n = naam.trim();
    if (!n) return;
    setBezig(true);
    const id = n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const data = { naam: n, actief: true, aangemaakt: new Date().toISOString() };
    if (type) data.type = type;
    if (uid) data.uid = uid;
    await setLesgever(id, data);
    onVoegToe({ id, naam: n, actief: true, type: type || null, uid: uid || null });
    setBezig(false);
    onSluit();
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px',
    }} onClick={onSluit}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '20px',
          padding: '24px', width: '100%', maxWidth: '420px',
        }}
      >
        <h3 style={{ margin: '0 0 20px', fontSize: '18px', fontWeight: '800', color: C.textPrimary }}>
          Nieuwe lesgever
        </h3>

        <label style={{ display: 'block', fontSize: '12px', color: C.textSec, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Naam *
        </label>
        <input
          type="text"
          value={naam}
          onChange={e => setNaam(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && opslaan()}
          placeholder="Volledige naam"
          autoFocus
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', background: C.bg,
            border: `1px solid ${C.borderSoft}`, borderRadius: '10px',
            color: C.textPrimary, fontSize: '15px', marginBottom: '16px',
          }}
        />

        <label style={{ display: 'block', fontSize: '12px', color: C.textSec, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Type
        </label>
        <select
          value={type}
          onChange={e => setType(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', background: C.bg,
            border: `1px solid ${C.borderSoft}`, borderRadius: '10px',
            color: type ? C.textPrimary : C.textMuted, fontSize: '14px', marginBottom: '16px',
          }}
        >
          <option value="">— Kies type —</option>
          {Object.entries(lesgevertypes).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        <label style={{ display: 'block', fontSize: '12px', color: C.textSec, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Account koppelen
        </label>
        <select
          value={uid}
          onChange={e => setUid(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', background: C.bg,
            border: `1px solid ${uid ? C.green : C.borderSoft}`, borderRadius: '10px',
            color: uid ? C.green : C.textMuted, fontSize: '14px', marginBottom: '24px',
          }}
        >
          <option value="">— Geen account —</option>
          {beschikbareUsers.map(u => (
            <option key={u.uid} value={u.uid}>{u.naam || u.email}</option>
          ))}
        </select>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={onSluit}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              background: 'transparent', border: `1px solid ${C.borderSoft}`,
              color: C.textSec, cursor: 'pointer', fontSize: '14px', fontWeight: '600',
            }}
          >
            Annuleren
          </button>
          <button
            onClick={opslaan}
            disabled={!naam.trim() || bezig}
            style={{
              flex: 1, padding: '12px', borderRadius: '10px',
              background: naam.trim() && !bezig ? C.red : C.borderSoft,
              border: 'none', color: C.textPrimary,
              cursor: naam.trim() && !bezig ? 'pointer' : 'not-allowed',
              fontSize: '14px', fontWeight: '700',
              opacity: bezig ? 0.7 : 1,
            }}
          >
            {bezig ? 'Opslaan...' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LesgeversBeheer() {
  const { configCache } = useAuth();
  const lesgevertypes = gebruikLesgevertypes(configCache);
  const [lesgevers, setLesgevers] = useState([]);
  const [users, setUsers] = useState([]);
  const [groepen, setGroepen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [zoekterm, setZoekterm] = useState('');
  const [toonInactief, setToonInactief] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    Promise.all([getAllLesgevers(), getAllUsers(), getAllGroepen()]).then(([les, usersData, groepenData]) => {
      setLesgevers(les.sort((a, b) => a.naam.localeCompare(b.naam)));
      setUsers(usersData.sort((a, b) => (a.naam || '').localeCompare(b.naam || '')));
      setGroepen(groepenData.sort((a, b) => a.naam.localeCompare(b.naam)));
      setLaden(false);
    });
  }, []);

  const gekoppeldeUids = useMemo(() => new Set(lesgevers.map(l => l.uid).filter(Boolean)), [lesgevers]);

  const gefilterdeLesgvers = useMemo(() => {
    const q = zoekterm.trim().toLowerCase();
    return lesgevers.filter(l => {
      if (!toonInactief && !l.actief) return false;
      if (!q) return true;
      return (l.naam || '').toLowerCase().includes(q);
    });
  }, [lesgevers, zoekterm, toonInactief]);

  const updateVeld = async (l, veld, waarde) => {
    await updateLesgever(l.id, veld, waarde);
    setLesgevers(prev => prev.map(x => x.id === l.id ? { ...x, [veld]: waarde } : x));
  };

  function voegToeLokaal(lesgever) {
    setLesgevers(prev => [...prev, lesgever].sort((a, b) => a.naam.localeCompare(b.naam)));
  }

  if (laden) return <div style={{ color: C.textSec, padding: '12px' }}>Laden...</div>;

  return (
    <div>
      {showModal && (
        <NieuwLesgevervModal
          users={users}
          gekoppeldeUids={gekoppeldeUids}
          onSluit={() => setShowModal(false)}
          onVoegToe={voegToeLokaal}
        />
      )}

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', alignItems: 'center' }}>
        <input
          type="text"
          value={zoekterm}
          onChange={e => setZoekterm(e.target.value)}
          placeholder="Zoek op naam..."
          style={{
            flex: 1, padding: '10px 14px',
            background: 'var(--bg-primary)', border: `1px solid ${C.borderSoft}`,
            borderRadius: '10px', color: C.textPrimary, fontSize: '14px',
          }}
        />
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 16px', background: C.red, border: 'none',
            borderRadius: '10px', color: C.textPrimary, cursor: 'pointer',
            fontWeight: '700', fontSize: '14px', flexShrink: 0,
          }}
        >
          + Nieuw
        </button>
      </div>

      {/* Filter inactief */}
      <button
        onClick={() => setToonInactief(p => !p)}
        style={{
          padding: '6px 14px', borderRadius: '20px', cursor: 'pointer',
          fontSize: '12px', fontWeight: toonInactief ? '700' : '500',
          border: `1px solid ${toonInactief ? C.orange : C.borderSoft}`,
          background: toonInactief ? C.orangeDim : 'transparent',
          color: toonInactief ? C.orange : C.textSec,
          marginBottom: '16px',
        }}
      >
        {toonInactief ? '✓ Inactief tonen' : 'Inactief tonen'}
      </button>

      {/* Lesgeverslijst */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {gefilterdeLesgvers.length === 0 && (
          <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px 0', textAlign: 'center' }}>
            Geen lesgevers gevonden
          </div>
        )}
        {gefilterdeLesgvers.map(l => (
          <div
            key={l.id}
            style={{
              background: 'var(--bg-primary)',
              border: `1px solid ${C.borderSoft}`,
              borderLeft: `3px solid ${l.actief ? C.blue : C.borderSoft}`,
              borderRadius: '12px',
              padding: '16px',
              opacity: l.actief ? 1 : 0.6,
            }}
          >
            {/* Naam + status + deactiveer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{
                  fontSize: '15px', fontWeight: '700', color: l.actief ? C.textPrimary : C.textMuted,
                  textDecoration: l.actief ? 'none' : 'line-through',
                }}>
                  {l.naam}
                </span>
                {l.uid && (
                  <span style={{ fontSize: '11px', color: C.green, fontWeight: '600', padding: '2px 8px', background: C.greenDim, borderRadius: '8px' }}>
                    ● Gekoppeld
                  </span>
                )}
              </div>
              <button
                onClick={() => updateVeld(l, 'actief', !l.actief)}
                style={{
                  padding: '5px 12px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: '600',
                  background: 'transparent',
                  border: `1px solid ${l.actief ? C.borderSoft : C.green}`,
                  color: l.actief ? C.textMuted : C.green,
                }}
              >
                {l.actief ? 'Deactiveren' : 'Activeren'}
              </button>
            </div>

            {/* Type + Account */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: groepen.length > 0 ? '12px' : 0 }}>
              <div>
                <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Type</div>
                <select
                  value={l.type || ''}
                  onChange={e => updateVeld(l, 'type', e.target.value)}
                  style={{
                    width: '100%', padding: '8px 10px', background: C.bg,
                    border: `1px solid ${C.borderSoft}`,
                    borderRadius: '8px', color: l.type ? C.textPrimary : C.textMuted, fontSize: '13px',
                  }}
                >
                  <option value="">— Kies type —</option>
                  {Object.entries(lesgevertypes).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>Account</div>
                <select
                  value={l.uid || ''}
                  onChange={e => updateVeld(l, 'uid', e.target.value || null)}
                  style={{
                    width: '100%', padding: '8px 10px', background: C.bg,
                    border: `1px solid ${l.uid ? C.green : C.borderSoft}`,
                    borderRadius: '8px', color: l.uid ? C.green : C.textMuted, fontSize: '13px',
                  }}
                >
                  <option value="">— Geen account —</option>
                  {users
                    .filter(u => !gekoppeldeUids.has(u.uid) || u.uid === l.uid)
                    .map(u => (
                      <option key={u.uid} value={u.uid}>{u.naam || u.email}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Groepen */}
            {groepen.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>
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
                          updateVeld(l, 'groepen', geselecteerd ? huidig.filter(id => id !== g.id) : [...huidig, g.id]);
                        }}
                        style={{
                          padding: '4px 10px', borderRadius: '6px', cursor: 'pointer',
                          fontSize: '12px', fontWeight: '600',
                          background: geselecteerd ? C.blueDim : 'transparent',
                          border: `1px solid ${geselecteerd ? C.blue : C.borderSoft}`,
                          color: geselecteerd ? C.blue : C.textMuted,
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
      </div>

      <p style={{ color: C.textMuted, fontSize: '12px', marginTop: '16px' }}>
        Koppel elke lesgever aan een account zodat ze automatisch herkend worden bij aanmelden.
        Gedeactiveerde lesgevers verschijnen niet meer in dropdowns.
      </p>
    </div>
  );
}
