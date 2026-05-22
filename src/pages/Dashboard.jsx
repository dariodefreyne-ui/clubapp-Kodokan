// src/pages/Dashboard.jsx
// Personal Dashboard met layout-toggle:
//   A) Agenda Hero — maandkalender groot + zijbalk (eerstvolgende, komende, snelkoppelingen, berichten)
//   B) Bento Grid  — week-strip volle breedte + drie tegels eronder
// Voor admin/bestuurslid: KPI-strip bovenaan met clubcijfers.
// Voorkeur wordt lokaal opgeslagen in localStorage.
import React, { useEffect, useState } from 'react';
import {
  doc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { C, cardStyle } from '../styles/tokens';
import { ALLE_PAGINAS, ROL_STANDAARD_PAGINAS } from '../config/appConfig';
import useMediaQuery from '../hooks/useMediaQuery';
import KpiStrip from '../components/dashboard/KpiStrip';
import LayoutAgendaHero from '../components/dashboard/LayoutAgendaHero';
import LayoutBento from '../components/dashboard/LayoutBento';
import TrainingDetailPanel from '../components/details/TrainingDetailPanel';
import WedstrijdDetailPanel from '../components/details/WedstrijdDetailPanel';
import ExamenDetailPanel from '../components/details/ExamenDetailPanel';
import EvenementDetailPanel from '../components/details/EvenementDetailPanel';
import DetailModal from '../components/details/DetailModal';

const LAYOUT_STORAGE_KEY = 'dashboardLayout';
const ALLE_PAGINAS_LIJST = ALLE_PAGINAS.map(p => p.pad);

const QUICK_ACTIONS = {
  admin:       [{ pad: '/leden', label: 'Leden', icon: '👥' }, { pad: '/beheer', label: 'Beheer', icon: '🔧' }, { pad: '/communicatie', label: 'Communicatie', icon: '📣' }, { pad: '/rapporten', label: 'Rapporten', icon: '📊' }],
  bestuurslid: [{ pad: '/leden', label: 'Leden', icon: '👥' }, { pad: '/beheer', label: 'Beheer', icon: '🔧' }, { pad: '/communicatie', label: 'Communicatie', icon: '📣' }, { pad: '/winkel', label: 'Winkel', icon: '🛒' }],
  trainer:     [{ pad: '/trainingen', label: 'Trainingen', icon: '🥋' }, { pad: '/leden', label: 'Leden', icon: '👥' }, { pad: '/communicatie', label: 'Communicatie', icon: '📣' }, { pad: '/winkel', label: 'Winkel', icon: '🛒' }],
  lid:         [{ pad: '/agenda', label: 'Agenda', icon: '📅' }, { pad: '/wedstrijden', label: 'Wedstrijden', icon: '🏆' }, { pad: '/examens', label: 'Examens', icon: '📘' }, { pad: '/profiel', label: 'Mijn profiel', icon: '👤' }],
};

function QuickActions({ rol, beschikbarePaginas }) {
  const navigate = useNavigate();
  const acties = (QUICK_ACTIONS[rol] || QUICK_ACTIONS.lid)
    .filter(a => beschikbarePaginas.includes(a.pad));
  if (acties.length === 0) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(acties.length, 4)}, 1fr)`, gap: '10px', marginBottom: '16px' }}>
      {acties.map(a => (
        <button key={a.pad} onClick={() => navigate(a.pad)} style={{
          background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '12px',
          padding: '14px 10px', cursor: 'pointer', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          color: C.textPrimary, transition: 'background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
          onMouseLeave={e => e.currentTarget.style.background = C.card}
        >
          <span style={{ fontSize: '24px' }}>{a.icon}</span>
          <span style={{ fontSize: '11px', fontWeight: '600', color: C.textSec }}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

function LayoutToggle({ value, onChange }) {
  const knop = (id, label) => {
    const actief = value === id;
    return (
      <button
        onClick={() => onChange(id)}
        style={{
          background: actief ? 'var(--accent-red)' : 'var(--bg-primary)',
          border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`,
          color: 'var(--text-primary)',
          padding: '6px 12px',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-xs)',
          fontWeight: actief ? '700' : '500',
          fontFamily: 'inherit',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginRight: '4px' }}>Layout:</span>
      {knop('hero', 'Agenda Hero')}
      {knop('bento', 'Bento')}
    </div>
  );
}

