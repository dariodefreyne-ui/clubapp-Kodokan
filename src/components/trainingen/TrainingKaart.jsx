// src/components/trainingen/TrainingKaart.jsx
import React, { useState, useCallback } from 'react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { updateMetAudit } from '../../services/firestoreService';
import { C } from './tokens';
import { vandaagISO, formatDatum } from './seizoenHelpers';
import LesgeversPanel from './LesgeversPanel';
import { TechniekAccordeonLijst } from './TechniekAccordeon';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { isGeenTrainingTekst, DEFAULT_GEEN_TRAINING_MARKERS, formatDuur } from '../../services/firestoreService';
import { useConfirm } from '../../contexts/ConfirmContext';

function TrainingKaart({ training, technieken, groepen, isBeheerder, profiel, lesgeversLijst, selectieModus, isGeselecteerd, isVolgende, geenTrainingMarkers, onToggleSelectie, onBewerken, onVerwijderen }) {
  const confirm = useConfirm();
  const [uitgeklapt, setUitgeklapt]         = useState(false);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const [techLaden, setTechLaden]           = useState(false);
  const trainId = training.id;

  // Technieken worden enkel geladen als de kaart uitklapt én er geen badges zijn.
  // Één getDocs i.p.v. twee permanente onSnapshot listeners per kaart.
  // Bij 20 kaarten spaart dit 40 open Firestore-verbindingen uit.
  const laadTechnieken = useCallback(async () => {
    if (training.techniekBadges?.length > 0) return;
    if (technieksLijst.length > 0) return; // al geladen, niet opnieuw fetchen
    setTechLaden(true);
    try {
      const snap = await getDocs(query(collection(db, 'trainingen', trainId, 'technieken'), orderBy('volgorde')));
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { /* stil falen, lege lijst blijft staan */ }
    setTechLaden(false);
  }, [trainId, training.techniekBadges, technieksLijst.length]);

  const isVandaag = training.datum === vandaagISO();
  const duurStr = formatDuur(training.duurMinuten);
  const heeftKlokuren = !!(training.startTijd && training.eindTijd);
  const duurLabel = duurStr
    ? (heeftKlokuren ? `${training.startTijd} – ${training.eindTijd} · ${duurStr}` : duurStr)
    : null;
  const isGeenTraining = isGeenTrainingTekst(
    training.opmerking,
    geenTrainingMarkers || DEFAULT_GEEN_TRAINING_MARKERS
  );

  return (
    <div id={`training-${training.id}`}
      style={{
        background: isGeenTraining ? 'rgba(0,0,0,0.15)' : C.card,
        border: `1.5px solid ${isVandaag ? C.green : isVolgende ? C.blue : isGeenTraining ? 'rgba(255,255,255,0.08)' : C.borderSoft}`,
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: isVolgende ? `0 8px 24px ${C.blueDim}` : 'none',
        opacity: isGeenTraining ? 0.7 : 1,
      }}>

      {/* Header */}
      <div onClick={() => {
          if (selectieModus) { onToggleSelectie(); return; }
          const wordtUitgeklapt = !uitgeklapt;
          setUitgeklapt(wordtUitgeklapt);
          if (wordtUitgeklapt) laadTechnieken();
        }}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', background: isGeselecteerd ? C.redDim : 'transparent' }}>
        {selectieModus && (
          <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, background: isGeselecteerd ? C.red : 'transparent', border: `2px solid ${isGeselecteerd ? C.red : C.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: C.blueDim, border: `1px solid ${C.blue}`, color: C.blue }}>
                  {kort}
                </span>
              );
            })()}
            {duurLabel && (
              <span style={{ fontSize: '11px', color: C.textMuted, background: '#0D1B2A', border: `1px solid ${C.borderSoft}`, borderRadius: '999px', padding: '2px 8px' }}>
                {duurLabel} {training.duurOverschreven && '✎'}
              </span>
            )}
            {isVandaag && <span style={{ fontSize: '11px', fontWeight: '700', color: C.green, background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: '999px', padding: '2px 8px' }}>Vandaag</span>}
            {isVolgende && !isVandaag && <span style={{ fontSize: '11px', fontWeight: '700', color: C.blue, background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: '999px', padding: '2px 8px' }}>Volgende</span>}
            {isGeenTraining && (
              <span style={{
                fontSize: 'var(--font-size-xs)',
                background: 'rgba(255,255,255,0.08)',
                color: 'var(--text-secondary)',
                borderRadius: '6px',
                padding: '2px 8px',
                marginLeft: '6px',
                fontWeight: '600',
                letterSpacing: '0.03em',
              }}>
                Geen training
              </span>
            )}
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
                  <span key={i} style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '999px', fontWeight: '600', background: t.fase === 'basis' ? C.blueDim : t.fase === 'verdieping' ? C.redDim : C.cardHover, border: `1px solid ${t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.borderSoft}`, color: t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.textMuted }}>
                    {t.naam || '—'}
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
        <span style={{ color: C.textMuted, fontSize: '12px' }}>{uitgeklapt ? '▲' : '▼'}</span>
      </div>

      {/* Uitgeklapt */}
      {uitgeklapt && (
        <div style={{ background: '#0D1B2A', borderTop: `1px solid ${C.borderSoft}`, padding: '14px 16px' }}>
          {techLaden
            ? <div style={{ color: C.textMuted, fontSize: '13px', padding: '4px 0' }}>Technieken laden…</div>
            : <TechniekAccordeonLijst technieksLijst={technieksLijst} techniekDatabank={technieken} />}

          {/* LesgeversPanel v2.0 */}
          <LesgeversPanel
            training={training}
            profiel={profiel}
            isBeheerder={isBeheerder}
            lesgeversLijst={lesgeversLijst}
          />

          {isBeheerder && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={onBewerken}
                  style={{ flex: 1, padding: '9px', background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', color: C.red, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
                  &#x270f;&#xfe0f; Bewerken
                </button>
                {!isGeenTraining && (
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        titel: 'Training annuleren?',
                        beschrijving: 'De training wordt als geannuleerd gemarkeerd en alle leden krijgen een melding. Gebruik dit niet voor "sporthal gesloten" of "geen training" — zet dat in de opmerking.',
                        bevestigLabel: 'Ja, annuleer training',
                        variant: 'danger',
                      });
                      if (!ok) return;
                      try {
                        const { doc } = await import('firebase/firestore');
                        await updateMetAudit(doc(db, 'trainingen', training.id), {
                          geannuleerd: true,
                        });
                        stuurPushTrigger(PUSH_TYPES.TRAINING_GEANNULEERD, {
                          groepId: training.groepId || '',
                          groepNaam: training.groepNaam || training.groepId || '',
                          datum: training.datum || '',
                        });
                      } catch (e) {
                        console.error('Annuleren mislukt:', e);
                      }
                    }}
                    style={{ flex: 1, padding: '9px', background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', color: C.red, cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                    title="Markeert de training als geannuleerd en kan een melding sturen. Gebruik dit niet voor Sporthal gesloten of geen training.">
                    Annuleer training
                  </button>
                )}
                <button onClick={onVerwijderen}
                  title="Verwijdert deze training definitief."
                  aria-label="Training definitief verwijderen"
                  style={{ flexShrink: 0, padding: '9px 14px', background: 'transparent', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textMuted, cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>
                  &#x1f5d1;
                </button>
              </div>
              <div style={{ marginTop: '8px', color: C.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                Annuleer training markeert als geannuleerd en kan een melding sturen. De vuilbak verwijdert definitief. Gebruik opmerking zoals Sporthal gesloten of Geen training voor planning zonder gewone training.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TrainingKaart;
