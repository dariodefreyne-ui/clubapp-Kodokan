// src/components/dashboard/EerstvolgendeActiviteiten.jsx
// Toont de 3 eerstvolgende, voor jou relevante activiteiten — gebaseerd op rol,
// profiel en inschrijving. Doorklikken opent het detailpaneel (zoals voorheen
// bij 'Eerstvolgende').
//
//  • Trainer/beheerder: trainingen waar je lesgeeft + wedstrijden waar je
//    begeleider bent + komende evenementen.
//  • Lid: trainingen van je groep(en) + wedstrijden waarvoor je ingeschreven
//    bent (best-effort op naam) + komende evenementen.
//
// Evenement-inschrijvingen bestaan nog niet; komende evenementen worden daarom
// clubbreed getoond tot dat is uitgewerkt.
import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatDatum, vandaagISO } from '../trainingen/seizoenHelpers';
import useAgendaItems from '../../hooks/useAgendaItems';
import { useAuth } from '../../contexts/AuthContext';
import { typeKleur, typeLabel, typeEmoji } from '../agenda/agendaConstants';

function detailVanItem(item) {
  if (item.bron === 'trainingen') return { type: 'training', id: item.id };
  if (item.bron === 'events' && item.type === 'wedstrijd') return { type: 'wedstrijd', id: item.id };
  if (item.bron === 'events' && item.type === 'examen') return { type: 'examen', id: item.id };
  if (item.bron === 'evenementen') return { type: 'evenement', id: item.id };
  return null;
}

export default function EerstvolgendeActiviteiten({ profiel, onItemKlik, aantal = 3 }) {
  const { isLid, lesgeverId } = useAuth();
  const { items, laden } = useAgendaItems({ profiel, alleenVanaf: vandaagISO() });
  const [ingeschrevenEventIds, setIngeschrevenEventIds] = useState(null); // null = nog niet geladen

  // Leden: laad waarvoor je bent ingeschreven (best-effort op judokaNaam)
  useEffect(() => {
    if (!isLid || !profiel?.naam) { setIngeschrevenEventIds(new Set()); return; }
    let actief = true;
    getDocs(query(collection(db, 'inschrijvingen'), where('judokaNaam', '==', profiel.naam)))
      .then(snap => {
        if (!actief) return;
        setIngeschrevenEventIds(new Set(snap.docs.map(d => d.data().eventId).filter(Boolean)));
      })
      .catch(() => actief && setIngeschrevenEventIds(new Set()));
    return () => { actief = false; };
  }, [isLid, profiel?.naam]);

  const relevante = useMemo(() => {
    // Wacht tot inschrijvingen geladen zijn voor leden (anders missen we wedstrijden)
    if (isLid && ingeschrevenEventIds === null) return null;
    const ingeschreven = ingeschrevenEventIds || new Set();

    return items.filter(item => {
      if (item.isGeenTraining) return false;

      if (item.bron === 'trainingen') {
        // Leden zijn al op groep gefilterd door de hook; trainers tonen we enkel
        // de trainingen waar ze zelf lesgeven.
        if (isLid) return true;
        if (!lesgeverId) return false;
        return (item.extra?.lesgevers || []).includes(lesgeverId);
      }

      if (item.bron === 'events' && item.type === 'wedstrijd') {
        if (isLid) return ingeschreven.has(item.id);
        // Trainer/beheerder: enkel wedstrijden waar je begeleider bent
        return (item.extra?.begeleiders || []).some(b => b.uid === profiel?.uid);
      }

      // Examens vallen buiten dit persoonlijke blok (zie 'Komende activiteiten').
      if (item.type === 'examen') return false;

      // Evenementen: clubbreed tonen tot inschrijvingen bestaan.
      if (item.bron === 'evenementen') return true;

      return false;
    }).slice(0, aantal);
  }, [items, isLid, lesgeverId, profiel?.uid, ingeschrevenEventIds, aantal]);

  if (laden || relevante === null) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;
  }
  if (relevante.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-3) 0' }}>
        Geen activiteiten gepland
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {relevante.map(item => {
        const isVandaag = item.datum === vandaagISO();
        const kleur = isVandaag ? 'var(--success)' : typeKleur(item.type);
        return (
          <button
            key={`${item.bron}-${item.id}`}
            onClick={() => { const d = detailVanItem(item); if (d && onItemKlik) onItemKlik(d); }}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: 'var(--bg-primary)', borderRadius: '10px', padding: '12px 14px',
              border: `1px solid ${kleur}`, cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
            }}
          >
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: kleur, marginBottom: '4px' }}>
              {isVandaag ? `${typeEmoji(item.type)} Vandaag` : `${typeEmoji(item.type)} ${typeLabel(item.type)}`}
            </div>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '800', marginBottom: '2px' }}>
              {item.titel}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
              {formatDatum(item.datum)}
              {item.startTijd && item.eindTijd && (
                <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>{item.startTijd} – {item.eindTijd}</span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
