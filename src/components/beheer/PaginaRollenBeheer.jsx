// src/components/beheer/PaginaRollenBeheer.jsx
import React, { useState, useEffect } from 'react';
import { getPaginaRollen, setPaginaRollen } from '../../services/firestoreService';
import { C, buttonStyle, cardStyle } from '../../styles/tokens';
import { ALLE_PAGINAS, ROLLEN, ROL_LABELS, ROL_STANDAARD_PAGINAS } from '../../config/appConfig';

const PAGE_GROEPEN = [
  { label: 'Club & Leden',       paden: ['/trainingen', '/leden', '/agenda'] },
  { label: 'Competitie & Groei', paden: ['/wedstrijden', '/examens', '/technieken'] },
  { label: 'Financieel',         paden: ['/uitbetalingen', '/winkel', '/rapporten'] },
  { label: 'Communicatie',       paden: ['/communicatie', '/documenten', '/eetfestijn', '/evenementen'] },
  { label: 'Systeem',            paden: ['/beheer', '/profiel', '/instellingen'] },
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

export default function PaginaRollenBeheer() {
  const [config, setConfig] = useState(null);
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [succes, setSucces] = useState(false);

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
        <p style={{ fontSize: '13px', color: C.textMuted, margin: 0 }}>
          Klik op een rij om een pagina aan of uit te zetten per rol.
          Gebruik ↺ Reset om een rol naar de standaardinstellingen terug te zetten.
        </p>
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

      {/* Rol-kaarten */}
      <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
        {ROLLEN.map(rol => {
          const kleur = ROL_KLEUREN[rol];
          const actievePads = config[rol] || [];
          const totaal = ALLE_PAGINAS.length;
          const pct = Math.round((actievePads.length / totaal) * 100);

          return (
            <div key={rol} style={{ ...cardStyle(), borderTop: `3px solid ${kleur.fg}` }}>
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
                  onClick={() => resetRol(rol)}
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
                            onClick={() => togglePagina(rol, p.pad)}
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
    </div>
  );
}
