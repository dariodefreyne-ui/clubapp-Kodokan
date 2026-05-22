import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { getAllUsers, linkUserToMember, bulkImportMembers } from '../../services/firestoreService';

const BELTS_VALID = ['wit', 'geel', 'oranje', 'groen', 'blauw', 'bruin', 'zwart'];

const CSV_HEADERS = [
  'Naam', 'Geboortedatum', 'Email', 'Telefoon', 'Lidnummer', 'Gordel',
  'Vergunningsnummer', 'IngeschrevenJaar', 'Groepen', 'MedischeInfo',
  'NoodcontactNaam', 'NoodcontactTelefoon', 'BijdrageBetaald', 'BijdrageVervaldatum', 'Actief',
];

function parseDatum(value) {
  if (!value) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return value || null;
}

function validateRow(row, groepNamen) {
  const errors = [];
  if (!row.Naam?.trim()) errors.push('Naam is verplicht');
  if (row.Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.Email.trim())) errors.push('Ongeldig e-mailadres');
  if (row.Gordel && !BELTS_VALID.includes(row.Gordel.trim().toLowerCase())) errors.push(`Ongeldige gordel "${row.Gordel}" (kies uit: ${BELTS_VALID.join(', ')})`);
  if (row.IngeschrevenJaar && (isNaN(Number(row.IngeschrevenJaar)) || Number(row.IngeschrevenJaar) < 1900 || Number(row.IngeschrevenJaar) > new Date().getFullYear() + 1)) errors.push('Ongeldig ingeschreven jaar');
  if (row.BijdrageBetaald && !['ja', 'nee', ''].includes(row.BijdrageBetaald.trim().toLowerCase())) errors.push('BijdrageBetaald: gebruik "ja" of "nee"');
  if (row.Actief && !['ja', 'nee', ''].includes(row.Actief.trim().toLowerCase())) errors.push('Actief: gebruik "ja" of "nee"');
  if (row.Groepen) {
    const lijst = row.Groepen.split(';').map(g => g.trim()).filter(Boolean);
    const ongeldige = lijst.filter(g => !groepNamen.includes(g));
    if (ongeldige.length) errors.push(`Onbekende groep(en): ${ongeldige.join(', ')}`);
  }
  return errors;
}

function parseRow(row) {
  const groepen = row.Groepen
    ? row.Groepen.split(';').map(g => g.trim()).filter(Boolean)
    : [];
  return {
    naam: row.Naam?.trim() || '',
    geboortedatum: parseDatum(row.Geboortedatum),
    email: row.Email?.trim().toLowerCase() || null,
    telefoon: row.Telefoon?.trim() || null,
    lidnummer: row.Lidnummer?.trim() || null,
    gordel: row.Gordel?.trim().toLowerCase() || 'wit',
    vergunningsnummer: row.Vergunningsnummer?.trim() || null,
    ingeschrevenJaar: row.IngeschrevenJaar ? Number(row.IngeschrevenJaar) : null,
    groepen,
    medischeInfo: row.MedischeInfo?.trim() || null,
    noodcontactNaam: row.NoodcontactNaam?.trim() || null,
    noodcontactTelefoon: row.NoodcontactTelefoon?.trim() || null,
    bijdrageBetaald: row.BijdrageBetaald?.trim().toLowerCase() === 'ja',
    bijdrageVervaldatum: parseDatum(row.BijdrageVervaldatum),
    actief: row.Actief?.trim().toLowerCase() !== 'nee',
  };
}

