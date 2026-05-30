import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { doc, onSnapshot as fsOnSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './contexts/AuthContext.jsx';
import { C } from './styles/tokens';
import { useIsMobile } from './hooks/useIsMobile.js';
import { ALLE_PAGINAS, NAV_GROEPEN, ROL_STANDAARD_PAGINAS } from './config/appConfig';
import {
  browserOndersteuntPush,
  registreerVoorgrondMeldingen,
  registreerPushToken,
  heeftActievePushToken,
} from './notifications/firebaseMessaging';

// Sync (eerste paint na login): Dashboard + LoginPagina + Onboarding.
// Onboarding zit direct na login in de render-flow; lazy laden zou hier een
// zichtbare spinner geven voor elke nieuwe gebruiker.
import Dashboard          from './pages/Dashboard.jsx';
import LoginPagina        from './pages/LoginPagina.jsx';
import Onboarding         from './pages/Onboarding.jsx';

// Lazy: alle andere routes — code-split per pagina voor snellere initial load
const Ledenbeheer        = lazy(() => import('./pages/Ledenbeheer.jsx'));
const NieuwLid           = lazy(() => import('./pages/NieuwLid.jsx'));
const LidDetail          = lazy(() => import('./pages/LidDetail.jsx'));
const Trainingen         = lazy(() => import('./pages/Trainingen.jsx'));
const Winkel             = lazy(() => import('./pages/Winkel.jsx'));
const Eetfestijn         = lazy(() => import('./pages/Eetfestijn.jsx'));
const Wedstrijden        = lazy(() => import('./pages/Wedstrijden.jsx'));
const Examens            = lazy(() => import('./pages/Examens.jsx'));
const Documenten         = lazy(() => import('./pages/Documenten.jsx'));
const Communicatie       = lazy(() => import('./pages/Communicatie.jsx'));
const Rapporten          = lazy(() => import('./pages/Rapporten.jsx'));
const Technieken         = lazy(() => import('./pages/Technieken.jsx'));
const Evenementen        = lazy(() => import('./pages/Evenementen.jsx'));
const Agenda             = lazy(() => import('./pages/Agenda.jsx'));
const Bestuur            = lazy(() => import('./pages/Bestuur.jsx'));
const Beheer             = lazy(() => import('./pages/Beheer.jsx'));
const Uitbetalingen      = lazy(() => import('./pages/Uitbetalingen.jsx'));
const DeviceInstellingen = lazy(() => import('./pages/DeviceInstellingen.jsx'));
const ProfielPagina      = lazy(() => import('./pages/ProfielPagina.jsx'));
const Events             = lazy(() => import('./pages/Events.jsx'));

function RouteSpinner() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
      <div style={{ fontSize: '32px' }}>🥋</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Laden...</div>
    </div>
  );
}

const SIDEBAR_WIDTH = 260;

function usePaginaTitel() {
  const location = useLocation();
  const item = ALLE_PAGINAS.find(n =>
    n.exact ? location.pathname === n.pad : location.pathname.startsWith(n.pad)
  );
  return item?.label || 'Kodokan';
}

// ─── ErrorBoundary ─────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
            Er ging iets mis
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', maxWidth: '320px' }}>
            {this.state.error?.message || 'Onbekende fout'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: C.red, border: 'none', color: 'var(--text-primary)',
              padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '15px', fontWeight: '600',
            }}
          >
            🔄 Herladen
          </button>
        </div>
      </div>
    );
  }
}

