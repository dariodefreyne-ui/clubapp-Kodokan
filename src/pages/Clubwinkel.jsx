import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

const CATEGORIES = ['alle','judogi','gordel','tshirt','hoodie','sportsbag'];
const CAT_LABELS = { alle:'Alle', judogi:'Judogi', gordel:'Gordel', tshirt:'T-shirt', hoodie:'Hoodie', sportsbag:'Sportzak' };

const DEFAULT_PRODUCTS = [
  { name:'Judogi', category:'judogi', variant:'Maat 100', price:45, costPrice:25, stock:5, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 110', price:45, costPrice:25, stock:4, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 120', price:48, costPrice:27, stock:3, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 130', price:50, costPrice:28, stock:3, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 140', price:52, costPrice:30, stock:2, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 150', price:55, costPrice:32, stock:2, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 160', price:58, costPrice:34, stock:2, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 170', price:62, costPrice:36, stock:1, soldCount:0, active:true },
  { name:'Judogi', category:'judogi', variant:'Maat 180', price:65, costPrice:38, stock:1, soldCount:0, active:true },
  { name:'Gordel', category:'gordel', variant:'Wit', price:5, costPrice:2, stock:10, soldCount:0, active:true },
  { name:'Gordel', category:'gordel', variant:'Geel', price:6, costPrice:2.5, stock:8, soldCount:0, active:true },
  { name:'Gordel', category:'gordel', variant:'Oranje', price:6, costPrice:2.5, stock:6, soldCount:0, active:true },
  { name:'Gordel', category:'gordel', variant:'Groen', price:6, costPrice:2.5, stock:5, soldCount:0, active:true },
  { name:'Gordel', category:'gordel', variant:'Blauw', price:7, costPrice:3, stock:4, soldCount:0, active:true },
  { name:'Gordel', category:'gordel', variant:'Bruin', price:7, costPrice:3, stock:3, soldCount:0, active:true },
  { name:'Gordel', category:'gordel', variant:'Zwart', price:8, costPrice:3.5, stock:5, soldCount:0, active:true },
  { name:'T-shirt Heren', category:'tshirt', variant:'M', price:18, costPrice:8, stock:5, soldCount:0, active:true },
  { name:'T-shirt Heren', category:'tshirt', variant:'L', price:18, costPrice:8, stock:4, soldCount:0, active:true },
  { name:'T-shirt Heren', category:'tshirt', variant:'XL', price:18, costPrice:8, stock:3, soldCount:0, active:true },
  { name:'T-shirt Dames', category:'tshirt', variant:'S', price:18, costPrice:8, stock:4, soldCount:0, active:true },
  { name:'T-shirt Dames', category:'tshirt', variant:'M', price:18, costPrice:8, stock:4, soldCount:0, active:true },
  { name:'T-shirt Dames', category:'tshirt', variant:'L', price:18, costPrice:8, stock:3, soldCount:0, active:true },
  { name:'T-shirt Kids', category:'tshirt', variant:'XS', price:15, costPrice:7, stock:5, soldCount:0, active:true },
  { name:'T-shirt Kids', category:'tshirt', variant:'S', price:15, costPrice:7, stock:4, soldCount:0, active:true },
  { name:'T-shirt Kids', category:'tshirt', variant:'M', price:15, costPrice:7, stock:3, soldCount:0, active:true },
  { name:'Hoodie Heren', category:'hoodie', variant:'M', price:35, costPrice:18, stock:3, soldCount:0, active:true },
  { name:'Hoodie Heren', category:'hoodie', variant:'L', price:35, costPrice:18, stock:3, soldCount:0, active:true },
  { name:'Hoodie Heren', category:'hoodie', variant:'XL', price:35, costPrice:18, stock:2, soldCount:0, active:true },
  { name:'Hoodie Dames', category:'hoodie', variant:'S', price:35, costPrice:18, stock:3, soldCount:0, active:true },
  { name:'Hoodie Dames', category:'hoodie', variant:'M', price:35, costPrice:18, stock:3, soldCount:0, active:true },
  { name:'Hoodie Dames', category:'hoodie', variant:'L', price:35, costPrice:18, stock:2, soldCount:0, active:true },
  { name:'Sportzak', category:'sportsbag', variant:'Klein', price:22, costPrice:10, stock:5, soldCount:0, active:true },
  { name:'Sportzak', category:'sportsbag', variant:'Groot', price:30, costPrice:14, stock:4, soldCount:0, active:true },
];

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  filterRow: { display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'16px' },
  filterBtn: (active) => ({ background: active ? '#c0392b' : '#2d2d2d', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', fontWeight: active ? '600' : '400' }),
  grid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:'12px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'14px', position:'relative' },
  productName: { fontWeight:'700', fontSize:'16px', marginBottom:'2px' },
  variant: { color:'#aaa', fontSize:'13px', marginBottom:'8px' },
  priceRow: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' },
  price: { fontSize:'18px', fontWeight:'700', color:'#c0392b' },
  stockBadge: (n) => ({ background: n<=0 ? '#e74c3c' : n<3 ? '#f39c12' : '#27ae60', color:'#fff', padding:'2px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:'600' }),
  btn: (v='primary') => ({ background: v==='primary' ? '#c0392b' : v==='ghost' ? 'transparent' : '#3a3a3a', border: v==='ghost' ? '1px solid #555' : 'none', color:'#fff', padding:'7px 12px', borderRadius:'7px', cursor:'pointer', fontSize:'13px' }),
  btnRow: { display:'flex', gap:'8px', marginTop:'10px' },
  addBtn: { background:'#c0392b', border:'none', color:'#fff', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontWeight:'600', marginBottom:'16px' },
  modal: { position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:'16px' },
  modalCard: { background:'#2d2d2d', borderRadius:'16px', padding:'24px', width:'100%', maxWidth:'420px', maxHeight:'90vh', overflowY:'auto' },
  input: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  select: { width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'10px', fontSize:'15px', boxSizing:'border-box', marginBottom:'10px' },
  label: { color:'#aaa', fontSize:'12px', marginBottom:'4px', display:'block' },
  modalRow: { display:'flex', gap:'10px' },
};

const emptyForm = { name:'', category:'judogi', variant:'', price:'', costPrice:'', stock:'', active:true };

export default function Clubwinkel() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('alle');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('category'));
    const unsub = onSnapshot(q, snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = filter === 'alle' ? products : products.filter(p => p.category === filter);

  function openNew() { setForm(emptyForm); setEditProduct(null); setShowModal(true); }
  function openEdit(p) { setForm({ ...p }); setEditProduct(p.id); setShowModal(true); }

  async function handleSave() {
    setSaving(true);
    try {
      const data = { ...form, price: parseFloat(form.price)||0, costPrice: parseFloat(form.costPrice)||0, stock: parseInt(form.stock)||0 };
      if (editProduct) {
        await updateDoc(doc(db, 'products', editProduct), data);
      } else {
        await addDoc(collection(db, 'products'), { ...data, soldCount: 0, createdAt: serverTimestamp() });
      }
      setShowModal(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!window.confirm('Product verwijderen?')) return;
    await deleteDoc(doc(db, 'products', id));
  }

  async function seedProducts() {
    if (!window.confirm(`${DEFAULT_PRODUCTS.length} standaard producten toevoegen?`)) return;
    setSeeding(true);
    for (const p of DEFAULT_PRODUCTS) {
      await addDoc(collection(db, 'products'), { ...p, createdAt: serverTimestamp() });
    }
    setSeeding(false);
  }

  return (
    <div style={S.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
        <div style={S.title}>🎽 Clubwinkel</div>
        <div style={{ display:'flex', gap:'8px' }}>
          {products.length === 0 && (
            <button style={{ ...S.btn('ghost'), fontSize:'13px' }} onClick={seedProducts} disabled={seeding}>
              {seeding ? 'Laden...' : '+ Standaard producten'}
            </button>
          )}
          <button style={S.addBtn} onClick={openNew}>+ Nieuw product</button>
        </div>
      </div>

      <div style={S.filterRow}>
        {CATEGORIES.map(c => (
          <button key={c} style={S.filterBtn(filter===c)} onClick={() => setFilter(c)}>{CAT_LABELS[c]}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ color:'#aaa', textAlign:'center', padding:'40px' }}>Laden...</div>
      ) : filtered.length === 0 ? (
        <div style={{ color:'#aaa', textAlign:'center', padding:'40px' }}>Geen producten. Voeg een product toe.</div>
      ) : (
        <div style={S.grid}>
          {filtered.map(p => (
            <div key={p.id} style={{ ...S.card, opacity: p.active === false ? 0.5 : 1 }}>
              <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'4px', textTransform:'uppercase' }}>{CAT_LABELS[p.category]}</div>
              <div style={S.productName}>{p.name}</div>
              <div style={S.variant}>{p.variant}</div>
              <div style={S.priceRow}>
                <span style={S.price}>€{Number(p.price||0).toFixed(2)}</span>
                <span style={S.stockBadge(p.stock||0)}>Stock: {p.stock||0}</span>
              </div>
              <div style={{ fontSize:'12px', color:'#aaa' }}>Inkoopprijs: €{Number(p.costPrice||0).toFixed(2)} · Verkocht: {p.soldCount||0}</div>
              {(p.stock||0) < 3 && (p.stock||0) > 0 && (
                <div style={{ color:'#f39c12', fontSize:'12px', marginTop:'6px' }}>⚠ Lage stock</div>
              )}
              {(p.stock||0) <= 0 && (
                <div style={{ color:'#e74c3c', fontSize:'12px', marginTop:'6px' }}>✗ Uitverkocht</div>
              )}
              <div style={S.btnRow}>
                <button style={S.btn()} onClick={() => openEdit(p)}>✏️ Bewerken</button>
                <button style={S.btn('danger')} onClick={() => handleDelete(p.id)}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={S.modal}>
          <div style={S.modalCard}>
            <h3 style={{ marginTop:0 }}>{editProduct ? 'Product bewerken' : 'Nieuw product'}</h3>
            <label style={S.label}>Naam</label>
            <input style={S.input} value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="bv. Judogi" />
            <label style={S.label}>Categorie</label>
            <select style={S.select} value={form.category} onChange={e => setForm(f=>({...f,category:e.target.value}))}>
              {CATEGORIES.filter(c=>c!=='alle').map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
            </select>
            <label style={S.label}>Variant (maat/kleur)</label>
            <input style={S.input} value={form.variant} onChange={e => setForm(f=>({...f,variant:e.target.value}))} placeholder="bv. Maat 160 / Blauw / L" />
            <div style={S.modalRow}>
              <div style={{ flex:1 }}>
                <label style={S.label}>Verkoopprijs (€)</label>
                <input style={S.input} type="number" step="0.01" value={form.price} onChange={e => setForm(f=>({...f,price:e.target.value}))} />
              </div>
              <div style={{ flex:1 }}>
                <label style={S.label}>Inkoopprijs (€)</label>
                <input style={S.input} type="number" step="0.01" value={form.costPrice} onChange={e => setForm(f=>({...f,costPrice:e.target.value}))} />
              </div>
            </div>
            <label style={S.label}>Stock</label>
            <input style={S.input} type="number" value={form.stock} onChange={e => setForm(f=>({...f,stock:e.target.value}))} />
            <label style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'16px', cursor:'pointer' }}>
              <input type="checkbox" checked={form.active!==false} onChange={e => setForm(f=>({...f,active:e.target.checked}))} />
              Actief
            </label>
            <div style={{ display:'flex', gap:'10px' }}>
              <button style={{ background:'#c0392b', border:'none', color:'#fff', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontWeight:'600', flex:1 }} onClick={handleSave} disabled={saving}>
                {saving ? 'Opslaan...' : '✓ Opslaan'}
              </button>
              <button style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'15px' }} onClick={() => setShowModal(false)}>
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
