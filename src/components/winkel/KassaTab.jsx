import React, { useState, useCallback } from 'react';
import {
  collection, query, where, orderBy, limit,
  getDocs, doc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CATS, CAT_LABELS, fmtBedrag } from './winkelData';

// ── Debounce helper ────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// useLongPress: short press = +1, long press (500ms) = -1
function useLongPress(onShort, onLong, delay = 500) {
  const timerRef = React.useRef(null);
  const firedRef = React.useRef(false);

  function start(e) {
    e.preventDefault();
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLong && onLong();
    }, delay);
  }

  function end() {
    clearTimeout(timerRef.current);
    if (!firedRef.current) onShort && onShort();
  }

  function cancel() {
    clearTimeout(timerRef.current);
    firedRef.current = true;
  }

  return {
    onPointerDown:  start,
    onPointerUp:    end,
    onPointerLeave: cancel,
    onContextMenu:  e => e.preventDefault(),
  };
}

// ─── PRODUCT KAART ───────────────────────────────────────────────────────────
// Aparte component zodat useLongPress de Rules of Hooks respecteert
// (hooks mogen niet in een .map() loop worden aangeroepen)
function ProductKaart({ p, inCart, onAdd, onRemove }) {
  const available    = (p.stock || 0) - inCart;
  const geenPrijs    = (p.price || 0) === 0;
  const disabled     = available <= 0 || geenPrijs;
  const isSecondhand = p.tweedehands;
  const goldColor    = '#d4a017';

  const handlers = useLongPress(
    () => !disabled && onAdd(p),
    () => onRemove(p)
  );

  return (
    <div
      {...handlers}
      style={{
        background:       disabled ? '#1e1e1e' : isSecondhand ? 'rgba(212,160,23,0.1)' : '#2d2d2d',
        border:           disabled ? '1px solid #252525' : isSecondhand ? '1.5px solid ' + goldColor : '1.5px solid #3a3a3a',
        borderRadius:     '16px',
        padding:          '14px 12px 12px',
        cursor:           disabled ? 'not-allowed' : 'pointer',
        color:            disabled ? '#444' : '#fff',
        position:         'relative',
        minHeight:        '120px',
        display:          'flex',
        flexDirection:    'column',
        justifyContent:   'space-between',
        userSelect:       'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* Variant GROOT */}
      <div style={{ fontSize:'26px', fontWeight:'900', lineHeight:1, color: disabled ? '#444' : isSecondhand ? goldColor : '#fff', letterSpacing:'-0.5px' }}>
        {p.variant}
      </div>

      {/* Sublabel indien aanwezig */}
      {p.label && (
        <div style={{ fontSize:'11px', color: disabled ? '#333' : '#777', marginTop:'3px' }}>
          {p.label}
        </div>
      )}

      {/* Badges */}
      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'8px', alignItems:'center' }}>
        {isSecondhand && !disabled && (
          <span style={{ background: goldColor, color:'#1a1000', borderRadius:'5px', padding:'2px 6px', fontSize:'10px', fontWeight:'800' }}>
            2e hands
          </span>
        )}
        {geenPrijs && (
          <span style={{ background:'rgba(230,126,34,0.2)', color:'#e67e22', borderRadius:'5px', padding:'2px 6px', fontSize:'10px', fontWeight:'700' }}>
            Geen prijs
          </span>
        )}
      </div>

      {/* Prijs + stockbadge */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:'10px' }}>
        <span style={{ fontSize:'17px', fontWeight:'800', color: disabled ? '#444' : geenPrijs ? '#f39c12' : isSecondhand ? goldColor : '#c0392b' }}>
          {geenPrijs ? '—' : fmtBedrag(p.price)}
        </span>
        <span style={{
          fontSize:'11px', fontWeight:'700', padding:'3px 8px', borderRadius:'20px',
          background: disabled ? 'transparent' : available < 3 ? 'rgba(230,126,34,0.15)' : 'rgba(39,174,96,0.15)',
          color:      disabled ? '#444' : available < 3 ? '#e67e22' : '#27ae60',
          border:     disabled ? 'none' : '1px solid ' + (available < 3 ? '#e67e22' : '#27ae60'),
        }}>
          {disabled ? 'Uit' : available + ' ✓'}
        </span>
      </div>

      {/* In-cart badge */}
      {inCart > 0 && (
        <div style={{ position:'absolute', top:'10px', right:'10px', background:'#c0392b', color:'#fff', borderRadius:'12px', width:'22px', height:'22px', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:'800' }}>
          {inCart}
        </div>
      )}
    </div>
  );
}

