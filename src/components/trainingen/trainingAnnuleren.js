// src/components/trainingen/trainingAnnuleren.js
// Gedeelde annuleerlogica voor trainingen (Firestore-update + push).
// UI (confirm-dialoog, toast) blijft in de aanroepende component.
//
// Schrijft ENKEL status + geannuleerd (+ audit via updateMetAudit).
// `opmerking` en `trainerNotitie` blijven onaangeroerd (partiële updateDoc).
// Geen extra reads: de voorwaarden worden gecontroleerd op het meegegeven
// training-object.

import { doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { updateMetAudit } from '../../services/firestoreService';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { TRAINING_STATUS } from './trainingStatus';
import { vandaagISO } from './seizoenHelpers';

/**
 * Annuleert een training en stuurt de push naar de leden.
 *
 * @param {object} training  Training-object met minstens id en datum
 * @param {object} [opties]
 * @param {string} [opties.groepNaam]  Weergavenaam van de groep voor de push.
 *   Trainingsdocumenten bewaren meestal geen groepNaam; geef daarom de naam
 *   uit de groepenlijst mee. Fallback: training.groepNaam, dan groepId.
 * @returns {Promise<{gewijzigd: boolean, reden?: string}>}
 *   gewijzigd=false: niets geschreven, geen push (al geannuleerd).
 * @throws {Error} bij ontbrekend id, ontbrekende datum of datum in het verleden,
 *   of wanneer de Firestore-update mislukt. In dat geval wordt GEEN push verstuurd.
 */
export async function annuleerTraining(training, { groepNaam } = {}) {
  if (!training?.id) {
    throw new Error('Training niet gevonden.');
  }
  if (!training.datum) {
    throw new Error('Deze training heeft geen datum.');
  }
  if (training.datum < vandaagISO()) {
    throw new Error('Een training in het verleden kan niet geannuleerd worden.');
  }
  if (training.status === TRAINING_STATUS.GEANNULEERD || training.geannuleerd) {
    return { gewijzigd: false, reden: 'al_geannuleerd' };
  }

  await updateMetAudit(doc(db, 'trainingen', training.id), {
    status: TRAINING_STATUS.GEANNULEERD,
    geannuleerd: true,
  });

  // Fire-and-forget, enkel na geslaagde update.
  stuurPushTrigger(PUSH_TYPES.TRAINING_GEANNULEERD, {
    groepId: training.groepId || '',
    groepNaam: groepNaam || training.groepNaam || training.groepId || '',
    datum: training.datum || '',
  });

  return { gewijzigd: true };
}
