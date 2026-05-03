import React, { useMemo, useState } from 'react';
import {
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { fmtBedrag } from './winkelData';

export default function OverzichtTab({ allSales, profiel, verkoopmomenten = [] }) {
  const [filter, setFilter] = useState('alle');
  const [eventFilter, setEventFilter] = useState('alle');
  const [kassaFilter, setKassaFilter] = useState('alle');
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [annulatieReden, setAnnulatieReden] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState('');

  const kassaNamen = useMemo(() => {
    return [...new Set(allSales.map(s => s.kassaNaam).filter(Boolean))].sort();
  }, [allSales]);

  const basisFiltered = allSales.filter(s => {
    if (eventFilter !== 'alle' && (s.eventId || 'geen') !== eventFilter) return false;
    if (kassaFilter !== 'alle' && (s.kassaNaam || 'Geen kassa') !== kassaFilter) return false;
    return true;
  });

  const actieveSales = basisFiltered.filter(s => !s.geannuleerd);

  const filtered = basisFiltered.filter(s => {
    if (filter === 'geannuleerd') return s.geannuleerd === true;
    if (filter === 'open') return !s.geannuleerd && !s.betaald;
    if (filter === 'betaald') return !s.geannuleerd && s.betaald;
    if (filter === 'cash') return !s.geannuleerd && s.betaalmethode === 'cash';
    if (filter === 'overschrijving') return !s.geannuleerd && s.betaalmethode === 'overschrijving';
    return true;
  });

  const totaalOpen = actieveSales.filter(s => !s.betaald).reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);
  const totaalBetaald = actieveSales.filter(s => s.betaald).reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);
  const totaalGeannuleerd = basisFiltered.filter(s => s.geannuleerd).reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);

  function datumLabel(s) {
    const ts = s.aangemaaktOp || s.createdAt;
    return ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '-';
  }

  async function annuleerBoeking(sale) {
    if (!sale?.id || sale.geannuleerd) return;

    setError('');
    setCancellingId(sale.id);

    try {
      await runTransaction(db, async (transaction) => {
        const saleRef = doc(db, 'sales', sale.id);
        const saleSnap = await transaction.get(saleRef);

        if (!saleSnap.exists()) {
          throw new Error('Boeking niet gevonden.');
        }

        const saleData = saleSnap.data();
        if (saleData.geannuleerd) {
          throw new Error('Deze boeking is al geannuleerd.');
        }

        const items = Array.isArray(saleData.items) ? saleData.items : [];
        const stockItems = items.filter(item => item.productId && Number(item.qty || 0) > 0);
        const productRefs = stockItems.map(item => doc(db, 'products', item.productId));
        const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));

        for (let i = 0; i < stockItems.length; i++) {
          const snap = productSnaps[i];
          if (!snap.exists()) continue;

          const productData = snap.data();
          const qty = Number(stockItems[i].qty || 0);
          transaction.update(productRefs[i], {
            stock: Number(productData.stock || 0) + qty,
            soldCount: Math.max(0, Number(productData.soldCount || 0) - qty),
          });
        }

        transaction.update(saleRef, {
          geannuleerd: true,
          geannuleerdOp: serverTimestamp(),
          geannuleerdDoor: profiel?.uid || null,
          geannuleerdDoorNaam: profiel?.naam || profiel?.email || null,
          annulatieReden: annulatieReden.trim() || 'Geen reden opgegeven',
        });
      });

      setConfirmCancelId(null);
      setAnnulatieReden('');
    } catch (e) {
      console.error(e);
      setError(e.message || 'Annuleren mislukt.');
    }

    setCancellingId(null);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px', marginBottom: '16px' }}>
        <Stat label="Openstaand" value={fmtBedrag(totaalOpen)} color="#f39c12" />
        <Stat label="Betaald" value={fmtBedrag(totaalBetaald)} color="#27ae60" />
        <Stat label="Geannuleerd" value={fmtBedrag(totaalGeannuleerd)} color="#777" />
      </div>

      {error && (
        <div style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
        <select value={eventFilter} onChange={e => setEventFilter(e.target.value)} style={inputStyle}>
          <option value="alle">Alle verkoopmomenten</option>
          <option value="geen">Geen verkoopmoment</option>
          {verkoopmomenten.map(v => <option key={v.id} value={v.id}>{v.naam}</option>)}
        </select>
        <select value={kassaFilter} onChange={e => setKassaFilter(e.target.value)} style={inputStyle}>
          <option value="alle">Alle kassa's</option>
          {kassaNamen.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {[
          ['alle', 'Alle'],
          ['open', 'Openstaand'],
          ['betaald', 'Betaald'],
          ['cash', 'Cash'],
          ['overschrijving', 'Overschrijving'],
          ['geannuleerd', 'Geannuleerd'],
        ].map(([value, label]) => (
          <button key={value} onClick={() => setFilter(value)} style={filterBtn(filter === value)}>{label}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map(s => {
          const isCash = s.betaalmethode === 'cash';
          const isBetaald = s.betaald;
          const isGeannuleerd = s.geannuleerd === true;
          const bedrag = s.totaal || s.total || 0;
          const items = Array.isArray(s.items) ? s.items : [];

          return (
            <div key={s.id} style={{ position: 'relative', background: '#2d2d2d', border: '1px solid ' + (isGeannuleerd ? '#555' : '#3a3a3a'), borderRadius: '12px', padding: '14px', paddingLeft: '18px', opacity: isGeannuleerd ? 0.65 : 1, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: isGeannuleerd ? '#777' : isBetaald ? '#27ae60' : '#f39c12' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '800', fontSize: '15px' }}>{s.koperNaam || '-'}</span>
                    <span style={{ color: '#888', fontSize: '12px' }}>{datumLabel(s)}</span>
                    {s.eventNaam && <span style={smallTag}>{s.eventNaam}</span>}
                    {s.kassaNaam && <span style={smallTag}>{s.kassaNaam}</span>}
                  </div>

                  <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '8px', lineHeight: 1.4 }}>
                    {items.length > 0
                      ? items.map(i => `${i.naam || i.name || '-'} ${i.variant || ''} x${i.qty || 0}`).join(' · ')
                      : 'Geen items'}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ background: isCash ? '#27ae60' : '#3498db', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>
                      {isCash ? 'Cash' : 'Overschrijving'}
                    </span>
                    <span style={{ background: isGeannuleerd ? '#777' : isBetaald ? '#27ae60' : '#f39c12', color: '#fff', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>
                      {isGeannuleerd ? 'Geannuleerd' : isBetaald ? 'Betaald' : 'Openstaand'}
                    </span>
                    {s.verkoperNaam && <span style={smallTag}>Verkoper: {s.verkoperNaam}</span>}
                    {s.betaaldDoorNaam && <span style={smallTag}>Betaald door: {s.betaaldDoorNaam}</span>}
                    {isGeannuleerd && s.annulatieReden && <span style={smallTag}>Reden: {s.annulatieReden}</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>{fmtBedrag(bedrag)}</div>
                  {isGeannuleerd ? (
                    <div style={{ color: '#888', fontSize: '12px', fontWeight: '700' }}>Stock hersteld</div>
                  ) : confirmCancelId === s.id ? (
                    <div style={{ minWidth: '220px' }}>
                      <input value={annulatieReden} onChange={e => setAnnulatieReden(e.target.value)} placeholder="Reden annulatie" style={{ ...inputStyle, marginBottom: '8px' }} />
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button onClick={() => annuleerBoeking(s)} disabled={cancellingId === s.id} style={dangerBtn}>{cancellingId === s.id ? 'Bezig' : 'Ja, annuleer'}</button>
                        <button onClick={() => { setConfirmCancelId(null); setAnnulatieReden(''); }} disabled={cancellingId === s.id} style={neutralBtn}>Nee</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmCancelId(s.id)} style={outlineDangerBtn}>Annuleer boeking</button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <div style={{ color: '#555', textAlign: 'center', padding: '30px', fontSize: '14px' }}>Geen resultaten</div>}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '12px', borderLeft: '3px solid ' + color }}>
      <div style={{ fontSize: '22px', fontWeight: '700' }}>{value}</div>
      <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#1a1a1a',
  border: '1px solid #3a3a3a',
  borderRadius: '8px',
  color: '#fff',
  padding: '10px 12px',
  fontSize: '13px',
  boxSizing: 'border-box',
  outline: 'none',
};

const smallTag = {
  background: '#1a1a1a',
  border: '1px solid #3a3a3a',
  color: '#aaa',
  borderRadius: '10px',
  padding: '2px 8px',
  fontSize: '11px',
  fontWeight: '700',
};

function filterBtn(active) {
  return {
    flexShrink: 0,
    background: active ? '#c0392b' : '#2d2d2d',
    border: 'none',
    color: '#fff',
    padding: '7px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: active ? '600' : '400',
  };
}

const dangerBtn = { background: '#e74c3c', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' };
const neutralBtn = { background: '#3a3a3a', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' };
const outlineDangerBtn = { background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' };