// ─── ConnectionDot ─────────────────────────────────────────────────────────────
function ConnectionDot() {
  const [online, setOnline]   = useState(navigator.onLine);
  const [visible, setVisible] = useState(false);
  const timerRef              = useRef(null);

  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), 3000);
    };
    const goOffline = () => {
      setOnline(false);
      setVisible(true);
      clearTimeout(timerRef.current);
    };
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (!visible) return null;
  return (
    <div style={{
      position: 'fixed', bottom: '16px', right: '16px', zIndex: 999,
      background: online ? 'var(--success)' : 'var(--danger)',
      color: 'var(--text-primary)', borderRadius: '20px', padding: '8px 14px',
      fontSize: '13px', fontWeight: '600',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      {online ? '✓ Online' : '✗ Offline'}
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function SidebarInhoud({ beschikbarePads, onLinkClick }) {
  const { role, logout, isAdmin, isBeheerder, isTrainer, isLid, profiel, configCache } = useAuth();
  const logoUrl  = configCache?.clubSettings?.logoUrl  || '';
  const clubNaam = configCache?.clubSettings?.clubname || configCache?.clubSettings?.naam || 'Judo Kodokan';
  const naamKort = configCache?.clubSettings?.naamKort || clubNaam;

  return (
    <>
      {/* Header */}
      <div style={{
        padding: '20px 16px 16px',
        borderBottom: '1px solid var(--border-color)',
        background: C.card,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px',
            background: logoUrl ? 'transparent' : C.red,
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', flexShrink: 0, overflow: 'hidden',
          }}>
            {logoUrl
              ? <img src={logoUrl} alt={clubNaam} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : '🥋'}
          </div>
          <div>
            <div style={{ fontWeight: '700', fontSize: '14px' }}>{clubNaam}</div>
            {naamKort !== clubNaam && (
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{naamKort}</div>
            )}
          </div>
        </div>
        {profiel?.naam && (
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600', marginTop: '6px' }}>
            {profiel.naam}
          </div>
        )}
        {role && (
          <div style={{
            marginTop: '10px', padding: '4px 10px',
            background: C.red, borderRadius: '12px',
            display: 'inline-block', fontSize: '11px', fontWeight: '600',
            textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            {role}
          </div>
        )}
      </div>

      {/* Nav items — gegroepeerd */}
      <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0, flex: 1, overflowY: 'auto' }}>
        {NAV_GROEPEN.map(groep => {
          const groepItems = ALLE_PAGINAS.filter(item => {
            if (item.groep !== groep.id) return false;
            const pad = item.pad;
            if (pad === '/' || pad === '/profiel') return true;
            if (pad === '/beheer' && isBeheerder) return true;
            // Bestuur is vertrouwelijk: enkel admin/bestuurslid, ongeacht
            // een eventuele custom paginaconfig in beschikbarePads.
            if (pad === '/bestuur') return isBeheerder;
            if (beschikbarePads) return beschikbarePads.includes(pad);
            return (ROL_STANDAARD_PAGINAS[role] || []).includes(pad);
          });
          if (groepItems.length === 0) return null;
          return (
            <li key={groep.id}>
              {groep.label && (
                <div style={{
                  padding: '10px 16px 4px',
                  fontSize: '10px', fontWeight: '700',
                  color: 'var(--text-secondary)',
                  textTransform: 'uppercase', letterSpacing: '0.8px',
                  opacity: 0.6,
                }}>
                  {groep.label}
                </div>
              )}
              {groep.id === 'account' && (
                <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 16px' }} />
              )}
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {groepItems.map(item => (
                  <li key={item.pad}>
                    <NavLink
                      to={item.pad}
                      end={item.exact}
                      onClick={onLinkClick}
                      style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '10px 16px', textDecoration: 'none',
                        color: isActive ? 'var(--accent-red-hover)' : 'var(--text-primary)',
                        background: isActive ? 'rgba(230,51,70,0.16)' : 'transparent',
                        borderLeft: isActive ? '3px solid var(--accent-red)' : '3px solid transparent',
                        fontSize: '13px', fontWeight: isActive ? '600' : '400',
                        minHeight: '40px',
                      })}
                    >
                      <span style={{ fontSize: '16px', width: '22px', textAlign: 'center' }}>
                        {item.icon}
                      </span>
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {/* Logout */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
        <button
          onClick={() => { logout(); onLinkClick && onLinkClick(); }}
          style={{
            width: '100%', padding: '12px',
            background: 'transparent',
            border: '1px solid var(--border-color)',
            borderRadius: '8px', color: 'var(--text-secondary)',
            cursor: 'pointer', fontSize: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '8px', minHeight: '44px',
          }}
        >
          🚪 Uitloggen
        </button>
      </div>
    </>
  );
}

function Sidebar({ isOpen, onClose, beschikbarePads, isMobile }) {
  if (!isMobile) {
    return (
      <nav style={{
        position: 'fixed', top: 0, left: 0,
        width: `${SIDEBAR_WIDTH}px`, height: '100vh',
        background: C.bg,
        borderRight: `1px solid ${C.borderSoft}`,
        zIndex: 10,
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <SidebarInhoud beschikbarePads={beschikbarePads} onLinkClick={() => {}} />
      </nav>
    );
  }

  return (
    <>
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 100,
          }}
        />
      )}
      <nav style={{
        position: 'fixed', top: 0, left: isOpen ? 0 : '-280px',
        width: '280px', height: '100vh',
        background: C.bg,
        borderRight: `1px solid ${C.borderSoft}`,
        zIndex: 101, transition: 'left 0.3s ease',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        <SidebarInhoud beschikbarePads={beschikbarePads} onLinkClick={onClose} />
      </nav>
    </>
  );
}

// ─── AppLayout ─────────────────────────────────────────────────────────────────
function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profiel, configCache } = useAuth();
  const logoUrl = configCache?.clubSettings?.logoUrl || '';
  const [beschikbarePads, setBeschikbarePads] = useState(null);
  const isMobile = useIsMobile();
  const paginaTitel = usePaginaTitel();

  useEffect(() => {
    if (!profiel?.rol) return;
    const unsub = fsOnSnapshot(doc(db, 'instellingen', 'paginaRollen'), snap => {
      if (!snap.exists()) { setBeschikbarePads(null); return; }
      const pads = snap.data()[profiel.rol] || [];
      if (pads.length === 0) { setBeschikbarePads(null); return; }
      const altijd = ['/', '/dashboard', '/profiel'];
      if (profiel.rol === 'admin' || profiel.rol === 'bestuurslid') altijd.push('/beheer');
      setBeschikbarePads([...new Set([...pads, ...altijd])]);
    }, () => setBeschikbarePads(null));
    return unsub;
  }, [profiel?.rol]);

  // Fix 1: toon push-meldingen ook als de app-tab actief is (voorgrond).
  // Firebase Web Messaging slaat onMessage stil over zonder expliciete handler.
  useEffect(() => {
    if (!profiel?.uid) return;
    let afmelding = () => {};

    browserOndersteuntPush().then(ok => {
      if (!ok || Notification.permission !== 'granted') return;
      registreerVoorgrondMeldingen(payload => {
        const notif  = payload.notification || {};
        const data   = payload.data || {};
        const title  = notif.title || 'Kodokan';
        const opties = {
          body:  notif.body  || '',
          icon:  '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag:   data.type || data.rubriek || 'kodokan',
          data,
        };
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, opties);
        });
      }).then(unsub => { afmelding = unsub; });
    });

    return () => afmelding();
  }, [profiel?.uid]);

  // Fix 2: herregistreer token stil bij elke login/app-herstart.
  // Verhindert dat verlopen tokens push permanent uitschakelen.
  useEffect(() => {
    if (!profiel?.uid) return;
    browserOndersteuntPush().then(async ok => {
      if (!ok || Notification.permission !== 'granted') return;
      const actief = await heeftActievePushToken(profiel.uid);
      if (!actief) return;
      registreerPushToken(profiel).catch(() => {});
    });
  }, [profiel?.uid]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        beschikbarePads={beschikbarePads}
        isMobile={isMobile}
      />

      <div style={{
        marginLeft: isMobile ? 0 : `${SIDEBAR_WIDTH}px`,
        minHeight: '100vh',
        background: 'var(--bg-primary)',
      }}>
        {isMobile && (
          <header style={{
            position: 'sticky', top: 0, zIndex: 50, height: '56px',
            background: C.bg,
            borderBottom: `1px solid ${C.borderSoft}`,
            display: 'flex', alignItems: 'center',
            padding: '0 16px', gap: '12px',
          }}>
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              style={{
                background: 'none', border: 'none',
                color: 'var(--text-primary)', cursor: 'pointer',
                padding: '8px', borderRadius: '6px',
                display: 'flex', flexDirection: 'column', gap: '4px',
                minHeight: '44px', minWidth: '44px',
                alignItems: 'center', justifyContent: 'center',
              }}
            >
              <span style={{ display: 'block', width: '20px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
              <span style={{ display: 'block', width: '20px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
              <span style={{ display: 'block', width: '20px', height: '2px', background: 'currentColor', borderRadius: '1px' }} />
            </button>
            <span style={{ fontWeight: '700', fontSize: '16px', flex: 1 }}>
              {paginaTitel}
            </span>
            <div style={{
              width: '32px', height: '32px',
              background: logoUrl ? 'transparent' : C.red,
              borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '16px', overflow: 'hidden', flexShrink: 0,
            }}>
              {logoUrl
                ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                : '🥋'}
            </div>
          </header>
        )}

        <main style={{
          padding: isMobile ? '16px' : '24px 28px',
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          <Suspense fallback={<RouteSpinner />}>
            <Routes>
            <Route path="/"              element={<Dashboard />} />
            <Route path="/leden"         element={<Ledenbeheer />} />
            <Route path="/leden/nieuw"   element={<NieuwLid />} />
            <Route path="/leden/:id"     element={<LidDetail />} />
            <Route path="/trainingen"     element={<Trainingen />} />
            <Route path="/trainingen/:id" element={<Trainingen />} />
            <Route path="/dashboard"     element={<Navigate to="/" replace />} />
            <Route path="/uitbetalingen" element={<Uitbetalingen />} />
            <Route path="/winkel"        element={<Winkel />} />
            <Route path="/eetfestijn"    element={<Eetfestijn />} />
            <Route path="/wedstrijden"     element={<Wedstrijden />} />
            <Route path="/wedstrijden/:id" element={<Wedstrijden />} />
            <Route path="/agenda"        element={<Agenda />} />
            <Route path="/examens"     element={<Examens />} />
            <Route path="/examens/:id" element={<Examens />} />
            <Route path="/documenten"    element={<Documenten />} />
            <Route path="/communicatie"  element={<Communicatie />} />
            <Route path="/rapporten"     element={<Rapporten />} />
            <Route path="/technieken"    element={<Technieken />} />
            <Route path="/evenementen"     element={<Evenementen />} />
            <Route path="/evenementen/:id" element={<Evenementen />} />
            <Route path="/events"        element={<Events />} />
            <Route path="/bestuur"       element={<Bestuur />} />
            <Route path="/beheer"        element={<Beheer />} />
            <Route path="/instellingen"  element={<DeviceInstellingen />} />
            <Route path="/profiel"       element={<ProfielPagina />} />
          </Routes>
          </Suspense>
        </main>
      </div>

      <ConnectionDot />
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, isLaden, profiel } = useAuth();

  if (isLaden) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ fontSize: '48px' }}>🥋</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Laden...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteSpinner />}>
        {isAuthenticated
          ? (profiel?.onboardingVoltooid === false ? <Onboarding /> : <AppLayout />)
          : <LoginPagina />}
      </Suspense>
    </ErrorBoundary>
  );
}
