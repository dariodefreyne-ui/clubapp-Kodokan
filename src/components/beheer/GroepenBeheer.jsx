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
import { C, cardStyle } from '../../styles/tokens';

function duurLabel(min) {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const u = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${u}u${m}min` : `${u}u`;
}

function GroepDetail({ groep: initGroep, onTerug }) {
  const [groep, setGroep] = useState(initGroep);
  const [tijdInputs, setTijdInputs] = useState({
    start: initGroep.startTijd || '',
    eind: initGroep.eindTijd || '',
    fout: null,
  });
  const [opgeslagen, setOpgeslagen] = useState(false);

  const updateDuur = async (min) => {
    await updateGroepDuur(groep.id, min);
    setGroep(prev => ({ ...prev, duurMinuten: min }));
    flashOpgeslagen();
  };

  const toggleCategorie = async (cat) => {
    const huidig = groep.categorieen || [];
    const nieuw = huidig.includes(cat) ? huidig.filter(c => c !== cat) : [...huidig, cat];
    await updateGroepCategorieen(groep.id, nieuw);
    setGroep(prev => ({ ...prev, categorieen: nieuw }));
  };

  const opslaanTijden = async () => {
    const ok = await updateGroepTijden(groep.id, tijdInputs.start, tijdInputs.eind);
    if (!ok) {
      setTijdInputs(prev => ({ ...prev, fout: 'Eindtijd moet later zijn dan starttijd' }));
      return;
    }
    const nieuweDuur = berekenDuurMinuten(tijdInputs.start, tijdInputs.eind);
    setGroep(prev => ({ ...prev, startTijd: tijdInputs.start, eindTijd: tijdInputs.eind, duurMinuten: nieuweDuur }));
    setTijdInputs(prev => ({ ...prev, fout: null }));
    flashOpgeslagen();
  };

  function flashOpgeslagen() {
    setOpgeslagen(true);
    setTimeout(() => setOpgeslagen(false), 2000);
  }

  const heeftKlokuren = !!(groep.startTijd && groep.eindTijd);
  const beideIngevuld = !!(tijdInputs.start && tijdInputs.eind);
  const geldig = beideIngevuld && berekenDuurMinuten(tijdInputs.start, tijdInputs.eind) !== null;

  const secStyle = {
    background: 'var(--bg-primary)', border: `1px solid ${C.borderSoft}`,
    borderRadius: '12px', padding: '16px', marginBottom: '12px',
  };
  const labelStyle = { fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', fontWeight: '700' };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button
          onClick={onTerug}
          style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', fontSize: '14px', fontWeight: '600', padding: 0 }}
        >
          ← Groepen
        </button>
        {opgeslagen && (
          <span style={{ color: C.green, fontSize: '13px', fontWeight: '700' }}>✓ Opgeslagen</span>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: '800', color: C.textPrimary }}>{groep.naam}</h2>
        {groep.dag && <div style={{ fontSize: '13px', color: C.textSec }}>{groep.dag}</div>}
      </div>

      {/* Trainingsduur */}
      <div style={secStyle}>
        <div style={labelStyle}>Trainingsduur</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[45, 60, 90, 120].map(min => {
            const actief = groep.duurMinuten === min;
            return (
              <button
                key={min}
                onClick={() => updateDuur(min)}
                style={{
                  padding: '8px 16px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '600',
                  background: actief ? C.redDim : 'transparent',
                  border: `1px solid ${actief ? C.red : C.borderSoft}`,
                  color: actief ? C.red : C.textSec,
                }}
              >
                {duurLabel(min)}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '10px' }}>
          Huidige duur: <strong style={{ color: C.textPrimary }}>{duurLabel(groep.duurMinuten)}</strong>
          {heeftKlokuren && ' (afgeleid van klokuren)'}
        </div>
      </div>

      {/* Klokuren */}
      <div style={secStyle}>
        <div style={labelStyle}>Klokuren</div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: C.textSec, minWidth: '30px' }}>Van</label>
            <input
              type="time"
              value={tijdInputs.start || ''}
              onChange={e => setTijdInputs(prev => ({ ...prev, start: e.target.value, fout: null }))}
              style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: C.textSec, minWidth: '30px' }}>Tot</label>
            <input
              type="time"
              value={tijdInputs.eind || ''}
              onChange={e => setTijdInputs(prev => ({ ...prev, eind: e.target.value, fout: null }))}
              style={{ padding: '8px 10px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px' }}
            />
          </div>
          <button
            onClick={opslaanTijden}
            disabled={!geldig}
            style={{
              padding: '8px 16px', borderRadius: '8px', cursor: geldig ? 'pointer' : 'not-allowed',
              fontSize: '13px', fontWeight: '700',
              background: geldig ? C.redDim : 'transparent',
              border: `1px solid ${geldig ? C.red : C.borderSoft}`,
              color: geldig ? C.red : C.textMuted,
              opacity: geldig ? 1 : 0.5,
            }}
          >
            Opslaan
          </button>
        </div>
        <div style={{ fontSize: '12px', color: C.textMuted }}>Duur wordt automatisch berekend vanuit klokuren</div>
        {tijdInputs.fout && <div style={{ fontSize: '12px', color: C.red, marginTop: '6px' }}>{tijdInputs.fout}</div>}
      </div>

      {/* Leeftijdscategorieën */}
      <div style={secStyle}>
        <div style={labelStyle}>Leeftijdscategorieën</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {LEEFTIJDSCATEGORIEEN.map(cat => {
            const actief = (groep.categorieen || []).includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleCategorie(cat)}
                style={{
                  padding: '6px 14px', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '13px', fontWeight: '600',
                  background: actief ? C.blueDim : 'transparent',
                  border: `1px solid ${actief ? C.blue : C.borderSoft}`,
                  color: actief ? C.blue : C.textSec,
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>
        {(groep.categorieen || []).length > 0 && (
          <div style={{ fontSize: '12px', color: C.textSec, marginTop: '10px' }}>
            Geselecteerd: {(groep.categorieen || []).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

export default function GroepenBeheer() {
  const [groepen, setGroepen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [activeGroepId, setActiveGroepId] = useState(null);

  useEffect(() => {
    getAllGroepen().then(g => {
      setGroepen(g.sort((a, b) => a.naam.localeCompare(b.naam)));
      setLaden(false);
    });
  }, []);

  if (laden) return <div style={{ color: C.textSec, padding: '12px' }}>Laden...</div>;

  if (groepen.length === 0) {
    return (
      <div style={{ color: C.textMuted, fontSize: '14px', padding: '20px 0', textAlign: 'center' }}>
        Geen groepen gevonden. Groepen worden aangemaakt bij het importeren van trainingen.
      </div>
    );
  }

  if (activeGroepId) {
    const groep = groepen.find(g => g.id === activeGroepId);
    if (!groep) { setActiveGroepId(null); return null; }
    return (
      <GroepDetail
        groep={groep}
        onTerug={() => setActiveGroepId(null)}
      />
    );
  }

  // Tegels
  return (
    <div>
      <p style={{ color: C.textSec, fontSize: '13px', marginTop: 0, marginBottom: '16px' }}>
        Klik op een groep om de trainingsduur, klokuren en leeftijdscategorieën in te stellen.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        {groepen.map(g => {
          const aantalCats = (g.categorieen || []).length;
          return (
            <button
              key={g.id}
              onClick={() => setActiveGroepId(g.id)}
              style={{
                background: C.card, border: `1px solid ${C.borderSoft}`,
                borderRadius: '16px', padding: '18px 16px',
                cursor: 'pointer', textAlign: 'left',
                display: 'flex', flexDirection: 'column', gap: '10px',
                position: 'relative', overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', top: 0, right: 0, width: '70px', height: '70px',
                background: `radial-gradient(circle at top right, ${C.greenDim}, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <div style={{
                width: '42px', height: '42px', background: C.greenDim, borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
              }}>
                🥋
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: C.textPrimary, marginBottom: '4px' }}>
                  {g.naam}
                </div>
                {g.dag && (
                  <div style={{ fontSize: '12px', color: C.textSec, marginBottom: '4px' }}>{g.dag}</div>
                )}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {g.duurMinuten ? (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                      background: C.redDim, color: C.red, fontWeight: '600',
                    }}>
                      ⏱ {duurLabel(g.duurMinuten)}
                    </span>
                  ) : (
                    <span style={{ fontSize: '11px', color: C.textMuted }}>Geen duur ingesteld</span>
                  )}
                  {aantalCats > 0 && (
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '6px',
                      background: C.blueDim, color: C.blue, fontWeight: '600',
                    }}>
                      {aantalCats} categorie{aantalCats !== 1 ? 'ën' : ''}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