export default function Dashboard() {
  const { profiel, isBeheerder } = useAuth();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const [beschikbarePaginas, setBeschikbarePaginas] = useState([]);
  const [favorieten, setFavorieten] = useState([]);
  const [voorkeursLaden, setVoorkeursLaden] = useState(true);
  const [actiefDetail, setActiefDetail] = useState(null);
  const [berichtModal, setBerichtModal] = useState(null);
  const [layout, setLayout] = useState(() => {
    if (typeof window === 'undefined') return 'hero';
    return localStorage.getItem(LAYOUT_STORAGE_KEY) || 'hero';
  });

  const rol = profiel?.rol ?? 'trainer';
  const naam = profiel?.naam || profiel?.email || 'Judo';
  const uur = new Date().getHours();
  const begroeting = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';

  useEffect(() => {
    if (!profiel?.uid) return;

    Promise.all([
      getDoc(doc(db, 'instellingen', 'paginaRollen')),
      getDoc(doc(db, 'users', profiel.uid)),
    ]).then(([rolSnap, userSnap]) => {
      let paginas;
      if (rol === 'admin') {
        paginas = ALLE_PAGINAS_LIJST;
      } else {
        const rolConfig = rolSnap.exists() ? rolSnap.data() : ROL_STANDAARD_PAGINAS;
        paginas = rolConfig[rol] || [];
      }
      setBeschikbarePaginas(paginas);

      const opgeslagen = userSnap.data()?.dashboardVolgorde || [];
      setFavorieten(opgeslagen.filter(p => paginas.includes(p)));

      setVoorkeursLaden(false);
    }).catch(() => setVoorkeursLaden(false));
  }, [profiel?.uid, rol]);

  const slaFavorietenOp = async (nieuweFavorieten) => {
    setFavorieten(nieuweFavorieten);
    if (!profiel?.uid) return;
    await setDoc(doc(db, 'users', profiel.uid), {
      dashboardVolgorde: nieuweFavorieten,
      bijgewerkt: serverTimestamp(),
    }, { merge: true });
  };

  const wijzigLayout = (nieuw) => {
    setLayout(nieuw);
    try { localStorage.setItem(LAYOUT_STORAGE_KEY, nieuw); } catch (_) { /* ignore */ }
  };

  if (voorkeursLaden) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>
      </div>
    );
  }

  const isAgendaZichtbaar = beschikbarePaginas.includes('/agenda');
  const isCommunicatieZichtbaar = beschikbarePaginas.includes('/communicatie');

  const layoutProps = {
    profiel,
    beschikbarePaginas,
    favorieten,
    onWijzigFavorieten: slaFavorietenOp,
    onItemKlik: setActiefDetail,
    onBerichtKlik: setBerichtModal,
    isAgendaZichtbaar,
    isCommunicatieZichtbaar,
    isDesktop,
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--space-4)' }}>

      {/* Begroeting + layout-toggle */}
      <div style={{ ...cardStyle({ gradient: true }), marginBottom: 'var(--space-4)', display: 'flex', flexDirection: isDesktop ? 'row' : 'column', alignItems: isDesktop ? 'center' : 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
        <div>
          <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '800', marginBottom: 'var(--space-1)' }}>
            {begroeting}, {naam.split(' ')[0]} 👋
          </div>
          <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
            {' · '}
            <span style={{ color: 'var(--accent-red)', fontWeight: '600', textTransform: 'capitalize' }}>{rol}</span>
          </div>
        </div>
        <LayoutToggle value={layout} onChange={wijzigLayout} />
      </div>

      {/* Snelkoppelingen per rol */}
      <QuickActions rol={rol} beschikbarePaginas={beschikbarePaginas} />

      {/* KPI-strip voor admin/bestuurslid */}
      {isBeheerder && <KpiStrip />}

      {/* Layout A of B */}
      {layout === 'bento' ? <LayoutBento {...layoutProps} /> : <LayoutAgendaHero {...layoutProps} />}

      {/* Detail-panels */}
      {actiefDetail?.type === 'training' && (
        <TrainingDetailPanel trainingId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {actiefDetail?.type === 'wedstrijd' && (
        <WedstrijdDetailPanel eventId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {actiefDetail?.type === 'examen' && (
        <ExamenDetailPanel eventId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {actiefDetail?.type === 'evenement' && (
        <EvenementDetailPanel evenementId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {berichtModal && (
        <DetailModal open={true} onClose={() => setBerichtModal(null)} title={berichtModal.title} accentKleur={C.red}>
          <div style={{ whiteSpace: 'pre-wrap', color: C.textPrimary }}>{berichtModal.body}</div>
        </DetailModal>
      )}
    </div>
  );
}
