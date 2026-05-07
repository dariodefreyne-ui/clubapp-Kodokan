// src/components/beheer/PaginaRollenBeheer.jsx
import React, { useState, useEffect } from 'react';
import { getPaginaRollen, setPaginaRollen } from '../../services/firestoreService';
import { S } from './beheerStyles';

const ALLE_PAGINAS = [
  { pad: '/trainingen', label: 'Trainingen', icon: '📅' },
  { pad: '/leden', label: 'Leden', icon: '👥' },
  { pad: '/wedstrijden', label: 'Wedstrijden', icon: '🏆' },
  { pad: '/examens', label: 'Examens', icon: '📘' },
  { pad: '/technieken', label: 'Technieken', icon: '🥋' },
  { pad: '/uitbetalingen', label: 'Uitbetalingen', icon: '💶' },
  { pad: '/winkel', label: 'Winkel', icon: '🛒' },
  { pad: '/rapporten', label: 'Rapporten', icon: '📊' },
  { pad: '/communicatie', label: 'Communicatie', icon: '📣' },
  { pad: '/documenten', label: 'Documenten', icon: '📁' },
  { pad: '/eetfestijn', label: 'Eetfestijn', icon: '🍝' },
  { pad: '/agenda', label: 'Agenda', icon: '📅' },
  { pad: '/evenementen', label: 'Evenementen', icon: '🎉' },
  { pad: '/beheer', label: 'Beheer', icon: '🔧' },
];

const ROLLEN = ['beheerder', 'trainer', 'lid'];
const ROL_LABELS = { beheerder: 'Beheerder', trainer: 'Trainer', lid: 'Lid' };
const ROL_STANDAARD = {
  beheerder: ['/trainingen', '/leden', '/wedstrijden', '/examens', '/technieken', '/uitbetalingen', '/winkel', '/rapporten', '/communicatie', '/documenten', '/eetfestijn', '/agenda', '/evenementen', '/beheer'],
  trainer: ['/trainingen', '/wedstrijden', '/examens', '/uitbetalingen', '/winkel', '/communicatie', '/agenda'],
  lid: ['/wedstrijden', '/examens', '/communicatie', '/agenda'],
};

export default function PaginaRollenBeheer() {
  const [config, setConfig] = useState(null);
  const [laden, setLaden] = useState(true);
  const [opslaan, setOpslaan] = useState(false);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    getPaginaRollen().then(data => {
      setConfig(data || ROL_STANDAARD);
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

  const slaOp = async () => {
    setOpslaan(true);
    await setPaginaRollen(config);
    setOpslaan(false);
    setSucces(true);
    setTimeout(() => setSucces(false), 2000);
  };

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  return (
    <div>
      {succes && <div style={S.successMsg}>Opgeslagen!</div>}

      {ROLLEN.map(rol => (
        <div key={rol} style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: '#c0392b', marginBottom: '10px' }}>
            {ROL_LABELS[rol]}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {ALLE_PAGINAS.map(p => {
              const actief = (config[rol] || []).includes(p.pad);
              return (
                <button
                  key={p.pad}
                  onClick={() => togglePagina(rol, p.pad)}
                  style={{
                    background: actief ? '#c0392b' : '#1a1a1a',
                    border: `1px solid ${actief ? '#c0392b' : '#3a3a3a'}`,
                    color: '#fff',
                    padding: '8px 14px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: actief ? '600' : '400',
                  }}
                >
                  {p.icon} {p.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button onClick={slaOp} disabled={opslaan} style={S.btn('primary')}>
        {opslaan ? 'Opslaan...' : 'Opslaan'}
      </button>
    </div>
  );
}
