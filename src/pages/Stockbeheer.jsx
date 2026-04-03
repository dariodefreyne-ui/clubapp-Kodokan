import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import Papa from 'papaparse';

const CAT_LABELS = { judogi:'Judogi', gordel:'Gordel', tshirt:'T-shirt', hoodie:'Hoodie', sportsbag:'Sportzak' };

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  statRow: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:'10px', marginBottom:'16px' },
  statCard: (color) => ({ background:'#2d2d2d', borderRadius:'10px', padding:'14px', borderLeft:`3px solid ${color}` }),
  statNum: { fontSize:'26px', fontWeight:'700' },
  statLabel: { color:'#aaa', fontSize:'12px', marginTop:'4px' },
  filterRow: { display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px', alignItems:'center' },
  filterBtn: (a) => ({ background: a ? '#c0392b' : '#2d2d2d', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'20px', cursor:'pointer', fontSize:'13px' }),
  exportBtn: { background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#fff', padding:'8px 14px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', marginLeft:'auto' },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', padding:'10px 8px', color:'#aaa', fontSize:'12px', borderBottom:'1px solid #3a3a3a', fontWeight:'600' },
  td: { padding:'10px 8px', borderBottom:'1px solid #2a2a2a', fontSize:'14px', verticalAlign:'middle' },
  stockBadge: (n) => ({ background: n<=0 ? '#e74c3c' : n<3 ? '#f39c12' : '#27ae60', color:'#fff', padding:'2px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:'600', display:'inline-block' }),
  qtyBtn: { background:'#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', width:'28px', height:'28px', borderRadius:'6px', cursor:'pointer', fontSize:'14px', lineHeight:'1' },
  input: { background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'6px', color:'#fff', padding:'4px 8px', fontSize:'13px', width:'60px', textAlign:'center' },
};

export default function Stockbeheer() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('alle');
  const [adjusting, setAdjusting] = useState({});
  const [adjValues, setAdjValues] = useState({});

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('category'));
    const unsub = onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = products.filter(p => {
    if (filter === 'laag') return (p.stock||0) > 0 && (p.stock||0) < 5;
    if (filter === 'leeg') return (p.stock||0) <= 0;
    return true;
  });

  const stats = {
    total: products.length,
    outOfStock: products.filter(p => (p.stock||0) <= 0).length,
    lowStock: products.filter(p => (p.stock||0) > 0 && (p.stock||0) < 5).length,
    totalValue: products.reduce((s,p) => s + (p.costPrice||0) * (p.stock||0), 0),
  };

  async function adjustStock(p, delta) {
    const newStock = Math.max(0, (p.stock||0) + delta);
    await updateDoc(doc(db, 'products', p.id), { stock: newStock });
  }

  async function setStockValue(p) {
    const val = parseInt(adjValues[p.id]);
    if (isNaN(val) || val < 0) return;
    await updateDoc(doc(db, 'products', p.id), { stock: val });
    setAdjusting(a => ({ ...a, [p.id]: false }));
    setAdjValues(v => { const n = {...v}; delete n[p.id]; return n; });
  }

  async function bijvullen(p) {
    const qty = parseInt(prompt(`Hoeveel bijvullen voor "${p.name} ${p.variant}"?`));
    if (isNaN(qty) || qty <= 0) return;
    await updateDoc(doc(db, 'products', p.id), { stock: (p.stock||0) + qty });
  }

  function exportCSV() {
    const rows = products.map(p => ({
      Naam: p.name, Variant: p.variant, Categorie: CAT_LABELS[p.category]||p.category,
      Stock: p.stock||0, Verkoopprijs: p.price||0, Inkoopprijs: p.costPrice||0,
      Verkocht: p.soldCount||0, Stockwaarde: ((p.costPrice||0)*(p.stock||0)).toFixed(2)
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'stock.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={S.page}>
      <div style={S.title}>📦 Stockbeheer</div>

      <div style={S.statRow}>
        <div style={S.statCard('#3498db')}>
          <div style={S.statNum}>{stats.total}</div>
          <div style={S.statLabel}>Producten</div>
        </div>
        <div style={S.statCard('#e74c3c')}>
          <div style={S.statNum}>{stats.outOfStock}</div>
          <div style={S.statLabel}>Uitverkocht</div>
        </div>
        <div style={S.statCard('#f39c12')}>
          <div style={S.statNum}>{stats.lowStock}</div>
          <div style={S.statLabel}>Lage stock</div>
        </div>
        <div style={S.statCard('#27ae60')}>
          <div style={S.statNum}>€{stats.totalValue.toFixed(0)}</div>
          <div style={S.statLabel}>Stockwaarde</div>
        </div>
      </div>

      <div style={S.filterRow}>
        {[['alle','Alle'],['laag','Lage stock'],['leeg','Uitverkocht']].map(([v,l]) => (
          <button key={v} style={S.filterBtn(filter===v)} onClick={() => setFilter(v)}>{l}</button>
        ))}
        <button style={S.exportBtn} onClick={exportCSV}>📥 Export CSV</button>
      </div>

      {loading ? (
        <div style={{ color:'#aaa', textAlign:'center', padding:'40px' }}>Laden...</div>
      ) : (
        <div style={{ overflowX:'auto' }}>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Product</th>
                <th style={S.th}>Variant</th>
                <th style={S.th}>Categorie</th>
                <th style={S.th}>Stock</th>
                <th style={S.th}>Aanpassen</th>
                <th style={S.th}>Bijvullen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id}>
                  <td style={S.td}><b>{p.name}</b></td>
                  <td style={S.td}>{p.variant}</td>
                  <td style={S.td}><span style={{ color:'#aaa', fontSize:'12px' }}>{CAT_LABELS[p.category]||p.category}</span></td>
                  <td style={S.td}><span style={S.stockBadge(p.stock||0)}>{p.stock||0}</span></td>
                  <td style={S.td}>
                    {adjusting[p.id] ? (
                      <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                        <input style={S.input} type="number" min="0"
                          value={adjValues[p.id]??p.stock??0}
                          onChange={e => setAdjValues(v => ({...v,[p.id]:e.target.value}))} />
                        <button style={{ ...S.qtyBtn, background:'#c0392b', border:'none' }} onClick={() => setStockValue(p)}>✓</button>
                        <button style={S.qtyBtn} onClick={() => setAdjusting(a => ({...a,[p.id]:false}))}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                        <button style={S.qtyBtn} onClick={() => adjustStock(p, -1)} disabled={(p.stock||0)<=0}>−</button>
                        <button style={S.qtyBtn} onClick={() => adjustStock(p, +1)}>+</button>
                        <button style={{ ...S.qtyBtn, width:'auto', padding:'0 8px', fontSize:'11px' }}
                          onClick={() => { setAdjusting(a=>({...a,[p.id]:true})); setAdjValues(v=>({...v,[p.id]:p.stock||0})); }}>
                          ✏️
                        </button>
                      </div>
                    )}
                  </td>
                  <td style={S.td}>
                    <button style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#fff', padding:'5px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}
                      onClick={() => bijvullen(p)}>
                      + Bijvullen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div style={{ color:'#aaa', textAlign:'center', padding:'30px' }}>Geen producten gevonden.</div>}
        </div>
      )}
    </div>
  );
}
