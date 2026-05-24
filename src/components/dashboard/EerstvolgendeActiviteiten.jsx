// src/components/dashboard/EerstvolgendeActiviteiten.jsx
// Toont de eerstvolgende, voor jou relevante activiteiten als UNIE van:
//  • je eigen deelnames (waar je als "lid" voor ingeschreven bent): wedstrijden,
//    examens (kandidaat), evenementen — ongeacht je rol;
//  • je rol-activiteiten: trainingen waar je lesgeeft/assisteert + wedstrijden
//    waar je begeleider bent + trainingen van je eigen groep(en).
// Voor elke niet-lid-rol wordt met een badge getoond of je er als deelnemer dan
// wel als trainer/assistent/begeleider/kandidaat bij bent.
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
import { normaliseerNaam, jaarUitGeboortedatum } from '../../utils/ledenKoppeling';

function detailVanItem(item) {
  if (item.bron === 'trainingen') return { type: 'training', id: item.id };
  if (item.bron === 'events' && item.type === 'wedstrijd') return { type: 'wedstrijd', id: item.id };
  if (item.bron === 'events' && item.type === 'examen') return { type: 'examen', id: item.id };
  if (item.bron === 'evenementen') return { type: 'evenement', id: item.id };
  return null;
}

const RELATIE_LABEL = {
  trainer:    'als trainer',
  assistent:  'als assistent',
  deelnemer:  'als deelnemer',
  begeleider: 'als begeleider',
  kandidaat:  'als kandidaat',
};

export default function EerstvolgendeActiviteiten({ profiel, onItemKlik, aantal = 3 }) {
  const { isLid, isAssistent, lesgeverId } = useAuth();
  const { items, laden } = useAgendaItems({ profiel, alleenVanaf: vandaagISO() });
  const [ingeschrevenEventIds, setIngeschrevenEventIds] = useState(null); // wedstrijden/events ingeschreven
  const [examenKandidaatIds, setExamenKandidaatIds] = useState(null);     // examens als kandidaat

  const mijnMemberId = profiel?.linkedMemberId || null;

  // Detecteer voor IEDEREEN (ongeacht rol) waarvoor je als deelnemer bent
  // ingeschreven (wedstrijden/events). Primair op memberId, met naam als
  // terugval voor oudere/vrij-veld-inschrijvingen.
  useEffect(() => {
    let actief = true;
    (async () => {
      const namen = new Set();
      if (profiel?.naam) namen.add(normaliseerNaam(profiel.naam));
      let geboortejaar = null;
      if (mijnMemberId) {
        try {
          const lidSnap = await getDoc(doc(db, 'members', mijnMemberId));
          if (lidSnap.exists()) {
            const lid = lidSnap.data();
            if (lid.naam) namen.add(normaliseerNaam(lid.naam));
            geboortejaar = jaarUitGeboortedatum(lid.geboortedatum);
          }
        } catch { /* lid niet leesbaar */ }
      }
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
          if (ins.memberId) return; // gekoppeld aan een ander lid
          if (!namen.has(normaliseerNaam(ins.judokaNaam))) return;
          if (geboortejaar && Number.isFinite(ins.geboortejaar) && ins.geboortejaar !== geboortejaar) return;
          ids.add(ins.eventId);
        });
        if (actief) setIngeschrevenEventIds(ids);
      } catch {
        if (actief) setIngeschrevenEventIds(new Set());
      }
    })();
    return () => { actief = false; };
  }, [profiel?.naam, mijnMemberId]);

  // Examens waarvoor je als kandidaat bent ingeschreven (per toekomstig examen
  // de registrations-subcollectie checken op je memberId).
  const examenIdsKey = useMemo(
    () => [...new Set(items.filter(i => i.type === 'examen').map(i => i.id))].sort().join('|'),
    [items],
  );
  useEffect(() => {
    if (!mijnMemberId || !examenIdsKey) { setExamenKandidaatIds(new Set()); return; }
    let actief = true;
    (async () => {
      const examIds = examenIdsKey.split('|');
      const found = new Set();
      await Promise.all(examIds.map(async (eid) => {
        try {
          const snap = await getDocs(query(
            collection(db, 'events', eid, 'registrations'),
            where('memberId', '==', mijnMemberId),
          ));
          if (!snap.empty) found.add(eid);
        } catch { /* geen toegang/registratie */ }
      }));
      if (actief) setExamenKandidaatIds(found);
    })();
    return () => { actief = false; };
  }, [mijnMemberId, examenIdsKey]);

  const relevante = useMemo(() => {
    if (ingeschrevenEventIds === null || examenKandidaatIds === null) return null;
    const groepen = profiel?.groepen || [];
    const resultaat = [];

    for (const item of items) {
      if (item.isGeenTraining) continue;
      const relaties = [];

      if (item.bron === 'trainingen') {
        if (lesgeverId && (item.extra?.lesgevers || []).includes(lesgeverId)) {
          relaties.push(isAssistent ? 'assistent' : 'trainer');
        }
        if (groepen.length > 0 && groepen.includes(item.extra?.groepId)) {
          relaties.push('deelnemer');
        }
        if (relaties.length === 0) continue;
      } else if (item.bron === 'events' && item.type === 'wedstrijd') {
        if ((item.extra?.begeleiders || []).some(b => b.uid === profiel?.uid)) relaties.push('begeleider');
        if (ingeschrevenEventIds.has(item.id)) relaties.push('deelnemer');
        if (relaties.length === 0) continue;
      } else if (item.type === 'examen') {
        if (!examenKandidaatIds.has(item.id)) continue;
        relaties.push('kandidaat');
      } else if (item.bron === 'evenementen') {
        // clubbreed — geen persoonlijke relatie
      } else {
        continue;
      }

      resultaat.push({ item, relaties });
    }
    return resultaat.slice(0, aantal);
  }, [items, isAssistent, lesgeverId, profiel?.uid, profiel?.groepen, ingeschrevenEventIds, examenKandidaatIds, aantal]);

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
      {relevante.map(({ item, relaties }) => {
        const isVandaag = item.datum === vandaagISO();
        const kleur = isVandaag ? 'var(--success)' : typeKleur(item.type);
        // Relatie-badge tonen voor elke rol behalve 'lid' (voor een lid is het
        // altijd 'deelnemer'/'kandidaat' en dus impliciet).
        const toonRelaties = !isLid && relaties.length > 0;
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
            {toonRelaties && (
              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                {relaties.map(r => (
                  <span key={r} style={{
                    fontSize: '11px', fontWeight: '700', padding: '1px 8px', borderRadius: '999px',
                    background: r === 'deelnemer' || r === 'kandidaat' ? 'rgba(56,189,248,0.16)' : 'rgba(167,139,250,0.18)',
                    color: r === 'deelnemer' || r === 'kandidaat' ? '#38BDF8' : '#A78BFA',
                  }}>
                    {RELATIE_LABEL[r] || r}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
