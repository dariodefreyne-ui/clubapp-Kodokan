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
import { useLesgeversRealtime } from '../hooks/useLesgeversRealtime';
import { useConfirm } from '../contexts/ConfirmContext';
import * as XLSX from 'xlsx';
import { C } from '../components/trainingen/tokens';
import { cardStyle, badgeStyle, buttonStyle, tabBarStyle, tabButtonStyle, chipStyle, inputStyle } from '../styles/tokens';
import { bepaalSeizoen, huidigSeizoen, formatDatum } from '../components/trainingen/seizoenHelpers';

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

function datumNaarISO(datum) {
  const jaar = datum.getFullYear();
  const maand = String(datum.getMonth() + 1).padStart(2, '0');
  const dag = String(datum.getDate()).padStart(2, '0');
  return `${jaar}-${maand}-${dag}`;
}

// ─── Periode helpers ───────────────────────────────────────────────────────────
function periodeVanSnelknop(type) {
  const nu = new Date();
  const jaar = nu.getFullYear();
  const maand = nu.getMonth();

  if (type === 'deze-maand') {
    const van = datumNaarISO(new Date(jaar, maand, 1));
    const tot = datumNaarISO(new Date(jaar, maand + 1, 0));
    const label = nu.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });
    return { van, tot, naam: label };
  }
  if (type === 'vorige-maand') {
    const van = datumNaarISO(new Date(jaar, maand - 1, 1));
    const tot = datumNaarISO(new Date(jaar, maand, 0));
    const d = new Date(jaar, maand - 1, 1);
    const label = d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });
    return { van, tot, naam: label };
  }
  if (type === 'dit-seizoen') {
    const seizoenStart = maand >= 8 ? jaar : jaar - 1;
    return {
      van: `${seizoenStart}-09-01`,
      tot: `${seizoenStart + 1}-06-30`,
      naam: `Seizoen ${seizoenStart}-${seizoenStart + 1}`,
    };
  }
  return null;
}

