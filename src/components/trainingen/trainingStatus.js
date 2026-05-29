// src/components/trainingen/trainingStatus.js
// ─── Trainingstatus — één bron van waarheid ────────────────────────────────────
// Vervangt de fragiele "geen training"-tekstdetectie door een expliciet
// statusveld op de training. De tekstmarkers blijven enkel een hulpmiddel:
//   • om bij Excel-import een status te SUGGEREREN
//   • om legacy-trainingen (zonder statusveld) af te leiden
//
// Statussen:
//   normaal       → gewone training
//   geen          → geen gewone training (vakantie, sporthal gesloten, ...)
//   geannuleerd   → training valt uit (last-minute, met melding)
//   samengevoegd  → deze groep traint samen met een andere groep
//                   (samengevoegdMet = groepId van de doelgroep)

import {
  DEFAULT_GEEN_TRAINING_MARKERS,
  DEFAULT_PROVINCIALE_MARKERS,
  isGeenTrainingTekst,
} from '../../services/firestoreService';

export const TRAINING_STATUS = {
  NORMAAL: 'normaal',
  GEEN: 'geen',
  GEANNULEERD: 'geannuleerd',
  SAMENGEVOEGD: 'samengevoegd',
};

export const STATUS_VOLGORDE = [
  TRAINING_STATUS.NORMAAL,
  TRAINING_STATUS.SAMENGEVOEGD,
  TRAINING_STATUS.GEEN,
  TRAINING_STATUS.GEANNULEERD,
];

export const STATUS_LABELS = {
  normaal:      'Training',
  geen:         'Geen training',
  geannuleerd:  'Geannuleerd',
  samengevoegd: 'Samengevoegd',
};

export const STATUS_EMOJI = {
  normaal:      '🥋',
  geen:         '🚫',
  geannuleerd:  '❌',
  samengevoegd: '🔗',
};

function isGeldigeStatus(s) {
  return Object.values(TRAINING_STATUS).includes(s);
}

// Leidt de status van een training af. Een expliciet statusveld wint altijd.
// Voor legacy-trainingen valt het terug op samengevoegdMet / geannuleerd /
// tekstmarkers. Provinciale markers tellen enkel als "geen" wanneer de groep de
// provinciale kalender volgt.
export function bepaalTrainingStatus(training, opties = {}) {
  if (!training) return TRAINING_STATUS.NORMAAL;
  const {
    geenMarkers = DEFAULT_GEEN_TRAINING_MARKERS,
    provincialeMarkers = DEFAULT_PROVINCIALE_MARKERS,
    volgtProvincialeKalender = false,
  } = opties;

  if (isGeldigeStatus(training.status)) return training.status;
  if (training.samengevoegdMet) return TRAINING_STATUS.SAMENGEVOEGD;
  if (training.geannuleerd) return TRAINING_STATUS.GEANNULEERD;
  if (isGeenTrainingTekst(training.opmerking, geenMarkers)) return TRAINING_STATUS.GEEN;
  if (volgtProvincialeKalender && isGeenTrainingTekst(training.opmerking, provincialeMarkers)) {
    return TRAINING_STATUS.GEEN;
  }
  return TRAINING_STATUS.NORMAAL;
}

// Gaat de training door (al dan niet samen met een andere groep)?
export function isDoorgaand(status) {
  return status === TRAINING_STATUS.NORMAAL || status === TRAINING_STATUS.SAMENGEVOEGD;
}

// Detecteert een "samen met ..."-hint in vrije tekst.
export function heeftSamenvoegHint(tekst) {
  return /\bsamen\b/i.test(String(tekst || ''));
}

// Probeert uit vrije tekst (bv. een Excel-opmerking) de doelgroep van een
// samenvoeging te bepalen. Matcht op de groepsnaam of de korte vorm ("2&3").
// Geeft het groepId terug, of null als het niet betrouwbaar te bepalen is.
export function resolveSamenvoegGroep(tekst, groepen, huidigeGroepId) {
  if (!tekst || !heeftSamenvoegHint(tekst)) return null;
  const t = String(tekst).toLowerCase();
  for (const g of groepen || []) {
    if (!g || g.id === huidigeGroepId) continue;
    const naam = String(g.naam || '').toLowerCase().trim();
    if (!naam) continue;
    const kort = naam.replace(/groep/g, '').replace(/\s+/g, '').trim(); // "Groep 2&3" -> "2&3"
    if (t.includes(naam)) return g.id;
    if (kort.length >= 2 && t.replace(/\s+/g, '').includes(kort)) return g.id;
  }
  return null;
}
