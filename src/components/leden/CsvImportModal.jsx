import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import { getAllUsers, linkUserToMember, bulkImportMembers, bulkSyncMembers, previewMemberSync, getMembers } from '../../services/firestoreService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useGordelOpties } from '../../hooks/useGordelOpties';
import { IMPORT_KOLOMMEN, normaliseerHeader, verwerkRij, rijSleutel } from '../../utils/ledenImport';

function downloadTemplate(groepNamen) {
  const g1 = groepNamen.slice(0, 2).join(';') || 'Groep 1';
  const g2 = groepNamen[0] || 'Groep 1';
  const jaar = new Date().getFullYear();
  // LidID blijft leeg voor nieuwe leden; Gordel mag een code of een kyu zijn.
  const rij = (o) => IMPORT_KOLOMMEN.map(k => o[k] ?? '');
  const rows = [
    IMPORT_KOLOMMEN,
    rij({ Voornaam: 'Jan', Achternaam: 'Janssen', Geboortedatum: '15/03/2010', Email: 'jan@voorbeeld.be', Telefoon: '+32 470 12 34 56', Lidnummer: 'K001', Gordel: 'wit', IngeschrevenJaar: jaar, Groepen: g1, NoodcontactNaam: 'Mama Janssen', NoodcontactTelefoon: '+32 470 98 76 54', BijdrageBetaald: 'nee', Actief: 'ja' }),
    rij({ Voornaam: 'Lisa', Achternaam: 'Van de Peeters', Geboortedatum: '22/07/2008', Gordel: '5e kyu', Vergunningsnummer: 'VJF-12345', IngeschrevenJaar: jaar, Groepen: g2, MedischeInfo: 'Allergie voor noten', BijdrageBetaald: 'ja', BijdrageVervaldatum: `30/06/${jaar}`, Actief: 'ja' }),
  ];
  const csv = Papa.unparse(rows, { header: false, delimiter: ';' });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a');
  el.href = url;
  el.download = 'leden_template.csv';
  el.click();
  URL.revokeObjectURL(url);
}

