import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const CATS = ['judogi', 'gordel', 'sportzak', 'hoodie', 'tshirt'];
const CAT_LABELS = { judogi:'Judogi', gordel:'Gordel', sportzak:'Sportzak', hoodie:'Hoodie', tshirt:'T-shirt' };
const TABS = ['kassa', 'stock', 'producten', 'schulden'];
const TAB_LABELS = { kassa:'Kassa', stock:'Stock', producten:'Producten', schulden:'Schulden' };

function fmtBedrag(n) {
  const val = Number(n) || 0;
  return val % 1 === 0 ? `€${Math.round(val)}` : `€${val.toFixed(2)}`;
}

// ─── KASSA TAB ────────────────────────────────────────────────────────────────

function KassaTab({ products, profiel }) {
  const [cat, setCat] = useState(CATS[0]);
  const [overlay, setOverlay] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [payStep, setPayStep] = useState(false);
  const [method, setMethod] = useState(null);
  const [koperNaam, setKoperNaam] = useState('');
  const [koperId, setKoperId] = useState(null);
  const [zoekterm, setZoekterm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const activeProducts = products.filter(p => p.active !== false);
  const filtered = activeProducts.filter(p => p.category === cat);
  const overlayProducts = overlay ? activeProducts.filter(p => p.category === overlay) : [];
  const totaal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(product) {
    if ((product.stock || 0) <= 0) return;
    setCart(c => {
      const idx = c.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        const updated = [...c];
        if (updated[idx].qty < (product.stock || 0)) {
          updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        }
        return updated;
      }
      return [...c, { id: product.id, name: product.name, variant: product.variant, price: product.price || 0, qty: 1, maxStock: product.stock || 0 }];
    });
    setOverlay(null);
  }

  function changeQty(id, delta) {
    setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i).filter(i => i.qty > 0));
  }

  function removeItem(id) { setCart(c => c.filter(i => i.id !== id)); }

  async function zoekUsers(term) {
    if (!term.trim()) { setZoekResultaten([]); return; }
    try {
      const snap = await getDocs(collection(db, 'users'));
      const lower = term.toLowerCase();
      setZoekResultaten(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .filter(u => (u.naam || '').toLowerCase().includes(lower))
          .slice(0, 5)
      );
    } catch { setZoekResultaten([]); }
  }

  async function afronden() {
    if (!method || !koperNaam.trim()) return;
    setSaving(true);
    try {
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (product) {
          await updateDoc(doc(db, 'products', item.id), {
            stock: Math.max(0, (product.stock || 0) - item.qty),
            soldCount: (product.soldCount || 0) + item.qty,
          });
        }
      }
      await addDoc(collection(db, 'sales'), {
        items: cart.map(i => ({ productId: i.id, name: i.name, variant: i.variant, qty: i.qty, price: i.price })),
        totaal,
        betaalmethode: method,
        koperNaam: koperNaam.trim(),
        koperId: koperId || null,
        betaald: method === 'cash',
        aangemaaktOp: serverTimestamp(),
        verkoperUid: profiel?.uid || null,
      });
      const snapData = { totaal, betaalmethode: method, koperNaam: koperNaam.trim() };
      setCart([]);
      setShowCart(false);
      setPayStep(false);
      setMethod(null);
      setKoperNaam('');
      setKoperId(null);
      setZoekterm('');
      setZoekResultaten([]);
      setSuccess(snapData);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  // ── Success overlay
  if (success) {
    return (
      <div style={{ position:'fixed', inset:0, background:'#27ae60', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:200, color:'#fff' }}>
        <div style={{ fontSize:'80px', lineHeight:1, marginBottom:'16px' }}>✓</div>
        <div style={{ fontSize:'32px', fontWeight:'700', marginBottom:'8px' }}>{fmtBedrag(success.totaal)}</div>
        <div style={{ fontSize:'18px', marginBottom:'8px', opacity:0.9 }}>
          {success.betaalmethode === 'cash' ? 'Cash betaald' : 'Overschrijving'}
        </div>
        <div style={{ fontSize:'16px', opacity:0.8 }}>{success.koperNaam}</div>
      </div>
    );
  }

  // ── Betaalscherm
  if (payStep) {
    return (
      <div style={{ padding:'0 0 32px', maxWidth:'480px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
          <button onClick={() => setPayStep(false)}
            style={{ background:'none', border:'none', color:'#aaa', fontSize:'26px', cursor:'pointer', lineHeight:1 }}>←</button>
          <div style={{ fontSize:'20px', fontWeight:'700' }}>Afrekenen · {fmtBedrag(totaal)}</div>
        </div>

        <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Betaalmethode</div>
        <div style={{ display:'flex', gap:'10px', marginBottom:'24px' }}>
          {[['cash', 'Cash'], ['overschrijving', 'Overschrijving']].map(([m, label]) => (
            <button key={m} onClick={() => setMethod(m)}
              style={{ flex:1, padding:'20px 10px', borderRadius:'12px', border:`2px solid ${method === m ? '#c0392b' : '#3a3a3a'}`, background: method === m ? 'rgba(192,57,43,0.15)' : '#2d2d2d', color: method === m ? '#fff' : '#bbb', fontSize:'16px', fontWeight:'700', cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Naam koper *</div>
        <input
          value={koperNaam}
          onChange={e => setKoperNaam(e.target.value)}
          placeholder="Naam koper"
          style={{ width:'100%', background:'#2d2d2d', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'14px', fontSize:'16px', boxSizing:'border-box', marginBottom:'20px', outline:'none' }}
        />

        <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Koppel aan lid (optioneel)</div>
        <input
          value={zoekterm}
          onChange={e => { setZoekterm(e.target.value); zoekUsers(e.target.value); }}
          placeholder="Zoek lid op naam..."
          style={{ width:'100%', background:'#2d2d2d', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'14px', fontSize:'15px', boxSizing:'border-box', marginBottom:'8px', outline:'none' }}
        />
        {zoekResultaten.length > 0 && (
          <div style={{ background:'#2d2d2d', borderRadius:'8px', marginBottom:'16px', overflow:'hidden', border:'1px solid #3a3a3a' }}>
            {zoekResultaten.map(u => (
              <button key={u.id}
                onClick={() => { setKoperId(u.id); setKoperNaam(u.naam || koperNaam); setZoekterm(''); setZoekResultaten([]); }}
                style={{ width:'100%', background: koperId === u.id ? 'rgba(192,57,43,0.2)' : 'transparent', border:'none', borderBottom:'1px solid #3a3a3a', color:'#fff', padding:'14px 12px', textAlign:'left', cursor:'pointer', fontSize:'15px', display:'block' }}>
                {u.naam || u.email || u.id}
              </button>
            ))}
          </div>
        )}
        {koperId && !zoekterm && (
          <div style={{ fontSize:'13px', color:'#27ae60', marginBottom:'20px' }}>Gekoppeld aan lid</div>
        )}

        <button onClick={afronden}
          disabled={saving || !method || !koperNaam.trim()}
          style={{ width:'100%', background: (saving || !method || !koperNaam.trim()) ? '#555' : '#c0392b', border:'none', color:'#fff', padding:'18px', borderRadius:'12px', fontSize:'18px', fontWeight:'700', cursor: (saving || !method || !koperNaam.trim()) ? 'not-allowed' : 'pointer', marginTop:'8px' }}>
          {saving ? 'Bezig...' : 'Verkoop afronden'}
        </button>
      </div>
    );
  }

  // ── Cart overzicht
  if (showCart) {
    return (
      <div style={{ padding:'0 0 32px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'20px' }}>
          <button onClick={() => setShowCart(false)}
            style={{ background:'none', border:'none', color:'#aaa', fontSize:'26px', cursor:'pointer', lineHeight:1 }}>←</button>
          <div style={{ fontSize:'20px', fontWeight:'700' }}>Winkelkar ({cartCount})</div>
        </div>
        {cart.length === 0 ? (
          <div style={{ color:'#555', textAlign:'center', padding:'40px' }}>Kar is leeg</div>
        ) : (
          <>
            {cart.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 0', borderBottom:'1px solid #2a2a2a' }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:'600', fontSize:'15px' }}>{item.name}</div>
                  <div style={{ color:'#aaa', fontSize:'13px', marginTop:'2px' }}>{item.variant} · {fmtBedrag(item.price)} / stuk</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <button onClick={() => changeQty(item.id, -1)}
                    style={{ background:'#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', width:'32px', height:'32px', borderRadius:'8px', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                  <span style={{ minWidth:'24px', textAlign:'center', fontWeight:'700', fontSize:'16px' }}>{item.qty}</span>
                  <button onClick={() => changeQty(item.id, 1)}
                    style={{ background:'#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', width:'32px', height:'32px', borderRadius:'8px', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                </div>
                <div style={{ minWidth:'52px', textAlign:'right', fontWeight:'700', fontSize:'15px' }}>{fmtBedrag(item.price * item.qty)}</div>
                <button onClick={() => removeItem(item.id)}
                  style={{ background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:'22px', padding:'4px', lineHeight:1 }}>✕</button>
              </div>
            ))}
            <div style={{ fontSize:'26px', fontWeight:'700', color:'#c0392b', textAlign:'right', padding:'20px 0 24px' }}>
              Totaal: {fmtBedrag(totaal)}
            </div>
            <button onClick={() => { setShowCart(false); setPayStep(true); }}
              style={{ width:'100%', background:'#c0392b', border:'none', color:'#fff', padding:'18px', borderRadius:'12px', fontSize:'18px', fontWeight:'700', cursor:'pointer' }}>
              Afrekenen
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Hoofdkassa
  return (
    <div style={{ paddingBottom: cartCount > 0 ? '80px' : '16px' }}>
      {/* Categoriefilter */}
      <div style={{ display:'flex', gap:'8px', overflowX:'auto', paddingBottom:'12px', WebkitOverflowScrolling:'touch' }}>
        {CATS.map(c => (
          <button key={c}
            onClick={() => { setCat(c); setOverlay(c); }}
            style={{ flexShrink:0, minHeight:'44px', padding:'0 20px', borderRadius:'22px', border: cat === c ? 'none' : '1px solid #3a3a3a', background: cat === c ? '#c0392b' : '#2d2d2d', color:'#fff', fontSize:'15px', fontWeight: cat === c ? '700' : '400', cursor:'pointer' }}>
            {CAT_LABELS[c]}
          </button>
        ))}
      </div>

      {/* Productgrid — 2 kolommen */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
        {filtered.map(p => {
          const inCart = cart.find(i => i.id === p.id)?.qty || 0;
          const available = (p.stock || 0) - inCart;
          const disabled = available <= 0;
          return (
            <button key={p.id}
              onClick={() => !disabled && setOverlay(p.category)}
              disabled={disabled}
              style={{ background: disabled ? '#1e1e1e' : '#2d2d2d', border: disabled ? '1px solid #252525' : '1px solid #3a3a3a', borderRadius:'12px', padding:'14px 12px', textAlign:'left', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#444' : '#fff', position:'relative', minHeight:'90px', display:'flex', flexDirection:'column' }}>
              <div style={{ fontWeight:'700', fontSize:'14px', lineHeight:'1.3', marginBottom:'3px' }}>{p.name}</div>
              <div style={{ fontSize:'12px', color: disabled ? '#3a3a3a' : '#999', lineHeight:'1.3', flex:1, marginBottom:'8px' }}>{p.variant}</div>
              <div style={{ fontSize:'16px', fontWeight:'700', color: disabled ? '#444' : '#c0392b' }}>
                {(p.price || 0) > 0 ? fmtBedrag(p.price) : 'Prijs TBD'}
              </div>
              <div style={{ position:'absolute', top:'10px', right:'10px', fontSize:'12px', fontWeight:'700', color: disabled ? '#444' : available < 5 ? '#f39c12' : '#27ae60' }}>
                {disabled ? 'Uit' : available}
              </div>
              {p.tweedehands && !disabled && (
                <div style={{ position:'absolute', bottom:'10px', right:'10px', background:'#444', borderRadius:'4px', padding:'2px 6px', fontSize:'10px', color:'#bbb' }}>2e hands</div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', color:'#555', textAlign:'center', padding:'32px', fontSize:'14px' }}>
            Geen producten in deze categorie
          </div>
        )}
      </div>

      {/* Variantkiezer overlay */}
      {overlay && (
        <div
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:100, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}
          onClick={() => setOverlay(null)}>
          <div
            style={{ background:'#2d2d2d', borderRadius:'20px 20px 0 0', padding:'20px 16px', maxHeight:'75vh', overflowY:'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
              <div style={{ fontSize:'18px', fontWeight:'700' }}>{CAT_LABELS[overlay]}</div>
              <button style={{ background:'none', border:'none', color:'#aaa', fontSize:'26px', cursor:'pointer', lineHeight:1, padding:'0 4px' }} onClick={() => setOverlay(null)}>✕</button>
            </div>
            {overlayProducts.map(p => {
              const inCart = cart.find(i => i.id === p.id)?.qty || 0;
              const available = (p.stock || 0) - inCart;
              const disabled = available <= 0;
              return (
                <div key={p.id}
                  onClick={() => !disabled && addToCart(p)}
                  style={{ display:'flex', alignItems:'center', minHeight:'56px', padding:'10px 0', borderBottom:'1px solid #3a3a3a', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1 }}>
                  <div style={{ flex:1 }}>
                    <span style={{ fontWeight:'600', fontSize:'15px', color:'#fff' }}>{p.variant}</span>
                    {p.tweedehands && (
                      <span style={{ marginLeft:'8px', background:'#444', borderRadius:'4px', padding:'1px 5px', fontSize:'11px', color:'#bbb' }}>2e hands</span>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                    <span style={{ fontSize:'15px', color: disabled ? '#555' : '#c0392b', fontWeight:'700' }}>
                      {(p.price || 0) > 0 ? fmtBedrag(p.price) : 'TBD'}
                    </span>
                    <span style={{ fontSize:'12px', minWidth:'56px', textAlign:'right', color: disabled ? '#555' : available < 5 ? '#f39c12' : '#27ae60', fontWeight:'600' }}>
                      {disabled ? 'Uitverkocht' : `${available} stuk`}
                    </span>
                  </div>
                </div>
              );
            })}
            {overlayProducts.length === 0 && (
              <div style={{ color:'#555', textAlign:'center', padding:'24px', fontSize:'14px' }}>Geen producten</div>
            )}
          </div>
        </div>
      )}

      {/* Sticky cart-balk */}
      {cartCount > 0 && (
        <div
          onClick={() => setShowCart(true)}
          style={{ position:'fixed', bottom:0, left:0, right:0, background:'#c0392b', padding:'18px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer', zIndex:50 }}>
          <div style={{ fontWeight:'700', fontSize:'16px' }}>Winkelkar · {cartCount} item{cartCount !== 1 ? 's' : ''}</div>
          <div style={{ fontWeight:'700', fontSize:'20px' }}>{fmtBedrag(totaal)}</div>
        </div>
      )}
    </div>
  );
}

// ─── STOCK TAB ────────────────────────────────────────────────────────────────

function StockTab({ products }) {
  const [filter, setFilter] = useState('alle');

  const filtered = products.filter(p => {
    if (filter === 'laag') return (p.stock || 0) > 0 && (p.stock || 0) < 5;
    if (filter === 'leeg') return (p.stock || 0) <= 0;
    return true;
  });

  const stats = [
    [products.length, 'Producten', '#3498db'],
    [products.filter(p => (p.stock || 0) <= 0).length, 'Uitverkocht', '#e74c3c'],
    [products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 5).length, 'Lage stock', '#f39c12'],
  ];

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
        {stats.map(([n, l, c]) => (
          <div key={l} style={{ background:'#2d2d2d', borderRadius:'10px', padding:'12px', borderLeft:`3px solid ${c}` }}>
            <div style={{ fontSize:'24px', fontWeight:'700' }}>{n}</div>
            <div style={{ color:'#aaa', fontSize:'12px', marginTop:'4px' }}>{l}</div>
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        {[['alle','Alle'],['laag','Lage stock'],['leeg','Uitverkocht']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ background: filter === v ? '#c0392b' : '#2d2d2d', border:'none', color:'#fff', padding:'8px 14px', borderRadius:'20px', cursor:'pointer', fontSize:'13px' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              {['Product','Variant','Stock'].map(h => (
                <th key={h} style={{ textAlign:'left', padding:'8px', color:'#aaa', fontSize:'12px', borderBottom:'1px solid #2a2a2a', fontWeight:'600' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{ padding:'10px 8px', borderBottom:'1px solid #1e1e1e', fontSize:'14px', fontWeight:'600' }}>{p.name}</td>
                <td style={{ padding:'10px 8px', borderBottom:'1px solid #1e1e1e', fontSize:'13px', color:'#aaa' }}>
                  {p.variant}{p.tweedehands ? ' (2e)' : ''}
                </td>
                <td style={{ padding:'10px 8px', borderBottom:'1px solid #1e1e1e' }}>
                  <span style={{ background:(p.stock||0)<=0?'#e74c3c':(p.stock||0)<5?'#f39c12':'#27ae60', color:'#fff', padding:'2px 8px', borderRadius:'10px', fontSize:'12px', fontWeight:'600' }}>
                    {p.stock || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ color:'#555', textAlign:'center', padding:'30px', fontSize:'14px' }}>Geen producten gevonden</div>
        )}
      </div>
    </div>
  );
}

// ─── SCHULDEN TAB ─────────────────────────────────────────────────────────────

function SchuldenTab({ sales }) {
  const openSales = sales.filter(s => s.betaald === false);

  function datumLabel(s) {
    const ts = s.aangemaaktOp || s.createdAt;
    return ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '—';
  }

  return (
    <div>
      <div style={{ fontSize:'18px', fontWeight:'700', marginBottom:'16px' }}>
        Openstaande betalingen ({openSales.length})
      </div>
      {openSales.length === 0 ? (
        <div style={{ color:'#555', textAlign:'center', padding:'40px', fontSize:'14px' }}>Geen openstaande betalingen</div>
      ) : (
        openSales.map(s => (
          <div key={s.id} style={{ background:'#2d2d2d', borderRadius:'10px', padding:'14px', marginBottom:'10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px' }}>
              <div style={{ fontWeight:'700', fontSize:'15px' }}>{s.koperNaam || 'Onbekend'}</div>
              <div style={{ fontWeight:'700', fontSize:'16px', color:'#c0392b' }}>{fmtBedrag(s.totaal ?? s.total ?? 0)}</div>
            </div>
            <div style={{ fontSize:'12px', color:'#aaa' }}>Overschrijving · {datumLabel(s)}</div>
            <div style={{ fontSize:'12px', color:'#aaa', marginTop:'4px' }}>
              {(s.items || []).map(i => `${i.name} ${i.variant} x${i.qty}`).join(', ')}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── HOOFD COMPONENT ──────────────────────────────────────────────────────────

export default function Winkel() {
  const { profiel, isBeheerder } = useAuth();
  const [tab, setTab] = useState('kassa');
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);

  useEffect(() => {
    const unsub1 = onSnapshot(
      query(collection(db, 'products'), orderBy('category')),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsub2 = onSnapshot(
      collection(db, 'sales'),
      snap => setSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => { unsub1(); unsub2(); };
  }, []);

  const heeftOpenSales = sales.some(s => s.betaald === false);
  const visibleTabs = isBeheerder ? TABS : ['kassa'];

  return (
    <div style={{ minHeight:'100vh', background:'#1a1a1a', color:'#fff' }}>
      {/* Tab-balk */}
      <div style={{ display:'flex', overflowX:'auto', borderBottom:'1px solid #2a2a2a', background:'#1a1a1a', WebkitOverflowScrolling:'touch' }}>
        {visibleTabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ flex: visibleTabs.length <= 4 ? 1 : undefined, flexShrink:0, minWidth:'70px', padding:'14px 16px', background:'none', border:'none', borderBottom: tab === t ? '2px solid #c0392b' : '2px solid transparent', color: tab === t ? '#fff' : '#777', fontWeight: tab === t ? '700' : '400', fontSize:'14px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'5px' }}>
            {TAB_LABELS[t]}
            {t === 'schulden' && heeftOpenSales && (
              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#e74c3c', display:'inline-block', flexShrink:0 }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab-inhoud */}
      <div style={{ padding: tab === 'kassa' ? '12px 16px 0' : '16px' }}>
        {tab === 'kassa' && <KassaTab products={products} profiel={profiel} />}
        {tab === 'stock' && <StockTab products={products} />}
        {tab === 'producten' && (
          <div style={{ color:'#555', textAlign:'center', padding:'40px', fontSize:'14px' }}>Producten-tab volgt in stap 2</div>
        )}
        {tab === 'schulden' && <SchuldenTab sales={sales} />}
      </div>
    </div>
  );
}
