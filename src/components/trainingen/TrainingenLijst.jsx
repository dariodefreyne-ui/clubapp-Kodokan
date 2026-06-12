// src/components/trainingen/TrainingenLijst.jsx
import React, { useState, memo } from 'react';
import { C } from './tokens';
import { vandaagISO } from './seizoenHelpers';
import TrainingKaart from './TrainingKaart';

const TrainingenLijst = memo(function TrainingenLijst({
  actieveGroepData,
  gefilterdeTrainingen,
  technieken,
  groepen,
  isBeheerder,
  profiel,
  lesgeversLijst,
  filterLesgever,
  filterDag,
  geenTrainingMarkers,
  magTrainingToevoegen,
  onBewerken,
  onVerwijderen,
  onNieuweTraining,
  onWedstrijdKlik,
}) {
  const [toonVoorbije, setToonVoorbije]     = useState(false);
  const [selectieModus, setSelectieModus]   = useState(false);
  const [geselecteerd, setGeselecteerd]     = useState(new Set());

  const vandaag = vandaagISO();
  const komendeTrainingen = gefilterdeTrainingen.filter(t => t.datum >= vandaag);
  const voorbijTrainingen = gefilterdeTrainingen.filter(t => t.datum < vandaag).reverse();
  const volgendTrainingId = komendeTrainingen[0]?.id || null;

  const toggleSelectie = (id) =>
    setGeselecteerd(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!actieveGroepData) return null;

  return (
    <section style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '1px' }}>
          {filterLesgever
            ? `${lesgeversLijst.find(l => l.id === filterLesgever)?.naam ?? filterLesgever} - alle groepen - ${gefilterdeTrainingen.length} training(en)`
            : filterDag
              ? `Alle groepen - ${filterDag === '3' ? 'woensdag' : filterDag === '6' ? 'zaterdag' : 'dag ' + filterDag} - ${gefilterdeTrainingen.length} training(en)`
              : `${actieveGroepData.naam} - ${actieveGroepData.dag} - ${gefilterdeTrainingen.length} training(en)`}
        </div>
        {isBeheerder && (
          <div style={{ display: 'flex', gap: '6px' }}>
            {selectieModus ? (
              <>
                <span style={{ fontSize: '12px', color: C.textMuted, alignSelf: 'center' }}>{geselecteerd.size} geselecteerd</span>
                <button
                  onClick={() => onVerwijderen([...geselecteerd], () => { setGeselecteerd(new Set()); setSelectieModus(false); })}
                  disabled={geselecteerd.size === 0}
                  style={{ padding: '6px 12px', background: geselecteerd.size > 0 ? C.redDim : 'transparent', border: `1px solid ${geselecteerd.size > 0 ? C.red : C.borderSoft}`, borderRadius: '8px', color: geselecteerd.size > 0 ? C.red : C.textMuted, cursor: geselecteerd.size > 0 ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: '600' }}>
                  🗑 Verwijder ({geselecteerd.size})
                </button>
                <button onClick={() => { setSelectieModus(false); setGeselecteerd(new Set()); }}
                  style={{ padding: '6px 12px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                  Annuleren
                </button>
              </>
            ) : (
              <button onClick={() => setSelectieModus(true)}
                style={{ padding: '6px 12px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
                ☑ Selecteren
              </button>
            )}
          </div>
        )}
      </div>

      {komendeTrainingen.length === 0 && voorbijTrainingen.length === 0 ? (
        <div style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '16px', padding: '32px', textAlign: 'center', color: C.textMuted, fontSize: '14px' }}>
          Nog geen trainingen ingepland.
          {magTrainingToevoegen && (
            <div style={{ marginTop: '12px' }}>
              <button onClick={onNieuweTraining}
                style={{ background: C.redDim, border: `1px solid ${C.red}`, color: C.red, padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}>
                + Eerste training toevoegen
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {komendeTrainingen.length > 0 && (
            <>
              <div style={{ fontSize: '11px', fontWeight: '800', color: C.blue, textTransform: 'uppercase', letterSpacing: '1.4px', marginTop: '4px', padding: '4px 2px' }}>
                Komend ({komendeTrainingen.length})
              </div>
              {komendeTrainingen.map(training => (
                <TrainingKaart
                  key={training.id}
                  training={training}
                  technieken={technieken}
                  groepen={groepen}
                  isBeheerder={isBeheerder}
                  profiel={profiel}
                  lesgeversLijst={lesgeversLijst}
                  selectieModus={selectieModus}
                  isGeselecteerd={geselecteerd.has(training.id)}
                  isVolgende={training.id === volgendTrainingId}
                  geenTrainingMarkers={geenTrainingMarkers}
                  onToggleSelectie={() => toggleSelectie(training.id)}
                  onBewerken={() => onBewerken(training)}
                  onVerwijderen={() => onVerwijderen([training.id])}
                  onWedstrijdKlik={onWedstrijdKlik}
                />
              ))}
            </>
          )}
          {voorbijTrainingen.length > 0 && (
            <>
              <button
                onClick={() => setToonVoorbije(v => !v)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', color: C.textMuted, fontSize: '12px', fontWeight: '600', marginTop: '8px' }}
              >
                <span>{toonVoorbije ? '▲' : '▼'}</span>
                Voorbije trainingen ({voorbijTrainingen.length})
              </button>
              {toonVoorbije && voorbijTrainingen.map(training => (
                <TrainingKaart
                  key={training.id}
                  training={training}
                  technieken={technieken}
                  groepen={groepen}
                  isBeheerder={isBeheerder}
                  profiel={profiel}
                  lesgeversLijst={lesgeversLijst}
                  selectieModus={selectieModus}
                  isGeselecteerd={geselecteerd.has(training.id)}
                  isVolgende={false}
                  geenTrainingMarkers={geenTrainingMarkers}
                  onToggleSelectie={() => toggleSelectie(training.id)}
                  onBewerken={() => onBewerken(training)}
                  onVerwijderen={() => onVerwijderen([training.id])}
                  onWedstrijdKlik={onWedstrijdKlik}
                />
              ))}
            </>
          )}
        </div>
      )}
    </section>
  );
});

export default TrainingenLijst;
