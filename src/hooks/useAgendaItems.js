import { useContext, useEffect, useMemo, useReducer, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import AuthContext from '../contexts/AuthContext';
import { huidigSeizoen } from '../components/trainingen/seizoenHelpers';
import {
  DEFAULT_GEEN_TRAINING_MARKERS,
  DEFAULT_PROVINCIALE_MARKERS,
  markersUitSettings,
  markersProvinciaalUitSettings,
  getClubSettingsCached,
} from '../services/firestoreService';
import { TRAINING_STATUS, bepaalTrainingStatus } from '../components/trainingen/trainingStatus';
import {
  abonneer,
  zorgVoor,
  isGedekt,
  leesAgendaStore,
  versieAgendaStore,
  trainingenQuery,
  eventsQuery,
  evenementenQuery,
} from './agendaStore';

// Bepaalt of een evenement met gegeven zichtbaarheid getoond mag worden aan
// een gebruiker met een bepaalde rol. 'iedereen' (of leeg) = alle leden,
// 'trainers' = alle lesgevers/bestuur (iedereen behalve een gewoon lid),
// 'bestuur' = enkel bestuurslid/admin.
// LET OP: enkel UI-filtering; firestore.rules laten evenementen lezen voor elke ingelogde gebruiker.
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

function groepenMapVan(lijst) {
  const m = {};
  (lijst || []).forEach(g => { if (g?.id) m[g.id] = g; });
  return m;
}

// Directe read van de groepen-collectie (null bij fout).
async function leesGroepenMap() {
  try {
    const snap = await getDocs(collection(db, 'groepen'));
    const m = {};
    snap.docs.forEach(d => { m[d.id] = { id: d.id, ...d.data() }; });
    return m;
  } catch (e) {
    console.error('useAgendaItems groepen:', e);
    return null;
  }
}

// Fallback voor als configCache.groepen nog leeg is (eerste login, config nog onderweg):
// 1× per sessie lezen.
let _groepenFallbackPromise = null;
function groepenFallback() {
  if (!_groepenFallbackPromise) {
    _groepenFallbackPromise = leesGroepenMap().then(m => {
      if (m === null) { _groepenFallbackPromise = null; return {}; }
      return m;
    });
  }
  return _groepenFallbackPromise;
}

const normalizeGroepen = (v) => !v ? [] : Array.isArray(v) ? v : [v];

function bouwTrainingItem(id, t, { groepenMap, geenTrainingMarkers, provincialeMarkers }) {
  const eigenGroep = groepenMap[t.groepId];
  const status = bepaalTrainingStatus(t, {
    geenMarkers: geenTrainingMarkers,
    provincialeMarkers,
    volgtProvincialeKalender: eigenGroep?.volgtProvincialeKalender,
  });

  // Bij een samenvoeging: doelgroep(en) + (hun) uur tonen, zodat de leden
  // van deze groep zien dat ze wél les hebben, maar bij een andere groep.
  let samengevoegdMetNaam = null;
  let startTijd = t.startTijd || null;
  let eindTijd  = t.eindTijd || null;
  if (status === TRAINING_STATUS.SAMENGEVOEGD && t.samengevoegdMet) {
    const doelIds = normalizeGroepen(t.samengevoegdMet);
    const doelen = doelIds.map(gid => groepenMap[gid]).filter(Boolean);
    samengevoegdMetNaam = doelIds.map(gid => groepenMap[gid]?.naam || gid).join(', ');
    const eersteDoelMet = doelen.find(d => d.startTijd);
    if (eersteDoelMet?.startTijd) startTijd = eersteDoelMet.startTijd;
    if (eersteDoelMet?.eindTijd)  eindTijd  = eersteDoelMet.eindTijd;
  }

  return {
    id,
    datum:          t.datum,
    titel:          t.groepNaam || eigenGroep?.naam || t.groepId || 'Training',
    type:           'training',
    bron:           'trainingen',
    bronId:         id,
    startTijd,
    eindTijd,
    // geen + geannuleerd → in widgets doorstrepen/overslaan
    isGeenTraining: status === TRAINING_STATUS.GEEN || status === TRAINING_STATUS.GEANNULEERD,
    status,
    samengevoegdMet:     t.samengevoegdMet || null,
    samengevoegdMetNaam,
    opmerking:      t.opmerking || '',
    extra:          { groepId: t.groepId, lesgevers: t.lesgevers || [] },
  };
}

// Sorteervolgorde binnen dezelfde datum:
//   1. wedstrijden  (meest prominente clubactiviteit)
//   2. examens
//   3. evenementen  (clubactiviteit, stage, meeting, overig, …)
//   4. trainingen   (zelfde kleur als achtergrond → visueel minst opvallend)
const TYPE_VOLGORDE = { wedstrijd: 0, examen: 1, evenement: 2, training: 3 };
const typeVolgorde = (type) => TYPE_VOLGORDE[type] ?? 2; // onbekend type = evenement-positie

// Bouwt (en filtert) agenda-items uit RUWE docs. Gedeeld door laadAgendaItems en de
// store-modus van de hook, zodat beide paden identiek gedrag hebben.
//   raw = { trainingen, events, evenementen } met { id, data }
function maakItems(raw, { filters = STANDAARD_FILTERS, profiel, alleenVanaf, alleenTot, groepenMap = {}, geenTrainingMarkers, provincialeMarkers }) {
  const isLid = profiel?.rol === 'lid';
  // Twee aparte betekenissen van 'groepen' op het users-document: voor een lid
  // zijn dat de gesynchroniseerde deelnemersgroepen (mijnDeelnameGroepen); voor
  // een trainer/assistent/bestuur zijn dat de zelf gekozen lesgeversgroepen
  // (mijnLesgeverGroepen, apart veld — zie ProfielPagina "Mijn groepen").
  const mijnDeelnameGroepen = profiel?.groepen || [];
  const mijnLesgeverGroepen = profiel?.lesgeverGroepen || [];
  const resultaten = [];

  if (filters.toonTrainingen) {
    for (const { id, data: t } of raw.trainingen || []) {
      if (!t.datum) continue;
      if (alleenVanaf && t.datum < alleenVanaf) continue;
      if (alleenTot   && t.datum > alleenTot)   continue;
      if (isLid && mijnDeelnameGroepen.length > 0 && !mijnDeelnameGroepen.includes(t.groepId)) continue;
      if (!isLid && filters.enkelMijnGroepen && mijnLesgeverGroepen.length > 0 && !mijnLesgeverGroepen.includes(t.groepId)) continue;
      resultaten.push(bouwTrainingItem(id, t, { groepenMap, geenTrainingMarkers, provincialeMarkers }));
    }
  }

  if (filters.toonWedstrijden || filters.toonExamens) {
    for (const { id, data: e } of raw.events || []) {
      const isW = e.type === 'wedstrijd';
      const isE = e.type === 'examen';
      if (isW && !filters.toonWedstrijden) continue;
      if (isE && !filters.toonExamens)    continue;
      if (!isW && !isE)                    continue;
      if (!e.datum) continue;
      if (alleenVanaf && e.datum < alleenVanaf) continue;
      if (alleenTot   && e.datum > alleenTot)   continue;
      resultaten.push({
        id,
        datum:  e.datum,
        titel:  e.naam || (isE ? 'Examen' : 'Wedstrijd'),
        type:   e.type,
        bron:   'events',
        bronId: id,
        extra:  {
          locatie:     e.locatie || e.location || '',
          doelgroep:   e.doelgroep || '',
          begeleiders: Array.isArray(e.begeleiders) ? e.begeleiders : [],
          lesgevers:   Array.isArray(e.lesgevers)   ? e.lesgevers   : [],
        },
      });
    }
  }

  if (filters.toonEvenementen) {
    for (const { id, data: e } of raw.evenementen || []) {
      if (!e.datum) continue;
      if (alleenVanaf && e.datum < alleenVanaf) continue;
      if (alleenTot   && e.datum > alleenTot)   continue;
      if (!magEvenementZien(e.zichtbaarheid, profiel?.rol)) continue;
      resultaten.push({
        id,
        datum:  e.datum,
        titel:  e.titel || 'Evenement',
        type:   e.type || 'overig',
        bron:   'evenementen',
        bronId: id,
        extra:  {
          beschrijving:       e.beschrijving || '',
          eindDatum:          e.eindDatum || '',
          zichtbaarheid:      e.zichtbaarheid || 'iedereen',
          inschrijvenMogelijk: e.inschrijvenMogelijk !== false,
          gastenToegestaan:   e.gastenToegestaan === true,
          inschrijfDeadline:  e.inschrijfDeadline || '',
        },
      });
    }
  }

  return resultaten.sort((a, b) => {
    const datumCmp = a.datum.localeCompare(b.datum);
    if (datumCmp !== 0) return datumCmp;
    return typeVolgorde(a.type) - typeVolgorde(b.type);
  });
}

// Publieke API (ongewijzigd, plus optionele `groepen`): leest rechtstreeks uit Firestore.
// `groepen` (optioneel) = array of map met groepen → slaat de losse read van 'groepen' over.
export async function laadAgendaItems({ filters = STANDAARD_FILTERS, profiel, alleenVanaf, alleenTot, geenTrainingMarkers = DEFAULT_GEEN_TRAINING_MARKERS, provincialeMarkers = DEFAULT_PROVINCIALE_MARKERS, groepen }) {
  const seizoen = huidigSeizoen();
  const lees = (q, label) => getDocs(q)
    .then(snap => snap.docs.map(d => ({ id: d.id, data: d.data() })))
    .catch(e => { console.error(`useAgendaItems ${label}:`, e); return []; });

  // Alle queries parallel opstarten. Datumgrenzen zitten nu in de query (trainingen:
  // composite index seizoen+datum; events/evenementen: single-field datum).
  const [groepenMap, trainingen, events, evenementen] = await Promise.all([
    filters.toonTrainingen
      ? (groepen
          ? Promise.resolve(Array.isArray(groepen) ? groepenMapVan(groepen) : groepen)
          : leesGroepenMap().then(m => m || {}))
      : Promise.resolve({}),
    filters.toonTrainingen ? lees(trainingenQuery(seizoen, alleenVanaf, alleenTot), 'trainingen') : [],
    (filters.toonWedstrijden || filters.toonExamens) ? lees(eventsQuery(alleenVanaf, alleenTot), 'events') : [],
    filters.toonEvenementen ? lees(evenementenQuery(alleenVanaf, alleenTot), 'evenementen') : [],
  ]);

  return maakItems(
    { trainingen, events, evenementen },
    { filters, profiel, alleenVanaf, alleenTot, groepenMap, geenTrainingMarkers, provincialeMarkers },
  );
}

function bronnenVoor(f) {
  const b = [];
  if (f.toonTrainingen) b.push('trainingen');
  if (f.toonWedstrijden || f.toonExamens) b.push('events');
  if (f.toonEvenementen) b.push('evenementen');
  return b;
}

// Opties zoals voorheen; nieuw: `gedeeld: true` laat de hook meeliften op de gedeelde
// dashboard-store (1 fetch voor alle widgets). Zonder `gedeeld` (bv. Agenda.jsx) blijft
// het gedrag: elke aanroep leest zelf vers uit Firestore, zonder cache.
export default function useAgendaItems({ filters, profiel, alleenVanaf, alleenTot, gedeeld = false } = {}) {
  const authCtx = useContext(AuthContext);
  const configGroepen = authCtx?.configCache?.groepen;
  const effFilters = filters || STANDAARD_FILTERS;
  const filtersKey = JSON.stringify(effFilters);
  const uid = profiel?.uid || '';
  const heeftGroepenNodig = !!effFilters.toonTrainingen;
  const configHeeftGroepen = Array.isArray(configGroepen) && configGroepen.length > 0;

  // Club-markers (1× per sessie)
  const [markers, setMarkers] = useState(null);
  useEffect(() => {
    let actief = true;
    getClubSettingsCached().then(settings => {
      if (!actief) return;
      setMarkers({
        geen: settings ? markersUitSettings(settings) : DEFAULT_GEEN_TRAINING_MARKERS,
        provinciaal: settings ? markersProvinciaalUitSettings(settings) : DEFAULT_PROVINCIALE_MARKERS,
      });
    });
    return () => { actief = false; };
  }, []);

  // Groepen: bij voorkeur uit configCache (0 reads); anders 1× per sessie een fallback-read.
  const [fallbackGroepen, setFallbackGroepen] = useState(null);
  useEffect(() => {
    if (!heeftGroepenNodig || configHeeftGroepen) return undefined;
    let actief = true;
    groepenFallback().then(m => { if (actief) setFallbackGroepen(m); });
    return () => { actief = false; };
  }, [heeftGroepenNodig, configHeeftGroepen]);

  const groepenMap = useMemo(
    () => (configHeeftGroepen ? groepenMapVan(configGroepen) : fallbackGroepen),
    [configHeeftGroepen, configGroepen, fallbackGroepen],
  );
  const groepenKlaar = !heeftGroepenNodig || groepenMap !== null;

  // ── Gedeelde modus ─────────────────────────────────────────────────────────
  const [, forceer] = useReducer(n => n + 1, 0);
  const bronnen = useMemo(() => bronnenVoor(effFilters), [filtersKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const storeVersie = gedeeld ? versieAgendaStore() : 0;

  useEffect(() => {
    if (!gedeeld) return undefined;
    return abonneer(uid, forceer);
  }, [gedeeld, uid]);

  useEffect(() => {
    if (!gedeeld) return;
    zorgVoor(uid, { vanaf: alleenVanaf, tot: alleenTot, bronnen });
  }, [gedeeld, uid, alleenVanaf, alleenTot, bronnen, storeVersie]);

  const gedekt = gedeeld ? isGedekt(uid, { vanaf: alleenVanaf, tot: alleenTot, bronnen }) : true;
  const raw = useMemo(() => (gedeeld ? leesAgendaStore(uid) : null), [gedeeld, uid, storeVersie]); // eslint-disable-line react-hooks/exhaustive-deps

  const profielKey = JSON.stringify([profiel?.rol ?? null, profiel?.groepen || [], profiel?.lesgeverGroepen || []]);
  const profielBasis = useMemo( // eslint-disable-line react-hooks/exhaustive-deps
    () => ({ rol: profiel?.rol, groepen: profiel?.groepen, lesgeverGroepen: profiel?.lesgeverGroepen }),
    [profielKey],
  );

  const gedeeldeItems = useMemo(() => {
    if (!gedeeld || !raw || !markers || !groepenKlaar) return [];
    return maakItems(raw, {
      filters: effFilters,
      profiel: profielBasis,
      alleenVanaf,
      alleenTot,
      groepenMap: groepenMap || {},
      geenTrainingMarkers: markers.geen,
      provincialeMarkers: markers.provinciaal,
    });
  }, [gedeeld, raw, markers, groepenKlaar, groepenMap, filtersKey, profielBasis, alleenVanaf, alleenTot]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Legacy modus (ongewijzigd gedrag: eigen fetch per aanroep) ────────────
  const [legacyItems, setLegacyItems] = useState([]);
  const [legacyLaden, setLegacyLaden] = useState(true);

  useEffect(() => {
    if (gedeeld || !markers || !groepenKlaar) return undefined;
    let actief = true;
    setLegacyLaden(true);
    laadAgendaItems({
      filters: effFilters,
      profiel,
      alleenVanaf,
      alleenTot,
      geenTrainingMarkers: markers.geen,
      provincialeMarkers: markers.provinciaal,
      groepen: heeftGroepenNodig ? groepenMap : undefined,
    }).then(data => {
      if (!actief) return;
      setLegacyItems(data);
      setLegacyLaden(false);
    }).catch(() => {
      if (actief) setLegacyLaden(false);
    });
    return () => { actief = false; };
  }, [gedeeld, filtersKey, profiel?.uid, alleenVanaf, alleenTot, markers, groepenKlaar, groepenMap]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    items: gedeeld ? gedeeldeItems : legacyItems,
    laden: gedeeld ? (!markers || !groepenKlaar || !gedekt) : legacyLaden,
    geenTrainingMarkers: markers?.geen || DEFAULT_GEEN_TRAINING_MARKERS,
  };
}
