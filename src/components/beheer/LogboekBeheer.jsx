// src/components/beheer/LogboekBeheer.jsx
// Audit-log viewer: leest uit auditLogs/ collectie en toont een filterbare tabel.
// Cloud Functions schrijven naar deze collectie bij elke wijziging in
// members, users, trainingen en events.
import React, { useEffect, useState } from 'react';
import {
  collection, getDocs, limit, orderBy, query, where,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDatumTijd } from '../../utils/datumUtils';

const COLLECTIE_LABELS = {
  members: '👥 Leden',
  users: '🔐 Gebruikers',
  trainingen: '🥋 Trainingen',
  events: '📅 Events',
};

const TYPE_LABELS = {
  aanmaken: { label: 'Aangemaakt', kleur: 'rgba(39,174,96,0.15)', tekst: '#27ae60' },
  bijwerken: { label: 'Bijgewerkt', kleur: 'rgba(52,152,219,0.15)', tekst: '#2980b9' },
  verwijderen: { label: 'Verwijderd', kleur: 'rgba(192,57,43,0.15)', tekst: '#c0392b' },
};

const S = {
  filterBalk: {
    display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center',
    marginBottom: '16px', padding: '12px', background: 'var(--bg-card)',
    border: '1px solid var(--border-color)', borderRadius: '8px',
  },
  veld: {
    padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: '6px', color: 'var(--text-primary)', fontSize: '13px',
    outline: 'none', minWidth: '140px',
  },
  tabelWrap: {
    overflowX: 'auto', overflowY: 'auto', maxHeight: 'min(65vh,520px)',
    borderRadius: '10px', border: '1px solid var(--border-color)',
  },
  tabel: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left', padding: '8px 10px', color: 'var(--text-secondary)',
    fontWeight: '600', borderBottom: '1px solid var(--border-color)',
    fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px',
    position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1,
  },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', verticalAlign: 'top' },
  rij: { cursor: 'pointer', transition: 'background 0.15s' },
  badge: (type) => {
    const cfg = TYPE_LABELS[type] || { kleur: 'rgba(0,0,0,0.08)', tekst: 'var(--text-secondary)', label: type };
    return {
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px',
      fontSize: '11px', fontWeight: '700', background: cfg.kleur, color: cfg.tekst,
    };
  },
  leeg: { padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' },
  diff: {
    background: 'var(--bg-primary)', borderTop: '1px solid var(--border-color)',
    padding: '12px 16px', fontSize: '11px', fontFamily: 'monospace',
    whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--text-secondary)',
  },
};

// Vergelijk voor/na en geef array van { veld, oud, nieuw } changes terug
function bepaalDiff(voor, na) {
  if (!voor) return Object.entries(na || {}).map(([k, v]) => ({ veld: k, oud: undefined, nieuw: v }));
  if (!na) return Object.entries(voor).map(([k, v]) => ({ veld: k, oud: v, nieuw: undefined }));
  const keys = new Set([...Object.keys(voor), ...Object.keys(na)]);
  const wijzigingen = [];
  keys.forEach(k => {
    if (k === 'updatedAt' || k === 'bijgewerkt') return; // ruis filteren
    const o = voor[k];
    const n = na[k];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      wijzigingen.push({ veld: k, oud: o, nieuw: n });
    }
  });
  return wijzigingen;
}