function maandOptiesVoorSeizoen() {
  const nu = new Date();
  const jaar = nu.getFullYear();
  const maand = nu.getMonth();
  const seizoenStart = maand >= 8 ? jaar : jaar - 1;

  return Array.from({ length: 12 }, (_, index) => {
    const maandIndex = 8 + index;
    const datum = new Date(seizoenStart, maandIndex, 1);
    const van = datumNaarISO(datum);
    const tot = datumNaarISO(new Date(datum.getFullYear(), datum.getMonth() + 1, 0));
    const naam = datum.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' });

    return {
      id: `maand-${van}`,
      van,
      tot,
      naam,
      value: `${van}|${tot}`,
    };
  });
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
    const start = datumNaarISO(new Date(jaar, startMaand, 1));
    const eind  = datumNaarISO(new Date(jaar, eindMaand + 1, 0));
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
            style={{ flex: 1, padding: '8px', background: van && tot ? C.red : C.borderSoft, border: 'none', borderRadius: '6px', color: 'var(--text-primary)', cursor: van && tot ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: '600' }}>
            + Toevoegen
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WedstrijdKosten ───────────────────────────────────────────────────────────
// Aparte sectie — filtert op lesgeverId (Firestore doc-id uit lesgevers-collectie)
function WedstrijdKosten({ periode, lesgeverId, isBeheerder, tarieven }) {
  const [events, setEvents] = useState([]);
  const [laden, setLaden]   = useState(true);

  useEffect(() => {
    if (!periode) return;
    setLaden(true);
    // onSnapshot zodat nieuwe begeleiders meteen zichtbaar zijn
    const unsub = onSnapshot(
      collection(db, 'events'),
      snap => {
        const lijst = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(e =>
            e.type === 'wedstrijd' &&
            e.datum >= periode.van &&
            e.datum <= periode.tot &&
            Array.isArray(e.begeleiders) && e.begeleiders.length > 0
          );
        setEvents(lijst);
        setLaden(false);
      }
    );
    return unsub;
  }, [periode]);

  if (laden) return <div style={{ color: C.textMuted, fontSize: '13px', padding: '12px 0' }}>Wedstrijden laden...</div>;

  // Filter begeleiders per event op aanwezigheid
  const rijen = [];
  for (const event of events) {
    const begeleiders = (event.begeleiders || []).filter(b => b.aanwezig !== false);
    const gefilterd = isBeheerder
      ? begeleiders
      : begeleiders.filter(b => b.lesgeverId === lesgeverId);

    for (const b of gefilterd) {
      rijen.push({
        eventId:   event.id,
        eventNaam: event.naam || event.datum,
        datum:     event.datum,
        naam:      b.naam || '—',
        uid:       b.uid,
        km:        parseFloat(b.km) || 0,
        inkom:     parseFloat(b.inkom) || 0,
      });
    }
  }

  if (rijen.length === 0) {
    return (
      <div style={{ background: C.card, borderRadius: '10px', padding: '16px', color: C.textMuted, fontSize: '13px', fontStyle: 'italic' }}>
        Geen wedstrijdkosten in deze periode.
      </div>
    );
  }

  const kmTarief = tarieven['kilometer']?.bedragPerKm || 0;

  // Groepeer op naam voor subtotalen
  const perNaam = {};
  for (const r of rijen) {
    if (!perNaam[r.naam]) perNaam[r.naam] = { km: 0, inkom: 0, events: [] };
    perNaam[r.naam].km     += r.km;
    perNaam[r.naam].inkom  += r.inkom;
    perNaam[r.naam].events.push(r);
  }

  const totaalKm    = rijen.reduce((s, r) => s + r.km, 0);
  const totaalInkom = rijen.reduce((s, r) => s + r.inkom, 0);
  const totaalKmBedrag    = totaalKm * kmTarief;

  return (
    <div style={{ marginTop: '32px' }}>
      {/* Sectie header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', paddingBottom: '8px', borderBottom: `1px solid ${C.border}` }}>
        <span style={{ fontSize: '16px', fontWeight: '700' }}>🏆 Wedstrijdkosten</span>
        <span style={{ fontSize: '12px', color: C.textMuted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '2px 10px' }}>
          {rijen.length} begeleidingen
        </span>
      </div>

      {/* Km-vergoeding */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: C.orange, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          🚗 Km-vergoeding {kmTarief > 0 ? `(€${kmTarief}/km)` : '(tarief niet ingesteld)'}
        </div>
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700' }}>Naam</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700' }}>Wedstrijd</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700' }}>Km</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {rijen.filter(r => r.km > 0).map((r, i) => (
                <tr key={`${r.eventId}-${r.uid}-km`} style={{ background: i % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: '600' }}>{r.naam}</td>
                  <td style={{ padding: '8px 12px', color: C.textSec, fontSize: '11px' }}>{r.eventNaam} ({r.datum})</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textPrimary }}>{r.km} km</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>
                    {kmTarief > 0 ? formatBedrag(r.km * kmTarief) : '—'}
                  </td>
                </tr>
              ))}
              <tr style={{ background: C.bg, borderTop: `2px solid ${C.border}` }}>
                <td colSpan={2} style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: '800' }}>TOTAAL</td>
                <td style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>{totaalKm} km</td>
                <td style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '800' }}>
                  {kmTarief > 0 ? formatBedrag(totaalKmBedrag) : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Inkomvergoeding */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', color: C.blue, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
          🎫 Inkomvergoeding
        </div>
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700' }}>Naam</th>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700' }}>Wedstrijd</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', color: C.blue, fontWeight: '700' }}>Inkom</th>
              </tr>
            </thead>
            <tbody>
              {rijen.filter(r => r.inkom > 0).map((r, i) => (
                <tr key={`${r.eventId}-${r.uid}-inkom`} style={{ background: i % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: '600' }}>{r.naam}</td>
                  <td style={{ padding: '8px 12px', color: C.textSec, fontSize: '11px' }}>{r.eventNaam} ({r.datum})</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: C.blue, fontWeight: '700' }}>{formatBedrag(r.inkom)}</td>
                </tr>
              ))}
              <tr style={{ background: C.bg, borderTop: `2px solid ${C.border}` }}>
                <td colSpan={2} style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: '800' }}>TOTAAL</td>
                <td style={{ padding: '8px 8px', textAlign: 'right', color: C.blue, fontWeight: '800' }}>{formatBedrag(totaalInkom)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Gecombineerd totaal wedstrijden */}
      {(totaalKmBedrag + totaalInkom) > 0 && (
        <div style={{ background: C.card, borderRadius: '10px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: C.textSec }}>Totaal wedstrijdkosten</span>
          <span style={{ fontSize: '18px', fontWeight: '800', color: C.green }}>{formatBedrag(totaalKmBedrag + totaalInkom)}</span>
        </div>
      )}
    </div>
  );
}

