// src/components/details/WedstrijdDetailPanel.jsx
// Read-only detailpanel voor een wedstrijd (event met type 'wedstrijd').

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { C, buttonStyle } from '../../styles/tokens';
import { formatDatum } from '../trainingen/seizoenHelpers';
import { DoelgroepBadges } from '../wedstrijden/SharedUI';
import DetailModal from './DetailModal';

export default function WedstrijdDetailPanel({ eventId, onClose }) {
  const navigate = useNavigate();
  const { isTrainer, isBeheerder, profiel } = useAuth();
  const magOpenen = isTrainer || isBeheerder;
  const isLid = profiel?.rol === 'lid';

  const [event, setEvent] = useState(null);
  const [inschrijvingen, setInschrijvingen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');

  useEffect(() => {
    let actief = true;
    setLaden(true);
    setFout('');
    setEvent(null);
    setInschrijvingen([]);

    async function laad() {
      try {
        const snap = await getDoc(doc(db, 'events', eventId));
        if (!actief) return;
        if (!snap.exists()) {
          setFout('Wedstrijd niet gevonden');
          setLaden(false);
          return;
        }
        const data = { id: snap.id, ...snap.data() };
        if (data.type !== 'wedstrijd') {
          setFout('Geen wedstrijd');
          setLaden(false);
          return;
        }
        setEvent(data);

        const insSnap = await getDocs(query(
          collection(db, 'inschrijvingen'),
          where('eventId', '==', eventId),
        ));
        if (!actief) return;
        setInschrijvingen(insSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLaden(false);
      } catch (e) {
        if (!actief) return;
        console.error('WedstrijdDetailPanel:', e);
        setFout('Fout bij laden van wedstrijd');
        setLaden(false);
      }
    }

    laad();
    return () => { actief = false; };
  }, [eventId]);

  const titel = event?.naam || 'Wedstrijd';
  const mijnMemberId = profiel?.linkedMemberId;
  const ikBenIngeschreven = inschrijvingen.some(
    i => (mijnMemberId && i.memberId === mijnMemberId) || (profiel?.naam && i.judokaNaam === profiel.naam)
  );
  const namen = inschrijvingen.map(i => i.judokaNaam).filter(Boolean);
  const eersteTien = namen.slice(0, 10);
  const restAantal = Math.max(0, namen.length - eersteTien.length);

  return (
    <DetailModal open={true} onClose={onClose} title={titel} accentKleur={C.orange}>
      {laden && (
        <div style={{ textAlign: 'center', padding: '24px', color: C.textSec }}>Laden...</div>
      )}

      {!laden && fout && (
        <div style={{ textAlign: 'center', padding: '20px', color: C.textSec }}>{fout}</div>
      )}

      {!laden && !fout && event && (
        <>
          <div style={{ fontSize: '16px', marginBottom: '12px', color: C.textPrimary }}>
            {formatDatum(event.datum)}
          </div>

          {(event.doelgroepCodes?.length > 0 || event.doelgroep) && (
            <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: C.textMuted, fontSize: '13px' }}>Doelgroep:</span>
              <DoelgroepBadges doelgroep={event.doelgroep} doelgroepCodes={event.doelgroepCodes} />
            </div>
          )}
          {event.locatie && (
            <div style={{ marginBottom: '6px', color: C.textPrimary }}>
              <span style={{ color: C.textMuted }}>Locatie: </span>{event.locatie}
            </div>
          )}
          {event.provincie && (
            <div style={{ marginBottom: '6px', color: C.textPrimary }}>
              <span style={{ color: C.textMuted }}>Provincie: </span>{event.provincie}
            </div>
          )}

          <hr style={{ margin: '16px 0', border: 'none', borderTop: `1px solid ${C.borderSoft}` }} />

          {isLid ? (
            ikBenIngeschreven ? (
              <div style={{ color: C.textPrimary, fontWeight: '600' }}>✓ Jij bent ingeschreven</div>
            ) : (
              <div style={{ color: C.textSec }}>Je bent niet ingeschreven voor deze wedstrijd.</div>
            )
          ) : (
            <>
              <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                Ingeschreven: {namen.length} {namen.length === 1 ? "judoka" : "judoka's"}
              </div>
              {eersteTien.length > 0 ? (
                <div style={{ color: C.textPrimary }}>
                  {eersteTien.join(', ')}
                  {restAantal > 0 && (
                    <span style={{ color: C.textMuted }}> +{restAantal} meer</span>
                  )}
                </div>
              ) : (
                <div style={{ color: C.textSec }}>Nog geen inschrijvingen</div>
              )}
            </>
          )}

          {magOpenen && (
            <button
              onClick={() => { onClose(); navigate('/wedstrijden'); }}
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
