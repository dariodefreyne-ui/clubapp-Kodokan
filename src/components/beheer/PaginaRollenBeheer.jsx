// src/components/beheer/PaginaRollenBeheer.jsx
import React, { useState, useEffect } from 'react';
import { getPaginaRollen, setPaginaRollen } from '../../services/firestoreService';
import { C, buttonStyle, cardStyle } from '../../styles/tokens';
import { ALLE_PAGINAS, ROLLEN, ROL_LABELS, ROL_STANDAARD_PAGINAS } from '../../config/appConfig';

const PAGE_GROEPEN = [
  { label: 'Club & Leden',        paden: ['/trainingen', '/leden', '/agenda'] },
  { label: 'Competitie & Groei',  paden: ['/wedstrijden', '/examens', '/technieken'] },
  { label: 'Financieel',          paden: ['/uitbetalingen', '/winkel', '/rapporten'] },
  { label: 'Communicatie',        paden: ['/communicatie', '/documenten', '/eetfestijn', '/evenementen'] },
  { label: 'Systeem',             paden: ['/beheer', '/profiel', '/instellingen'] },
];

const ROL_KLEUREN = {
  admin:       { fg: C.red,    bg: C.redDim },
  bestuurslid: { fg: C.blue,   bg: C.blueDim },
  trainer:     { fg: C.green,  bg: C.greenDim },
  lid:         { fg: C.orange, bg: C.orangeDim },
};

function getPagina(pad) {
  return ALLE_PAGINAS.find(p => p.pad === pad);
}

