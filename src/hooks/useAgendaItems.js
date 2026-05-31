import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { huidigSeizoen } from '../components/trainingen/seizoenHelpers';
import {
  DEFAULT_GEEN_TRAINING_MARKERS,
  DEFAULT_PROVINCIALE_MARKERS,
  markersUitSettings,
  markersProvinciaalUitSettings,
  getClubSettings,
} from '../services/firestoreService';
import {
  TRAINING_STATUS,
  STATUS_LABELS,
  STATUS_EMOJI,
  bepaalTrainingStatus,
} from '../components/trainingen/trainingStatus';

// Bepaalt of een evenement met gegeven zichtbaarheid getoond mag worden aan
// een gebruiker met een bepaalde rol. 'iedereen' (of leeg) = alle leden,
// 'trainers' = alle lesgevers/bestuur (iedereen behalve een gewoon lid),
// 'bestuur' = enkel bestuurslid/admin.
function magEvenementZien(zichtbaarheid, rol) {
  if (!zichtbaarheid || zichtbaarheid === 'iedereen') return true;
  if (zichtbaarheid === 'trainers') return rol !== 'lid';
  if (zichtbaarheid === 'bestuur') return rol === 'bestuurslid' || rol === 'admin';
  return true;
}

const STANDAARD_FILTERS = {
  toonTrainingen:   true,
  toonWedstrijden:  true,
  toonExamens:      true,
  toonEvenementen:  true,
  enkelMijnGroepen: false,
};

// Module-level cache: getClubSettings 1× per sessie ophalen
let _clubSettingsCache = null;
let _clubSettingsPromise = null;
function getClubSettingsCached() {
  if (_clubSettingsCache) return Promise.resolve(_clubSettingsCache);
  if (_clubSettingsPromise) return _clubSettingsPromise;
  _clubSettingsPromise = getClubSettings().then(s => {
    _clubSettingsCache = s;
    _clubSettingsPromise = null;
    return s;
  });
  return _clubSettingsPromise;
}

