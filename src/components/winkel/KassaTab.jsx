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
  updateDoc,
  where,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { getCatsFromConfig, fmtBedrag } from './winkelData';
import { useAuth } from '../../contexts/AuthContext';
import ProductIcon from './ProductIcon';
import { stappenVoor, opties, bladProducten, labelVoor, iconProductVoor } from './productFacets';
import { zoekLedenOpNaam } from '../../services/firestoreService';
import { useConfirm } from '../../contexts/ConfirmContext';

// stuurStockAlertMails is verwijderd.
// Stock alerts (push + mail) worden volledig afgehandeld door
// de Cloud Function `notifyStockZero` (functions/index.js),
// die triggert op een product update in Firestore.
// De client-side mail logica was onbetrouwbaar (tab sluiten, netwerkverlies).

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function SchuldenAccordion({ openSales, profiel }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmPayId, setConfirmPayId] = useState(null);
  const [payMethod, setPayMethod] = useState('overschrijving');
  const [savingPayId, setSavingPayId] = useState(null);

  const totaal = openSales.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);
  const groepen = Object.values(openSales.reduce((acc, sale) => {
    const key = sale.koperNaam || 'Onbekend';
    if (!acc[key]) acc[key] = { naam: key, koperId: sale.koperId || null, sales: [] };
    acc[key].sales.push(sale);
    return acc;
  }, {}));

  async function markeerBetaald(id) {
    setSavingPayId(id);
    try {
      await updateDoc(doc(db, 'sales', id), {
        betaald: true,
        betaaldOp: serverTimestamp(),
        betaaldDoor: profiel?.uid || null,
        betaaldDoorNaam: profiel?.naam || profiel?.email || null,
        betaaldVia: payMethod,
      });
    } finally {
      setSavingPayId(null);
      setConfirmPayId(null);
      setPayMethod('overschrijving');
    }
  }

  function datumLabel(sale) {
    const ts = sale.aangemaaktOp || sale.createdAt;
    return ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '-';
  }

  return (
    <div style={{
      background: 'rgba(251,146,60,0.08)',
      border: '1px solid var(--warning)',
      borderRadius: '12px',
      marginBottom: '16px',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', background: 'none', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>⚠️</span>
          <span style={{ fontWeight: '700', color: 'var(--warning)', fontSize: '14px' }}>
            {openSales.length} openstaande schuld{openSales.length !== 1 ? 'en' : ''} · {fmtBedrag(totaal)}
          </span>
        </div>
        <span style={{ color: 'var(--warning)', fontSize: '12px', fontWeight: '700' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid rgba(251,146,60,0.25)', padding: '8px 14px 14px' }}>
          {groepen.map(groep => {
            const groepTotaal = groep.sales.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);
            return (
              <div key={groep.naam} style={{
                background: 'var(--bg-card)', borderRadius: '10px',
                marginBottom: '8px', overflow: 'hidden',
                border: '1px solid var(--border-color)',
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 12px',
                }}>
                  <div>
                    {groep.koperId ? (
                      <span
                        onClick={() => navigate(`/leden/${groep.koperId}`)}
                        style={{ fontWeight: '700', fontSize: '14px', color: '#5dade2', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {groep.naam}
                      </span>
                    ) : (
                      <span style={{ fontWeight: '700', fontSize: '14px' }}>{groep.naam}</span>
                    )}
                    <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                      {groep.sales.length} aankoop{groep.sales.length !== 1 ? 'en' : ''}
                    </div>
                  </div>
                  <span style={{ fontWeight: '800', fontSize: '16px' }}>{fmtBedrag(groepTotaal)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border-color)', padding: '8px 12px' }}>
                  {groep.sales.map(sale => (
                    <div key={sale.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(42,63,90,0.5)', fontSize: '13px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>
                            {datumLabel(sale)}{sale.eventNaam ? ' · ' + sale.eventNaam : ''}
                          </div>
                          <div style={{ marginTop: '2px' }}>
                            {(sale.items || []).map(i => `${i.naam || i.name || '-'} ${i.variant || ''} x${i.qty || 0}`).join(', ')}
                          </div>
                        </div>
                        <strong style={{ whiteSpace: 'nowrap' }}>{fmtBedrag(sale.totaal || sale.total || 0)}</strong>
                      </div>
                      {confirmPayId === sale.id ? (
                        <div style={{ marginTop: '6px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={payMethod}
                            onChange={e => setPayMethod(e.target.value)}
                            style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', padding: '5px 8px', fontSize: '12px' }}
                          >
                            <option value="overschrijving">Overschrijving</option>
                            <option value="cash">Cash</option>
                          </select>
                          <button onClick={() => markeerBetaald(sale.id)} disabled={savingPayId === sale.id} style={{ background: 'var(--success)', border: 'none', color: '#fff', padding: '5px 10px', borderRadius: '6px', cursor: savingPayId === sale.id ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600', opacity: savingPayId === sale.id ? 0.6 : 1 }}>{savingPayId === sale.id ? 'Bezig...' : 'Betaald'}</button>
                          <button onClick={() => setConfirmPayId(null)} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>Annuleer</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmPayId(sale.id)}
                          style={{ marginTop: '5px', background: 'none', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Markeer als betaald
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function KassaTab({ products, profiel, verkoopmomenten = [], activeEvent, activeEventId, setActiveEventId, openSales = [] }) {
  const confirm = useConfirm();
  const { configCache } = useAuth();
  const { cats, catLabels } = getCatsFromConfig(configCache.productCategorieen);
  const [cat, setCat] = useState(cats[0]);
  const [keuze, setKeuze] = useState({}); // drilldown-keuze per categorie
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [payStep, setPayStep] = useState(false);
  const [method, setMethod] = useState(null);
  const [koperNaam, setKoperNaam] = useState('');
  const [koperId, setKoperId] = useState(null);
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [kassaNaam, setKassaNaam] = useState(() => {
    try { return localStorage.getItem('kassaNaam') || 'Kassa 1'; } catch { return 'Kassa 1'; }
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);

  const activeProducts = products.filter(p => p.active !== false);
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
  }, []);

  function changeQty(id, delta) {
    setCart(current => current
      .map(item => item.id === id ? { ...item, qty: Math.max(0, Math.min(item.maxStock, item.qty + delta)) } : item)
      .filter(item => item.qty > 0)
    );
  }

  // ── Drilldown ───────────────────────────────────────────────────────────────
  // Na toevoegen terug naar de laatste facet-stap, zodat je vlot meerdere
  // varianten (bv. maten) kan toevoegen zonder opnieuw te beginnen.
  function resetNaToevoegen(basis) {
    const stappen = stappenVoor(cat);
    const n = { ...basis };
    delete n.tweedehands;
    delete n[stappen[stappen.length - 1]];
    setKeuze(n);
  }

  function kiesStap(stap, waarde) {
    const nieuw = { ...keuze, [stap]: waarde };
    const stappen = stappenVoor(cat);
    const facetKlaar = stappen.every(s => nieuw[s] != null);
    if (!facetKlaar) { setKeuze(nieuw); return; }
    // Alle facetten gekozen → blad. Eén product = direct toevoegen; meerdere
    // (nieuw + 2e hands) = toon de staat-keuze.
    const bladen = bladProducten(cat, nieuw, activeProducts);
    if (bladen.length === 1) { addToCart(bladen[0]); resetNaToevoegen(nieuw); }
    else setKeuze(nieuw);
  }

  function kiesProduct(p) { addToCart(p); resetNaToevoegen(keuze); }

  function terugStap() {
    const stappen = stappenVoor(cat);
    const gekozen = stappen.filter(s => keuze[s] != null);
    const n = { ...keuze };
    delete n.tweedehands;
    if (gekozen.length > 0) delete n[gekozen[gekozen.length - 1]];
    setKeuze(n);
  }

  async function removeItem(id) {
    const item = cart.find(i => i.id === id);
    const ok = await confirm({
      titel: 'Item uit winkelmandje halen?',
      beschrijving: item?.name
        ? `${item.name}${item.variant ? ' (' + item.variant + ')' : ''} wordt uit het mandje verwijderd.`
        : 'Dit item wordt uit het mandje verwijderd.',
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    setCart(current => current.filter(item => item.id !== id));
  }

  const zoekUsers = useCallback(debounce(async (term) => {
    if (term.trim().length < 2) { setZoekResultaten([]); return; }
    try {
      setZoekResultaten(await zoekLedenOpNaam(term, 8));
    } catch (e) {
      console.error('Leden zoeken mislukt:', e);
      setZoekResultaten([]);
    }
  }, 300), []);

  function ontkoppelLid() {
    setKoperId(null);
    setZoekResultaten([]);
  }

  async function afronden() {
    if (!method || koperNaam.trim().length < 2 || cart.length === 0) return;

    setSaving(true);
    try {
      await runTransaction(db, async (transaction) => {
        const refs  = cart.map(item => doc(db, 'products', item.id));
        const snaps = await Promise.all(refs.map(ref => transaction.get(ref)));

        for (let i = 0; i < cart.length; i++) {
          const data = snaps[i].data();
          const huidig = data?.stock || 0;
          if (huidig < cart[i].qty) {
            throw new Error('Onvoldoende stock voor ' + cart[i].name + (cart[i].variant ? ' ' + cart[i].variant : ''));
          }
          transaction.update(refs[i], {
            stock: huidig - cart[i].qty,
            soldCount: (data.soldCount || 0) + cart[i].qty,
          });
        }

        const saleRef      = doc(collection(db, 'sales'));
        const cashBetaald  = method === 'cash';
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
      // method en kassa bewust behouden voor vlotte opeenvolgende verkopen
      setKoperNaam('');
      setKoperId(null);
      setZoekResultaten([]);
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  }

  if (success) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ fontSize: '56px', color: 'var(--success)', marginBottom: '10px' }}>✓</div>
        <div style={{ fontSize: '32px', fontWeight: '800', marginBottom: '8px' }}>{fmtBedrag(success.totaal)}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '16px', marginBottom: '4px' }}>{success.betaalmethode === 'cash' ? 'Cash betaald' : 'Overschrijving'}</div>
        <div style={{ fontSize: '18px', fontWeight: '700' }}>{success.koperNaam}</div>
        {(success.eventNaam || success.kassaNaam) && (
          <div style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: 'var(--font-size-sm)' }}>{success.eventNaam || 'Geen verkoopmoment'} · {success.kassaNaam}</div>
        )}
        {success.betaalmethode === 'overschrijving' && <div style={{ color: 'var(--warning)', marginTop: '12px', fontSize: 'var(--font-size-md)' }}>Openstaande schuld geregistreerd</div>}
      </div>
    );
  }

  if (payStep) {
    const canSubmit = !saving && method && koperNaam.trim().length >= 2 && cart.length > 0;

    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button onClick={() => setPayStep(false)} style={backBtn}>←</button>
          <h2 style={{ margin: 0, fontSize: '22px' }}>Afrekenen · {fmtBedrag(totaal)}</h2>
        </div>

        {/* Betaalmethode bovenaan */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
          {[['cash', 'Cash'], ['overschrijving', 'Overschrijving']].map(([m, label]) => (
            <button key={m} onClick={() => setMethod(m)} style={methodBtn(method === m)}>{label}</button>
          ))}
        </div>

        {/* Koper: naam + inline lid-zoek samengevoegd */}
        <div style={{ marginBottom: '14px', position: 'relative' }}>
          <input
            value={koperNaam}
            onChange={e => { setKoperNaam(e.target.value); setKoperId(null); zoekUsers(e.target.value); }}
            placeholder="Naam koper (typ om een lid te koppelen)"
            style={inputStyle}
          />
          {koperId ? (
            <div style={{ marginTop: '6px', fontSize: 'var(--font-size-sm)', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              ✓ Gekoppeld aan lid
              <button onClick={ontkoppelLid} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit' }}>ontkoppel</button>
            </div>
          ) : zoekResultaten.length > 0 && (
            <div style={{ position: 'absolute', left: 0, right: 0, zIndex: 20, marginTop: '4px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}>
              {zoekResultaten.map(u => (
                <button key={u.id} onClick={() => { setKoperId(u.id); setKoperNaam(u.naam || u.name || koperNaam); setZoekResultaten([]); }} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '12px', textAlign: 'left', cursor: 'pointer', fontSize: 'var(--font-size-md)', display: 'block', fontFamily: 'inherit' }}>
                  {u.naam || u.name || u.email || u.id}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Verkoopmoment + kassa compact */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
          <select value={activeEventId || ''} onChange={e => setActiveEventId(e.target.value)} style={inputStyle}>
            <option value="">Geen verkoopmoment</option>
            {verkoopmomenten.filter(v => v.status !== 'afgesloten').map(v => (
              <option key={v.id} value={v.id}>{v.naam}</option>
            ))}
          </select>
          <select value={kassaNaam} onChange={e => { setKassaNaam(e.target.value); try { localStorage.setItem('kassaNaam', e.target.value); } catch { /* ignore */ } }} style={inputStyle}>
            {kassaNamen.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Samenvatting */}
        <div style={cardStyle}>
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', fontSize: '14px' }}>
              <span>{item.name} {item.variant} ×{item.qty}</span>
              <strong>{fmtBedrag(item.price * item.qty)}</strong>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '800' }}>
            <span>Totaal</span>
            <span>{fmtBedrag(totaal)}</span>
          </div>
        </div>

        <button onClick={afronden} disabled={!canSubmit} style={{ width: '100%', background: canSubmit ? 'var(--accent-red)' : 'var(--border-color)', border: 'none', color: 'var(--text-primary)', padding: '18px', borderRadius: 'var(--radius-lg)', fontSize: '18px', fontWeight: '700', cursor: canSubmit ? 'pointer' : 'not-allowed' }}>
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
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Kar is leeg</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
              {cart.map(item => (
                <div key={item.id} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700' }}>{item.name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{item.variant} · {fmtBedrag(item.price)} / stuk</div>
                  </div>
                  <button onClick={() => changeQty(item.id, -1)} style={qtyBtn}>−</button>
                  <strong>{item.qty}</strong>
                  <button onClick={() => changeQty(item.id, 1)} style={qtyBtn}>+</button>
                  <div style={{ fontWeight: '800', minWidth: '70px', textAlign: 'right' }}>{fmtBedrag(item.price * item.qty)}</div>
                  <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '22px', padding: '4px', lineHeight: 1 }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', textAlign: 'right', marginBottom: '14px' }}>Totaal: {fmtBedrag(totaal)}</div>
            <button onClick={() => { setShowCart(false); setPayStep(true); }} style={{ width: '100%', background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '18px', borderRadius: 'var(--radius-lg)', fontSize: '18px', fontWeight: '700', cursor: 'pointer' }}>Afrekenen</button>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: cartCount > 0 ? '80px' : '16px' }}>
      {openSales.length > 0 && (
        <SchuldenAccordion openSales={openSales} profiel={profiel} />
      )}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {cats.map(c => (
          <button key={c} onClick={() => { setCat(c); setKeuze({}); }} style={{ flexShrink: 0, minHeight: '44px', padding: '0 20px', borderRadius: '22px', border: cat === c ? 'none' : '1px solid var(--border-color)', background: cat === c ? 'var(--accent-red)' : 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', fontWeight: cat === c ? '700' : '400', cursor: 'pointer' }}>
            {catLabels[c]}
          </button>
        ))}
      </div>

      {(() => {
        const stappen = stappenVoor(cat);
        const huidigeStap = stappen.find(s => keuze[s] == null);
        const gekozenStappen = stappen.filter(s => keuze[s] != null);
        const kruimels = gekozenStappen.map(s => labelVoor(cat, s, keuze[s]));

        const kruimelBalk = kruimels.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <button onClick={terugStap} style={drilldownTerug}>←</button>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{catLabels[cat]} · {kruimels.join(' · ')}</span>
          </div>
        );

        if (huidigeStap) {
          const lijst = opties(cat, huidigeStap, keuze, activeProducts);
          return (
            <>
              {kruimelBalk}
              {lijst.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px', fontSize: 'var(--font-size-md)' }}>Geen voorraad in deze categorie</div>
              ) : (
                <div style={drilldownGrid}>
                  {lijst.map(o => (
                    <button key={String(o.waarde)} onClick={() => kiesStap(huidigeStap, o.waarde)} style={drilldownTegel}>
                      <ProductIcon product={iconProductVoor(cat, huidigeStap, o.waarde)} />
                      <div style={{ fontSize: '15px', fontWeight: '800', lineHeight: 1.2 }}>{o.label}</div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {o.nieuwAantal > 0 && <span style={chipNieuw}>Nieuw {o.nieuwAantal}</span>}
                        {o.tweedehandsAantal > 0 && <span style={chip2e}>2e hands {o.tweedehandsAantal}</span>}
                      </div>
                      {o.prijsVan > 0 && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>vanaf {fmtBedrag(o.prijsVan)}</div>}
                    </button>
                  ))}
                </div>
              )}
            </>
          );
        }

        // Blad: keuze nieuw vs. 2e hands (enkel hier als beide voorraad hebben)
        const bladen = bladProducten(cat, keuze, activeProducts);
        return (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <button onClick={terugStap} style={drilldownTerug}>←</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{catLabels[cat]} · {kruimels.join(' · ')} · Kies staat</span>
            </div>
            <div style={drilldownGrid}>
              {bladen.map(p => (
                <button key={p.id} onClick={() => kiesProduct(p)} style={drilldownTegel}>
                  <ProductIcon product={p} />
                  <div style={{ fontSize: '15px', fontWeight: '800' }}>{p.tweedehands ? '2e hands' : 'Nieuw'}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.stock} op voorraad · {fmtBedrag(p.price)}</div>
                </button>
              ))}
            </div>
          </>
        );
      })()}

      {cartCount > 0 && (
        <div style={{ position: 'fixed', left: '16px', right: '16px', bottom: '16px', background: 'var(--accent-red)', borderRadius: '14px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 22px rgba(0,0,0,0.35)', zIndex: 50 }}>
          <button onClick={() => setShowCart(true)} style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '700', fontSize: '16px', textAlign: 'left' }}>Winkelkar · {cartCount} item{cartCount !== 1 ? 's' : ''}</button>
          <button onClick={() => { setShowCart(false); setPayStep(true); }} style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.3)', color: 'var(--text-primary)', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '700' }}>{fmtBedrag(totaal)} →</button>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--text-primary)',
  padding: '14px',
  fontSize: 'var(--font-size-md)',
  boxSizing: 'border-box',
  outline: 'none',
};

const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-lg)',
  padding: '14px',
  marginBottom: '18px',
};

const backBtn = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '26px',
  cursor: 'pointer',
  lineHeight: 1,
};

const drilldownGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
  gap: '12px',
};

const drilldownTegel = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '16px',
  padding: '16px 12px',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '8px',
  color: 'var(--text-primary)',
  fontFamily: 'inherit',
  minHeight: '118px',
  justifyContent: 'center',
  textAlign: 'center',
};

const chipNieuw = {
  background: 'rgba(39,174,96,0.15)', color: 'var(--success)', border: '1px solid var(--success)',
  borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: '700',
};

const chip2e = {
  background: 'rgba(212,160,23,0.15)', color: '#d4a017', border: '1px solid #d4a017',
  borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: '700',
};

const drilldownTerug = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  borderRadius: '8px',
  padding: '6px 12px',
  cursor: 'pointer',
  fontSize: '18px',
  lineHeight: 1,
};

const qtyBtn = {
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-color)',
  color: 'var(--text-primary)',
  width: '32px',
  height: '32px',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: '18px',
};

function methodBtn(active) {
  return {
    flex: 1,
    padding: '20px 10px',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid ' + (active ? 'var(--accent-red)' : 'var(--border-color)'),
    background: active ? 'rgba(230,51,70,0.16)' : 'var(--bg-card)',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
  };
}
