import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import RequireRole from './components/RequireRole.jsx';
import { PaginaRollenProvider, usePaginaRollen } from './contexts/PaginaRollenContext.jsx';
import { PaginaTitelProvider, useOverrideTitel } from './contexts/PaginaTitelContext.jsx';
import { C } from './styles/tokens';
import { useIsMobile } from './hooks/useIsMobile.js';
import { ALLE_PAGINAS, NAV_GROEPEN, ROL_STANDAARD_PAGINAS, CLUB_NAAM_KORT } from './config/appConfig';
import {
  browserOndersteuntPush,
  registreerVoorgrondMeldingen,
  registreerPushToken,
  isPushHandmatigUitgeschakeld,
} from './notifications/firebaseMessaging';
import UpdateBanner from './components/ui/UpdateBanner';

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
const Klassement         = lazy(() => import('./pages/Klassement.jsx'));

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
  return item?.label || CLUB_NAAM_KORT;
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
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
            <button
              onClick={() => { window.location.href = '/'; }}
              style={{
                background: 'transparent', border: `1px solid ${C.red}`, color: C.red,
                padding: '12px 24px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '15px', fontWeight: '600',
              }}
            >
              🏠 Ga terug naar Dashboard
            </button>
          </div>
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
function SidebarInhoud({ onLinkClick }) {
  const { role, logout, isAdmin, isBeheerder, isTrainer, isLid, profiel, configCache } = useAuth();
  const beschikbarePads = usePaginaRollen();
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
                        color: isActive ? 'var(--accent-red)' : 'var(--text-primary)',
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

function Sidebar({ isOpen, onClose, isMobile }) {
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
        <SidebarInhoud onLinkClick={() => {}} />
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
        <SidebarInhoud onLinkClick={onClose} />
      </nav>
    </>
  );
}

