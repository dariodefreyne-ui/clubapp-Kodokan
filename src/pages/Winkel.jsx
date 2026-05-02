import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { TABS, TAB_LABELS } from '../components/winkel/winkelData';
import KassaTab     from '../components/winkel/KassaTab';
import StockTab     from '../components/winkel/StockTab';
import ProductenTab from '../components/winkel/ProductenTab';
import SchuldenTab  from '../components/winkel/SchuldenTab';

// ─── WINKEL — Orchestrator ────────────────────────────────────────────────────
// Na refactor: uitsluitend state management, listeners, tab-rendering en tab-balk.
// Geen business-logica — alles delegeert naar child-componenten.

export default function Winkel() {
  const { profiel, isBeheerder, isTrainer } = useAuth();
  const [tab,      setTab]      = useState('kassa');
  const [products, setProducts] = useState([]);
  const [openSales, setOpenSales] = useState([]);

  useEffect(() => {
    // §4.3 — products: orderBy category + variant (compound — vereist composite index in week 5)
    const unsub1 = onSnapshot(
      query(collection(db, 'products'), orderBy('category'), orderBy('variant')),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    // §4.3 — sales: parent filtert op betaald === false
    // SchuldenTab ontvangt openSales als prop — geen eigen listener nodig
    const unsub2 = onSnapshot(
      query(collection(db, 'sales'), where('betaald', '==', false)),
      snap => setOpenSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    return () => { unsub1(); unsub2(); };
  }, []);

  // §4.3 — visibleTabs: isBeheerder ziet alle tabs, trainer enkel kassa
  const visibleTabs    = isBeheerder ? TABS : ['kassa'];
  const heeftOpenSales = openSales.length > 0;

  return (
    <div style={{ minHeight:'100vh', background:'#1a1a1a', color:'#fff' }}>
      {/* Tab-balk */}
      <div style={{ display:'flex', overflowX:'auto', borderBottom:'1px solid #2a2a2a', background:'#1a1a1a', WebkitOverflowScrolling:'touch' }}>
        {visibleTabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: visibleTabs.length <= 4 ? 1 : undefined,
              flexShrink: 0,
              minWidth: '70px',
              padding: '14px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid #c0392b' : '2px solid transparent',
              color: tab === t ? '#fff' : '#777',
              fontWeight: tab === t ? '700' : '400',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '5px',
            }}>
            {TAB_LABELS[t]}
            {t === 'schulden' && heeftOpenSales && (
              <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#e74c3c', display:'inline-block', flexShrink:0 }} />
            )}
          </button>
        ))}
      </div>

      {/* Tab-inhoud */}
      <div style={{ padding: tab === 'kassa' ? '12px 16px 0' : '16px' }}>
        {tab === 'kassa'     && <KassaTab     products={products} profiel={profiel} />}
        {tab === 'stock'     && <StockTab     products={products} />}
        {tab === 'producten' && <ProductenTab products={products} />}
        {tab === 'schulden'  && <SchuldenTab  openSales={openSales} />}
      </div>
    </div>
  );
}