function downloadTemplate(groepNamen) {
  const voorbeeld1Groepen = groepNamen.slice(0, 2).join(';') || 'Groep 1';
  const voorbeeld2Groepen = groepNamen[0] || 'Groep 1';
  const jaar = new Date().getFullYear();
  const rows = [
    CSV_HEADERS,
    ['Jan Janssen', '15/03/2010', 'jan@voorbeeld.be', '+32 470 12 34 56', 'K001', 'wit', '', jaar, voorbeeld1Groepen, '', 'Mama Janssen', '+32 470 98 76 54', 'nee', '', 'ja'],
    ['Lisa Peeters', '22/07/2008', 'lisa@voorbeeld.be', '', 'K002', 'geel', 'VJF-12345', jaar, voorbeeld2Groepen, 'Allergie voor noten', 'Papa Peeters', '+32 475 11 22 33', 'ja', `30/06/${jaar}`, 'ja'],
  ];
  const csv = Papa.unparse(rows, { header: false });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leden_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const S = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '24px 16px', overflowY: 'auto',
  },
  modal: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-color)', width: '100%', maxWidth: '860px',
    padding: '24px', position: 'relative',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  title: { fontSize: 'var(--font-size-lg)', fontWeight: '700', color: 'var(--text-primary)', margin: 0 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '20px', padding: '4px' },
  dropZone: (drag) => ({
    border: `2px dashed ${drag ? 'var(--accent-red)' : 'var(--border-color)'}`,
    borderRadius: 'var(--radius-md)', padding: '32px', textAlign: 'center',
    cursor: 'pointer', background: drag ? 'rgba(192,57,43,0.06)' : 'var(--bg-primary)',
    transition: 'all 0.2s', marginBottom: '16px',
  }),
  btnPrimary: {
    padding: '10px 20px', background: 'var(--accent-red)', border: 'none',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    fontWeight: '600', cursor: 'pointer', minHeight: '40px',
  },
  btnSecondary: {
    padding: '10px 20px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    fontWeight: '500', cursor: 'pointer', minHeight: '40px',
  },
  btnGhost: {
    padding: '8px 16px', background: 'none', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)',
    cursor: 'pointer',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px', marginBottom: '16px' },
  th: { textAlign: 'left', padding: '8px 10px', background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontWeight: '600', borderBottom: '1px solid var(--border-color)' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', verticalAlign: 'top' },
  errorCell: { padding: '8px 10px', borderBottom: '1px solid var(--border-color)', color: 'var(--danger)', fontSize: '12px', verticalAlign: 'top' },
  badge: (ok) => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
    background: ok ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)',
    color: ok ? 'var(--success)' : 'var(--danger)',
    border: `1px solid ${ok ? 'var(--success)' : 'var(--danger)'}`,
  }),
  info: { background: 'rgba(41,128,185,0.1)', border: '1px solid rgba(41,128,185,0.3)', borderRadius: 'var(--radius-md)', padding: '12px 14px', fontSize: '13px', color: '#2980b9', marginBottom: '16px' },
  summary: { background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '14px', marginBottom: '16px' },
  actionBar: { display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '8px' },
};

