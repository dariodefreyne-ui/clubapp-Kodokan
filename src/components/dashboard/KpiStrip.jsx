// Admin-stats strip — toont 4 KPI-tegels (alleen voor admin/bestuurslid)
// - Actieve leden
// - Trainingen deze week
// - Komende examens (30 dagen)
// - Komende wedstrijden (30 dagen)

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getCountFromServer, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import useAgendaItems from '../../hooks/useAgendaItems';
import { isDoorgaand } from '../trainingen/trainingStatus';

// Lokale datums (toISOString verschuift naar UTC: tussen 00:00 en 02:00 gaf dat de vorige dag)
function lokaalISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoOverDagen(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return lokaalISO(d);
}
function maandagVanDezeWeek() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return lokaalISO(d);
}
function zondagVanDezeWeek() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 6);
  return lokaalISO(d);
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
  const { profiel } = useAuth();
  const [leden, setLeden] = useState(null);

  const maandag = maandagVanDezeWeek();
  const zondag  = zondagVanDezeWeek();
  const vandaag = isoOverDagen(0);
  const over30  = isoOverDagen(30);

  // Trainingen/examens/wedstrijden komen uit de gedeelde dashboard-store (0 extra reads):
  // zelfde bron van waarheid als de agenda-widgets (status via bepaalTrainingStatus + isDoorgaand,
  // markers en groepen uit clubinstellingen/configCache).
  const { items, laden } = useAgendaItems({ profiel, alleenVanaf: maandag, alleenTot: over30, gedeeld: true });

  const stats = useMemo(() => {
    if (laden) return { trainingenWeek: null, examens30d: null, wedstrijden30d: null };
    let trainingenWeek = 0, examens30d = 0, wedstrijden30d = 0;
    items.forEach(i => {
      if (i.bron === 'trainingen') {
        if (i.datum >= maandag && i.datum <= zondag && isDoorgaand(i.status)) trainingenWeek++;
      } else if (i.bron === 'events' && i.datum >= vandaag && i.datum <= over30) {
        if (i.type === 'examen') examens30d++;
        if (i.type === 'wedstrijd') wedstrijden30d++;
      }
    });
    return { trainingenWeek, examens30d, wedstrijden30d };
  }, [items, laden, maandag, zondag, vandaag, over30]);

  useEffect(() => {
    let actief = true;
    // Telt actieve leden net als de Ledenpagina: een lid zonder `actief`-veld
    // (bv. geïmporteerd) geldt als actief. Een Firestore `!= false`-query zou
    // die documenten missen, vandaar de aftrek van de inactieve leden.
    (async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'club'));
        if (settingsSnap.exists() && typeof settingsSnap.data().ledenCount === 'number') {
          return settingsSnap.data().ledenCount;
        }
      } catch { /* doorval naar fallback */ }
      // Fallback: aggregatie-queries i.p.v. een volledige collectie-read.
      const [totaalSnap, inactiefSnap] = await Promise.all([
        getCountFromServer(collection(db, 'members')),
        getCountFromServer(query(collection(db, 'members'), where('actief', '==', false))),
      ]);
      return totaalSnap.data().count - inactiefSnap.data().count;
    })().catch(() => null).then(n => { if (actief) setLeden(n); });
    return () => { actief = false; };
  }, []);

  const fmt = (v) => v === null || v === undefined ? '…' : v;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
      <KpiTegel
        label="Leden"
        waarde={fmt(leden)}
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
