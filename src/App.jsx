import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';
import { seedTechnieken } from './scripts/seedTechnieken';
import { seedLesgevers } from './scripts/seedLesgevers';

import Dashboard          from './pages/Dashboard.jsx';
import Ledenbeheer        from './pages/Ledenbeheer.jsx';
import NieuwLid           from './pages/NieuwLid.jsx';
import LidDetail          from './pages/LidDetail.jsx';
import Trainingen         from './pages/Trainingen.jsx';
import Clubwinkel         from './pages/Clubwinkel.jsx';
import Verkoop            from './pages/Verkoop.jsx';
import Stockbeheer        from './pages/Stockbeheer.jsx';
import Eetfestijn         from './pages/Eetfestijn.jsx';
import Wedstrijden        from './pages/Wedstrijden.jsx';
import Examens            from './pages/Examens.jsx';
import Documenten         from './pages/Documenten.jsx';
import Communicatie       from './pages/Communicatie.jsx';
import Rapporten          from './pages/Rapporten.jsx';
import Technieken         from './pages/Technieken.jsx';
import Beheer             from './pages/Beheer.jsx';
import DeviceInstellingen from './pages/DeviceInstellingen.jsx';
import LoginPagina        from './pages/LoginPagina.jsx';
import ProfielPagina      from './pages/ProfielPagina.jsx';

const NAV_ITEMS = [
  { path: '/',             label: 'Dashboard',    icon: '🏠', exact: true },
  { path: '/leden',        label: 'Leden',        icon: '👥' },
  { path: '/trainingen',   label: 'Trainingen',   icon: '🥋' },
  { path: '/winkel',       label: 'Clubwinkel',   icon: '🛒' },
  { path: '/verkoop',      label: 'Verkoop',      icon: '💳' },
  { path: '/stock',        label: 'Stock',        icon: '📦' },
  { path: '/eetfestijn',   label: 'Eetfestijn',   icon: '🍝' },
  { path: '/wedstrijden',  label: 'Wedstrijden',  icon: '🏆' },
  { path: '/examens',      label: 'Examens',      icon: '📘' },
  { path: '/documenten',   label: 'Documenten',   icon: '📁' },
  { path: '/communicatie', label: 'Communicatie', icon: '📣' },
  { path: '/rapporten',    label: 'Rapporten',    icon: '📊' },
  { path: '/technieken',   label: 'Technieken',   icon: '🥋', adminOnly: true },
  { path: '/profiel',      label: 'Mijn profiel', icon: '👤' },
  { path: '/beheer',       label: 'Beheer',       icon: '🔧' },
  { path: '/instellingen', label: 'Instellingen', icon: '⚙️' },
];

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
        minHeight: '100vh', background: '#1a1a1a', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px', textAlign: 'center',
      }}>
        <div>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>
            Er ging iets mis
          </div>
          <div style={{ color: '#aaa', fontSize: '14px', marginBottom: '24px', maxWidth: '320px' }}>
            {this.state.error?.message || 'Onbekende fout'}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#c0392b', border: 'none', color: '#fff',
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
      background: online ? '#27ae60' : '#e74c3c',
      color: '#fff', borderRadius: '20px', padding: '8px 14px',
      fontSize: '13px', fontWeight: '600',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      {online ? '✓ Online' : '✗ Offline'}
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ isOpen, onClose }) {
  const { role, logout, isBeheerder, profiel } = useAuth();

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
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        zIndex: 101, transition: 'left 0.3s ease',
        overflowY: 'auto', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 16px 16px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--bg-card)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px',
              background: 'var(--accent-red)', borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', flexShrink: 0,
            }}>
              🥋
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>Judo Kodokan</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Merchtem</div>
            </div>
          </div>
          {profiel?.naam && (
            <div style={{ fontSize: '13px', color: '#fff', fontWeight: '600', marginTop: '6px' }}>
              {profiel.naam}
            </div>
          )}
          {role && (
            <div style={{
              marginTop: '10px', padding: '4px 10px',
              background: 'var(--accent-red)', borderRadius: '12px',
              display: 'inline-block', fontSize: '11px', fontWeight: '600',
              textTransform: 'uppercase', letterSpacing: '0.5px',
            }}>
              {role}
            </div>
          )}
        </div>

        {/* Nav items */}
        <ul style={{ listStyle: 'none', padding: '8px 0', margin: 0, flex: 1 }}>
          {NAV_ITEMS.filter(item => !item.adminOnly || isBeheerder).map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.exact}
                onClick={onClose}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 16px', textDecoration: 'none',
                  color: isActive ? 'var(--accent-red-hover)' : 'var(--text-primary)',
                  background: isActive ? 'rgba(192,57,43,0.15)' : 'transparent',
                  borderLeft: isActive ? '3px solid var(--accent-red)' : '3px solid transparent',
                  fontSize: '14px', fontWeight: isActive ? '600' : '400',
                  minHeight: '44px',
                })}
              >
                <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>
                  {item.icon}
                </span>
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
          <button
            onClick={() => { logout(); onClose(); }}
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
      </nav>
    </>
  );
}

// ─── AppLayout ─────────────────────────────────────────────────────────────────
function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <header style={{
        position: 'sticky', top: 0, zIndex: 50, height: '56px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-color)',
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
          Judo Kodokan Merchtem
        </span>
        <div style={{
          width: '32px', height: '32px',
          background: 'var(--accent-red)', borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '16px',
        }}>
          🥋
        </div>
      </header>

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
        <Routes>
          <Route path="/"             element={<Dashboard />} />
          <Route path="/leden"        element={<Ledenbeheer />} />
          <Route path="/leden/nieuw"  element={<NieuwLid />} />
          <Route path="/leden/:id"    element={<LidDetail />} />
          <Route path="/trainingen"   element={<Trainingen />} />
          <Route path="/winkel"       element={<Clubwinkel />} />
          <Route path="/verkoop"      element={<Verkoop />} />
          <Route path="/stock"        element={<Stockbeheer />} />
          <Route path="/eetfestijn"   element={<Eetfestijn />} />
          <Route path="/wedstrijden"  element={<Wedstrijden />} />
          <Route path="/examens"      element={<Examens />} />
          <Route path="/documenten"   element={<Documenten />} />
          <Route path="/communicatie" element={<Communicatie />} />
          <Route path="/rapporten"    element={<Rapporten />} />
          <Route path="/technieken"   element={<Technieken />} />
          <Route path="/beheer"       element={<Beheer />} />
          <Route path="/instellingen" element={<DeviceInstellingen />} />
          <Route path="/profiel"      element={<ProfielPagina />} />
        </Routes>
      </main>

      <ConnectionDot />
    </div>
  );
}

// ─── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { isAuthenticated, isLaden } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      seedTechnieken().catch(console.error);
      seedLesgevers().catch(console.error);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  if (isLaden) {
    return (
      <div style={{
        minHeight: '100vh', background: '#1a1a1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '16px',
      }}>
        <div style={{ fontSize: '48px' }}>🥋</div>
        <div style={{ color: '#aaa', fontSize: '15px' }}>Laden...</div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      {isAuthenticated ? <AppLayout /> : <LoginPagina />}
    </ErrorBoundary>
  );
}
