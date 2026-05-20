// src/components/details/EvenementDetailPanel.jsx
// Read-only detailpanel voor een evenement (clubactiviteit, stage, meeting, ...).

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { C, buttonStyle, badgeStyle } from '../../styles/tokens';
import { formatDatum } from '../trainingen/seizoenHelpers';
import DetailModal from './DetailModal';

const TYPE_LABELS = {
  clubactiviteit: 'Clubactiviteit',
  stage: 'Stage',
  meeting: 'Meeting',
  tornooi: 'Tornooi',
  overig: 'Overig',
};

const TYPE_BADGE_COLOR = {
  clubactiviteit: 'purple',
  stage: 'green',
  meeting: 'blue',
  tornooi: 'orange',
  overig: 'red',
};

export default function EvenementDetailPanel({ evenementId, onClose }) {
  const navigate = useNavigate();
  const { isTrainer, isBeheerder } = useAuth();
  const magOpenen = isTrainer || isBeheerder;

  const [ev, setEv] = useState(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');

  useEffect(() => {
    let actief = true;
    setLaden(true);
    setFout('');
    setEv(null);

    async function laad() {
      try {
        const snap = await getDoc(doc(db, 'evenementen', evenementId));
        if (!actief) return;
        if (!snap.exists()) {
          setFout('Evenement niet gevonden');
          setLaden(false);
          return;
        }
        setEv({ id: snap.id, ...snap.data() });
        setLaden(false);
      } catch (e) {
        if (!actief) return;
        console.error('EvenementDetailPanel:', e);
        setFout('Fout bij laden van evenement');
        setLaden(false);
      }
    }

    laad();
    return () => { actief = false; };
  }, [evenementId]);

  const titel = ev?.titel || 'Evenement';
  const typeKleur = ev?.type ? TYPE_BADGE_COLOR[ev.type] || 'purple' : 'purple';
  const typeLabel = ev?.type ? TYPE_LABELS[ev.type] || ev.type : '';

  return (
    <DetailModal open={true} onClose={onClose} title={titel} accentKleur={C.purple}>
      {laden && (
        <div style={{ textAlign: 'center', padding: '24px', color: C.textSecondary }}>Laden...</div>
      )}

      {!laden && fout && (
        <div style={{ textAlign: 'center', padding: '20px', color: C.textSecondary }}>{fout}</div>
      )}

      {!laden && !fout && ev && (
        <>
          {typeLabel && (
            <div style={{ marginBottom: '12px' }}>
              <span style={badgeStyle(typeKleur)}>{typeLabel}</span>
            </div>
          )}

          {ev.datum && (
            <div style={{ fontSize: '16px', marginBottom: '8px', color: C.textPrimary }}>
              {formatDatum(ev.datum)}
              {ev.eindDatum && ev.eindDatum !== ev.datum && (
                <span> – {formatDatum(ev.eindDatum)}</span>
              )}
            </div>
          )}

          {ev.beschrijving && (
            <div style={{ marginTop: '12px', color: C.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {ev.beschrijving}
            </div>
          )}

          {ev.link && (
            <div style={{ marginTop: '12px' }}>
              <a
                href={ev.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: C.red, textDecoration: 'none', fontWeight: '600' }}
              >
                🔗 Open link
              </a>
            </div>
          )}

          {magOpenen && (
            <button
              onClick={() => { onClose(); navigate('/evenementen'); }}
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
