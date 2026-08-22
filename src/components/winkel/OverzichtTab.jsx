import React, { useMemo, useState } from 'react';
import {
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { runTransactionMetRetry } from '../../utils/firestoreRetry';
import { fmtBedrag } from './winkelData';
import { useConfirm } from '../../contexts/ConfirmContext';

export default function OverzichtTab({ allSales, profiel, verkoopmomenten = [] }) {
  const confirm = useConfirm();
  const [filter, setFilter] = useState('alle');
  const [eventFilter, setEventFilter] = useState('alle');
  const [kassaFilter, setKassaFilter] = useState('alle');
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

    const bedrag = sale.totaal || sale.total || 0;
    const result = await confirm({
      titel: 'Boeking annuleren?',
      beschrijving: `Boeking van ${fmtBedrag(bedrag)} wordt geannuleerd. De voorraad wordt automatisch hersteld.`,
      bevestigLabel: 'Ja, annuleer',
      variant: 'danger',
      redenVeld: { verplicht: true, placeholder: 'Reden van annulatie…' },
    });
    if (!result.ok) return;
    const reden = result.reden;

    setError('');
    setCancellingId(sale.id);

    try {
      await runTransactionMetRetry(db, async (transaction) => {
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
          annulatieReden: reden,
        });
      });
    } catch (e) {
      console.error(e);
      setError(e.message || 'Annuleren mislukt.');
    }

    setCancellingId(null);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px', marginBottom: '16px' }}>
        <Stat label="Openstaand" value={fmtBedrag(totaalOpen)} color="var(--warning)" />
        <Stat label="Betaald" value={fmtBedrag(totaalBetaald)} color="var(--success)" />
        <Stat label="Geannuleerd" value={fmtBedrag(totaalGeannuleerd)} color="var(--text-secondary)" />
      </div>

      {error && (
        <div style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px', fontSize: 'var(--font-size-sm)' }}>
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
            <div key={s.id} style={{ position: 'relative', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '14px', paddingLeft: '18px', opacity: isGeannuleerd ? 0.65 : 1, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: isGeannuleerd ? 'var(--border-color)' : isBetaald ? 'var(--success)' : 'var(--warning)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '800', fontSize: '15px' }}>{s.koperNaam || '-'}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{datumLabel(s)}</span>
                    {s.eventNaam && <span style={smallTag}>{s.eventNaam}</span>}
                    {s.kassaNaam && <span style={smallTag}>{s.kassaNaam}</span>}
                  </div>

                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '8px', lineHeight: 1.4 }}>
                    {items.length > 0
                      ? items.map(i => `${i.naam || i.name || '-'} ${i.variant || ''} x${i.qty || 0}`).join(' · ')
                      : 'Geen items'}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ background: isCash ? 'var(--success)' : '#3498db', color: 'var(--text-primary)', borderRadius: '10px', padding: '2px 8px', fontSize: 'var(--font-size-xs)', fontWeight: '700' }}>
                      {isCash ? 'Cash' : 'Overschrijving'}
                    </span>
                    <span style={{ background: isGeannuleerd ? 'var(--border-color)' : isBetaald ? 'var(--success)' : 'var(--warning)', color: 'var(--text-primary)', borderRadius: '10px', padding: '2px 8px', fontSize: 'var(--font-size-xs)', fontWeight: '700' }}>
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
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', fontWeight: '700' }}>Stock hersteld</div>
                  ) : (
                    <button onClick={() => annuleerBoeking(s)} disabled={cancellingId === s.id} style={outlineDangerBtn}>
                      {cancellingId === s.id ? 'Bezig...' : 'Annuleer boeking'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px', fontSize: 'var(--font-size-md)' }}>Geen resultaten</div>}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '10px', padding: '12px', borderLeft: '3px solid ' + color }}>
      <div style={{ fontSize: '22px', fontWeight: '700' }}>{value}</div>
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
  fontSize: 'var(--font-size-sm)',
  boxSizing: 'border-box',
  outline: 'none',
};

const smallTag = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-secondary)',
  borderRadius: '10px',
  padding: '2px 8px',
  fontSize: 'var(--font-size-xs)',
  fontWeight: '700',
};

function filterBtn(active) {
  return {
    flexShrink: 0,
    background: active ? 'var(--accent-red)' : 'var(--bg-card)',
    border: 'none',
    color: 'var(--text-primary)',
    padding: '7px 14px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: active ? '600' : '400',
  };
}

const outlineDangerBtn = { background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '700' };
