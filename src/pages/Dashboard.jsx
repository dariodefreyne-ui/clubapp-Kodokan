// src/pages/Dashboard.jsx
// Personal Dashboard met layout-toggle:
//   A) Agenda Hero — maandkalender groot + zijbalk (eerstvolgende, komende, snelkoppelingen, berichten)
//   B) Bento Grid  — week-strip volle breedte + drie tegels eronder
// Voor admin/bestuurslid: KPI-strip bovenaan met clubcijfers.
// Voorkeur wordt lokaal opgeslagen in localStorage.
import React, { useEffect, useState } from 'react';
import {
  doc, getDoc, setDoc, serverTimestamp, arrayUnion,
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
const PAGINA_META = Object.fromEntries(ALLE_PAGINAS.map(p => [p.pad, p]));

// Standaard-snelkoppelingen per rol (gebruikt tot de gebruiker zelf kiest)
const STANDAARD_SNELKOPPELINGEN = {
  admin:       ['/leden', '/beheer', '/communicatie', '/rapporten'],
  bestuurslid: ['/leden', '/beheer', '/communicatie', '/winkel'],
  trainer:     ['/trainingen', '/leden', '/communicatie', '/winkel'],
  assistent:   ['/trainingen', '/uitbetalingen', '/agenda', '/profiel'],
  lid:         ['/agenda', '/wedstrijden', '/examens', '/profiel'],
};

const MAX_SNELKOPPELINGEN = 4;

function QuickActions({ snelkoppelingen, onBewerk }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'stretch' }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.max(Math.min(snelkoppelingen.length, MAX_SNELKOPPELINGEN), 1)}, 1fr)`, gap: '10px' }}>
        {snelkoppelingen.length === 0 ? (
          <button onClick={onBewerk} style={{
            background: C.card, border: `1px dashed ${C.borderSoft}`, borderRadius: '12px',
            padding: '14px 10px', cursor: 'pointer', color: C.textSec, fontSize: '13px', fontWeight: '600', fontFamily: 'inherit',
          }}>
            + Kies je snelkoppelingen
          </button>
        ) : snelkoppelingen.map(pad => {
          const m = PAGINA_META[pad];
          if (!m) return null;
          return (
            <button key={pad} onClick={() => navigate(pad)} style={{
              background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '12px',
              padding: '14px 10px', cursor: 'pointer', textAlign: 'center',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              color: C.textPrimary, transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.cardHover}
              onMouseLeave={e => e.currentTarget.style.background = C.card}
            >
              <span style={{ fontSize: '24px' }}>{m.icon}</span>
              <span style={{ fontSize: '11px', fontWeight: '600', color: C.textSec }}>{m.label}</span>
            </button>
          );
        })}
      </div>
      <button onClick={onBewerk} title="Snelkoppelingen bewerken" aria-label="Snelkoppelingen bewerken" style={{
        flexShrink: 0, width: '44px', background: C.card, border: `1px solid ${C.borderSoft}`,
        borderRadius: '12px', cursor: 'pointer', color: C.textSec, fontSize: '18px', fontFamily: 'inherit',
      }}>✏️</button>
    </div>
  );
}

function SnelkoppelingenBewerk({ open, onClose, beschikbarePaginas, gekozen, onBewaar }) {
  const [sel, setSel] = useState(gekozen);
  useEffect(() => { if (open) setSel(gekozen); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const kiesbaar = beschikbarePaginas.filter(p => p !== '/' && PAGINA_META[p]);
  const toggle = (pad) => setSel(prev =>
    prev.includes(pad) ? prev.filter(p => p !== pad) : (prev.length >= MAX_SNELKOPPELINGEN ? prev : [...prev, pad]));

  if (!open) return null;
  return (
    <DetailModal open={open} onClose={onClose} title="Snelkoppelingen kiezen" accentKleur={C.red}>
      <div style={{ fontSize: '13px', color: C.textSec, marginBottom: '12px' }}>
        Kies tot {MAX_SNELKOPPELINGEN} snelkoppelingen ({sel.length}/{MAX_SNELKOPPELINGEN}).
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
        {kiesbaar.map(pad => {
          const m = PAGINA_META[pad];
          const actief = sel.includes(pad);
          const vol = !actief && sel.length >= MAX_SNELKOPPELINGEN;
          return (
            <button key={pad} onClick={() => toggle(pad)} disabled={vol} style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%', textAlign: 'left',
              padding: '12px 14px', borderRadius: '10px', cursor: vol ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              background: actief ? 'rgba(220,38,38,0.12)' : C.card,
              border: `1px solid ${actief ? C.red : C.borderSoft}`,
              color: vol ? C.textMuted : C.textPrimary, opacity: vol ? 0.5 : 1,
            }}>
              <span style={{ fontSize: '20px' }}>{m.icon}</span>
              <span style={{ flex: 1, fontSize: '14px', fontWeight: actief ? '700' : '500' }}>{m.label}</span>
              {actief && <span style={{ color: C.red }}>✓</span>}
            </button>
          );
        })}
      </div>
      <button onClick={() => { onBewaar(sel); onClose(); }} style={{
        width: '100%', padding: '12px', borderRadius: '10px', border: 'none', cursor: 'pointer',
        background: C.red, color: '#fff', fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
      }}>Bewaren</button>
    </DetailModal>
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
  const navigate = useNavigate();

  const [beschikbarePaginas, setBeschikbarePaginas] = useState([]);
  const [favorieten, setFavorieten] = useState([]);
  const [voorkeursLaden, setVoorkeursLaden] = useState(true);
  const [actiefDetail, setActiefDetail] = useState(null);
  const [berichtModal, setBerichtModal] = useState(null);
  const [bewerkOpen, setBewerkOpen] = useState(false);
  const [gelezen, setGelezen] = useState(new Set());
  const [berichtenOngelezen, setBerichtenOngelezen] = useState({ aantal: 0, eerste: null, lijst: [] });
  const [bannerOpen, setBannerOpen] = useState(false);
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
        paginas = rolConfig[rol] || ROL_STANDAARD_PAGINAS[rol] || [];
      }
      setBeschikbarePaginas(paginas);

      const opgeslagen = userSnap.data()?.dashboardVolgorde || [];
      setFavorieten(opgeslagen.filter(p => paginas.includes(p)));
      setGelezen(new Set(userSnap.data()?.gelezenBerichten || []));

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

  const markeerGelezen = (id) => {
    if (!id) return;
    setGelezen(prev => { if (prev.has(id)) return prev; const n = new Set(prev); n.add(id); return n; });
    if (!profiel?.uid) return;
    setDoc(doc(db, 'users', profiel.uid), {
      gelezenBerichten: arrayUnion(id),
      bijgewerkt: serverTimestamp(),
    }, { merge: true }).catch(() => { /* lokaal blijft gemarkeerd */ });
  };

  // Standaard-snelkoppelingen tot de gebruiker zelf kiest
  const standaardPaden = STANDAARD_SNELKOPPELINGEN[rol] || STANDAARD_SNELKOPPELINGEN.lid;
  const gekozenPaden = favorieten.length ? favorieten : standaardPaden;
  const snelkoppelingen = gekozenPaden.filter(p => beschikbarePaginas.includes(p) && p !== '/').slice(0, MAX_SNELKOPPELINGEN);

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
    onItemKlik: setActiefDetail,
    onBerichtKlik: setBerichtModal,
    gelezen,
    onMarkeerGelezen: markeerGelezen,
    onBerichtenUnread: setBerichtenOngelezen,
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

      {/* Banner: ongelezen clubberichten */}
      {isCommunicatieZichtbaar && berichtenOngelezen.aantal > 0 && (
        <div style={{ marginBottom: 'var(--space-4)', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${C.red}`, background: 'rgba(220,38,38,0.07)' }}>
          <button
            onClick={() => setBannerOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
              padding: '12px 14px', cursor: 'pointer',
              background: 'transparent', border: 'none', color: C.textPrimary, fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: '18px' }}>📨</span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: '600' }}>
              Je hebt {berichtenOngelezen.aantal} ongelezen clubbericht{berichtenOngelezen.aantal > 1 ? 'en' : ''}
            </span>
            <span style={{ color: C.red, fontWeight: '700', fontSize: 'var(--font-size-sm)', marginRight: '4px' }}>
              {bannerOpen ? '▲' : '▼'}
            </span>
          </button>
          {bannerOpen && (
            <div style={{ borderTop: `1px solid ${C.red}30`, padding: '8px 14px 12px' }}>
              {(berichtenOngelezen.lijst || []).map(b => (
                <button
                  key={b.id}
                  onClick={() => { markeerGelezen(b.id); setBerichtModal({ title: b.title, body: b.body }); setBannerOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%', textAlign: 'left',
                    background: 'transparent', border: 'none', color: C.textPrimary, fontFamily: 'inherit',
                    padding: '7px 0', borderBottom: `1px solid ${C.red}20`, cursor: 'pointer',
                  }}
                >
                  <span style={{ flexShrink: 0, width: '6px', height: '6px', borderRadius: '50%', background: C.red, marginTop: '5px' }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: '700', fontSize: 'var(--font-size-sm)' }}>{b.title}</span>
                    <span style={{ display: '-webkit-box', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', overflow: 'hidden', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {b.body}
                    </span>
                  </span>
                  <span style={{ color: C.red, fontSize: '12px', fontWeight: '700', flexShrink: 0 }}>›</span>
                </button>
              ))}
              {isCommunicatieZichtbaar && (
                <button
                  onClick={() => navigate('/communicatie')}
                  style={{ marginTop: '8px', background: 'none', border: 'none', color: C.red, fontSize: 'var(--font-size-xs)', fontWeight: '700', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
                >
                  Alle berichten bekijken →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dynamische snelkoppelingen */}
      <QuickActions snelkoppelingen={snelkoppelingen} onBewerk={() => setBewerkOpen(true)} />

      {/* Layout A of B */}
      {layout === 'bento' ? <LayoutBento {...layoutProps} /> : <LayoutAgendaHero {...layoutProps} />}

      {/* KPI-strip voor admin/bestuurslid — onderaan (clubcijfers) */}
      {isBeheerder && <div style={{ marginTop: 'var(--space-4)' }}><KpiStrip /></div>}

      {/* Snelkoppelingen bewerken */}
      <SnelkoppelingenBewerk
        open={bewerkOpen}
        onClose={() => setBewerkOpen(false)}
        beschikbarePaginas={beschikbarePaginas}
        gekozen={gekozenPaden.filter(p => beschikbarePaginas.includes(p) && p !== '/')}
        onBewaar={slaFavorietenOp}
      />

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
