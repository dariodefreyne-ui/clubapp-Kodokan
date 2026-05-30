// src/components/beheer/PaginaRollenBeheer.jsx
import React, { useState, useEffect } from 'react';
import { getPaginaRollen, setPaginaRollen } from '../../services/firestoreService';
import { C, buttonStyle, cardStyle } from '../../styles/tokens';
import { ALLE_PAGINAS, NAV_GROEPEN, ROLLEN, ROL_LABELS, ROL_STANDAARD_PAGINAS } from '../../config/appConfig';

// Pagina's die voor élke rol altijd zichtbaar zijn (niet configureerbaar).
// Spiegelt de harde regels in App.jsx (SidebarInhoud).
const ALTIJD_AAN = ['/', '/profiel'];
// Pagina's die altijd enkel voor admin/bestuurslid zijn — ongeacht config.
// Spiegelt App.jsx: `if (pad === '/bestuur') return isBeheerder;` e.d.
const ENKEL_BEHEER = ['/bestuur', '/beheer'];

// Toont voor een pagina+rol of die vergrendeld is, en zo ja in welke stand.
// Geeft 'on' / 'off' (vergrendeld) of null (gewone toggle) terug.
function vergrendeling(rol, pad) {
  if (ALTIJD_AAN.includes(pad)) return 'on';
  if (ENKEL_BEHEER.includes(pad)) return (rol === 'admin' || rol === 'bestuurslid') ? 'on' : 'off';
  return null;
}

// Groepen worden dynamisch uit ALLE_PAGINAS + NAV_GROEPEN opgebouwd, zodat
// élke pagina automatisch verschijnt en er nooit één stilletjes kan ontbreken.
const GROEP_LABEL_FALLBACK = { club: 'Algemeen', account: 'Account' };
const PAGE_GROEPEN = NAV_GROEPEN
  .map(g => ({
    label: g.label || GROEP_LABEL_FALLBACK[g.id] || g.id,
    paden: ALLE_PAGINAS.filter(p => p.groep === g.id).map(p => p.pad),
  }))
  .filter(g => g.paden.length > 0);

const ROL_KLEUREN = {
  admin:       { fg: C.red,    bg: C.redDim },
  bestuurslid: { fg: C.blue,   bg: C.blueDim },
  trainer:     { fg: C.green,  bg: C.greenDim },
  assistent:   { fg: C.purple, bg: C.purpleDim },
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
  const [ingeklapt, setIngeklapt] = useState(() =>
    Object.fromEntries(ROLLEN.map(r => [r, true]))
  );

  const toggleIngeklapt = (rol) => setIngeklapt(prev => ({ ...prev, [rol]: !prev[rol] }));

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {ROLLEN.map(rol => {
          const kleur = ROL_KLEUREN[rol];
          const actievePads = config[rol] || [];
          // Effectief zichtbaar = vergrendeld-aan + ingeschakelde toggles.
          const isZichtbaar = (pad) => {
            const slot = vergrendeling(rol, pad);
            return slot ? slot === 'on' : actievePads.includes(pad);
          };
          const totaal = ALLE_PAGINAS.length;
          const aantalActief = ALLE_PAGINAS.filter(p => isZichtbaar(p.pad)).length;
          const pct = Math.round((aantalActief / totaal) * 100);
          const gesloten = !!ingeklapt[rol];

          return (
            <div key={rol} style={{ ...cardStyle(), borderTop: `3px solid ${kleur.fg}` }}>
              {/* Rol header */}
              <div
                onClick={() => toggleIngeklapt(rol)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: gesloten ? 0 : '10px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: '800', color: kleur.fg }}>
                      {ROL_LABELS[rol]}
                    </div>
                    <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>
                      {aantalActief} / {totaal} pagina's actief
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={e => { e.stopPropagation(); resetRol(rol); }}
                    style={{
                      background: 'transparent', border: `1px solid ${C.borderSoft}`,
                      borderRadius: '6px', padding: '3px 8px', color: C.textMuted,
                      cursor: 'pointer', fontSize: '11px', flexShrink: 0,
                    }}
                  >
                    ↺ Reset
                  </button>
                  <span style={{ color: C.textMuted, fontSize: '16px', lineHeight: 1, userSelect: 'none' }}>
                    {gesloten ? '▶' : '▼'}
                  </span>
                </div>
              </div>

              {!gesloten && (
                <>
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
                            const slot = vergrendeling(rol, p.pad);
                            const vergrendeld = slot !== null;
                            const actief = vergrendeld ? slot === 'on' : actievePads.includes(p.pad);
                            return (
                              <div
                                key={p.pad}
                                onClick={vergrendeld ? undefined : () => togglePagina(rol, p.pad)}
                                title={vergrendeld
                                  ? (ALTIJD_AAN.includes(p.pad) ? 'Altijd zichtbaar voor elke rol' : 'Altijd enkel voor admin & bestuurslid')
                                  : undefined}
                                style={{
                                  display: 'flex', justifyContent: 'space-between',
                                  alignItems: 'center', padding: '7px 8px', borderRadius: '8px',
                                  cursor: vergrendeld ? 'not-allowed' : 'pointer',
                                  transition: 'background 0.15s',
                                  background: actief ? kleur.bg : 'transparent',
                                  opacity: vergrendeld ? 0.6 : 1,
                                }}
                              >
                                <span style={{
                                  fontSize: '13px', fontWeight: actief ? '600' : '400',
                                  color: actief ? kleur.fg : C.textSec,
                                }}>
                                  {p.icon} {p.label}
                                  {vergrendeld && <span style={{ marginLeft: '6px' }}>🔒</span>}
                                </span>
                                <ToggleSwitch actief={actief} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
