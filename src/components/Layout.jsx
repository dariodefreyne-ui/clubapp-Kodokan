/**
 * Layout.jsx  –  Main app shell for Kodokan Clubapp
 *
 * Desktop:  fixed left sidebar (260 px) + scrollable content area beside it.
 * Mobile:   full-width content + slide-in drawer sidebar triggered by hamburger.
 *
 * The breakpoint (768 px) is detected via a ResizeObserver / window.innerWidth
 * check so no external CSS media-query file is needed.
 *
 * All styles are inline – no external CSS imports.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// ─── Design tokens ──────────────────────────────────────────────────────────────
const C = {
  bg:            '#1a1a1a',
  sidebar:       '#111111',
  card:          '#2d2d2d',
  border:        '#2a2a2a',
  red:           '#c0392b',
  redHover:      '#e74c3c',
  redAlpha:      'rgba(192,57,43,0.15)',
  textPrimary:   '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted:     '#666666',
  danger:        '#e74c3c',
};

const SIDEBAR_WIDTH = 260;
const MOBILE_BP     = 768;

// ─── Navigation items ──────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { path: '/',            label: 'Dashboard',    icon: '🏠', end: true  },
  { path: '/trainingen',  label: 'Trainingen',   icon: '📅'             },
  { path: '/leden',       label: 'Ledenbeheer',  icon: '🥋'             },
  { path: '/winkel',      label: 'Clubwinkel',   icon: '🎽'             },
  { path: '/verkoop',     label: 'Verkoop',      icon: '💳'             },
  { path: '/stock',       label: 'Stockbeheer',  icon: '📦'             },
  { path: '/eetfestijn',  label: 'Eetfestijn',   icon: '🍝'             },
  { path: '/wedstrijden', label: 'Wedstrijden',  icon: '🏆'             },
  { path: '/examens',     label: 'Examens',      icon: '📘'             },
  { path: '/documenten',  label: 'Documenten',   icon: '📁'             },
  { path: '/communicatie',label: 'Communicatie', icon: '📣'             },
  { path: '/rapporten',   label: 'Rapporten',    icon: '📊'             },
  { path: '/beheer',      label: 'Beheer',       icon: '🔧'             },
  { path: '/instellingen',label: 'Instellingen', icon: '⚙️'            },
];

// ─── Hook: track viewport width ────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BP : false,
  );

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < MOBILE_BP);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isMobile;
}

// ─── Hamburger icon ─────────────────────────────────────────────────────────────
function HamburgerIcon({ color = C.textPrimary }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            display:      'block',
            width:        '20px',
            height:       '2px',
            background:   color,
            borderRadius: '1px',
          }}
        />
      ))}
    </div>
  );
}

// ─── Sidebar content ────────────────────────────────────────────────────────────
function SidebarContent({ onLinkClick }) {
  const { role, logout } = useAuth();
  const [logoutHovered, setLogoutHovered] = useState(false);

  const roleBadgeColor = role === 'beheerder' ? C.red : '#2980b9';

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        '100%',
      overflow:      'hidden',
    }}>
      {/* ── Club logo area ── */}
      <div style={{
        padding:      '20px 16px 16px',
        borderBottom: `1px solid ${C.border}`,
        flexShrink:   0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width:          '40px',
            height:         '40px',
            background:     C.red,
            borderRadius:   '10px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '20px',
            flexShrink:     0,
          }}>
            🥋
          </div>
          <div>
            <div style={{
              fontWeight: '800',
              fontSize:   '15px',
              color:      C.textPrimary,
              lineHeight: '1.2',
            }}>
              🥋 Kodokan
            </div>
            <div style={{ fontSize: '12px', color: C.textSecondary }}>
              Clubapp
            </div>
          </div>
        </div>

        {role && (
          <div style={{
            marginTop:     '10px',
            padding:       '4px 12px',
            background:    roleBadgeColor,
            borderRadius:  '999px',
            display:       'inline-block',
            fontSize:      '11px',
            fontWeight:    '700',
            textTransform: 'uppercase',
            letterSpacing: '0.8px',
            color:         '#fff',
          }}>
            {role}
          </div>
        )}
      </div>

      {/* ── Nav list ── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {NAV_ITEMS.map(item => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                end={item.end}
                onClick={onLinkClick}
                style={({ isActive }) => ({
                  display:        'flex',
                  alignItems:     'center',
                  gap:            '12px',
                  padding:        '11px 16px',
                  color:          isActive ? C.redHover : C.textPrimary,
                  textDecoration: 'none',
                  background:     isActive ? C.redAlpha : 'transparent',
                  borderLeft:     `3px solid ${isActive ? C.red : 'transparent'}`,
                  fontSize:       '14px',
                  fontWeight:     isActive ? '600' : '400',
                  minHeight:      '44px',
                  transition:     'background 0.15s, color 0.15s',
                  boxSizing:      'border-box',
                })}
              >
                <span style={{ fontSize: '17px', width: '22px', textAlign: 'center', flexShrink: 0 }}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Logout ── */}
      <div style={{
        padding:   '12px 16px',
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <button
          onClick={logout}
          onMouseEnter={() => setLogoutHovered(true)}
          onMouseLeave={() => setLogoutHovered(false)}
          style={{
            width:          '100%',
            padding:        '11px 16px',
            background:     logoutHovered ? 'rgba(231,76,60,0.1)' : 'transparent',
            border:         `1px solid ${logoutHovered ? C.danger : C.border}`,
            borderRadius:   '8px',
            color:          logoutHovered ? C.danger : C.textSecondary,
            cursor:         'pointer',
            fontSize:       '14px',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '8px',
            minHeight:      '44px',
            transition:     'all 0.18s',
            fontFamily:     'inherit',
          }}
        >
          🚪 Uitloggen
        </button>
      </div>
    </div>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────────────────
export default function Layout({ children }) {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div style={{
      display:    'flex',
      minHeight:  '100dvh',
      background: C.bg,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      color:      C.textPrimary,
    }}>
      {/* ── Desktop sidebar (permanent) ── */}
      {!isMobile && (
        <aside style={{
          width:      `${SIDEBAR_WIDTH}px`,
          minWidth:   `${SIDEBAR_WIDTH}px`,
          height:     '100vh',
          position:   'sticky',
          top:        0,
          background: C.sidebar,
          borderRight:`1px solid ${C.border}`,
          zIndex:     10,
        }}>
          <SidebarContent onLinkClick={() => {}} />
        </aside>
      )}

      {/* ── Mobile: overlay backdrop ── */}
      {isMobile && drawerOpen && (
        <div
          onClick={closeDrawer}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(0,0,0,0.65)',
            zIndex:     200,
          }}
        />
      )}

      {/* ── Mobile: slide-in drawer ── */}
      {isMobile && (
        <aside style={{
          position:   'fixed',
          top:        0,
          left:       drawerOpen ? 0 : `-${SIDEBAR_WIDTH}px`,
          width:      `${SIDEBAR_WIDTH}px`,
          height:     '100vh',
          background: C.sidebar,
          borderRight:`1px solid ${C.border}`,
          zIndex:     201,
          transition: 'left 0.28s cubic-bezier(0.4,0,0.2,1)',
        }}>
          <SidebarContent onLinkClick={closeDrawer} />
        </aside>
      )}

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar (mobile only) */}
        {isMobile && (
          <header style={{
            position:     'sticky',
            top:          0,
            zIndex:       100,
            height:       '56px',
            background:   C.sidebar,
            borderBottom: `1px solid ${C.border}`,
            display:      'flex',
            alignItems:   'center',
            padding:      '0 16px',
            gap:          '12px',
          }}>
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Menu openen"
              style={{
                background:    'none',
                border:        'none',
                cursor:        'pointer',
                padding:       '8px',
                borderRadius:  '6px',
                display:       'flex',
                alignItems:    'center',
                justifyContent:'center',
                minWidth:      '44px',
                minHeight:     '44px',
                color:         C.textPrimary,
              }}
            >
              <HamburgerIcon />
            </button>

            <span style={{
              fontWeight: '700',
              fontSize:   '16px',
              color:      C.textPrimary,
              flex:       1,
            }}>
              Judo Kodokan Merchtem
            </span>

            <div style={{
              width:          '32px',
              height:         '32px',
              background:     C.red,
              borderRadius:   '7px',
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              fontSize:       '16px',
            }}>
              🥋
            </div>
          </header>
        )}

        {/* Page content */}
        <main style={{
          flex:      1,
          padding:   isMobile ? '16px' : '24px 28px',
          maxWidth:  '1200px',
          width:     '100%',
          margin:    '0 auto',
          boxSizing: 'border-box',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
