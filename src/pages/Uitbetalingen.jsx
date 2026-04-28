// src/pages/Uitbetalingen.jsx
// ─── UITBETALINGEN v1.0 ────────────────────────────────────────────────────────
// Functionaliteiten:
//  • Tarieven per trainerstype beheren (aspirant / initiator / trainer_b / trainer_a)
//  • Uitbetalingsperiodes instellen (elke 2 maand of manueel)
//  • Matrix: rij = lesgever, kolom = datum, cel = uren, eindtotaal = bedrag
//  • Excel export van matrix
//  • Gebaseerd op training.lesgevers[] × training.duurMinuten → uren

import React, { useState, useEffect, useCallback } from 'react';
import {
  collection, query, where, orderBy, getDocs,
  doc, setDoc, deleteDoc, serverTimestamp, onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import { C } from '../components/trainingen/tokens';
import { bepaalSeizoen, huidigSeizoen, formatDatum } from '../components/trainingen/seizoenHelpers';

// ─── Tarieftypes — configureerbaar, niet hardcoded ─────────────────────────────
// Volgorde en labels kunnen wijzigen via Beheer (Firestore 'tarieftypes' collectie)
// Hier als fallback als collectie leeg is
const FALLBACK_TARIEFTYPES = [
  { id: 'aspirant',   label: 'Aspirant-trainer' },
  { id: 'initiator',  label: 'Initiator' },
  { id: 'trainer_b',  label: 'Trainer B' },
  { id: 'trainer_a',  label: 'Trainer A' },
];

// ─── Helper: minuten → uren als decimaal ──────────────────────────────────────
function minutenNaarUren(min) {
  return Math.round((min / 60) * 100) / 100;
}

function formatUren(uren) {
  if (!uren) return '—';
  return `${uren.toFixed(2)}u`;
}

function formatBedrag(bedrag) {
  return `€ ${bedrag.toFixed(2)}`;
}

// ─── TarievenBeheer ────────────────────────────────────────────────────────────
function TarievenBeheer({ tarieftypes }) {
  const [tarieven, setTarieven]   = useState({});
  const [opgeslagen, setOpgeslagen] = useState({});
  const [bezig, setBezig]         = useState(false);
  const [melding, setMelding]     = useState('');

  // Laad tarieven uit Firestore
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tarieven'), snap => {
      const data = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setTarieven(data);
    });
    return unsub;
  }, []);

  const slaOp = async (typeId, bedragPerUur) => {
    if (isNaN(parseFloat(bedragPerUur))) return;
    setBezig(true);
    try {
      await setDoc(doc(db, 'tarieven', typeId), {
        type: typeId,
        bedragPerUur: parseFloat(bedragPerUur),
        bijgewerkt: serverTimestamp(),
      }, { merge: true });
      setOpgeslagen(prev => ({ ...prev, [typeId]: true }));
      setTimeout(() => setOpgeslagen(prev => ({ ...prev, [typeId]: false })), 1500);
    } catch (e) {
      setMelding('Opslaan mislukt: ' + e.message);
    } finally { setBezig(false); }
  };

  return (
    <div style={{ background: C.card, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700' }}>💶 Tarieven per type</h3>
      {melding && <div style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '10px' }}>{melding}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {tarieftypes.map(type => {
          const huidig = tarieven[type.id]?.bedragPerUur ?? '';
          return (
            <div key={type.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ flex: 1, fontSize: '14px', color: C.textSec, fontWeight: '600' }}>{type.label}</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: C.textMuted, fontSize: '13px' }}>€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={huidig}
                  key={huidig} // reset bij reload
                  onBlur={e => slaOp(type.id, e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && slaOp(type.id, e.target.value)}
                  placeholder="0.00"
                  style={{ width: '90px', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '14px', textAlign: 'right' }}
                />
                <span style={{ color: C.textMuted, fontSize: '12px' }}>/uur</span>
                {opgeslagen[type.id] && <span style={{ color: C.green, fontSize: '12px' }}>✓</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Kilometervergoeding — wedstrijdbegeleiding */}
      <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
          🚗 Kilometervergoeding (wedstrijden)
        </div>
        {(() => {
          const huidigKm = tarieven['kilometer']?.bedragPerKm ?? '';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ flex: 1, fontSize: '14px', color: C.textSec, fontWeight: '600' }}>Per km</span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ color: C.textMuted, fontSize: '13px' }}>€</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={huidigKm}
                  key={`km-${huidigKm}`}
                  onBlur={async e => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val)) return;
                    setBezig(true);
                    try {
                      await setDoc(doc(db, 'tarieven', 'kilometer'), {
                        type: 'kilometer',
                        bedragPerKm: val,
                        bijgewerkt: serverTimestamp(),
                      }, { merge: true });
                      setOpgeslagen(prev => ({ ...prev, kilometer: true }));
                      setTimeout(() => setOpgeslagen(prev => ({ ...prev, kilometer: false })), 1500);
                    } catch (e) { setMelding('Opslaan mislukt: ' + e.message); }
                    finally { setBezig(false); }
                  }}
                  onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                  placeholder="0.00"
                  style={{ width: '90px', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '14px', textAlign: 'right' }}
                />
                <span style={{ color: C.textMuted, fontSize: '12px' }}>/km</span>
                {opgeslagen['kilometer'] && <span style={{ color: C.green, fontSize: '12px' }}>✓</span>}
              </div>
            </div>
          );
        })()}
        <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '8px' }}>
          Gebruikt voor terugbetaling bij wedstrijdbegeleiding.
        </div>
      </div>

      <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '12px' }}>
        Druk Enter of klik buiten het veld om op te slaan.
      </div>
    </div>
  );
}

