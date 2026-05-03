import React, { useCallback, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CATS, CAT_LABELS, fmtBedrag } from './winkelData';
import ProductIcon, { getProductVisual } from './ProductIcon';

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

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
    onPointerDown: start,
    onPointerUp: end,
    onPointerLeave: cancel,
    onContextMenu: e => e.preventDefault(),
  };
}

function ProductKaart({ p, inCart, onAdd, onRemove, onOpen }) {
  const available = (p.stock || 0) - inCart;
  const geenPrijs = (p.price || 0) === 0;
  const disabled = available <= 0 || geenPrijs;
  const isSecondhand = p.tweedehands;
  const goldColor = '#d4a017';
  const visual = getProductVisual(p);

  const handlers = useLongPress(
    () => !disabled && onAdd(p),
    () => onRemove(p)
  );

  return (
    <div
      {...handlers}
      onDoubleClick={() => onOpen(p)}
      style={{
        position: 'relative',
        background: isSecondhand ? 'rgba(212,160,23,0.08)' : '#2d2d2d',
        border: '1px solid ' + (isSecondhand ? goldColor : '#3a3a3a'),
        borderRadius: '14px',
        padding: '14px',
        minHeight: '122px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: '10px',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <ProductIcon product={p} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '18px', fontWeight: '800', lineHeight: 1.2 }}>{p.variant}</div>
            <div style={{ color: '#888', fontSize: '11px', marginTop: '2px' }}>{visual.label}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {isSecondhand && !disabled && (
            <span style={{ background: goldColor, color: '#1a1000', borderRadius: '5px', padding: '2px 6px', fontSize: '10px', fontWeight: '800' }}>2e hands</span>
          )}
          {geenPrijs && (
            <span style={{ background: '#555', color: '#fff', borderRadius: '5px', padding: '2px 6px', fontSize: '10px', fontWeight: '700' }}>Geen prijs</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: '800' }}>{geenPrijs ? '-' : fmtBedrag(p.price)}</div>
        <span style={{
          background: disabled ? '#333' : available < 3 ? 'rgba(230,126,34,0.15)' : 'rgba(39,174,96,0.15)',
          color: disabled ? '#777' : available < 3 ? '#e67e22' : '#27ae60',
          border: disabled ? 'none' : '1px solid ' + (available < 3 ? '#e67e22' : '#27ae60'),
          borderRadius: '12px',
          padding: '3px 8px',
          fontSize: '12px',
          fontWeight: '700',
        }}>
          {disabled ? 'Uit' : available + ' beschikbaar'}
        </span>
      </div>

      {inCart > 0 && (
        <div style={{
          position: 'absolute',
          top: '-8px',
          right: '-8px',
          background: '#c0392b',
          color: '#fff',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          fontWeight: '800',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}>
          {inCart}
        </div>
      )}
    </div>
  );
}

export default function KassaTab({ products, profiel, verkoopmomenten = [], activeEvent, activeEventId, setActiveEventId }) {
  const [cat, setCat] = useState(CATS[0]);
  const [overlay, setOverlay] = useState(null);
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [payStep, setPayStep] = useState(false);
  const [method, setMethod] = useState(null);
  const [koperNaam, setKoperNaam] = useState('');
  const [koperId, setKoperId] = useState(null);
  const [zoekOpen, setZoekOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [kassaNaam, setKassaNaam] = useState('Kassa 1');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const activeProducts = products.filter(p => p.active !== false);
  const filtered = activeProducts.filter(p => p.category === cat);
  const totaal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const kassaNamen = useMemo(() => activeEvent?.kassaNamen || ['Kassa 1', 'Kassa 2', 'Kassa 3', 'Kassa 4'], [activeEvent]);

  const addToCart = useCallback((product) => {
    if ((product.price || 0) === 0) return;
    if ((product.stock || 0) <= 0) return;

    setCart(current => {
      const idx = current.findIndex(item => item.id === product.id);
      if (idx >= 0) {
        const updated = [...current];
        if (updated[idx].qty < (product.stock || 0)) {
          updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        }
        return updated;
      }

      return [
        ...current,
        {
          id: product.id,
          name: product.name,
          variant: product.variant,
          price: product.price || 0,
          qty: 1,
          maxStock: product.stock || 0,
        },
      ];
    });

    setOverlay(null);
  }, []);

  function removeOne(product) {
    setCart(current => current
      .map(item => item.id === product.id ? { ...item, qty: Math.max(0, item.qty - 1) } : item)
      .filter(item => item.qty > 0)
    );
  }

  function changeQty(id, delta) {
    setCart(current => current
      .map(item => item.id === id ? { ...item, qty: Math.max(0, Math.min(item.maxStock, item.qty + delta)) } : item)
      .filter(item => item.qty > 0)
    );
  }

  function removeItem(id) {
    setCart(current => current.filter(item => item.id !== id));
  }

  const zoekUsers = useCallback(debounce(async (term) => {
    const lower = term.trim().toLowerCase();
    if (lower.length < 2) {
      setZoekResultaten([]);
      return;
    }

    try {
      const q = query(collection(db, 'members'), orderBy('naam'), limit(75));
      const snap = await getDocs(q);
      const resultaten = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => {
          const naam = String(u.naam || u.name || '').toLowerCase();
          return naam.includes(lower) && u.actief !== false && u.active !== false;
        })
        .slice(0, 6);
      setZoekResultaten(resultaten);
    } catch (e) {
      console.error('Leden zoeken mislukt:', e);
      setZoekResultaten([]);
    }
  }, 300), []);

  function ontkoppelLid() {
    setKoperId(null);
    setZoekterm('');
    setZoekResultaten([]);
    setZoekOpen(false);
  }

  async function afronden() {
    if (!method || koperNaam.trim().length < 2 || cart.length === 0) return;

    setSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const refs = cart.map(item => doc(db, 'products', item.id));
        const snaps = await Promise.all(refs.map(ref => transaction.get(ref)));

        for (let i = 0; i < cart.length; i++) {
          const huidig = snaps[i].data()?.stock || 0;
          if (huidig < cart[i].qty) {
            throw new Error('Onvoldoende stock voor ' + cart[i].name + ' ' + cart[i].variant);
          }
        }

        for (let i = 0; i < cart.length; i++) {
          const data = snaps[i].data();
          const huidig = data.stock || 0;
          transaction.update(refs[i], {
            stock: Math.max(0, huidig - cart[i].qty),
            soldCount: (data.soldCount || 0) + cart[i].qty,
          });
        }

        const saleRef = doc(collection(db, 'sales'));
        const cashBetaald = method === 'cash';
        transaction.set(saleRef, {
          items: cart.map(item => ({
            productId: item.id,
            naam: item.name,
            name: item.name,
            variant: item.variant,
            qty: item.qty,
            prijs: item.price,
          })),
          totaal,
          betaalmethode: method,
          koperNaam: koperNaam.trim(),
          koperId: koperId || null,
          betaald: cashBetaald,
          betaaldOp: cashBetaald ? serverTimestamp() : null,
          betaaldDoor: cashBetaald ? profiel?.uid || null : null,
          betaaldDoorNaam: cashBetaald ? profiel?.naam || profiel?.email || null : null,
          eventId: activeEventId || null,
          eventNaam: activeEvent?.naam || null,
          kassaNaam: kassaNaam || null,
          geannuleerd: false,
          aangemaaktOp: serverTimestamp(),
          verkoperUid: profiel?.uid || null,
          verkoperNaam: profiel?.naam || profiel?.email || null,
        });
      });

      setSuccess({ totaal, betaalmethode: method, koperNaam: koperNaam.trim(), eventNaam: activeEvent?.naam || null, kassaNaam });
      setCart([]);
      setShowCart(false);
      setPayStep(false);
      setMethod(null);
      setKoperNaam('');
      setKoperId(null);
      setZoekterm('');
      setZoekResultaten([]);
      setZoekOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  if (success) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '56px', color: '#27ae60', marginBottom: '10px' }}>✓</div>
        <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>{fmtBedrag(success.totaal)}</div>
        <div style={{ color: '#aaa', fontSize: '16px', marginBottom: '4px' }}>{success.betaalmethode === 'cash' ? 'Cash betaald' : 'Overschrijving'}</div>
        <div style={{ fontSize: '18px', fontWeight: '700' }}>{success.koperNaam}</div>
        {(success.eventNaam || success.kassaNaam) && (
          <div style={{ color: '#aaa', marginTop: '6px', fontSize: '13px' }}>{success.eventNaam || 'Geen verkoopmoment'} · {success.kassaNaam}</div>
        )}
        {success.betaalmethode === 'overschrijving' && <div style={{ color: '#f39c12', marginTop: '12px', fontSize: '14px' }}>Openstaande schuld geregistreerd</div>}
      </div>
    );
  }

  if (payStep) {
    const canSubmit = !saving && method && koperNaam.trim().length >= 2 && cart.length > 0;
    const toonKoppelWaarschuwing = !koperId && koperNaam.trim().length >= 2;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <button onClick={() => setPayStep(false)} style={backBtn}>←</button>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Afrekenen · {fmtBedrag(totaal)}</h2>
        </div>

        <div style={cardStyle}>
          <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>Verkoopmoment en kassa</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <select value={activeEventId || ''} onChange={e => setActiveEventId(e.target.value)} style={inputStyle}>
              <option value="">Geen verkoopmoment</option>
              {verkoopmomenten.filter(v => v.status !== 'afgesloten').map(v => (
                <option key={v.id} value={v.id}>{v.naam}</option>
              ))}
            </select>
            <select value={kassaNaam} onChange={e => setKassaNaam(e.target.value)} style={inputStyle}>
              {kassaNamen.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>Betaalmethode</div>
          <div style={{ display: 'flex', gap: '10px' }}>
            {[
              ['cash', 'Cash'],
              ['overschrijving', 'Overschrijving'],
            ].map(([m, label]) => (
              <button key={m} onClick={() => setMethod(m)} style={methodBtn(method === m)}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '18px' }}>
          <div style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px' }}>Naam koper *</div>
          <input value={koperNaam} onChange={e => setKoperNaam(e.target.value)} placeholder="Naam koper (min. 2 tekens)" style={inputStyle} />

          {toonKoppelWaarschuwing && (
            <div style={{ background: 'rgba(243,156,18,0.12)', border: '1px solid #f39c12', color: '#f39c12', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', marginTop: '10px', marginBottom: '12px' }}>
              Tip: koppel de aankoop aan een lid voor een betere opvolging van schulden.
            </div>
          )}

          {koperId ? (
            <button onClick={ontkoppelLid} style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid #27ae60', color: '#27ae60', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}>
              Gekoppeld aan: {koperNaam} ✕
            </button>
          ) : (
            <div>
              <button onClick={() => setZoekOpen(v => !v)} style={{ background: '#2d2d2d', border: '1px solid #3a3a3a', color: '#aaa', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', marginTop: '10px', marginBottom: zoekOpen ? '10px' : '0' }}>
                Koppel aan lid (optioneel)
              </button>
              {zoekOpen && (
                <>
                  <input value={zoekterm} onChange={e => { setZoekterm(e.target.value); zoekUsers(e.target.value); }} placeholder="Zoek lid op naam" autoFocus style={inputStyle} />
                  {zoekResultaten.length > 0 && (
                    <div style={{ background: '#2d2d2d', border: '1px solid #3a3a3a', borderRadius: '8px', overflow: 'hidden', marginTop: '8px' }}>
                      {zoekResultaten.map(u => (
                        <button key={u.id} onClick={() => { setKoperId(u.id); setKoperNaam(u.naam || u.name || koperNaam); setZoekterm(''); setZoekResultaten([]); setZoekOpen(false); }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #3a3a3a', color: '#fff', padding: '14px 12px', textAlign: 'left', cursor: 'pointer', fontSize: '15px', display: 'block' }}>
                          {u.naam || u.name || u.email || u.id}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', fontSize: '14px' }}>
              <span>{item.name} {item.variant} ×{item.qty}</span>
              <strong>{fmtBedrag(item.price * item.qty)}</strong>
            </div>
          ))}
          <div style={{ borderTop: '1px solid #3a3a3a', marginTop: '8px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800' }}>
            <span>Totaal</span>
            <span>{fmtBedrag(totaal)}</span>
          </div>
        </div>

        <button onClick={afronden} disabled={!canSubmit} style={{ width: '100%', background: canSubmit ? '#c0392b' : '#555', border: 'none', color: '#fff', padding: '18px', borderRadius: '12px', fontSize: '18px', fontWeight: '700', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
          {saving ? 'Bezig' : 'Verkoop afronden'}
        </button>
      </div>
    );
  }

  if (showCart) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '18px' }}>
          <button onClick={() => setShowCart(false)} style={backBtn}>←</button>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Winkelkar ({cartCount})</h2>
        </div>

        {cart.length === 0 ? (
          <div style={{ color: '#777', textAlign: 'center', padding: '40px' }}>Kar is leeg</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              {cart.map(item => (
                <div key={item.id} style={{ background: '#2d2d2d', borderRadius: '12px', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700' }}>{item.name}</div>
                    <div style={{ color: '#aaa', fontSize: '13px' }}>{item.variant} · {fmtBedrag(item.price)} / stuk</div>
                  </div>
                  <button onClick={() => changeQty(item.id, -1)} style={qtyBtn}>−</button>
                  <strong>{item.qty}</strong>
                  <button onClick={() => changeQty(item.id, 1)} style={qtyBtn}>+</button>
                  <div style={{ fontWeight: '800', minWidth: '70px', textAlign: 'right' }}>{fmtBedrag(item.price * item.qty)}</div>
                  <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '22px', padding: '4px', lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', textAlign: 'right', marginBottom: '14px' }}>Totaal: {fmtBedrag(totaal)}</div>
            <button onClick={() => { setShowCart(false); setPayStep(true); }} style={{ width: '100%', background: '#c0392b', border: 'none', color: '#fff', padding: '18px', borderRadius: '12px', fontSize: '18px', fontWeight: '700', cursor: 'pointer' }}>Afrekenen</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: cartCount > 0 ? '80px' : '16px' }}>
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {CATS.map(c => (
          <button key={c} onClick={() => setCat(c)} style={{ flexShrink: 0, minHeight: '44px', padding: '0 20px', borderRadius: '22px', border: cat === c ? 'none' : '1px solid #3a3a3a', background: cat === c ? '#c0392b' : '#2d2d2d', color: '#fff', fontSize: '15px', fontWeight: cat === c ? '700' : '400', cursor: 'pointer' }}>
            {CAT_LABELS[c]}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
        {filtered.map(p => (
          <ProductKaart key={p.id} p={p} inCart={cart.find(i => i.id === p.id)?.qty || 0} onAdd={addToCart} onRemove={removeOne} onOpen={setOverlay} />
        ))}
      </div>

      {filtered.length === 0 && <div style={{ color: '#555', textAlign: 'center', padding: '30px', fontSize: '14px' }}>Geen producten in deze categorie</div>}

      {overlay && (
        <div onClick={() => setOverlay(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#2d2d2d', borderRadius: '16px', padding: '22px', width: '100%', maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ color: '#aaa', fontSize: '13px' }}>{overlay.name}</div>
                <div style={{ fontSize: '22px', fontWeight: '800' }}>{overlay.variant}</div>
              </div>
              <button onClick={() => setOverlay(null)} style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '26px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}><ProductIcon product={overlay} size={54} /></div>
            <div style={{ fontSize: '30px', fontWeight: '800', marginBottom: '12px' }}>{(overlay.price || 0) > 0 ? fmtBedrag(overlay.price) : 'Prijs niet ingesteld'}</div>
            <button onClick={() => addToCart(overlay)} disabled={(overlay.price || 0) === 0} style={{ width: '100%', background: (overlay.price || 0) === 0 ? '#555' : '#c0392b', border: 'none', color: '#fff', padding: '18px', borderRadius: '12px', fontSize: '18px', fontWeight: '700', cursor: (overlay.price || 0) === 0 ? 'not-allowed' : 'pointer' }}>
              {(overlay.price || 0) === 0 ? 'Prijs niet ingesteld' : 'Toevoegen aan cart'}
            </button>
          </div>
        </div>
      )}

      {cartCount > 0 && (
        <div style={{ position: 'fixed', left: '16px', right: '16px', bottom: '16px', background: '#c0392b', borderRadius: '14px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 22px rgba(0,0,0,0.35)', zIndex: 50 }}>
          <button onClick={() => setShowCart(true)} style={{ flex: 1, background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontWeight: '700', fontSize: '16px', textAlign: 'left' }}>Winkelkar · {cartCount} item{cartCount !== 1 ? 's' : ''}</button>
          <button onClick={() => { setShowCart(false); setPayStep(true); }} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>{fmtBedrag(totaal)} →</button>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#2d2d2d',
  border: '1px solid #3a3a3a',
  borderRadius: '8px',
  color: '#fff',
  padding: '14px',
  fontSize: '15px',
  boxSizing: 'border-box',
  outline: 'none',
};

const cardStyle = {
  background: '#2d2d2d',
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '18px',
};

const backBtn = {
  background: 'none',
  border: 'none',
  color: '#aaa',
  fontSize: '26px',
  cursor: 'pointer',
  lineHeight: 1,
};

const qtyBtn = {
  background: '#1a1a1a',
  border: '1px solid #3a3a3a',
  color: '#fff',
  width: '32px',
  height: '32px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '18px',
};

function methodBtn(active) {
  return {
    flex: 1,
    padding: '20px 10px',
    borderRadius: '12px',
    border: '2px solid ' + (active ? '#c0392b' : '#3a3a3a'),
    background: active ? 'rgba(192,57,43,0.15)' : '#2d2d2d',
    color: active ? '#fff' : '#bbb',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  };
}
