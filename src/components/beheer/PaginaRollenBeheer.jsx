// src/components/beheer/PaginaRollenBeheer.jsx
import React, { useState, useEffect } from 'react';
import { getPaginaRollen, setPaginaRollen } from '../../services/firestoreService';
import { S } from './beheerStyles';
import { ALLE_PAGINAS, ROLLEN, ROL_LABELS, ROL_STANDAARD_PAGINAS } from '../../config/appConfig';
import { C, cardStyle, buttonStyle, badgeStyle, chipStyle, inputStyle } from '../../styles/tokens';

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

  const slaOp = async () => {
    setOpslaan(true);
    await setPaginaRollen(config);
    setOpslaan(false);
    setSucces(true);
    setTimeout(() => setSucces(false), 2000);
  };

  if (laden) return <div style={{ color: 'var(--text-secondary)', padding: '12px' }}>Laden...</div>;

  return (
    <div>
      {succes && <div style={S.successMsg}>Opgeslagen!</div>}

      {ROLLEN.map(rol => (
        <div key={rol} style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--accent-red)', marginBottom: '10px' }}>
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
                    background: actief ? 'var(--accent-red)' : 'var(--bg-primary)',
                    border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`,
                    color: 'var(--text-primary)',
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
