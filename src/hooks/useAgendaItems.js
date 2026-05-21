// Gedeelde data-hook: laadt trainingen + wedstrijden/examens + evenementen
// Vervangt drie duplicaten in Dashboard.jsx (VolgendActiviteitWidget, KomendeActiviteitenWidget)
// en de laadAgendaData-functie uit Agenda.jsx.
//
// Opties:
//   filters         { toonTrainingen, toonWedstrijden, toonExamens, toonEvenementen, enkelMijnGroepen }
//   profiel         user profile (voor groepen/rol filtering)
//   alleenVanaf     ISO-datum string — items met datum < deze worden weggefilterd (optioneel)
//   alleenTot       ISO-datum string — items met datum > deze worden weggefilterd (optioneel)
//   markeerGeenTraining boolean — bepaalt isGeenTraining-vlag op trainingen (default true)

import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { huidigSeizoen } from '../components/trainingen/seizoenHelpers';
import {
  DEFAULT_GEEN_TRAINING_MARKERS,
  markersUitSettings,
  getClubSettings,
  isGeenTrainingTekst,
} from '../services/firestoreService';

const STANDAARD_FILTERS = {
  toonTrainingen:   true,
  toonWedstrijden:  true,
  toonExamens:      true,
  toonEvenementen:  true,
  enkelMijnGroepen: false,
};

export async function laadAgendaItems({ filters = STANDAARD_FILTERS, profiel, alleenVanaf, alleenTot, geenTrainingMarkers = DEFAULT_GEEN_TRAINING_MARKERS }) {
  const seizoen = huidigSeizoen();
  const resultaten = [];
  const isLid = profiel?.rol === 'lid';
  const mijnGroepen = profiel?.groepen || [];

  // 1. Trainingen
  if (filters.toonTrainingen) {
    try {
      const snap = await getDocs(query(
        collection(db, 'trainingen'),
        where('seizoen', '==', seizoen),
        orderBy('datum', 'asc')
      ));
      snap.docs.forEach(d => {
        const t = d.data();
        if (!t.datum) return;
        if (alleenVanaf && t.datum < alleenVanaf) return;
        if (alleenTot   && t.datum > alleenTot)   return;
        // Leden: altijd op eigen groepen filteren als ze die hebben
        // Trainers/admins: alleen wanneer enkelMijnGroepen aangevinkt is
        if (isLid && mijnGroepen.length > 0) {
          if (!mijnGroepen.includes(t.groepId)) return;
        } else if (!isLid && filters.enkelMijnGroepen && mijnGroepen.length > 0) {
          if (!mijnGroepen.includes(t.groepId)) return;
        }
        resultaten.push({
          id:             d.id,
          datum:          t.datum,
          titel:          t.groepNaam || t.groepId || 'Training',
          type:           'training',
          bron:           'trainingen',
          bronId:         d.id,
          startTijd:      t.startTijd || null,
          eindTijd:       t.eindTijd || null,
          isGeenTraining: isGeenTrainingTekst(t.opmerking, geenTrainingMarkers),
          opmerking:      t.opmerking || '',
          extra:          { groepId: t.groepId, lesgevers: t.lesgevers || [] },
        });
      });
    } catch (e) { console.error('useAgendaItems trainingen:', e); }
  }

  // 2. Events (wedstrijden + examens)
  if (filters.toonWedstrijden || filters.toonExamens) {
    try {
      const snap = await getDocs(collection(db, 'events'));
      snap.docs.forEach(d => {
        const e = d.data();
        const isW = e.type === 'wedstrijd';
        const isE = e.type === 'examen';
        if (isW && !filters.toonWedstrijden) return;
        if (isE && !filters.toonExamens)    return;
        if (!isW && !isE)                    return;
        if (!e.datum) return;
        if (alleenVanaf && e.datum < alleenVanaf) return;
        if (alleenTot   && e.datum > alleenTot)   return;
        resultaten.push({
          id:     d.id,
          datum:  e.datum,
          titel:  e.naam || (isE ? 'Examen' : 'Wedstrijd'),
          type:   e.type,
          bron:   'events',
          bronId: d.id,
          extra:  {
            locatie:   e.locatie || e.location || '',
            doelgroep: e.doelgroep || '',
          },
        });
      });
    } catch (e) { console.error('useAgendaItems events:', e); }
  }

  // 3. Evenementen
  if (filters.toonEvenementen) {
    try {
      const snap = await getDocs(query(collection(db, 'evenementen'), orderBy('datum', 'asc')));
      snap.docs.forEach(d => {
        const e = d.data();
        if (!e.datum) return;
        if (alleenVanaf && e.datum < alleenVanaf) return;
        if (alleenTot   && e.datum > alleenTot)   return;
        resultaten.push({
          id:     d.id,
          datum:  e.datum,
          titel:  e.titel || 'Evenement',
          type:   e.type || 'overig',
          bron:   'evenementen',
          bronId: d.id,
          extra:  { beschrijving: e.beschrijving || '', link: e.link || '', eindDatum: e.eindDatum || '' },
        });
      });
    } catch (e) { console.error('useAgendaItems evenementen:', e); }
  }

  return resultaten.sort((a, b) => a.datum.localeCompare(b.datum));
}

export default function useAgendaItems({ filters, profiel, alleenVanaf, alleenTot } = {}) {
  const [items, setItems] = useState([]);
  const [laden, setLaden] = useState(true);
  const [geenTrainingMarkers, setGeenTrainingMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);

  const filtersKey = JSON.stringify(filters || STANDAARD_FILTERS);

  useEffect(() => {
    let actief = true;
    setLaden(true);

    getClubSettings().then(settings => {
      if (!actief) return;
      const markers = settings ? markersUitSettings(settings) : DEFAULT_GEEN_TRAINING_MARKERS;
      setGeenTrainingMarkers(markers);

      laadAgendaItems({
        filters: filters || STANDAARD_FILTERS,
        profiel,
        alleenVanaf,
        alleenTot,
        geenTrainingMarkers: markers,
      }).then(data => {
        if (!actief) return;
        setItems(data);
        setLaden(false);
      }).catch(() => {
        if (actief) setLaden(false);
      });
    });

    return () => { actief = false; };
  }, [filtersKey, profiel?.uid, alleenVanaf, alleenTot]);

  return { items, laden, geenTrainingMarkers };
}
