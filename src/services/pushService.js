// src/services/pushService.js
// Client-side helper voor het aanmaken van push-trigger documenten.
// Paginas importeren stuurPushTrigger() en PUSH_TYPES uit dit bestand.
// De Cloud Function in functions/index.js verwerkt de triggers asynchroon
// via de centrale dispatcher (functions/notifications/dispatcher.js).

import { addPushTrigger } from './firestoreService';

// ─── TYPE CONSTANTEN ──────────────────────────────────────────────────────────
// Moet in sync blijven met functions/notifications/categories.js.

export const PUSH_TYPES = {
  // Trainingen
  TRAINING_GEANNULEERD:   'training_geannuleerd',
  TRAINING_VERPLAATST:    'training_verplaatst',
  TRAINER_TOEGEWEZEN:     'trainer_toegewezen',

  // Wedstrijden
  NIEUW_TORNOOI:          'nieuw_tornooi',
  TORNOOI_GEANNULEERD:    'tornooi_geannuleerd',
  TORNOOI_GEWIJZIGD:      'tornooi_gewijzigd',

  // Inschrijvingen
  INSCHRIJVING_BEVESTIGD: 'inschrijving_bevestigd',
  NIEUWE_INSCHRIJVING:    'nieuwe_inschrijving',

  // Examens
  EXAMEN_GEPLAND:         'examen_gepland',
  GRAAD_TOEGEKEND:        'graad_toegekend',
  UITGENODIGD_EXAMEN:     'uitgenodigd_examen',

  // Club
  NIEUW_LID:              'nieuw_lid',
  CLUBBERICHT:            'clubbericht',

  // Evenementen (nieuw)
  NIEUW_EVENEMENT:        'nieuw_evenement',
  EVENEMENT_GEWIJZIGD:    'evenement_gewijzigd',
  EVENEMENT_GEANNULEERD:  'evenement_geannuleerd',
};

// ─── HOOFD-FUNCTIE ────────────────────────────────────────────────────────────

/**
 * Schrijf een push-trigger naar Firestore.
 * De Cloud Function verwerkt dit asynchroon en stuurt de FCM-push via de
 * centrale dispatcher (filtering op rubriek-voorkeur gebeurt daar).
 *
 * Fire-and-forget: paginas hoeven niet te wachten op het resultaat.
 *
 * @param {string} type     - Een van de PUSH_TYPES waarden
 * @param {object} payload  - Context voor de melding (naam, datum, uid, ...)
 */
export function stuurPushTrigger(type, payload = {}) {
  addPushTrigger(type, payload).catch(err => {
    console.warn('[pushService] Trigger niet opgeslagen:', type, err.message);
  });
}
