import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs, runTransaction, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const CATS = ['judogi', 'gordel', 'sportzak', 'hoodie', 'tshirt'];
const CAT_LABELS = { judogi:'Judogi', gordel:'Gordel', sportzak:'Sportzak', hoodie:'Pull', tshirt:'T-shirt' };
const TABS = ['kassa', 'stock', 'producten', 'schulden'];
const TAB_LABELS = { kassa:'Kassa', stock:'Stock', producten:'Producten', schulden:'Schulden' };

function fmtBedrag(n) {
  const val = Number(n) || 0;
  return val % 1 === 0 ? `€${Math.round(val)}` : `€${val.toFixed(2)}`;
}

const _MATEN = ['100','110','120','130','140','150','155','160','165','170','180','190'];

const DEFAULT_PRODUCTS = [
  // ── Judogi nieuw — volledig pak (12 maten) ──────────────────────────────
  ..._MATEN.map(m => ({
    name:'Judogi', category:'judogi', variant:`Maat ${m} — volledig`,
    price:0, costPrice:0, tweedehands:false,
    stock: m==='110'?3 : m==='120'?2 : m==='130'?1 : m==='140'?1 : 0,
    soldCount:0, active:true,
  })),
  // ── Judogi nieuw — enkel broek (12 maten) ───────────────────────────────
  ..._MATEN.map(m => ({
    name:'Judogi', category:'judogi', variant:`Maat ${m} — broek`,
    price:0, costPrice:0, tweedehands:false, stock:0, soldCount:0, active:true,
  })),
  // ── Judogi nieuw — enkel vest (12 maten) ────────────────────────────────
  ..._MATEN.map(m => ({
    name:'Judogi', category:'judogi', variant:`Maat ${m} — vest`,
    price:0, costPrice:0, tweedehands:false, stock:0, soldCount:0, active:true,
  })),
  // ── Judogi tweedehands — volledig pak (12 maten) ─────────────────────────
  ..._MATEN.map(m => ({
    name:'Judogi', category:'judogi', variant:`Maat ${m} — volledig`,
    price:0, costPrice:0, tweedehands:true,
    stock: m==='110'?4 : m==='130'?1 : m==='160'?2 : m==='165'?1 : m==='170'?1 : 0,
    soldCount:0, active:true,
  })),
  // ── Gordels ──────────────────────────────────────────────────────────────
  { name:'Gordel', category:'gordel', variant:'Wit (6e kyu)',    price:0, costPrice:0, stock:5, soldCount:0, active:true, tweedehands:false },
  { name:'Gordel', category:'gordel', variant:'Geel (5e kyu)',   price:0, costPrice:0, stock:5, soldCount:0, active:true, tweedehands:false },
  { name:'Gordel', category:'gordel', variant:'Oranje (4e kyu)', price:0, costPrice:0, stock:3, soldCount:0, active:true, tweedehands:false },
  { name:'Gordel', category:'gordel', variant:'Groen (3e kyu)',  price:0, costPrice:0, stock:3, soldCount:0, active:true, tweedehands:false },
  { name:'Gordel', category:'gordel', variant:'Blauw (2e kyu)',  price:0, costPrice:0, stock:3, soldCount:0, active:true, tweedehands:false },
  { name:'Gordel', category:'gordel', variant:'Bruin (1e kyu)',  price:0, costPrice:0, stock:3, soldCount:0, active:true, tweedehands:false },
  { name:'Gordel', category:'gordel', variant:'Zwart (1e dan)',  price:0, costPrice:0, stock:3, soldCount:0, active:true, tweedehands:false },
  // ── Sportzakken ──────────────────────────────────────────────────────────
  { name:'Sportzak', category:'sportzak', variant:'Klein', price:0, costPrice:0, stock:5, soldCount:0, active:true, tweedehands:false },
  { name:'Sportzak', category:'sportzak', variant:'Groot', price:0, costPrice:0, stock:4, soldCount:0, active:true, tweedehands:false },
  // ── Pulls nieuw ──────────────────────────────────────────────────────────
  { name:'Pull', category:'hoodie', variant:'Kinderen 9/11',  price:0, costPrice:0, stock:1, soldCount:0, active:true, tweedehands:false },
  { name:'Pull', category:'hoodie', variant:'Kinderen 12/13', price:0, costPrice:0, stock:4, soldCount:0, active:true, tweedehands:false },
  { name:'Pull', category:'hoodie', variant:'XS',             price:0, costPrice:0, stock:3, soldCount:0, active:true, tweedehands:false },
  { name:'Pull', category:'hoodie', variant:'S',              price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:false },
  { name:'Pull', category:'hoodie', variant:'M',              price:0, costPrice:0, stock:1, soldCount:0, active:true, tweedehands:false },
  { name:'Pull', category:'hoodie', variant:'L',              price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:false },
  { name:'Pull', category:'hoodie', variant:'XL',             price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:false },
  // ── Pulls tweedehands ─────────────────────────────────────────────────────
  { name:'Pull', category:'hoodie', variant:'Kinderen 9/11',  price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'Pull', category:'hoodie', variant:'Kinderen 12/13', price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'Pull', category:'hoodie', variant:'XS',             price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'Pull', category:'hoodie', variant:'S',              price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'Pull', category:'hoodie', variant:'M',              price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'Pull', category:'hoodie', variant:'L',              price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'Pull', category:'hoodie', variant:'XL',             price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  // ── T-shirts nieuw ────────────────────────────────────────────────────────
  { name:'T-shirt', category:'tshirt', variant:'Dames S',            price:0, costPrice:0, stock:7,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Dames M',            price:0, costPrice:0, stock:12, soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Dames L',            price:0, costPrice:0, stock:13, soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Dames XL',           price:0, costPrice:0, stock:6,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Heren S',            price:0, costPrice:0, stock:7,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Heren M',            price:0, costPrice:0, stock:6,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Heren L',            price:0, costPrice:0, stock:8,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Heren XL',           price:0, costPrice:0, stock:2,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen S (5/6)',    price:0, costPrice:0, stock:10, soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen M (7/8)',    price:0, costPrice:0, stock:10, soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen L (9/11)',   price:0, costPrice:0, stock:8,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen XL (12/14)', price:0, costPrice:0, stock:1,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Ladies Only S',       price:0, costPrice:0, stock:1,  soldCount:0, active:true, tweedehands:false },
  { name:'T-shirt', category:'tshirt', variant:'Ladies Only M',       price:0, costPrice:0, stock:2,  soldCount:0, active:true, tweedehands:false },
  // ── T-shirts tweedehands ──────────────────────────────────────────────────
  { name:'T-shirt', category:'tshirt', variant:'Dames S',            price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Dames M',            price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Dames L',            price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Dames XL',           price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Heren S',            price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Heren M',            price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Heren L',            price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Heren XL',           price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen S (5/6)',    price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen M (7/8)',    price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen L (9/11)',   price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
  { name:'T-shirt', category:'tshirt', variant:'Kinderen XL (12/14)', price:0, costPrice:0, stock:0, soldCount:0, active:true, tweedehands:true },
];

// ─── KASSA TAB ────────────────────────────────────────────────────────────────

function KassaTab({ products, profiel }) {
  const [cat, setCat] = useState(CATS[0]);
  const [overlay, setOverlay] = useState(null); // product object | null
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [payStep, setPayStep] = useState(false);
  const [method, setMethod] = useState(null);
  const [koperNaam, setKoperNaam] = useState('');
  const [koperId, setKoperId] = useState(null);
  const [zoekOpen, setZoekOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const activeProducts = products.filter(p => p.active !== false);
  const filtered = activeProducts.filter(p => p.category === cat);
  const totaal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = useCallback((product) => {
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
  }, []);

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

  function ontkoppelLid() {
    setKoperId(null);
    setZoekterm('');
    setZoekResultaten([]);
    setZoekOpen(false);
  }

  async function afronden() {
    if (!method || koperNaam.trim().length < 2) return;
    setSaving(true);
    try {
      for (const item of cart) {
        await runTransaction(db, async (transaction) => {
          const ref = doc(db, 'products', item.id);
          const snap = await transaction.get(ref);
          const huidig = snap.data().stock || 0;
          const nieuw = Math.max(0, huidig - item.qty);
          transaction.update(ref, {
            stock: nieuw,
            soldCount: (snap.data().soldCount || 0) + item.qty,
          });
        });
      }
      await addDoc(collection(db, 'sales'), {
        items: cart.map(i => ({ productId: i.id, naam: i.name, variant: i.variant, qty: i.qty, prijs: i.price })),
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
      setZoekOpen(false);
      setSuccess(snapData);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  // ── Success overlay
  if (success) {
    return (
      <div style={{ position:'fixed', inset:0, background:'#27ae60', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', zIndex:200, color:'#fff' }}>
        <div style={{ fontSize:'80px', lineHeight:1, marginBottom:'16px' }}>&#10003;</div>
        <div style={{ fontSize:'32px', fontWeight:'700', marginBottom:'8px' }}>{fmtBedrag(success.totaal)}</div>
        <div style={{ fontSize:'18px', marginBottom:'8px', opacity:0.9 }}>
          {success.betaalmethode === 'cash' ? 'Cash betaald' : 'Overschrijving'}
        </div>
        <div style={{ fontSize:'16px', opacity:0.8, marginBottom:'16px' }}>{success.koperNaam}</div>
        {success.betaalmethode === 'overschrijving' && (
          <div style={{ fontSize:'15px', color:'#ffcccc', fontWeight:'700' }}>Openstaande schuld geregistreerd</div>
        )}
      </div>
    );
  }

  // ── Betaalscherm
  if (payStep) {
    const canSubmit = !saving && method && koperNaam.trim().length >= 2;
    return (
      <div style={{ padding:'0 0 32px', maxWidth:'480px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
          <button onClick={() => setPayStep(false)}
            style={{ background:'none', border:'none', color:'#aaa', fontSize:'26px', cursor:'pointer', lineHeight:1 }}>&#8592;</button>
          <div style={{ fontSize:'20px', fontWeight:'700' }}>Afrekenen &middot; {fmtBedrag(totaal)}</div>
        </div>

        <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Betaalmethode</div>
        <div style={{ display:'flex', gap:'10px', marginBottom:'24px' }}>
          {[['cash','Cash'],['overschrijving','Overschrijving']].map(([m, label]) => (
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
          placeholder="Naam koper (min. 2 tekens)"
          style={{ width:'100%', background:'#2d2d2d', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'14px', fontSize:'16px', boxSizing:'border-box', marginBottom:'16px', outline:'none' }}
        />

        {/* Koppel aan lid */}
        {koperId ? (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'20px', background:'rgba(39,174,96,0.1)', border:'1px solid #27ae60', borderRadius:'8px', padding:'10px 14px' }}>
            <span style={{ flex:1, fontSize:'14px', color:'#27ae60', fontWeight:'600' }}>Gekoppeld aan: {koperNaam}</span>
            <button onClick={ontkoppelLid}
              style={{ background:'none', border:'none', color:'#aaa', cursor:'pointer', fontSize:'18px', lineHeight:1, padding:'2px' }}>&#10005;</button>
          </div>
        ) : (
          <div style={{ marginBottom:'20px' }}>
            <button onClick={() => setZoekOpen(v => !v)}
              style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#aaa', padding:'10px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', marginBottom: zoekOpen ? '10px' : '0' }}>
              Koppel aan lid (optioneel)
            </button>
            {zoekOpen && (
              <>
                <input
                  value={zoekterm}
                  onChange={e => { setZoekterm(e.target.value); zoekUsers(e.target.value); }}
                  placeholder="Zoek lid op naam..."
                  autoFocus
                  style={{ width:'100%', background:'#2d2d2d', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'14px', fontSize:'15px', boxSizing:'border-box', marginBottom:'8px', outline:'none' }}
                />
                {zoekResultaten.length > 0 && (
                  <div style={{ background:'#2d2d2d', borderRadius:'8px', overflow:'hidden', border:'1px solid #3a3a3a' }}>
                    {zoekResultaten.map(u => (
                      <button key={u.id}
                        onClick={() => { setKoperId(u.id); setKoperNaam(u.naam || koperNaam); setZoekterm(''); setZoekResultaten([]); setZoekOpen(false); }}
                        style={{ width:'100%', background:'transparent', border:'none', borderBottom:'1px solid #3a3a3a', color:'#fff', padding:'14px 12px', textAlign:'left', cursor:'pointer', fontSize:'15px', display:'block' }}>
                        {u.naam || u.email || u.id}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Samenvatting */}
        <div style={{ background:'#2d2d2d', borderRadius:'10px', padding:'14px 16px', marginBottom:'20px' }}>
          {cart.map(i => (
            <div key={i.id} style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'6px', color:'#ccc' }}>
              <span>{i.name} {i.variant} &times;{i.qty}</span>
              <span>{fmtBedrag(i.price * i.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop:'1px solid #3a3a3a', paddingTop:'10px', marginTop:'6px', display:'flex', justifyContent:'space-between', fontWeight:'700', fontSize:'17px' }}>
            <span>Totaal</span>
            <span style={{ color:'#c0392b' }}>{fmtBedrag(totaal)}</span>
          </div>
          {method && (
            <div style={{ fontSize:'12px', color:'#aaa', marginTop:'8px' }}>
              {method === 'cash' ? 'Cash' : 'Overschrijving'} &middot; {koperNaam || '—'}
            </div>
          )}
        </div>

        <button onClick={afronden} disabled={!canSubmit}
          style={{ width:'100%', background: canSubmit ? '#c0392b' : '#555', border:'none', color:'#fff', padding:'18px', borderRadius:'12px', fontSize:'18px', fontWeight:'700', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
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
            style={{ background:'none', border:'none', color:'#aaa', fontSize:'26px', cursor:'pointer', lineHeight:1 }}>&#8592;</button>
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
                  <div style={{ color:'#aaa', fontSize:'13px', marginTop:'2px' }}>{item.variant} &middot; {fmtBedrag(item.price)} / stuk</div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <button onClick={() => changeQty(item.id, -1)}
                    style={{ background:'#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', width:'32px', height:'32px', borderRadius:'8px', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>&#8722;</button>
                  <span style={{ minWidth:'24px', textAlign:'center', fontWeight:'700', fontSize:'16px' }}>{item.qty}</span>
                  <button onClick={() => changeQty(item.id, 1)}
                    style={{ background:'#1a1a1a', border:'1px solid #3a3a3a', color:'#fff', width:'32px', height:'32px', borderRadius:'8px', cursor:'pointer', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                </div>
                <div style={{ minWidth:'52px', textAlign:'right', fontWeight:'700', fontSize:'15px' }}>{fmtBedrag(item.price * item.qty)}</div>
                <button onClick={() => removeItem(item.id)}
                  style={{ background:'none', border:'none', color:'#e74c3c', cursor:'pointer', fontSize:'22px', padding:'4px', lineHeight:1 }}>&#10005;</button>
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
          <button key={c} onClick={() => setCat(c)}
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
          const isLadiesOnly = (p.variant || '').includes('Ladies Only') || (p.name || '').includes('Ladies Only');
          return (
            <button key={p.id} onClick={() => !disabled && setOverlay(p)} disabled={disabled}
              style={{ background: disabled ? '#1e1e1e' : '#2d2d2d', border: disabled ? '1px solid #252525' : '1px solid #3a3a3a', borderRadius:'12px', padding:'14px 12px 12px', textAlign:'left', cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? '#444' : '#fff', position:'relative', minHeight:'90px', display:'flex', flexDirection:'column' }}>
              <div style={{ fontWeight:'700', fontSize:'14px', lineHeight:'1.3', marginBottom:'3px' }}>{p.name}</div>
              <div style={{ fontSize:'12px', color: disabled ? '#3a3a3a' : '#999', lineHeight:'1.3', flex:1 }}>{p.variant}</div>
              <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'8px', alignItems:'center' }}>
                <span style={{ fontSize:'15px', fontWeight:'700', color: disabled ? '#444' : (p.price || 0) === 0 ? '#f39c12' : '#c0392b' }}>
                  {(p.price || 0) > 0 ? fmtBedrag(p.price) : 'Prijs TBD'}
                </span>
                {p.tweedehands && !disabled && (
                  <span style={{ background:'#444', borderRadius:'4px', padding:'1px 5px', fontSize:'10px', color:'#bbb' }}>2e hands</span>
                )}
                {isLadiesOnly && !disabled && (
                  <span style={{ background:'rgba(155,89,182,0.25)', border:'1px solid rgba(155,89,182,0.5)', borderRadius:'4px', padding:'1px 5px', fontSize:'10px', color:'#ce89e9' }}>Ladies Only</span>
                )}
              </div>
              <div style={{ position:'absolute', top:'10px', right:'10px', fontSize:'11px', fontWeight:'700', color: disabled ? '#444' : available < 5 ? '#f39c12' : '#27ae60' }}>
                {disabled ? 'Uit' : available}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', color:'#555', textAlign:'center', padding:'32px', fontSize:'14px' }}>
            Geen producten in deze categorie
          </div>
        )}
      </div>

      {/* Product-overlay (single product) */}
      {overlay && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:100, display:'flex', flexDirection:'column', justifyContent:'flex-end' }}
          onClick={() => setOverlay(null)}>
          <div style={{ background:'#2d2d2d', borderRadius:'20px 20px 0 0', padding:'24px 20px 32px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
              <div>
                <div style={{ fontSize:'20px', fontWeight:'700' }}>{overlay.name}</div>
                <div style={{ fontSize:'14px', color:'#aaa', marginTop:'3px' }}>{overlay.variant}</div>
              </div>
              <button onClick={() => setOverlay(null)}
                style={{ background:'none', border:'none', color:'#aaa', fontSize:'26px', cursor:'pointer', lineHeight:1, padding:'0 4px' }}>&#10005;</button>
            </div>
            <div style={{ fontSize:'24px', fontWeight:'700', color: (overlay.price || 0) === 0 ? '#f39c12' : '#c0392b', marginBottom:'12px' }}>
              {(overlay.price || 0) > 0 ? fmtBedrag(overlay.price) : 'Prijs TBD'}
            </div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'20px', flexWrap:'wrap' }}>
              {overlay.tweedehands && (
                <span style={{ background:'#444', borderRadius:'6px', padding:'4px 10px', fontSize:'12px', color:'#bbb' }}>2e hands</span>
              )}
              {((overlay.variant || '').includes('Ladies Only') || (overlay.name || '').includes('Ladies Only')) && (
                <span style={{ background:'rgba(155,89,182,0.25)', border:'1px solid rgba(155,89,182,0.5)', borderRadius:'6px', padding:'4px 10px', fontSize:'12px', color:'#ce89e9' }}>Ladies Only</span>
              )}
              <span style={{ background: (overlay.stock||0) < 5 ? 'rgba(243,156,18,0.15)' : 'rgba(39,174,96,0.15)', border:`1px solid ${(overlay.stock||0) < 5 ? '#f39c12' : '#27ae60'}`, borderRadius:'6px', padding:'4px 10px', fontSize:'12px', color: (overlay.stock||0) < 5 ? '#f39c12' : '#27ae60' }}>
                {overlay.stock || 0} in stock
              </span>
            </div>
            <button onClick={() => addToCart(overlay)}
              style={{ width:'100%', background:'#c0392b', border:'none', color:'#fff', padding:'18px', borderRadius:'12px', fontSize:'18px', fontWeight:'700', cursor:'pointer' }}>
              Toevoegen aan cart
            </button>
          </div>
        </div>
      )}

      {/* Sticky cart-balk */}
      {cartCount > 0 && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, background:'#c0392b', padding:'0 20px', display:'flex', alignItems:'center', zIndex:50, minHeight:'64px' }}>
          <div onClick={() => setShowCart(true)}
            style={{ flex:1, cursor:'pointer', fontWeight:'700', fontSize:'16px' }}>
            Winkelkar &middot; {cartCount} item{cartCount !== 1 ? 's' : ''}
          </div>
          <button onClick={() => { setShowCart(false); setPayStep(true); }}
            style={{ background:'rgba(0,0,0,0.25)', border:'1px solid rgba(255,255,255,0.3)', color:'#fff', padding:'10px 18px', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontWeight:'700' }}>
            {fmtBedrag(totaal)} &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

// ─── STOCK TAB ────────────────────────────────────────────────────────────────

const STOCK_FILTERS = [
  ['alle','Alle'], ['judogi','Judogi'], ['gordel','Gordel'], ['sportzak','Sportzak'],
  ['hoodie','Pull'], ['tshirt','T-shirt'], ['laag','Laag'], ['leeg','Leeg'],
];

function StockTab({ products }) {
  const [filter, setFilter] = useState('alle');
  const [adjEdit, setAdjEdit] = useState(null);
  const [adjVal, setAdjVal] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkVals, setBulkVals] = useState({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const filtered = products.filter(p => {
    if (filter === 'laag') return (p.stock || 0) > 0 && (p.stock || 0) < 3;
    if (filter === 'leeg') return (p.stock || 0) <= 0;
    if (filter !== 'alle') return p.category === filter;
    return true;
  });

  const stockwaarde = products.reduce((s, p) => s + (p.costPrice || 0) * (p.stock || 0), 0);
  const aantalLeeg = products.filter(p => (p.stock || 0) <= 0).length;
  const aantalLaag = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 3).length;

  function startBulk() {
    const vals = {};
    products.forEach(p => { vals[p.id] = String(p.stock || 0); });
    setBulkVals(vals);
    setBulkMode(true);
  }

  function cancelBulk() { setBulkMode(false); setBulkVals({}); }

  async function saveBulk() {
    setSavingBulk(true);
    try {
      for (const p of products) {
        const newVal = parseInt(bulkVals[p.id]);
        if (!isNaN(newVal) && newVal >= 0 && newVal !== (p.stock || 0)) {
          await updateDoc(doc(db, 'products', p.id), { stock: newVal });
        }
      }
    } catch (e) { console.error(e); }
    setSavingBulk(false);
    setBulkMode(false);
    setBulkVals({});
  }

  async function adjustStock(p, delta) {
    await updateDoc(doc(db, 'products', p.id), { stock: Math.max(0, (p.stock || 0) + delta) });
  }

  async function saveAdjVal(p) {
    const val = parseInt(adjVal);
    if (!isNaN(val) && val >= 0) {
      await updateDoc(doc(db, 'products', p.id), { stock: val });
    }
    setAdjEdit(null);
  }

  async function resetAllStock() {
    for (const p of products) {
      await updateDoc(doc(db, 'products', p.id), { stock: 0 });
    }
    setConfirmReset(false);
  }

  async function seedProducten() {
    setSeeding(true);
    try {
      for (const p of DEFAULT_PRODUCTS) {
        await addDoc(collection(db, 'products'), { ...p, createdAt: serverTimestamp() });
      }
    } catch (e) { console.error(e); }
    setSeeding(false);
  }

  function exportCSV() {
    const datum = new Date().toISOString().slice(0, 10);
    const headers = ['naam', 'variant', 'tweedehands', 'stock', 'prijs', 'aankoopprijs'];
    const rows = filtered.map(p => [
      p.name, p.variant, p.tweedehands ? 'ja' : 'nee',
      p.stock || 0, p.price || 0, p.costPrice || 0,
    ]);
    const csv = [headers, ...rows]
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `kodokan-stock-${datum}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const thStyle = { textAlign:'left', padding:'10px 8px', color:'#aaa', fontSize:'12px', borderBottom:'1px solid #2a2a2a', fontWeight:'600', whiteSpace:'nowrap' };
  const tdStyle = { padding:'10px 8px', borderBottom:'1px solid #1e1e1e', fontSize:'13px', verticalAlign:'middle' };

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
              <button onClick={exportCSV}
                style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#aaa', padding:'7px 14px', borderRadius:'8px', cursor:'pointer', fontSize:'13px' }}>
                Export CSV
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
                      type="number"
                      min="0"
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
                      <button onClick={() => adjustStock(p, -1)} disabled={(p.stock||0)<=0}
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

// ─── PRODUCTEN TAB ────────────────────────────────────────────────────────────

const EMPTY_NEW = { name:'', category:'judogi', variant:'', price:'', costPrice:'', stock:'0', tweedehands:false, active:true };

function ProductenTab({ products }) {
  const [filter, setFilter] = useState('alle');
  const [editCell, setEditCell] = useState(null); // { id, field }
  const [editVal, setEditVal] = useState('');
  const [confirmId, setConfirmId] = useState(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);
  const [bulkPrijsMode, setBulkPrijsMode] = useState(false);
  const [bulkPrijsVals, setBulkPrijsVals] = useState({});
  const [savingBulkPrijs, setSavingBulkPrijs] = useState(false);

  const filtered = products.filter(p => filter === 'alle' || p.category === filter);

  function startEdit(id, field, currentVal) {
    setEditCell({ id, field });
    setEditVal(String(currentVal ?? ''));
  }

  async function commitEdit(p, field) {
    if (!editCell || editCell.id !== p.id || editCell.field !== field) return;
    const val = parseFloat(editVal);
    if (!isNaN(val) && val >= 0) {
      await updateDoc(doc(db, 'products', p.id), { [field]: val });
    }
    setEditCell(null);
  }

  async function toggleActief(p) {
    await updateDoc(doc(db, 'products', p.id), { active: p.active !== false ? false : true });
  }

  async function verwijder(id) {
    await deleteDoc(doc(db, 'products', id));
    setConfirmId(null);
  }

  async function saveNew() {
    if (!newForm.name.trim() || !newForm.variant.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'products'), {
        name: newForm.name.trim(),
        category: newForm.category,
        variant: newForm.variant.trim(),
        price: parseFloat(newForm.price) || 0,
        costPrice: parseFloat(newForm.costPrice) || 0,
        stock: parseInt(newForm.stock) || 0,
        // soldCount = aantal verkopen via kassa (Winkel.jsx)
        // Manuele stockaanpassingen raken soldCount niet aan — dit is correct gedrag
        soldCount: 0,
        tweedehands: newForm.tweedehands,
        active: newForm.active,
        createdAt: serverTimestamp(),
      });
      setNewForm(EMPTY_NEW);
      setShowNewForm(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  function startBulkPrijs() {
    const vals = {};
    products.forEach(p => { vals[p.id] = { price: String(p.price || 0), costPrice: String(p.costPrice || 0) }; });
    setBulkPrijsVals(vals);
    setBulkPrijsMode(true);
  }

  function cancelBulkPrijs() { setBulkPrijsMode(false); setBulkPrijsVals({}); }

  async function saveBulkPrijs() {
    setSavingBulkPrijs(true);
    try {
      for (const p of products) {
        const newPrice = parseFloat(bulkPrijsVals[p.id]?.price);
        const newCost = parseFloat(bulkPrijsVals[p.id]?.costPrice);
        const updates = {};
        if (!isNaN(newPrice) && newPrice >= 0 && newPrice !== (p.price || 0)) updates.price = newPrice;
        if (!isNaN(newCost) && newCost >= 0 && newCost !== (p.costPrice || 0)) updates.costPrice = newCost;
        if (Object.keys(updates).length > 0) {
          await updateDoc(doc(db, 'products', p.id), updates);
        }
      }
    } catch (e) { console.error(e); }
    setSavingBulkPrijs(false);
    setBulkPrijsMode(false);
    setBulkPrijsVals({});
  }

  const inputStyle = { background:'#1a1a1a', border:'1px solid #c0392b', borderRadius:'6px', color:'#fff', padding:'4px 8px', fontSize:'13px', width:'72px', outline:'none', textAlign:'right' };
  const bulkInput = { background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'6px', color:'#fff', padding:'4px 6px', fontSize:'13px', width:'65px', outline:'none', textAlign:'right' };
  const thStyle = { textAlign:'left', padding:'10px 8px', color:'#aaa', fontSize:'12px', borderBottom:'1px solid #2a2a2a', fontWeight:'600', whiteSpace:'nowrap' };
  const tdStyle = { padding:'10px 8px', borderBottom:'1px solid #1e1e1e', fontSize:'13px', verticalAlign:'middle' };
  const editing = (id, field) => editCell?.id === id && editCell?.field === field;

  return (
    <div>
      {/* Actiebalk */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <button onClick={() => { setShowNewForm(v => !v); setNewForm(EMPTY_NEW); }}
          style={{ background:'#c0392b', border:'none', color:'#fff', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
          {showNewForm ? '&#10005; Annuleren' : '+ Nieuw product'}
        </button>
        {bulkPrijsMode ? (
          <>
            <button onClick={saveBulkPrijs} disabled={savingBulkPrijs}
              style={{ background:'#27ae60', border:'none', color:'#fff', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
              {savingBulkPrijs ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={cancelBulkPrijs}
              style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
              Annuleren
            </button>
          </>
        ) : (
          <button onClick={startBulkPrijs}
            style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#ccc', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
            Bulk prijzen
          </button>
        )}
      </div>

      {/* Inline nieuw-product formulier */}
      {showNewForm && (
        <div style={{ background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
            {[
              ['Naam *', 'name', 'text', 'bv. Judogi', false],
              ['Categorie', 'category', 'select', '', false],
              ['Variant *', 'variant', 'text', 'bv. Maat 110 / Blauw / L', false],
              ['Prijs (&#8364;)', 'price', 'number', '', false],
              ['Aankoopprijs (&#8364;)', 'costPrice', 'number', '', false],
              ['Beginstock', 'stock', 'number', '', false],
            ].map(([label, field, type, placeholder]) => (
              <div key={field}>
                <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'4px' }} dangerouslySetInnerHTML={{ __html: label }} />
                {type === 'select' ? (
                  <select value={newForm[field]} onChange={e => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'6px', color:'#fff', padding:'8px 10px', fontSize:'14px', boxSizing:'border-box', outline:'none' }}>
                    {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                ) : (
                  <input type={type} min={type === 'number' ? '0' : undefined} step={field === 'price' || field === 'costPrice' ? '0.01' : undefined}
                    value={newForm[field]} placeholder={placeholder}
                    onChange={e => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'6px', color:'#fff', padding:'8px 10px', fontSize:'14px', boxSizing:'border-box', outline:'none' }} />
                )}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'16px', marginBottom:'14px' }}>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'14px' }}>
              <input type="checkbox" checked={newForm.tweedehands} onChange={e => setNewForm(f => ({ ...f, tweedehands: e.target.checked }))} />
              Tweedehands
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'14px' }}>
              <input type="checkbox" checked={newForm.active} onChange={e => setNewForm(f => ({ ...f, active: e.target.checked }))} />
              Actief
            </label>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={saveNew} disabled={saving || !newForm.name.trim() || !newForm.variant.trim()}
              style={{ background: (!newForm.name.trim() || !newForm.variant.trim()) ? '#555' : '#c0392b', border:'none', color:'#fff', padding:'10px 20px', borderRadius:'8px', cursor: (!newForm.name.trim() || !newForm.variant.trim()) ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'600' }}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={() => setShowNewForm(false)}
              style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Categoriefilter */}
      <div style={{ display:'flex', gap:'6px', overflowX:'auto', marginBottom:'16px', WebkitOverflowScrolling:'touch' }}>
        {[['alle','Alle'], ...CATS.map(c => [c, CAT_LABELS[c]])].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ flexShrink:0, background: filter === v ? '#c0392b' : '#2d2d2d', border:'none', color:'#fff', padding:'7px 13px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', fontWeight: filter === v ? '600' : '400' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Naam</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>2e hands</th>
              <th style={{ ...thStyle, textAlign:'right' }}>Prijs</th>
              <th style={{ ...thStyle, textAlign:'right' }}>Aankoop</th>
              <th style={{ ...thStyle, textAlign:'center' }}>Actief</th>
              <th style={thStyle}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, fontWeight:'600' }}>{p.name}</td>
                <td style={{ ...tdStyle, color:'#aaa', fontSize:'12px' }}>{p.variant}</td>
                <td style={tdStyle}>
                  {p.tweedehands && (
                    <span style={{ background:'#444', borderRadius:'4px', padding:'2px 7px', fontSize:'11px', color:'#ccc' }}>2e hands</span>
                  )}
                </td>

                {/* Prijs */}
                <td style={{ ...tdStyle, textAlign:'right' }}
                  onClick={() => !bulkPrijsMode && !editing(p.id,'price') && startEdit(p.id, 'price', p.price || 0)}>
                  {bulkPrijsMode ? (
                    <input type="number" min="0" step="0.01"
                      value={bulkPrijsVals[p.id]?.price ?? String(p.price || 0)}
                      onChange={e => setBulkPrijsVals(prev => ({ ...prev, [p.id]: { ...prev[p.id], price: e.target.value } }))}
                      style={bulkInput}
                    />
                  ) : editing(p.id, 'price') ? (
                    <input autoFocus type="number" min="0" step="0.01" value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(p, 'price')}
                      onKeyDown={e => e.key === 'Enter' && commitEdit(p, 'price')}
                      style={inputStyle}
                    />
                  ) : (
                    <span style={{ cursor:'text', color: (p.price || 0) === 0 ? '#555' : '#fff' }}>
                      {fmtBedrag(p.price || 0)}
                    </span>
                  )}
                </td>

                {/* Aankoopprijs */}
                <td style={{ ...tdStyle, textAlign:'right' }}
                  onClick={() => !bulkPrijsMode && !editing(p.id,'costPrice') && startEdit(p.id, 'costPrice', p.costPrice || 0)}>
                  {bulkPrijsMode ? (
                    <input type="number" min="0" step="0.01"
                      value={bulkPrijsVals[p.id]?.costPrice ?? String(p.costPrice || 0)}
                      onChange={e => setBulkPrijsVals(prev => ({ ...prev, [p.id]: { ...prev[p.id], costPrice: e.target.value } }))}
                      style={bulkInput}
                    />
                  ) : editing(p.id, 'costPrice') ? (
                    <input autoFocus type="number" min="0" step="0.01" value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(p, 'costPrice')}
                      onKeyDown={e => e.key === 'Enter' && commitEdit(p, 'costPrice')}
                      style={inputStyle}
                    />
                  ) : (
                    <span style={{ cursor:'text', color:'#666', fontSize:'12px' }}>
                      {fmtBedrag(p.costPrice || 0)}
                    </span>
                  )}
                </td>

                {/* Actief toggle */}
                <td style={{ ...tdStyle, textAlign:'center' }}>
                  <button onClick={() => toggleActief(p)}
                    style={{ background: p.active !== false ? '#27ae60' : '#555', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'12px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    {p.active !== false ? 'Ja' : 'Nee'}
                  </button>
                </td>

                {/* Acties */}
                <td style={tdStyle}>
                  {confirmId === p.id ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
                      <span style={{ color:'#f39c12' }}>Zeker?</span>
                      <button onClick={() => verwijder(p.id)}
                        style={{ background:'#e74c3c', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>Ja</button>
                      <button onClick={() => setConfirmId(null)}
                        style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>Nee</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(p.id)}
                      style={{ background:'none', border:'1px solid #3a3a3a', color:'#aaa', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                      Verwijder
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ color:'#555', textAlign:'center', padding:'30px', fontSize:'14px' }}>
            {products.length === 0 ? 'Geen producten. Ga naar Stock-tab om standaardproducten te laden.' : 'Geen producten gevonden'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SCHULDEN TAB ─────────────────────────────────────────────────────────────

function SchuldenTab({ sales }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(new Set());
  const [confirmPayId, setConfirmPayId] = useState(null);

  const openSales = sales
    .filter(s => s.betaald === false)
    .sort((a, b) => {
      const ta = (a.aangemaaktOp || a.createdAt)?.toMillis?.() || 0;
      const tb = (b.aangemaaktOp || b.createdAt)?.toMillis?.() || 0;
      return tb - ta;
    });

  const totaalSchuld = openSales.reduce((s, x) => s + (x.totaal || x.total || 0), 0);

  const groepen = Object.values(
    openSales.reduce((acc, s) => {
      const key = s.koperNaam || 'Onbekend';
      if (!acc[key]) acc[key] = { naam: key, koperId: s.koperId || null, sales: [] };
      acc[key].sales.push(s);
      return acc;
    }, {})
  );

  function toggleExpanded(naam) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(naam) ? next.delete(naam) : next.add(naam);
      return next;
    });
  }

  async function markeerBetaald(id) {
    await updateDoc(doc(db, 'sales', id), { betaald: true });
    setConfirmPayId(null);
  }

  function datumLabel(s) {
    const ts = s.aangemaaktOp || s.createdAt;
    return ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '—';
  }

  return (
    <div>
      {openSales.length > 0 ? (
        <div style={{ background:'rgba(192,57,43,0.2)', border:'1px solid #c0392b', borderRadius:'10px', padding:'14px 16px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontWeight:'700', fontSize:'15px' }}>
            {openSales.length} openstaande schuld{openSales.length !== 1 ? 'en' : ''}
          </div>
          <div style={{ fontWeight:'700', fontSize:'18px', color:'#c0392b' }}>{fmtBedrag(totaalSchuld)}</div>
        </div>
      ) : (
        <div style={{ background:'rgba(39,174,96,0.1)', border:'1px solid #27ae60', borderRadius:'10px', padding:'16px', marginBottom:'20px', textAlign:'center', color:'#27ae60', fontWeight:'700', fontSize:'16px' }}>
          Alles betaald!
        </div>
      )}

      {groepen.map(groep => {
        const groepTotaal = groep.sales.reduce((s, x) => s + (x.totaal || x.total || 0), 0);
        const isExpanded = expanded.has(groep.naam);
        return (
          <div key={groep.naam} style={{ background:'#2d2d2d', borderRadius:'10px', marginBottom:'10px', overflow:'hidden' }}>
            <div onClick={() => toggleExpanded(groep.naam)}
              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', cursor:'pointer' }}>
              <div>
                {groep.koperId ? (
                  <span
                    onClick={e => { e.stopPropagation(); navigate(`/leden/${groep.koperId}`); }}
                    style={{ fontWeight:'700', fontSize:'15px', color:'#5dade2', textDecoration:'underline', cursor:'pointer' }}>
                    {groep.naam}
                  </span>
                ) : (
                  <span style={{ fontWeight:'700', fontSize:'15px' }}>{groep.naam}</span>
                )}
                <div style={{ fontSize:'12px', color:'#aaa', marginTop:'2px' }}>
                  {groep.sales.length} aankoop{groep.sales.length !== 1 ? 'en' : ''}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontWeight:'700', fontSize:'16px', color:'#c0392b' }}>{fmtBedrag(groepTotaal)}</span>
                <span style={{ color:'#666', fontSize:'14px' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop:'1px solid #3a3a3a' }}>
                {groep.sales.map(s => (
                  <div key={s.id} style={{ padding:'12px 16px', borderBottom:'1px solid #252525' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12px', color:'#777' }}>{datumLabel(s)}</div>
                        <div style={{ fontSize:'13px', color:'#ccc', marginTop:'3px' }}>
                          {(s.items || []).map(i => `${i.name} ${i.variant} x${i.qty}`).join(', ')}
                        </div>
                      </div>
                      <div style={{ fontWeight:'700', fontSize:'15px', color:'#c0392b', marginLeft:'12px', flexShrink:0 }}>
                        {fmtBedrag(s.totaal || s.total || 0)}
                      </div>
                    </div>
                    {confirmPayId === s.id ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px' }}>
                        <span style={{ fontSize:'13px', color:'#f39c12' }}>Zeker?</span>
                        <button onClick={() => markeerBetaald(s.id)}
                          style={{ background:'#27ae60', border:'none', color:'#fff', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
                          Ja
                        </button>
                        <button onClick={() => setConfirmPayId(null)}
                          style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>
                          Nee
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmPayId(s.id)}
                        style={{ marginTop:'8px', background:'none', border:'1px solid #3a3a3a', color:'#aaa', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                        Markeer als betaald
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── HOOFD COMPONENT ──────────────────────────────────────────────────────────

export default function Winkel() {
  const { profiel, isBeheerder, isTrainer } = useAuth();
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
  const visibleTabs = isBeheerder ? TABS : (isTrainer ? ['kassa'] : ['kassa']);

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
        {tab === 'producten' && <ProductenTab products={products} />}
        {tab === 'schulden' && <SchuldenTab sales={sales} />}
      </div>
    </div>
  );
}
