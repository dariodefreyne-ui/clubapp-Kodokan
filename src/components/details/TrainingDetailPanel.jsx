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
import {
  formatDuur,
  isGeenTrainingTekst,
  DEFAULT_GEEN_TRAINING_MARKERS,
} from '../../services/firestoreService';
import DetailModal from './DetailModal';

export default function TrainingDetailPanel({ trainingId, onClose }) {
  const navigate = useNavigate();
  const { isTrainer, isBeheerder, isAssistent } = useAuth();
  const magExtra = isTrainer || isBeheerder || isAssistent;
  const { lesgevers: alleLesgeversCtx } = useLesgevers();

  const [training, setTraining] = useState(null);
  const [lesgevers, setLesgevers] = useState([]);
  const [technieken, setTechnieken] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');

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

  const titel = training?.groepNaam || (laden ? 'Training' : 'Training');
  const isGeenTraining = training && isGeenTrainingTekst(training.opmerking, DEFAULT_GEEN_TRAINING_MARKERS);

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

          {isGeenTraining ? (
            <div style={{ marginTop: '12px' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: C.textSec, marginBottom: '6px' }}>
                🚫 Geen training
              </div>
              {training.opmerking && (
                <div style={{ color: C.textSec, textDecoration: 'line-through' }}>
                  {training.opmerking}
                </div>
              )}
            </div>
          ) : (
            <>
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
