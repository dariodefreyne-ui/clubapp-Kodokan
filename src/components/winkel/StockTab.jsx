import React, { useState } from 'react';
import {
  collection, doc, updateDoc, writeBatch, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { fmtBedrag, DEFAULT_PRODUCTS, maakProductId } from './winkelData';

// ─── STOCK TAB ────────────────────────────────────────────────────────────────

const STOCK_FILTERS = [
  ['alle',     'Alle'],
  ['judogi',   'Judogi'],
  ['gordel',   'Gordel'],
  ['sportzak', 'Sportzak'],
  ['hoodie',   'Pull'],
  ['tshirt',   'T-shirt'],
  ['laag',     'Laag'],
  ['leeg',     'Leeg'],
];

const thStyle = {
  textAlign:'left', padding:'10px 8px', color:'#aaa', fontSize:'12px',
  borderBottom:'1px solid #2a2a2a', fontWeight:'600', whiteSpace:'nowrap',
};
const tdStyle = {
  padding:'10px 8px', borderBottom:'1px solid #1e1e1e',
  fontSize:'13px', verticalAlign:'middle',
};

export default function StockTab({ products }) {
  const [filter,       setFilter]       = useState('alle');
  const [adjEdit,      setAdjEdit]      = useState(null);
  const [adjVal,       setAdjVal]       = useState('');
  const [bulkMode,     setBulkMode]     = useState(false);
  const [bulkVals,     setBulkVals]     = useState({});
  const [savingBulk,   setSavingBulk]   = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seeding,      setSeeding]      = useState(false);

  const filtered = products.filter(p => {
    if (filter === 'laag') return (p.stock || 0) > 0 && (p.stock || 0) < 3;
    if (filter === 'leeg') return (p.stock || 0) <= 0;
    if (filter !== 'alle') return p.category === filter;
    return true;
  });

  const stockwaarde  = products.reduce((s, p) => s + (p.costPrice || 0) * (p.stock || 0), 0);
  const aantalLeeg   = products.filter(p => (p.stock || 0) <= 0).length;
  const aantalLaag   = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 3).length;

  // ── Bulk bewerken ──────────────────────────────────────────────────────────
  function startBulk() {
    const vals = {};
    products.forEach(p => { vals[p.id] = String(p.stock || 0); });
    setBulkVals(vals);
    setBulkMode(true);
  }

  function cancelBulk() { setBulkMode(false); setBulkVals({}); }

  // §4.5 — writeBatch: alle updates in 1 commit
  async function saveBulk() {
    setSavingBulk(true);
    try {
      const batch = writeBatch(db);
      for (const p of products) {
        const newVal = parseInt(bulkVals[p.id]);
        if (!isNaN(newVal) && newVal >= 0 && newVal !== (p.stock || 0)) {
          batch.update(doc(db, 'products', p.id), { stock: newVal });
        }
      }
      await batch.commit();
    } catch (e) { console.error(e); }
    setSavingBulk(false);
    setBulkMode(false);
    setBulkVals({});
  }

  // ── Stock aanpassen (individueel) ─────────────────────────────────────────
  async function adjustStock(p, delta) {
    await updateDoc(doc(db, 'products', p.id), {
      stock: Math.max(0, (p.stock || 0) + delta),
    });
  }

  async function saveAdjVal(p) {
    const val = parseInt(adjVal);
    if (!isNaN(val) && val >= 0) {
      await updateDoc(doc(db, 'products', p.id), { stock: val });
    }
    setAdjEdit(null);
  }

  // ── Reset alle stock → 0 via writeBatch ───────────────────────────────────
  // §4.5 — writeBatch: alle updates in 1 commit
  async function resetAllStock() {
    try {
      const batch = writeBatch(db);
      products.forEach(p => batch.update(doc(db, 'products', p.id), { stock: 0 }));
      await batch.commit();
    } catch (e) { console.error(e); }
    setConfirmReset(false);
  }

  // ── Seed standaardproducten — deterministisch docId via maakProductId() ──
  // §4.5 — batch.set met merge:false, zichtbaar ALLEEN als products.length === 0
  async function seedProducten() {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      for (const p of DEFAULT_PRODUCTS) {
        const id  = maakProductId(p);
        const ref = doc(collection(db, 'products'), id);
        batch.set(ref, { ...p, createdAt: serverTimestamp() }, { merge: false });
      }
      await batch.commit();
    } catch (e) { console.error(e); }
    setSeeding(false);
  }

  // ── CSV export — label toont gefilterd aantal (§4.5) ──────────────────────
  function exportCSV() {
    const datum   = new Date().toISOString().slice(0, 10);
    const headers = ['naam', 'variant', 'tweedehands', 'stock', 'prijs', 'aankoopprijs'];
    const rows    = filtered.map(p => [
      p.name, p.variant, p.tweedehands ? 'ja' : 'nee',
      p.stock || 0, p.price || 0, p.costPrice || 0,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `kodokan-stock-${datum}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {/* Statkaarten */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'10px', marginBottom:'16px' }}>
        <div style={{ background:'#2d2d2d', borderRadius:'10px', padding:'12px', borderLeft:'3px solid #27ae60' }}>
          <div style={{ fontSize:'22px', fontWeight:'700' }}>{fmtBedrag(stockwaarde)}</div>
          <div style={{ color:'#aaa', fontSize:'12px', marginTop:'4px' }}>Stockwaarde</div>
        </div>
        <div style={{ background:'#2d2d2d', borderRadius:'10px', padding:'12px', borderLeft:'3px solid #e74c3c' }}>
          <div style={{ fontSize:'22px', fontWeight:'700' }}>{aantalLeeg}</div>
          <div style={{ color:'#aaa', fontSize:'12px', marginTop:'4px' }}>Uitverkocht</div>
        </div>
        <div style={{ background:'#2d2d2d', borderRadius:'10px', padding:'12px', borderLeft:'3px solid #f39c12' }}>
          <div style={{ fontSize:'22px', fontWeight:'700' }}>{aantalLaag}</div>
          <div style={{ color:'#aaa', fontSize:'12px', marginTop:'4px' }}>Laag</div>
        </div>
      </div>

      {/* Filterbar + knoppen */}
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:'6px', overflowX:'auto', flex:1, WebkitOverflowScrolling:'touch' }}>
          {STOCK_FILTERS.map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              style={{ flexShrink:0, background: filter === v ? '#c0392b' : '#2d2d2d', border:'none', color:'#fff', padding:'7px 13px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', fontWeight: filter === v ? '600' : '400' }}>
              {l}
            </button>
          ))}
        </div>
        <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
          {bulkMode ? (
            <>
              <button onClick={saveBulk} disabled={savingBulk}
                style={{ background:'#27ae60', border:'none', color:'#fff', padding:'7px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
                {savingBulk ? 'Opslaan...' : 'Opslaan'}
              </button>
              <button onClick={cancelBulk}
                style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'7px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                Annuleren
              </button>
            </>
          ) : (
            <>
              <button onClick={startBulk}
                style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#ccc', padding:'7px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                Bulk bewerken
              </button>
              {/* §4.5 — CSV label toont gefilterd aantal */}
              <button onClick={exportCSV}
                style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#aaa', padding:'7px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                Export CSV ({filtered.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabel */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'520px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Naam</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>2e hands</th>
              <th style={thStyle}>Stock</th>
              {!bulkMode && <th style={thStyle}>Aanpassen</th>}
              <th style={{ ...thStyle, textAlign:'right' }}>Waarde</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, fontWeight:'600' }}>{p.name}</td>
                <td style={{ ...tdStyle, color:'#aaa' }}>{p.variant}</td>
                <td style={tdStyle}>
                  {p.tweedehands && (
                    <span style={{ background:'#444', borderRadius:'4px', padding:'2px 7px', fontSize:'11px', color:'#ccc' }}>2e hands</span>
                  )}
                </td>
                <td style={tdStyle}>
                  {bulkMode ? (
                    <input
                      type="number" min="0"
                      value={bulkVals[p.id] ?? String(p.stock || 0)}
                      onChange={e => setBulkVals(prev => ({ ...prev, [p.id]: e.target.value }))}
                      style={{ width:'60px', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'6px', color:'#fff', padding:'4px 6px', fontSize:'13px', textAlign:'center', outline:'none' }}
                    />
                  ) : (
                    <span style={{ background:(p.stock||0)<=0?'#e74c3c':(p.stock||0)<3?'#f39c12':'#27ae60', color:'#fff', padding:'2px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:'600' }}>
                      {p.stock || 0}
                    </span>
                  )}
                </td>
                {!bulkMode && (
                  <td style={tdStyle}>
                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <button onClick={() => adjustStock(p, -1)} disabled={(p.stock||0) <= 0}
                        style={{ background:'#1a1a1a', border:'1px solid #3a3a3a', color:(p.stock||0)<=0?'#444':'#fff', width:'28px', height:'28px', borderRadius:'6px', cursor:(p.stock||0)<=0?'not-allowed':'pointer', fontSize:'16px', lineHeight:1 }}>&#8722;</button>
                      {adjEdit === p.id ? (
                        <input autoFocus type="number" min="0" value={adjVal}
                          onChange={e => setAdjVal(e.target.value)}
                          onBlur={() => saveAdjVal(p)}
                          onKeyDown={e => e.key === 'Enter' && saveAdjVal(p)}
                          style={{ width:'52px', background:'#1a1a1a', border:'1px solid #c0392b', borderRadius:'6px', color:'#fff', padding:'4px 6px', fontSize:'13px', textAlign:'center', outline:'none' }}
                        />
                      ) : (
                        <span onClick={() => { setAdjEdit(p.id); setAdjVal(String(p.stock || 0)); }}
                          style={{ minWidth:'32px', textAlign:'center', fontSize:'14px', fontWeight:'600', cursor:'text', padding:'4px 6px', borderRadius:'6px', background:'#1a1a1a' }}>
                          {p.stock || 0}
                        </span>
                      )}
                      <button onClick={() => adjustStock(p, 1)}
                        style={{ background:'#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', width:'28px', height:'28px', borderRadius:'6px', cursor:'pointer', fontSize:'16px', lineHeight:1 }}>+</button>
                    </div>
                  </td>
                )}
                <td style={{ ...tdStyle, textAlign:'right', color:'#666', fontSize:'12px' }}>
                  {fmtBedrag((p.costPrice || 0) * (p.stock || 0))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ color:'#555', textAlign:'center', padding:'30px', fontSize:'14px' }}>Geen producten gevonden</div>
        )}
      </div>

      {/* Onderaan: seed + reset */}
      <div style={{ marginTop:'24px', display:'flex', gap:'10px', flexWrap:'wrap', alignItems:'center' }}>
        {/* §4.5 — seed-knop ALLEEN zichtbaar als products.length === 0 */}
        {products.length === 0 && (
          <button onClick={seedProducten} disabled={seeding}
            style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#aaa', padding:'9px 16px', borderRadius:'8px', cursor: seeding ? 'not-allowed' : 'pointer', fontSize:'13px' }}>
            {seeding ? 'Laden...' : 'Seed standaardproducten'}
          </button>
        )}
        {confirmReset ? (
          <div style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px' }}>
            <span style={{ color:'#f39c12' }}>Alle stocks op 0 zetten?</span>
            <button onClick={resetAllStock}
              style={{ background:'#e74c3c', border:'none', color:'#fff', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>Ja</button>
            <button onClick={() => setConfirmReset(false)}
              style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>Nee</button>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)}
            style={{ background:'#2d2d2d', border:'1px solid #e74c3c', color:'#e74c3c', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
            Reset stock naar 0
          </button>
        )}
      </div>
    </div>
  );
}
