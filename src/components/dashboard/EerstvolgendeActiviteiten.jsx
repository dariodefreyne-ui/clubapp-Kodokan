// src/components/dashboard/EerstvolgendeActiviteiten.jsx
// Toont de eerstvolgende, voor jou relevante activiteiten als UNIE van:
//  • je eigen deelnames (waar je als lid voor ingeschreven bent via ledenbeheer):
//    trainingen van groepen waaraan je als deelnemer gekoppeld bent (member.groepen),
//    wedstrijden waarvoor je ingeschreven bent, examens als kandidaat, evenementen;
//  • je rol-activiteiten: trainingen waar je lesgeeft/assisteert, wedstrijden
//    waar je als begeleider bent aangeduid (aanwezig=true of niet aanwezig maar aangeduid).
//
// GROEPEN-LOGICA:
//   - Deelnemersgroepen komen uit members/{linkedMemberId}.groepen (array van groepsnamen,
//     bv. ["Groep 3"]). Trainingen slaan groepNaam op als titel.
//   - profiel.groepen (users-document) bevat groep-IDs voor trainers/notificaties — NIET
//     de deelnemersgroepen. Die worden hier NIET gebruikt voor deelname-check.
//
// WEDSTRIJD BEGELEIDER:
//   - Een begeleider (uid-match in event.begeleiders) ziet de wedstrijd ALTIJD in zijn
//     eerstvolgende activiteiten, ongeacht of hij zichzelf aangevinkt heeft.
//   - Trainer/assistent rollen kunnen ook als begeleider worden aangeduid.
//
// EVENEMENTEN:
//   - Komende evenementen worden ALTIJD clubbreed getoond (ongeacht of je
//     ingeschreven bent), zolang je ze mag zien (zichtbaarheid wordt al in
//     useAgendaItems gefilterd op rol).
//   - Ben je ingeschreven (evenementen/{id}/registrations/{memberId} bestaat),
//     dan toont een duidelijke "✓ Ingeschreven"-badge — ook voor een gewoon lid.
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
  trainer:     'als trainer',
  assistent:   'als assistent',
  deelnemer:   'als deelnemer',
  begeleider:  'als begeleider',
  kandidaat:   'als kandidaat',
  ingeschreven: '✓ Ingeschreven',
};