// Excel-NL slaat "CSV" vaak op als Windows-1252 i.p.v. UTF-8: val dan terug
// zodat accenten (Naïl, Léa) niet stuk gaan.
async function leesTekst(file) {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
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
  const [modus, setModus] = useState('aanvulling'); // 'toevoegen' | 'aanvulling' | 'overschrijving'
  const [syncPreview, setSyncPreview] = useState(null);
  const bestaandeRef = useRef(null); // eenmalig geladen per bestand
  const gordel = useGordelOpties();
  const fileRef = useRef();
  const confirm = useConfirm();

  const groepNamen = groepen.map(g => g.naam);

  async function processFile(file) {
    if (!file) return;
    const tekst = await leesTekst(file);
    Papa.parse(tekst, {
      header: true,
      skipEmptyLines: true,
      transformHeader: normaliseerHeader,
      complete: ({ data }) => {
        const gezien = new Map();
        const parsed = data.map((row, i) => {
          const res = verwerkRij(row, { groepNamen, gordel });
          const rijnummer = i + 2;
          const sleutel = rijSleutel(res.parsed);
          if (sleutel) {
            if (gezien.has(sleutel)) res.errors.push(`Dubbel in bestand (zie rij ${gezien.get(sleutel)})`);
            else gezien.set(sleutel, rijnummer);
          }
          return { rijnummer, raw: row, ...res, parsed: res.errors.length === 0 ? res.parsed : null };
        });
        bestaandeRef.current = null;
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

  useEffect(() => {
    if (modus === 'toevoegen' || !geldig.length) {
      setSyncPreview(null);
      return;
    }
    let geannuleerd = false;
    const deactiveerOntbrekende = modus === 'overschrijving';
    (async () => {
      if (!bestaandeRef.current) bestaandeRef.current = await getMembers();
      const p = await previewMemberSync(geldig.map(r => r.parsed), { deactiveerOntbrekende, bestaande: bestaandeRef.current });
      if (!geannuleerd) setSyncPreview(p);
    })().catch(() => { if (!geannuleerd) setSyncPreview(null); });
    return () => { geannuleerd = true; };
  }, [modus, rows]); // eslint-disable-line react-hooks/exhaustive-deps

  async function koppelAccounts(members, idsInOrder) {
    const alleUsers = await getAllUsers();
    const emailToUser = {};
    for (const u of alleUsers) {
      if (u.email) emailToUser[u.email.trim().toLowerCase()] = u;
    }
    let gekoppeld = 0;
    for (let i = 0; i < members.length; i++) {
      const m = members[i];
      if (m.email && emailToUser[m.email] && idsInOrder[i]) {
        await linkUserToMember(emailToUser[m.email].uid, idsInOrder[i]);
        gekoppeld++;
      }
    }
    return gekoppeld;
  }

  async function handleImport() {
    if (!geldig.length) return;

    if (modus === 'overschrijving') {
      const aantalDeactivaties = syncPreview?.deactivated || 0;
      const ok = await confirm({
        titel: 'Volledige overschrijving uitvoeren?',
        beschrijving: aantalDeactivaties > 0
          ? `${syncPreview.created} nieuw, ${syncPreview.updated} bijgewerkt, en ${aantalDeactivaties} ${aantalDeactivaties === 1 ? 'lid wordt gedeactiveerd' : 'leden worden gedeactiveerd'} omdat ze niet in dit bestand voorkomen. Dit kan niet automatisch ongedaan gemaakt worden.`
          : `${syncPreview?.created ?? 0} nieuw, ${syncPreview?.updated ?? 0} bijgewerkt. Geen leden worden gedeactiveerd.`,
        bevestigLabel: 'Overschrijven',
        variant: 'danger',
      });
      if (!ok) return;
    }

    setImporting(true);
    try {
      const members = geldig.map(r => r.parsed);

      if (modus === 'toevoegen') {
        const ids = await bulkImportMembers(members);
        const gekoppeld = await koppelAccounts(members, ids);
        setResultaat({ created: ids.length, gekoppeld });
      } else {
        const deactiveerOntbrekende = modus === 'overschrijving';
        const { idsInOrder, created, updated, deactivated } = await bulkSyncMembers(members, null, { deactiveerOntbrekende, bestaande: bestaandeRef.current ?? undefined });
        const gekoppeld = await koppelAccounts(members, idsInOrder);
        setResultaat({ created, updated, deactivated, gekoppeld });
      }

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
                ✓ {resultaat.created} {resultaat.created === 1 ? 'lid' : 'leden'} aangemaakt
                {typeof resultaat.updated === 'number' && ` · ${resultaat.updated} bijgewerkt`}
                {typeof resultaat.deactivated === 'number' && resultaat.deactivated > 0 && ` · ${resultaat.deactivated} gedeactiveerd`}
                {resultaat.gekoppeld > 0 && ` · ${resultaat.gekoppeld} account${resultaat.gekoppeld !== 1 ? 's' : ''} automatisch gekoppeld`}
              </div>
            )}
            <div style={S.actionBar}>
              <button style={S.btnPrimary} onClick={onClose}>Sluiten</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                style={modus === 'toevoegen' ? S.btnPrimary : S.btnSecondary}
                onClick={() => setModus('toevoegen')}
              >
                Enkel toevoegen
              </button>
              <button
                style={modus === 'aanvulling' ? S.btnPrimary : S.btnSecondary}
                onClick={() => setModus('aanvulling')}
              >
                Aanvullen en bijwerken
              </button>
              <button
                style={modus === 'overschrijving' ? S.btnPrimary : S.btnSecondary}
                onClick={() => setModus('overschrijving')}
              >
                Volledige overschrijving
              </button>
            </div>

            {modus === 'toevoegen' && (
              <div style={S.info}>
                Elke rij wordt <strong>altijd als nieuw lid</strong> aangemaakt, ook als er al een lid bestaat met hetzelfde lidnummer/vergunningsnummer/e-mail.
                Gebruik dit enkel als je zeker weet dat het bestand uitsluitend nieuwe leden bevat — anders ontstaan dubbels.
              </div>
            )}
            {modus === 'aanvulling' && (
              <div style={S.info}>
                Rijen worden gematcht op LidID, vergunningsnummer, lidnummer of naam + geboortedatum (volgorde van voor- en achternaam maakt niet uit): een match <strong>werkt het bestaande lid bij</strong> (lege cellen wissen niets), een onbekende rij wordt <strong>toegevoegd</strong>.
                Leden die niet in dit bestand voorkomen blijven onaangeroerd (geen deactivatie).
              </div>
            )}
            {modus === 'overschrijving' && (
              <div style={{ ...S.info, background: 'rgba(192,57,43,0.08)', borderColor: 'rgba(192,57,43,0.3)', color: 'var(--danger)' }}>
                Dit bestand wordt als <strong>volledige stand van zaken</strong> behandeld: leden worden gematcht op LidID, vergunningsnummer, lidnummer of naam + geboortedatum.
                Onbekende rijen worden aangemaakt, matches worden bijgewerkt, en actieve leden die <strong>niet</strong> in dit bestand voorkomen worden gedeactiveerd.
              </div>
            )}

            <div style={S.info}>
              <strong>Groepen-formaat:</strong> meerdere groepen scheiden met puntkomma, bijv. <code>Groep 1;Groep 2</code><br />
              <strong>Naam:</strong> kolommen Voornaam + Achternaam (of enkel Naam) &nbsp;·&nbsp; <strong>Gordel:</strong> code of kyu (geel, 5e kyu, 5) &nbsp;·&nbsp; <strong>Datums:</strong> DD/MM/JJJJ &nbsp;·&nbsp; <strong>BijdrageBetaald / Actief:</strong> ja of nee<br />
              <strong>Tip:</strong> exporteer eerst via Ledenbeheer (Export), pas aan in Excel en importeer terug: de kolom LidID koppelt elke rij exact aan het juiste lid.<br />
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

                {modus !== 'toevoegen' && (
                  <div style={S.summary}>
                    {syncPreview ? (
                      <>
                        <strong style={{ color: 'var(--text-primary)' }}>Voorvertoning: </strong>
                        <span style={{ color: 'var(--success)' }}>{syncPreview.created} nieuw</span>
                        {' · '}
                        <span style={{ color: '#2980b9' }}>{syncPreview.updated} bijgewerkt</span>
                        {modus === 'overschrijving' && (
                          <>
                            {' · '}
                            <span style={{ color: 'var(--danger)' }}>{syncPreview.deactivated} {syncPreview.deactivated === 1 ? 'deactivatie' : 'deactivaties'}</span>
                          </>
                        )}
                        {syncPreview.created > 0 && syncPreview.nieuweNamen?.length > 0 && (
                          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                            Nieuw aan te maken (controleer op dubbels): {syncPreview.nieuweNamen.join(', ')}{syncPreview.created > syncPreview.nieuweNamen.length ? ' …' : ''}
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)' }}>Voorvertoning wordt berekend...</span>
                    )}
                  </div>
                )}

                <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Rij</th>
                        <th style={S.th}>Status</th>
                        <th style={S.th}>Naam</th>
                        <th style={S.th}>Gordel</th>
                        <th style={S.th}>Groepen</th>
                        <th style={S.th}>Fouten</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.rijnummer} style={{ background: r.errors.length ? 'rgba(192,57,43,0.04)' : undefined }}>
                          <td style={S.td}>{r.rijnummer}</td>
                          <td style={S.td}><span style={S.badge(r.errors.length === 0)}>{r.errors.length === 0 ? 'OK' : 'Fout'}</span></td>
                          <td style={S.td}>{r.weergaveNaam || '—'}{r.waarschuwingen?.length > 0 && <div style={{ fontSize: '11px', color: '#b7791f' }}>{r.waarschuwingen.join('; ')}</div>}</td>
                          <td style={S.td}>{r.parsed?.gordel || r.raw.Gordel || '—'}</td>
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
                    {importing
                      ? 'Bezig met importeren...'
                      : modus === 'overschrijving'
                        ? `Overschrijven (${geldig.length} rijen)`
                        : modus === 'aanvulling'
                          ? `Aanvullen en bijwerken (${geldig.length} rijen)`
                          : `Importeer ${geldig.length} ${geldig.length === 1 ? 'lid' : 'leden'}`}
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

