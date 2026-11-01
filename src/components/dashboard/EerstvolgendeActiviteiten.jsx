// src/components/dashboard/EerstvolgendeActiviteiten.jsx
// Toont de eerstvolgende, voor jou relevante activiteiten als UNIE van:
//  • je eigen deelnames (waar je als lid voor ingeschreven bent via ledenbeheer):
//    trainingen van groepen waaraan je als deelnemer gekoppeld bent (member.groepen),
//    wedstrijden waarvoor je ingeschreven bent, examens als kandidaat, evenementen;
//  • je rol-activiteiten: trainingen waar je lesgeeft/assisteert, wedstrijden
//    waar je als begeleider bent aangeduid (aanwezig=true).
//
// GROEPEN-LOGICA:
//   - Deelnemersgroepen komen uit members/{linkedMemberId}.groepen (array van groepsnamen,
//     bv. ["Groep 3"]). Trainingen slaan groepNaam op als titel.
//   - profiel.groepen / profiel.lesgeverGroepen worden hier niet gebruikt voor de
//     deelname-check — die loopt via het member-record.
//
// FIRESTORE-KOST (zie stap 1):
//   - members/{id} wordt 1× gelezen (groepen + naam + geboortejaar).
//   - inschrijvingen: enkel eigen memberId + beheerde kinderen (+ exacte naam voor oudere
//     inschrijvingen zonder memberId), i.p.v. alle toekomstige inschrijvingen van de club.
//   - Examen-/evenement-registraties worden enkel opgezocht voor items die effectief in de
//     top-`aantal` kunnen belanden (i.p.v. 1 read per toekomstig examen/evenement).
//   - De agenda-items komen uit de gedeelde dashboard-store (geen eigen fetch).
//
// EVENEMENTEN: clubbreed getoond; ben je ingeschreven, dan een "✓ Ingeschreven"-badge.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { formatDatum, vandaagISO } from '../trainingen/seizoenHelpers';
import useAgendaItems from '../../hooks/useAgendaItems';
import { useAuth } from '../../contexts/AuthContext';
import { typeKleur, typeLabel, typeEmoji } from '../agenda/agendaConstants';
import { naamSleutel, jaarUitGeboortedatum } from '../../utils/ledenKoppeling';

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
  examinator:  'als examinator',
  ingeschreven: '✓ Ingeschreven',
};

const IN_LIMIET = 30; // Firestore 'in'-limiet

// Leest inschrijvingen waarvan `veld` in `waarden` zit, vanaf `vandaag`.
// Gebruikt de composite index (veld, eventDatum); ontbreekt die (nog), dan valt het terug op
// een query zonder datumgrens (nog steeds beperkt tot deze gebruiker) + client-side filter.
async function leesInschrijvingen(veld, waarden, vandaag) {
  const docs = [];
  for (let i = 0; i < waarden.length; i += IN_LIMIET) {
    const chunk = waarden.slice(i, i + IN_LIMIET);
    const basis = collection(db, 'inschrijvingen');
    let snap;
    try {
      snap = await getDocs(query(basis, where(veld, 'in', chunk), where('eventDatum', '>=', vandaag)));
    } catch (e) {
      if (e?.code !== 'failed-precondition') throw e;
      snap = await getDocs(query(basis, where(veld, 'in', chunk)));
    }
    docs.push(...snap.docs);
  }
  return docs;
}