export default function EerstvolgendeActiviteiten({ profiel, onItemKlik, aantal = 3 }) {
  const { isLid, isAssistent, lesgeverId } = useAuth();
  const { items, laden } = useAgendaItems({ profiel, alleenVanaf: vandaagISO() });
  const [ingeschrevenEventIds, setIngeschrevenEventIds] = useState(null);
  const [examenKandidaatIds, setExamenKandidaatIds] = useState(null);
  const [evenementIngeschrevenIds, setEvenementIngeschrevenIds] = useState(null);
  // Deelnemersgroepen uit het member-document (array van groepsnamen)
  const [memberGroepNamen, setMemberGroepNamen] = useState(null);

  const mijnMemberId = profiel?.linkedMemberId || null;

  // Haal de deelnemersgroepen op uit het member-document.
  // members.groepen = array van groepsnamen, bv. ["Groep 3"].
  // Trainingen slaan groepNaam op als item.titel.
  // We vergelijken later op groepNaam (item.titel) ipv groepId.
  useEffect(() => {
    let actief = true;
    if (!mijnMemberId) {
      setMemberGroepNamen([]);
      return;
    }
    (async () => {
      try {
        const lidSnap = await getDoc(doc(db, 'members', mijnMemberId));
        if (!actief) return;
        if (lidSnap.exists()) {
          const groepen = lidSnap.data().groepen;
          setMemberGroepNamen(Array.isArray(groepen) ? groepen : []);
        } else {
          setMemberGroepNamen([]);
        }
      } catch {
        if (actief) setMemberGroepNamen([]);
      }
    })();
    return () => { actief = false; };
  }, [mijnMemberId]);

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

  // Evenementen waarvoor je als lid ingeschreven bent (per toekomstig evenement
  // de eigen registrations-doc op je memberId checken).
  const evenementIdsKey = useMemo(
    () => [...new Set(items.filter(i => i.bron === 'evenementen').map(i => i.id))].sort().join('|'),
    [items],
  );
  useEffect(() => {
    if (!mijnMemberId || !evenementIdsKey) { setEvenementIngeschrevenIds(new Set()); return; }
    let actief = true;
    (async () => {
      const ids = evenementIdsKey.split('|');
      const found = new Set();
      await Promise.all(ids.map(async (eid) => {
        try {
          const snap = await getDoc(doc(db, 'evenementen', eid, 'registrations', mijnMemberId));
          if (snap.exists()) found.add(eid);
        } catch { /* geen toegang/inschrijving */ }
      }));
      if (actief) setEvenementIngeschrevenIds(found);
    })();
    return () => { actief = false; };
  }, [mijnMemberId, evenementIdsKey]);

  const relevante = useMemo(() => {
    if (ingeschrevenEventIds === null || examenKandidaatIds === null || memberGroepNamen === null || evenementIngeschrevenIds === null) return null;
    const resultaat = [];

    for (const item of items) {
      if (item.isGeenTraining) continue;
      const relaties = [];

      if (item.bron === 'trainingen') {
        // Trainer/assistent: staat vermeld als lesgever
        if (lesgeverId && (item.extra?.lesgevers || []).includes(lesgeverId)) {
          relaties.push(isAssistent ? 'assistent' : 'trainer');
        }
        // Deelnemer: groep staat in member-document (groepsnamen vergelijken met training-titel)
        // item.titel = groepNaam (zie useAgendaItems: t.groepNaam || t.groepId || 'Training')
        if (memberGroepNamen.length > 0 && memberGroepNamen.includes(item.titel)) {
          relaties.push('deelnemer');
        }
        if (relaties.length === 0) continue;
      } else if (item.bron === 'events' && item.type === 'wedstrijd') {
        // Begeleider: lesgeverId staat in event.begeleiders én aanwezig is aangevinkt
        if (lesgeverId && (item.extra?.begeleiders || []).some(b => b.lesgeverId === lesgeverId && b.aanwezig)) relaties.push('begeleider');
        // Deelnemer: ingeschreven via inschrijvingen-collectie
        if (ingeschrevenEventIds.has(item.id)) relaties.push('deelnemer');
        if (relaties.length === 0) continue;
      } else if (item.type === 'examen') {
        if (!examenKandidaatIds.has(item.id)) continue;
        relaties.push('kandidaat');
      } else if (item.bron === 'evenementen') {
        // Clubbreed tonen; ben je ingeschreven, dan een duidelijke badge.
        if (evenementIngeschrevenIds.has(item.id)) relaties.push('ingeschreven');
      } else {
        continue;
      }

      resultaat.push({ item, relaties });
    }
    return resultaat.slice(0, aantal);
  }, [items, isAssistent, lesgeverId, profiel?.uid, memberGroepNamen, ingeschrevenEventIds, examenKandidaatIds, evenementIngeschrevenIds, aantal]);

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
        // bij trainingen/wedstrijden altijd 'deelnemer' en dus impliciet).
        // Uitzondering: de evenement-inschrijving tonen we ALTIJD, ook aan een lid.
        const heeftIngeschreven = relaties.includes('ingeschreven');
        const toonRelaties = relaties.length > 0 && (!isLid || heeftIngeschreven);
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
                {relaties.map(r => {
                  const groen = r === 'ingeschreven';
                  const blauw = r === 'deelnemer' || r === 'kandidaat';
                  return (
                    <span key={r} style={{
                      fontSize: '11px', fontWeight: '700', padding: '1px 8px', borderRadius: '999px',
                      background: groen ? 'rgba(34,197,94,0.18)' : blauw ? 'rgba(56,189,248,0.16)' : 'rgba(167,139,250,0.18)',
                      color: groen ? '#22C55E' : blauw ? '#38BDF8' : '#A78BFA',
                    }}>
                      {RELATIE_LABEL[r] || r}
                    </span>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
