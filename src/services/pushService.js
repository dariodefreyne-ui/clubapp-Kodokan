// src/services/pushService.js
// Client-side helper voor het aanmaken van push-trigger documenten.
// Paginas importeren stuurPushTrigger() en PUSH_TYPES uit dit bestand.
// De Cloud Function in functions/index.js verwerkt de triggers asynchroon.

import { addPushTrigger } from './firestoreService';

// ─── TYPE CONSTANTEN ──────────────────────────────────────────────────────────

export const PUSH_TYPES = {
  // Trainingen
  TRAINING_GEANNULEERD:   'training_geannuleerd',
  TRAINING_VERPLAATST:    'training_verplaatst',
  TRAINER_TOEGEWEZEN:     'trainer_toegewezen',

  // Wedstrijden
  TORNOOI_GEANNULEERD:    'tornooi_geannuleerd',
  TORNOOI_GEWIJZIGD:      'tornooi_gewijzigd',
  INSCHRIJVING_BEVESTIGD: 'inschrijving_bevestigd',
  NIEUWE_INSCHRIJVING:    'nieuwe_inschrijving',

  // Examens
  EXAMEN_GEPLAND:         'examen_gepland',
  GRAAD_TOEGEKEND:        'graad_toegekend',
  UITGENODIGD_EXAMEN:     'uitgenodigd_examen',

  // Club
  NIEUW_LID:              'nieuw_lid',
  CLUBBERICHT:            'clubbericht',
};

// ─── HOOFD-FUNCTIE ────────────────────────────────────────────────────────────

/**
 * Schrijf een push-trigger naar Firestore.
 * De Cloud Function verwerkt dit asynchroon en stuurt de FCM-push.
 *
 * Fire-and-forget: paginas hoeven niet te wachten op het resultaat.
 * Fouten worden stil gelogd — een mislukte push mag nooit een save blokkeren.
 *
 * @param {string} type     - Een van de PUSH_TYPES waarden
 * @param {object} payload  - Context voor de melding (naam, datum, uid, ...)
 */
export function stuurPushTrigger(type, payload = {}) {
  addPushTrigger(type, payload).catch(err => {
    console.warn('[pushService] Trigger niet opgeslagen:', type, err.message);
  });
  // Geen return, geen await — bewust fire-and-forget
}
