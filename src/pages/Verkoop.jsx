import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, addDoc, doc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

const CAT_LABELS = { alle:'Alle', judogi:'Judogi', gordel:'Gordel', tshirt:'T-shirt', hoodie:'Hoodie', sportsbag:'Sportzak' };
const CATEGORIES = ['alle','judogi','gordel','tshirt','hoodie','sportsbag'];

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px', display:'flex', flexDirection:'column', gap:'16px' },
  title: { fontSize:'22px', fontWeight:'700' },
  layout: { display:'grid', gridTemplateColumns:'1fr', gap:'16px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'14px' },
  filterRow: { display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'12px' },
  filterBtn: (a) => ({ background: a ? '#c0392b' : '#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', padding:'6px 12px', borderRadius:'16px', cursor:'pointer', fontSize:'12px' }),
  productGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(130px, 1fr))', gap:'8px' },
  productBtn: (disabled) => ({ background: disabled ? '#1a1a1a' : '#2d2d2d', border: disabled ? '1px solid #2a2a2a' : '1px solid #3a3a3a', color: disabled ? '#555' : '#fff', borderRadius:'10px', padding:'12px 8px', cursor: disabled ? 'not-allowed' : 'pointer', textAlign:'center', minHeight:'70px', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }),
  productName: { fontSize:'13px', fontWeight:'600', lineHeight:'1.2' },
  productPrice: { color:'#c0392b', fontSize:'14px', fontWeight:'700' },
  productStock: (n) => ({ fontSize:'11px', color: n<=0 ? '#e74c3c' : n<3 ? '#f39c12' : '#27ae60' }),
  cartItem: { display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #3a3a3a' },
  qtyBtn: { background:'#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', width:'30px', height:'30px', borderRadius:'6px', cursor:'pointer', fontSize:'16px', display:'flex', alignItems:'center', justifyContent:'center' },
  total: { fontSize:'22px', fontWeight:'700', color:'#c0392b', textAlign:'right', padding:'12px 0' },
  saleBtn: (disabled) => ({ background: disabled ? '#555' : '#c0392b', border:'none', color:'#fff', padding:'16px', borderRadius:'12px', cursor: disabled ? 'not-allowed' : 'pointer', fontSize:'16px', fontWeight:'700', width:'100%' }),
  recentRow: { display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #3a3a3a', fontSize:'13px' },
};

export default function Verkoop() {
  const [products, setProducts] = useState([]);
  const [cat, setCat] = useState('alle');
  const [cart, setCart] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'products'), orderBy('category')), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active !== false));
    });
    const unsub2 = onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(20)), snap => {
      setRecentSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => { unsub(); unsub2(); };
  }, []);

  const filtered = cat === 'alle' ? products : products.filter(p => p.category === cat);
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  function addToCart(product) {
    if ((product.stock || 0) <= 0) return;
    setCart(c => {
      const idx = c.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        const updated = [...c];
        if (updated[idx].qty < product.stock) updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [...c, { id: product.id, name: product.name, variant: product.variant, price: product.price, qty: 1, maxStock: product.stock }];
    });
  }

  function changeQty(id, delta) {
    setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(1, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  function removeItem(id) { setCart(c => c.filter(i => i.id !== id)); }

  async function registerSale() {
    if (cart.length === 0) return;
    setRegistering(true);
    try {
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          await updateDoc(doc(db, 'products', item.id), {
            stock: Math.max(0, (product.stock || 0) - item.qty),
            soldCount: (product.soldCount || 0) + item.qty
          });
        }
      }
      await addDoc(collection(db, 'sales'), {
        items: cart.map(i => ({ productId: i.id, name: i.name, variant: i.variant, qty: i.qty, price: i.price })),
        total,
        paymentMethod: 'cash',
        betaalmethode: 'cash',
        koperId: null,
        koperNaam: '',
        betaald: true,
        createdAt: serverTimestamp()
      });
      setCart([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (e) { console.error(e); }
    setRegistering(false);
  }

  return (
    <div style={S.page}>
      <div style={S.title}>💳 Verkoop</div>

      {success && (
        <div style={{ background:'#27ae60', borderRadius:'10px', padding:'14px', textAlign:'center', fontSize:'16px', fontWeight:'700' }}>
          ✓ Verkoop geregistreerd!
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr', gap:'16px' }}>
        {/* Product grid */}
        <div style={S.card}>
          <h3 style={{ margin:'0 0 12px' }}>Producten</h3>
          <div style={S.filterRow}>
            {CATEGORIES.map(c => (
              <button key={c} style={S.filterBtn(cat===c)} onClick={() => setCat(c)}>{CAT_LABELS[c]}</button>
            ))}
          </div>
          <div style={S.productGrid}>
            {filtered.map(p => {
              const inCart = cart.find(i => i.id === p.id)?.qty || 0;
              const available = (p.stock||0) - inCart;
              const disabled = available <= 0;
              return (
                <button key={p.id} style={S.productBtn(disabled)} onClick={() => addToCart(p)}>
                  <div style={S.productName}>{p.name} {p.variant}</div>
                  <div style={S.productPrice}>€{Number(p.price||0).toFixed(2)}</div>
                  <div style={S.productStock(available)}>
                    {disabled ? 'Uitverkocht' : `Stock: ${available}`}
                    {inCart > 0 && <span style={{ color:'#c0392b' }}> ({inCart} in kar)</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Cart */}
        <div style={S.card}>
          <h3 style={{ margin:'0 0 12px' }}>🛒 Winkelkar ({cart.length} items)</h3>
          {cart.length === 0 ? (
            <div style={{ color:'#aaa', textAlign:'center', padding:'20px' }}>Klik een product om toe te voegen</div>
          ) : (
            <>
              {cart.map(item => (
                <div key={item.id} style={S.cartItem}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'14px', fontWeight:'600' }}>{item.name} {item.variant}</div>
                    <div style={{ fontSize:'13px', color:'#aaa' }}>€{Number(item.price||0).toFixed(2)} / stuk</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <button style={S.qtyBtn} onClick={() => changeQty(item.id, -1)}>-</button>
                    <span style={{ minWidth:'24px', textAlign:'center', fontWeight:'700' }}>{item.qty}</span>
                    <button style={S.qtyBtn} onClick={() => changeQty(item.id, 1)}>+</button>
                  </div>
                  <div style={{ minWidth:'60px', textAlign:'right', fontWeight:'700' }}>€{(item.price * item.qty).toFixed(2)}</div>
                  <button style={{ background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:'18px', padding:'4px' }} onClick={() => removeItem(item.id)}>✕</button>
                </div>
              ))}
              <div style={S.total}>Totaal: €{total.toFixed(2)}</div>
              <button style={S.saleBtn(registering || cart.length===0)} onClick={registerSale} disabled={registering || cart.length===0}>
                {registering ? 'Bezig...' : '💰 Verkoop registreren (cash)'}
              </button>
            </>
          )}
        </div>

        {/* Recent sales */}
        {recentSales.length > 0 && (
          <div style={S.card}>
            <h3 style={{ margin:'0 0 12px' }}>Recente verkopen</h3>
            {recentSales.map(s => (
              <div key={s.id} style={S.recentRow}>
                <span style={{ color:'#aaa' }}>{s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString('nl-BE') : '—'}</span>
                <span>{(s.items||[]).map(i => `${i.name} ${i.variant} ×${i.qty}`).join(', ')}</span>
                <span style={{ color:'#27ae60', fontWeight:'700' }}>€{Number(s.total||0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
