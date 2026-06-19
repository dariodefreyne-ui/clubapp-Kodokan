// src/components/details/TrainingDetailPanel.jsx
// Read-only detailpanel voor een training (bottom sheet).
// Trainer/beheerder zien extra info: lesgevers en techniekentelling.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useLesgevers } from '../../contexts/LesgeversContext.jsx';
import { C, buttonStyle } from '../../styles/tokens';
import { formatDatum } from '../trainingen/seizoenHelpers';
import { formatDuur, getClubSettings, markersUitSettings, markersProvinciaalUitSettings } from '../../services/firestoreService';
import {
  TRAINING_STATUS,
  STATUS_LABELS,
  STATUS_EMOJI,
  bepaalTrainingStatus,
} from '../trainingen/trainingStatus';
import DetailModal from './DetailModal';

export default function TrainingDetailPanel({ trainingId, onClose }) {
  const navigate = useNavigate();
  const { isTrainer, isBeheerder, isAssistent, configCache } = useAuth();
  const magExtra = isTrainer || isBeheerder || isAssistent;
  const groepenCache = configCache?.groepen || [];
  const { lesgevers: alleLesgeversCtx } = useLesgevers();

  const [training, setTraining] = useState(null);
  const [lesgevers, setLesgevers] = useState([]);
  const [technieken, setTechnieken] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [markers, setMarkers] = useState({ geen: undefined, prov: undefined });

  useEffect(() => {
    getClubSettings().then(settings => {
      setMarkers({ geen: markersUitSettings(settings), prov: markersProvinciaalUitSettings(settings) });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let actief = true;
    setLaden(true);
    setFout('');
    setTraining(null);
    setLesgevers([]);
    setTechnieken([]);

    async function laad() {
      try {
        const snap = await getDoc(doc(db, 'trainingen', trainingId));
        if (!actief) return;
        if (!snap.exists()) {
          setFout('Training niet gevonden');
          setLaden(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        setTraining(data);

        if (magExtra) {
          const techSnap = await getDocs(collection(db, 'trainingen', trainingId, 'technieken'));
          if (!actief) return;
          setTechnieken(techSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          const ids = data.lesgevers || [];
          const namen = ids
            .map(id => alleLesgeversCtx.find(l => l.id === id)?.naam || id)
            .filter(Boolean);
          setLesgevers(namen);
        }
        setLaden(false);
      } catch (e) {
        if (!actief) return;
        console.error('TrainingDetailPanel:', e);
        setFout('Fout bij laden van training');
        setLaden(false);
      }
    }

    laad();
    return () => { actief = false; };
  }, [trainingId, magExtra]);

  const eigenGroep = training ? groepenCache.find(g => g.id === training.groepId) : null;
  const titel = training?.groepNaam || eigenGroep?.naam || (laden ? 'Training' : 'Training');
  const status = training
    ? bepaalTrainingStatus(training, { geenMarkers: markers.geen, provincialeMarkers: markers.prov, volgtProvincialeKalender: eigenGroep?.volgtProvincialeKalender })
    : TRAINING_STATUS.NORMAAL;
  const isGeenTraining = status === TRAINING_STATUS.GEEN;
  const isGeannuleerd = status === TRAINING_STATUS.GEANNULEERD;
  const isSamengevoegd = status === TRAINING_STATUS.SAMENGEVOEGD;
  const normalizeGroepen = (v) => !v ? [] : Array.isArray(v) ? v : [v];
  const samengevoegdMetNaam = isSamengevoegd && training
    ? normalizeGroepen(training.samengevoegdMet).map(id => groepenCache.find(g => g.id === id)?.naam || id).join(', ')
    : null;

  return (
    <DetailModal open={true} onClose={onClose} title={titel} accentKleur={C.blue}>
      {laden && (
        <div style={{ textAlign: 'center', padding: '24px', color: C.textSec }}>Laden...</div>
      )}

      {!laden && fout && (
        <div style={{ textAlign: 'center', padding: '20px', color: C.textSec }}>{fout}</div>
      )}

      {!laden && !fout && training && (
        <>
          <div style={{ fontSize: '16px', marginBottom: '8px', color: C.textPrimary }}>
            {formatDatum(training.datum)}
          </div>

          {isGeenTraining || isGeannuleerd ? (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: isGeannuleerd ? C.red : C.textSec, marginBottom: '6px' }}>
                {isGeannuleerd ? `${STATUS_EMOJI.geannuleerd} ${STATUS_LABELS.geannuleerd}` : `${STATUS_EMOJI.geen} ${STATUS_LABELS.geen}`}
              </div>
              {training.opmerking && (
                <div style={{ color: C.textSec, textDecoration: 'line-through' }}>
                  {training.opmerking}
                </div>
              )}
            </div>
          ) : (
            <>
              {isSamengevoegd && (
                <div style={{ marginTop: '4px', marginBottom: '12px', padding: '10px 12px', borderRadius: '10px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontWeight: '600', fontSize: '14px' }}>
                  {STATUS_EMOJI.samengevoegd} Traint samen met {samengevoegdMetNaam}
                </div>
              )}
              {training.startTijd && training.eindTijd ? (
                <div style={{ color: C.textSec, marginBottom: '4px' }}>
                  {training.startTijd} – {training.eindTijd}
                  {training.duurMinuten ? ` · ${formatDuur(training.duurMinuten)}` : ''}
                </div>
              ) : training.duurMinuten ? (
                <div style={{ color: C.textSec, marginBottom: '4px' }}>
                  {formatDuur(training.duurMinuten)}
                </div>
              ) : null}

              {training.opmerking && (
                <div style={{ marginTop: '12px', color: C.textSec, whiteSpace: 'pre-wrap' }}>
                  {training.opmerking}
                </div>
              )}

              {magExtra && (
                <>
                  <hr style={{ margin: '16px 0', border: 'none', borderTop: `1px solid ${C.borderSoft}` }} />
                  <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                    Lesgevers
                  </div>
                  <div style={{ color: C.textPrimary }}>
                    {lesgevers.length > 0 ? lesgevers.join(', ') : 'Geen lesgevers geregistreerd'}
                  </div>

                  <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '12px', marginBottom: '6px' }}>
                    Technieken
                  </div>
                  {technieken.length === 0 ? (
                    <div style={{ color: C.textSec }}>Geen technieken geregistreerd</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: '18px', color: C.textPrimary }}>
                      {technieken.map(t => (
                        <li key={t.id} style={{ marginBottom: '2px' }}>
                          {t.techniekNaam || t.naam || t.id}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </>
          )}

          {magExtra && (
            <button
              onClick={() => { onClose(); navigate(`/trainingen/${trainingId}`); }}
              style={{ ...buttonStyle('accent'), marginTop: '20px' }}
            >
              Open volledige pagina
            </button>
          )}
        </>
      )}
    </DetailModal>
  );
}
