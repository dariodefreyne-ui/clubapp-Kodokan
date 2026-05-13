// src/components/beheer/GroepenBeheer.jsx
import React, { useState, useEffect } from 'react';
import { getAllGroepen, updateGroepDuur, updateGroepCategorieen } from '../../services/firestoreService';
import { LEEFTIJDSCATEGORIEEN } from '../../config/appConfig';
import { C } from '../../styles/tokens';

export default function GroepenBeheer() {
  const [groepen, setGroepen] = useState([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    getAllGroepen().then(groepen => {
      setGroepen(groepen.sort((a, b) => a.naam.localeCompare(b.naam)));
      setLaden(false);
    });
  }, []);

  const updateDuur = async (groep, duurMinuten) => {
    const duur = parseInt(duurMinuten);
    if (isNaN(duur) || duur <= 0) return;
    await updateGroepDuur(groep.id, duur);
    setGroepen(prev => prev.map(g => g.id === groep.id ? { ...g, duurMinuten: duur } : g));
  };

  const toggleCategorie = async (groep, cat) => {
    const huidig = groep.categorieen || [];
    const nieuw = huidig.includes(cat)
      ? huidig.filter(c => c !== cat)
      : [...huidig, cat];
    await updateGroepCategorieen(groep.id, nieuw);
    setGroepen(prev => prev.map(g => g.id === groep.id ? { ...g, categorieen: nieuw } : g));
  };

  if (laden) return <div style={{ color: '#aaa', padding: '12px' }}>Laden...</div>;

  if (groepen.length === 0) {
    return (
      <div style={{ color: '#666', fontSize: '13px', padding: '12px' }}>
        Geen groepen gevonden. Groepen worden aangemaakt bij het importeren van trainingen.
      </div>
    );
  }

  return (
    <div>
      <p style={{ color: '#aaa', fontSize: '13px', marginTop: 0, marginBottom: '12px' }}>
        Stel de standaard trainingsduur per groep in. Deze wordt automatisch overgenomen bij nieuwe trainingen en is manueel aanpasbaar per training.
      </p>

      {groepen.map(g => (
        <div key={g.id} style={{ padding: '14px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff' }}>{g.naam}</div>
            {g.dag && <div style={{ fontSize: '12px', color: '#666', marginTop: '2px' }}>{g.dag}</div>}
          </div>

          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trainingsduur</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[45, 60, 90, 120].map(min => (
                <button
                  key={min}
                  onClick={() => updateDuur(g, min)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: g.duurMinuten === min ? C.redDim : 'transparent',
                    border: `1px solid ${g.duurMinuten === min ? C.red : C.borderSoft}`,
                    color: g.duurMinuten === min ? C.red : C.textMuted,
                  }}
                >
                  {min >= 60 ? `${Math.floor(min / 60)}u${min % 60 ? (min % 60) + 'min' : ''}` : `${min}min`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Leeftijdscategorieen</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {LEEFTIJDSCATEGORIEEN.map(cat => {
                const actief = (g.categorieen || []).includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategorie(g, cat)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      background: actief ? 'rgba(41,128,185,0.2)' : 'transparent',
                      border: `1px solid ${actief ? '#2980b9' : C.borderSoft}`,
                      color: actief ? '#2980b9' : C.textMuted,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