function formatWaarde(v) {
  if (v === undefined || v === null) return '—';
  if (typeof v === 'boolean') return v ? 'ja' : 'nee';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export default function LogboekBeheer() {
  const { configCache } = useAuth();
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState({});
  const [laden, setLaden] = useState(true);
  const [filterCollectie, setFilterCollectie] = useState('alle');
  const [filterType, setFilterType] = useState('alle');
  const [filterDoor, setFilterDoor] = useState('alle');
  const [filterDagen, setFilterDagen] = useState('7');
  const [opengeklapt, setOpengeklapt] = useState(null);

  useEffect(() => {
    setLaden(true);
    const dagen = Number(filterDagen);
    const sinds = new Date();
    sinds.setDate(sinds.getDate() - dagen);

    const cons = [where('tijdstip', '>=', sinds), orderBy('tijdstip', 'desc'), limit(500)];
    if (filterCollectie !== 'alle') cons.push(where('collectie', '==', filterCollectie));
    if (filterType !== 'alle') cons.push(where('type', '==', filterType));

    getDocs(query(collection(db, 'auditLogs'), ...cons))
      .then(snap => {
        let items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (filterDoor !== 'alle') items = items.filter(l => l.door === filterDoor);
        setLogs(items);
        setLaden(false);
      })
      .catch(() => setLaden(false));
  }, [filterCollectie, filterType, filterDoor, filterDagen]);

  // Eenmalig users laden om uid → naam te mappen
  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data().naam || d.data().email || d.id; });
      setUsers(map);
    }).catch(() => {});
  }, []);

  const unieke_doors = [...new Set(logs.map(l => l.door).filter(Boolean))];

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Volledig spoor van alle wijzigingen op leden, gebruikers, trainingen en events.
        Wordt automatisch geregistreerd door Cloud Functions. Klik op een rij voor details.
      </p>

      <div style={S.filterBalk}>
        <select style={S.veld} value={filterDagen} onChange={e => setFilterDagen(e.target.value)}>
          <option value="1">Vandaag</option>
          <option value="7">Laatste 7 dagen</option>
          <option value="30">Laatste 30 dagen</option>
          <option value="90">Laatste 90 dagen</option>
        </select>
        <select style={S.veld} value={filterCollectie} onChange={e => setFilterCollectie(e.target.value)}>
          <option value="alle">Alle collecties</option>
          <option value="members">Leden</option>
          <option value="users">Gebruikers</option>
          <option value="trainingen">Trainingen</option>
          <option value="events">Events</option>
        </select>
        <select style={S.veld} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="alle">Alle acties</option>
          <option value="aanmaken">Aanmaken</option>
          <option value="bijwerken">Bijwerken</option>
          <option value="verwijderen">Verwijderen</option>
        </select>
        <select style={S.veld} value={filterDoor} onChange={e => setFilterDoor(e.target.value)}>
          <option value="alle">Alle gebruikers</option>
          {unieke_doors.map(uid => (
            <option key={uid} value={uid}>{users[uid] || uid.slice(0, 8)}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginLeft: 'auto' }}>
          {logs.length} resultaten
        </span>
      </div>

      {laden ? (
        <div style={S.leeg}>Laden...</div>
      ) : logs.length === 0 ? (
        <div style={S.leeg}>Geen wijzigingen in deze periode.</div>
      ) : (
        <div style={S.tabelWrap}>
          <table style={S.tabel}>
            <thead>
              <tr>
                <th style={S.th}>Tijdstip</th>
                <th style={S.th}>Door</th>
                <th style={S.th}>Collectie</th>
                <th style={S.th}>Actie</th>
                <th style={S.th}>Document</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => {
                const isOpen = opengeklapt === log.id;
                const wijzigingen = isOpen ? bepaalDiff(log.voor, log.na) : [];
                return (
                  <React.Fragment key={log.id}>
                    <tr style={S.rij} onClick={() => setOpengeklapt(isOpen ? null : log.id)}>
                      <td style={S.td}>{formatDatumTijd(log.tijdstip?.toDate ? log.tijdstip.toDate() : log.tijdstip)}</td>
                      <td style={S.td}>{users[log.door] || (log.door ? log.door.slice(0, 8) : '—')}</td>
                      <td style={S.td}>{COLLECTIE_LABELS[log.collectie] || log.collectie}</td>
                      <td style={S.td}>
                        <span style={S.badge(log.type)}>{TYPE_LABELS[log.type]?.label || log.type}</span>
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: '11px', color: 'var(--text-muted)' }}>
                        {log.docId}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={5} style={S.diff}>
                          {wijzigingen.length === 0 ? (
                            <em>Geen vergelijkbare wijzigingen (alleen metadata).</em>
                          ) : (
                            wijzigingen.map(w => (
                              <div key={w.veld} style={{ marginBottom: '4px' }}>
                                <strong>{w.veld}</strong>: {' '}
                                <span style={{ color: 'var(--danger)', textDecoration: 'line-through' }}>{formatWaarde(w.oud)}</span>
                                {' → '}
                                <span style={{ color: 'var(--success)' }}>{formatWaarde(w.nieuw)}</span>
                              </div>
                            ))
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
