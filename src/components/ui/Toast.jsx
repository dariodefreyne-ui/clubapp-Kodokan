// src/components/ui/Toast.jsx
// Toast-stack voor success/error/info meldingen.
// Gebruik via ToastProvider + useToast() hook.
import React, { createContext, useCallback, useContext, useState, useRef } from 'react';
import { C } from '../../styles/tokens';

const ToastContext = createContext(null);

const KLEUREN = {
  success: { bg: 'rgba(34,197,94,0.15)', border: C.green, icon: '✓', kleur: C.green },
  error:   { bg: 'rgba(230,51,70,0.15)',  border: C.red,   icon: '✕', kleur: C.red },
  info:    { bg: 'rgba(56,189,248,0.15)', border: C.blue,  icon: 'ℹ', kleur: C.blue },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback(({ bericht, type = 'success', duur = 4000, onUndo }) => {
    const id = ++idRef.current;
    setToasts(t => [...t, { id, bericht, type, onUndo }]);
    if (duur > 0) {
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), duur);
    }
    return id;
  }, []);

  const sluit = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast-stack rechtsonder */}
      <div style={{
        position: 'fixed', bottom: '20px', right: '20px',
        zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px',
        maxWidth: '340px', width: 'calc(100vw - 40px)',
      }}>
        {toasts.map(t => {
          const k = KLEUREN[t.type] || KLEUREN.info;
          return (
            <div key={t.id} style={{
              background: k.bg, border: `1px solid ${k.border}`,
              borderRadius: '10px', padding: '12px 14px',
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
              animation: 'slideIn 0.2s ease',
            }}>
              <span style={{ color: k.kleur, fontWeight: '700', fontSize: '16px', lineHeight: 1.2, flexShrink: 0 }}>
                {k.icon}
              </span>
              <span style={{ flex: 1, color: C.textPrimary, fontSize: '13px', lineHeight: 1.5 }}>
                {t.bericht}
              </span>
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {t.onUndo && (
                  <button onClick={() => { t.onUndo(); sluit(t.id); }}
                    style={{ background: 'none', border: `1px solid ${k.border}`, borderRadius: '5px', color: k.kleur, cursor: 'pointer', fontSize: '12px', fontWeight: '600', padding: '2px 8px' }}>
                    Ongedaan
                  </button>
                )}
                <button onClick={() => sluit(t.id)}
                  style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px' }}>
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

/**
 * useToast() — geeft een toast(options)-functie terug.
 * toast({ bericht: 'Opgeslagen!', type: 'success', duur: 4000, onUndo: () => {} })
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast moet binnen <ToastProvider> gebruikt worden');
  return ctx;
}
