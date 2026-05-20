// src/components/beheer/GroepenBeheer.jsx
import React, { useState, useEffect } from 'react';
import {
  getAllGroepen,
  updateGroepDuur,
  updateGroepCategorieen,
  updateGroepTijden,
  berekenDuurMinuten,
} from '../../services/firestoreService';
import { LEEFTIJDSCATEGORIEEN } from '../../config/appConfig';
import { C } from '../../styles/tokens';

export default function GroepenBeheer() {
  const [groepen, setGroepen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [tijdInputs, setTijdInputs] = useState({});

  useEffect(() => {
    getAllGroepen().then(groepen => {
      const gesorteerd = groepen.sort((a, b) => a.naam.localeCompare(b.naam));
      setGroepen(gesorteerd);
      const initieel = {};
      gesorteerd.forEach(g => {
        initieel[g.id] = { start: g.startTijd || '', eind: g.eindTijd || '', fout: null };
      });
      setTijdInputs(initieel);
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

  const updateTijdVeld = (groepId, veld, waarde) => {
    setTijdInputs(prev => ({
      ...prev,
      [groepId]: { ...(prev[groepId] || {}), [veld]: waarde, fout: null },
    }));
  };

  const opslaanTijden = async (groep) => {
    const t = tijdInputs[groep.id] || {};
    const ok = await updateGroepTijden(groep.id, t.start, t.eind);
    if (!ok) {
      setTijdInputs(prev => ({
        ...prev,
        [groep.id]: { ...t, fout: 'Eindtijd moet later zijn dan starttijd' },
      }));
      return;
    }
    const nieuweDuur = berekenDuurMinuten(t.start, t.eind);
    setGroepen(prev => prev.map(g =>
      g.id === groep.id
        ? { ...g, startTijd: t.start, eindTijd: t.eind, duurMinuten: nieuweDuur }
        : g
    ));
    setTijdInputs(prev => ({ ...prev, [groep.id]: { ...t, fout: null } }));
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

      {groepen.map(g => {
        const t = tijdInputs[g.id] || {};
        const heeftKlokuren = !!(g.startTijd && g.eindTijd);
        const beideIngevuld = !!(t.start && t.eind);
        const geldig = beideIngevuld && berekenDuurMinuten(t.start, t.eind) !== null;
        return (
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
              {heeftKlokuren && (
                <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '6px', fontStyle: 'italic' }}>
                  Duur is afgeleid van klokuren. Pas klokuren aan om te wijzigen.
                </div>
              )}
            </div>

            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Klokuren</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="time"
                  value={t.start || ''}
                  onChange={e => updateTijdVeld(g.id, 'start', e.target.value)}
                  style={{
                    padding: '6px 8px',
                    background: C.bg,
                    border: `1px solid ${C.borderSoft}`,
                    borderRadius: '6px',
                    color: C.textPrimary,
                    fontSize: '13px',
                  }}
                />
                <span style={{ color: C.textMuted, fontSize: '12px' }}>–</span>
                <input
                  type="time"
                  value={t.eind || ''}
                  onChange={e => updateTijdVeld(g.id, 'eind', e.target.value)}
                  style={{
                    padding: '6px 8px',
                    background: C.bg,
                    border: `1px solid ${C.borderSoft}`,
                    borderRadius: '6px',
                    color: C.textPrimary,
                    fontSize: '13px',
                  }}
                />
                <button
                  onClick={() => opslaanTijden(g)}
                  disabled={!geldig}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    cursor: geldig ? 'pointer' : 'not-allowed',
                    fontSize: '12px',
                    fontWeight: '600',
                    background: geldig ? C.redDim : 'transparent',
                    border: `1px solid ${geldig ? C.red : C.borderSoft}`,
                    color: geldig ? C.red : C.textMuted,
                    opacity: geldig ? 1 : 0.6,
                  }}
                >
                  Opslaan
                </button>
              </div>
              <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '4px' }}>
                Duur wordt automatisch berekend
              </div>
              {t.fout && (
                <div style={{ fontSize: '12px', color: C.red, marginTop: '4px' }}>
                  {t.fout}
                </div>
              )}
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
        );
      })}
    </div>
  );
}
