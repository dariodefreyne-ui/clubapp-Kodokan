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
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
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

const normaliseerNaam = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');

function jaarUitDatum(d) {
  if (!d) return null;
  const jaar = new Date(d).getFullYear();
  return Number.isFinite(jaar) ? jaar : null;
}

export default function EerstvolgendeActiviteiten({ profiel, onItemKlik, aantal = 3 }) {
  const { isLid, lesgeverId } = useAuth();
  const { items, laden } = useAgendaItems({ profiel, alleenVanaf: vandaagISO() });
  const [ingeschrevenEventIds, setIngeschrevenEventIds] = useState(null); // null = nog niet geladen

  // Leden: bepaal voor welke toekomstige wedstrijden/events je bent ingeschreven.
  // Inschrijvingen hebben geen memberId/uid, enkel judokaNaam (+ soms geboortejaar).
  // We matchen daarom genormaliseerd op naam, met de autoritatieve lid-naam via
  // linkedMemberId wanneer beschikbaar, en gebruiken geboortejaar als extra
  // controle tegen naamgenoten wanneer dat aan beide kanten bekend is.
  useEffect(() => {
    if (!isLid) { setIngeschrevenEventIds(new Set()); return; }
    let actief = true;

    (async () => {
      // 1. Verzamel mijn lid-id + naam/naamvarianten + geboortejaar
      const mijnMemberId = profiel?.linkedMemberId || null;
      const namen = new Set();
      if (profiel?.naam) namen.add(normaliseerNaam(profiel.naam));
      let geboortejaar = null;
      if (mijnMemberId) {
        try {
          const lidSnap = await getDoc(doc(db, 'members', mijnMemberId));
          if (lidSnap.exists()) {
            const lid = lidSnap.data();
            if (lid.naam) namen.add(normaliseerNaam(lid.naam));
            geboortejaar = jaarUitDatum(lid.geboortedatum);
          }
        } catch { /* lid niet leesbaar — val terug op profielnaam */ }
      }
      if (!mijnMemberId && namen.size === 0) { if (actief) setIngeschrevenEventIds(new Set()); return; }

      // 2. Laad enkel toekomstige inschrijvingen (begrensde set) en match client-side.
      //    Primair op memberId (betrouwbaar), met naam als terugval voor oudere
      //    of vrij-veld-inschrijvingen zonder lid-koppeling.
      try {
        const snap = await getDocs(query(
          collection(db, 'inschrijvingen'),
          where('eventDatum', '>=', vandaagISO()),
        ));
        const ids = new Set();
        snap.docs.forEach(d => {
          const ins = d.data();
          if (!ins.eventId) return;
          if (mijnMemberId && ins.memberId === mijnMemberId) { ids.add(ins.eventId); return; }
          if (ins.memberId) return; // gekoppeld aan een ander lid → niet van mij
          if (!namen.has(normaliseerNaam(ins.judokaNaam))) return;
          // Geboortejaar-controle enkel als beide bekend zijn
          if (geboortejaar && Number.isFinite(ins.geboortejaar) && ins.geboortejaar !== geboortejaar) return;
          ids.add(ins.eventId);
        });
        if (actief) setIngeschrevenEventIds(ids);
      } catch {
        if (actief) setIngeschrevenEventIds(new Set());
      }
    })();

    return () => { actief = false; };
  }, [isLid, profiel?.naam, profiel?.linkedMemberId]);

  const relevante = useMemo(() => {
    // Wacht tot inschrijvingen geladen zijn voor leden (anders missen we wedstrijden)
    if (isLid && ingeschrevenEventIds === null) return null;
    const ingeschreven = ingeschrevenEventIds || new Set();

    return items.filter(item => {
      if (item.isGeenTraining) return false;

      if (item.bron === 'trainingen') {
        // Leden: enkel trainingen van hun eigen groep(en). Trainers: enkel de
        // trainingen waar ze zelf als lesgever staan.
        if (isLid) {
          const groepen = profiel?.groepen || [];
          return groepen.length > 0 && groepen.includes(item.extra?.groepId);
        }
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
  }, [items, isLid, lesgeverId, profiel?.uid, profiel?.groepen, ingeschrevenEventIds, aantal]);

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
