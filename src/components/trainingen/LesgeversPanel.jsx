// src/components/trainingen/LesgeversPanel.jsx
import React, { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';
import { vandaagISO } from './seizoenHelpers';

import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { useAuth } from '../../contexts/AuthContext';

function LesgeversPanel({ training, profiel, isBeheerder, lesgeversLijst }) {
  const { lesgeverId } = useAuth();
  const [bezig, setBezig] = useState(false);
  const isVerleden = training.datum < vandaagISO();
  const lesgevers  = training.lesgevers || [];
  const isZelfAanwezig = lesgeverId
    ? lesgevers.includes(lesgeverId)
    : false;

  const voegZelfToe = async () => {
    if (!lesgeverId || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayUnion(lesgeverId),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  const verwijderZelf = async () => {
    if (!lesgeverId || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayRemove(lesgeverId),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  const voegAndereToe = async (lesgeverId) => {
    if (!lesgeverId || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayUnion(lesgeverId),
        bijgewerkt: serverTimestamp(),
      });
      // T4 — trainer toegewezen: stuur push naar de toegevoegde lesgever
      // lesgeverId is het Firestore-id van de lesgever, niet de uid
      // We sturen het mee als payload zodat de Cloud Function kan filteren op uid
      const lesgeverNaam = naamVanId(lesgeverId);
      stuurPushTrigger(PUSH_TYPES.TRAINER_TOEGEWEZEN, {
        uid: lesgeverId,
        groepId: training.groepId || '',
        groepNaam: training.groepNaam || training.groepId || '',
        datum: training.datum || '',
        lesgeverNaam,
      });
    } finally { setBezig(false); }
  };

  const verwijderAndere = async (lesgeverId) => {
    if (!lesgeverId || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayRemove(lesgeverId),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  // Hulpfunctie: id -> naam voor display
  const naamVanId = (id) => lesgeversLijst.find(l => l.id === id)?.naam ?? id;

  const beschikbareToevoegen = lesgeversLijst.filter(l => !lesgevers.includes(l.id));

  return (
    <div style={{ background: '#0D1B2A', border: `1px solid ${C.borderSoft}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        {isVerleden ? 'Aanwezige lesgevers' : 'Lesgevers'}
      </div>

      {/* Lijst huidige lesgevers */}
      {lesgevers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
          {lesgevers.map(id => {
            const isZelf = id === lesgeverId;
            return (
              <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '6px' }}>
                <span style={{ flex: 1, fontSize: '13px', color: C.textPrimary, fontWeight: isZelf ? '700' : '400' }}>
                  {naamVanId(id)} {isZelf && <span style={{ fontSize: '11px', color: C.purple }}>(jij)</span>}
                </span>
                {(isBeheerder || isZelf) && (
                  <button
                    onClick={() => isZelf ? verwijderZelf() : verwijderAndere(id)}
                    disabled={bezig}
                    style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
                    title="Verwijderen"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '10px', fontStyle: 'italic' }}>
          Nog geen lesgever aangeduid
        </div>
      )}

      {/* Zelf toevoegen (enkel als lesgeverId beschikbaar en nog niet aanwezig) */}
      {lesgeverId && !isZelfAanwezig && (
        <button
          onClick={voegZelfToe}
          disabled={bezig}
          style={{
            width: '100%', padding: '8px', marginBottom: '8px',
            background: C.purpleDim, border: `1px solid ${C.purple}`,
            borderRadius: '8px', color: C.purple, cursor: 'pointer', fontSize: '13px', fontWeight: '600',
          }}
        >
          + Ik geef deze training
        </button>
      )}

      {/* Beheerder: andere lesgever toevoegen via dropdown (value = id) */}
      {isBeheerder && beschikbareToevoegen.length > 0 && (
        <select
          value=""
          onChange={e => { if (e.target.value) voegAndereToe(e.target.value); }}
          disabled={bezig}
          style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '6px', color: C.textMuted, fontSize: '13px' }}
        >
          <option value="">+ Lesgever toevoegen...</option>
          {beschikbareToevoegen.map(l => (
            <option key={l.id} value={l.id}>{l.naam}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default LesgeversPanel;