// ─── UitbetalingsMatrix ────────────────────────────────────────────────────────
// Haalt alle trainingen op voor de periode, bouwt matrix: lesgever × datum
// Een training.lesgevers[]-entry kan een lesgever-doc-id zijn (formulier/zelf
// toevoegen) óf een naam (Excel-import). Los daarom elke sleutel op naar het
// lesgever-record via id, uid of (genormaliseerde) naam, zodat het type/tarief
// altijd gevonden wordt — ongeacht hoe de training is aangemaakt.
function normNaam(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function vindLesgever(key, lijst) {
  if (key == null || !Array.isArray(lijst)) return null;
  return lijst.find(l => l.id === key)
    || lijst.find(l => l.uid && l.uid === key)
    || lijst.find(l => normNaam(l.naam) === normNaam(key))
    || null;
}

function UitbetalingsMatrix({ periode, lesgeversLijst, tarieven, tarieftypes, filterLesgeverId }) {
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
        .filter(t => (t.lesgevers || []).length > 0);

      if (trainingen.length === 0) {
        setData({ datums: [], lesgevers: {} });
        return;
      }

      // Laad groepen voor duurMinuten fallback
      const groepenSnap = await getDocs(collection(db, 'groepen'));
      const groepenMap = {};
      groepenSnap.docs.forEach(d => { groepenMap[d.id] = d.data(); });

      // Bouw matrix — keys zijn lesgeverId (Firestore doc-id), NIET naam
      const datums = [...new Set(trainingen.map(t => t.datum))].sort();
      const matrix = {}; // { lesgeverId: { datum: uren } }

      for (const training of trainingen) {
        const groep = groepenMap[training.groepId];
        const uren = minutenNaarUren(training.duurMinuten || groep?.duurMinuten || 60);
        for (const rawKey of (training.lesgevers || [])) {
          // Normaliseer naar canoniek lesgever-doc-id zodat naam- en id-entries
          // van dezelfde persoon samengeteld worden en het type vindbaar is.
          const lesgeverId = vindLesgever(rawKey, lesgeversLijst)?.id || rawKey;
          if (!matrix[lesgeverId]) matrix[lesgeverId] = {};
          matrix[lesgeverId][training.datum] = (matrix[lesgeverId][training.datum] || 0) + uren;
        }
      }

      // Trainer ziet alleen zichzelf
      const gefilterdeMatrix = filterLesgeverId
        ? Object.fromEntries(Object.entries(matrix).filter(([id]) => id === filterLesgeverId))
        : matrix;

      setData({ datums, lesgevers: gefilterdeMatrix });
    } catch (e) {
      setFout('Laden mislukt: ' + e.message);
    } finally { setLaden(false); }
  }, [periode, lesgeversLijst]);

  useEffect(() => { laad(); }, [laad]);

  const exporteerMatrix = () => {
    if (!data) return;

    const headers = ['Lesgever', 'Type', ...data.datums, 'Totaal uren', 'Tarief/u', 'Totaal €'];
    const rows = [
      [`Uitbetaling ${periode.naam}`],
      headers,
    ];

    // Sorteer lesgevers op naam via lookup
    const gesorteerd = Object.keys(data.lesgevers).sort((a, b) => {
      const naamA = lesgeversLijst.find(l => l.id === a)?.naam ?? a;
      const naamB = lesgeversLijst.find(l => l.id === b)?.naam ?? b;
      return naamA.localeCompare(naamB);
    });

    for (const lesgeverId of gesorteerd) {
      const lesgeverInfo = lesgeversLijst.find(l => l.id === lesgeverId);
      const naam         = lesgeverInfo?.naam ?? lesgeverId;
      const typeId       = lesgeverInfo?.type || '';
      const typeLabel    = tarieftypes.find(t => t.id === typeId)?.label || typeId || '—';
      const tarief       = tarieven[typeId]?.bedragPerUur || 0;

      let totaalUren = 0;
      const datumWaarden = data.datums.map(datum => {
        const uren = data.lesgevers[lesgeverId][datum] || 0;
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
      return gesorteerd.reduce((sum, lid) => sum + (data.lesgevers[lid][datum] || 0), 0);
    });
    rows.push(['TOTAAL', '', ...totaalPerDatum.map(u => u > 0 ? Math.round(u * 100) / 100 : ''), '', '', '']);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Uitbetaling');
    XLSX.writeFile(wb, `uitbetaling_${periode.naam.replace(/\s/g, '_')}.xlsx`);
  };

  if (!periode) return null;
  if (laden) return <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px' }}>Laden…</div>;
  if (fout)   return <div style={{ color: 'var(--danger)', fontSize: '14px', padding: '20px' }}>{fout}</div>;
  if (!data)  return null;

  if (data.datums.length === 0) {
    return (
      <div style={{ background: C.card, borderRadius: '12px', padding: '20px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>
        Geen trainingen met lesgevers gevonden in deze periode.
      </div>
    );
  }

  // Sorteer lesgevers op naam via id-lookup
  const gesorteerd = Object.keys(data.lesgevers).sort((a, b) => {
    const naamA = lesgeversLijst.find(l => l.id === a)?.naam ?? a;
    const naamB = lesgeversLijst.find(l => l.id === b)?.naam ?? b;
    return naamA.localeCompare(naamB);
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontSize: '14px', color: C.textSec, fontWeight: '600' }}>
          {periode.naam} — {gesorteerd.length} lesgever(s) — {data.datums.length} datum(s)
        </div>
        <button onClick={exporteerMatrix}
          style={{ padding: '8px 16px', background: C.green, border: 'none', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '13px', fontWeight: '700' }}>
          📤 Excel exporteren
        </button>
      </div>

      {/* DEBUG: Toon welke lesgevers missende types hebben */}
      <details style={{ background: '#E7F3FF', border: '1px solid #B3D9FF', borderRadius: '8px', padding: '12px', marginBottom: '16px', fontSize: '12px' }}>
        <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#004085' }}>
          🔍 Debug Info (klik om uit te klappen)
        </summary>
        <div style={{ marginTop: '12px', lineHeight: '1.6', color: '#004085' }}>
          <p><strong>Lesgevers IN TRAININGEN van deze periode:</strong> {gesorteerd.length}</p>
          <p><strong>Lesgevers IN BEHEER (actief):</strong> {lesgeversLijst.length}</p>
          
          {/* Welke trainingslesgevers zijn NIET in beheer? */}
          {gesorteerd.filter(id => !lesgeversLijst.find(l => l.id === id)).length > 0 && (
            <div style={{ background: '#FFF3CD', padding: '8px', borderRadius: '4px', margin: '8px 0' }}>
              <strong>⚠️ Deze lesgevers staan in trainingen maar NIET in Beheer:</strong>
              <ul style={{ margin: '4px 0 0 20px', paddingLeft: 0 }}>
                {gesorteerd
                  .filter(id => !lesgeversLijst.find(l => l.id === id))
                  .map(id => <li key={id}>{id}</li>)
                }
              </ul>
              <em style={{ fontSize: '11px' }}>→ Voeg ze toe in Beheer → Lesgevers</em>
            </div>
          )}

          {/* Welke trainingslesgevers hebben geen type? */}
          {gesorteerd.filter(id => {
            const info = lesgeversLijst.find(l => l.id === id);
            return info && !info.type;
          }).length > 0 && (
            <div style={{ background: '#FFF3CD', padding: '8px', borderRadius: '4px', margin: '8px 0' }}>
              <strong>⚠️ Deze lesgevers staan WEL in Beheer maar hebben GEEN type:</strong>
              <ul style={{ margin: '4px 0 0 20px', paddingLeft: 0 }}>
                {gesorteerd
                  .filter(id => {
                    const info = lesgeversLijst.find(l => l.id === id);
                    return info && !info.type;
                  })
                  .map(id => {
                    const info = lesgeversLijst.find(l => l.id === id);
                    return <li key={id}>{info.naam}</li>;
                  })
                }
              </ul>
              <em style={{ fontSize: '11px' }}>→ Vul type in in Beheer → Lesgevers</em>
            </div>
          )}

          {/* Alle trainingslesgevers hebben type? */}
          {gesorteerd.filter(id => {
            const info = lesgeversLijst.find(l => l.id === id);
            return !info || !info.type;
          }).length === 0 && (
            <div style={{ background: '#D4EDDA', padding: '8px', borderRadius: '4px', color: '#155724' }}>
              ✅ Alle lesgevers in deze periode hebben een type ingesteld!
            </div>
          )}

          <hr style={{ margin: '8px 0', borderColor: '#B3D9FF' }} />
          <p style={{ fontSize: '11px', margin: '4px 0' }}>
            💡 <strong>Tip:</strong> Is je naam hier NIET bij, terwijl je in september/november WEL zichtbaar bent?
            → In oktober geef je geen training, dus sta je niet in de matrix.
          </p>
        </div>
      </details>

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
            {gesorteerd.map((lesgeverId, idx) => {
              const lesgeverInfo = lesgeversLijst.find(l => l.id === lesgeverId);
              const naam         = lesgeverInfo?.naam ?? lesgeverId;
              const typeId       = lesgeverInfo?.type || '';
              const typeLabel    = tarieftypes.find(t => t.id === typeId)?.label || '—';
              const tarief       = tarieven[typeId]?.bedragPerUur || 0;
              let totaalUren     = 0;

              return (
                <tr key={lesgeverId} style={{ background: idx % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: '600', position: 'sticky', left: 0, background: idx % 2 === 0 ? C.card : C.bg, borderRight: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                    {naam}
                  </td>
                  <td style={{ padding: '10px 8px', color: C.textMuted, fontSize: '11px' }}>{typeLabel}</td>
                  {data.datums.map(datum => {
                    const uren = data.lesgevers[lesgeverId][datum] || 0;
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
            <tr style={{ background: C.bg, borderTop: `2px solid ${C.border}` }}>
              <td style={{ padding: '10px 12px', color: C.textPrimary, fontWeight: '800', position: 'sticky', left: 0, background: C.bg, borderRight: `1px solid ${C.border}` }}>
                TOTAAL
              </td>
              <td />
              {data.datums.map(datum => {
                const totaal = gesorteerd.reduce((sum, lid) => sum + (data.lesgevers[lid][datum] || 0), 0);
                return (
                  <td key={datum} style={{ padding: '10px 8px', textAlign: 'center', color: C.orange, fontWeight: '700', fontSize: '11px' }}>
                    {totaal > 0 ? `${Math.round(totaal * 100) / 100}u` : ''}
                  </td>
                );
              })}
              <td style={{ padding: '10px 8px', textAlign: 'right', color: C.orange, fontWeight: '800', borderLeft: `1px solid ${C.border}` }}>
                {formatUren(gesorteerd.reduce((sum, lid) => {
                  return sum + data.datums.reduce((s, datum) => s + (data.lesgevers[lid][datum] || 0), 0);
                }, 0))}
              </td>
              <td />
              <td style={{ padding: '10px 8px', textAlign: 'right', color: C.green, fontWeight: '800' }}>
                {formatBedrag(gesorteerd.reduce((sum, lid) => {
                  const info = lesgeversLijst.find(l => l.id === lid);
                  const typeId = info?.type || '';
                  const tarief = tarieven[typeId]?.bedragPerUur || 0;
                  const totaalUren = data.datums.reduce((s, datum) => s + (data.lesgevers[lid][datum] || 0), 0);
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

// ─── StatistiekenTab ───────────────────────────────────────────────────────────
// Toont een overzicht per lesgever-type (assistent vs rest), wedstrijdkosten,
// uren en bedragen voor analyses.
function StatistiekenTab({ lesgeversLijst, tarieven, tarieftypes }) {
  const [periode, setPeriode] = useState(() => periodeVanSnelknop('dit-seizoen'));
  const [trainingen, setTrainingen] = useState([]);
  const [wedstrijdEvents, setWedstrijdEvents] = useState([]);
  const [laden, setLaden] = useState(false);

  // Snelknoppen
  const snelKnoppen = ['dit-seizoen', 'vorige-maand', 'deze-maand'];

  useEffect(() => {
    if (!periode) return;
    setLaden(true);
    Promise.all([
      getDocs(query(
        collection(db, 'trainingen'),
        where('datum', '>=', periode.van),
        where('datum', '<=', periode.tot),
        orderBy('datum', 'asc'),
      )),
      getDocs(collection(db, 'groepen')),
    ]).then(([trainSnap, groepenSnap]) => {
      const groepenMap = {};
      groepenSnap.docs.forEach(d => { groepenMap[d.id] = d.data(); });
      const lijst = trainSnap.docs.map(d => {
        const t = { id: d.id, ...d.data() };
        t._uren = minutenNaarUren(t.duurMinuten || groepenMap[t.groepId]?.duurMinuten || 60);
        return t;
      });
      setTrainingen(lijst);
      setLaden(false);
    }).catch(() => setLaden(false));
  }, [periode]);

  useEffect(() => {
    if (!periode) return;
    const unsub = onSnapshot(collection(db, 'events'), snap => {
      const lijst = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e =>
          e.type === 'wedstrijd' &&
          e.datum >= periode.van &&
          e.datum <= periode.tot &&
          Array.isArray(e.begeleiders) && e.begeleiders.length > 0
        );
      setWedstrijdEvents(lijst);
    });
    return unsub;
  }, [periode]);

  // ── Bereken statistieken ──
  // Per lesgever: totaalUren, totaalBedrag (trainingen)
  function normNaamS(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  function vindLsg(key) {
    if (!key) return null;
    return lesgeversLijst.find(l => l.id === key)
      || lesgeversLijst.find(l => l.uid && l.uid === key)
      || lesgeversLijst.find(l => normNaamS(l.naam) === normNaamS(key))
      || null;
  }

  const perLesgever = {}; // { lesgeverId: { naam, type, uren, bedrag, aantalTrainingen } }
  for (const t of trainingen) {
    for (const rawKey of (t.lesgevers || [])) {
      const lsg = vindLsg(rawKey);
      const id = lsg?.id || rawKey;
      const naam = lsg?.naam || rawKey;
      const typeId = lsg?.type || '';
      const tarief = tarieven[typeId]?.bedragPerUur || 0;
      if (!perLesgever[id]) perLesgever[id] = { naam, type: typeId, uren: 0, bedrag: 0, aantalTrainingen: 0, isAssistent: typeId === 'assistent' };
      perLesgever[id].uren += t._uren;
      perLesgever[id].bedrag += t._uren * tarief;
      perLesgever[id].aantalTrainingen += 1;
    }
  }

  // Wedstrijdkosten per begeleider
  const kmTarief = tarieven['kilometer']?.bedragPerKm || 0;
  const perBegeleider = {}; // { naam: { km, kmBedrag, inkom, aantalWedstrijden } }
  for (const ev of wedstrijdEvents) {
    for (const b of (ev.begeleiders || []).filter(x => x.aanwezig !== false)) {
      const key = b.naam || b.lesgeverId || '—';
      if (!perBegeleider[key]) perBegeleider[key] = { naam: key, km: 0, kmBedrag: 0, inkom: 0, aantalWedstrijden: 0, isAssistent: false };
      const lsg = vindLsg(b.lesgeverId);
      perBegeleider[key].isAssistent = lsg?.type === 'assistent';
      perBegeleider[key].km += parseFloat(b.km) || 0;
      perBegeleider[key].kmBedrag += (parseFloat(b.km) || 0) * kmTarief;
      perBegeleider[key].inkom += parseFloat(b.inkom) || 0;
      perBegeleider[key].aantalWedstrijden += 1;
    }
  }

  // Groepeer op type: assistent vs rest
  const assistenten = Object.values(perLesgever).filter(l => l.isAssistent);
  const trainers = Object.values(perLesgever).filter(l => !l.isAssistent);

  const totaalUren = Object.values(perLesgever).reduce((s, l) => s + l.uren, 0);
  const totaalBedrag = Object.values(perLesgever).reduce((s, l) => s + l.bedrag, 0);
  const totaalKm = Object.values(perBegeleider).reduce((s, b) => s + b.km, 0);
  const totaalKmBedrag = Object.values(perBegeleider).reduce((s, b) => s + b.kmBedrag, 0);
  const totaalInkom = Object.values(perBegeleider).reduce((s, b) => s + b.inkom, 0);
  const totaalWedstrijdkosten = totaalKmBedrag + totaalInkom;
  const totaalUitbetaling = totaalBedrag + totaalWedstrijdkosten;

  const kpiStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '4px' };
  const kpiLabelStyle = { fontSize: '11px', color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' };
  const kpiValueStyle = (color) => ({ fontSize: '22px', fontWeight: '800', color: color || C.textPrimary });

  function LesgeversGroep({ titel, lijst, kleur, emoji }) {
    if (lijst.length === 0) return null;
    const totU = lijst.reduce((s, l) => s + l.uren, 0);
    const totB = lijst.reduce((s, l) => s + l.bedrag, 0);
    return (
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', paddingBottom: '8px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '15px', fontWeight: '700', color: C.textPrimary }}>{emoji} {titel}</span>
          <span style={{ fontSize: '12px', color: C.textMuted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '2px 10px' }}>{lijst.length} personen</span>
          <span style={{ marginLeft: 'auto', fontSize: '14px', fontWeight: '800', color: kleur }}>{formatBedrag(totB)}</span>
        </div>
        <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: C.bg }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700' }}>Naam</th>
                <th style={{ padding: '8px 8px', textAlign: 'center', color: C.textMuted, fontWeight: '700' }}>Trainingen</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', color: C.textMuted, fontWeight: '700' }}>Uren</th>
                <th style={{ padding: '8px 8px', textAlign: 'right', color: kleur, fontWeight: '700' }}>Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {lijst.sort((a, b) => b.uren - a.uren).map((l, i) => (
                <tr key={l.naam} style={{ background: i % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: '600' }}>{l.naam}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'center', color: C.textMuted }}>{l.aantalTrainingen}×</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textPrimary }}>{formatUren(l.uren)}</td>
                  <td style={{ padding: '8px 8px', textAlign: 'right', color: kleur, fontWeight: '700' }}>{formatBedrag(l.bedrag)}</td>
                </tr>
              ))}
              <tr style={{ background: C.bg, borderTop: `2px solid ${C.border}` }}>
                <td colSpan={2} style={{ padding: '8px 12px', fontWeight: '800', color: C.textPrimary }}>Subtotaal</td>
                <td style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>{formatUren(totU)}</td>
                <td style={{ padding: '8px 8px', textAlign: 'right', color: kleur, fontWeight: '800' }}>{formatBedrag(totB)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Periode kiezer */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>Periode</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {snelKnoppen.map(type => {
            const p = periodeVanSnelknop(type);
            const actief = periode?.van === p.van && periode?.tot === p.tot;
            return (
              <button key={type} onClick={() => setPeriode(p)}
                style={{ padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actief ? C.red : C.card, border: `1px solid ${actief ? C.red : C.border}`, color: actief ? 'var(--text-primary)' : C.textSec }}>
                {p.naam}
              </button>
            );
          })}
        </div>
        {periode && (
          <div style={{ marginTop: '6px', fontSize: '12px', color: C.textMuted }}>
            {periode.van} → {periode.tot}
          </div>
        )}
      </div>

      {laden ? (
        <div style={{ color: C.textMuted, padding: '20px', textAlign: 'center' }}>Laden…</div>
      ) : (
        <>
          {/* KPI-strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            <div style={kpiStyle}>
              <span style={kpiLabelStyle}>Totaal uitbetaling</span>
              <span style={kpiValueStyle(C.green)}>{formatBedrag(totaalUitbetaling)}</span>
              <span style={{ fontSize: '11px', color: C.textMuted }}>trainingen + wedstrijden</span>
            </div>
            <div style={kpiStyle}>
              <span style={kpiLabelStyle}>🥋 Trainingen</span>
              <span style={kpiValueStyle(C.red)}>{formatBedrag(totaalBedrag)}</span>
              <span style={{ fontSize: '11px', color: C.textMuted }}>{formatUren(totaalUren)} totaal</span>
            </div>
            <div style={kpiStyle}>
              <span style={kpiLabelStyle}>🏆 Wedstrijdkosten</span>
              <span style={kpiValueStyle(C.orange)}>{formatBedrag(totaalWedstrijdkosten)}</span>
              <span style={{ fontSize: '11px', color: C.textMuted }}>km + inkom</span>
            </div>
            <div style={kpiStyle}>
              <span style={kpiLabelStyle}>Assistenten</span>
              <span style={kpiValueStyle(C.blue)}>{assistenten.length}</span>
              <span style={{ fontSize: '11px', color: C.textMuted }}>van {Object.keys(perLesgever).length} lesgevers</span>
            </div>
            <div style={kpiStyle}>
              <span style={kpiLabelStyle}>Km vergoed</span>
              <span style={kpiValueStyle(C.orange)}>{totaalKm} km</span>
              <span style={{ fontSize: '11px', color: C.textMuted }}>{formatBedrag(totaalKmBedrag)} uitbetaald</span>
            </div>
            <div style={kpiStyle}>
              <span style={kpiLabelStyle}>Inkomgeld terugbetaald</span>
              <span style={kpiValueStyle(C.blue)}>{formatBedrag(totaalInkom)}</span>
              <span style={{ fontSize: '11px', color: C.textMuted }}>{wedstrijdEvents.length} wedstrijden</span>
            </div>
          </div>

          {/* Lesgevers: assistenten vs rest */}
          <div style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '700', color: C.textPrimary }}>🥋 Trainingen per lesgever</div>
          {Object.keys(perLesgever).length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: '14px', fontStyle: 'italic', marginBottom: '24px' }}>Geen trainingsdata in deze periode.</div>
          ) : (
            <>
              <LesgeversGroep titel="Assistenten" lijst={assistenten} kleur={C.blue} emoji="🎓" />
              <LesgeversGroep titel="Trainers & initiators" lijst={trainers} kleur={C.red} emoji="🥋" />
            </>
          )}

          {/* Wedstrijdkosten per begeleider */}
          {Object.keys(perBegeleider).length > 0 && (
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: C.textPrimary, marginBottom: '10px', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>🏆 Wedstrijdkosten per begeleider</div>
              <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}` }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: C.bg }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: '700' }}>Naam</th>
                      <th style={{ padding: '8px 8px', textAlign: 'center', color: C.textMuted, fontWeight: '700' }}>Wedstrijden</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>Km</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>Km-vergoeding</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', color: C.blue, fontWeight: '700' }}>Inkom</th>
                      <th style={{ padding: '8px 8px', textAlign: 'right', color: C.green, fontWeight: '700' }}>Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(perBegeleider).sort((a, b) => (b.kmBedrag + b.inkom) - (a.kmBedrag + a.inkom)).map((b, i) => (
                      <tr key={b.naam} style={{ background: i % 2 === 0 ? C.card : C.bg, borderTop: `1px solid ${C.border}` }}>
                        <td style={{ padding: '8px 12px', color: C.textPrimary, fontWeight: '600' }}>
                          {b.naam}
                          {b.isAssistent && <span style={{ marginLeft: '6px', fontSize: '10px', background: 'rgba(59,130,246,0.15)', color: C.blue, border: `1px solid rgba(59,130,246,0.3)`, borderRadius: '4px', padding: '1px 5px' }}>assistent</span>}
                        </td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', color: C.textMuted }}>{b.aantalWedstrijden}×</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: C.textPrimary }}>{b.km > 0 ? `${b.km} km` : '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>{b.kmBedrag > 0 ? formatBedrag(b.kmBedrag) : '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: C.blue, fontWeight: '700' }}>{b.inkom > 0 ? formatBedrag(b.inkom) : '—'}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'right', color: C.green, fontWeight: '800' }}>{formatBedrag(b.kmBedrag + b.inkom)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: C.bg, borderTop: `2px solid ${C.border}` }}>
                      <td colSpan={2} style={{ padding: '8px 12px', fontWeight: '800', color: C.textPrimary }}>TOTAAL</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '700' }}>{totaalKm} km</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: C.orange, fontWeight: '800' }}>{formatBedrag(totaalKmBedrag)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: C.blue, fontWeight: '800' }}>{formatBedrag(totaalInkom)}</td>
                      <td style={{ padding: '8px 8px', textAlign: 'right', color: C.green, fontWeight: '800' }}>{formatBedrag(totaalWedstrijdkosten)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Hoofd component Uitbetalingen ─────────────────────────────────────────────
export default function Uitbetalingen() {
  const { isBeheerder, isTrainer, isAssistent, profiel, lesgeverId, configCache } = useAuth();
  const confirm = useConfirm();
  const [tarieven, setTarieven]     = useState({});
  const [tarieftypes, setTarieftypes] = useState([]);
  const [lesgeversLijst, setLesgeversLijst] = useState([]);
  const [periodes, setPeriodes]     = useState([]);
  const [actievePeriode, setActievePeriode] = useState(() => periodeVanSnelknop('deze-maand'));
  const [tabBlad, setTabBlad]       = useState('matrix'); // 'matrix' | 'periodes'
  const maandOpties = maandOptiesVoorSeizoen();
  const actieveMaandWaarde = maandOpties.find(p => p.van === actievePeriode?.van && p.tot === actievePeriode?.tot)?.value || '';

  // Laad tarieven (realtime)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tarieven'), snap => {
      const data = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setTarieven(data);
    });
    return unsub;
  }, []);

  // Laad tarieftypes (realtime) — rechtstreeks uit Firestore, niet via stale configCache
  useEffect(() => {
    getDocs(collection(db, 'lesgevers')).then(snap => {
      // Geen actief-filter: trainingen kunnen verwijzen naar (intussen) inactieve
      // lesgevers, en we hebben hun type nodig voor de tarief-koppeling.
      setLesgeversLijst(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''))
      );
    });
  }, []);

  // Laad lesgevers REAL-TIME via custom hook
  const { lesgevers: lesgeversData, loading: lesgeversLaden } = useLesgeversRealtime();

  useEffect(() => {
    const filtered = lesgeversData
      .filter(l => l.actief !== false)
      .sort((a, b) => a.naam.localeCompare(b.naam));
    setLesgeversLijst(filtered);
  }, [lesgeversData]);

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
    const ok = await confirm({
      titel: 'Uitbetalingsperiode verwijderen?',
      beschrijving: 'De periode wordt definitief verwijderd. Reeds gegenereerde overzichten worden niet meer zichtbaar.',
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    await deleteDoc(doc(db, 'uitbetalingsperiodes', id));
    if (actievePeriode?.id === id) setActievePeriode(null);
  };

  if (!isTrainer && !isBeheerder && !isAssistent) {
    return (
      <div style={{ color: C.textPrimary, padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
        <div style={{ fontSize: '16px', color: C.textSec }}>Geen toegang.</div>
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
          { id: 'matrix',      label: '📊 Overzicht' },
          { id: 'statistieken', label: '📈 Statistieken' },
          { id: 'periodes',    label: '📅 Periodes' },
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


      {/* Periodes tabblad */}
      {tabBlad === 'periodes' && (
        <PeriodeBeheer
          periodes={periodes}
          onNieuwe={voegPeriodeToe}
          onVerwijder={verwijderPeriode}
        />
      )}

      {/* Statistieken tabblad */}
      {tabBlad === 'statistieken' && isBeheerder && (
        <StatistiekenTab
          lesgeversLijst={lesgeversLijst}
          tarieven={tarieven}
          tarieftypes={tarieftypes}
        />
      )}
      {tabBlad === 'statistieken' && !isBeheerder && (
        <div style={{ color: C.textMuted, textAlign: 'center', padding: '40px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
          <div>Statistieken zijn enkel zichtbaar voor beheerders.</div>
        </div>
      )}

      {/* Matrix tabblad */}
      {tabBlad === 'matrix' && (
        <div>
          {/* Maandenfilter — altijd zichtbaar */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
              Maanden
            </div>
            <select
              value={actieveMaandWaarde}
              onChange={e => {
                const gekozen = maandOpties.find(p => p.value === e.target.value);
                if (gekozen) setActievePeriode(gekozen);
              }}
              style={{
                width: '100%',
                maxWidth: '360px',
                padding: '9px 12px',
                background: C.card,
                border: `1px solid ${C.border}`,
                borderRadius: '8px',
                color: C.textPrimary,
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              <option value="">Kies een maand...</option>
              {maandOpties.map(p => (
                <option key={p.id} value={p.value}>
                  {p.naam}
                </option>
              ))}
            </select>
          </div>

          {/* Snelknoppen — altijd zichtbaar */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
              Snelle selectie
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {['deze-maand', 'vorige-maand', 'dit-seizoen'].map(type => {
                const p = periodeVanSnelknop(type);
                const actief = actievePeriode?.van === p.van && actievePeriode?.tot === p.tot;
                return (
                  <button key={type} onClick={() => setActievePeriode(p)}
                    style={{ padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actief ? C.red : C.card, border: `1px solid ${actief ? C.red : C.border}`, color: actief ? 'var(--text-primary)' : C.textSec }}>
                    {p.naam}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Opgeslagen periodes (indien aanwezig) */}
          {periodes.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' }}>
                Opgeslagen periodes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {periodes.map(p => {
                  const actief = actievePeriode?.id === p.id;
                  return (
                    <button key={p.id} onClick={() => setActievePeriode(p)}
                      style={{ padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actief ? C.red : C.card, border: `1px solid ${actief ? C.red : C.border}`, color: actief ? 'var(--text-primary)' : C.textSec }}>
                      {p.naam}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Matrix */}
          {actievePeriode ? (
            <>
              {/* Trainingen sectie header */}
              <div style={{ fontSize: '12px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
                🥋 Trainingen
              </div>
              {lesgeversLaden ? (
                <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px' }}>Lesgevers laden…</div>
              ) : (
                <UitbetalingsMatrix
                  periode={actievePeriode}
                  lesgeversLijst={lesgeversLijst}
                  tarieven={tarieven}
                  tarieftypes={tarieftypes}
                  filterLesgeverId={isBeheerder ? null : lesgeverId}
                />
              )}
              <WedstrijdKosten
                periode={actievePeriode}
                lesgeverId={lesgeverId}
                isBeheerder={isBeheerder}
                tarieven={tarieven}
              />
            </>
          ) : (
            <div style={{ background: C.card, borderRadius: '12px', padding: '24px', textAlign: 'center', color: C.textMuted }}>
              Selecteer een periode hierboven.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
