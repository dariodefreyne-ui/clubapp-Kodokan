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
// Sectie 1: Trainingsmatrix lesgever x datum (uren x tarief)
// Sectie 2: Wedstrijdkosten coach x tornooi (km-vergoeding + inkomgeld)
function UitbetalingsMatrix({ periode, lesgeversLijst, tarieven, tarieftypes }) {
  const [data, setData]                 = useState(null);
  const [wedstrijdData, setWedstrijdData] = useState(null);
  const [laden, setLaden]               = useState(false);
  const [fout, setFout]                 = useState('');

  const laad = useCallback(async () => {
    if (!periode) return;
    setLaden(true); setFout('');
    try {
      // Parallel ophalen = minder latentie, zelfde aantal reads
      const [trainingSnap, eventSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'trainingen'),
          where('datum', '>=', periode.van),
          where('datum', '<=', periode.tot),
          orderBy('datum', 'asc'),
        )),
        getDocs(query(
          collection(db, 'events'),
          where('datum', '>=', periode.van),
          where('datum', '<=', periode.tot),
          where('type', '==', 'wedstrijd'),
          orderBy('datum', 'asc'),
        )),
      ]);

      // ── Wedstrijdkosten ──────────────────────────────────────────────────────
      const eventsMetBegeleiders = eventSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => Array.isArray(e.begeleiders) && e.begeleiders.length > 0);

      const wCoaches  = {}; // { naam: [{ eventId, tornooi, datum, km, inkom }] }
      const wTornooien = eventsMetBegeleiders.map(e => ({ id: e.id, naam: e.naam, datum: e.datum }));

      for (const ev of eventsMetBegeleiders) {
        for (const b of (ev.begeleiders || [])) {
          if (!b.aanwezig) continue;
          if (!wCoaches[b.naam]) wCoaches[b.naam] = [];
          wCoaches[b.naam].push({
            eventId: ev.id,
            tornooi: ev.naam,
            datum:   ev.datum,
            km:      parseFloat(b.km)    || 0,
            inkom:   parseFloat(b.inkom) || 0,
          });
        }
      }
      setWedstrijdData({ tornooien: wTornooien, coaches: wCoaches });

      // ── Trainingsmatrix ─────────────────────────────────────────────────────
      const trainingen = trainingSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(t => (t.lesgevers || []).length > 0 && t.duurMinuten);

      if (trainingen.length === 0) {
        setData({ datums: [], lesgevers: {} });
        return;
      }

      const datums = [...new Set(trainingen.map(t => t.datum))].sort();
      const matrix = {};

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
    const kmTarief = tarieven['kilometer']?.bedragPerKm || 0;

    const rows = [
      [`Uitbetaling ${periode.naam}`],
      ['Lesgever', 'Type', ...data.datums, 'Totaal uren', '\u20ac/u', 'Vergoeding trainingen'],
    ];

    const gesorteerd = Object.keys(data.lesgevers).sort();
    for (const naam of gesorteerd) {
      const lesgeverInfo = lesgeversLijst.find(l => l.naam === naam);
      const typeId       = lesgeverInfo?.type || '';
      const typeLabel    = tarieftypes.find(t => t.id === typeId)?.label || typeId || '\u2014';
      const tarief       = tarieven[typeId]?.bedragPerUur || 0;
      let totaalUren = 0;
      const datumWaarden = data.datums.map(datum => {
        const uren = data.lesgevers[naam][datum] || 0;
        totaalUren += uren;
        return uren > 0 ? uren : '';
      });
      rows.push([naam, typeLabel, ...datumWaarden,
        Math.round(totaalUren * 100) / 100,
        tarief > 0 ? tarief : '\u2014',
        tarief > 0 ? Math.round(totaalUren * tarief * 100) / 100 : '\u2014',
      ]);
    }

    // Wedstrijdkosten sectie in export
    if (wedstrijdData && Object.keys(wedstrijdData.coaches).length > 0) {
      rows.push([]);
      rows.push(['WEDSTRIJDKOSTEN', '', 'Tornooi', 'Datum', 'km', 'Inkom (\u20ac)', 'km-vergoeding (\u20ac)', 'Totaal (\u20ac)']);
      for (const [naam, items] of Object.entries(wedstrijdData.coaches).sort()) {
        for (const item of items) {
          const kmVerg = Math.round(item.km * kmTarief * 100) / 100;
          rows.push([naam, '', item.tornooi, item.datum, item.km, item.inkom, kmVerg, Math.round((item.inkom + kmVerg) * 100) / 100]);
        }
        const totKm    = items.reduce((s, i) => s + i.km, 0);
        const totInkom = items.reduce((s, i) => s + i.inkom, 0);
        const totKmVerg = Math.round(totKm * kmTarief * 100) / 100;
        rows.push([`  Totaal ${naam}`, '', '', '', totKm, totInkom, totKmVerg, Math.round((totInkom + totKmVerg) * 100) / 100]);
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Uitbetaling');
    XLSX.writeFile(wb, `uitbetaling_${periode.naam.replace(/\s/g, '_')}.xlsx`);
  };

  if (!periode) return null;
  if (laden) return <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px' }}>Laden\u2026</div>;
  if (fout)   return <div style={{ color: '#e74c3c', fontSize: '14px', padding: '20px' }}>{fout}</div>;
  if (!data)  return null;

  if (data.datums.length === 0 && (!wedstrijdData || Object.keys(wedstrijdData.coaches).length === 0)) {
    return (
      <div style={{ background: C.card, borderRadius: '12px', padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>
        Geen trainingen of wedstrijdkosten gevonden in deze periode.
      </div>
    );
  }

  const gesorteerd = Object.keys(data?.lesgevers || {}).sort();
  const kmTarief   = tarieven['kilometer']?.bedragPerKm || 0;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: C.textSec, fontWeight: '600' }}>
          {periode.naam} &mdash; {gesorteerd.length} lesgever(s) &mdash; {data.datums.length} datum(s)
        </div>
        <button onClick={exporteerMatrix}
          style={{ padding: '8px 16px', background: C.green, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
          &#x1F4E4; Excel exporteren
        </button>
      </div>

      {/* ── Trainingsmatrix ── */}
      {data.datums.length > 0 && (
        <>
          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.2px', color: C.red, marginBottom: '8px' }}>
            Trainingen
          </div>
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${C.border}`, marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700', position: 'sticky', left: 0, background: C.bg, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>Lesgever</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>Type</th>
                  {data.datums.map(datum => (
                    <th key={datum} style={{ padding: '10px 8px', textAlign: 'center', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap', minWidth: '80px' }}>
                      {new Date(datum + 'T00:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                    </th>
                  ))}
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap', borderLeft: `1px solid ${C.border}` }}>Totaal u</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>&euro;/u</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '700', whiteSpace: 'nowrap' }}>Totaal &euro;</th>
                </tr>
              </thead>
              <tbody>
                {gesorteerd.map((naam, idx) => {
                  const lesgeverInfo = lesgeversLijst.find(l => l.naam === naam);
                  const typeId       = lesgeverInfo?.type || '';
                  const typeLabel    = tarieftypes.find(t => t.id === typeId)?.label || '\u2014';
                  const tarief       = tarieven[typeId]?.bedragPerUur || 0;
                  let totaalUren     = 0;
                  return (
                    <tr key={naam} style={{ background: idx % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                      <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: '600', position: 'sticky', left: 0, background: idx % 2 === 0 ? C.card : C.bg, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{naam}</td>
                      <td style={{ padding: '10px 8px', color: C.textMuted, fontSize: '11px' }}>{typeLabel}</td>
                      {data.datums.map(datum => {
                        const uren = data.lesgevers[naam][datum] || 0;
                        totaalUren += uren;
                        return (
                          <td key={datum} style={{ padding: '10px 8px', textAlign: 'center', color: uren > 0 ? C.textPrimary : C.textMuted }}>
                            {uren > 0 ? `${uren}u` : '\u00b7'}
                          </td>
                        );
                      })}
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textPrimary, fontWeight: '700', borderLeft: `1px solid ${C.border}` }}>{formatUren(totaalUren)}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted }}>{tarief > 0 ? `\u20ac${tarief}` : '\u2014'}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '700' }}>{tarief > 0 ? formatBedrag(totaalUren * tarief) : '\u2014'}</td>
                    </tr>
                  );
                })}
                {/* Totaalrij trainingen */}
                <tr style={{ background: '#1f1f1f', borderTop: `2px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: '800', position: 'sticky', left: 0, background: '#1f1f1f', borderRight: `1px solid ${C.border}` }}>TOTAAL</td>
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
                    {formatUren(gesorteerd.reduce((sum, naam) => sum + data.datums.reduce((s, datum) => s + (data.lesgevers[naam][datum] || 0), 0), 0))}
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
        </>
      )}

      {/* ── Wedstrijdkosten ── */}
      {wedstrijdData && Object.keys(wedstrijdData.coaches).length > 0 && (
        <>
          <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.2px', color: C.red, marginBottom: '8px' }}>
            Wedstrijdkosten {kmTarief > 0 ? `(\u20ac${kmTarief}/km)` : ''}
            {kmTarief === 0 && <span style={{ fontSize: '10px', color: C.amber, marginLeft: '8px', fontWeight: '600' }}>&#9888; km-tarief niet ingesteld</span>}
          </div>
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: `1px solid ${C.border}`, marginBottom: '24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '500px' }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700', position: 'sticky', left: 0, background: C.bg, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>Coach</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>Tornooi</th>
                  <th style={{ padding: '10px 8px', textAlign: 'left', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>Datum</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>km</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>km-verg. &euro;</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700', whiteSpace: 'nowrap' }}>Inkom &euro;</th>
                  <th style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '700', whiteSpace: 'nowrap', borderLeft: `1px solid ${C.border}` }}>Totaal &euro;</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(wedstrijdData.coaches).sort(([a], [b]) => a.localeCompare(b)).map(([naam, items], idx) => {
                  const totKm     = items.reduce((s, i) => s + i.km, 0);
                  const totInkom  = items.reduce((s, i) => s + i.inkom, 0);
                  const totKmVerg = Math.round(totKm * kmTarief * 100) / 100;
                  const totaal    = Math.round((totInkom + totKmVerg) * 100) / 100;
                  return (
                    <React.Fragment key={naam}>
                      {items.map((item, i) => {
                        const kmVerg = Math.round(item.km * kmTarief * 100) / 100;
                        return (
                          <tr key={`${naam}-${i}`} style={{ background: idx % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                            <td style={{ padding: '8px 12px', color: i === 0 ? C.textPrimary : 'transparent', fontWeight: '600', position: 'sticky', left: 0, background: idx % 2 === 0 ? C.card : C.bg, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>{i === 0 ? naam : ''}</td>
                            <td style={{ padding: '8px 8px', color: C.textSec, fontSize: '12px' }}>{item.tornooi}</td>
                            <td style={{ padding: '8px 8px', color: C.textMuted, fontSize: '11px', whiteSpace: 'nowrap' }}>
                              {new Date(item.datum + 'T00:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}
                            </td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textSec }}>{item.km > 0 ? item.km : '\u2014'}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textSec }}>{kmTarief > 0 && item.km > 0 ? formatBedrag(kmVerg) : '\u2014'}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textSec }}>{item.inkom > 0 ? formatBedrag(item.inkom) : '\u2014'}</td>
                            <td style={{ padding: '8px 8px', textAlign: 'right', color: C.green, fontWeight: '600', borderLeft: `1px solid ${C.border}` }}>
                              {(item.inkom > 0 || (item.km > 0 && kmTarief > 0)) ? formatBedrag(item.inkom + kmVerg) : '\u2014'}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Subtotaalrij per coach */}
                      {items.length > 1 && (
                        <tr style={{ background: '#1a1a20', borderTop: `1px solid ${C.border}` }}>
                          <td style={{ padding: '7px 12px', color: C.textSec, fontSize: '11px', fontWeight: '700', position: 'sticky', left: 0, background: '#1a1a20', borderRight: `1px solid ${C.border}` }}>Subtotaal</td>
                          <td colSpan={2} />
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: C.textSec, fontSize: '11px', fontWeight: '700' }}>{totKm}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: C.textSec, fontSize: '11px', fontWeight: '700' }}>{kmTarief > 0 ? formatBedrag(totKmVerg) : '\u2014'}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: C.textSec, fontSize: '11px', fontWeight: '700' }}>{formatBedrag(totInkom)}</td>
                          <td style={{ padding: '7px 8px', textAlign: 'right', color: C.green, fontSize: '11px', fontWeight: '700', borderLeft: `1px solid ${C.border}` }}>{formatBedrag(totaal)}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {/* Totaalrij wedstrijdkosten */}
                <tr style={{ background: '#1f1f1f', borderTop: `2px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: '800', position: 'sticky', left: 0, background: '#1f1f1f', borderRight: `1px solid ${C.border}` }}>TOTAAL</td>
                  <td colSpan={2} />
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.orange, fontWeight: '800' }}>
                    {Object.values(wedstrijdData.coaches).flat().reduce((s, i) => s + i.km, 0)} km
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.orange, fontWeight: '800' }}>
                    {kmTarief > 0 ? formatBedrag(Object.values(wedstrijdData.coaches).flat().reduce((s, i) => s + Math.round(i.km * kmTarief * 100) / 100, 0)) : '\u2014'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.orange, fontWeight: '800' }}>
                    {formatBedrag(Object.values(wedstrijdData.coaches).flat().reduce((s, i) => s + i.inkom, 0))}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '800', borderLeft: `1px solid ${C.border}` }}>
                    {formatBedrag(Object.values(wedstrijdData.coaches).flat().reduce((s, i) => {
                      const kmVerg = Math.round(i.km * kmTarief * 100) / 100;
                      return s + i.inkom + kmVerg;
                    }, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
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