export default function EerstvolgendeActiviteiten({ profiel, onItemKlik, aantal = 3 }) {
  const { isLid, isAssistent, lesgeverId, configCache } = useAuth();
  const { items, laden } = useAgendaItems({ profiel, alleenVanaf: vandaagISO(), gedeeld: true });

  const mijnMemberId = profiel?.linkedMemberId || null;

  // members/{id}: ÉÉN read voor groepen, naam en geboortejaar.
  // lid === null → nog aan het laden.
  const [lid, setLid] = useState(null);
  useEffect(() => {
    let actief = true;
    setLid(null);
    if (!mijnMemberId) {
      setLid({ groepNamen: [], naam: null, geboortejaar: null });
      return undefined;
    }
    (async () => {
      let info = { groepNamen: [], naam: null, geboortejaar: null };
      try {
        const snap = await getDoc(doc(db, 'members', mijnMemberId));
        if (snap.exists()) {
          const d = snap.data();
          info = {
            groepNamen: Array.isArray(d.groepen) ? d.groepen : [],
            naam: d.naam || null,
            geboortejaar: jaarUitGeboortedatum(d.geboortedatum),
          };
        }
      } catch { /* lid niet leesbaar */ }
      if (actief) setLid(info);
    })();
    return () => { actief = false; };
  }, [mijnMemberId]);

  // Stabiele sleutel: de array-identiteit van beheerMemberIds verandert bij elke
  // profiel-snapshot en triggerde voorheen telkens een volledige herlading.
  const beheerKey = useMemo(
    () => [...new Set(Array.isArray(profiel?.beheerMemberIds) ? profiel.beheerMemberIds : [])].sort().join('|'),
    [profiel?.beheerMemberIds],
  );

  // Waarvoor ben je (of een beheerd kind) als deelnemer ingeschreven (wedstrijden/events)?
  // Primair op memberId; terugval op exacte naam voor oudere inschrijvingen zonder memberId.
  const [ingeschrevenEventIds, setIngeschrevenEventIds] = useState(null);
  useEffect(() => {
    if (lid === null) return undefined;
    let actief = true;
    (async () => {
      const vandaag = vandaagISO();
      const beheerIds = beheerKey ? beheerKey.split('|') : [];
      const beheerSet = new Set(beheerIds);
      const memberIds = [...new Set([mijnMemberId, ...beheerIds].filter(Boolean))];
      const namen = [...new Set([profiel?.naam, lid.naam].filter(n => typeof n === 'string' && n.trim()))];
      const sleutels = new Set(namen.map(naamSleutel));
      try {
        const [perMember, perNaam] = await Promise.all([
          memberIds.length ? leesInschrijvingen('memberId', memberIds, vandaag) : [],
          namen.length ? leesInschrijvingen('judokaNaam', namen, vandaag) : [],
        ]);
        const ids = new Set();
        [...perMember, ...perNaam].forEach(d => {
          const ins = d.data();
          if (!ins.eventId || !(ins.eventDatum >= vandaag)) return;
          if (mijnMemberId && ins.memberId === mijnMemberId) { ids.add(ins.eventId); return; }
          // Ouder: ook registraties van beheerde kinderen tonen
          if (ins.memberId && beheerSet.has(ins.memberId)) { ids.add(ins.eventId); return; }
          if (ins.memberId) return; // gekoppeld aan een ander lid
          if (!sleutels.has(naamSleutel(ins.judokaNaam))) return;
          if (lid.geboortejaar && Number.isFinite(ins.geboortejaar) && ins.geboortejaar !== lid.geboortejaar) return;
          ids.add(ins.eventId);
        });
        if (actief) setIngeschrevenEventIds(ids);
      } catch {
        if (actief) setIngeschrevenEventIds(new Set());
      }
    })();
    return () => { actief = false; };
  }, [lid, mijnMemberId, profiel?.naam, beheerKey]);

  // Stap 1: kandidaten zonder remote lookups + bepalen welke lookups nodig zijn.
  // Kandidaat-types: zeker (training/wedstrijd/evenement/examinator) of optioneel
  // (examen waarvoor je enkel als kandidaat kan binnenkomen).
  const voorbereid = useMemo(() => {
    if (lid === null || ingeschrevenEventIds === null) return null;
    const kandidaten = [];

    for (const item of items) {
      if (item.isGeenTraining) continue;
      const relaties = [];
      let opzoek = null;     // 'x' = examen-registratie, 'e' = evenement-registratie
      let optioneel = false; // pas opgenomen als de opzoeking positief is

      if (item.bron === 'trainingen') {
        // Trainer/assistent: staat vermeld als lesgever
        if (lesgeverId && (item.extra?.lesgevers || []).includes(lesgeverId)) {
          relaties.push(isAssistent ? 'assistent' : 'trainer');
        }
        // Deelnemer: groepsnamen uit member-document vergelijken met training-titel
        if (lid.groepNamen.length > 0 && lid.groepNamen.includes(item.titel)) {
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
        const isExaminator = !!lesgeverId && (item.extra?.lesgevers || []).includes(lesgeverId);
        if (isExaminator) relaties.push('examinator');
        opzoek = 'x';
        optioneel = !isExaminator;
      } else if (item.bron === 'evenementen') {
        // Clubbreed tonen; badge volgt uit de opzoeking.
        opzoek = 'e';
      } else {
        continue;
      }

      kandidaten.push({ item, relaties, opzoek, optioneel });
    }

    // Enkel items die in de top-`aantal` kunnen vallen opzoeken: loop tot er `aantal`
    // zekere items zijn. Latere items kunnen de lijst niet meer halen.
    const nodig = [];
    let zeker = 0;
    for (const k of kandidaten) {
      if (zeker >= aantal) break;
      if (k.opzoek && mijnMemberId) nodig.push(`${k.opzoek}:${k.item.id}`);
      if (!k.optioneel) zeker++;
    }
    return { kandidaten, nodig };
  }, [items, isAssistent, lesgeverId, lid, ingeschrevenEventIds, aantal, mijnMemberId]);

  // Stap 2: registraties opzoeken (examens: kandidaat; evenementen: ingeschreven).
  const [registraties, setRegistraties] = useState({ gezien: new Set(), gevonden: new Set() });
  const opzoekGestart = useRef(new Set());
  const gemount = useRef(true);
  useEffect(() => {
    gemount.current = true;
    return () => { gemount.current = false; };
  }, []);

  const nodigSleutel = voorbereid ? voorbereid.nodig.join('|') : '';
  useEffect(() => {
    if (!mijnMemberId || !nodigSleutel) return;
    const nieuwe = nodigSleutel.split('|').filter(k => !opzoekGestart.current.has(k));
    nieuwe.forEach((sleutel) => {
      opzoekGestart.current.add(sleutel);
      const i = sleutel.indexOf(':');
      const soort = sleutel.slice(0, i);
      const id = sleutel.slice(i + 1);
      (async () => {
        let gevonden = false;
        try {
          if (soort === 'x') {
            const snap = await getDocs(query(
              collection(db, 'events', id, 'registrations'),
              where('memberId', '==', mijnMemberId),
              limit(1),
            ));
            gevonden = !snap.empty;
          } else {
            const snap = await getDoc(doc(db, 'evenementen', id, 'registrations', mijnMemberId));
            gevonden = snap.exists();
          }
        } catch { /* geen toegang/registratie */ }
        if (!gemount.current) return;
        setRegistraties(prev => ({
          gezien: new Set(prev.gezien).add(sleutel),
          gevonden: gevonden ? new Set(prev.gevonden).add(sleutel) : prev.gevonden,
        }));
      })();
    });
  }, [mijnMemberId, nodigSleutel]);

  const relevante = useMemo(() => {
    if (!voorbereid) return null;
    const { kandidaten, nodig } = voorbereid;
    if (mijnMemberId && !nodig.every(k => registraties.gezien.has(k))) return null;

    const resultaat = [];
    for (const k of kandidaten) {
      const relaties = [...k.relaties];
      const gevonden = k.opzoek ? registraties.gevonden.has(`${k.opzoek}:${k.item.id}`) : false;
      if (k.opzoek === 'x') {
        if (gevonden) relaties.push('kandidaat');
        else if (k.optioneel) continue;
      } else if (k.opzoek === 'e' && gevonden) {
        relaties.push('ingeschreven');
      }
      resultaat.push({ item: k.item, relaties });
      if (resultaat.length >= aantal) break;
    }
    return resultaat;
  }, [voorbereid, registraties, mijnMemberId, aantal]);

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
        const kleur = isVandaag ? 'var(--success)' : typeKleur(item.type, configCache?.agendaCategorieen);
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
