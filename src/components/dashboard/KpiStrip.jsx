// Admin-stats strip — toont 4 KPI-tegels (alleen voor admin/bestuurslid)
// - Actieve leden
// - Trainingen deze week
// - Komende examens (30 dagen)
// - Komende wedstrijden (30 dagen)

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';

function maandagVanDezeWeek() {
  const d = new Date();
  const dag = (d.getDay() + 6) % 7; // 0 = Maandag
  d.setDate(d.getDate() - dag);
  return d.toISOString().slice(0, 10);
}
function zondagVanDezeWeek() {
  const d = new Date();
  const dag = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dag + 6);
  return d.toISOString().slice(0, 10);
}
function isoOverDagen(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function KpiTegel({ label, waarde, sub, kleur, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: '1 1 0',
        minWidth: '140px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderTop: `3px solid ${kleur}`,
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        fontFamily: 'inherit',
        color: 'inherit',
        transition: 'transform 0.1s, border-color 0.1s',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.borderTopColor = 'var(--accent-red)'; }}
      onMouseLeave={e => { if (onClick) e.currentTarget.style.borderTopColor = kleur; }}
    >
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '26px', fontWeight: '800', lineHeight: '1.1', color: 'var(--text-primary)' }}>
        {waarde}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {sub}
        </div>
      )}
    </button>
  );
}

export default function KpiStrip() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ leden: null, trainingenWeek: null, examens30d: null, wedstrijden30d: null });

  useEffect(() => {
    let actief = true;

    async function laad() {
      const maandag = maandagVanDezeWeek();
      const zondag  = zondagVanDezeWeek();
      const over30  = isoOverDagen(30);
      const vandaag = new Date().toISOString().slice(0, 10);

      const taken = {
        // Telt actieve leden net als de Ledenpagina: een lid zonder `actief`-veld
        // (bv. geïmporteerd) geldt als actief. Een Firestore `!= false`-query zou
        // die documenten missen, vandaar dat we client-side filteren.
        leden: getDocs(collection(db, 'members')).then(snap => {
          let actief = 0;
          snap.docs.forEach(d => {
            if (d.data().actief !== false) actief++;
          });
          return actief;
        }).catch(() => null),
        // Eén week valt volledig binnen één seizoen, dus de datum-range volstaat.
        // Geen seizoen-filter → geen composite index nodig (robuuster).
        trainingenWeek: getDocs(query(
          collection(db, 'trainingen'),
          where('datum', '>=', maandag),
          where('datum', '<=', zondag),
        )).then(snap => snap.size).catch(() => null),
        // Type client-side filteren i.p.v. in de query, zodat de datum-range geen
        // composite index (datum + type) vereist die anders stil zou kunnen falen.
        events: getDocs(query(collection(db, 'events'), where('datum', '>=', vandaag), where('datum', '<=', over30))).then(snap => {
          let examens = 0, wedstrijden = 0;
          snap.docs.forEach(d => {
            const e = d.data();
            
            if (e.type === 'examen')    examens++;
            if (e.type === 'wedstrijd') wedstrijden++;
          });
          return { examens, wedstrijden };
        }).catch(() => ({ examens: null, wedstrijden: null })),
      };

      const [leden, trainingenWeek, events] = await Promise.all([taken.leden, taken.trainingenWeek, taken.events]);
      if (!actief) return;
      setStats({
        leden,
        trainingenWeek,
        examens30d:     events?.examens,
        wedstrijden30d: events?.wedstrijden,
      });
    }

    laad();
    return () => { actief = false; };
  }, []);

  const fmt = (v) => v === null || v === undefined ? '…' : v;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      <KpiTegel
        label="Leden"
        waarde={fmt(stats.leden)}
        sub="actief"
        kleur="#2980b9"
        onClick={() => navigate('/leden')}
      />
      <KpiTegel
        label="Trainingen"
        waarde={fmt(stats.trainingenWeek)}
        sub="deze week"
        kleur="#27ae60"
        onClick={() => navigate('/trainingen')}
      />
      <KpiTegel
        label="Examens"
        waarde={fmt(stats.examens30d)}
        sub="komende 30 dagen"
        kleur="#8e44ad"
        onClick={() => navigate('/examens')}
      />
      <KpiTegel
        label="Wedstrijden"
        waarde={fmt(stats.wedstrijden30d)}
        sub="komende 30 dagen"
        kleur="#e67e22"
        onClick={() => navigate('/wedstrijden')}
      />
    </div>
  );
}
