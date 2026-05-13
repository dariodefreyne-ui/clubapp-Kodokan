//
import React, { useEffect, useMemo, useState } from 'react';
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
import VerkoopmomentenTab from '../components/winkel/VerkoopmomentenTab';
import { C, cardStyle, tabBarStyle, tabButtonStyle } from '../styles/tokens';

export default function Winkel() {
  const { profiel, isBeheerder, isTrainer } = useAuth();
  const [tab, setTab] = useState('kassa');
  const [products, setProducts] = useState([]);
  const [openSales, setOpenSales] = useState([]);
  const [allSales, setAllSales] = useState([]);
  const [verkoopmomenten, setVerkoopmomenten] = useState([]);
  const [activeEventId, setActiveEventId] = useState('');

  useEffect(() => {
    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), orderBy('category'), orderBy('variant')),
      snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setProducts([])
    );

    const unsubOpenSales = onSnapshot(
      query(collection(db, 'sales'), where('betaald', '==', false)),
      snap => {
        const data = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => !s.geannuleerd);
        setOpenSales(data);
      },
      () => setOpenSales([])
    );

    const unsubAllSales = onSnapshot(
      query(collection(db, 'sales'), orderBy('aangemaaktOp', 'desc')),
      snap => setAllSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setAllSales([])
    );

    const unsubVerkoopmomenten = onSnapshot(
      query(collection(db, 'verkoopmomenten'), orderBy('createdAt', 'desc')),
      snap => setVerkoopmomenten(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => setVerkoopmomenten([])
    );

    return () => {
      unsubProducts();
      unsubOpenSales();
      unsubAllSales();
      unsubVerkoopmomenten();
    };
  }, []);

  useEffect(() => {
    if (activeEventId) return;
    const actief = verkoopmomenten.find(v => v.status === 'actief');
    if (actief) setActiveEventId(actief.id);
  }, [activeEventId, verkoopmomenten]);

  const activeEvent = useMemo(
    () => verkoopmomenten.find(v => v.id === activeEventId) || null,
    [activeEventId, verkoopmomenten]
  );

  const baseTabs = isBeheerder ? TABS : isTrainer ? ['kassa', 'stock'] : ['kassa'];
  const visibleTabs = isBeheerder ? [...baseTabs, 'verkoopmomenten'] : baseTabs;
  const tabLabels = { ...TAB_LABELS, verkoopmomenten: 'Afsluiting' };
  const heeftOpenSales = openSales.length > 0;

  return (
    <div>
      <section style={{ ...cardStyle({ gradient: true }), marginBottom: '16px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(22px,5vw,30px)', fontWeight: 900, color: C.textPrimary }}>🛒 Winkel</h1>
        <p style={{ margin: 0, color: C.textSec, fontSize: '13px' }}>Kassa, stock, producten, schulden en verkoopmomenten</p>
      </section>
      <div style={tabBarStyle}>
        {visibleTabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...tabButtonStyle(tab === t), flex: visibleTabs.length <= 4 ? 1 : undefined, flexShrink: 0, minWidth: '82px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
          >
            {tabLabels[t] || t}
            {t === 'schulden' && heeftOpenSales && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)', display: 'inline-block' }} />
            )}
          </button>
        ))}
      </div>

      {tab === 'kassa' && (
        <KassaTab
          products={products}
          profiel={profiel}
          verkoopmomenten={verkoopmomenten}
          activeEvent={activeEvent}
          activeEventId={activeEventId}
          setActiveEventId={setActiveEventId}
        />
      )}
      {tab === 'stock' && <StockTab products={products} profiel={profiel} />}
      {tab === 'producten' && <ProductenTab products={products} />}
      {tab === 'schulden' && <SchuldenTab openSales={openSales} profiel={profiel} />}
      {tab === 'overzicht' && <OverzichtTab allSales={allSales} profiel={profiel} verkoopmomenten={verkoopmomenten} />}
      {tab === 'verkoopmomenten' && (
        <VerkoopmomentenTab
          verkoopmomenten={verkoopmomenten}
          allSales={allSales}
          profiel={profiel}
          activeEventId={activeEventId}
          setActiveEventId={setActiveEventId}
        />
      )}
    </div>
  );
}
