// src/components/ui/DataTable.jsx
// Generieke tabel met zoeken, sorteren en optionele acties.
import React, { useState, useMemo } from 'react';
import { C } from '../../styles/tokens';

const S = {
  wrapper: { overflowX: 'auto' },
  tabel: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  thead: { background: C.surface },
  th: (sorteerbaar, actief) => ({
    textAlign: 'left',
    padding: '10px 12px',
    color: actief ? C.textPrimary : C.textSec,
    fontWeight: '600',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: `1px solid ${C.borderSoft}`,
    cursor: sorteerbaar ? 'pointer' : 'default',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  }),
  tr: (alt) => ({
    background: alt ? 'rgba(255,255,255,0.02)' : 'transparent',
    borderBottom: `1px solid ${C.borderSoft}`,
  }),
  td: {
    padding: '10px 12px',
    color: C.textPrimary,
    verticalAlign: 'middle',
  },
  leeg: {
    padding: '32px',
    textAlign: 'center',
    color: C.textMuted,
    fontSize: '13px',
  },
  zoekInput: {
    padding: '8px 12px',
    background: C.surface,
    border: `1px solid ${C.borderSoft}`,
    borderRadius: '8px',
    color: C.textPrimary,
    fontSize: '13px',
    outline: 'none',
    width: '100%',
    maxWidth: '300px',
    boxSizing: 'border-box',
  },
};

/**
 * DataTable
 *
 * @param {Array}    kolommen  - [{key, label, sorteerbaar?, breedte?, render?}]
 * @param {Array}    rijen     - Array van data-objecten
 * @param {string}   zoekVeld  - key om in te zoeken (of meerdere keys met komma)
 * @param {string}   standaardSort - key van kolom die standaard gesorteerd wordt
 * @param {function} acties    - (rij) => JSX  — optionele actie-kolom
 * @param {string}   leegTekst - Tekst als er geen rijen zijn
 */
export default function DataTable({
  kolommen,
  rijen = [],
  zoekVeld,
  standaardSort,
  acties,
  leegTekst = 'Geen resultaten',
}) {
  const [zoek, setZoek] = useState('');
  const [sortKey, setSortKey] = useState(standaardSort || null);
  const [sortDir, setSortDir] = useState('asc');

  const zoekKeys = zoekVeld ? zoekVeld.split(',').map(s => s.trim()) : [];

  function toggleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const gefilterd = useMemo(() => {
    let lijst = rijen;
    if (zoek && zoekKeys.length) {
      const q = zoek.toLowerCase();
      lijst = lijst.filter(r =>
        zoekKeys.some(k => String(r[k] ?? '').toLowerCase().includes(q))
      );
    }
    if (sortKey) {
      lijst = [...lijst].sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), 'nl', { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return lijst;
  }, [rijen, zoek, sortKey, sortDir]);

  return (
    <div>
      {zoekVeld && (
        <div style={{ marginBottom: '12px' }}>
          <input
            type="text"
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            placeholder="Zoeken..."
            style={S.zoekInput}
          />
        </div>
      )}

      <div style={S.wrapper}>
        <table style={S.tabel}>
          <thead style={S.thead}>
            <tr>
              {kolommen.map(k => (
                <th
                  key={k.key}
                  style={{ ...S.th(k.sorteerbaar, sortKey === k.key), width: k.breedte }}
                  onClick={k.sorteerbaar ? () => toggleSort(k.key) : undefined}
                >
                  {k.label}
                  {k.sorteerbaar && sortKey === k.key && (
                    <span style={{ marginLeft: '4px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>
                  )}
                </th>
              ))}
              {acties && <th style={S.th(false, false)}>Acties</th>}
            </tr>
          </thead>
          <tbody>
            {gefilterd.length === 0 ? (
              <tr>
                <td colSpan={kolommen.length + (acties ? 1 : 0)} style={S.leeg}>
                  {zoek ? `Geen resultaten voor "${zoek}"` : leegTekst}
                </td>
              </tr>
            ) : (
              gefilterd.map((rij, i) => (
                <tr key={rij.id ?? i} style={S.tr(i % 2 === 1)}>
                  {kolommen.map(k => (
                    <td key={k.key} style={S.td}>
                      {k.render ? k.render(rij[k.key], rij) : (rij[k.key] ?? '—')}
                    </td>
                  ))}
                  {acties && <td style={S.td}>{acties(rij)}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