// ─── AppLayout ─────────────────────────────────────────────────────────────────
function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profiel, configCache } = useAuth();
  const logoUrl = configCache?.clubSettings?.logoUrl || '';
  const isMobile = useIsMobile();
  const paginaTitelBase = usePaginaTitel();
  const overrideTitel = useOverrideTitel();
  const paginaTitel = overrideTitel || paginaTitelBase;

  // Fix 1: toon push-meldingen ook als de app-tab actief is (voorgrond).
  // Firebase Web Messaging slaat onMessage stil over zonder expliciete handler.
  useEffect(() => {
    if (!profiel?.uid) return;
    let afmelding = () => {};

    browserOndersteuntPush().then(ok => {
      if (!ok || Notification.permission !== 'granted') return;
      registreerVoorgrondMeldingen(payload => {
        // De SW handelt browser-notificaties af voor achtergrond en gesloten staat.
        // Als de app op de voorgrond staat niets doen — geen dubbele notificatie.
        void payload;
      }).then(unsub => { afmelding = unsub; });
    });

    return () => afmelding();
  }, [profiel?.uid]);

  // Fix 2: herregistreer token stil bij elke login/app-herstart.
  // Altijd opnieuw registreren zodra browserpermissie 'granted' is — ook als
  // het vorige token al inactief is gezet (bv. na een VAPID-key-rotatie in
  // Firebase Console). Anders blokkeert een eenmalig ongeldig token het
  // zelfherstel voor altijd, ook al staat pushmeldingen nog aan op het toestel.
  // Uitzondering: als de gebruiker pushmeldingen zelf via Instellingen heeft
  // uitgezet, mag dit zelfherstel die keuze niet bij de volgende app-start
  // ongedaan maken — de OS-permissie blijft 'granted' staan, maar dat is geen
  // signaal dat de gebruiker pushmeldingen ook in de app weer aan wil.
  useEffect(() => {
    if (!profiel?.uid) return;
    if (isPushHandmatigUitgeschakeld()) return;
    browserOndersteuntPush().then(async ok => {
      if (!ok || Notification.permission !== 'granted') return;
      registreerPushToken(profiel).catch(e => console.error('Stille push-herregistratie mislukt:', e));
    });
  }, [profiel?.uid]);

  return (
    <PaginaTitelProvider>
    <PaginaRollenProvider>
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <a href="#main-content" className="skip-nav">Ga naar inhoud</a>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
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

        <main id="main-content" style={{
          padding: isMobile ? '16px' : '24px 28px',
          maxWidth: '1200px',
          margin: '0 auto',
        }}>
          <Suspense fallback={<RouteSpinner />}>
            <Routes>
              <Route path="/"              element={<ErrorBoundary><RequireRole><Dashboard /></RequireRole></ErrorBoundary>} />
              <Route path="/leden"         element={<ErrorBoundary><RequireRole><Ledenbeheer /></RequireRole></ErrorBoundary>} />
              <Route path="/leden/nieuw"   element={<ErrorBoundary><RequireRole><NieuwLid /></RequireRole></ErrorBoundary>} />
              <Route path="/leden/:id"     element={<ErrorBoundary><RequireRole><LidDetail /></RequireRole></ErrorBoundary>} />
              <Route path="/trainingen"     element={<ErrorBoundary><RequireRole><Trainingen /></RequireRole></ErrorBoundary>} />
              <Route path="/trainingen/:id" element={<ErrorBoundary><RequireRole><Trainingen /></RequireRole></ErrorBoundary>} />
              <Route path="/dashboard"     element={<Navigate to="/" replace />} />
              <Route path="/uitbetalingen" element={<ErrorBoundary><RequireRole><Uitbetalingen /></RequireRole></ErrorBoundary>} />
              <Route path="/winkel"        element={<ErrorBoundary><RequireRole><Winkel /></RequireRole></ErrorBoundary>} />
              <Route path="/eetfestijn"    element={<ErrorBoundary><RequireRole><Eetfestijn /></RequireRole></ErrorBoundary>} />
              <Route path="/wedstrijden"     element={<ErrorBoundary><RequireRole><Wedstrijden /></RequireRole></ErrorBoundary>} />
              <Route path="/wedstrijden/:id" element={<ErrorBoundary><RequireRole><Wedstrijden /></RequireRole></ErrorBoundary>} />
              <Route path="/agenda"        element={<ErrorBoundary><RequireRole><Agenda /></RequireRole></ErrorBoundary>} />
              <Route path="/examens"       element={<ErrorBoundary><RequireRole><Examens /></RequireRole></ErrorBoundary>} />
              <Route path="/examens/:id"   element={<ErrorBoundary><RequireRole><Examens /></RequireRole></ErrorBoundary>} />
              <Route path="/documenten"    element={<ErrorBoundary><RequireRole><Documenten /></RequireRole></ErrorBoundary>} />
              <Route path="/communicatie"  element={<ErrorBoundary><RequireRole><Communicatie /></RequireRole></ErrorBoundary>} />
              <Route path="/rapporten"     element={<ErrorBoundary><RequireRole><Rapporten /></RequireRole></ErrorBoundary>} />
              <Route path="/klassement"    element={<ErrorBoundary><RequireRole><Klassement /></RequireRole></ErrorBoundary>} />
              <Route path="/technieken"    element={<ErrorBoundary><RequireRole><Technieken /></RequireRole></ErrorBoundary>} />
              <Route path="/evenementen"     element={<ErrorBoundary><RequireRole><Evenementen /></RequireRole></ErrorBoundary>} />
              <Route path="/evenementen/:id" element={<ErrorBoundary><RequireRole><Evenementen /></RequireRole></ErrorBoundary>} />
              <Route path="/events"        element={<ErrorBoundary><RequireRole><Events /></RequireRole></ErrorBoundary>} />
              <Route path="/bestuur"       element={<ErrorBoundary><RequireRole><Bestuur /></RequireRole></ErrorBoundary>} />
              <Route path="/beheer"        element={<ErrorBoundary><RequireRole><Beheer /></RequireRole></ErrorBoundary>} />
              <Route path="/instellingen"  element={<ErrorBoundary><RequireRole><DeviceInstellingen /></RequireRole></ErrorBoundary>} />
              <Route path="/profiel"       element={<ErrorBoundary><RequireRole><ProfielPagina /></RequireRole></ErrorBoundary>} />
              <Route path="/login"         element={<Navigate to="/" replace />} />
              <Route path="*"             element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      <ConnectionDot />
      <UpdateBanner />
    </div>
    </PaginaRollenProvider>
    </PaginaTitelProvider>
  );
}

// ─── Laad-diagnostics ──────────────────────────────────────────────────────────
async function hardReset() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const namen = await caches.keys();
      await Promise.all(namen.map(n => caches.delete(n)));
    }
    localStorage.clear();
    sessionStorage.clear();
  } catch { /* best-effort */ }
  window.location.reload();
}