// ─── PeriodeBeheer ─────────────────────────────────────────────────────────────
function PeriodeBeheer({ periodes, onNieuwe, onVerwijder }) {
  const [van, setVan]   = useState('');
  const [tot, setTot]   = useState('');
  const [naam, setNaam] = useState('');

  const voegToe = () => {
    if (!van || !tot) return;
    onNieuwe({ van, tot, naam: naam || `${van} → ${tot}` });
    setVan(''); setTot(''); setNaam('');
  };

  // Snelle knoppen: huidige 2-maand periode
  const huidigePeriode = () => {
    const nu = new Date();
    const maand = nu.getMonth();
    // Periodes: sep-okt, nov-dec, jan-feb, mrt-apr, mei-jun, jul-aug
    const periodeIndex = Math.floor(maand / 2);
    const jaar = nu.getFullYear();
    const startMaand = periodeIndex * 2;
    const eindMaand  = startMaand + 1;
    const start = new Date(jaar, startMaand, 1).toISOString().slice(0, 10);
    const eind  = new Date(jaar, eindMaand + 1, 0).toISOString().slice(0, 10);
    const maandNamen = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    setVan(start);
    setTot(eind);
    setNaam(`${maandNamen[startMaand]}-${maandNamen[eindMaand]} ${jaar}`);
  };

  return (
    <div style={{ background: C.card, borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
      <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '700' }}>📅 Uitbetalingsperiodes</h3>

      {/* Bestaande periodes */}
      {periodes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {periodes.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: C.bg, borderRadius: '8px' }}>
              <span style={{ flex: 1, fontSize: '13px', color: C.textPrimary, fontWeight: '600' }}>{p.naam}</span>
              <span style={{ fontSize: '12px', color: C.textMuted }}>{p.van} → {p.tot}</span>
              <button onClick={() => onVerwijder(p.id)}
                style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px' }}>🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* Nieuwe periode */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="date" value={van} onChange={e => setVan(e.target.value)}
            style={{ flex: 1, padding: '8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px' }} />
          <span style={{ color: C.textMuted, alignSelf: 'center' }}>→</span>
          <input type="date" value={tot} onChange={e => setTot(e.target.value)}
            style={{ flex: 1, padding: '8px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px' }} />
        </div>
        <input type="text" value={naam} onChange={e => setNaam(e.target.value)}
          placeholder="Naam periode (optioneel)"
          style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={huidigePeriode}
            style={{ flex: 1, padding: '8px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textSec, cursor: 'pointer', fontSize: '12px' }}>
            Huidige 2-maand
          </button>
          <button onClick={voegToe} disabled={!van || !tot}
            style={{ flex: 1, padding: '8px', background: van && tot ? C.red : '#444', border: 'none', borderRadius: '6px', color: '#fff', cursor: van && tot ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '600' }}>
            + Toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UitbetalingsMatrix ────────────────────────────────────────────────────────
// Haalt alle trainingen op voor de periode, bouwt matrix: lesgever × datum
function UitbetalingsMatrix({ periode, lesgeversLijst, tarieven, tarieftypes }) {
  const [data, setData]     = useState(null); // { datums, lesgevers: { naam: { datum: uren } } }
  const [laden, setLaden]   = useState(false);
  const [fout, setFout]     = useState('');

  const laad = useCallback(async () => {
    if (!periode) return;
    setLaden(true); setFout('');
    try {
      // Haal alle trainingen in de periode op
      const snap = await getDocs(query(
        collection(db, 'trainingen'),
        where('datum', '>=', periode.van),
        where('datum', '<=', periode.tot),
        orderBy('datum', 'asc'),
      ));

      const trainingen = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(t => (t.lesgevers || []).length > 0 && t.duurMinuten);

      if (trainingen.length === 0) {
        setData({ datums: [], lesgevers: {} });
        return;
      }

      // Bouw matrix
      const datums = [...new Set(trainingen.map(t => t.datum))].sort();
      const matrix = {}; // { naam: { datum: uren } }

      for (const training of trainingen) {
        const uren = minutenNaarUren(training.duurMinuten || 0);
        for (const naam of (training.lesgevers || [])) {
          if (!matrix[naam]) matrix[naam] = {};
          matrix[naam][training.datum] = (matrix[naam][training.datum] || 0) + uren;
        }
      }

      setData({ datums, lesgevers: matrix });
    } catch (e) {
      setFout('Laden mislukt: ' + e.message);
    } finally { setLaden(false); }
  }, [periode]);

  useEffect(() => { laad(); }, [laad]);

  const exporteerMatrix = () => {
    if (!data) return;

    const headers = ['Lesgever', 'Type', ...data.datums, 'Totaal uren', 'Tarief/u', 'Totaal €'];
    const rows = [
      [`Uitbetaling ${periode.naam}`],
      headers,
    ];

    // Sorteer lesgevers op naam
    const gesorteerd = Object.keys(data.lesgevers).sort();

    for (const naam of gesorteerd) {
      const lesgeverInfo = lesgeversLijst.find(l => l.naam === naam);
      const typeId       = lesgeverInfo?.type || '';
      const typeLabel    = tarieftypes.find(t => t.id === typeId)?.label || typeId || '—';
      const tarief       = tarieven[typeId]?.bedragPerUur || 0;

      let totaalUren = 0;
      const datumWaarden = data.datums.map(datum => {
        const uren = data.lesgevers[naam][datum] || 0;
        totaalUren += uren;
        return uren > 0 ? uren : '';
      });

      rows.push([
        naam,
        typeLabel,
        ...datumWaarden,
        Math.round(totaalUren * 100) / 100,
        tarief > 0 ? tarief : '—',
        tarief > 0 ? Math.round(totaalUren * tarief * 100) / 100 : '—',
      ]);
    }

    // Totaalrij
    const totaalPerDatum = data.datums.map(datum => {
      return gesorteerd.reduce((sum, naam) => sum + (data.lesgevers[naam][datum] || 0), 0);
    });
    rows.push(['TOTAAL', '', ...totaalPerDatum.map(u => u > 0 ? Math.round(u * 100) / 100 : ''), '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Uitbetaling');
    XLSX.writeFile(wb, `uitbetaling_${periode.naam.replace(/\s/g, '_')}.xlsx`);
  };

  if (!periode) return null;
  if (laden) return <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px' }}>Laden…</div>;
  if (fout)   return <div style={{ color: '#e74c3c', fontSize: '14px', padding: '20px' }}>{fout}</div>;
  if (!data)  return null;

  if (data.datums.length === 0) {
    return (
      <div style={{ background: C.card, borderRadius: '12px', padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>
        Geen trainingen met lesgevers gevonden in deze periode.
      </div>
    );
  }

  // Gesorteerde lesgevers
  const gesorteerd = Object.keys(data.lesgevers).sort();

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: C.textSec, fontWeight: '600' }}>
          {periode.naam} — {gesorteerd.length} lesgever(s) — {data.datums.length} datum(s)
        </div>
        <button onClick={exporteerMatrix}
          style={{ padding: '8px 16px', background: C.green, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
          📤 Excel exporteren
        </button>
      </div>

      {/* Matrix tabel — horizontaal scrollbaar */}
      <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${C.border}` }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '600px' }}>
          <thead>
            <tr style={{ background: C.bg }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700', position: 'sticky', left: 0, background: C.bg, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                Lesgever
              </th>
              <th style={{ padding: '10px 8px', textAlign: 'left', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>Type</th>
              {data.datums.map(datum => (
                <th key={datum} style={{ padding: '10px 8px', textAlign: 'center', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap', minWidth: '80px' }}>
                  <div>{new Date(datum + 'T00:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}</div>
                </th>
              ))}
              <th style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap', borderLeft: `1px solid ${C.border}` }}>Totaal u</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>€/u</th>
              <th style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '700', whiteSpace: 'nowrap' }}>Totaal €</th>
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((naam, idx) => {
              const lesgeverInfo = lesgeversLijst.find(l => l.naam === naam);
              const typeId       = lesgeverInfo?.type || '';
              const typeLabel    = tarieftypes.find(t => t.id === typeId)?.label || '—';
              const tarief       = tarieven[typeId]?.bedragPerUur || 0;
              let totaalUren     = 0;

              return (
                <tr key={naam} style={{ background: idx % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: '600', position: 'sticky', left: 0, background: idx % 2 === 0 ? C.card : C.bg, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                    {naam}
                  </td>
                  <td style={{ padding: '10px 8px', color: C.textMuted, fontSize: '11px' }}>{typeLabel}</td>
                  {data.datums.map(datum => {
                    const uren = data.lesgevers[naam][datum] || 0;
                    totaalUren += uren;
                    return (
                      <td key={datum} style={{ padding: '10px 8px', textAlign: 'center', color: uren > 0 ? C.textPrimary : C.textMuted }}>
                        {uren > 0 ? `${uren}u` : '·'}
                      </td>
                    );
                  })}
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textPrimary, fontWeight: '700', borderLeft: `1px solid ${C.border}` }}>
                    {formatUren(totaalUren)}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted }}>
                    {tarief > 0 ? `€${tarief}` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '700' }}>
                    {tarief > 0 ? formatBedrag(totaalUren * tarief) : '—'}
                  </td>
                </tr>
              );
            })}

            {/* Totaalrij */}
            <tr style={{ background: '#1f1f1f', borderTop: `2px solid ${C.border}` }}>
              <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: '800', position: 'sticky', left: 0, background: '#1f1f1f', borderRight: `1px solid ${C.border}` }}>
                TOTAAL
              </td>
              <td />
              {data.datums.map(datum => {
                const totaal = gesorteerd.reduce((sum, naam) => sum + (data.lesgevers[naam][datum] || 0), 0);
                return (
                  <td key={datum} style={{ padding: '10px 8px', textAlign: 'center', color: C.orange, fontWeight: '700', fontSize: '11px' }}>
                    {totaal > 0 ? `${Math.round(totaal * 100) / 100}u` : ''}
                  </td>
                );
              })}
              <td style={{ padding: '10px 8px', textAlign: 'right', color: C.orange, fontWeight: '800', borderLeft: `1px solid ${C.border}` }}>
                {formatUren(gesorteerd.reduce((sum, naam) => {
                  return sum + data.datums.reduce((s, datum) => s + (data.lesgevers[naam][datum] || 0), 0);
                }, 0))}
              </td>
              <td />
              <td style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '800' }}>
                {formatBedrag(gesorteerd.reduce((sum, naam) => {
                  const lesgeverInfo = lesgeversLijst.find(l => l.naam === naam);
                  const typeId = lesgeverInfo?.type || '';
                  const tarief = tarieven[typeId]?.bedragPerUur || 0;
                  const totaalUren = data.datums.reduce((s, datum) => s + (data.lesgevers[naam][datum] || 0), 0);
                  return sum + totaalUren * tarief;
                }, 0))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Hoofd component Uitbetalingen ─────────────────────────────────────────────
export default function Uitbetalingen() {
  const { isBeheerder } = useAuth();
  const [tarieven, setTarieven]     = useState({});
  const [tarieftypes, setTarieftypes] = useState(FALLBACK_TARIEFTYPES);
  const [lesgeversLijst, setLesgeversLijst] = useState([]);
  const [periodes, setPeriodes]     = useState([]);
  const [actievePeriode, setActievePeriode] = useState(null);
  const [tabBlad, setTabBlad]       = useState('matrix'); // 'matrix' | 'tarieven' | 'periodes'

  // Laad tarieftypes uit Firestore (of gebruik fallback)
  useEffect(() => {
    getDocs(collection(db, 'tarieftypes')).then(snap => {
      if (snap.docs.length > 0) {
        setTarieftypes(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.volgorde || 0) - (b.volgorde || 0)));
      }
    });
  }, []);

  // Laad tarieven (realtime)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tarieven'), snap => {
      const data = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setTarieven(data);
    });
    return unsub;
  }, []);

  // Laad lesgevers
  useEffect(() => {
    getDocs(collection(db, 'lesgevers')).then(snap => {
      setLesgeversLijst(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.actief !== false)
          .sort((a, b) => a.naam.localeCompare(b.naam))
      );
    });
  }, []);

  // Laad periodes (realtime)
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'uitbetalingsperiodes'), orderBy('van', 'desc')),
      snap => {
        const lijst = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPeriodes(lijst);
        if (lijst.length > 0 && !actievePeriode) setActievePeriode(lijst[0]);
      }
    );
    return unsub;
  }, []);

  const voegPeriodeToe = async ({ van, tot, naam }) => {
    await setDoc(doc(collection(db, 'uitbetalingsperiodes')), {
      van, tot, naam, aangemaakt: serverTimestamp(),
    });
  };

  const verwijderPeriode = async (id) => {
    if (!window.confirm('Periode verwijderen?')) return;
    await deleteDoc(doc(db, 'uitbetalingsperiodes', id));
    if (actievePeriode?.id === id) setActievePeriode(null);
  };

  if (!isBeheerder) {
    return (
      <div style={{ color: C.textPrimary, padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <div style={{ fontSize: '16px', color: C.textSec }}>Alleen beheerders hebben toegang tot uitbetalingen.</div>
      </div>
    );
  }

  return (
    <div style={{ color: C.textPrimary, paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' }}>💶 Uitbetalingen lesgevers</h1>
        <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>Matrix op basis van aanwezigheid × duur × tarief</p>
      </div>

      {/* Tabbladnavigatie */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: `1px solid ${C.border}`, paddingBottom: '0' }}>
        {[
          { id: 'matrix',   label: '📊 Overzicht' },
          { id: 'tarieven', label: '💶 Tarieven' },
          { id: 'periodes', label: '📅 Periodes' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setTabBlad(tab.id)}
            style={{
              padding: '8px 16px', background: 'transparent', border: 'none',
              borderBottom: `2px solid ${tabBlad === tab.id ? C.red : 'transparent'}`,
              color: tabBlad === tab.id ? C.textPrimary : C.textMuted,
              cursor: 'pointer', fontSize: '14px', fontWeight: tabBlad === tab.id ? '700' : '400',
              marginBottom: '-1px',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tarieven tabblad */}
      {tabBlad === 'tarieven' && (
        <TarievenBeheer tarieftypes={tarieftypes} />
      )}

      {/* Periodes tabblad */}
      {tabBlad === 'periodes' && (
        <PeriodeBeheer
          periodes={periodes}
          onNieuwe={voegPeriodeToe}
          onVerwijder={verwijderPeriode}
        />
      )}

      {/* Matrix tabblad */}
      {tabBlad === 'matrix' && (
        <div>
          {/* Periodeknopjes */}
          {periodes.length === 0 ? (
            <div style={{ background: C.card, borderRadius: '12px', padding: '24px', textAlign: 'center', color: C.textMuted, marginBottom: '20px' }}>
              Geen periodes aangemaakt.
              <button onClick={() => setTabBlad('periodes')} style={{ display: 'block', margin: '12px auto 0', color: C.red, background: 'transparent', border: `1px solid ${C.red}`, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                + Periode toevoegen
              </button>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                {periodes.map(p => (
                  <button key={p.id} onClick={() => setActievePeriode(p)}
                    style={{ padding: '8px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actievePeriode?.id === p.id ? C.red : C.card, border: `1px solid ${actievePeriode?.id === p.id ? C.red : C.border}`, color: actievePeriode?.id === p.id ? '#fff' : C.textSec }}>
                    {p.naam}
                  </button>
                ))}
              </div>
              {actievePeriode && (
                <UitbetalingsMatrix
                  periode={actievePeriode}
                  lesgeversLijst={lesgeversLijst}
                  tarieven={tarieven}
                  tarieftypes={tarieftypes}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