export default function CsvImportModal({ groepen, onClose, onImported }) {
  const [rows, setRows] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [resultaat, setResultaat] = useState(null);
  const fileRef = useRef();

  const groepNamen = groepen.map(g => g.naam);

  function processFile(file) {
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const parsed = data.map((row, i) => {
          const errors = validateRow(row, groepNamen);
          return { rijnummer: i + 2, raw: row, errors, parsed: errors.length === 0 ? parseRow(row) : null };
        });
        setRows(parsed);
        setResultaat(null);
      },
    });
  }

  function onFileChange(e) {
    processFile(e.target.files[0]);
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }

  const geldig = rows ? rows.filter(r => r.errors.length === 0) : [];
  const metFouten = rows ? rows.filter(r => r.errors.length > 0) : [];

  async function handleImport() {
    if (!geldig.length) return;
    setImporting(true);
    try {
      const members = geldig.map(r => r.parsed);

      const alleUsers = await getAllUsers();
      const emailToUser = {};
      for (const u of alleUsers) {
        if (u.email) emailToUser[u.email.trim().toLowerCase()] = u;
      }

      const ids = await bulkImportMembers(members);

      let gekoppeld = 0;
      for (let i = 0; i < members.length; i++) {
        const m = members[i];
        if (m.email && emailToUser[m.email]) {
          await linkUserToMember(emailToUser[m.email].uid, ids[i]);
          gekoppeld++;
        }
      }

      setResultaat({ created: ids.length, gekoppeld });
      onImported();
    } catch (e) {
      console.error(e);
      setResultaat({ error: e.message });
    }
    setImporting(false);
  }

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <h2 style={S.title}>Leden importeren via CSV</h2>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>

        {resultaat ? (
          <div>
            {resultaat.error ? (
              <div style={{ ...S.info, background: 'rgba(192,57,43,0.1)', borderColor: 'rgba(192,57,43,0.3)', color: 'var(--danger)' }}>
                Fout bij importeren: {resultaat.error}
              </div>
            ) : (
              <div style={{ ...S.info, background: 'rgba(39,174,96,0.1)', borderColor: 'rgba(39,174,96,0.3)', color: 'var(--success)' }}>
                ✓ {resultaat.created} {resultaat.created === 1 ? 'lid' : 'leden'} geïmporteerd
                {resultaat.gekoppeld > 0 && ` · ${resultaat.gekoppeld} account${resultaat.gekoppeld !== 1 ? 's' : ''} automatisch gekoppeld`}
              </div>
            )}
            <div style={S.actionBar}>
              <button style={S.btnPrimary} onClick={onClose}>Sluiten</button>
            </div>
          </div>
        ) : (
          <>
            <div style={S.info}>
              <strong>Groepen-formaat:</strong> meerdere groepen scheiden met puntkomma, bijv. <code>Groep 1;Groep 2</code><br />
              <strong>Datums:</strong> DD/MM/YYYY &nbsp;·&nbsp; <strong>BijdrageBetaald / Actief:</strong> ja of nee<br />
              Beschikbare groepen: {groepNamen.length ? groepNamen.join(', ') : '(geen groepen gevonden)'}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button style={S.btnGhost} onClick={() => downloadTemplate(groepNamen)}>
                Template downloaden
              </button>
              <button style={S.btnGhost} onClick={() => fileRef.current.click()}>
                CSV bestand kiezen
              </button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={onFileChange} />
            </div>

            <div
              style={S.dropZone(dragging)}
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current.click()}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)' }}>
                Sleep een CSV-bestand hiernaartoe of klik om te bladeren
              </div>
            </div>

            {rows && (
              <>
                <div style={S.summary}>
                  <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{rows.length} rijen</span>
                  {' — '}
                  <span style={{ color: 'var(--success)' }}>{geldig.length} geldig</span>
                  {metFouten.length > 0 && <>, <span style={{ color: 'var(--danger)' }}>{metFouten.length} met fouten (worden overgeslagen)</span></>}
                </div>

                <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Rij</th>
                        <th style={S.th}>Status</th>
                        <th style={S.th}>Naam</th>
                        <th style={S.th}>Email</th>
                        <th style={S.th}>Groepen</th>
                        <th style={S.th}>Fouten</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.rijnummer} style={{ background: r.errors.length ? 'rgba(192,57,43,0.04)' : undefined }}>
                          <td style={S.td}>{r.rijnummer}</td>
                          <td style={S.td}><span style={S.badge(r.errors.length === 0)}>{r.errors.length === 0 ? 'OK' : 'Fout'}</span></td>
                          <td style={S.td}>{r.raw.Naam || '—'}</td>
                          <td style={S.td}>{r.raw.Email || '—'}</td>
                          <td style={S.td}>{r.raw.Groepen || '—'}</td>
                          <td style={r.errors.length ? S.errorCell : S.td}>
                            {r.errors.length ? r.errors.join('; ') : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={S.actionBar}>
                  <button style={S.btnSecondary} onClick={onClose}>Annuleren</button>
                  <button
                    style={{ ...S.btnPrimary, opacity: geldig.length === 0 || importing ? 0.6 : 1 }}
                    onClick={handleImport}
                    disabled={geldig.length === 0 || importing}
                  >
                    {importing ? 'Bezig met importeren...' : `Importeer ${geldig.length} ${geldig.length === 1 ? 'lid' : 'leden'}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

