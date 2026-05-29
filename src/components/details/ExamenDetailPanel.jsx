// src/components/details/ExamenDetailPanel.jsx
// Read-only detailpanel voor een examen (event met type 'examen').
// Kandidaten worden opgehaald via de 'registrations' subcollectie (zie Examens.jsx).

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { C, buttonStyle } from '../../styles/tokens';
import { formatDatum } from '../trainingen/seizoenHelpers';
import DetailModal from './DetailModal';

export default function ExamenDetailPanel({ eventId, onClose }) {
  const navigate = useNavigate();
  const { isTrainer, isBeheerder } = useAuth();
  const magOpenen = isTrainer || isBeheerder;

  const [event, setEvent] = useState(null);
  const [kandidaten, setKandidaten] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');

  useEffect(() => {
    let actief = true;
    setLaden(true);
    setFout('');
    setEvent(null);
    setKandidaten([]);

    async function laad() {
      try {
        const snap = await getDoc(doc(db, 'events', eventId));
        if (!actief) return;
        if (!snap.exists()) {
          setFout('Examen niet gevonden');
          setLaden(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        if (data.type !== 'examen') {
          setFout('Geen examen');
          setLaden(false);
          return;
        }
        setEvent(data);

        const regSnap = await getDocs(collection(db, 'events', eventId, 'registrations'));
        if (!actief) return;
        setKandidaten(regSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLaden(false);
      } catch (e) {
        if (!actief) return;
        console.error('ExamenDetailPanel:', e);
        setFout('Fout bij laden van examen');
        setLaden(false);
      }
    }

    laad();
    return () => { actief = false; };
  }, [eventId]);

  const titel = event?.naam || event?.name || 'Examen';
  const datum = event?.datum || event?.date || '';
  const locatie = event?.location || event?.locatie || '';

  return (
    <DetailModal open={true} onClose={onClose} title={titel} accentKleur={C.green}>
      {laden && (
        <div style={{ textAlign: 'center', padding: '24px', color: C.textSec }}>Laden...</div>
      )}

      {!laden && fout && (
        <div style={{ textAlign: 'center', padding: '20px', color: C.textSec }}>{fout}</div>
      )}

      {!laden && !fout && event && (
        <>
          {datum && (
            <div style={{ fontSize: '16px', marginBottom: '12px', color: C.textPrimary }}>
              {formatDatum(datum)}
            </div>
          )}

          {locatie && (
            <div style={{ marginBottom: '6px', color: C.textPrimary }}>
              <span style={{ color: C.textMuted }}>Locatie: </span>{locatie}
            </div>
          )}

          <hr style={{ margin: '16px 0', border: 'none', borderTop: `1px solid ${C.borderSoft}` }} />

          <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
            Kandidaten
          </div>
          <div style={{ color: C.textPrimary }}>
            {kandidaten.length} {kandidaten.length === 1 ? 'kandidaat' : 'kandidaten'} geregistreerd
          </div>

          {magOpenen && (
            <button
              onClick={() => { onClose(); navigate('/examens'); }}
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
