import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { fmtBedrag } from '../components/winkel/winkelData';
import KassaTab from '../components/winkel/KassaTab';
import StockTab from '../components/winkel/StockTab';
import ProductenTab from '../components/winkel/ProductenTab';
import OverzichtTab from '../components/winkel/OverzichtTab';
import VerkoopmomentenTab from '../components/winkel/VerkoopmomentenTab';
import { C, cardStyle } from '../styles/tokens';

export default function Winkel() {
  const { profiel, isBeheerder, isTrainer } = useAuth();
  const [activeSection, setActiveSection] = useState(null);
  const [stockSubTab, setStockSubTab] = useState('stock');
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
      snap => setOpenSales(
        snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => !s.geannuleerd)
      ),
      () => setOpenSales([])
    );
    // getDocs i.p.v. onSnapshot: historisch verkoopoverzicht hoeft niet live te zijn.
    // openSales (hierboven) dekt de live kassastatus al volledig.
    getDocs(query(collection(db, 'sales'), orderBy('aangemaaktOp', 'desc')))
      .then(snap => setAllSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setAllSales([]));
    const unsubAllSales = null;
    // getDocs i.p.v. onSnapshot: verkoopmomenten wijzigen zelden tijdens een sessie.
    getDocs(query(collection(db, 'verkoopmomenten'), orderBy('createdAt', 'desc')))
      .then(snap => setVerkoopmomenten(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setVerkoopmomenten([]));
    const unsubVerkoopmomenten = null;
    return () => {
      unsubProducts();
      unsubOpenSales();
      // unsubAllSales en unsubVerkoopmomenten zijn getDocs, geen cleanup nodig
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

  // Live stats voor de kaartjes
  const schuldenCount = openSales.length;
  const schuldenTotaal = openSales.reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);
  const leegCount = products.filter(p => p.active !== false && (p.stock || 0) <= 0).length;
  const laagCount = products.filter(p => p.active !== false && (p.stock || 0) > 0 && (p.stock || 0) < 3).length;
  const actieveMoment = verkoopmomenten.find(v => v.status === 'actief');
  const openVerkoopTotaal = allSales
    .filter(s => !s.geannuleerd && !s.betaald)
    .reduce((sum, s) => sum + (s.totaal || s.total || 0), 0);

  // Welke secties zijn zichtbaar voor deze gebruiker
  const sections = useMemo(() => {
    const list = [
      {
        id: 'kassa',
        icon: '🧾',
        label: 'Kassa',
        desc: 'Producten verkopen & afrekenen',
        accentColor: C.red,
        accentDim: C.redDim,
      },
    ];
    if (isTrainer) {
      list.push({
        id: 'stock',
        icon: '📦',
        label: isBeheerder ? 'Stock & Producten' : 'Stock',
        desc: isBeheerder ? 'Voorraadbeheer & assortiment' : 'Voorraad bekijken',
        accentColor: C.blue,
        accentDim: C.blueDim,
      });
    }
    if (isBeheerder) {
      list.push(
        {
          id: 'overzicht',
          icon: '📊',
          label: 'Verkoopoverzicht',
          desc: 'Historiek & rapporten',
          accentColor: C.green,
          accentDim: C.greenDim,
        },
        {
          id: 'afsluiting',
          icon: '⚙️',
          label: 'Afsluiting',
          desc: 'Verkoopmomenten beheren',
          accentColor: C.purple,
          accentDim: C.purpleDim,
        }
      );
    }
    return list;
  }, [isBeheerder, isTrainer]);

  function getBadge(id) {
    if (id === 'kassa' && schuldenCount > 0) {
      return { text: `${schuldenCount} schuld${schuldenCount !== 1 ? 'en' : ''} · ${fmtBedrag(schuldenTotaal)}`, color: C.orange };
    }
    if (id === 'stock') {
      if (leegCount > 0) return { text: `${leegCount} uitverkocht`, color: C.red };
      if (laagCount > 0) return { text: `${laagCount} laag`, color: C.orange };
      return { text: 'Stock OK', color: C.green };
    }
    if (id === 'overzicht' && openVerkoopTotaal > 0) {
      return { text: `${fmtBedrag(openVerkoopTotaal)} openstaand`, color: C.orange };
    }
    if (id === 'afsluiting') {
      if (actieveMoment) return { text: actieveMoment.naam, color: C.green };
      return { text: 'Geen actief moment', color: C.textMuted };
    }
    return null;
  }

  // ── Sectie-scherm (na klik op kaartje) ──────────────────────────────────────
  if (activeSection) {
    const sec = sections.find(s => s.id === activeSection);

    return (
      <div>
        <button
          onClick={() => setActiveSection(null)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: C.textSec,
            cursor: 'pointer', fontSize: '14px', fontWeight: '600',
            padding: '0 0 14px 0',
          }}
        >
          ← Winkel
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px',
            background: sec?.accentDim || C.redDim,
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>
            {sec?.icon}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.2 }}>
              {sec?.label}
            </h2>
            <div style={{ fontSize: '12px', color: C.textSec, marginTop: '2px' }}>{sec?.desc}</div>
          </div>
        </div>

        {activeSection === 'kassa' && (
          <KassaTab
            products={products}
            profiel={profiel}
            verkoopmomenten={verkoopmomenten}
            activeEvent={activeEvent}
            activeEventId={activeEventId}
            setActiveEventId={setActiveEventId}
            openSales={openSales}
          />
        )}

        {activeSection === 'stock' && (
          <>
            {isBeheerder && (
              <div style={{
                display: 'flex', gap: 0,
                borderBottom: `1px solid ${C.borderSoft}`,
                marginBottom: '16px',
              }}>
                {[
                  { id: 'stock', icon: '📦', label: 'Stock' },
                  { id: 'producten', icon: '🏷️', label: 'Producten' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setStockSubTab(t.id)}
                    style={{
                      background: 'none', border: 'none',
                      borderBottom: stockSubTab === t.id
                        ? `2px solid ${C.blue}`
                        : '2px solid transparent',
                      color: stockSubTab === t.id ? C.textPrimary : C.textMuted,
                      padding: '10px 18px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: stockSubTab === t.id ? '800' : '500',
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
            )}
            {(!isBeheerder || stockSubTab === 'stock') && (
              <StockTab products={products} profiel={profiel} readOnly={!isBeheerder} />
            )}
            {isBeheerder && stockSubTab === 'producten' && (
              <ProductenTab products={products} />
            )}
          </>
        )}

        {activeSection === 'overzicht' && (
          <OverzichtTab
            allSales={allSales}
            profiel={profiel}
            verkoopmomenten={verkoopmomenten}
          />
        )}

        {activeSection === 'afsluiting' && (
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

  // ── Home: Icon Grid ──────────────────────────────────────────────────────────
  return (
    <div>
      <section style={{ ...cardStyle({ gradient: true }), marginBottom: '24px' }}>
        <h1 style={{
          margin: '0 0 4px',
          fontSize: 'clamp(22px,5vw,30px)',
          fontWeight: 900,
          color: C.textPrimary,
        }}>
          🛒 Winkel
        </h1>
        <p style={{ margin: 0, color: C.textSec, fontSize: '13px' }}>
          Kassa, stock, producten en beheer
        </p>
      </section>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '14px',
      }}>
        {sections.map(sec => {
          const badge = getBadge(sec.id);
          return (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id)}
              style={{
                background: C.card,
                border: `1px solid ${C.borderSoft}`,
                borderRadius: '20px',
                padding: '20px 16px',
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '14px',
                minHeight: '160px',
                transition: 'background 0.15s, border-color 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Accent gloed in de hoek */}
              <div style={{
                position: 'absolute', top: 0, right: 0,
                width: '80px', height: '80px',
                background: `radial-gradient(circle at top right, ${sec.accentDim}, transparent 70%)`,
                pointerEvents: 'none',
              }} />

              <div style={{
                width: '54px', height: '54px',
                background: sec.accentDim,
                borderRadius: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '28px',
                flexShrink: 0,
              }}>
                {sec.icon}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '17px', fontWeight: '800',
                  color: C.textPrimary, lineHeight: 1.2,
                  marginBottom: '4px',
                }}>
                  {sec.label}
                </div>
                <div style={{ fontSize: '12px', color: C.textSec, lineHeight: 1.4 }}>
                  {sec.desc}
                </div>
              </div>

              {badge && (
                <div style={{
                  background: badge.color === C.green
                    ? C.greenDim
                    : badge.color === C.red
                      ? C.redDim
                      : badge.color === C.orange
                        ? C.orangeDim
                        : 'rgba(100,116,139,0.14)',
                  border: `1px solid ${badge.color}`,
                  color: badge.color,
                  borderRadius: '8px',
                  padding: '4px 9px',
                  fontSize: '11px',
                  fontWeight: '700',
                  lineHeight: 1.3,
                }}>
                  {badge.text}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