// ─── KASSA TAB ────────────────────────────────────────────────────────────────
export default function KassaTab({ products, profiel }) {
  const [cat, setCat]                     = useState(CATS[0]);
  const [overlay, setOverlay]             = useState(null); // product object | null
  const [cart, setCart]                   = useState([]);
  const [showCart, setShowCart]           = useState(false);
  const [payStep, setPayStep]             = useState(false);
  const [method, setMethod]               = useState(null);
  const [koperNaam, setKoperNaam]         = useState('');
  const [koperId, setKoperId]             = useState(null);
  const [zoekOpen, setZoekOpen]           = useState(false);
  const [zoekterm, setZoekterm]           = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [saving, setSaving]               = useState(false);
  const [success, setSuccess]             = useState(null);

  const activeProducts = products.filter(p => p.active !== false);
  const filtered       = activeProducts.filter(p => p.category === cat);
  const totaal         = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const cartCount      = cart.reduce((s, i) => s + i.qty, 0);

  // ── addToCart: €0-blokkering VOOR stock-check (§4.4) ──────────────────────
  const addToCart = useCallback((product) => {
    if ((product.price || 0) === 0) return;       // §4.4 guard — €0 geblokkeerd
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
      return [
        ...c,
        {
          id:       product.id,
          name:     product.name,
          variant:  product.variant,
          price:    product.price || 0,
          qty:      1,
          maxStock: product.stock || 0,
        },
      ];
    });
    setOverlay(null);
  }, []);

  function removeOne(product) {
    setCart(c =>
      c.map(i => i.id === product.id
        ? { ...i, qty: Math.max(0, i.qty - 1) }
        : i
      ).filter(i => i.qty > 0)
    );
  }

  function changeQty(id, delta) {
    setCart(c =>
      c.map(i => i.id === id
        ? { ...i, qty: Math.max(0, Math.min(i.maxStock, i.qty + delta)) }
        : i
      ).filter(i => i.qty > 0)
    );
  }

  function removeItem(id) { setCart(c => c.filter(i => i.id !== id)); }

  // ── zoekUsers: debounce 300ms + prefix-query op naamLower + limit(6) (§4.4) ─
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const zoekUsers = useCallback(debounce(async (term) => {
    if (!term.trim() || term.trim().length < 2) { setZoekResultaten([]); return; }
    const lower = term.toLowerCase();
    try {
      const q = query(
        collection(db, 'users'),
        where('naamLower', '>=', lower),
        where('naamLower', '<=', lower + '\uf8ff'),
        limit(6)
      );
      const snap = await getDocs(q);
      setZoekResultaten(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setZoekResultaten([]); }
  }, 300), []);

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
      // Een atomische transactie: alle stock-updates + sale aanmaken
      // Als een update faalt, rolt de hele transactie terug
      await runTransaction(db, async (transaction) => {
        // Fase 1: alle reads (Firestore vereist reads voor writes in een transactie)
        const refs  = cart.map(item => doc(db, 'products', item.id));
        const snaps = await Promise.all(refs.map(ref => transaction.get(ref)));
        // Fase 2: validatie — controleer stock opnieuw binnen de transactie
        for (let i = 0; i < cart.length; i++) {
          const item   = cart[i];
          const huidig = snaps[i].data()?.stock || 0;
          if (huidig < item.qty) {
            throw new Error('Onvoldoende stock voor ' + item.name + ' ' + item.variant);
          }
        }
        // Fase 3: alle writes
        for (let i = 0; i < cart.length; i++) {
          const item   = cart[i];
          const data   = snaps[i].data();
          const huidig = data.stock || 0;
          transaction.update(refs[i], {
            stock:     Math.max(0, huidig - item.qty),
            soldCount: (data.soldCount || 0) + item.qty,
          });
        }
        // Sale-document binnen dezelfde transactie aanmaken
        const saleRef = doc(collection(db, 'sales'));
        transaction.set(saleRef, {
          items:         cart.map(i => ({ productId: i.id, naam: i.name, variant: i.variant, qty: i.qty, prijs: i.price })),
          totaal,
          betaalmethode: method,
          koperNaam:     koperNaam.trim(),
          koperId:       koperId || null,
          betaald:       method === 'cash',
          aangemaaktOp:  serverTimestamp(),
          verkoperUid:   profiel?.uid || null,
        });
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

  // ── Success overlay ────────────────────────────────────────────────────────
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

  // ── Betaalscherm ──────────────────────────────────────────────────────────
  if (payStep) {
    const canSubmit = !saving && method && koperNaam.trim().length >= 2;

    // §4.4 koppelwaarschuwing: geel blok ALLEEN als !koperId && naam >= 2 tekens, niet blokkerend
    const toonKoppelWaarschuwing = !koperId && koperNaam.trim().length >= 2;

    return (
      <div style={{ padding:'0 0 32px', maxWidth:'480px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'24px' }}>
          <button onClick={() => setPayStep(false)}
            style={{ background:'none', border:'none', color:'#aaa', fontSize:'26px', cursor:'pointer', lineHeight:1 }}>&#8592;</button>
          <div style={{ fontSize:'20px', fontWeight:'700' }}>Afrekenen &middot; {fmtBedrag(totaal)}</div>
        </div>

        {/* Betaalmethode */}
        <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Betaalmethode</div>
        <div style={{ display:'flex', gap:'10px', marginBottom:'24px' }}>
          {[['cash','Cash'],['overschrijving','Overschrijving']].map(([m, label]) => (
            <button key={m} onClick={() => setMethod(m)}
              style={{ flex:1, padding:'20px 10px', borderRadius:'12px', border:`2px solid ${method === m ? '#c0392b' : '#3a3a3a'}`, background: method === m ? 'rgba(192,57,43,0.15)' : '#2d2d2d', color: method === m ? '#fff' : '#bbb', fontSize:'16px', fontWeight:'700', cursor:'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {/* Naam koper */}
        <div style={{ fontSize:'12px', color:'#aaa', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Naam koper *</div>
        <input
          value={koperNaam}
          onChange={e => setKoperNaam(e.target.value)}
          placeholder="Naam koper (min. 2 tekens)"
          style={{ width:'100%', background:'#2d2d2d', border:'1px solid #3a3a3a', borderRadius:'8px', color:'#fff', padding:'14px', fontSize:'16px', boxSizing:'border-box', marginBottom:'16px', outline:'none' }}
        />

        {/* §4.4 Koppelwaarschuwing — geel, niet blokkerend */}
        {toonKoppelWaarschuwing && (
          <div style={{ background:'rgba(243,156,18,0.12)', border:'1px solid #f39c12', borderRadius:'8px', padding:'10px 14px', marginBottom:'12px', fontSize:'13px', color:'#f39c12' }}>
            Tip: koppel de aankoop aan een lid voor een betere opvolging van schulden.
          </div>
        )}

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

  // ── Cart overzicht ────────────────────────────────────────────────────────
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

  // ── Hoofdkassa ────────────────────────────────────────────────────────────
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
        {filtered.map(p => (
          <ProductKaart
            key={p.id}
            p={p}
            inCart={cart.find(i => i.id === p.id)?.qty || 0}
            onAdd={addToCart}
            onRemove={removeOne}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn:'1/-1', color:'#555', textAlign:'center', padding:'32px', fontSize:'14px' }}>
            Geen producten in deze categorie
          </div>
        )}
      </div>

      {/* Product-overlay (single product detail) */}
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
              {(overlay.price || 0) > 0 ? fmtBedrag(overlay.price) : 'Prijs niet ingesteld'}
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
            {/* §4.4: knop geblokkeerd als prijs €0 */}
            <button
              onClick={() => addToCart(overlay)}
              disabled={(overlay.price || 0) === 0}
              style={{ width:'100%', background: (overlay.price || 0) === 0 ? '#555' : '#c0392b', border:'none', color:'#fff', padding:'18px', borderRadius:'12px', fontSize:'18px', fontWeight:'700', cursor: (overlay.price || 0) === 0 ? 'not-allowed' : 'pointer' }}>
              {(overlay.price || 0) === 0 ? 'Prijs niet ingesteld' : 'Toevoegen aan cart'}
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