function ToggleSwitch({ actief }) {
  return (
    <div style={{
      width: '36px', height: '20px', borderRadius: '10px', flexShrink: 0,
      background: actief ? C.red : C.borderSoft,
      position: 'relative', transition: 'background 0.2s', cursor: 'pointer',
    }}>
      <div style={{
        width: '16px', height: '16px', borderRadius: '50%', background: '#fff',
        position: 'absolute', top: '2px', transition: 'left 0.18s',
        left: actief ? '18px' : '2px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </div>
  );
}

// ─── VOORSTEL 1: Rol-kaarten ──────────────────────────────────────────────────
function VoorstelRolKaarten({ config, onToggle, onResetRol }) {
  return (
    <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
      {ROLLEN.map(rol => {
        const kleur = ROL_KLEUREN[rol];
        const actievePads = config[rol] || [];
        const totaal = ALLE_PAGINAS.length;
        const pct = Math.round((actievePads.length / totaal) * 100);

        return (
          <div key={rol} style={{
            ...cardStyle(),
            borderTop: `3px solid ${kleur.fg}`,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Rol header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: kleur.fg }}>
                  {ROL_LABELS[rol]}
                </div>
                <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
                  {actievePads.length} / {totaal} pagina's actief
                </div>
              </div>
              <button
                onClick={() => onResetRol(rol)}
                style={{
                  background: 'transparent', border: `1px solid ${C.borderSoft}`,
                  borderRadius: '6px', padding: '3px 8px', color: C.textMuted,
                  cursor: 'pointer', fontSize: '11px', flexShrink: 0,
                }}
              >
                ↺ Reset
              </button>
            </div>

            {/* Voortgangsbalk */}
            <div style={{ height: '4px', background: C.borderSoft, borderRadius: '2px', marginBottom: '16px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '2px', background: kleur.fg,
                width: `${pct}%`, transition: 'width 0.3s',
              }} />
            </div>

            {/* Pagina groepen */}
            {PAGE_GROEPEN.map(groep => {
              const groepPaginas = groep.paden.map(getPagina).filter(Boolean);
              return (
                <div key={groep.label} style={{ marginBottom: '14px' }}>
                  <div style={{
                    fontSize: '10px', fontWeight: '700', color: C.textMuted,
                    textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px',
                  }}>
                    {groep.label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {groepPaginas.map(p => {
                      const actief = actievePads.includes(p.pad);
                      return (
                        <div
                          key={p.pad}
                          onClick={() => onToggle(rol, p.pad)}
                          style={{
                            display: 'flex', justifyContent: 'space-between',
                            alignItems: 'center', padding: '7px 8px', borderRadius: '8px',
                            cursor: 'pointer', transition: 'background 0.15s',
                            background: actief ? kleur.bg : 'transparent',
                          }}
                        >
                          <span style={{
                            fontSize: '13px', fontWeight: actief ? '600' : '400',
                            color: actief ? kleur.fg : C.textSec,
                          }}>
                            {p.icon} {p.label}
                          </span>
                          <ToggleSwitch actief={actief} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── VOORSTEL 2: Permissie-matrix ─────────────────────────────────────────────
function VoorstelMatrix({ config, onToggle, onAllesVoorRol }) {
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
        <colgroup>
          <col style={{ width: '44%' }} />
          {ROLLEN.map(rol => <col key={rol} style={{ width: '14%' }} />)}
        </colgroup>

        <thead>
          <tr>
            <th style={{
              textAlign: 'left', padding: '8px 10px 12px',
              fontSize: '11px', fontWeight: '700', color: C.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.07em',
              borderBottom: `2px solid ${C.borderSoft}`,
            }}>
              Pagina
            </th>
            {ROLLEN.map(rol => {
              const kleur = ROL_KLEUREN[rol];
              const aantalActief = (config[rol] || []).length;
              const totaal = ALLE_PAGINAS.length;
              const alleActief = aantalActief === totaal;
              return (
                <th key={rol} style={{
                  textAlign: 'center', padding: '8px 4px 12px',
                  borderBottom: `2px solid ${C.borderSoft}`,
                }}>
                  <div style={{ fontSize: '13px', fontWeight: '800', color: kleur.fg, marginBottom: '3px' }}>
                    {ROL_LABELS[rol]}
                  </div>
                  <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '6px' }}>
                    {aantalActief}/{totaal}
                  </div>
                  <button
                    onClick={() => onAllesVoorRol(rol, !alleActief)}
                    style={{
                      fontSize: '10px', borderRadius: '5px', padding: '2px 7px',
                      cursor: 'pointer', fontWeight: '600',
                      background: alleActief ? kleur.bg : 'transparent',
                      border: `1px solid ${alleActief ? kleur.fg : C.borderSoft}`,
                      color: alleActief ? kleur.fg : C.textMuted,
                    }}
                  >
                    {alleActief ? '− Alles uit' : '+ Alles aan'}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {PAGE_GROEPEN.map(groep => (
            <React.Fragment key={groep.label}>
              <tr>
                <td colSpan={ROLLEN.length + 1} style={{
                  padding: '14px 10px 5px',
                  fontSize: '10px', fontWeight: '700', color: C.textMuted,
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                }}>
                  {groep.label}
                </td>
              </tr>
              {groep.paden.map((pad, idx) => {
                const p = getPagina(pad);
                if (!p) return null;
                const isLast = idx === groep.paden.length - 1;
                return (
                  <tr key={pad} style={{
                    borderBottom: `1px solid ${isLast ? C.borderSoft : 'rgba(42,63,90,0.4)'}`,
                  }}>
                    <td style={{ padding: '9px 10px', fontSize: '13px', color: C.textPrimary }}>
                      {p.icon} {p.label}
                    </td>
                    {ROLLEN.map(rol => {
                      const kleur = ROL_KLEUREN[rol];
                      const actief = (config[rol] || []).includes(pad);
                      return (
                        <td key={rol} style={{ textAlign: 'center', padding: '6px 4px' }}>
                          <div
                            onClick={() => onToggle(rol, pad)}
                            style={{
                              width: '28px', height: '28px', borderRadius: '8px',
                              margin: '0 auto', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              background: actief ? kleur.bg : 'transparent',
                              border: `2px solid ${actief ? kleur.fg : C.borderSoft}`,
                              transition: 'all 0.15s',
                            }}
                          >
                            {actief && (
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <path d="M2 6.5L5 9.5L11 3.5" stroke={kleur.fg} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── HOOFD COMPONENT ──────────────────────────────────────────────────────────
export default function PaginaRollenBeheer() {
  const [config, setConfig] = useState(null);
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [succes, setSucces] = useState(false);
  const [weergave, setWeergave] = useState('kaarten');

  useEffect(() => {
    getPaginaRollen().then(data => {
      setConfig(data || ROL_STANDAARD_PAGINAS);
      setLaden(false);
    });
  }, []);

  const togglePagina = (rol, pad) => {
    setConfig(prev => {
      const huidig = prev[rol] || [];
      const nieuw = huidig.includes(pad)
        ? huidig.filter(p => p !== pad)
        : [...huidig, pad];
      return { ...prev, [rol]: nieuw };
    });
  };

  const resetRol = (rol) => {
    setConfig(prev => ({ ...prev, [rol]: [...ROL_STANDAARD_PAGINAS[rol]] }));
  };

  const allesVoorRol = (rol, aanZetten) => {
    setConfig(prev => ({
      ...prev,
      [rol]: aanZetten ? ALLE_PAGINAS.map(p => p.pad) : [],
    }));
  };

  const slaOp = async () => {
    setOpslaan(true);
    await setPaginaRollen(config);
    setOpslaan(false);
    setSucces(true);
    setTimeout(() => setSucces(false), 2500);
  };

  if (laden) return <div style={{ color: C.textMuted, padding: '12px' }}>Laden...</div>;

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '10px', marginBottom: '20px',
      }}>
        {/* Weergave-toggle */}
        <div style={{
          display: 'flex', gap: '3px', background: C.bg,
          borderRadius: '10px', padding: '4px',
          border: `1px solid ${C.borderSoft}`,
        }}>
          {[
            { id: 'kaarten', label: '⊞ Rol-kaarten' },
            { id: 'matrix',  label: '☰ Matrix' },
          ].map(v => (
            <button
              key={v.id}
              onClick={() => setWeergave(v.id)}
              style={{
                background: weergave === v.id ? C.card : 'transparent',
                border: `1px solid ${weergave === v.id ? C.borderSoft : 'transparent'}`,
                color: weergave === v.id ? C.textPrimary : C.textMuted,
                borderRadius: '7px', padding: '6px 14px', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600', transition: 'all 0.15s',
              }}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* Opslaan */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {succes && (
            <span style={{ color: C.green, fontSize: '13px', fontWeight: '700' }}>
              ✓ Opgeslagen!
            </span>
          )}
          <button onClick={slaOp} disabled={opslaan} style={buttonStyle('primary')}>
            {opslaan ? 'Opslaan...' : '✓ Opslaan'}
          </button>
        </div>
      </div>

      {/* Beschrijving per weergave */}
      {weergave === 'kaarten' && (
        <p style={{ fontSize: '13px', color: C.textMuted, margin: '0 0 16px' }}>
          Beheer de pagina-toegang per rol. Klik op een rij om een pagina aan of uit te zetten.
          Gebruik ↺ Reset om een rol naar de standaardinstellingen terug te zetten.
        </p>
      )}
      {weergave === 'matrix' && (
        <p style={{ fontSize: '13px', color: C.textMuted, margin: '0 0 16px' }}>
          Overzicht van alle rollen naast elkaar. Klik een vakje om toegang te verlenen of in te trekken.
          Gebruik "+ Alles aan / − Alles uit" per kolom voor snelle aanpassingen.
        </p>
      )}

      {weergave === 'kaarten' && (
        <VoorstelRolKaarten config={config} onToggle={togglePagina} onResetRol={resetRol} />
      )}
      {weergave === 'matrix' && (
        <VoorstelMatrix config={config} onToggle={togglePagina} onAllesVoorRol={allesVoorRol} />
      )}
    </div>
  );
}
