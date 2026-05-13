import React, { useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { fmtBedrag } from './winkelData';

const KASSA_NAMEN = ['Kassa 1', 'Kassa 2', 'Kassa 3', 'Kassa 4'];

function tsLabel(ts) {
  return ts?.toDate ? ts.toDate().toLocaleString('nl-BE') : '-';
}

function berekenRapport(sales) {
  const actief = sales.filter(s => !s.geannuleerd);
  const geannuleerd = sales.filter(s => s.geannuleerd);
  const cash = actief.filter(s => s.betaalmethode === 'cash');
  const overschrijving = actief.filter(s => s.betaalmethode === 'overschrijving');
  const open = actief.filter(s => !s.betaald);

  return {
    aantal: actief.length,
    aantalGeannuleerd: geannuleerd.length,
    cash: cash.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0),
    overschrijving: overschrijving.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0),
    open: open.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0),
    geannuleerd: geannuleerd.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0),
    totaal: actief.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0),
  };
}

export default function VerkoopmomentenTab({ verkoopmomenten, allSales, profiel, activeEventId, setActiveEventId }) {
  const [naam, setNaam] = useState('');
  const [cashStart, setCashStart] = useState('0');
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(activeEventId || '');
  const [cashGeteld, setCashGeteld] = useState('');
  const [opmerking, setOpmerking] = useState('');

  const selectedEvent = verkoopmomenten.find(v => v.id === selectedId) || verkoopmomenten.find(v => v.id === activeEventId) || verkoopmomenten[0] || null;
  const selectedSales = selectedEvent ? allSales.filter(s => s.eventId === selectedEvent.id) : [];
  const rapport = useMemo(() => berekenRapport(selectedSales), [selectedSales]);

  const perKassa = useMemo(() => {
    const groepen = {};
    selectedSales.forEach(s => {
      const key = s.kassaNaam || 'Geen kassa';
      if (!groepen[key]) groepen[key] = [];
      groepen[key].push(s);
    });
    return Object.entries(groepen).map(([kassaNaam, sales]) => ({ kassaNaam, ...berekenRapport(sales) }));
  }, [selectedSales]);

  async function maakVerkoopmoment() {
    if (!naam.trim()) return;
    setSaving(true);
    try {
      const ref = await addDoc(collection(db, 'verkoopmomenten'), {
        naam: naam.trim(),
        status: 'actief',
        kassaNamen: KASSA_NAMEN,
        cashStart: Number(cashStart || 0),
        createdAt: serverTimestamp(),
        createdBy: profiel?.uid || null,
        createdByNaam: profiel?.naam || profiel?.email || null,
      });
      setActiveEventId(ref.id);
      setSelectedId(ref.id);
      setNaam('');
      setCashStart('0');
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  async function sluitVerkoopmoment() {
    if (!selectedEvent?.id) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'verkoopmomenten', selectedEvent.id), {
        status: 'afgesloten',
        afgeslotenOp: serverTimestamp(),
        afgeslotenDoor: profiel?.uid || null,
        afgeslotenDoorNaam: profiel?.naam || profiel?.email || null,
        cashGeteld: Number(cashGeteld || 0),
        cashVerwacht: rapport.cash + Number(selectedEvent.cashStart || 0),
        cashVerschil: Number(cashGeteld || 0) - (rapport.cash + Number(selectedEvent.cashStart || 0)),
        opmerking: opmerking.trim(),
      });
      if (activeEventId === selectedEvent.id) setActiveEventId('');
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  return (
    <div>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px' }}>Nieuw verkoopmoment</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '8px', alignItems: 'end' }}>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>Naam</div>
            <input value={naam} onChange={e => setNaam(e.target.value)} placeholder="bv. Verkoopmoment september" style={inputStyle} />
          </div>
          <div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>Startcash</div>
            <input type="number" min="0" step="0.01" value={cashStart} onChange={e => setCashStart(e.target.value)} style={inputStyle} />
          </div>
          <button onClick={maakVerkoopmoment} disabled={saving || !naam.trim()} style={primaryBtn(!saving && naam.trim())}>
            Start
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 12px' }}>Rapport en kasafsluiting</h3>
        <select value={selectedEvent?.id || ''} onChange={e => { setSelectedId(e.target.value); setActiveEventId(e.target.value); }} style={inputStyle}>
          <option value="">Geen verkoopmoment geselecteerd</option>
          {verkoopmomenten.map(v => (
            <option key={v.id} value={v.id}>{v.naam} - {v.status || 'actief'}</option>
          ))}
        </select>

        {selectedEvent ? (
          <>
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '8px' }}>
              Gestart: {tsLabel(selectedEvent.createdAt)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '10px', marginTop: '14px' }}>
              <Stat label="Totaal" value={fmtBedrag(rapport.totaal)} color="var(--success)" />
              <Stat label="Cash" value={fmtBedrag(rapport.cash)} color="var(--success)" />
              <Stat label="Overschrijving" value={fmtBedrag(rapport.overschrijving)} color="#3498db" />
              <Stat label="Openstaand" value={fmtBedrag(rapport.open)} color="var(--warning)" />
              <Stat label="Geannuleerd" value={fmtBedrag(rapport.geannuleerd)} color="var(--text-muted)" />
              <Stat label="Verkopen" value={rapport.aantal} color="var(--accent-red)" />
            </div>

            <div style={{ marginTop: '16px' }}>
              <h4 style={{ margin: '0 0 8px' }}>Per kassa</h4>
              {perKassa.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Nog geen verkopen.</div>
              ) : perKassa.map(k => (
                <div key={k.kassaNaam} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: 'var(--font-size-sm)' }}>
                  <span>{k.kassaNaam}</span>
                  <span>Cash {fmtBedrag(k.cash)} · Overschrijving {fmtBedrag(k.overschrijving)} · {k.aantal} verkopen</span>
                </div>
              ))}
            </div>

            {selectedEvent.status !== 'afgesloten' ? (
              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '8px', alignItems: 'end' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>Cash geteld</div>
                  <input type="number" min="0" step="0.01" value={cashGeteld} onChange={e => setCashGeteld(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '4px' }}>Opmerking</div>
                  <input value={opmerking} onChange={e => setOpmerking(e.target.value)} style={inputStyle} />
                </div>
                <button onClick={sluitVerkoopmoment} disabled={saving} style={dangerBtn}>
                  Sluit af
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '14px', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                Afgesloten. Cash verwacht: {fmtBedrag(selectedEvent.cashVerwacht || 0)} · Cash geteld: {fmtBedrag(selectedEvent.cashGeteld || 0)} · Verschil: {fmtBedrag(selectedEvent.cashVerschil || 0)}
              </div>
            )}
          </>
        ) : (
          <div style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>Selecteer of start een verkoopmoment.</div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-primary)', borderRadius: '10px', padding: '12px', borderLeft: '3px solid ' + color }}>
      <div style={{ fontSize: '20px', fontWeight: '800' }}>{value}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  padding: '10px 12px',
  fontSize: 'var(--font-size-md)',
  boxSizing: 'border-box',
  outline: 'none',
};

function primaryBtn(enabled) {
  return {
    background: enabled ? 'var(--accent-red)' : 'var(--border-color)',
    border: 'none',
    color: 'var(--text-primary)',
    padding: '10px 18px',
    borderRadius: 'var(--radius-md)',
    cursor: enabled ? 'pointer' : 'not-allowed',
    fontSize: 'var(--font-size-md)',
    fontWeight: '700',
  };
}

const dangerBtn = {
  background: 'var(--danger)',
  border: 'none',
  color: 'var(--text-primary)',
  padding: '10px 18px',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: 'var(--font-size-md)',
  fontWeight: '700',
};
