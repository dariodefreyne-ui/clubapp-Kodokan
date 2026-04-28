// src/components/trainingen/TrainingKaart.jsx
import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';
import { vandaagISO, formatDatum } from './seizoenHelpers';
import LesgeversPanel from './LesgeversPanel';
import { TechniekAccordeonLijst } from './TechniekAccordeon';

function TrainingKaart({ training, technieken, groepen, isBeheerder, profiel, lesgeversLijst, selectieModus, isGeselecteerd, isVolgende, onToggleSelectie, onBewerken, onVerwijderen }) {
  const [uitgeklapt, setUitgeklapt]         = useState(false);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const trainId = training.id;

  useEffect(() => {
    if (training.techniekBadges?.length > 0) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [trainId]);

  useEffect(() => {
    if (!uitgeklapt) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [trainId, uitgeklapt]);

  const isVandaag = training.datum === vandaagISO();
  const duurLabel = training.duurMinuten
    ? (training.duurMinuten >= 60
        ? `${Math.floor(training.duurMinuten / 60)}u${training.duurMinuten % 60 ? (training.duurMinuten % 60) + 'min' : ''}`
        : `${training.duurMinuten}min`)
    : null;

  return (
    <div id={`training-${training.id}`}
      style={{ background: C.card, border: `1.5px solid ${isVandaag ? C.green : isVolgende ? C.orange : C.border}`, borderRadius: '12px', overflow: 'hidden' }}>

      {/* Header */}
      <div onClick={() => selectieModus ? onToggleSelectie() : setUitgeklapt(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', background: isGeselecteerd ? 'rgba(192,57,43,0.08)' : 'transparent' }}>
        {selectieModus && (
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, background: isGeselecteerd ? C.red : 'transparent', border: `2px solid ${isGeselecteerd ? C.red : C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isGeselecteerd && <span style={{ color: '#fff', fontSize: '12px', lineHeight: 1 }}>&#10003;</span>}
          </div>
        )}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: '700' }}>{formatDatum(training.datum)}</span>
            {(() => {
              const groep = groepen?.find(g => g.id === training.groepId);
              if (!groep) return null;
              const kort = groep.naam.replace('Groep ', '').replace('groep ', '');
              return (
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: '#2a2a3a', border: '1px solid #4a4a6a', color: '#9a9aba' }}>
                  {kort}
                </span>
              );
            })()}
            {duurLabel && (
              <span style={{ fontSize: '11px', color: C.textMuted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '2px 8px' }}>
                {duurLabel} {training.duurOverschreven && '\u270e'}
              </span>
            )}
            {isVandaag && <span style={{ fontSize: '11px', fontWeight: '700', color: C.green, background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '999px', padding: '2px 8px' }}>Vandaag</span>}
            {isVolgende && !isVandaag && <span style={{ fontSize: '11px', fontWeight: '700', color: C.orange, background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: '999px', padding: '2px 8px' }}>Volgende</span>}
          </div>
          {training.opmerking && <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '2px' }}>{training.opmerking}</div>}
          {training.lesgevers?.length > 0 && (
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
              {training.lesgevers.map(l => (
                <span key={l} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontWeight: '600' }}>
                  {l}
                </span>
              ))}
            </div>
          )}
          {/* Technieken badges */}
          {(() => {
            const badges = training.techniekBadges?.length > 0
              ? training.techniekBadges
              : technieksLijst.map(t => ({ naam: t.techniekNaam, fase: t.fase }));
            if (!badges.length) return null;
            return (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                {badges.map((t, i) => (
                  <span key={i} style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600', background: t.fase === 'basis' ? C.blueDim : t.fase === 'verdieping' ? C.redDim : '#2a2a2a', border: `1px solid ${t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.border}`, color: t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.textMuted }}>
                    {t.naam || '\u2014'}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
        <span style={{ color: C.textMuted, fontSize: '12px' }}>{uitgeklapt ? '\u25b2' : '\u25bc'}</span>
      </div>

      {/* Uitgeklapt */}
      {uitgeklapt && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '14px 16px' }}>
          <TechniekAccordeonLijst technieksLijst={technieksLijst} techniekDatabank={technieken} />

          {/* LesgeversPanel v2.0 */}
          <LesgeversPanel
            training={training}
            profiel={profiel}
            isBeheerder={isBeheerder}
            lesgeversLijst={lesgeversLijst}
          />

          {isBeheerder && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={onBewerken}
                style={{ flex: 1, padding: '9px', background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', color: C.red, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                &#x270f;&#xfe0f; Bewerken
              </button>
              <button onClick={onVerwijderen}
                style={{ padding: '9px 14px', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: C.textMuted, cursor: 'pointer', fontSize: '13px' }}>
                &#x1f5d1;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrainingKaart;
