// src/components/trainingen/LesgeversPanel.jsx
import React, { useState } from 'react';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';
import { vandaagISO } from './seizoenHelpers';

function LesgeversPanel({ training, profiel, isBeheerder, lesgeversLijst }) {
  const [bezig, setBezig] = useState(false);
  const isVerleden = training.datum < vandaagISO();
  const lesgevers  = training.lesgevers || [];
  const isZelfAanwezig = lesgevers.includes(profiel?.naam);

  const voegZelfToe = async () => {
    if (!profiel?.naam || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayUnion(profiel.naam),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  const verwijderZelf = async () => {
    if (!profiel?.naam || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayRemove(profiel.naam),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  const voegAndereToe = async (naam) => {
    if (!naam || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayUnion(naam),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  const verwijderAndere = async (naam) => {
    if (!naam || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayRemove(naam),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  const beschikbareToevoegen = lesgeversLijst.filter(l => !lesgevers.includes(l.naam));

  return (
    <div style={{ background: C.bg, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
        {isVerleden ? 'Aanwezige lesgevers' : 'Lesgevers'}
      </div>

      {/* Lijst huidige lesgevers */}
      {lesgevers.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '10px' }}>
          {lesgevers.map(naam => (
            <div key={naam} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', background: C.card, borderRadius: '6px' }}>
              <span style={{ flex: 1, fontSize: '13px', color: C.textPrimary, fontWeight: naam === profiel?.naam ? '700' : '400' }}>
                {naam} {naam === profiel?.naam && <span style={{ fontSize: '11px', color: C.purple }}>(jij)</span>}
              </span>
              {(isBeheerder || naam === profiel?.naam) && (
                <button
                  onClick={() => naam === profiel?.naam ? verwijderZelf() : verwijderAndere(naam)}
                  disabled={bezig}
                  style={{ background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}
                  title="Verwijderen"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '10px', fontStyle: 'italic' }}>
          Nog geen lesgever aangeduid
        </div>
      )}

      {/* Zelf toevoegen (als je er nog niet bij staat) */}
      {profiel?.naam && !isZelfAanwezig && (
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

      {/* Beheerder: andere lesgever toevoegen */}
      {isBeheerder && beschikbareToevoegen.length > 0 && (
        <select
          value=""
          onChange={e => { if (e.target.value) voegAndereToe(e.target.value); }}
          disabled={bezig}
          style={{ width: '100%', padding: '8px 10px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '6px', color: C.textMuted, fontSize: '13px' }}
        >
          <option value="">+ Lesgever toevoegen…</option>
          {beschikbareToevoegen.map(l => (
            <option key={l.id} value={l.naam}>{l.naam}</option>
          ))}
        </select>
      )}
    </div>
  );
}

export default LesgeversPanel;
