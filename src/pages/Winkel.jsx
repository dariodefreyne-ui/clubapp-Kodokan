import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { TABS, TAB_LABELS } from '../components/winkel/winkelData';
import KassaTab from '../components/winkel/KassaTab';
import StockTab from '../components/winkel/StockTab';
import ProductenTab from '../components/winkel/ProductenTab';
import SchuldenTab from '../components/winkel/SchuldenTab';
import OverzichtTab from '../components/winkel/OverzichtTab';

export default function Winkel() {
  const { profiel, isBeheerder } = useAuth();
  const [tab, setTab] = useState('kassa');
  const [products, setProducts] = useState([]);
  const [openSales, setOpenSales] = useState([]);
  const [allSales, setAllSales] = useState([]);

  useEffect(() => {
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), orderBy('category'), orderBy('variant')),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );

    const unsubOpenSales = onSnapshot(
      query(collection(db, 'sales'), where('betaald', '==', false)),
      snap => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => !s.geannuleerd);
        setOpenSales(data);
      },
      () => {}
    );

    const unsubAllSales = onSnapshot(
      query(collection(db, 'sales'), orderBy('aangemaaktOp', 'desc')),
      snap => setAllSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );

    return () => {
      unsubProducts();
      unsubOpenSales();
      unsubAllSales();
    };
  }, []);

  const visibleTabs = isBeheerder ? TABS : ['kassa'];
  const heeftOpenSales = openSales.length > 0;

  return (
    <div>
      <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid #2a2a2a', marginBottom: '16px', WebkitOverflowScrolling: 'touch' }}>
        {visibleTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
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
            }}
          >
            {TAB_LABELS[t]}
            {t === 'schulden' && heeftOpenSales && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#e74c3c', display: 'inline-block' }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'kassa' && <KassaTab products={products} profiel={profiel} />}
      {tab === 'stock' && <StockTab products={products} />}
      {tab === 'producten' && <ProductenTab products={products} />}
      {tab === 'schulden' && <SchuldenTab openSales={openSales} />}
      {tab === 'overzicht' && <OverzichtTab allSales={allSales} profiel={profiel} />}
    </div>
  );
}
