import React, { useState } from 'react';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { fmtBedrag } from './winkelData';

export default function OverzichtTab({ allSales, profiel }) {
  const [filter, setFilter] = useState('alle');
  const [confirmCancelId, setConfirmCancelId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [error, setError] = useState('');

  const actieveSales = allSales.filter(s => !s.geannuleerd);

  const filtered = allSales.filter(s => {
    if (filter === 'geannuleerd') return s.geannuleerd === true;
    if (filter === 'open') return !s.geannuleerd && !s.betaald;
    if (filter === 'betaald') return !s.geannuleerd && s.betaald;
    if (filter === 'cash') return !s.geannuleerd && s.betaalmethode === 'cash';
    if (filter === 'overschrijving') return !s.geannuleerd && s.betaalmethode === 'overschrijving';
    return true;
  });

  const totaalOpen = actieveSales
    .filter(s => !s.betaald)
    .reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);

  const totaalBetaald = actieveSales
    .filter(s => s.betaald)
    .reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);

  const totaalGeannuleerd = allSales
    .filter(s => s.geannuleerd)
    .reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);

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
          const item = stockItems[i];
          const snap = productSnaps[i];

          if (!snap.exists()) continue;

          const productData = snap.data();
          const qty = Number(item.qty || 0);
          const huidigeStock = Number(productData.stock || 0);
          const huidigeSoldCount = Number(productData.soldCount || 0);

          transaction.update(productRefs[i], {
            stock: huidigeStock + qty,
            soldCount: Math.max(0, huidigeSoldCount - qty),
          });
        }

        transaction.update(saleRef, {
          geannuleerd: true,
          geannuleerdOp: serverTimestamp(),
          geannuleerdDoor: profiel?.uid || null,
        });
      });

      setConfirmCancelId(null);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Annuleren mislukt.');
    }

    setCancellingId(null);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '12px', borderLeft: '3px solid #f39c12' }}>
          <div style={{ fontSize: '22px', fontWeight: '700' }}>{fmtBedrag(totaalOpen)}</div>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>Openstaand</div>
        </div>

        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '12px', borderLeft: '3px solid #27ae60' }}>
          <div style={{ fontSize: '22px', fontWeight: '700' }}>{fmtBedrag(totaalBetaald)}</div>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>Betaald</div>
        </div>

        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '12px', borderLeft: '3px solid #777' }}>
          <div style={{ fontSize: '22px', fontWeight: '700' }}>{fmtBedrag(totaalGeannuleerd)}</div>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>Geannuleerd</div>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(231,76,60,0.12)', border: '1px solid #e74c3c', color: '#e74c3c', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {[
          ['alle', 'Alle'],
          ['open', 'Openstaand'],
          ['betaald', 'Betaald'],
          ['cash', 'Cash'],
          ['overschrijving', 'Overschrijving'],
          ['geannuleerd', 'Geannuleerd'],
        ].map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            style={{
              flexShrink: 0,
              background: filter === value ? '#c0392b' : '#2d2d2d',
              border: 'none',
              color: '#fff',
              padding: '7px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: filter === value ? '600' : '400',
            }}
          >
            {label}
          </button>
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
            <div
              key={s.id}
              style={{
                position: 'relative',
                background: '#2d2d2d',
                border: '1px solid ' + (isGeannuleerd ? '#555' : '#3a3a3a'),
                borderRadius: '12px',
                padding: '14px',
                paddingLeft: '18px',
                opacity: isGeannuleerd ? 0.65 : 1,
                overflow: 'hidden',
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', background: isGeannuleerd ? '#777' : isBetaald ? '#27ae60' : '#f39c12' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontWeight: '800', fontSize: '15px' }}>{s.koperNaam || '-'}</span>
                    <span style={{ color: '#888', fontSize: '12px' }}>{datumLabel(s)}</span>
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
                  </div>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
                    {fmtBedrag(bedrag)}
                  </div>

                  {isGeannuleerd ? (
                    <div style={{ color: '#888', fontSize: '12px', fontWeight: '700' }}>Stock hersteld</div>
                  ) : confirmCancelId === s.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      <span style={{ color: '#f39c12', fontSize: '12px' }}>Zeker?</span>
                      <button
                        onClick={() => annuleerBoeking(s)}
                        disabled={cancellingId === s.id}
                        style={{ background: '#e74c3c', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: cancellingId === s.id ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '700' }}
                      >
                        {cancellingId === s.id ? 'Bezig' : 'Ja'}
                      </button>
                      <button
                        onClick={() => setConfirmCancelId(null)}
                        disabled={cancellingId === s.id}
                        style={{ background: '#3a3a3a', border: 'none', color: '#fff', padding: '6px 10px', borderRadius: '6px', cursor: cancellingId === s.id ? 'not-allowed' : 'pointer', fontSize: '12px' }}
                      >
                        Nee
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmCancelId(s.id)}
                      style={{ background: 'none', border: '1px solid #e74c3c', color: '#e74c3c', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '700' }}
                    >
                      Annuleer boeking
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div style={{ color: '#555', textAlign: 'center', padding: '30px', fontSize: '14px' }}>
          Geen resultaten
        </div>
      )}
    </div>
  );
}