function LaadDiagnostics({ laadFase }) {
  const s = {
    wrap: { background: 'rgba(255,255,255,0.06)', borderRadius: '10px', padding: '14px 16px', marginTop: '8px', textAlign: 'left', width: '100%', maxWidth: '340px' },
    titel: { fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' },
    rij: { display: 'flex', alignItems: 'baseline', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '5px' },
    icon: { width: '14px', flexShrink: 0, textAlign: 'center' },
    fout: { marginTop: '12px', fontSize: '11px', color: '#e0a0a0', lineHeight: 1.6, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' },
  };

  const authIcoon = { wachtend: '⏳', ingelogd: '✓', uitgelogd: '—', timeout: '✗' }[laadFase.auth] || '?';
  const profielIcoon = { nvt: '–', wachtend: '⏳', geladen: '✓', timeout: '⌛', fout: '✗' }[laadFase.profiel] || '?';

  const authLabel = {
    wachtend: 'Firebase Auth — wacht op reactie…',
    ingelogd: `Firebase Auth — ingelogd (${laadFase.authMs}ms)`,
    uitgelogd: `Firebase Auth — niet ingelogd (${laadFase.authMs}ms)`,
    timeout: 'Firebase Auth — geen reactie na 4s (timeout)',
  }[laadFase.auth] || laadFase.auth;

  const profielLabel = {
    nvt: 'Firestore profiel — n.v.t.',
    wachtend: 'Firestore profiel — wacht op snapshot…',
    geladen: `Firestore profiel — geladen (${laadFase.profielMs}ms)`,
    timeout: `Firestore profiel — fallback na ${laadFase.profielMs}ms`,
    fout: `Firestore profiel — fout: ${laadFase.profielFout}`,
  }[laadFase.profiel] || laadFase.profiel;

  let diagnose = null;
  if (laadFase.auth === 'wachtend' || laadFase.auth === 'timeout') {
    diagnose = 'Firebase Auth reageert niet. Meest waarschijnlijke oorzaak: het reCAPTCHA-beveiligingsscript (www.google.com/recaptcha) is geblokkeerd of extreem traag op dit netwerk.';
  } else if (laadFase.profiel === 'wachtend' || laadFase.profiel === 'nvt') {
    diagnose = 'Ingelogd maar Firestore-profiel laadt niet. Mogelijke oorzaken: App Check-token geblokkeerd door netwerk, of IndexedDB-vergrendeling door een ander tabblad.';
  } else if (laadFase.profiel === 'fout') {
    diagnose = `Firestore-fout "${laadFase.profielFout}". Controleer de beveiligingsregels of de verbinding.`;
  } else if (laadFase.profiel === 'timeout') {
    diagnose = 'Profiel-fallback actief, maar app blokkeert nog steeds. Dit is onverwacht — probeer cache wissen.';
  }

  return (
    <div style={s.wrap}>
      <div style={s.titel}>Diagnose</div>
      <div style={s.rij}><span style={s.icon}>{authIcoon}</span><span>{authLabel}</span></div>
      <div style={s.rij}><span style={s.icon}>{profielIcoon}</span><span>{profielLabel}</span></div>
      <div style={s.rij}>
        <span style={s.icon}>{navigator.onLine ? '✓' : '✗'}</span>
        <span>Netwerk — {laadFase.online ? (navigator.onLine ? 'online' : 'nu offline, was online') : 'offline'}</span>
      </div>
      {diagnose && <div style={s.fout}>💡 {diagnose}</div>}
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, isLaden, profiel, laadFase } = useAuth();
  const [ladenTimeout, setLadenTimeout] = useState(false);

  useEffect(() => {
    if (!isLaden) {
      setLadenTimeout(false);
      return;
    }
    const t = setTimeout(() => setLadenTimeout(true), 7000);
    return () => clearTimeout(t);
  }, [isLaden]);

  if (isLaden) {
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg-primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '12px', padding: '24px',
      }}>
        <div style={{ fontSize: '48px' }}>🥋</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '15px' }}>Laden...</div>
        {ladenTimeout && (
          <div style={{ color: 'var(--danger)', fontSize: '13px', maxWidth: '340px', textAlign: 'center' }}>
            <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '4px' }}>
              App start niet op
            </div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
              De app reageert al meer dan 7 seconden niet.
            </div>
            {laadFase && <LaadDiagnostics laadFase={laadFase} />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              <button
                onClick={() => window.location.reload()}
                style={{ background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}
              >
                🔄 Herladen
              </button>
              <button
                onClick={hardReset}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}
              >
                🗑️ Cache wissen &amp; herladen
              </button>
            </div>
          </div>
        )}
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