export async function laadAgendaItems({ filters = STANDAARD_FILTERS, profiel, alleenVanaf, alleenTot, geenTrainingMarkers = DEFAULT_GEEN_TRAINING_MARKERS, provincialeMarkers = DEFAULT_PROVINCIALE_MARKERS }) {
  const seizoen = huidigSeizoen();
  const isLid = profiel?.rol === 'lid';
  const mijnGroepen = profiel?.groepen || [];

  // Groepen vooraf inladen: nodig voor groepsnaam, de provinciale-kalender-vlag
  // en om bij samengevoegde trainingen de doelgroep + het juiste uur te tonen.
  let groepenMap = {};
  if (filters.toonTrainingen) {
    try {
      const gSnap = await getDocs(collection(db, 'groepen'));
      gSnap.docs.forEach(d => { groepenMap[d.id] = { id: d.id, ...d.data() }; });
    } catch (e) { console.error('useAgendaItems groepen:', e); }
  }

  // Alle queries parallel opstarten
  const queries = [];

  if (filters.toonTrainingen) {
    queries.push(
      getDocs(query(
        collection(db, 'trainingen'),
        where('seizoen', '==', seizoen),
        orderBy('datum', 'asc')
      )).then(snap => {
        const resultaten = [];
        snap.docs.forEach(d => {
          const t = d.data();
          if (!t.datum) return;
          if (alleenVanaf && t.datum < alleenVanaf) return;
          if (alleenTot   && t.datum > alleenTot)   return;
          if (isLid && mijnGroepen.length > 0 && !mijnGroepen.includes(t.groepId)) return;
          if (!isLid && filters.enkelMijnGroepen && mijnGroepen.length > 0 && !mijnGroepen.includes(t.groepId)) return;

          const eigenGroep = groepenMap[t.groepId];
          const status = bepaalTrainingStatus(t, {
            geenMarkers: geenTrainingMarkers,
            provincialeMarkers,
            volgtProvincialeKalender: eigenGroep?.volgtProvincialeKalender,
          });

          // Bij een samenvoeging: doelgroep(en) + (hun) uur tonen, zodat de leden
          // van deze groep zien dat ze wél les hebben, maar bij een andere groep.
          const normalizeGroepen = (v) => !v ? [] : Array.isArray(v) ? v : [v];
          let samengevoegdMetNaam = null;
          let startTijd = t.startTijd || null;
          let eindTijd  = t.eindTijd || null;
          if (status === TRAINING_STATUS.SAMENGEVOEGD && t.samengevoegdMet) {
            const doelIds = normalizeGroepen(t.samengevoegdMet);
            const doelen = doelIds.map(id => groepenMap[id]).filter(Boolean);
            samengevoegdMetNaam = doelIds.map(id => groepenMap[id]?.naam || id).join(', ');
            const eersteDoelMet = doelen.find(d => d.startTijd);
            if (eersteDoelMet?.startTijd) startTijd = eersteDoelMet.startTijd;
            if (eersteDoelMet?.eindTijd)  eindTijd  = eersteDoelMet.eindTijd;
          }

          resultaten.push({
            id:             d.id,
            datum:          t.datum,
            titel:          t.groepNaam || eigenGroep?.naam || t.groepId || 'Training',
            type:           'training',
            bron:           'trainingen',
            bronId:         d.id,
            startTijd,
            eindTijd,
            // geen + geannuleerd → in widgets doorstrepen/overslaan
            isGeenTraining: status === TRAINING_STATUS.GEEN || status === TRAINING_STATUS.GEANNULEERD,
            status,
            samengevoegdMet:     t.samengevoegdMet || null,
            samengevoegdMetNaam,
            opmerking:      t.opmerking || '',
            extra:          { groepId: t.groepId, lesgevers: t.lesgevers || [] },
          });
        });
        return resultaten;
      }).catch(e => { console.error('useAgendaItems trainingen:', e); return []; })
    );
  }

  if (filters.toonWedstrijden || filters.toonExamens) {
    queries.push(
      getDocs(collection(db, 'events')).then(snap => {
        const resultaten = [];
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
              locatie:     e.locatie || e.location || '',
              doelgroep:   e.doelgroep || '',
              begeleiders: Array.isArray(e.begeleiders) ? e.begeleiders : [],
            },
          });
        });
        return resultaten;
      }).catch(e => { console.error('useAgendaItems events:', e); return []; })
    );
  }

  if (filters.toonEvenementen) {
    queries.push(
      getDocs(query(collection(db, 'evenementen'), orderBy('datum', 'asc'))).then(snap => {
        const resultaten = [];
        snap.docs.forEach(d => {
          const e = d.data();
          if (!e.datum) return;
          if (alleenVanaf && e.datum < alleenVanaf) return;
          if (alleenTot   && e.datum > alleenTot)   return;
          if (!magEvenementZien(e.zichtbaarheid, profiel?.rol)) return;
          resultaten.push({
            id:     d.id,
            datum:  e.datum,
            titel:  e.titel || 'Evenement',
            type:   e.type || 'overig',
            bron:   'evenementen',
            bronId: d.id,
            extra:  {
              beschrijving:       e.beschrijving || '',
              eindDatum:          e.eindDatum || '',
              zichtbaarheid:      e.zichtbaarheid || 'iedereen',
              inschrijvenMogelijk: e.inschrijvenMogelijk !== false,
              gastenToegestaan:   e.gastenToegestaan === true,
              inschrijfDeadline:  e.inschrijfDeadline || '',
            },
          });
        });
        return resultaten;
      }).catch(e => { console.error('useAgendaItems evenementen:', e); return []; })
    );
  }

  const resultatenPerBron = await Promise.all(queries);
  return resultatenPerBron.flat().sort((a, b) => a.datum.localeCompare(b.datum));
}

export default function useAgendaItems({ filters, profiel, alleenVanaf, alleenTot } = {}) {
  const [items, setItems] = useState([]);
  const [laden, setLaden] = useState(true);
  const [geenTrainingMarkers, setGeenTrainingMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);

  const filtersKey = JSON.stringify(filters || STANDAARD_FILTERS);

  useEffect(() => {
    let actief = true;
    setLaden(true);

    getClubSettingsCached().then(settings => {
      if (!actief) return;
      const markers = settings ? markersUitSettings(settings) : DEFAULT_GEEN_TRAINING_MARKERS;
      const provincialeMarkers = settings ? markersProvinciaalUitSettings(settings) : DEFAULT_PROVINCIALE_MARKERS;
      setGeenTrainingMarkers(markers);

      laadAgendaItems({
        filters: filters || STANDAARD_FILTERS,
        profiel,
        alleenVanaf,
        alleenTot,
        geenTrainingMarkers: markers,
        provincialeMarkers,
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
