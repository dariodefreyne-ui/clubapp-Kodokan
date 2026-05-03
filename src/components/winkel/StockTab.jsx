import React, { useState } from 'react';
import {
  collection,
  doc,
  updateDoc);  updateDoc,
  const [bulkVals, setBulkVals] = useState({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const filtered = products
    .filter(p => {
      if (filter === 'laag') return (p.stock || 0) > 0 && (p.stock || 0) < 3;
      if (filter === 'leeg') return (p.stock || 0) <= 0;
      if (filter !== 'alle') return p.category === filter;
      return true;
    })
    .sort((a, b) => {
      const catOrder = ['judogi', 'gordel', 'sportzak', 'hoodie', 'tshirt'];
      const catDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      if (a.tweedehands !== b.tweedehands) return a.tweedehands ? 1 : -1;
      return (a.variant || '').localeCompare(b.variant || '');
    });

  const CAT_META = {
    judogi: { label: 'Judogi', emoji: '🥋' },
    gordel: { label: 'Gordel', emoji: '💫' },
    sportzak: { label: 'Sportzak', emoji: '🎿' },
    hoodie: { label: 'Pull', emoji: '👕' },
    tshirt: { label: 'T-shirt', emoji: '👗' },
  };

  const CAT_ORDER = ['judogi', 'gordel', 'sportzak', 'hoodie', 'tshirt'];

  const stockwaarde = products.reduce((s, p) => s + (p.costPrice || 0) * (p.stock || 0), 0);
  const aantalLeeg = products.filter(p => (p.stock || 0) <= 0).length;
  const aantalLaag = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 3).length;

  function startBulk() {
    const vals = {};
    products.forEach(p => {
      vals[p.id] = String(p.stock || 0);
    });
    setBulkVals(vals);
    setBulkMode(true);
  }

  function cancelBulk() {
    setBulkMode(false);
    setBulkVals({});
  }

  async function saveBulk() {
    setSavingBulk(true);

    try {
      const batch = writeBatch(db);
      let heeftUpdates = false;

      for (const p of products) {
        const newVal = parseInt(bulkVals[p.id], 10);

        if (!isNaN(newVal) && newVal >= 0 && newVal !== (p.stock || 0)) {
          batch.update(doc(db, 'products', p.id), { stock: newVal });
          heeftUpdates = true;
        }
      }

      if (heeftUpdates) await batch.commit();
    } catch (e) {
      console.error(e);
    }

    setSavingBulk(false);
    setBulkMode(false);
    setBulkVals({});
  }

  async function adjustStock(p, delta) {
    await updateDoc(doc(db, 'products', p.id), {
      stock: Math.max(0, (p.stock || 0) + delta),
    });
  }

  async function saveAdjVal(p) {
    const val = parseInt(adjVal, 10);

    if (!isNaN(val) && val >= 0) {
      await updateDoc(doc(db, 'products', p.id), { stock: val });
    }

    setAdjEdit(null);
  }

  async function resetAllStock() {
    try {
      const batch = writeBatch(db);
      products.forEach(p => batch.update(doc(db, 'products', p.id), { stock: 0 }));
      await batch.commit();
    } catch (e) {
      console.error(e);
    }

    setConfirmReset(false);
  }

  async function seedProducten() {
    setSeeding(true);

    try {
      const batch = writeBatch(db);

      for (const p of DEFAULT_PRODUCTS) {
        const id = maakProductId(p);
        const ref = doc(collection(db, 'products'), id);
        batch.set(ref, { ...p, createdAt: serverTimestamp() }, { merge: false });
      }

      await batch.commit();
    } catch (e) {
      console.error(e);
    }

    setSeeding(false);
  }

  function exportCSV() {
    const datum = new Date().toISOString().slice(0, 10);
    const headers = ['naam', 'variant', 'tweedehands', 'stock', 'prijs', 'aankoopprijs'];

    const rows = filtered.map(p => [
      p.name,
      p.variant,
      p.tweedehands ? 'ja' : 'nee',
      p.stock || 0,
      p.price || 0,
      p.costPrice || 0,
    ]);

    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `kodokan-stock-${datum}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '10px', marginBottom: '16px' }}>
        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '12px', borderLeft: '3px solid #27ae60' }}>
          <div style={{ fontSize: '22px', fontWeight: '700' }}>{fmtBedrag(stockwaarde)}</div>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>Stockwaarde</div>
        </div>

        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '12px', borderLeft: '3px solid #e74c3c' }}>
          <div style={{ fontSize: '22px', fontWeight: '700' }}>{aantalLeeg}</div>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>Uitverkocht</div>
        </div>

        <div style={{ background: '#2d2d2d', borderRadius: '10px', padding: '12px', borderLeft: '3px solid #f39c12' }}>
          <div style={{ fontSize: '22px', fontWeight: '700' }}>{aantalLaag}</div>
          <div style={{ color: '#aaa', fontSize: '12px', marginTop: '4px' }}>Laag</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {STOCK_FILTERS.map(([v, l]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              style={{
                flexShrink: 0,
                background: filter === v ? '#c0392b' : '#2d2d2d',
                border: 'none',
                color: '#fff',
                padding: '7px 13px',
                borderRadius: '20px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: filter === v ? '600' : '400',
              }}
            >
              {l}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {bulkMode ? (
            <>
              <button
                onClick={saveBulk}
                disabled={savingBulk}
                style={{ background: '#27ae60', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: savingBulk ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '600' }}
              >
                {savingBulk ? 'Opslaan' : 'Opslaan'}
              </button>

              <button
                onClick={cancelBulk}
                style={{ background: '#3a3a3a', border: 'none', color: '#fff', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
              >
                Annuleren
              </button>
            </>
          ) : (
            <>
              <button
                onClick={startBulk}
                style={{ background: '#2d2d2d', border: '1px solid #3a3a3a', color: '#ccc', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
              >
                Bulk bewerken
              </button>

              <button
                onClick={exportCSV}
                style={{ background: '#2d2d2d', border: '1px solid #3a3a3a', color: '#aaa', padding: '7px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
              >
                Export CSV ({filtered.length})
              </button>
            </>
          )}
        </div>
      </div>

      <div>
        {CAT_ORDER.map(cat => {
          const items = filtered.filter(p => p.category === cat);
          if (!items.length) return null;

          const meta = CAT_META[cat];
          const goldColor = '#d4a017';
          const nieuweItems = items.filter(p => !p.tweedehands);
          const tweedehandsItems = items.filter(p => p.tweedehands);

          function renderItem(p) {
            const stockNum = p.stock || 0;
            const stockColor = stockNum <= 0 ? '#e74c3c' : stockNum < 3 ? '#e67e22' : '#27ae60';
            const visual = getProductVisual(p);

            return (
              <div
                key={p.id}
                style={{
                  background: p.tweedehands ? 'rgba(212,160,23,0.08)' : '#2d2d2d',
                  border: '1px solid ' + (p.tweedehands ? goldColor : '#3a3a3a'),
                  borderRadius: '10px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}
              >
                <div style={{ width: '4px', borderRadius: '2px', alignSelf: 'stretch', background: p.tweedehands ? goldColor : 'transparent', flexShrink: 0 }} />

                <ProductIcon product={p} size={38} radius={10} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <span>{p.variant}</span>

                    {p.tweedehands && (
                      <span style={{ background: goldColor, color: '#1a1000', borderRadius: '4px', padding: '1px 5px', fontSize: '9px', fontWeight: '800' }}>
                        2e H
                      </span>
                    )}
                  </div>

                  <div style={{ color: '#777', fontSize: '10px', marginTop: '1px' }}>
                    {visual.label}
                  </div>

                  <div style={{ color: '#888', fontSize: '11px', marginTop: '1px' }}>
                    {fmtBedrag(p.price)} verkoopprijs
                  </div>
                </div>

                {bulkMode ? (
                  <input
                    type="number"
                    min="0"
                    value={bulkVals[p.id] ?? String(stockNum)}
                    onChange={e => setBulkVals(prev => ({ ...prev, [p.id]: e.target.value }))}
                    style={{
                      width: '58px',
                      background: '#1a1a1a',
                      border: '1px solid #c0392b',
                      borderRadius: '6px',
                      color: '#fff',
                      padding: '6px',
                      fontSize: '13px',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <button
                      onClick={() => adjustStock(p, -1)}
                      disabled={stockNum <= 0}
                      style={{
                        background: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        color: stockNum <= 0 ? '#444' : '#fff',
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        cursor: stockNum <= 0 ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        lineHeight: 1,
                      }}
                    >
                      −
                    </button>

                    {adjEdit === p.id ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        value={adjVal}
                        onChange={e => setAdjVal(e.target.value)}
                        onBlur={() => saveAdjVal(p)}
                        onKeyDown={e => e.key === 'Enter' && saveAdjVal(p)}
                        style={{
                          width: '48px',
                          background: '#1a1a1a',
                          border: '1px solid #c0392b',
                          borderRadius: '6px',
                          color: '#fff',
                          padding: '4px 6px',
                          fontSize: '13px',
                          textAlign: 'center',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span
                        onClick={() => {
                          setAdjEdit(p.id);
                          setAdjVal(String(stockNum));
                        }}
                        style={{
                          minWidth: '32px',
                          textAlign: 'center',
                          fontSize: '15px',
                          fontWeight: '800',
                          color: stockColor,
                          cursor: 'text',
                          padding: '4px 6px',
                          borderRadius: '6px',
                          background: '#1a1a1a',
                        }}
                      >
                        {stockNum}
                      </span>
                    )}

                    <button
                      onClick={() => adjustStock(p, 1)}
                      style={{
                        background: '#1a1a1a',
                        border: '1px solid #3a3a3a',
                        color: '#fff',
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        lineHeight: 1,
                      }}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={cat} style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>{meta.emoji}</span>
                <span style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', color: '#888' }}>
                  {meta.label}
                </span>
                <div style={{ flex: 1, height: '1px', background: '#2a2a2a' }} />
              </div>

              {nieuweItems.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: tweedehandsItems.length > 0 ? '12px' : '0' }}>
                  {nieuweItems.map(renderItem)}
                </div>
              )}

              {tweedehandsItems.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 8px' }}>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(212,160,23,0.3)' }} />
                    <span style={{ fontSize: '10px', color: '#d4a017', fontWeight: '700', letterSpacing: '0.5px' }}>
                      2E HANDS
                    </span>
                    <div style={{ flex: 1, height: '1px', background: 'rgba(212,160,23,0.3)' }} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {tweedehandsItems.map(renderItem)}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ color: '#555', textAlign: 'center', padding: '30px', fontSize: '14px' }}>
            Geen producten gevonden
          </div>
        )}
      </div>

      <div style={{ marginTop: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {products.length === 0 && (
          <button
            onClick={seedProducten}
            disabled={seeding}
            style={{
              background: '#2d2d2d',
              border: '1px solid #3a3a3a',
              color: '#aaa',
              padding: '9px 16px',
              borderRadius: '8px',
              cursor: seeding ? 'not-allowed' : 'pointer',
              fontSize: '13px',
            }}
          >
            {seeding ? 'Laden' : 'Seed standaardproducten'}
          </button>
        )}

        {confirmReset ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: '#f39c12' }}>Alle stocks op 0 zetten?</span>

            <button
              onClick={resetAllStock}
              style={{ background: '#e74c3c', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
            >
              Ja
            </button>

            <button
              onClick={() => setConfirmReset(false)}
              style={{ background: '#3a3a3a', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              Nee
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            style={{ background: '#2d2d2d', border: '1px solid #e74c3c', color: '#e74c3c', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}
          >
            Reset stock naar 0
          </button>
        )}
      </div>
    </div>
  );
}
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { fmtBedrag, DEFAULT_PRODUCTS, maakProductId } from './winkelData';
import ProductIcon, { getProductVisual } from './ProductIcon';

const STOCK_FILTERS = [
  ['alle', 'Alle'],
  ['judogi', 'Judogi'],
  ['gordel', 'Gordel'],
  ['sportzak', 'Sportzak'],
  ['hoodie', 'Pull'],
  ['tshirt', 'T-shirt'],
  ['laag', 'Laag'],
  ['leeg', 'Leeg'],
];

export default function StockTab({ products }) {
  const [filter, setFilter] = useState('alle');
  const [adjEdit, setAdjEdit] = useState(null);
  const [adjVal, setAdjVal] = useState('');
